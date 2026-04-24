"use client";

import { useState, useEffect } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
  useIsSpeaking,
  VideoConference,
} from "@livekit/components-react";
import type { RemoteParticipant } from "livekit-client";

/* ─── Design tokens (matches console light theme) ─────────────────── */
const T = {
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
  accent:      "#B08D57",
  red:         "#B64242",
  redSoft:     "#F3D9D4",
  redInk:      "#842828",
  green:       "#4F7A4A",
  greenSoft:   "#DFEBD8",
  shadow1:     "0 1px 2px rgba(74,56,24,0.06)",
  shadowMd:    "0 4px 10px -2px rgba(74,56,24,0.12), 0 2px 4px -1px rgba(74,56,24,0.06)",
  sans:        "'Inter', -apple-system, system-ui, sans-serif",
  mono:        "'JetBrains Mono', ui-monospace, monospace",
  r3: 8, r4: 10, r5: 12, r6: 16,
} as const;

/* ─── Waveform (animated bars, driven by a tick timer) ────────────── */
function Waveform({ active, color, bars = 30, height = 28 }: {
  active: boolean; color: string; bars?: number; height?: number;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick(t => t + 1), 130);
    return () => clearInterval(id);
  }, [active]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2.5, height }}>
      {Array.from({ length: bars }).map((_, i) => {
        const amp = active ? Math.abs(Math.sin((i * 0.47 + tick * 0.31) * 1.3)) : 0;
        const h   = active ? 4 + amp * (height - 4) : 3;
        return (
          <span key={i} style={{
            width: 2.5, height: h, borderRadius: 2,
            background: color,
            opacity: active ? 0.35 + amp * 0.65 : 0.18,
            transition: "height 130ms ease-out, opacity 130ms ease-out",
          }}/>
        );
      })}
    </div>
  );
}

/* ─── Inline SVG icons ────────────────────────────────────────────── */
const MicOnIcon = ({ c = T.ink2 }: { c?: string }) => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <rect x="6" y="2" width="4" height="8" rx="2" stroke={c} strokeWidth="1.4"/>
    <path d="M3.5 7.5v.5a4.5 4.5 0 009 0v-.5M8 12.5V14M5.5 14h5"
          stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const MicOffIcon = ({ c = "#fff" }: { c?: string }) => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <path d="M2 2l12 12" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M9.5 9.9A2 2 0 016 8V4m0-2a2 2 0 014 0v4" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M3.5 8a4.5 4.5 0 007.8 3M12.4 9.4c.07-.3.1-.6.1-.9v-.5M8 12.5V14M5.5 14h5"
          stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const PhoneOffIcon = ({ c = "#fff" }: { c?: string }) => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <path d="M3.5 3.5c0-.55.45-1 1-1h1.8c.4 0 .76.24.92.62l1 2.5c.15.37.04.79-.27 1.04l-1.1.85c.9 1.85 2.43 3.37 4.28 4.27l.85-1.1c.26-.3.67-.41 1.04-.27l2.5 1c.38.15.62.5.62.91V13c0 .55-.45 1-1 1C7.83 14 2.5 8.67 2.5 2.5c0-.55.45-1 1-1z"
          stroke={c} strokeWidth="1.4"/>
    <path d="M2 2l12 12" stroke={c} strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const CopyIcon = () => (
  <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
    <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M3 11V4a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);
const CheckIcon = () => (
  <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
    <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const BotIcon = () => (
  <svg width={30} height={30} viewBox="0 0 16 16" fill="none">
    <rect x="3" y="5" width="10" height="8" rx="2" stroke="#fff" strokeWidth="1.4"/>
    <circle cx="6" cy="9" r="1.1" fill="#fff"/>
    <circle cx="10" cy="9" r="1.1" fill="#fff"/>
    <path d="M8 5V2.5M6 2.5h4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

/* ─── Button ─────────────────────────────────────────────────────── */
function Btn({
  children, onClick, kind = "default", icon, style: sx = {},
}: {
  children: React.ReactNode; onClick?: () => void;
  kind?: "default" | "primary" | "danger"; icon?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [hov, setHov] = useState(false);
  const styles = {
    primary: { bg: hov ? T.primaryHi : T.primary, fg: T.primaryInk, bd: "transparent" },
    danger:  { bg: hov ? "#a33" : T.red, fg: "#fff", bd: "transparent" },
    default: { bg: hov ? T.surfaceAlt : T.surface, fg: T.ink2, bd: T.border },
  }[kind];
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        height: 42, padding: "0 18px",
        fontFamily: T.sans, fontSize: 13.5, fontWeight: 500,
        color: styles.fg, background: styles.bg,
        border: styles.bd === "transparent" ? "none" : `1px solid ${styles.bd}`,
        borderRadius: T.r4, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 8,
        boxShadow: kind === "default" ? T.shadow1 : `0 2px 6px ${kind === "danger" ? T.red : T.primary}33`,
        transition: "background 120ms ease",
        whiteSpace: "nowrap", ...sx,
      }}>
      {icon}{children}
    </button>
  );
}

