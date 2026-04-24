package pipeline

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/pion/rtp/codecs"
	"github.com/pion/webrtc/v3"
	webrtcmedia "github.com/pion/webrtc/v3/pkg/media"
)

// DIDStream connects to D-ID's streaming API via WebRTC.
// It receives a lip-synced video+audio stream from D-ID and exposes
// channels for forwarding frames into LiveKit tracks.
type DIDStream struct {
	streamID  string
	sessionID string
	apiKey    string

	pc *webrtc.PeerConnection

	// OnVideoSample is called with each H264 video sample from D-ID.
	OnVideoSample func(sample webrtcmedia.Sample)
	// OnAudioFrame is called with each Opus frame from D-ID.
	OnAudioFrame func(payload []byte)

	mu     sync.Mutex
	closed bool
}

// NewDIDStream creates a D-ID streaming session for the given avatar image URL.
// DID_API_KEY must be set in the environment.
func NewDIDStream(avatarURL string) (*DIDStream, error) {
	apiKey := os.Getenv("DID_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("DID_API_KEY not set")
	}
	d := &DIDStream{apiKey: apiKey}
	if err := d.connect(avatarURL); err != nil {
		return nil, err
	}
	return d, nil
}

func (d *DIDStream) authHeader() string {
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(d.apiKey+":"))
}

func (d *DIDStream) post(path string, payload any) ([]byte, int, error) {
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("POST", "https://api.d-id.com"+path, bytes.NewReader(body))
	req.Header.Set("Authorization", d.authHeader())
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return b, resp.StatusCode, nil
}

