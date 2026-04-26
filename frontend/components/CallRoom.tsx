"use client";

/**
 * CallRoom — custom voice call UI.
 * Controls bar is at the TOP. Agent + mic cards fill all remaining height.
 * Only LiveKitRoom (WebRTC context) and RoomAudioRenderer (plays audio)
 * come from LiveKit. Everything visual is inline styles — no LiveKit CSS.
 */

import { useState, useEffect, useMemo, useRef } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
  useIsSpeaking,
  useRoomContext,
} from "@livekit/components-react";
import { RoomEvent, type RemoteParticipant } from "livekit-client";

/* ── Design tokens ─────────────────────────────────────────────── */
const C = {
  bg:          "#F7F3EA",
  surface:     "#FDFBF5",
  surfaceAlt:  "#EFE9DA",
  border:      "#E4DBC5",
  borderSoft:  "#EDE5D0",
  ink:         "#2A231A",
  ink2:        "#554937",
  ink3:        "#8C7F64",
  ink4:        "#B5A98B",
  primary:     "#3F3A8C",
  primaryHi:   "#332E75",
  primaryInk:  "#FDFBF5",
  primarySoft: "#E5E0F5",
  primarySoftInk: "#2C2773",
  accent:      "#B08D57",
  red:         "#B64242",
  redSoft:     "#FDEAEA",
  green:       "#4F7A4A",
  greenSoft:   "#EAF3E8",
  shadow1:     "0 1px 3px rgba(74,56,24,0.08)",
  shadowMd:    "0 6px 20px -4px rgba(74,56,24,0.14), 0 2px 6px -2px rgba(74,56,24,0.08)",
  sans:        "'Inter', -apple-system, system-ui, sans-serif",
  mono:        "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
  r3: 8, r4: 10, r5: 12, r6: 16, r7: 20,
};

/* ── Waveform ───────────────────────────────────────────────────── */
function Waveform({ active, color, bars = 32, height = 32 }: {
  active: boolean; color: string; bars?: number; height?: number;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick(t => t + 1), 120);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height }}>
      {Array.from({ length: bars }).map((_, i) => {
        const amp = active
          ? Math.abs(Math.sin((i * 0.52 + tick * 0.28) * 1.4))
          : 0.15;
        const h = active ? 5 + amp * (height - 5) : height * 0.18;
        return (
          <span key={i} style={{
            display: "block",
            width: 3, height: h,
            borderRadius: 2,
            background: color,
            opacity: active ? 0.4 + amp * 0.6 : 0.35,
            transition: "height 120ms ease-out, opacity 120ms ease-out",
          }}/>
        );
      })}
    </div>
  );
}

/* ── Button ─────────────────────────────────────────────────────── */
function Btn({ children, onClick, kind = "default", icon, style: sx = {} }: {
  children: React.ReactNode; onClick?: () => void;
  kind?: "default" | "primary" | "danger"; icon?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [hov, setHov] = useState(false);
  const s = {
    primary: { bg: hov ? C.primaryHi : C.primary, fg: "#fff",   bd: "none" },
    danger:  { bg: hov ? "#9b2020"   : C.red,     fg: "#fff",   bd: "none" },
    default: { bg: hov ? C.surfaceAlt : C.surface, fg: C.ink,   bd: `1px solid ${C.border}` },
  }[kind];
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 38, padding: "0 16px",
        fontFamily: C.sans, fontSize: 13, fontWeight: 500,
        color: s.fg, background: s.bg, border: s.bd,
        borderRadius: C.r3, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 7,
        boxShadow: kind === "default"
          ? C.shadow1
          : `0 2px 8px ${kind === "danger" ? "#B6424244" : C.primary + "44"}`,
        transition: "background 130ms ease",
        whiteSpace: "nowrap", flexShrink: 0, ...sx,
      }}
    >
      {icon}{children}
    </button>
  );
}

