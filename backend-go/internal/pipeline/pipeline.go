package pipeline

import (
	"log"
	"strings"
	"time"
)

// Pipeline orchestrates the STT → LLM → TTS voice loop.
// Call New() to create, then Run() to start (blocking).
type Pipeline struct {
	stt *DeepgramSTT
	llm *AnthropicLLM
	tts *CartesiaTTS

	// OnOpusFrames is called with each 20 ms Opus frame to publish into LiveKit.
	OnOpusFrames func(frames [][]byte)
	// OnTranscript is called with the final STT transcript (optional, for logging).
	OnTranscript func(text string)
}

// New initialises all pipeline components.
func New(systemPrompt string) (*Pipeline, error) {
	stt, err := NewDeepgramSTT()
	if err != nil {
		return nil, err
	}
	tts, err := NewCartesiaTTS()
	if err != nil {
		return nil, err
	}
	return &Pipeline{
		stt: stt,
		llm: NewAnthropicLLM(systemPrompt),
		tts: tts,
	}, nil
}

// SendAudio accepts a raw Opus payload from a LiveKit RTP packet.
func (p *Pipeline) SendAudio(opusPayload []byte) {
	_ = p.stt.SendAudio(opusPayload)
}

// SpeakText synthesises text immediately (e.g. for greetings) without LLM.
func (p *Pipeline) SpeakText(text string) {
	p.synth(text)
}

// Run blocks, consuming STT transcripts and driving the LLM→TTS loop.
// Returns when the STT connection closes (room disconnect).
func (p *Pipeline) Run() {
	for transcript := range p.stt.ResultC {
		log.Printf("[STT] %q", transcript)
		if p.OnTranscript != nil {
			p.OnTranscript(transcript)
		}
		p.respond(transcript)
	}
}

// Close shuts down the Deepgram connection and ends Run().
func (p *Pipeline) Close() {
	p.stt.Close()
}

// respond streams the LLM answer and synthesises speech at sentence boundaries
// to hit sub-200 ms time-to-first-audio (TTFA).
func (p *Pipeline) respond(userText string) {
	tokenC := make(chan string, 64)

	go func() {
		if _, err := p.llm.Stream(userText, tokenC); err != nil {
			log.Printf("[LLM] error: %v", err)
		}
	}()

	var buf strings.Builder
	start := time.Now()
	firstChunk := true

	for token := range tokenC {
		buf.WriteString(token)
		if shouldFlush(buf.String()) {
			chunk := strings.TrimSpace(buf.String())
			if chunk != "" {
				if firstChunk {
					log.Printf("[pipeline] TTFA: %dms", time.Since(start).Milliseconds())
					firstChunk = false
				}
				p.synth(chunk)
			}
			buf.Reset()
		}
	}
	// Flush any remaining text
	if remainder := strings.TrimSpace(buf.String()); remainder != "" {
		p.synth(remainder)
	}
}

func (p *Pipeline) synth(text string) {
	frames, err := p.tts.SynthesizeOpus(text)
	if err != nil {
		log.Printf("[TTS] error: %v", err)
		return
	}
	if p.OnOpusFrames != nil && len(frames) > 0 {
		p.OnOpusFrames(frames)
	}
}

// shouldFlush returns true when we have enough text to send to TTS.
// Flushing at sentence boundaries keeps TTFA low while sounding natural.
func shouldFlush(s string) bool {
	if len(s) == 0 {
		return false
	}
	last := s[len(s)-1]
	// Sentence-ending punctuation
	if last == '.' || last == '!' || last == '?' || last == '\n' {
		return true
	}
	// Long clause — flush to keep latency bounded
	if len(s) > 150 {
		return true
	}
	return false
}
