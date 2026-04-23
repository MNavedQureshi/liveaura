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
	ttsRate     = 48000 // Cartesia output sample rate (Hz)
	ttsChannels = 1     // Mono
	frameSize   = 960   // 20 ms frame at 48 kHz (960 samples)
)

// CartesiaTTS converts text to PCM and encodes it to Opus frames.
type CartesiaTTS struct {
	voiceID  string
	language string // BCP-47 code; empty = "en"
	model    string // sonic-english or sonic-multilingual
	encoder  *opus.Encoder
}

// NewCartesiaTTS creates a TTS engine with a reusable Opus encoder.
// targetLang is a BCP-47 code (e.g. "es"); pass "" for English.
func NewCartesiaTTS(targetLang string) (*CartesiaTTS, error) {
	enc, err := opus.NewEncoder(ttsRate, ttsChannels, opus.AppVoIP)
	if err != nil {
		return nil, fmt.Errorf("opus encoder: %w", err)
	}
	_ = enc.SetBitrate(24000)
	_ = enc.SetComplexity(5)

	voiceID := os.Getenv("CARTESIA_VOICE_ID")
	if voiceID == "" {
		voiceID = "a0e99841-438c-4a64-b679-ae501e7d6091"
	}
	lang := targetLang
	if lang == "" {
		lang = "en"
	}
	model := "sonic-english"
	if lang != "en" {
		model = "sonic-multilingual"
	}
	return &CartesiaTTS{voiceID: voiceID, language: lang, model: model, encoder: enc}, nil
}

// SynthesizeOpus converts text → PCM via Cartesia → Opus frames for LiveKit.
// Returns a slice of 20 ms Opus frames.
func (t *CartesiaTTS) SynthesizeOpus(text string) ([][]byte, error) {
	pcm, err := t.fetchPCM(text)
	if err != nil {
		return nil, err
	}
	return t.encodeOpus(pcm)
}

// fetchPCM calls Cartesia and returns raw PCM s16le samples at 48 kHz.
func (t *CartesiaTTS) fetchPCM(text string) ([]int16, error) {
	payload := map[string]any{
		"model_id":   t.model,
		"transcript": text,
		"language":   t.language,
		"voice": map[string]any{
			"mode": "id",
			"id":   t.voiceID,
		},
		"output_format": map[string]any{
			"container":   "raw",
			"encoding":    "pcm_s16le",
			"sample_rate": ttsRate,
		},
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", "https://api.cartesia.ai/tts/bytes", bytes.NewReader(body))
	req.Header.Set("X-API-Key", os.Getenv("CARTESIA_API_KEY"))
	req.Header.Set("Cartesia-Version", "2024-06-10")
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cartesia request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("cartesia %d: %s", resp.StatusCode, b)
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
func (t *CartesiaTTS) encodeOpus(pcm []int16) ([][]byte, error) {
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
