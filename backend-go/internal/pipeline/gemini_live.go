package pipeline

// Gemini Live API integration — alternative to the STT+LLM+TTS pipeline.
//
// Architecture:
//   LiveKit (Opus 48k) → opus.Decode → 48k PCM → downsample → 16k PCM
//                                                                  ↓
//                                                      WebSocket (realtimeInput)
//                                                                  ↓
//                                                       Gemini Live (model)
//                                                                  ↓
//                                                      WebSocket (serverContent)
//                                                                  ↓
//                                       24k PCM ← base64 ← inlineData
//                                          ↓
//                              upsample → 48k PCM → opus.Encode (20ms frames)
//                                                                  ↓
//                                              OnOpusFrames → LiveKit audio out
//
// The model handles VAD, turn-taking, and barge-in itself. When the user
// interrupts, Gemini emits {"interrupted": true} which we propagate to
// cancel the in-flight audio frames.
//
// Selection: choose this provider via room metadata "voice_mode": "gemini_live".
// Default model: gemini-2.5-flash-native-audio-latest. Override via
// GEMINI_LIVE_MODEL. Voice override via GEMINI_LIVE_VOICE (Aoede default).

import (
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hraban/opus"
)

const (
	geminiLiveDefaultModel = "gemini-2.5-flash-native-audio-latest"
	geminiLiveDefaultVoice = "Aoede"
	geminiLiveURLFmt       = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=%s"
	geminiLiveInputRate    = 16000 // PCM rate Gemini expects on the wire
	geminiLiveOutputRate   = 24000 // PCM rate Gemini emits
	geminiLiveOpusFrameSz  = 960   // 20ms at 48kHz (samples)
)

// GeminiLive is a voice session backed by Google's Gemini Live WebSocket API.
// It exposes the same callback shape as Pipeline (OnOpusFrames + OnEvent) so
// cmd/agent/main.go can swap implementations based on room metadata.
type GeminiLive struct {
	conn    *websocket.Conn
	writeMu sync.Mutex // protects all conn.Write* calls

	decoder *opus.Decoder // 48k Opus → 48k PCM (input from user)
	encoder *opus.Encoder // 48k PCM → 48k Opus (output to user)

	// Channels driving the output goroutine.
	audioInQ chan []byte   // PCM bytes from model (24kHz, raw)
	controlQ chan struct{} // signal: turnComplete
	shutdown chan struct{} // signal: graceful shutdown

	// Cancel func for the current output turn. Stored as atomic pointer so
	// handleServer can cancel from the WS read goroutine when "interrupted"
	// arrives, without taking a lock.
	turnCancel atomic.Pointer[context.CancelFunc]

	turnID    atomic.Int64
	turnStart atomic.Int64

	closed  atomic.Int32
	runDone chan struct{}

	// Callbacks wired by cmd/agent/main.go (same shape as Pipeline).
	OnOpusFrames func(ctx context.Context, frameC <-chan []byte)
	OnEvent      func(evt MetricEvent)
}

