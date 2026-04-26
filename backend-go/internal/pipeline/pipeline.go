package pipeline

import (
	"context"
	"log"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// EndpointDebounce is the fallback silence window we wait after a final
// transcript before firing the LLM if the semantic turn detector hasn't already
// fired. Reduced from 600ms now that NAMO handles most turn completions
// semantically before the timer would expire.
//
//   - lower  → snappier but more mid-sentence interruptions
//   - higher → more natural but slower perceived latency
const EndpointDebounce = 150 * time.Millisecond

// SemanticFireThreshold is the minimum NAMO confidence required to fire the
// LLM immediately on a semantic "turn complete" signal, bypassing the debounce.
// Raise this (e.g. 0.80) to be more conservative; lower (e.g. 0.55) for speed.
const SemanticFireThreshold = 0.65

// MetricEvent is a timed pipeline event published to the frontend
// via LiveKit data channel so the UI can show a live conversation panel.
type MetricEvent struct {
	Type        string `json:"type"`        // speech_started, user_interim, user_final, user_done, semantic_turn_end, llm_start, llm_first_token, llm_done, tts_start, tts_first_frame, audio_playing, barge_in
	TurnID      int64  `json:"turn_id"`
	Text        string `json:"text,omitempty"`
	DelayMs     int64  `json:"delay_ms,omitempty"` // ms since this turn started
	TimestampMs int64  `json:"ts"`                 // unix milliseconds
}

// Pipeline orchestrates STT → LLM → TTS with turn detection and barge-in.
type Pipeline struct {
	stt *DeepgramSTT
	llm LLM
	tts TTSEncoder

	// bargeDetector is a fast, local "user is talking" trigger that runs in
	// parallel with Deepgram's SpeechStarted event. It cancels TTS within
	// ~60ms of speech onset (vs. Deepgram's typical 150-300ms VAD latency).
	// Optional — set to nil to disable.
	bargeDetector *BargeDetector

	// speakCtx is cancelled when the user interrupts (barge-in).
	// A fresh ctx is created for every AI response turn.
	speakCtx    context.Context
	speakCancel context.CancelFunc
	speakMu     sync.Mutex

	// Accumulated user utterance across multiple final transcripts in a turn.
	utteranceBuf strings.Builder
	utteranceMu  sync.Mutex

	// Debounce timer that fires when user has been silent long enough.
	endpointTimer *time.Timer
	timerMu       sync.Mutex

	// Turn metadata.
	turnID    atomic.Int64 // incremented on every SpeechStarted
	turnStart atomic.Int64 // unix nanos; 0 if no turn

	// Whether the agent is currently publishing audio.
	isSpeaking atomic.Int32

	// Callbacks wired by agent/main.go.
	//   OnOpusFrames: invoked ONCE per response turn. The implementation must
	//                 drain frameC, pace at 20ms intervals, and write each frame
	//                 to the LiveKit audio track. The channel closes when the
	//                 turn's full audio has been streamed (or ctx is cancelled).
	//                 The implementation must honor ctx.Done() so barge-in stops
	//                 playback mid-word.
	//   OnSpeakText:  used in D-ID video mode instead of OnOpusFrames.
	//   OnEvent:      receives every MetricEvent for publishing to the data channel.
	//   OnTranscript: receives the committed user transcript (for logging).
	OnOpusFrames func(ctx context.Context, frameC <-chan []byte)
	OnSpeakText  func(text string)
	OnEvent      func(evt MetricEvent)
	OnTranscript func(text string)
}

// TTSEncoder is the contract every TTS provider must satisfy. Implementations
// MUST emit fully-encoded 20ms Opus frames (48kHz mono) to frameC and respect
// ctx cancellation immediately so barge-in stays sub-100ms.
type TTSEncoder interface {
	StreamOpusFrames(ctx context.Context, text string, frameC chan<- []byte) error
}

// New creates a new pipeline using the default Deepgram Aura TTS.
// sourceLang / targetLang are BCP-47 codes; pass "" for English.
func New(systemPrompt, sourceLang, targetLang string) (*Pipeline, error) {
	tts, err := NewDeepgramTTS(targetLang)
	if err != nil {
		return nil, err
	}
	return NewWithTTS(systemPrompt, sourceLang, targetLang, tts)
}

// NewWithTTS builds a pipeline with a caller-supplied TTSEncoder. Use this
// to swap in Cartesia WS, ElevenLabs, etc., without touching the rest of the
// pipeline. Default behaviour (Deepgram Aura) is unchanged when callers stay
// on New().
func NewWithTTS(systemPrompt, sourceLang, targetLang string, tts TTSEncoder) (*Pipeline, error) {
	stt, err := NewDeepgramSTT()
	if err != nil {
		return nil, err
	}
	p := &Pipeline{
		stt: stt,
		llm: NewLLM(buildSystemPrompt(systemPrompt, sourceLang, targetLang)),
		tts: tts,
	}
	// Wire local-VAD fast barge-in. The detector borrows isSpeaking and
	// cancels TTS the moment it sees sustained voice — much faster than
	// waiting for Deepgram's SpeechStarted to round-trip.
	bd, err := NewBargeDetector(&p.isSpeaking, func() {
		p.emitSimple("barge_in")
		p.cancelSpeak()
	})
	if err != nil {
		log.Printf("[pipeline] barge detector init failed (continuing without): %v", err)
	} else {
		p.bargeDetector = bd
	}
	return p, nil
}

// buildSystemPrompt appends translation instructions when source and target differ.
func buildSystemPrompt(base, sourceLang, targetLang string) string {
	if targetLang == "" || targetLang == sourceLang {
		return base
	}
	langNames := map[string]string{
		"en": "English", "es": "Spanish", "fr": "French", "de": "German",
		"it": "Italian", "pt": "Portuguese", "ja": "Japanese", "ko": "Korean",
		"zh": "Chinese", "ar": "Arabic", "hi": "Hindi", "ru": "Russian",
		"nl": "Dutch", "pl": "Polish", "sv": "Swedish", "tr": "Turkish",
	}
	srcName := langNames[sourceLang]
	if srcName == "" {
		srcName = sourceLang
	}
	tgtName := langNames[targetLang]
	if tgtName == "" {
		tgtName = targetLang
	}
	return base + "\n\nTRANSLATION MODE: The caller speaks " + srcName +
		". Always respond in " + tgtName + " regardless of what language the caller uses."
}

// SendAudio accepts a raw Opus payload from a LiveKit RTP packet.
// Routes the same payload to (a) Deepgram STT for transcription/turn detection
// and (b) the local BargeDetector for fast TTS interruption.
//
// Both run in this same goroutine so the local VAD runs before Deepgram even
// sees the bytes — keeps the detector's decoder safe (single-caller).
func (p *Pipeline) SendAudio(opusPayload []byte) {
	if p.bargeDetector != nil {
		p.bargeDetector.Feed(opusPayload)
	}
	_ = p.stt.SendAudio(opusPayload)
}

// SpeakText synthesises text immediately (e.g. for greetings) without LLM.
// Barge-in applies: if the user starts talking during this, it will be cancelled.
func (p *Pipeline) SpeakText(text string) {
	p.turnID.Add(1)
	p.turnStart.Store(time.Now().UnixNano())
	ctx := p.newSpeakContext()
	p.isSpeaking.Store(1)
	defer p.isSpeaking.Store(0)

	chunkQ := make(chan string, 1)
	chunkQ <- text
	close(chunkQ)
	p.speakChunks(ctx, chunkQ)
}

// Run is the main event loop. Blocks until STT connection closes.
func (p *Pipeline) Run() {
	for {
		select {
		case _, ok := <-p.stt.SpeechStartedC:
			if !ok {
				return
			}
			p.handleSpeechStarted()

		case text, ok := <-p.stt.InterimC:
			if !ok {
				return
			}
			p.handleInterim(text)

		case text, ok := <-p.stt.FinalC:
			if !ok {
				return
			}
			p.handleFinal(text)

		case _, ok := <-p.stt.UtteranceEndC:
			if !ok {
				return
			}
			// Informational — we run our own debounce (EndpointDebounce) for control
			p.emitSimple("deepgram_utterance_end")
		}
	}
}

// Close shuts down the Deepgram connection and ends Run().
func (p *Pipeline) Close() {
	p.stt.Close()
	p.cancelSpeak()
	p.cancelEndpointTimer()
}

// ── Event handlers ────────────────────────────────────────────────────────────

func (p *Pipeline) handleSpeechStarted() {
	// Barge-in: cancel any ongoing AI speech immediately.
	if p.isSpeaking.Load() == 1 {
		log.Printf("[pipeline] BARGE-IN detected; canceling AI speech")
		p.emitSimple("barge_in")
		p.cancelSpeak()
	}

	// Start a new turn.
	turnID := p.turnID.Add(1)
	p.turnStart.Store(time.Now().UnixNano())

	p.utteranceMu.Lock()
	p.utteranceBuf.Reset()
	p.utteranceMu.Unlock()

	p.cancelEndpointTimer()

	log.Printf("[turn-%d] speech_started", turnID)
	p.emit("speech_started", "", 0)
}

func (p *Pipeline) handleInterim(text string) {
	turnID := p.turnID.Load()
	delay := p.turnDelayMs()
	log.Printf("[turn-%d] interim (%dms): %q", turnID, delay, text)
	p.emit("user_interim", text, delay)
	// User is actively speaking — kill any pending endpoint timer
	p.cancelEndpointTimer()
}

func (p *Pipeline) handleFinal(text string) {
	turnID := p.turnID.Load()
	delay := p.turnDelayMs()
	log.Printf("[turn-%d] final (%dms): %q", turnID, delay, text)

	p.utteranceMu.Lock()
	if p.utteranceBuf.Len() > 0 {
		p.utteranceBuf.WriteString(" ")
	}
	p.utteranceBuf.WriteString(text)
	accumulated := p.utteranceBuf.String()
	p.utteranceMu.Unlock()

	p.emit("user_final", text, delay)

	// ── Semantic turn detection ──────────────────────────────────────────────
	// Ask the NAMO sidecar whether the accumulated ASR text is a complete turn.
	// This call is synchronous but bounded to 100ms (turnDetectorHTTPTimeout).
	// NAMO inference is <20ms; Docker bridge adds ~1ms. In practice <25ms total.
	//
	// If confident the turn is done → fire LLM immediately (skip the timer).
	// On sidecar failure (down/timeout) → fall through to the debounce timer.
	complete, conf, err := semanticTurnCheck(accumulated)
	if err != nil {
		log.Printf("[turn-%d] turn-detector unavailable, using debounce: %v", turnID, err)
	} else if complete && conf >= SemanticFireThreshold {
		log.Printf("[turn-%d] semantic fire (conf=%.2f): %q", turnID, conf, accumulated)
		p.cancelEndpointTimer()
		p.emit("semantic_turn_end", accumulated, delay)
		go p.fireResponse(accumulated)
		return
	}

	// ── Silence-based fallback ───────────────────────────────────────────────
	// Either the sidecar said "not done yet" or it was unavailable.
	// Reset/start the debounce timer. Duration is now 150ms (was 600ms) because
	// the semantic model catches most "clearly done" turns above, so we only
	// need a short window for mid-sentence pauses.
	p.timerMu.Lock()
	if p.endpointTimer != nil {
		p.endpointTimer.Stop()
	}
	p.endpointTimer = time.AfterFunc(EndpointDebounce, func() {
		p.fireResponse(accumulated)
	})
	p.timerMu.Unlock()
}

// fireResponse commits the accumulated user utterance and runs LLM → TTS.
func (p *Pipeline) fireResponse(fullText string) {
	fullText = strings.TrimSpace(fullText)
	if fullText == "" {
		return
	}
	turnID := p.turnID.Load()
	delay := p.turnDelayMs()
	log.Printf("[turn-%d] user_done (%dms), firing LLM: %q", turnID, delay, fullText)
	p.emit("user_done", fullText, delay)

	if p.OnTranscript != nil {
		p.OnTranscript(fullText)
	}

	// Reset utterance buffer for the next turn
	p.utteranceMu.Lock()
	p.utteranceBuf.Reset()
	p.utteranceMu.Unlock()

	// New cancellable ctx for this AI response
	ctx := p.newSpeakContext()

	p.isSpeaking.Store(1)
	p.respond(ctx, fullText)
	p.isSpeaking.Store(0)
}

// respond streams LLM → pipelined-TTS with barge-in support via ctx.
//
// Architecture:
//
//	tokenC  ── LLM tokens ───────────────► chunkQ  ── sentence-sized chunks
//	                                            │
//	                                            ▼
//	                          speakChunks (single goroutine, drains chunkQ)
//	                                            │
//	                                            ▼  per chunk: streaming TTS → frames
//	                                          frameC ─────────────────────► OnOpusFrames
//	                                                                        (paces 20ms)
//
// chunkQ is buffered (size 4) so the LLM token loop can push the next sentence
// before the current one finishes synthesizing. speakChunks blocks on TTS
// (which streams) but the OnOpusFrames consumer drains frames in real time,
// so the wall-clock latency for each chunk is ~250ms instead of the ~1500ms
// io.ReadAll-then-batch-encode it used to be.
func (p *Pipeline) respond(ctx context.Context, userText string) {
	turnID := p.turnID.Load()
	llmStartDelay := p.turnDelayMs()
	log.Printf("[turn-%d] llm_start (%dms)", turnID, llmStartDelay)
	p.emit("llm_start", "", llmStartDelay)

	tokenC := make(chan string, 128)
	chunkQ := make(chan string, 4)

	// Audio worker: drains chunkQ → calls TTS streaming → publishes frames
	speakDone := make(chan struct{})
	go func() {
		defer close(speakDone)
		p.speakChunks(ctx, chunkQ)
	}()

	// LLM streaming
	llmStart := time.Now()
	go func() {
		if _, err := p.llm.Stream(userText, tokenC); err != nil {
			log.Printf("[turn-%d] LLM error: %v", turnID, err)
		}
	}()

	firstToken := false
	var fullReply, chunkBuf strings.Builder

	pushChunk := func() {
		r := strings.TrimSpace(chunkBuf.String())
		chunkBuf.Reset()
		if r == "" {
			return
		}
		select {
		case <-ctx.Done():
		case chunkQ <- r:
		}
	}

	for token := range tokenC {
		select {
		case <-ctx.Done():
			log.Printf("[turn-%d] LLM cancelled mid-stream (barge-in)", turnID)
			go func() {
				for range tokenC {
				}
			}()
			close(chunkQ)
			<-speakDone
			return
		default:
		}
		if !firstToken {
			ftDelay := time.Since(llmStart).Milliseconds()
			log.Printf("[turn-%d] llm_first_token (+%dms)", turnID, ftDelay)
			p.emit("llm_first_token", "", ftDelay)
			firstToken = true
		}
		fullReply.WriteString(token)
		chunkBuf.WriteString(token)
		if shouldFlush(chunkBuf.String()) {
			pushChunk()
		}
	}
	pushChunk()      // remainder
	close(chunkQ)    // signal speakChunks no more text incoming

	llmTotal := time.Since(llmStart).Milliseconds()
	log.Printf("[turn-%d] llm_done (+%dms): %q", turnID, llmTotal, fullReply.String())
	p.emit("llm_done", fullReply.String(), llmTotal)

	<-speakDone // wait for all audio to be published
}

// speakChunks consumes text chunks from chunkQ, synthesizes each via streaming
// TTS, and publishes the resulting Opus frames through OnOpusFrames.
//
// Returns only when chunkQ is closed AND all in-flight audio has been emitted
// (or ctx is cancelled). Used by both respond() (multi-chunk) and SpeakText()
// (single chunk for greetings).
//
// In D-ID video mode (OnSpeakText set), bypasses TTS entirely and forwards
// each chunk's text to D-ID, which handles its own audio + lipsync.
func (p *Pipeline) speakChunks(ctx context.Context, chunkQ <-chan string) {
	turnID := p.turnID.Load()

	// ── D-ID video mode ─────────────────────────────────────────────────
	if p.OnSpeakText != nil {
		for chunk := range chunkQ {
			select {
			case <-ctx.Done():
				return
			default:
			}
			p.OnSpeakText(chunk)
		}
		return
	}

	// ── Audio mode (Deepgram TTS streaming → OnOpusFrames) ─────────────
	if p.OnOpusFrames == nil {
		// No audio sink wired; drain to unblock producer
		for range chunkQ {
		}
		return
	}

	frameC := make(chan []byte, 128)

	// Start single OnOpusFrames consumer for the whole turn
	pubDone := make(chan struct{})
	go func() {
		defer close(pubDone)
		p.OnOpusFrames(ctx, frameC)
	}()

	// Drive synth chunk-by-chunk; each chunk's frames flow into the same frameC
	// in order, so the publisher hears one continuous stream per turn.
	cancelled := false
	for chunk := range chunkQ {
		if cancelled {
			continue // keep draining to let producer close
		}
		select {
		case <-ctx.Done():
			cancelled = true
			continue
		default:
		}

		ttsStart := time.Now()
		log.Printf("[turn-%d] tts_start: %q", turnID, chunk)
		p.emit("tts_start", chunk, p.turnDelayMs())

		// Per-chunk frame channel so we can detect first-frame for metrics
		chunkFrameC := make(chan []byte, 64)
		errC := make(chan error, 1)
		go func() {
			errC <- p.tts.StreamOpusFrames(ctx, chunk, chunkFrameC)
			close(chunkFrameC)
		}()

		firstFrame := true
		for frame := range chunkFrameC {
			if firstFrame {
				ttsElapsed := time.Since(ttsStart).Milliseconds()
				log.Printf("[turn-%d] tts_first_frame (+%dms)", turnID, ttsElapsed)
				p.emit("tts_first_frame", "", ttsElapsed)
				p.emit("audio_playing", "", p.turnDelayMs())
				firstFrame = false
			}
			select {
			case <-ctx.Done():
				cancelled = true
				go func() {
					for range chunkFrameC {
					}
				}()
				goto chunkDone
			case frameC <- frame:
			}
		}
	chunkDone:
		if err := <-errC; err != nil && ctx.Err() == nil {
			log.Printf("[turn-%d] tts error: %v", turnID, err)
		}
	}

	close(frameC)
	<-pubDone
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func (p *Pipeline) newSpeakContext() context.Context {
	p.speakMu.Lock()
	defer p.speakMu.Unlock()
	if p.speakCancel != nil {
		p.speakCancel()
	}
	ctx, cancel := context.WithCancel(context.Background())
	p.speakCtx = ctx
	p.speakCancel = cancel
	return ctx
}

func (p *Pipeline) cancelSpeak() {
	p.speakMu.Lock()
	defer p.speakMu.Unlock()
	if p.speakCancel != nil {
		p.speakCancel()
	}
}

func (p *Pipeline) cancelEndpointTimer() {
	p.timerMu.Lock()
	defer p.timerMu.Unlock()
	if p.endpointTimer != nil {
		p.endpointTimer.Stop()
		p.endpointTimer = nil
	}
}

func (p *Pipeline) turnDelayMs() int64 {
	start := p.turnStart.Load()
	if start == 0 {
		return 0
	}
	return (time.Now().UnixNano() - start) / int64(time.Millisecond)
}

func (p *Pipeline) emit(evtType, text string, delay int64) {
	if p.OnEvent == nil {
		return
	}
	p.OnEvent(MetricEvent{
		Type:        evtType,
		TurnID:      p.turnID.Load(),
		Text:        text,
		DelayMs:     delay,
		TimestampMs: time.Now().UnixMilli(),
	})
}

func (p *Pipeline) emitSimple(evtType string) {
	p.emit(evtType, "", p.turnDelayMs())
}

// shouldFlush returns true when we have enough text to send to TTS.
// Flushing at sentence boundaries keeps TTFA low while sounding natural.
func shouldFlush(s string) bool {
	if len(s) == 0 {
		return false
	}
	last := s[len(s)-1]
	if last == '.' || last == '!' || last == '?' || last == '\n' {
		return true
	}
	if len(s) > 150 {
		return true
	}
	return false
}
