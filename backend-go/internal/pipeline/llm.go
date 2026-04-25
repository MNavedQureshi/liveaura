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

// NewLLM returns an LLM based on LLM_PROVIDER env var.
// Values: "gemini", "groq", "cerebras", or default "anthropic".
func NewLLM(systemPrompt string) LLM {
	switch os.Getenv("LLM_PROVIDER") {
	case "gemini":
		return newGeminiLLM(systemPrompt)
	case "groq":
		return newGroqLLM(systemPrompt)
	case "cerebras":
		return newCerebrasLLM(systemPrompt)
	default:
		return newAnthropicLLM(systemPrompt)
	}
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
		// gemini-2.5-flash: best free Gemini for voice (5 RPM free tier, decent quality).
		// gemini-2.0-flash now requires Tier 1 billing on most keys.
		// For higher RPM on free tier, override with GEMINI_MODEL=gemini-2.5-flash-lite (10 RPM).
		model = "gemini-2.5-flash"
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

// ── Groq ─────────────────────────────────────────────────────────────────────
// Groq uses OpenAI-compatible API. Free tier: 14,400 req/day, 6000 tokens/min.

type groqLLM struct {
	systemPrompt string
	history      []map[string]string
	client       *http.Client
}

func newGroqLLM(systemPrompt string) *groqLLM {
	return &groqLLM{systemPrompt: systemPrompt, client: &http.Client{}}
}

func (g *groqLLM) Stream(userText string, tokenC chan<- string) (string, error) {
	g.history = append(g.history, map[string]string{"role": "user", "content": userText})

	model := os.Getenv("GROQ_MODEL")
	if model == "" {
		model = "llama-3.1-8b-instant" // fastest Groq free model
	}

	messages := append(
		[]map[string]string{{"role": "system", "content": g.systemPrompt}},
		g.history...,
	)
	payload := map[string]any{
		"model":      model,
		"messages":   messages,
		"max_tokens": 1024,
		"stream":     true,
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+os.Getenv("GROQ_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("groq request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		errBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("groq returned %d: %s", resp.StatusCode, string(errBody))
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
		choices, _ := event["choices"].([]any)
		for _, ch := range choices {
			choice, _ := ch.(map[string]any)
			delta, _ := choice["delta"].(map[string]any)
			if text, ok := delta["content"].(string); ok && text != "" {
				full.WriteString(text)
				tokenC <- text
			}
		}
	}
	close(tokenC)

	g.history = append(g.history, map[string]string{"role": "assistant", "content": full.String()})
	return full.String(), scanner.Err()
}

// ── Cerebras ─────────────────────────────────────────────────────────────────
// Cerebras Cloud uses an OpenAI-compatible API. Free tier: 30 RPM, ~1M tokens/day,
// served at ~2,200 tokens/second on their wafer-scale chips. Best free option
// for voice agents — much higher RPM than Gemini (10) and much smarter llama
// (3.3-70b) than Groq's free llama-3.1-8b-instant.

type cerebrasLLM struct {
	systemPrompt string
	history      []map[string]string
	client       *http.Client
}

func newCerebrasLLM(systemPrompt string) *cerebrasLLM {
	return &cerebrasLLM{systemPrompt: systemPrompt, client: &http.Client{}}
}

func (c *cerebrasLLM) Stream(userText string, tokenC chan<- string) (string, error) {
	c.history = append(c.history, map[string]string{"role": "user", "content": userText})

	model := os.Getenv("CEREBRAS_MODEL")
	if model == "" {
		// Strongest model on Cerebras free tier; fastest TTFT in the industry.
		// Other options: "llama3.1-8b" (fastest, weaker), "llama-4-scout-17b-16e-instruct".
		model = "llama-3.3-70b"
	}

	messages := append(
		[]map[string]string{{"role": "system", "content": c.systemPrompt}},
		c.history...,
	)
	payload := map[string]any{
		"model":      model,
		"messages":   messages,
		"max_tokens": 1024,
		"stream":     true,
	}
	body, _ := json.Marshal(payload)

	req, _ := http.NewRequest("POST", "https://api.cerebras.ai/v1/chat/completions", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+os.Getenv("CEREBRAS_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("cerebras request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		errBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("cerebras returned %d: %s", resp.StatusCode, string(errBody))
	}

	var full strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	// Cerebras can emit chunks bigger than the default 64KB scanner buffer
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
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
		choices, _ := event["choices"].([]any)
		for _, ch := range choices {
			choice, _ := ch.(map[string]any)
			delta, _ := choice["delta"].(map[string]any)
			if text, ok := delta["content"].(string); ok && text != "" {
				full.WriteString(text)
				tokenC <- text
			}
		}
	}
	close(tokenC)

	c.history = append(c.history, map[string]string{"role": "assistant", "content": full.String()})
	return full.String(), scanner.Err()
}
