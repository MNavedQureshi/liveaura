package api

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/ai-calling-agent/internal/lkclient"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CallRecord holds state for one active call.
type CallRecord struct {
	RoomName    string `json:"room_name"`
	RoomURL     string `json:"room_url"`
	CallType    string `json:"call_type"`
	AgentName   string `json:"agent_name"`
	Status      string `json:"status"`
	CreatedAt   int64  `json:"created_at"`
	PhoneNumber string `json:"phone_number,omitempty"`
	WhatsApp    string `json:"whatsapp_number,omitempty"`
}

// CreateCallRequest is the JSON body for POST /api/calls.
type CreateCallRequest struct {
	CallType           string `json:"call_type"  binding:"required"`
	AgentName          string `json:"agent_name"`
	Prompt             string `json:"prompt"     binding:"required"`
	PresentationScript string `json:"presentation_script"`
	PhoneNumber        string `json:"phone_number"`
	WhatsAppNumber     string `json:"whatsapp_number"`
	Greeting           string `json:"greeting"`
	VideoEnabled       bool   `json:"video_enabled"`
	SourceLang         string `json:"source_lang"` // user's spoken language (e.g. "es")
	TargetLang         string `json:"target_lang"` // agent's response language (e.g. "en")
}

var (
	calls   = map[string]*CallRecord{}
	callsMu sync.RWMutex
)

// RegisterRoutes wires all API routes onto r.
func RegisterRoutes(r *gin.Engine) {
	r.GET("/api/health", health)
	r.POST("/api/calls", createCall)
	r.GET("/api/calls", listCalls)
	r.GET("/api/calls/:room", getCall)
	r.DELETE("/api/calls/:room", endCall)
	r.POST("/api/token", getToken)
}

func health(c *gin.Context) {
	callsMu.RLock()
	n := len(calls)
	callsMu.RUnlock()
	c.JSON(200, gin.H{"status": "ok", "calls": n})
}

func createCall(c *gin.Context) {
	var req CreateCallRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	if req.AgentName == "" {
		req.AgentName = "AI Assistant"
	}

	roomName := fmt.Sprintf("ai-call-%s", uuid.New().String()[:8])
	appURL := lkclient.AppURL()
	roomURL := fmt.Sprintf("%s/room/%s", appURL, roomName)

	meta := map[string]any{
		"call_type":     req.CallType,
		"agent_name":    req.AgentName,
		"prompt":        req.Prompt,
		"video_enabled": req.VideoEnabled,
		"greeting":      req.Greeting,
		"source_lang":   req.SourceLang,
		"target_lang":   req.TargetLang,
	}
	if req.PresentationScript != "" {
		meta["presentation_script"] = req.PresentationScript
	}

	if err := lkclient.CreateRoom(c.Request.Context(), roomName, meta); err != nil {
		c.JSON(500, gin.H{"detail": "failed to create room: " + err.Error()})
		return
	}
	if err := lkclient.DispatchAgent(roomName); err != nil {
		c.JSON(500, gin.H{"detail": "failed to dispatch agent: " + err.Error()})
		return
	}

	record := &CallRecord{
		RoomName:  roomName,
		RoomURL:   roomURL,
		CallType:  req.CallType,
		AgentName: req.AgentName,
		Status:    "created",
		CreatedAt: time.Now().Unix(),
	}

	switch req.CallType {
	case "phone":
		if req.PhoneNumber == "" {
			c.JSON(400, gin.H{"detail": "phone_number required"})
			return
		}
		if err := lkclient.DispatchSIP(c.Request.Context(), roomName, req.PhoneNumber, req.AgentName); err != nil {
			c.JSON(500, gin.H{"detail": "SIP call failed: " + err.Error()})
			return
		}
		record.PhoneNumber = req.PhoneNumber
		record.Status = "calling"

	case "whatsapp":
		if req.WhatsAppNumber == "" {
			c.JSON(400, gin.H{"detail": "whatsapp_number required"})
			return
		}
		if err := lkclient.SendWhatsApp(req.WhatsAppNumber, roomURL, req.AgentName); err != nil {
			c.JSON(500, gin.H{"detail": "WhatsApp failed: " + err.Error()})
			return
		}
		record.WhatsApp = req.WhatsAppNumber
		record.Status = "invite_sent"
	}

	callsMu.Lock()
	calls[roomName] = record
	callsMu.Unlock()

	c.JSON(200, record)
}

func listCalls(c *gin.Context) {
	callsMu.RLock()
	defer callsMu.RUnlock()
	out := make([]*CallRecord, 0, len(calls))
	for _, v := range calls {
		out = append(out, v)
	}
	c.JSON(200, out)
}

func getCall(c *gin.Context) {
	callsMu.RLock()
	r, ok := calls[c.Param("room")]
	callsMu.RUnlock()
	if !ok {
		c.JSON(404, gin.H{"detail": "not found"})
		return
	}
	c.JSON(200, r)
}

func endCall(c *gin.Context) {
	room := c.Param("room")
	_ = lkclient.DeleteRoom(c.Request.Context(), room)
	callsMu.Lock()
	delete(calls, room)
	callsMu.Unlock()
	c.JSON(200, gin.H{"status": "ended", "room_name": room})
}

func getToken(c *gin.Context) {
	var req struct {
		RoomName   string `json:"room_name" binding:"required"`
		Identity   string `json:"identity"  binding:"required"`
		CanPublish bool   `json:"can_publish"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}
	token, err := lkclient.GenerateToken(req.RoomName, req.Identity, req.CanPublish)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{
		"token":       token,
		"livekit_url": lkclient.URL(),
		"room_name":   req.RoomName,
	})
}
