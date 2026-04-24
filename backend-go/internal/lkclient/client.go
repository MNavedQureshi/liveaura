package lkclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/livekit/protocol/auth"
	livekit "github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
)

func URL() string       { return os.Getenv("LIVEKIT_URL") }
func AppURL() string    { return os.Getenv("NEXT_PUBLIC_APP_URL") }
func apiKey() string    { return os.Getenv("LIVEKIT_API_KEY") }
func apiSecret() string { return os.Getenv("LIVEKIT_API_SECRET") }

func roomClient() *lksdk.RoomServiceClient {
	return lksdk.NewRoomServiceClient(URL(), apiKey(), apiSecret())
}

// GenerateToken creates a signed LiveKit JWT for a participant.
func GenerateToken(room, identity string, canPublish bool) (string, error) {
	at := auth.NewAccessToken(apiKey(), apiSecret())
	canSub := true
	grant := &auth.VideoGrant{
		RoomJoin:     true,
		Room:         room,
		CanPublish:   &canPublish,
		CanSubscribe: &canSub,
	}
	at.AddGrant(grant).
		SetIdentity(identity).
		SetName(identity).
		SetValidFor(time.Hour)
	return at.ToJWT()
}

// GenerateAgentToken creates a token for the internal AI agent participant.
func GenerateAgentToken(room string) (string, error) {
	t := true
	at := auth.NewAccessToken(apiKey(), apiSecret())
	grant := &auth.VideoGrant{
		RoomJoin:     true,
		Room:         room,
		CanPublish:   &t,
		CanSubscribe: &t,
	}
	at.AddGrant(grant).
		SetIdentity("ai-agent").
		SetName("AI Agent").
		SetValidFor(4 * time.Hour)
	return at.ToJWT()
}

// CreateRoom creates a LiveKit room with JSON metadata.
func CreateRoom(ctx context.Context, name string, meta map[string]any) error {
	metaJSON, _ := json.Marshal(meta)
	_, err := roomClient().CreateRoom(ctx, &livekit.CreateRoomRequest{
		Name:         name,
		Metadata:     string(metaJSON),
		EmptyTimeout: 300,
	})
	return err
}

// DeleteRoom deletes a LiveKit room.
func DeleteRoom(ctx context.Context, name string) error {
	_, err := roomClient().DeleteRoom(ctx, &livekit.DeleteRoomRequest{Room: name})
	return err
}

// DispatchAgent notifies the agent worker to join a room.
// If AGENT_DISPATCH_URL is not set, the agent worker auto-picks rooms.
func DispatchAgent(roomName string) error {
	agentURL := os.Getenv("AGENT_DISPATCH_URL")
	if agentURL == "" {
		return nil
	}
	body, _ := json.Marshal(map[string]string{"room": roomName})
	resp, err := http.Post(agentURL+"/dispatch", "application/json", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("dispatch agent: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("agent dispatch returned %d: %s", resp.StatusCode, b)
	}
	return nil
}

// DispatchSIP initiates an outbound SIP call to a phone number.
func DispatchSIP(ctx context.Context, roomName, phoneNumber, displayName string) error {
	trunkID := os.Getenv("SIP_TRUNK_ID")
	if trunkID == "" {
		return fmt.Errorf("SIP_TRUNK_ID not configured")
	}
	if len(phoneNumber) > 0 && phoneNumber[0] != '+' {
		phoneNumber = "+" + phoneNumber
	}
	svc := lksdk.NewSIPClient(URL(), apiKey(), apiSecret())
	_, err := svc.CreateSIPParticipant(ctx, &livekit.CreateSIPParticipantRequest{
		SipTrunkId:      trunkID,
		SipCallTo:       phoneNumber,
		RoomName:        roomName,
		ParticipantName: displayName,
		PlayRingtone:    true,
	})
	return err
}

// SendWhatsApp sends a WhatsApp invite message via Twilio.
func SendWhatsApp(number, roomURL, agentName string) error {
	accountSID := os.Getenv("TWILIO_ACCOUNT_SID")
	authToken := os.Getenv("TWILIO_AUTH_TOKEN")
	from := os.Getenv("TWILIO_WHATSAPP_FROM")
	if accountSID == "" || authToken == "" {
		return fmt.Errorf("Twilio credentials not configured")
	}
	if len(number) > 0 && number[0] != '+' {
		number = "+" + number
	}
	to := "whatsapp:" + number
	msgBody := fmt.Sprintf(
		"Hi! *%s* wants to connect with you via AI voice call.\n\nJoin here 👉 %s\n\n_Tap the link to start the session._",
		agentName, roomURL,
	)

	form := url.Values{}
	form.Set("To", to)
	form.Set("From", from)
	form.Set("Body", msgBody)

	endpoint := fmt.Sprintf(
		"https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json",
		accountSID,
	)
	req, _ := http.NewRequest("POST", endpoint, bytes.NewBufferString(form.Encode()))
	req.SetBasicAuth(accountSID, authToken)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("twilio request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("twilio returned %d: %s", resp.StatusCode, b)
	}
	return nil
}