/* ── SVG Icons ──────────────────────────────────────────────────── */
const Ico = {
  micOn: (color = C.ink) => (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <rect x="6" y="2" width="4" height="8" rx="2" stroke={color} strokeWidth="1.5"/>
      <path d="M3.5 7.5v.5a4.5 4.5 0 009 0v-.5M8 12.5V14M5.5 14h5"
            stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  micOff: (color = "#fff") => (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <path d="M2 2l12 12" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M9.4 9.8A2 2 0 016 8V4m0-2a2 2 0 014 0v4"
            stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M3.6 8.3A4.5 4.5 0 0011.9 11M12.4 9.1A4.5 4.5 0 0012 7.5v-.5M8 12.5V14M5.5 14h5"
            stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  endCall: () => (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.14 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012.06 0h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L6.13 7.91a16 16 0 006.97 6.97l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"
            stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M2 2l20 20" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  copy: (color = C.ink) => (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <rect x="5" y="5" width="8" height="8" rx="1.5" stroke={color} strokeWidth="1.4"/>
      <path d="M3 11V4a1 1 0 011-1h7" stroke={color} strokeWidth="1.4"/>
    </svg>
  ),
  check: () => (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5l3 3 7-7" stroke={C.green} strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  share: (color = C.ink) => (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
      <path d="M11 5.5l-3-3-3 3M8 2.5V10M3.5 8.5v3A1.5 1.5 0 005 13h6a1.5 1.5 0 001.5-1.5v-3"
            stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

/* ── Agent orb card ─────────────────────────────────────────────── */
function AgentCard({ name, speaking, connected }: {
  name: string; speaking: boolean; connected: boolean;
}) {
  const status     = !connected ? "Connecting…" : speaking ? "Speaking" : "Listening";
  const statusDot  = speaking ? C.primary : connected ? C.green : C.ink4;
  const statusText = speaking ? C.primary : connected ? C.green : C.ink3;

  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: C.r7, boxShadow: C.shadowMd,
      padding: "18px 16px",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-start", gap: 12,
      width: 240, flexShrink: 0, minWidth: 0,
    }}>
      <div style={{
        fontFamily: C.sans, fontSize: 10, fontWeight: 600,
        letterSpacing: 1, textTransform: "uppercase", color: C.ink4,
      }}>AI Agent</div>

      {/* Orb (compacted from 130 → 84 to free space for the live conversation) */}
      <div style={{ position: "relative", width: 84, height: 84 }}>
        <div style={{
          position: "absolute", inset: -14, borderRadius: "50%",
          background: `radial-gradient(circle, ${C.primary}22 0%, transparent 70%)`,
          animation: "orbGlow 3s ease-in-out infinite",
        }}/>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(circle at 34% 30%, ${C.primary} 0%, ${C.accent} 55%, #1a0a40 100%)`,
          boxShadow: speaking
            ? `0 0 36px ${C.primary}88, 0 14px 44px ${C.primary}44`
            : `0 14px 44px ${C.primary}33`,
          animation: "orbFloat 4s ease-in-out infinite",
          transition: "box-shadow 500ms ease",
        }}/>
        <div style={{
          position: "absolute", inset: "14%", borderRadius: "50%",
          background: "radial-gradient(circle at 36% 30%, rgba(255,255,255,0.26) 0%, transparent 60%)",
        }}/>
        {speaking && (
          <div style={{
            position: "absolute", inset: -14, borderRadius: "50%",
            border: `2px solid ${C.primary}55`,
            animation: "orbRing 1.5s ease-out infinite",
          }}/>
        )}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width={26} height={26} viewBox="0 0 16 16" fill="none">
            <rect x="3" y="5" width="10" height="8" rx="2"
                  stroke="rgba(255,255,255,0.88)" strokeWidth="1.3"/>
            <circle cx="6"  cy="9" r="1.1" fill="rgba(255,255,255,0.88)"/>
            <circle cx="10" cy="9" r="1.1" fill="rgba(255,255,255,0.88)"/>
            <path d="M8 5V2.5M6 2.5h4"
                  stroke="rgba(255,255,255,0.88)" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* Name + status (compact single row) */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: C.sans, fontSize: 15, fontWeight: 600, color: C.ink, letterSpacing: -0.2 }}>
          {name}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 4 }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: statusDot,
            boxShadow: speaking ? `0 0 8px ${C.primary}` : "none",
            transition: "all 400ms ease",
          }}/>
          <span style={{
            fontFamily: C.sans, fontSize: 12, color: statusText,
            fontWeight: speaking ? 600 : 400, transition: "color 400ms ease",
          }}>{status}</span>
        </div>
      </div>

      {/* Slim waveform */}
      <Waveform active={speaking} color={C.primary} bars={28} height={22}/>
    </div>
  );
}