// NewGeminiLive opens a WebSocket to Gemini Live, sends the setup message,
// waits for setupComplete, and returns a session ready for SendAudio + Run.
func NewGeminiLive(systemPrompt string) (*GeminiLive, error) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY not set")
	}
	model := os.Getenv("GEMINI_LIVE_MODEL")
	if model == "" {
		model = geminiLiveDefaultModel
	}
	voice := os.Getenv("GEMINI_LIVE_VOICE")
	if voice == "" {
		voice = geminiLiveDefaultVoice
	}

	url := fmt.Sprintf(geminiLiveURLFmt, apiKey)
	dialer := websocket.DefaultDialer
	conn, _, err := dialer.Dial(url, http.Header{})
	if err != nil {
		return nil, fmt.Errorf("gemini live dial: %w", err)
	}

	setup := map[string]any{
		"setup": map[string]any{
			"model": "models/" + model,
			"generationConfig": map[string]any{
				"responseModalities": []string{"AUDIO"},
				"speechConfig": map[string]any{
					"voiceConfig": map[string]any{
						"prebuiltVoiceConfig": map[string]any{
							"voiceName": voice,
						},
					},
				},
			},
			"systemInstruction": map[string]any{
				"parts": []map[string]string{{"text": systemPrompt}},
			},
			"inputAudioTranscription":  map[string]any{},
			"outputAudioTranscription": map[string]any{},
		},
	}
	if err := conn.WriteJSON(setup); err != nil {
		conn.Close()
		return nil, fmt.Errorf("gemini live setup write: %w", err)
	}

	_, raw, err := conn.ReadMessage()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("gemini live setup read: %w", err)
	}
	var resp map[string]any
	_ = json.Unmarshal(raw, &resp)
	if _, ok := resp["setupComplete"]; !ok {
		conn.Close()
		return nil, fmt.Errorf("gemini live setup failed: %s", string(raw))
	}
	log.Printf("[gemini-live] connected model=%s voice=%s", model, voice)

	dec, err := opus.NewDecoder(48000, 1)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("opus decoder: %w", err)
	}
	enc, err := opus.NewEncoder(48000, 1, opus.AppVoIP)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("opus encoder: %w", err)
	}
	_ = enc.SetBitrate(24000)
	_ = enc.SetComplexity(5)

	return &GeminiLive{
		conn:     conn,
		decoder:  dec,
		encoder:  enc,
		audioInQ: make(chan []byte, 32),
		controlQ: make(chan struct{}, 4),
		shutdown: make(chan struct{}),
		runDone:  make(chan struct{}),
	}, nil
}

// SendAudio is called from the LiveKit RTP read goroutine for each Opus
// payload from the user. We decode → downsample → base64 → push over WS.
// Single-caller assumption: the opus.Decoder is not thread-safe.
func (g *GeminiLive) SendAudio(opusPayload []byte) {
	if g.closed.Load() == 1 {
		return
	}
	pcm48 := make([]int16, 5760) // up to 120ms at 48kHz
	n, err := g.decoder.Decode(opusPayload, pcm48)
	if err != nil {
		return
	}
	pcm16 := downsample48to16(pcm48[:n])

	msg := map[string]any{
		"realtimeInput": map[string]any{
			"mediaChunks": []map[string]any{
				{
					"mimeType": "audio/pcm;rate=16000",
					"data":     base64.StdEncoding.EncodeToString(int16ToBytes(pcm16)),
				},
			},
		},
	}
	g.writeMu.Lock()
	err = g.conn.WriteJSON(msg)
	g.writeMu.Unlock()
	if err != nil && g.closed.Load() == 0 {
		log.Printf("[gemini-live] send audio: %v", err)
	}
}

// SendInitialPrompt sends a one-shot user message to make the model speak first
// (used to deliver the room's greeting).
func (g *GeminiLive) SendInitialPrompt(text string) error {
	msg := map[string]any{
		"clientContent": map[string]any{
			"turns": []map[string]any{
				{
					"role":  "user",
					"parts": []map[string]string{{"text": text}},
				},
			},
			"turnComplete": true,
		},
	}
	g.writeMu.Lock()
	defer g.writeMu.Unlock()
	return g.conn.WriteJSON(msg)
}

// Wait returns a channel that closes when Run() exits (WS closed, error, etc).
// main.go selects on this AND the LiveKit OnDisconnected channel.
func (g *GeminiLive) Wait() <-chan struct{} {
	return g.runDone
}

// Run is the WebSocket read loop + output goroutine driver. Blocks until
// the WS closes (network drop, model session limit, Close()).
func (g *GeminiLive) Run() {
	defer close(g.runDone)

	outDone := make(chan struct{})
	go func() {
		defer close(outDone)
		g.outputLoop()
	}()
	defer func() {
		close(g.shutdown)
		<-outDone
	}()

	for {
		if g.closed.Load() == 1 {
			return
		}
		_, raw, err := g.conn.ReadMessage()
		if err != nil {
			if g.closed.Load() == 0 {
				log.Printf("[gemini-live] ws read: %v", err)
			}
			return
		}
		g.handleServer(raw)
	}
}

