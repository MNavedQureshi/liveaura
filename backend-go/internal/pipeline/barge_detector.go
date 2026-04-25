package pipeline

// BargeDetector is a fast, local "user started speaking" trigger for barge-in.
//
// Why we need it: Deepgram's SpeechStarted event fires 150-300ms after the user
// actually starts talking (audio buffering + VAD model latency + network RTT).
// That makes the agent feel sluggish to interrupt — by the time we cancel TTS,
// 200-400ms of agent audio has already been spoken over the user.
//
// What this does: decode each incoming Opus packet locally, compute RMS energy,
// and require N consecutive "loud" frames before firing barge-in. Latency:
// ~60-80ms (3-4 × 20ms frames). The trigger only runs while the agent is
// speaking (cheap no-op otherwise).
//
// The heavier semantic turn-detection still goes through Deepgram + NAMO —
// this is purely the "stop the agent's mouth NOW" signal.

import (
	"log"
	"math"
	"sync/atomic"

	"github.com/hraban/opus"
)

const (
	// bargeRMSThreshold gates background noise vs voice. RMS values for
	// typical phone-call voice land in 1500-5000; quiet rooms sit at 100-400;
	// noisy environments at 500-1000. 1200 is a conservative middle ground.
	// Lower → snappier but more false-positives from background noise.
	bargeRMSThreshold int32 = 1200

	// bargeStreakLen is how many consecutive loud frames are required before
	// firing. 3 frames × 20ms = 60ms. Increase to 4 (80ms) if false-positives
	// in noisy environments become an issue.
	bargeStreakLen int = 3

	// bargePCMBufSize must hold the largest possible decoded frame. Opus can
	// emit up to 120ms per packet at 48kHz mono = 5760 samples.
	bargePCMBufSize int = 5760
)

// BargeDetector decodes incoming user audio and fires onBargeIn() the moment
// it detects sustained voice while the agent is mid-response.
//
// Threading: Feed must be called from a single goroutine (the LiveKit RTP read
// loop). isSpeaking and fired use atomics for cross-goroutine reads.
type BargeDetector struct {
	decoder *opus.Decoder

	pcmBuf []int16 // reused across calls — single-goroutine access

	// Borrowed from Pipeline. We only fire when the agent is actively speaking.
	// This is a *atomic.Int32 (pointer) so we share state with Pipeline.
	isSpeaking *atomic.Int32

	// Consecutive loud frames seen while speaking. Reset whenever:
	//   - isSpeaking transitions to 0 (next Feed sees not-speaking, resets)
	//   - the streak is broken by a quiet frame
	streak int

	// fired prevents repeat triggers within a single agent turn. Reset along
	// with streak when isSpeaking goes 0.
	fired atomic.Int32

	onBargeIn func()
}

// NewBargeDetector constructs a detector. isSpeaking should be the same atomic
// the Pipeline uses to track AI speech state. onBargeIn should cancel the
// in-flight speakCtx and emit a barge_in event.
func NewBargeDetector(isSpeaking *atomic.Int32, onBargeIn func()) (*BargeDetector, error) {
	dec, err := opus.NewDecoder(48000, 1)
	if err != nil {
		return nil, err
	}
	return &BargeDetector{
		decoder:    dec,
		pcmBuf:     make([]int16, bargePCMBufSize),
		isSpeaking: isSpeaking,
		onBargeIn:  onBargeIn,
	}, nil
}

// Feed processes one Opus packet from the user. Cheap no-op when the agent
// isn't currently speaking (no decode performed).
func (b *BargeDetector) Feed(opusPayload []byte) {
	if b.isSpeaking.Load() == 0 {
		// Agent is silent — reset state so the next turn starts fresh.
		// Single-goroutine writes are safe here.
		if b.streak != 0 {
			b.streak = 0
		}
		if b.fired.Load() == 1 {
			b.fired.Store(0)
		}
		return
	}
	if b.fired.Load() == 1 {
		// Already fired for this turn; don't re-trigger until agent stops.
		return
	}

	n, err := b.decoder.Decode(opusPayload, b.pcmBuf)
	if err != nil || n == 0 {
		return
	}

	// Compute RMS over the decoded frame. Branchless abs not needed — the
	// square zeroes out sign, and int64 sum prevents overflow.
	var sumSq int64
	for _, s := range b.pcmBuf[:n] {
		v := int64(s)
		sumSq += v * v
	}
	rms := int32(math.Sqrt(float64(sumSq) / float64(n)))

	if rms < bargeRMSThreshold {
		b.streak = 0
		return
	}
	b.streak++
	if b.streak >= bargeStreakLen {
		if b.fired.CompareAndSwap(0, 1) {
			log.Printf("[barge-detector] FAST barge-in (rms=%d, streak=%d)", rms, b.streak)
			if b.onBargeIn != nil {
				b.onBargeIn()
			}
		}
	}
}