function AgentCardConnected({ participant, name }: {
  participant: RemoteParticipant; name: string;
}) {
  const speaking = useIsSpeaking(participant);
  return <AgentCard name={name} speaking={speaking} connected/>;
}

/* ── Your mic card (right column) ──────────────────────────────── */
function MicCard({ muted }: { muted: boolean }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: C.r7, boxShadow: C.shadowMd,
      padding: "16px 14px",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-start", gap: 10,
      width: 200, flexShrink: 0,
    }}>
      <div style={{
        fontFamily: C.sans, fontSize: 10, fontWeight: 600,
        letterSpacing: 1, textTransform: "uppercase", color: C.ink4,
      }}>Your Mic</div>

      {/* Compact mic status circle */}
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: muted ? C.redSoft : C.greenSoft,
        border: `2px solid ${muted ? "#f0b8b8" : "#b8ddb4"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 300ms ease",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: muted ? C.red : C.green,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {muted ? Ico.micOff("#fff") : Ico.micOn("#fff")}
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: C.sans, fontSize: 12, fontWeight: 600,
          color: muted ? C.red : C.green,
        }}>
          {muted ? "Mic OFF" : "Mic ON"}
        </div>
      </div>

      <Waveform active={!muted} color={muted ? C.red : C.green} bars={20} height={20}/>
    </div>
  );
}

/* ── Live conversation panel ───────────────────────────────────── */
/**
 * MetricEvent mirrors the Go struct in pipeline/pipeline.go.
 * The backend publishes one event per pipeline milestone on the
 * "metrics" data channel topic so we can render a live timing view.
 */
type MetricEvent = {
  type: string;
  turn_id: number;
  text?: string;
  delay_ms?: number;
  ts: number;
};

type Turn = {
  id: number;
  startedAt: number;
  userInterim?: string;
  userText?: string;
  llmStartDelay?: number;        // speech_started → llm_start (STT + debounce)
  llmFirstTokenDelay?: number;   // llm_start → first token (LLM TTFB)
  llmDoneDelay?: number;         // llm_start → full reply
  llmReply?: string;
  ttsFirstFrameDelay?: number;   // TTS TTFB
  audioPlayingDelay?: number;    // speech_started → first audio frame (end-to-end)
  bargeIn?: boolean;
  bargeCount?: number;           // bumps every time a barge_in event hits this turn
                                 // — used as the React key for the badge so the
                                 // CSS animation replays on repeated barges.
};

/** Subscribes to RoomEvent.DataReceived (topic=metrics), aggregates events into turns. */
function useTurns(): { turns: Turn[]; eventCount: number; lastBargeAt: number } {
  const room = useRoomContext();
  const [events, setEvents] = useState<MetricEvent[]>([]);
  const [lastBargeAt, setLastBargeAt] = useState(0);

  useEffect(() => {
    if (!room) return;
    const onData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string,
    ) => {
      // Some LiveKit JS versions deliver topic at a different param index;
      // accept anything that parses as a metrics-shaped JSON to be safe.
      try {
        const evt: MetricEvent = JSON.parse(new TextDecoder().decode(payload));
        if (typeof evt?.type !== "string") return;
        // Filter by topic if it was provided AND it's something other than
        // "metrics" — fall through if the topic param is missing/empty so
        // we don't silently drop legit events on SDK signature mismatches.
        if (topic && topic !== "metrics") return;
        setEvents((prev) => [...prev, evt]);
        if (evt.type === "barge_in") setLastBargeAt(Date.now());
      } catch {
        /* ignore malformed */
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  const turns = useMemo(() => {
    const map = new Map<number, Turn>();
    for (const evt of events) {
      let t = map.get(evt.turn_id);
      if (!t) {
        t = { id: evt.turn_id, startedAt: evt.ts };
        map.set(evt.turn_id, t);
      }
      switch (evt.type) {
        case "speech_started":
          t.startedAt = evt.ts;
          break;
        case "user_interim":
          t.userInterim = evt.text;
          break;
        case "user_done":
          t.userText = evt.text;
          t.userInterim = undefined;
          break;
        case "llm_start":
          t.llmStartDelay = evt.delay_ms;
          break;
        case "llm_first_token":
          t.llmFirstTokenDelay = evt.delay_ms;
          break;
        case "llm_done":
          t.llmDoneDelay = evt.delay_ms;
          if (evt.text) t.llmReply = evt.text;
          break;
        case "tts_first_frame":
          // keep only the first chunk's TTFB (subsequent sentences reuse streams)
          if (t.ttsFirstFrameDelay === undefined) t.ttsFirstFrameDelay = evt.delay_ms;
          break;
        case "audio_playing":
          if (t.audioPlayingDelay === undefined) t.audioPlayingDelay = evt.delay_ms;
          break;
        case "barge_in":
          t.bargeIn = true;
          t.bargeCount = (t.bargeCount || 0) + 1;
          break;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.id - b.id);
  }, [events]);

  return { turns, eventCount: events.length, lastBargeAt };
}

function Chip({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        background: highlight ? C.primary : C.surfaceAlt,
        color: highlight ? C.primaryInk : C.ink2,
        border: `1px solid ${highlight ? C.primary : C.border}`,
        fontFamily: C.mono,
        fontSize: 10,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {label} <strong>{value}ms</strong>
    </span>
  );
}

function TurnCard({ turn }: { turn: Turn }) {
  const hasUserText = !!turn.userText || !!turn.userInterim;
  const userText = turn.userText || turn.userInterim || "";
  const isInterim = !turn.userText && !!turn.userInterim;

  return (
    <div
      style={{
        border: `1px solid ${turn.bargeIn ? "#f0b8b8" : C.borderSoft}`,
        borderRadius: C.r4,
        background: C.bg,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        animation: "turnIn 380ms ease-out",
      }}
    >
      {/* Turn header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: C.mono,
          fontSize: 10,
          color: C.ink4,
          letterSpacing: 0.5,
        }}
      >
        <span>TURN {turn.id}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {turn.bargeIn && (
            <span
              key={`barge-${turn.bargeCount || 0}`}
              style={{
                color: "#fff",
                background: C.red,
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: 0.8,
                padding: "3px 8px",
                borderRadius: 999,
                animation: "bargeFlash 7s ease-out forwards",
                display: "inline-block",
                boxShadow: `0 0 0 0 ${C.red}88`,
              }}
            >⚡ BARGED IN</span>
          )}
          {turn.audioPlayingDelay != null && !turn.bargeIn && (
            <span style={{ color: C.primary, fontWeight: 600 }}>
              {turn.audioPlayingDelay}ms
            </span>
          )}
        </div>
      </div>

      {/* User text */}
      {hasUserText && (
        <div
          style={{
            fontFamily: C.sans,
            fontSize: 13,
            color: C.ink2,
            display: "flex",
            gap: 6,
            alignItems: "flex-start",
            opacity: isInterim ? 0.6 : 1,
          }}
        >
          <span style={{ flexShrink: 0 }}>🎙</span>
          <span style={{ flex: 1, lineHeight: 1.5 }}>
            {userText}
            {isInterim && <span style={{ color: C.ink3 }}> …</span>}
          </span>
        </div>
      )}

      {/* AI reply */}
      {turn.llmReply && (
        <div
          style={{
            fontFamily: C.sans,
            fontSize: 13,
            color: C.primarySoftInk,
            display: "flex",
            gap: 6,
            alignItems: "flex-start",
          }}
        >
          <span style={{ flexShrink: 0 }}>🤖</span>
          <span style={{ flex: 1, lineHeight: 1.5 }}>{turn.llmReply}</span>
        </div>
      )}

      {/* Timing chips */}
      {(turn.llmStartDelay != null ||
        turn.llmFirstTokenDelay != null ||
        turn.ttsFirstFrameDelay != null ||
        turn.audioPlayingDelay != null) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            paddingTop: 2,
          }}
        >
          {turn.llmStartDelay != null && (
            <Chip label="STT→LLM" value={turn.llmStartDelay} />
          )}
          {turn.llmFirstTokenDelay != null && (
            <Chip label="LLM·1st" value={turn.llmFirstTokenDelay} />
          )}
          {turn.llmDoneDelay != null && (
            <Chip label="LLM·done" value={turn.llmDoneDelay} />
          )}
          {turn.ttsFirstFrameDelay != null && (
            <Chip label="TTS·1st" value={turn.ttsFirstFrameDelay} />
          )}
          {turn.audioPlayingDelay != null && (
            <Chip label="▶ audio" value={turn.audioPlayingDelay} highlight />
          )}
        </div>
      )}
    </div>
  );
}

function ConversationPanel() {
  const { turns, eventCount, lastBargeAt } = useTurns();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom as new turns / events stream in
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  // Top-level barge-in toast: fires on EVERY barge_in event regardless of
  // turn_id, so even if subsequent barges land on the same turn the user
  // gets fresh visual feedback. Auto-hides 4.5s after the latest barge.
  const [bargeVisible, setBargeVisible] = useState(false);
  useEffect(() => {
    if (!lastBargeAt) return;
    setBargeVisible(true);
    const t = setTimeout(() => setBargeVisible(false), 4500);
    return () => clearTimeout(t);
  }, [lastBargeAt]);

  // Compute a running average of the "▶ audio" latency (only for completed, un-barged turns)
  const avgLatency = useMemo(() => {
    const done = turns.filter((t) => t.audioPlayingDelay != null && !t.bargeIn);
    if (done.length === 0) return null;
    const sum = done.reduce((a, t) => a + (t.audioPlayingDelay || 0), 0);
    return Math.round(sum / done.length);
  }, [turns]);

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: C.r7,
        boxShadow: C.shadowMd,
        display: "flex",
        flexDirection: "column",
        flex: 1.2,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 18px",
          borderBottom: `1px solid ${C.borderSoft}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontFamily: C.sans,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: C.ink4,
          }}
        >
          Live Conversation
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            fontFamily: C.mono,
            fontSize: 11,
            color: C.ink3,
          }}
        >
          {avgLatency != null && (
            <span>
              avg <strong style={{ color: C.primary }}>{avgLatency}ms</strong>
            </span>
          )}
          <span>
            {turns.length} turn{turns.length === 1 ? "" : "s"}
          </span>
          <span style={{ color: C.ink4 }}>· {eventCount} ev</span>
        </div>
      </div>

      {/* Top-level BARGED IN banner — appears on every barge regardless of
          which turn it landed on. The per-turn pill below is for history;
          this is for live, "I just heard you cut off the agent" feedback. */}
      {bargeVisible && (
        <div
          key={lastBargeAt}
          style={{
            margin: "8px 14px 0",
            padding: "8px 12px",
            borderRadius: C.r3,
            background: C.red,
            color: "#fff",
            fontFamily: C.sans,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            animation: "bargeBanner 4.5s ease-out forwards",
            boxShadow: `0 4px 14px ${C.red}66`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16 }}>⚡</span>
          <span>BARGED IN — agent paused</span>
        </div>
      )}

      {/* Scrollable turns */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {turns.length === 0 && (
          <div
            style={{
              color: C.ink3,
              fontSize: 13,
              fontFamily: C.sans,
              textAlign: "center",
              padding: "40px 20px",
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 10 }}>💬</div>
            Start talking — every turn appears here with STT, LLM and TTS timings so you can see exactly where time goes.
          </div>
        )}
        {turns.map((t) => (
          <TurnCard key={t.id} turn={t} />
        ))}
      </div>
    </div>
  );
}

