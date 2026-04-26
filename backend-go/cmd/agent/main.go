package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strings"
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

	// Create a local H264 video track for D-ID avatar (only used when DID_API_KEY is set)
	videoTrack, err := lksdk.NewLocalSampleTrack(webrtc.RTPCodecCapability{
		MimeType:  webrtc.MimeTypeH264,
		ClockRate: 90000,
	})
	if err != nil {
		log.Printf("[agent] video track error: %v", err)
		return
	}

	// audioSink is the per-call function that consumes incoming Opus payloads
	// from the user's audio track. It's set after we know which voice backend
	// (pipeline or gemini_live) to use, based on room metadata.
	var (
		audioSink func([]byte)
		sinkMu    sync.Mutex
		done      = make(chan struct{})
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
							sinkMu.Lock()
							sink := audioSink
							sinkMu.Unlock()
							if sink != nil {
								sink(pkt.Payload)
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

	// Read system prompt, language, and video settings from room metadata.
	// userRole is just the caller-supplied role/goal text (or empty).
	// We always wrap it with voiceBase via buildAgentPrompt below so every
	// agent — preset OR custom OR no-prompt — inherits the speech rules.
	var userRole string
	var sourceLang, targetLang, voiceMode, ttsProvider string
	var videoEnabled bool
	if meta := room.Metadata(); meta != "" {
		var m map[string]any
		if json.Unmarshal([]byte(meta), &m) == nil {
			if p, ok := m["prompt"].(string); ok && p != "" {
				userRole = p
			}
			if script, ok := m["presentation_script"].(string); ok && script != "" {
				userRole += "\n\nPRESENTATION SCRIPT (deliver naturally — do not read verbatim, paraphrase as you go):\n" + script
			}
			if sl, ok := m["source_lang"].(string); ok {
				sourceLang = sl
			}
			if tl, ok := m["target_lang"].(string); ok {
				targetLang = tl
			}
			if ve, ok := m["video_enabled"].(bool); ok {
				videoEnabled = ve
			}
			// "pipeline" (default — Deepgram STT + LLM + Aura TTS) or "gemini_live"
			// (single WebSocket: native voice in/voice out via Gemini Live API).
			if vm, ok := m["voice_mode"].(string); ok {
				voiceMode = vm
			}
			// TTS provider inside the standard pipeline. Honoured only when
			// voiceMode is "" or "pipeline". Empty → Deepgram Aura (default).
			if tp, ok := m["tts_provider"].(string); ok {
				ttsProvider = tp
			}
		}
	}

	// Combine voiceBase + role into the final system prompt used by both
	// the standard pipeline and the Gemini Live path.
	systemPrompt := buildAgentPrompt(userRole)

	// Read greeting once from metadata so both code paths can use it.
	greeting := "Hello! I'm your AI assistant. How can I help you today?"
	if meta := room.Metadata(); meta != "" {
		var m map[string]any
		if json.Unmarshal([]byte(meta), &m) == nil {
			if g, ok := m["greeting"].(string); ok && g != "" {
				greeting = g
			}
		}
	}

	// ── Gemini Live mode ──────────────────────────────────────────────────────
	// Replaces STT + LLM + TTS with one WebSocket. Same OnOpusFrames / OnEvent
	// callback shape as Pipeline so the LiveKit publish + metric panel still work.
	if voiceMode == "gemini_live" {
		log.Printf("[agent] voice_mode=gemini_live")
		gem, err := pipeline.NewGeminiLive(systemPrompt)
		if err != nil {
			log.Printf("[agent] gemini live error: %v", err)
			return
		}
		gem.OnOpusFrames = func(ctx context.Context, frameC <-chan []byte) {
			ticker := time.NewTicker(20 * time.Millisecond)
			defer ticker.Stop()
			drain := func() {
				go func() {
					for range frameC {
					}
				}()
			}
			for frame := range frameC {
				select {
				case <-ctx.Done():
					drain()
					return
				case <-ticker.C:
				}
				if err := audioTrack.WriteSample(webrtcmedia.Sample{
					Data:     frame,
					Duration: 20 * time.Millisecond,
				}, nil); err != nil {
					log.Printf("[agent] write sample error: %v", err)
					drain()
					return
				}
			}
		}
		gem.OnEvent = func(evt pipeline.MetricEvent) {
			data, err := json.Marshal(evt)
			if err != nil {
				return
			}
			_ = room.LocalParticipant.PublishData(
				data,
				lksdk.WithDataPublishReliable(true),
				lksdk.WithDataPublishTopic("metrics"),
			)
		}
		sinkMu.Lock()
		audioSink = gem.SendAudio
		sinkMu.Unlock()

		go gem.Run()

		// Trigger model to speak first by sending a user-prompt that asks for
		// the greeting. (Live API doesn't auto-greet without an initial turn.)
		if greeting != "" {
			if err := gem.SendInitialPrompt("Greet the caller naturally with this exact opening: " + greeting); err != nil {
				log.Printf("[agent] gemini live initial prompt: %v", err)
			}
		}

		// End when either the LiveKit room disconnects or the Gemini WS closes.
		select {
		case <-done:
		case <-gem.Wait():
			log.Printf("[agent] gemini live session ended; closing room")
		}
		gem.Close()
		return
	}

	// Start D-ID avatar stream when video is enabled and DID_API_KEY is set
	avatarURL := os.Getenv("DID_AVATAR_URL")
	if avatarURL == "" {
		avatarURL = "https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.jpeg"
	}
	var didStream *pipeline.DIDStream
	if videoEnabled && os.Getenv("DID_API_KEY") != "" {
		log.Printf("[agent] starting D-ID avatar stream")
		ds, err := pipeline.NewDIDStream(avatarURL)
		if err != nil {
			log.Printf("[agent] D-ID stream error: %v", err)
		} else {
			didStream = ds
			// Publish video track
			if _, err := room.LocalParticipant.PublishTrack(videoTrack, &lksdk.TrackPublicationOptions{
				Name: "AI Face",
			}); err != nil {
				log.Printf("[agent] publish video track error: %v", err)
			}
			// Forward D-ID video frames → LiveKit
			didStream.OnVideoSample = func(sample webrtcmedia.Sample) {
				if err := videoTrack.WriteSample(sample, nil); err != nil {
					log.Printf("[agent] video sample error: %v", err)
				}
			}
			// Forward D-ID audio → LiveKit (replaces Cartesia TTS in video mode)
			didStream.OnAudioFrame = func(payload []byte) {
				if err := audioTrack.WriteSample(webrtcmedia.Sample{
					Data:     payload,
					Duration: 20 * time.Millisecond,
				}, nil); err != nil {
					log.Printf("[agent] did audio error: %v", err)
				}
			}
		}
	}

	// Select TTS engine. Default (empty / "Deepgram Aura") keeps the existing
	// HTTP-per-chunk path. "Cartesia" switches to Sonic-2 WebSocket TTS for
	// lower TTFB. If Cartesia init fails (e.g. CARTESIA_API_KEY missing) we
	// log + fall back to Aura so a misconfigured key never bricks a call.
	var (
		p     *pipeline.Pipeline
		pErr  error
	)
	switch ttsProvider {
	case "Cartesia":
		ctts, cerr := pipeline.NewCartesiaTTS(targetLang)
		if cerr != nil {
			log.Printf("[agent] cartesia init failed (%v); falling back to Aura", cerr)
			p, pErr = pipeline.New(systemPrompt, sourceLang, targetLang)
		} else {
			log.Printf("[agent] tts_provider=Cartesia model=sonic-2")
			p, pErr = pipeline.NewWithTTS(systemPrompt, sourceLang, targetLang, ctts)
		}
	default:
		p, pErr = pipeline.New(systemPrompt, sourceLang, targetLang)
	}
	if pErr != nil {
		log.Printf("[agent] pipeline error: %v", pErr)
		return
	}
	sinkMu.Lock()
	audioSink = p.SendAudio
	sinkMu.Unlock()
	pipe := p

	didVoiceID := os.Getenv("DID_VOICE_ID") // e.g. "en-US-JennyNeural"

	if didStream != nil {
		// Video mode: D-ID handles both TTS and lip sync
		pipe.OnSpeakText = func(text string) {
			if err := didStream.SpeakText(text, didVoiceID); err != nil {
				log.Printf("[D-ID] speak error: %v", err)
			}
		}
	} else {
		// Audio-only mode: Deepgram Aura TTS → Opus → LiveKit audio track.
		// frameC is fed in real time by the streaming TTS pipeline; we pace it
		// out at 20ms per frame so LiveKit plays at natural speed.
		// ctx is cancelled mid-loop when the user barges in — drain remaining
		// frames in a background goroutine so the upstream synth worker doesn't block.
		pipe.OnOpusFrames = func(ctx context.Context, frameC <-chan []byte) {
			ticker := time.NewTicker(20 * time.Millisecond)
			defer ticker.Stop()
			published := 0
			drain := func() {
				go func() {
					for range frameC {
					}
				}()
			}
			for frame := range frameC {
				select {
				case <-ctx.Done():
					log.Printf("[agent] frame publish cancelled (barge-in) after %d frames", published)
					drain()
					return
				case <-ticker.C:
				}
				if err := audioTrack.WriteSample(webrtcmedia.Sample{
					Data:     frame,
					Duration: 20 * time.Millisecond,
				}, nil); err != nil {
					log.Printf("[agent] write sample error: %v", err)
					drain()
					return
				}
				published++
			}
		}
	}

	// Publish every MetricEvent as JSON over the LiveKit data channel.
	// The frontend subscribes to `RoomEvent.DataReceived` to render the live
	// conversation panel with timings.
	pipe.OnEvent = func(evt pipeline.MetricEvent) {
		data, err := json.Marshal(evt)
		if err != nil {
			return
		}
		if err := room.LocalParticipant.PublishData(
			data,
			lksdk.WithDataPublishReliable(true),
			lksdk.WithDataPublishTopic("metrics"),
		); err != nil {
			log.Printf("[agent] publish metric error: %v", err)
		}
	}

	// Deliver opening greeting (greeting is already loaded from metadata above)
	pipe.SpeakText(greeting)

	// Run the voice loop until the room disconnects
	go pipe.Run()
	<-done
	pipe.Close()
	if didStream != nil {
		didStream.Close()
	}
}

// buildAgentPrompt prepends the universal voice rules (voiceBase) to the
// role/goal text from the user (or defaultRole if none was supplied). Every
// agent — preset, custom, or no-prompt — passes through this so the speech
// style is enforced consistently and customisations don't accidentally drop it.
func buildAgentPrompt(userRole string) string {
	role := strings.TrimSpace(userRole)
	if role == "" {
		role = defaultRole
	}
	return voiceBase + "\n\n== ROLE & GOAL ==\n" + role
}

// voiceBase is sent on EVERY LLM call alongside the conversation history.
// Keep it tight (~350 tokens) — every word here is paid for on every turn.
//
// Design notes:
//   - Bullet form so the model can pattern-match rules quickly.
//   - "Don't do X" rules are more reliable than "do Y" for voice — the failure
//     modes (filler, restating, robot-speak) are very recognisable patterns.
//   - The "[interrupted]" rule is a forward-compat hook: today nothing emits
//     that marker, so the rule is a no-op. When we plumb partial-response
//     marking into LLM history (next iteration), it'll activate automatically.
const voiceBase = `You are speaking on a live voice call. This is a conversation, not a chat reply. Every word you produce will be spoken aloud by TTS.

== VOICE STYLE ==
• Reply in ONE short sentence by default. At most two short sentences. Only go longer if the user explicitly asks ("in detail", "explain more", "walk me through").
• Contractions always: "I'm", "you're", "don't", "we'll", "it's".
• NO opener filler. Never start with "Sure!", "Absolutely!", "Of course!", "Great question!", "I'd be happy to", "I understand", "Got it!".
• NO restating the user. Never say "So you're asking…", "It sounds like you want…", "Just to confirm…".
• NO self-narration. Skip "Let me explain", "Here's the thing", "What I can tell you is".
• If you don't know, say "I don't know" — don't apologise twice, don't speculate, don't ramble.

== READING ALOUD ==
• Numbers as words: "$1,250" → "twelve hundred fifty dollars"; "2024" → "twenty twenty-four"; "v3.2" → "version three point two"; "9 AM" → "nine in the morning".
• URLs and emails letter-by-letter: "@" = "at", "." = "dot", "/" = "slash". Don't read protocol prefixes.
• Convert markdown to speech: never say "asterisk", "hash", "dash", "bullet". If the source has a list, speak it as "first… second… third…".
• Use commas to control TTS rhythm — they create natural pauses. Use "..." for a deliberate beat.

== TURN-TAKING ==
• End your turn cleanly. No trailing "umm", "so yeah", "right?".
• Only ask a question when you actually need an answer. Don't tack one on as filler.
• If the user cuts you off mid-sentence, stop completely and answer their new question first — never plough on with what you were saying.
• If the conversation history shows your previous reply ends with "[interrupted]", that means you were cut off there. After answering the new question, briefly offer to return to the previous topic ("Want me to keep going on the pricing breakdown, or something else?"). Never auto-resume without asking.

== HONESTY ==
• Don't invent prices, names, dates, account details, or anything you weren't told. If asked, say "I don't have that information".
• Don't promise actions you can't take. You're a voice agent — you can talk, that's it. Don't say "I'll email you" or "I'll send a link" unless your role explicitly says you can.`

// defaultRole is the fallback role/goal when no caller-supplied prompt was
// provided. Kept intentionally generic — most callers WILL supply a role
// (preset or custom), so this is just a safe default for one-off testing.
const defaultRole = `You're a friendly, professional AI assistant on a phone call. Be helpful, direct, and warm. Match the caller's energy — formal if they are, casual if they are. Keep things moving toward whatever the caller actually needs.`

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
