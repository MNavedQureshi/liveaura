package main

import (
	"encoding/json"
	"log"
	"os"
	"sync"
	"time"

	"github.com/ai-calling-agent/internal/lkclient"
	"github.com/ai-calling-agent/internal/pipeline"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	lksdk "github.com/livekit/server-sdk-go/v2"
	"github.com/pion/webrtc/v3"
	webrtcmedia "github.com/pion/webrtc/v3/pkg/media"
)

var activeSessions sync.Map // roomName → struct{}

func main() {
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load(".env")

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())
	r.POST("/dispatch", dispatchHandler)
	r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	addr := ":" + getEnv("AGENT_PORT", "8001")
	log.Printf("Agent worker listening on %s", addr)
	log.Fatal(r.Run(addr))
}

// dispatchHandler receives a room name and starts an agent session asynchronously.
func dispatchHandler(c *gin.Context) {
	var req struct {
		Room string `json:"room" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	go runSession(req.Room)
	c.JSON(200, gin.H{"status": "dispatched", "room": req.Room})
}

// runSession connects to a LiveKit room and runs the full voice pipeline.
func runSession(roomName string) {
	if _, loaded := activeSessions.LoadOrStore(roomName, struct{}{}); loaded {
		log.Printf("[agent] already active in %s", roomName)
		return
	}
	defer activeSessions.Delete(roomName)

	log.Printf("[agent] joining room %s", roomName)

	token, err := lkclient.GenerateAgentToken(roomName)
	if err != nil {
		log.Printf("[agent] token error: %v", err)
		return
	}

	// Create a local Opus audio track to publish synthesised speech
	audioTrack, err := lksdk.NewLocalSampleTrack(webrtc.RTPCodecCapability{
		MimeType:    webrtc.MimeTypeOpus,
		ClockRate:   48000,
		Channels:    1,
		SDPFmtpLine: "minptime=10;useinbandfec=1",
	})
	if err != nil {
		log.Printf("[agent] audio track error: %v", err)
		return
	}

	var (
		pipe    *pipeline.Pipeline
		pipeMu  sync.Mutex
		done    = make(chan struct{})
	)

	room, err := lksdk.ConnectToRoomWithToken(
		lkclient.URL(), token,
		&lksdk.RoomCallback{
			ParticipantCallback: lksdk.ParticipantCallback{
				// Subscribe to every audio track published by human participants
				OnTrackSubscribed: func(
					track *webrtc.TrackRemote,
					_ *lksdk.RemoteTrackPublication,
					rp *lksdk.RemoteParticipant,
				) {
					if track.Kind() != webrtc.RTPCodecTypeAudio {
						return
					}
					log.Printf("[agent] subscribed to audio from %s", rp.Identity())
					go func() {
						for {
							pkt, _, err := track.ReadRTP()
							if err != nil {
								return
							}
							pipeMu.Lock()
							p := pipe
							pipeMu.Unlock()
							if p != nil {
								p.SendAudio(pkt.Payload)
							}
						}
					}()
				},
			},
			OnDisconnected: func() {
				log.Printf("[agent] disconnected from %s", roomName)
				close(done)
			},
		},
	)
	if err != nil {
		log.Printf("[agent] connect error: %v", err)
		return
	}
	defer room.Disconnect()

	// Publish our audio track
	if _, err := room.LocalParticipant.PublishTrack(audioTrack, &lksdk.TrackPublicationOptions{
		Name: "AI Voice",
	}); err != nil {
		log.Printf("[agent] publish track error: %v", err)
		return
	}

	// Read system prompt from room metadata
	systemPrompt := defaultPrompt
	if meta := room.Metadata(); meta != "" {
		var m map[string]any
		if json.Unmarshal([]byte(meta), &m) == nil {
			if p, ok := m["prompt"].(string); ok && p != "" {
				systemPrompt = p
			}
			if script, ok := m["presentation_script"].(string); ok && script != "" {
				systemPrompt += "\n\nPRESENTATION SCRIPT:\n" + script
			}
		}
	}

	p, err := pipeline.New(systemPrompt)
	if err != nil {
		log.Printf("[agent] pipeline error: %v", err)
		return
	}
	pipeMu.Lock()
	pipe = p
	pipeMu.Unlock()

	// Wire synthesised Opus frames into the LiveKit track
	pipe.OnOpusFrames = func(frames [][]byte) {
		for _, frame := range frames {
			if err := audioTrack.WriteSample(webrtcmedia.Sample{
				Data:     frame,
				Duration: 20 * time.Millisecond,
			}); err != nil {
				log.Printf("[agent] write sample error: %v", err)
			}
		}
	}

	// Deliver opening greeting before listening starts
	greeting := "Hello! I'm your AI assistant. How can I help you today?"
	if meta := room.Metadata(); meta != "" {
		var m map[string]any
		if json.Unmarshal([]byte(meta), &m) == nil {
			if g, ok := m["greeting"].(string); ok && g != "" {
				greeting = g
			}
		}
	}
	pipe.SpeakText(greeting)

	// Run the voice loop until the room disconnects
	go pipe.Run()
	<-done
	pipe.Close()
}

const defaultPrompt = `You are a professional AI calling agent. Be natural, friendly, and concise.
Listen carefully and respond conversationally. Keep responses short unless asked to elaborate.`

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
