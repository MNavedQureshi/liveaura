package pipeline

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

// AnthropicLLM holds a conversation with Claude and streams responses.
type AnthropicLLM struct {
	SystemPrompt string
	history      []map[string]string
	client       *http.Client
}

// NewAnthropicLLM creates a new stateful LLM session.
func NewAnthropicLLM(systemPrompt string) *AnthropicLLM {
	return &AnthropicLLM{
		SystemPrompt: systemPrompt,
		client:       &http.Client{},
	}
}

// Stream sends userText and streams response tokens to tokenC.
// tokenC is closed when the response is complete.
// Returns the full response text and any error.
func (a *AnthropicLLM) Stream(userText string, tokenC chan<- string) (string, error) {
	a.history = append(a.history, map[string]string{
		"role": "user", "content": userText,
	})

	model := os.Getenv("ANTHROPIC_MODEL")
	if model == "" {
		model = "claude-haiku-4-5-20251001" // fastest/cheapest for voice
	}
	payload := map[string]any{
		"model":      model,
		"max_tokens": 1024,
		"stream":     true,
		"system":     a.SystemPrompt,
		"messages":   a.history,
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	req.Header.Set("x-api-key", os.Getenv("ANTHROPIC_API_KEY"))
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")

	resp, err := a.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("anthropic request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		errBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("anthropic returned %d: %s", resp.StatusCode, string(errBody))
	}

	var full strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}
		var event map[string]any
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}
		if event["type"] == "content_block_delta" {
			if delta, ok := event["delta"].(map[string]any); ok {
				if text, ok := delta["text"].(string); ok && text != "" {
					full.WriteString(text)
					tokenC <- text
				}
			}
		}
	}
	close(tokenC)

	// Append assistant response to history for multi-turn context
	a.history = append(a.history, map[string]string{
		"role": "assistant", "content": full.String(),
	})
	return full.String(), scanner.Err()
}
