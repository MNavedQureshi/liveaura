package pipeline

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

// turnDetectorURL is the base URL of the NAMO turn-detector sidecar.
// Set via TURN_DETECTOR_URL env var; defaults to the docker-compose service name.
var turnDetectorURL = func() string {
	if u := os.Getenv("TURN_DETECTOR_URL"); u != "" {
		return u
	}
	return "http://turn-detector:8080"
}()

// turnDetectorHTTPTimeout is the maximum time we'll block waiting for the
// sidecar. NAMO inference is <20ms; Docker bridge adds ~1ms. 100ms gives
// plenty of slack while keeping the pipeline responsive.
const turnDetectorHTTPTimeout = 100 * time.Millisecond

// turnPrediction is the JSON response from POST /predict.
type turnPrediction struct {
	TurnComplete bool    `json:"turn_complete"`
	Confidence   float64 `json:"confidence"`
	LatencyMs    float64 `json:"latency_ms"`
}

// httpClient is shared across all calls (keep-alive, connection pooling).
var turnDetectorClient = &http.Client{
	Timeout: turnDetectorHTTPTimeout,
	Transport: &http.Transport{
		MaxIdleConns:        4,
		IdleConnTimeout:     30 * time.Second,
		DisableCompression:  true,
	},
}

// semanticTurnCheck calls the NAMO sidecar and reports whether the accumulated
// ASR text represents a semantically complete turn.
//
// On any failure (network, timeout, non-200) it returns (false, 0, err) and
// the caller falls back to the silence-based debounce timer.
func semanticTurnCheck(text string) (complete bool, confidence float64, err error) {
	if text == "" {
		return false, 0, nil
	}

	body, _ := json.Marshal(map[string]string{"text": text})

	ctx, cancel := context.WithTimeout(context.Background(), turnDetectorHTTPTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost,
		turnDetectorURL+"/predict",
		bytes.NewReader(body),
	)
	if err != nil {
		return false, 0, fmt.Errorf("turn-detector: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := turnDetectorClient.Do(req)
	if err != nil {
		return false, 0, fmt.Errorf("turn-detector: http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, 0, fmt.Errorf("turn-detector: HTTP %d", resp.StatusCode)
	}

	var pred turnPrediction
	if err := json.NewDecoder(resp.Body).Decode(&pred); err != nil {
		return false, 0, fmt.Errorf("turn-detector: decode: %w", err)
	}

	log.Printf("[turn-detector] text=%q → complete=%v conf=%.2f lat=%.1fms",
		truncate(text, 60), pred.TurnComplete, pred.Confidence, pred.LatencyMs)

	return pred.TurnComplete, pred.Confidence, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
