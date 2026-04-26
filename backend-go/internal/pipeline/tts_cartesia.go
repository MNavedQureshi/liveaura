package pipeline

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"time"

	"github.com/gorilla/websocket"
	"github.com/hraban/opus"
)

// Cartesia Sonic-2 WebSocket TTS.
//
// Why this exists alongside DeepgramTTS:
//
//   - Aura is HTTP-per-chunk: every chunk eats a TLS handshake (~30–80ms)
//     before the first PCM byte arrives. For multi-chunk responses that
//     overhead stacks linearly.
//   - Cartesia exposes a persistent WebSocket. One handshake at turn start;
//     subsequent chunks reuse the connection. Sonic-2 also has the lowest
//     reported time-to-first-byte of any production TTS today (~80ms).
//
// API contract: identical to DeepgramTTS — emits 20ms Opus frames at 48kHz
// mono via the package-level encoder constants. Drops in via TTSEncoder.

const (
	cartesiaWSURL   = "wss://api.cartesia.ai/tts/websocket"
	cartesiaVersion = "2024-06-10"
)

type CartesiaTTS struct {
	model    string // "sonic-2" | "sonic-english" | "sonic-multilingual"
	voiceID  string // Cartesia voice UUID
	apiKey   string
	language string
	dialer   *websocket.Dialer
}

func NewCartesiaTTS(targetLang string) (*CartesiaTTS, error) {
	apiKey := os.Getenv("CARTESIA_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("CARTESIA_API_KEY not set")
	}
	model := os.Getenv("CARTESIA_MODEL")
	if model == "" {
		model = "sonic-2"
	}
	voice := os.Getenv("CARTESIA_VOICE")
	if voice == "" {
		// Public default — "Sarah" warm female English voice.
		// Override via CARTESIA_VOICE env to use any voice from the catalog.
		voice = "694f9389-aac1-45b6-b726-9d9369183238"
	}
	lang := targetLang
	if lang == "" {
		lang = "en"
	}
	return &CartesiaTTS{
		model:    model,
		voiceID:  voice,
		apiKey:   apiKey,
		language: lang,
		dialer: &websocket.Dialer{
			HandshakeTimeout: 5 * time.Second,
		},
	}, nil
}

// StreamOpusFrames opens a fresh WebSocket per chunk (lightweight — handshake
// is HTTP/1.1 upgrade, ~50ms typical), sends one synth request, and pumps
// PCM → Opus → frameC as audio arrives. Per-chunk WS keeps the implementation
// simple and matches the call pattern of DeepgramTTS exactly. A future
// optimization is a long-lived per-pipeline WS, but that requires multiplexing
// context_ids and is not needed for parity with current Aura latency.
func (t *CartesiaTTS) StreamOpusFrames(
	ctx context.Context,
	text string,
	frameC chan<- []byte,
) error {
	enc, err := opus.NewEncoder(ttsRate, ttsChannels, opus.AppVoIP)
	if err != nil {
		return fmt.Errorf("opus encoder: %w", err)
	}
	_ = enc.SetBitrate(24000)
	_ = enc.SetComplexity(5)

	u, _ := url.Parse(cartesiaWSURL)
	q := u.Query()
	q.Set("api_key", t.apiKey)
	q.Set("cartesia_version", cartesiaVersion)
	u.RawQuery = q.Encode()

	conn, _, err := t.dialer.DialContext(ctx, u.String(), nil)
	if err != nil {
		return fmt.Errorf("cartesia ws dial: %w", err)
	}
	defer conn.Close()

	contextID := fmt.Sprintf("ctx-%d", time.Now().UnixNano())
	req := map[string]any{
		"context_id": contextID,
		"model_id":   t.model,
		"voice":      map[string]any{"mode": "id", "id": t.voiceID},
		"transcript": text,
		"continue":   false,
		"output_format": map[string]any{
			"container":   "raw",
			"encoding":    "pcm_s16le",
			"sample_rate": ttsRate,
		},
		"language": t.language,
	}
	if err := conn.WriteJSON(req); err != nil {
		return fmt.Errorf("cartesia ws send: %w", err)
	}

	pcmBuf := make([]byte, 0, pcmFrameBytes*4)
	opusBuf := make([]byte, 4000)

	flushOne := func() error {
		samples := bytesToInt16(pcmBuf[:pcmFrameBytes])
		pcmBuf = pcmBuf[pcmFrameBytes:]
		n, eErr := enc.Encode(samples, opusBuf)
		if eErr != nil {
			return fmt.Errorf("opus encode: %w", eErr)
		}
		frame := make([]byte, n)
		copy(frame, opusBuf[:n])
		select {
		case <-ctx.Done():
			return ctx.Err()
		case frameC <- frame:
			return nil
		}
	}

	type chunkResp struct {
		Type      string `json:"type"`
		Done      bool   `json:"done"`
		Data      string `json:"data"`
		ContextID string `json:"context_id"`
	}

	// Cancel-aware reader: if ctx cancels mid-read, force-close the conn so
	// the in-flight ReadMessage returns immediately. Critical for barge-in:
	// without this, ReadMessage blocks until a TCP-level timeout.
	readerDone := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			_ = conn.Close()
		case <-readerDone:
		}
	}()
	defer close(readerDone)

	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		_ = conn.SetReadDeadline(time.Now().Add(30 * time.Second))
		_, raw, rerr := conn.ReadMessage()
		if rerr != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			if websocket.IsCloseError(rerr, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				break
			}
			return fmt.Errorf("cartesia ws read: %w", rerr)
		}
		var r chunkResp
		if jerr := json.Unmarshal(raw, &r); jerr != nil {
			// Cartesia occasionally sends raw binary frames instead of JSON.
			// Treat any binary blob as PCM and encode directly.
			if len(raw) > 0 {
				pcmBuf = append(pcmBuf, raw...)
				for len(pcmBuf) >= pcmFrameBytes {
					if err := flushOne(); err != nil {
						return err
					}
				}
			}
			continue
		}
		if r.Data != "" {
			pcm, derr := base64.StdEncoding.DecodeString(r.Data)
			if derr == nil && len(pcm) > 0 {
				pcmBuf = append(pcmBuf, pcm...)
				for len(pcmBuf) >= pcmFrameBytes {
					if err := flushOne(); err != nil {
						return err
					}
				}
			}
		}
		if r.Done {
			break
		}
	}

	// Flush trailing partial frame (pad with silence to one full 20ms).
	if len(pcmBuf) > 0 {
		for len(pcmBuf) < pcmFrameBytes {
			pcmBuf = append(pcmBuf, 0, 0)
		}
		if err := flushOne(); err != nil {
			return err
		}
	}
	return nil
}
