package pipeline

import (
	"bytes"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/hraban/opus"
)

const (
	ttsRate     = 48000 // output sample rate (Hz)
	ttsChannels = 1     // Mono
	frameSize   = 960   // 20 ms frame at 48 kHz (960 samples)
)

// DeepgramTTS converts text to PCM via Deepgram Aura and encodes to Opus frames.
// Uses the same DEEPGRAM_API_KEY already used for STT — no new credentials needed.
type DeepgramTTS struct {
	model   string // e.g. "aura-asteria-en"
	encoder *opus.Encoder
}

// NewDeepgramTTS creates a TTS engine with a reusable Opus encoder.
// targetLang is a BCP-47 code (e.g. "hi"); pass "" for English.
func NewDeepgramTTS(targetLang string) (*DeepgramTTS, error) {
	enc, err := opus.NewEncoder(ttsRate, ttsChannels, opus.AppVoIP)
	if err != nil {
		return nil, fmt.Errorf("opus encoder: %w", err)
	}
	_ = enc.SetBitrate(24000)
	_ = enc.SetComplexity(5)

	// Pick voice model. Deepgram Aura 2 ships many voices; default to asteria (female).
	// Override with TTS_VOICE env var if needed (e.g. "aura-orion-en" for male).
	model := os.Getenv("TTS_VOICE")
	if model == "" {
		// Simple language → voice map
		switch targetLang {
		case "hi":
			model = "aura-2-thalia-en" // closest; Deepgram Aura 2 Hindi is in beta
		case "es":
			model = "aura-2-luna-en"
		case "fr":
			model = "aura-2-stella-en"
		default:
			model = "aura-2-asteria-en"
		}
	}

	return &DeepgramTTS{model: model, encoder: enc}, nil
}

// SynthesizeOpus converts text → PCM via Deepgram Aura → Opus frames for LiveKit.
func (t *DeepgramTTS) SynthesizeOpus(text string) ([][]byte, error) {
	pcm, err := t.fetchPCM(text)
	if err != nil {
		return nil, err
	}
	return t.encodeOpus(pcm)
}

// fetchPCM calls Deepgram Aura TTS and returns raw PCM s16le samples at 48 kHz.
// The response is raw linear16 bytes — identical layout to what Cartesia returned.
func (t *DeepgramTTS) fetchPCM(text string) ([]int16, error) {
	payload, _ := json.Marshal(map[string]string{"text": text})

	url := fmt.Sprintf(
		"https://api.deepgram.com/v1/speak?model=%s&encoding=linear16&sample_rate=%d&container=none",
		t.model, ttsRate,
	)

	req, _ := http.NewRequest("POST", url, bytes.NewReader(payload))
	req.Header.Set("Authorization", "Token "+os.Getenv("DEEPGRAM_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("deepgram tts request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("deepgram tts %d: %s", resp.StatusCode, b)
	}

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// PCM s16le: 2 bytes per sample, little-endian
	samples := make([]int16, len(raw)/2)
	for i := range samples {
		samples[i] = int16(binary.LittleEndian.Uint16(raw[i*2 : i*2+2]))
	}
	return samples, nil
}

// encodeOpus splits PCM into 20 ms frames and encodes each to Opus.
func (t *DeepgramTTS) encodeOpus(pcm []int16) ([][]byte, error) {
	var frames [][]byte
	buf := make([]byte, 4000) // max Opus frame size

	// Pad to a multiple of frameSize
	for len(pcm)%frameSize != 0 {
		pcm = append(pcm, 0)
	}

	for i := 0; i < len(pcm); i += frameSize {
		chunk := pcm[i : i+frameSize]
		n, err := t.encoder.Encode(chunk, buf)
		if err != nil {
			return nil, fmt.Errorf("opus encode: %w", err)
		}
		frame := make([]byte, n)
		copy(frame, buf[:n])
		frames = append(frames, frame)
	}
	return frames, nil
}
