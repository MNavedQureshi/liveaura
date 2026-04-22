package pipeline

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/gorilla/websocket"
)

// dgTranscript is the Deepgram streaming response shape we care about.
type dgTranscript struct {
	Channel struct {
		Alternatives []struct {
			Transcript string  `json:"transcript"`
			Confidence float64 `json:"confidence"`
		} `json:"alternatives"`
	} `json:"channel"`
	IsFinal bool `json:"is_final"`
}

// DeepgramSTT streams Opus audio to Deepgram and emits final transcripts.
// We accept raw Opus payloads directly from LiveKit RTP packets — no decoding needed.
type DeepgramSTT struct {
	conn    *websocket.Conn
	ResultC chan string // closed when the connection ends
}

// NewDeepgramSTT opens a persistent WebSocket to Deepgram's streaming STT API.
func NewDeepgramSTT() (*DeepgramSTT, error) {
	key := os.Getenv("DEEPGRAM_API_KEY")
	if key == "" {
		return nil, fmt.Errorf("DEEPGRAM_API_KEY not set")
	}

	// Opus payload from LiveKit is 48 kHz, 1 channel, raw Opus frames
	wsURL := "wss://api.deepgram.com/v1/listen" +
		"?model=nova-2" +
		"&language=en-US" +
		"&encoding=opus" +
		"&sample_rate=48000" +
		"&channels=1" +
		"&smart_format=true" +
		"&interim_results=false" +
		"&endpointing=300"

	header := map[string][]string{
		"Authorization": {"Token " + key},
	}
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		return nil, fmt.Errorf("deepgram connect: %w", err)
	}

	s := &DeepgramSTT{conn: conn, ResultC: make(chan string, 16)}
	go s.readLoop()
	return s, nil
}

// SendAudio sends a raw Opus frame (RTP payload) to Deepgram.
func (s *DeepgramSTT) SendAudio(opusPayload []byte) error {
	return s.conn.WriteMessage(websocket.BinaryMessage, opusPayload)
}

// Close gracefully shuts down the Deepgram connection.
func (s *DeepgramSTT) Close() {
	_ = s.conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"CloseStream"}`))
	_ = s.conn.Close()
}

func (s *DeepgramSTT) readLoop() {
	defer close(s.ResultC)
	for {
		_, msg, err := s.conn.ReadMessage()
		if err != nil {
			return
		}
		var t dgTranscript
		if err := json.Unmarshal(msg, &t); err != nil {
			continue
		}
		if t.IsFinal && len(t.Channel.Alternatives) > 0 {
			text := t.Channel.Alternatives[0].Transcript
			if text != "" {
				s.ResultC <- text
			}
		}
	}
}
