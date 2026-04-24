package pipeline

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"

	"github.com/gorilla/websocket"
)

// Deepgram streaming event shape.
// The API multiplexes several message types over one WebSocket —
// we branch on `type` and `is_final`.
type dgMessage struct {
	Type    string `json:"type"`   // "Results", "UtteranceEnd", "SpeechStarted", "Metadata"
	IsFinal bool   `json:"is_final"`
	// For Results:
	Channel struct {
		Alternatives []struct {
			Transcript string  `json:"transcript"`
			Confidence float64 `json:"confidence"`
		} `json:"alternatives"`
	} `json:"channel"`
	// For UtteranceEnd:
	LastWordEnd float64 `json:"last_word_end"`
	// For SpeechStarted:
	Timestamp float64 `json:"timestamp"`
}

// DeepgramSTT streams Opus audio to Deepgram and emits multiple event types
// so the pipeline can implement proper turn detection and barge-in.
//
// Channels (all non-blocking sends — late subscribers may drop):
//
//	InterimC       — partial transcript (user still talking)
//	FinalC         — finalized chunk after endpointing silence (~300ms)
//	UtteranceEndC  — user fully finished (~700ms silence)
//	SpeechStartedC — Deepgram VAD: user just began speaking
//
// All channels close when the connection ends.
type DeepgramSTT struct {
	conn *websocket.Conn
	mu   sync.Mutex // guards concurrent writes to conn

	InterimC       chan string
	FinalC         chan string
	UtteranceEndC  chan struct{}
	SpeechStartedC chan struct{}
}

// NewDeepgramSTT opens a persistent WebSocket to Deepgram's streaming STT API
// with VAD events enabled for turn detection.
func NewDeepgramSTT() (*DeepgramSTT, error) {
	key := os.Getenv("DEEPGRAM_API_KEY")
	if key == "" {
		return nil, fmt.Errorf("DEEPGRAM_API_KEY not set")
	}

	// Turn-detection-tuned params:
	//   endpointing=300        → mark transcript final after 300ms silence
	//   utterance_end_ms=700   → separate event after 700ms silence (user truly done)
	//   interim_results=true   → partial transcripts while user talks
	//   vad_events=true        → SpeechStarted events for barge-in detection
	wsURL := "wss://api.deepgram.com/v1/listen" +
		"?model=nova-2" +
		"&language=en-US" +
		"&encoding=opus" +
		"&sample_rate=48000" +
		"&channels=1" +
		"&smart_format=true" +
		"&interim_results=true" +
		"&endpointing=300" +
		"&utterance_end_ms=1000" + // Deepgram requires >=1000 for this param
		"&vad_events=true"

	header := map[string][]string{
		"Authorization": {"Token " + key},
	}
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		return nil, fmt.Errorf("deepgram connect: %w", err)
	}

	s := &DeepgramSTT{
		conn:           conn,
		InterimC:       make(chan string, 32),
		FinalC:         make(chan string, 16),
		UtteranceEndC:  make(chan struct{}, 8),
		SpeechStartedC: make(chan struct{}, 8),
	}
	go s.readLoop()
	return s, nil
}

// SendAudio sends a raw Opus frame (RTP payload) to Deepgram.
func (s *DeepgramSTT) SendAudio(opusPayload []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.conn.WriteMessage(websocket.BinaryMessage, opusPayload)
}

// Close gracefully shuts down the Deepgram connection.
func (s *DeepgramSTT) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = s.conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"CloseStream"}`))
	_ = s.conn.Close()
}

func (s *DeepgramSTT) readLoop() {
	defer func() {
		close(s.InterimC)
		close(s.FinalC)
		close(s.UtteranceEndC)
		close(s.SpeechStartedC)
	}()

	for {
		_, msg, err := s.conn.ReadMessage()
		if err != nil {
			return
		}
		var m dgMessage
		if err := json.Unmarshal(msg, &m); err != nil {
			continue
		}

		switch m.Type {
		case "SpeechStarted":
			// Fire-and-forget; skip if nobody's listening
			select {
			case s.SpeechStartedC <- struct{}{}:
			default:
			}

		case "UtteranceEnd":
			select {
			case s.UtteranceEndC <- struct{}{}:
			default:
			}

		case "Results":
			if len(m.Channel.Alternatives) == 0 {
				continue
			}
			text := m.Channel.Alternatives[0].Transcript
			if text == "" {
				continue
			}
			if m.IsFinal {
				select {
				case s.FinalC <- text:
				default:
				}
			} else {
				select {
				case s.InterimC <- text:
				default:
				}
			}
		}
	}
}