// Close gracefully shuts the session down. Safe to call multiple times.
func (g *GeminiLive) Close() {
	if !g.closed.CompareAndSwap(0, 1) {
		return
	}
	g.writeMu.Lock()
	g.conn.Close() // unblocks ReadMessage in Run
	g.writeMu.Unlock()
	<-g.runDone
}

// handleServer parses a single server message and dispatches its parts.
func (g *GeminiLive) handleServer(raw []byte) {
	var msg map[string]any
	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}
	sc, _ := msg["serverContent"].(map[string]any)
	if sc == nil {
		return
	}

	// Barge-in / interruption — model detected user speech mid-response.
	if interrupted, _ := sc["interrupted"].(bool); interrupted {
		log.Printf("[gemini-live] BARGE-IN")
		g.emit("barge_in", "", g.turnDelayMs())
		if cp := g.turnCancel.Load(); cp != nil {
			(*cp)()
		}
		return
	}

	// User transcript (input → text)
	if it, ok := sc["inputTranscription"].(map[string]any); ok {
		if text, _ := it["text"].(string); text != "" {
			g.emit("user_interim", text, g.turnDelayMs())
			if finished, _ := it["finished"].(bool); finished {
				g.turnID.Add(1)
				g.turnStart.Store(time.Now().UnixNano())
				log.Printf("[gemini-live] user_done: %q", text)
				g.emit("user_final", text, 0)
				g.emit("user_done", text, 0)
				g.emit("llm_start", "", 0)
			}
		}
	}

	// Model transcript (output → text, for caption panel)
	if ot, ok := sc["outputTranscription"].(map[string]any); ok {
		if text, _ := ot["text"].(string); text != "" {
			g.emit("llm_first_token", text, g.turnDelayMs())
		}
	}

	// Model audio
	if mt, ok := sc["modelTurn"].(map[string]any); ok {
		if parts, _ := mt["parts"].([]any); parts != nil {
			for _, p := range parts {
				part, _ := p.(map[string]any)
				inline, _ := part["inlineData"].(map[string]any)
				if inline == nil {
					continue
				}
				mimeType, _ := inline["mimeType"].(string)
				if !strings.HasPrefix(mimeType, "audio/") {
					continue
				}
				b64, _ := inline["data"].(string)
				pcm, err := base64.StdEncoding.DecodeString(b64)
				if err != nil || len(pcm) == 0 {
					continue
				}
				select {
				case g.audioInQ <- pcm:
				case <-g.shutdown:
					return
				}
			}
		}
	}

	// End of model turn
	if turnComplete, _ := sc["turnComplete"].(bool); turnComplete {
		log.Printf("[gemini-live] turn_complete")
		g.emit("llm_done", "", g.turnDelayMs())
		select {
		case g.controlQ <- struct{}{}:
		case <-g.shutdown:
		}
	}
}