/* ─── Agent avatar tile ──────────────────────────────────────────── */
function AgentTile({ agentName, isSpeaking, isConnected }: {
  agentName: string; isSpeaking: boolean; isConnected: boolean;
}) {
  const statusText  = !isConnected ? "Joining the room…"
    : isSpeaking    ? "Speaking"
    : "Listening";
  const dotColor    = isSpeaking ? T.primary : isConnected ? T.green : T.ink4;
  const labelColor  = isSpeaking ? T.primary : isConnected ? T.green : T.ink3;

  return (
    <div style={{
      flex: 1, background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: T.r6, padding: "32px 24px", boxShadow: T.shadowMd,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 22,
    }}>
      {/* Animated orb */}
      <div style={{ position: "relative", width: 100, height: 100 }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(circle at 32% 28%, ${T.primary} 0%, ${T.accent} 55%, #1e0f44 100%)`,
          boxShadow: `0 8px 32px ${T.primary}44`,
          animation: isConnected ? "roomOrbFloat 4s ease-in-out infinite" : "none",
        }}/>
        {/* Gloss */}
        <div style={{
          position: "absolute", inset: 10, borderRadius: "50%",
          background: "radial-gradient(circle at 38% 36%, rgba(255,255,255,0.32) 0%, transparent 55%)",
        }}/>
        {/* Pulse ring when speaking */}
        {isSpeaking && (
          <div style={{
            position: "absolute", inset: -8, borderRadius: "50%",
            border: `1.5px solid ${T.primary}44`,
            animation: "roomRingPulse 1.8s ease-out infinite",
          }}/>
        )}
        {/* Bot icon */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <BotIcon/>
        </div>
      </div>

      {/* Name + status */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: T.sans, fontSize: 18, fontWeight: 600,
          color: T.ink, letterSpacing: -0.3,
        }}>{agentName}</div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, marginTop: 8,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", background: dotColor,
            flexShrink: 0, transition: "background 400ms ease",
            boxShadow: isSpeaking ? `0 0 6px ${T.primary}` : "none",
          }}/>
          <span style={{
            fontFamily: T.sans, fontSize: 13.5, color: labelColor,
            fontWeight: isSpeaking ? 500 : 400,
            transition: "color 400ms ease",
          }}>{statusText}</span>
        </div>
      </div>

      {/* Waveform */}
      <div style={{ width: "100%", padding: "0 8px" }}>
        <Waveform active={isSpeaking} color={T.primary} bars={38} height={36}/>
      </div>

      {/* Hint */}
      <div style={{
        fontFamily: T.sans, fontSize: 12, color: T.ink3,
        textAlign: "center", lineHeight: 1.6, maxWidth: 240,
      }}>
        {isConnected
          ? isSpeaking
            ? "The agent is responding. It will pause when you speak."
            : "The agent is listening. Speak naturally when ready."
          : "Establishing secure connection to the AI agent…"
        }
      </div>
    </div>
  );
}

/* ─── Agent with speaking detection (hook must be unconditional) ─── */
function AgentTileWithSpeaking({ participant, agentName }: {
  participant: RemoteParticipant; agentName: string;
}) {
  const isSpeaking = useIsSpeaking(participant);
  return <AgentTile agentName={agentName} isSpeaking={isSpeaking} isConnected/>;
}