/* ── Inner UI — uses LiveKit hooks ──────────────────────────────── */
function RoomUI({ agentName, onDisconnect }: {
  agentName: string; onDisconnect: () => void;
}) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const [copied, setCopied] = useState(false);

  const agentParticipant = (remotes[0] as RemoteParticipant | undefined) ?? null;
  const isMuted = !isMicrophoneEnabled;

  const toggleMic = () => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  const copyLink  = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ title: `Call with ${agentName}`, url: window.location.href });
    } else copyLink();
  };

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      padding: "16px 20px 20px", gap: 14,
      background: C.bg, overflowY: "auto", fontFamily: C.sans,
    }}>

      {/* ── Controls bar (TOP) ────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "0 16px", height: 56, flexShrink: 0,
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: C.r5, boxShadow: C.shadow1,
      }}>
        {/* Left: live label + muted warning */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          flex: 1, minWidth: 0,
          fontFamily: C.sans, fontSize: 13, color: C.primarySoftInk, fontWeight: 500,
          overflow: "hidden",
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>🎙</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Live call with <strong>{agentName}</strong>
          </span>
          {isMuted && (
            <span style={{
              flexShrink: 0, fontSize: 11, fontWeight: 600,
              color: C.red, background: C.redSoft,
              border: `1px solid #f0b8b8`, borderRadius: 999,
              padding: "2px 8px",
            }}>Mic off</span>
          )}
        </div>

        {/* Right: all 4 control buttons */}
        <Btn
          kind={isMuted ? "danger" : "default"}
          icon={isMuted ? Ico.micOff("#fff") : Ico.micOn(C.ink)}
          onClick={toggleMic}
        >
          {isMuted ? "Unmute" : "Mute"}
        </Btn>

        <Btn icon={copied ? Ico.check() : Ico.copy(C.ink)} onClick={copyLink}>
          {copied ? "Copied!" : "Copy link"}
        </Btn>

        <Btn icon={Ico.share(C.ink)} onClick={shareLink}>Share</Btn>

        {/* Agent connection status */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 12, color: agentParticipant ? C.green : C.ink3,
          padding: "0 6px", flexShrink: 0,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: agentParticipant ? C.green : C.ink4,
          }}/>
          {agentParticipant ? "Connected" : "Waiting…"}
        </div>

        <div style={{ width: 1, height: 24, background: C.borderSoft, flexShrink: 0 }}/>

        <Btn kind="danger" icon={Ico.endCall()} onClick={onDisconnect}>
          End call
        </Btn>
      </div>

      {/* ── Cards row — fills all remaining height ─────────── */}
      <div style={{ display: "flex", gap: 14, flex: 1, minHeight: 0 }}>
        {/* Agent card (left) */}
        {agentParticipant
          ? <AgentCardConnected participant={agentParticipant} name={agentName}/>
          : <AgentCard name={agentName} speaking={false} connected={false}/>
        }

        {/* Live conversation panel (middle) */}
        <ConversationPanel/>

        {/* Mic card (right column) */}
        <MicCard muted={isMuted}/>
      </div>

      <RoomAudioRenderer/>
    </div>
  );
}