// outputLoop owns the per-turn frame channel + Opus encoder state.
// State machine:
//
//	IDLE  ──audio─→  ACTIVE  ──turnComplete─→  IDLE
//	                    │
//	                    └──ctx.Done (interrupt)─→  IDLE
//
// Single goroutine = no contention on the encoder or leftover buffer.
func (g *GeminiLive) outputLoop() {
	var (
		frameC   chan []byte
		consDone chan struct{}
		ctx      context.Context
		cancel   context.CancelFunc
		leftover []int16
		opusBuf  = make([]byte, 4000)
	)

	startTurn := func() {
		c, cf := context.WithCancel(context.Background())
		ctx, cancel = c, cf
		g.turnCancel.Store(&cf)
		frameC = make(chan []byte, 256)
		consDone = make(chan struct{})
		g.emit("audio_playing", "", g.turnDelayMs())
		go func(c context.Context, fc <-chan []byte, d chan<- struct{}) {
			defer close(d)
			if g.OnOpusFrames != nil {
				g.OnOpusFrames(c, fc)
			} else {
				for range fc {
				}
			}
		}(ctx, frameC, consDone)
	}

	flushTrailing := func() {
		if len(leftover) == 0 || frameC == nil {
			return
		}
		for len(leftover) < geminiLiveOpusFrameSz {
			leftover = append(leftover, 0)
		}
		n, err := g.encoder.Encode(leftover[:geminiLiveOpusFrameSz], opusBuf)
		leftover = leftover[:0]
		if err != nil || n == 0 {
			return
		}
		frame := make([]byte, n)
		copy(frame, opusBuf[:n])
		select {
		case frameC <- frame:
		case <-ctx.Done():
		}
	}

	endTurn := func(interrupted bool) {
		if frameC == nil {
			return
		}
		if interrupted {
			cancel()
			leftover = nil
		} else {
			flushTrailing()
		}
		g.turnCancel.Store(nil)
		close(frameC)
		<-consDone
		frameC = nil
		consDone = nil
		ctx = nil
		cancel = nil
	}

	processChunk := func(pcm []byte) {
		if frameC == nil {
			startTurn()
		}
		if ctx.Err() != nil {
			// Mid-cancellation; drop until endTurn is processed
			return
		}
		pcm24 := bytesToInt16(pcm)
		pcm48 := upsample24to48(pcm24)
		leftover = append(leftover, pcm48...)
		for len(leftover) >= geminiLiveOpusFrameSz {
			n, err := g.encoder.Encode(leftover[:geminiLiveOpusFrameSz], opusBuf)
			leftover = leftover[geminiLiveOpusFrameSz:]
			if err != nil || n == 0 {
				continue
			}
			frame := make([]byte, n)
			copy(frame, opusBuf[:n])
			select {
			case frameC <- frame:
			case <-ctx.Done():
				leftover = nil
				return
			}
		}
	}

	for {
		if frameC == nil {
			// IDLE: wait for first audio chunk or shutdown
			select {
			case pcm, ok := <-g.audioInQ:
				if !ok {
					return
				}
				processChunk(pcm)
			case <-g.controlQ:
				// turnComplete with no audio buffered — ignore
			case <-g.shutdown:
				return
			}
		} else {
			// ACTIVE: process audio, watch for end / barge-in / shutdown
			select {
			case pcm, ok := <-g.audioInQ:
				if !ok {
					endTurn(false)
					return
				}
				processChunk(pcm)
			case <-g.controlQ:
				endTurn(false)
			case <-ctx.Done():
				endTurn(true)
			case <-g.shutdown:
				endTurn(true)
				return
			}
		}
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func (g *GeminiLive) emit(evtType, text string, delay int64) {
	if g.OnEvent == nil {
		return
	}
	g.OnEvent(MetricEvent{
		Type:        evtType,
		TurnID:      g.turnID.Load(),
		Text:        text,
		DelayMs:     delay,
		TimestampMs: time.Now().UnixMilli(),
	})
}

func (g *GeminiLive) turnDelayMs() int64 {
	start := g.turnStart.Load()
	if start == 0 {
		return 0
	}
	return (time.Now().UnixNano() - start) / int64(time.Millisecond)
}

// downsample48to16 reduces 48kHz PCM16 to 16kHz by simple decimation (3:1).
// Lossy (no anti-aliasing filter) but acceptable for voice — most speech
// energy sits below 8kHz anyway. For higher fidelity, swap in a polyphase
// filter (e.g. github.com/zaf/resample).
func downsample48to16(in []int16) []int16 {
	out := make([]int16, len(in)/3)
	for i := range out {
		out[i] = in[i*3]
	}
	return out
}

// upsample24to48 doubles 24kHz PCM16 to 48kHz via linear interpolation.
// Adequate for voice; replace with a proper interpolating filter for music.
func upsample24to48(in []int16) []int16 {
	if len(in) == 0 {
		return nil
	}
	out := make([]int16, len(in)*2)
	for i := 0; i < len(in)-1; i++ {
		out[i*2] = in[i]
		out[i*2+1] = int16((int32(in[i]) + int32(in[i+1])) / 2)
	}
	out[(len(in)-1)*2] = in[len(in)-1]
	out[(len(in)-1)*2+1] = in[len(in)-1] // hold last sample
	return out
}

func int16ToBytes(in []int16) []byte {
	out := make([]byte, len(in)*2)
	for i, s := range in {
		binary.LittleEndian.PutUint16(out[i*2:], uint16(s))
	}
	return out
}