func (d *DIDStream) connect(avatarURL string) error {
	// 1. Create D-ID stream — get WebRTC offer + ICE servers
	respBody, status, err := d.post("/talks/streams", map[string]any{
		"source_url": avatarURL,
		"config":     map[string]any{"stitch": true},
	})
	if err != nil {
		return fmt.Errorf("D-ID create stream: %w", err)
	}
	if status >= 400 {
		return fmt.Errorf("D-ID create stream %d: %s", status, respBody)
	}

	var result struct {
		ID        string `json:"id"`
		SessionID string `json:"session_id"`
		Offer     struct {
			Type string `json:"type"`
			SDP  string `json:"sdp"`
		} `json:"offer"`
		IceServers []struct {
			URLs       []string `json:"urls"`
			Username   string   `json:"username"`
			Credential string   `json:"credential"`
		} `json:"ice_servers"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return fmt.Errorf("D-ID decode: %w", err)
	}
	d.streamID = result.ID
	d.sessionID = result.SessionID
	log.Printf("[D-ID] stream created: %s", d.streamID)

	// 2. Set up pion with D-ID's ICE servers
	cfg := webrtc.Configuration{}
	for _, ice := range result.IceServers {
		srv := webrtc.ICEServer{URLs: ice.URLs}
		if ice.Username != "" {
			srv.Username = ice.Username
			srv.Credential = ice.Credential
		}
		cfg.ICEServers = append(cfg.ICEServers, srv)
	}

	pc, err := webrtc.NewPeerConnection(cfg)
	if err != nil {
		return fmt.Errorf("pion: %w", err)
	}
	d.pc = pc

	pc.OnTrack(func(track *webrtc.TrackRemote, _ *webrtc.RTPReceiver) {
		log.Printf("[D-ID] received track kind=%s codec=%s", track.Kind(), track.Codec().MimeType)
		switch track.Kind() {
		case webrtc.RTPCodecTypeVideo:
			go d.readVideo(track)
		case webrtc.RTPCodecTypeAudio:
			go d.readAudio(track)
		}
	})

	pc.OnICEConnectionStateChange(func(s webrtc.ICEConnectionState) {
		log.Printf("[D-ID] ICE state: %s", s)
	})

	// 3. Answer D-ID's offer
	if err := pc.SetRemoteDescription(webrtc.SessionDescription{
		Type: webrtc.SDPTypeOffer,
		SDP:  result.Offer.SDP,
	}); err != nil {
		return fmt.Errorf("D-ID set remote desc: %w", err)
	}

	answer, err := pc.CreateAnswer(nil)
	if err != nil {
		return fmt.Errorf("D-ID create answer: %w", err)
	}

	gathered := webrtc.GatheringCompletePromise(pc)
	if err := pc.SetLocalDescription(answer); err != nil {
		return fmt.Errorf("D-ID set local desc: %w", err)
	}
	select {
	case <-gathered:
	case <-time.After(10 * time.Second):
		return fmt.Errorf("D-ID ICE gathering timeout")
	}

	// 4. Send answer to D-ID
	body, _ := json.Marshal(map[string]any{
		"answer":     map[string]string{"type": "answer", "sdp": pc.LocalDescription().SDP},
		"session_id": d.sessionID,
	})
	req, _ := http.NewRequest("PUT",
		fmt.Sprintf("https://api.d-id.com/talks/streams/%s/sdp", d.streamID),
		bytes.NewReader(body))
	req.Header.Set("Authorization", d.authHeader())
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("D-ID send answer: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("D-ID send answer %d: %s", resp.StatusCode, b)
	}
	log.Printf("[D-ID] WebRTC answer sent, waiting for connection...")
	return nil
}

// SpeakText sends text to D-ID to animate the avatar with the given voice.
// voiceID is a Microsoft Azure voice name (e.g. "en-US-JennyNeural").
// Pass "" to use D-ID's default voice.
func (d *DIDStream) SpeakText(text, voiceID string) error {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.closed {
		return fmt.Errorf("stream closed")
	}

	script := map[string]any{
		"type":  "text",
		"input": text,
	}
	if voiceID != "" {
		script["provider"] = map[string]any{
			"type":     "microsoft",
			"voice_id": voiceID,
		}
	}

	respBody, status, err := d.post(
		fmt.Sprintf("/talks/streams/%s", d.streamID),
		map[string]any{
			"script":     script,
			"config":     map[string]any{"stitch": true},
			"session_id": d.sessionID,
		},
	)
	if err != nil {
		return fmt.Errorf("D-ID speak: %w", err)
	}
	if status >= 400 {
		return fmt.Errorf("D-ID speak %d: %s", status, respBody)
	}
	return nil
}

// Close tears down the D-ID stream and WebRTC connection.
func (d *DIDStream) Close() {
	d.mu.Lock()
	if d.closed {
		d.mu.Unlock()
		return
	}
	d.closed = true
	d.mu.Unlock()

	body, _ := json.Marshal(map[string]string{"session_id": d.sessionID})
	req, _ := http.NewRequest("DELETE",
		fmt.Sprintf("https://api.d-id.com/talks/streams/%s", d.streamID),
		bytes.NewReader(body))
	req.Header.Set("Authorization", d.authHeader())
	req.Header.Set("Content-Type", "application/json")
	http.DefaultClient.Do(req)
	d.pc.Close()
}

// readVideo reads H264 RTP from D-ID, depacketizes, and calls OnVideoSample.
func (d *DIDStream) readVideo(track *webrtc.TrackRemote) {
	h264 := &codecs.H264Packet{}
	for {
		pkt, _, err := track.ReadRTP()
		if err != nil {
			return
		}
		payload, err := h264.Unmarshal(pkt.Payload)
		if err != nil || len(payload) == 0 {
			continue
		}
		if d.OnVideoSample != nil {
			d.OnVideoSample(webrtcmedia.Sample{
				Data:     payload,
				Duration: 33 * time.Millisecond, // ~30fps
			})
		}
	}
}

// readAudio reads Opus RTP from D-ID and calls OnAudioFrame.
func (d *DIDStream) readAudio(track *webrtc.TrackRemote) {
	for {
		pkt, _, err := track.ReadRTP()
		if err != nil {
			return
		}
		if d.OnAudioFrame != nil && len(pkt.Payload) > 0 {
			d.OnAudioFrame(pkt.Payload)
		}
	}
}