/* ─── Your microphone tile ──────────────────────────────────────── */
function YourTile({ isMuted }: { isMuted: boolean }) {
  return (
    <div style={{
      width: 210, flexShrink: 0,
      background: T.surface,
      border: `1px solid ${isMuted ? "#FBC7C7" : T.border}`,
      borderRadius: T.r6, padding: "24px 20px", boxShadow: T.shadow1,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
      transition: "border-color 300ms ease",
    }}>
      {/* Mic avatar */}
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: isMuted
          ? "linear-gradient(135deg, #FBC7C7, #F3D9D4)"
          : `linear-gradient(135deg, ${T.surfaceAlt}, ${T.border})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `1.5px solid ${isMuted ? "#FBC7C7" : T.borderSoft}`,
        transition: "all 300ms ease",
      }}>
        {isMuted
          ? <MicOffIcon c={T.red}/>
          : <MicOnIcon  c={T.ink3}/>
        }
      </div>

      {/* Labels */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>
          You
        </div>
        <div style={{
          fontFamily: T.sans, fontSize: 12, marginTop: 4,
          color: isMuted ? T.red : T.green, fontWeight: 500,
        }}>
          {isMuted ? "Microphone off" : "Microphone on"}
        </div>
        <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3, marginTop: 2 }}>
          {isMuted ? "Tap below to unmute" : "Agent can hear you"}
        </div>
      </div>

      {/* Waveform */}
      <Waveform active={!isMuted} color={isMuted ? T.red : T.green} bars={20} height={22}/>
    </div>
  );
}

/* ─── Main room UI (inside LiveKitRoom context) ──────────────────── */
function RoomInner({
  agentName, videoEnabled, onDisconnect, roomName,
}: {
  agentName: string; videoEnabled: boolean;
  onDisconnect: () => void; roomName: string;
}) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const [copied, setCopied] = useState(false);
  const agentParticipant = remotes[0] ?? null;

  const toggleMic  = () => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  const copyLink   = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      padding: 24, gap: 16, overflowY: "auto", background: T.bg,
    }}>
      {/* ── Hint banner ─────────────────────────────────────────── */}
      <div style={{
        padding: "11px 16px", borderRadius: T.r4,
        background: T.primarySoft, border: "1px solid #cfc8f0",
        display: "flex", alignItems: "flex-start", gap: 10,
        fontFamily: T.sans, fontSize: 13, color: T.primary, lineHeight: 1.55,
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
        <span>
          <b>Speak naturally</b> — the AI agent listens and responds in under 400 ms.
          {!isMicrophoneEnabled && (
            <span style={{ color: T.red }}>
              {" "}<b>Your microphone is off.</b> Tap <b>Unmute</b> below to start speaking.
            </span>
          )}
        </span>
      </div>

      {/* ── Participant tiles ────────────────────────────────────── */}
      {videoEnabled ? (
        /* Video mode — LiveKit's built-in layout, just restyled */
        <div style={{
          flex: 1, minHeight: 300, borderRadius: T.r5, overflow: "hidden",
          background: "#111", boxShadow: T.shadowMd,
        }}>
          <VideoConference/>
        </div>
      ) : (
        /* Audio-only — our custom illustrated tiles */
        <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0, alignItems: "stretch" }}>
          {agentParticipant
            ? <AgentTileWithSpeaking participant={agentParticipant} agentName={agentName}/>
            : <AgentTile agentName={agentName} isSpeaking={false} isConnected={false}/>
          }
          <YourTile isMuted={!isMicrophoneEnabled}/>
        </div>
      )}

      {/* ── Control bar ─────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        padding: "14px 20px",
        background: T.surface, border: `1px solid ${T.border}`,
        borderRadius: T.r5, boxShadow: T.shadow1,
      }}>
        {/* Mic toggle — most important, left-anchored */}
        <Btn
          kind={isMicrophoneEnabled ? "default" : "danger"}
          icon={isMicrophoneEnabled
            ? <MicOnIcon c={T.ink2}/>
            : <MicOffIcon c="#fff"/>}
          onClick={toggleMic}
          style={{ minWidth: 178 }}
        >
          {isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
        </Btn>

        {/* Copy invite link */}
        <Btn icon={copied ? <CheckIcon/> : <CopyIcon/>} onClick={copyLink}
             style={{ color: copied ? T.green : undefined }}>
          {copied ? "Link copied!" : "Copy invite link"}
        </Btn>

        {/* Spacer */}
        <div style={{ flex: 1 }}/>

        {/* Connection badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: T.sans, fontSize: 12.5,
          color: agentParticipant ? T.green : T.ink3,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: agentParticipant ? T.green : T.ink4,
          }}/>
          {agentParticipant ? "Agent connected" : "Waiting for agent…"}
        </div>

        {/* Room ID */}
        <span style={{
          fontFamily: T.mono, fontSize: 11, color: T.ink4,
          background: T.surfaceAlt, padding: "3px 8px",
          borderRadius: T.r3, border: `1px solid ${T.borderSoft}`,
        }}>{roomName}</span>

        {/* End call — danger, right-anchored */}
        <Btn kind="danger" icon={<PhoneOffIcon/>} onClick={onDisconnect}>
          End call
        </Btn>
      </div>

      {/* RoomAudioRenderer is invisible but MUST be here to play agent audio */}
      <RoomAudioRenderer/>
    </div>
  );
}

/* ─── Public component ───────────────────────────────────────────── */
export interface CallRoomProps {
  token:        string;
  serverUrl:    string;
  roomName:     string;
  videoEnabled: boolean;
  agentName:    string;
  onDisconnect: () => void;
}

export default function CallRoom({
  token, serverUrl, roomName, videoEnabled, agentName, onDisconnect,
}: CallRoomProps) {
  return (
    <>
      <style>{`
        @keyframes roomOrbFloat  { 0%,100% { transform:translateY(0);   }
                                   50%      { transform:translateY(-7px); } }
        @keyframes roomRingPulse { 0%   { transform:scale(1);   opacity:0.5; }
                                   100% { transform:scale(1.55); opacity:0;   } }
        /* LiveKit overrides — keep it light */
        :root {
          --lk-theme-color: 63,58,140;
          --lk-bg: ${T.bg};
          --lk-bg2: ${T.surface};
          --lk-bg3: ${T.surfaceAlt};
          --lk-border-color: ${T.border};
          --lk-control-bar-bg: ${T.surface};
        }
        [data-lk-theme] { font-family: ${T.sans}; }
      `}</style>

      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        audio={true}
        video={videoEnabled}
        onDisconnected={onDisconnect}
        data-lk-theme="default"
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        <RoomInner
          agentName={agentName}
          videoEnabled={videoEnabled}
          onDisconnect={onDisconnect}
          roomName={roomName}
        />
      </LiveKitRoom>
    </>
  );
}
