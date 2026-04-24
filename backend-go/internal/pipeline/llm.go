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

// LLM is the common interface for any language model backend.
type LLM interface {
	Stream(userText string, tokenC chan<- string) (string, error)
}

// NewLLM returns an Anthropic or Gemini LLM based on env vars.
// Set LLM_PROVIDER=gemini to use Gemini; default is Anthropic.
func NewLLM(systemPrompt string) LLM {
	if os.Getenv("LLM_PROVIDER") == "gemini" {
		return newGeminiLLM(systemPrompt)
	}
	return newAnthropicLLM(systemPrompt)
}

// ── Anthropic ────────────────────────────────────────────────────────────────

type AnthropicLLM struct {
	SystemPrompt string
	history      []map[string]string
	client       *http.Client
}

func newAnthropicLLM(systemPrompt string) *AnthropicLLM {
	return &AnthropicLLM{SystemPrompt: systemPrompt, client: &http.Client{}}
}

func (a *AnthropicLLM) Stream(userText string, tokenC chan<- string) (string, error) {
	a.history = append(a.history, map[string]string{"role": "user", "content": userText})

	model := os.Getenv("ANTHROPIC_MODEL")
	if model == "" {
		model = "claude-haiku-4-5-20251001"
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

	a.history = append(a.history, map[string]string{"role": "assistant", "content": full.String()})
	return full.String(), scanner.Err()
}

// ── Gemini ───────────────────────────────────────────────────────────────────

type geminiLLM struct {
	systemPrompt string
	history      []map[string]any
	client       *http.Client
}

func newGeminiLLM(systemPrompt string) *geminiLLM {
	return &geminiLLM{systemPrompt: systemPrompt, client: &http.Client{}}
}

func (g *geminiLLM) Stream(userText string, tokenC chan<- string) (string, error) {
	g.history = append(g.history, map[string]any{
		"role":  "user",
		"parts": []map[string]string{{"text": userText}},
	})

	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = "gemini-2.0-flash"
	}
	apiKey := os.Getenv("GEMINI_API_KEY")

	payload := map[string]any{
		"system_instruction": map[string]any{
			"parts": []map[string]string{{"text": g.systemPrompt}},
		},
		"contents": g.history,
		"generationConfig": map[string]any{
			"maxOutputTokens": 1024,
		},
	}
	body, _ := json.Marshal(payload)

	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:streamGenerateContent?alt=sse&key=%s",
		model, apiKey,
	)
	req, _ := http.NewRequest("POST", url, bytes.NewReader(body))
	req.Header.Set("content-type", "application/json")

	resp, err := g.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("gemini request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		errBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("gemini returned %d: %s", resp.StatusCode, string(errBody))
	}

	var full strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		var event map[string]any
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}
		candidates, _ := event["candidates"].([]any)
		for _, c := range candidates {
			cand, _ := c.(map[string]any)
			content, _ := cand["content"].(map[string]any)
			parts, _ := content["parts"].([]any)
			for _, p := range parts {
				part, _ := p.(map[string]any)
				if text, ok := part["text"].(string); ok && text != "" {
					full.WriteString(text)
					tokenC <- text
				}
			}
		}
	}
	close(tokenC)

	g.history = append(g.history, map[string]any{
		"role":  "model",
		"parts": []map[string]string{{"text": full.String()}},
	})
	return full.String(), scanner.Err()
}