/* ── Public export ──────────────────────────────────────────────── */
export interface CallRoomProps {
  token: string; serverUrl: string; roomName: string;
  videoEnabled: boolean; agentName: string; onDisconnect: () => void;
}

export default function CallRoom({
  token, serverUrl, agentName, onDisconnect,
}: CallRoomProps) {
  return (
    <>
      <style>{`
        @keyframes orbFloat { 0%,100%{transform:translateY(0px);}  50%{transform:translateY(-9px);} }
        @keyframes orbGlow  { 0%,100%{opacity:0.6;transform:scale(1);}  50%{opacity:1;transform:scale(1.08);} }
        @keyframes orbRing  { 0%{transform:scale(1);opacity:0.6;} 100%{transform:scale(1.7);opacity:0;} }
        @keyframes bargeFade { 0%,70% { opacity: 1; } 100% { opacity: 0; visibility: hidden; } }
        @keyframes turnIn {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes bargeBanner {
          0%   { opacity: 0; transform: translateY(-8px) scale(0.96); }
          10%  { opacity: 1; transform: translateY(0)    scale(1);    }
          80%  { opacity: 1; transform: translateY(0)    scale(1);    }
          100% { opacity: 0; transform: translateY(-4px) scale(0.98); }
        }
        @keyframes bargeFlash {
          0%   { transform: scale(1);    box-shadow: 0 0 0 0 rgba(231,76,60,0.7); }
          15%  { transform: scale(1.18); box-shadow: 0 0 0 14px rgba(231,76,60,0); }
          30%  { transform: scale(1);    box-shadow: 0 0 0 0 rgba(231,76,60,0); }
          45%  { transform: scale(1.12); box-shadow: 0 0 0 10px rgba(231,76,60,0); }
          60%  { transform: scale(1);    box-shadow: 0 0 0 0 rgba(231,76,60,0); }
          85%  { opacity: 1; }
          100% { opacity: 0; visibility: hidden; }
        }
      `}</style>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        audio={true}
        video={false}
        onDisconnected={onDisconnect}
        style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <RoomUI agentName={agentName} onDisconnect={onDisconnect}/>
      </LiveKitRoom>
    </>
  );
}
