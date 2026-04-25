package pipeline

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/hraban/opus"
)

const (
	ttsRate       = 48000             // output sample rate (Hz)
	ttsChannels   = 1                 // mono
	frameSize     = 960               // 20 ms frame at 48 kHz (samples)
	pcmFrameBytes = frameSize * 2     // 1920 bytes per 20 ms frame (s16le)
)

// DeepgramTTS converts text to PCM via Deepgram Aura and streams Opus frames.
// Each StreamOpusFrames call uses its own short-lived Opus encoder so the
// pipeline can run multiple synth jobs concurrently without locking.
type DeepgramTTS struct {
	model  string       // e.g. "aura-2-asteria-en"
	client *http.Client // re-used across calls (keep-alive, TLS reuse)
}

// NewDeepgramTTS picks a voice based on TTS_VOICE env or target language.
func NewDeepgramTTS(targetLang string) (*DeepgramTTS, error) {
	model := os.Getenv("TTS_VOICE")
	if model == "" {
		switch targetLang {
		case "hi":
			model = "aura-2-thalia-en" // closest neutral; Aura 2 Hindi in beta
		case "es":
			model = "aura-2-luna-en"
		case "fr":
			model = "aura-2-stella-en"
		default:
			model = "aura-2-asteria-en"
		}
	}
	return &DeepgramTTS{
		model:  model,
		client: &http.Client{}, // default transport is fine; no timeout (ctx handles it)
	}, nil
}

// StreamOpusFrames synthesizes `text` via Deepgram Aura streaming PCM and
// pushes 20 ms Opus frames to frameC as soon as enough PCM has arrived to
// encode each one.
//
// Critical for low first-frame latency: instead of io.ReadAll'ing the full
// response (which made tts_first_frame ~1.5–2.5 s for any non-trivial sentence),
// we drain the body incrementally and emit each frame the moment it's ready.
//
// The caller is responsible for closing frameC AFTER this function returns.
// Returns (nil) on EOF, ctx.Err() if cancelled, or a wrapped error otherwise.
func (t *DeepgramTTS) StreamOpusFrames(
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

	payload, _ := json.Marshal(map[string]string{"text": text})
	url := fmt.Sprintf(
		"https://api.deepgram.com/v1/speak?model=%s&encoding=linear16&sample_rate=%d&container=none",
		t.model, ttsRate,
	)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	req.Header.Set("Authorization", "Token "+os.Getenv("DEEPGRAM_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	resp, err := t.client.Do(req)
	if err != nil {
		return fmt.Errorf("deepgram tts request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("deepgram tts %d: %s", resp.StatusCode, b)
	}

	// Streaming PCM → 20 ms Opus frames
	pcmBuf := make([]byte, 0, pcmFrameBytes*4) // accumulate PCM here
	readBuf := make([]byte, 8192)              // ~4 frames worth
	opusBuf := make([]byte, 4000)              // max Opus frame size (RFC 6716)

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

	for {
		n, rerr := resp.Body.Read(readBuf)
		if n > 0 {
			pcmBuf = append(pcmBuf, readBuf[:n]...)
			for len(pcmBuf) >= pcmFrameBytes {
				if err := flushOne(); err != nil {
					return err
				}
			}
		}
		if rerr == io.EOF {
			break
		}
		if rerr != nil {
			// ctx cancellation surfaces as "context canceled" here
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return fmt.Errorf("deepgram tts read: %w", rerr)
		}
	}

	// Flush trailing partial frame (pad with silence)
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

func bytesToInt16(b []byte) []int16 {
	out := make([]int16, len(b)/2)
	for i := range out {
		out[i] = int16(binary.LittleEndian.Uint16(b[i*2 : i*2+2]))
	}
	return out
}
