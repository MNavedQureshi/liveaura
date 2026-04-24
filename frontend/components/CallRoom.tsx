"use client";

/**
 * CallRoom — custom WebRTC call UI.
 *
 * Intentionally does NOT import @livekit/components-styles or use any
 * LiveKit visual components (AudioConference, ControlBar, etc.).
 * Only LiveKitRoom (WebRTC context) and RoomAudioRenderer (invisible,
 * plays remote audio) come from LiveKit. Everything visible is built
 * with inline styles matching the console cream/indigo palette.
 */

import { useState, useEffect } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useRemoteParticipants,
  useIsSpeaking,
} from "@livekit/components-react";
import type { RemoteParticipant } from "livekit-client";

/* ─── Design tokens ─────────────────────────────────────────────── */
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
  primarySoftInk: "#2C2773",
  accent:      "#B08D57",
  red:         "#B64242",
  redSoft:     "#F3D9D4",
  green:       "#4F7A4A",
  shadow1:     "0 1px 2px rgba(74,56,24,0.06)",
  shadowMd:    "0 4px 10px -2px rgba(74,56,24,0.12), 0 2px 4px -1px rgba(74,56,24,0.06)",
  sans:        "'Inter', -apple-system, system-ui, sans-serif",
  mono:        "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
  r3: 8, r4: 10, r5: 12, r6: 16,
} as const;

/* ─── Animated waveform ─────────────────────────────────────────── */
function Waveform({ active, color, bars = 28, height = 28 }: {
  active: boolean; color: string; bars?: number; height?: number;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) { setTick(0); return; }
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
            display: "block", width: 2.5, height: h,
            borderRadius: 2, background: color,
            opacity: active ? 0.3 + amp * 0.7 : 0.15,
            transition: "height 130ms ease-out, opacity 130ms ease-out",
          }}/>
        );
      })}
    </div>
  );
}

/* ─── Button ────────────────────────────────────────────────────── */
function Btn({ children, onClick, kind = "default", icon, style: sx = {} }: {
  children: React.ReactNode; onClick?: () => void;
  kind?: "default" | "primary" | "danger"; icon?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [hov, setHov] = useState(false);
  const map = {
    primary: { bg: hov ? T.primaryHi : T.primary, fg: T.primaryInk, border: "none" },
    danger:  { bg: hov ? "#9b2020" : T.red,        fg: "#fff",        border: "none" },
    default: { bg: hov ? T.surfaceAlt : T.surface,  fg: T.ink2, border: `1px solid ${T.border}` },
  }[kind];
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 44, padding: "0 20px",
        fontFamily: T.sans, fontSize: 14, fontWeight: 500,
        color: map.fg, background: map.bg, border: map.border,
        borderRadius: T.r4, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 9,
        boxShadow: kind === "default" ? T.shadow1
          : `0 2px 8px ${kind === "danger" ? T.red : T.primary}44`,
        transition: "background 120ms ease",
        whiteSpace: "nowrap", ...sx,
      }}
    >
      {icon}{children}
    </button>
  );
}

/* ─── Icons ─────────────────────────────────────────────────────── */
const MicOnSVG = () => (
  <svg width={17} height={17} viewBox="0 0 16 16" fill="none">
    <rect x="6" y="2" width="4" height="8" rx="2" stroke={T.ink2} strokeWidth="1.4"/>
    <path d="M3.5 7.5v.5a4.5 4.5 0 009 0v-.5M8 12.5V14M5.5 14h5"
          stroke={T.ink2} strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const MicOffSVG = () => (
  <svg width={17} height={17} viewBox="0 0 16 16" fill="none">
    <path d="M2 2l12 12" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M9.5 9.8A2 2 0 016 8V3.9M6 2a2 2 0 014 0v4.1"
          stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M3.6 8.2A4.5 4.5 0 0011.9 11M12.4 9.2c.07-.23.1-.47.1-.7v-.5M8 12.5V14M5.5 14h5"
          stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const EndCallSVG = () => (
  <svg width={17} height={17} viewBox="0 0 24 24" fill="none">
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.14 9.8 19.79 19.79 0 01.07 1.18 2 2 0 012.06 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.13 7.91a16 16 0 006.97 6.97l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"
          stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 2l20 20" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const CopySVG = () => (
  <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
    <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M3 11V4a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);
const CheckSVG = () => (
  <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
    <path d="M3 8.5l3 3 7-7" stroke={T.green} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const BotSVG = () => (
  <svg width={32} height={32} viewBox="0 0 16 16" fill="none">
    <rect x="3" y="5" width="10" height="8" rx="2" stroke="rgba(255,255,255,0.9)" strokeWidth="1.3"/>
    <circle cx="6" cy="9" r="1.1" fill="rgba(255,255,255,0.9)"/>
    <circle cx="10" cy="9" r="1.1" fill="rgba(255,255,255,0.9)"/>
    <path d="M8 5V2.5M6 2.5h4" stroke="rgba(255,255,255,0.9)" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);
const UserSVG = ({ muted }: { muted: boolean }) => (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="4" stroke={muted ? T.red : T.ink3} strokeWidth="1.5"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={muted ? T.red : T.ink3} strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

/* ─── Agent tile ────────────────────────────────────────────────── */
function AgentTile({ name, speaking, connected }: {
  name: string; speaking: boolean; connected: boolean;
}) {
  const status = !connected ? "Joining the room…"
    : speaking ? "Speaking"
    : "Listening";
  const dotBg = speaking ? T.primary : connected ? T.green : T.ink4;
  const textColor = speaking ? T.primary : connected ? T.green : T.ink3;

  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: T.r6, padding: "36px 28px",
      boxShadow: T.shadowMd,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 24,
    }}>
      {/* Orb avatar */}
      <div style={{ position: "relative", width: 108, height: 108 }}>
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(circle at 32% 28%, ${T.primary} 0%, ${T.accent} 55%, #1a0a40 100%)`,
          boxShadow: speaking
            ? `0 0 0 0 ${T.primary}44, 0 10px 40px ${T.primary}44`
            : `0 10px 40px ${T.primary}33`,
          animation: connected ? "orbFloat 4s ease-in-out infinite" : "none",
          transition: "box-shadow 400ms ease",
        }}/>
        {/* Gloss */}
        <div style={{
          position: "absolute", inset: "12%", borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.28) 0%, transparent 60%)",
        }}/>
        {/* Speaking ring */}
        {speaking && (
          <div style={{
            position: "absolute", inset: -10, borderRadius: "50%",
            border: `2px solid ${T.primary}33`,
            animation: "ringPulse 1.6s ease-out infinite",
          }}/>
        )}
        {/* Bot icon */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <BotSVG/>
        </div>
      </div>

      {/* Name + status */}
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: T.sans, fontSize: 20, fontWeight: 600,
          color: T.ink, letterSpacing: -0.3, lineHeight: 1.2,
        }}>{name}</div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 7, marginTop: 10,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
            background: dotBg,
            boxShadow: speaking ? `0 0 8px ${T.primary}` : "none",
            transition: "background 400ms ease, box-shadow 400ms ease",
          }}/>
          <span style={{
            fontFamily: T.sans, fontSize: 14,
            color: textColor, fontWeight: speaking ? 600 : 400,
            transition: "color 400ms ease",
          }}>{status}</span>
        </div>
      </div>

      {/* Waveform */}
      <div style={{ width: "100%", padding: "0 12px" }}>
        <Waveform active={speaking} color={T.primary} bars={40} height={40}/>
      </div>

      {/* Helper text */}
      <div style={{
        fontFamily: T.sans, fontSize: 12.5, color: T.ink3,
        textAlign: "center", lineHeight: 1.7, maxWidth: 260,
      }}>
        {!connected && "Establishing secure WebRTC connection…"}
        {connected && speaking && "The agent is responding — it will pause automatically when you speak."}
        {connected && !speaking && "The agent is waiting for you to speak. Talk naturally, at any pace."}
      </div>
    </div>
  );
}

/* ─── Agent with speaking hook — split so hook is always called ─── */
function AgentTileConnected({ participant, name }: {
  participant: RemoteParticipant; name: string;
}) {
  const speaking = useIsSpeaking(participant);
  return <AgentTile name={name} speaking={speaking} connected/>;
}

/* ─── Your microphone tile ──────────────────────────────────────── */
function YouTile({ muted }: { muted: boolean }) {
  return (
    <div style={{
      width: 220, flexShrink: 0,
      background: T.surface,
      border: `1.5px solid ${muted ? "#f0b8b8" : T.border}`,
      borderRadius: T.r6, padding: "28px 20px",
      boxShadow: T.shadow1,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
      transition: "border-color 300ms ease",
    }}>
      {/* Avatar circle */}
      <div style={{
        width: 72, height: 72, borderRadius: "50%",
        background: muted
          ? "linear-gradient(135deg, #fddcdc, #f3c0c0)"
          : `linear-gradient(135deg, ${T.surfaceAlt}, #d9cdb0)`,
        border: `1.5px solid ${muted ? "#f0b8b8" : T.borderSoft}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 300ms ease",
      }}>
        <UserSVG muted={muted}/>
      </div>

      {/* Labels */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: T.sans, fontSize: 15, fontWeight: 600, color: T.ink }}>
          You
        </div>
        <div style={{
          fontFamily: T.sans, fontSize: 13, fontWeight: 500, marginTop: 5,
          color: muted ? T.red : T.green,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%",
            background: muted ? T.red : T.green,
          }}/>
          {muted ? "Microphone off" : "Microphone on"}
        </div>
        <div style={{
          fontFamily: T.sans, fontSize: 12, color: T.ink3, marginTop: 4, lineHeight: 1.5,
        }}>
          {muted ? "Tap Unmute below\nto speak to the agent" : "Agent can hear you"}
        </div>
      </div>

      {/* Waveform */}
      <Waveform active={!muted} color={muted ? T.red : T.green} bars={20} height={24}/>
    </div>
  );
}

/* ─── Inner component — uses LiveKit hooks ──────────────────────── */
function RoomUI({ agentName, onDisconnect, roomName }: {
  agentName: string; onDisconnect: () => void; roomName: string;
}) {
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const [copied, setCopied] = useState(false);

  const agentParticipant = (remotes[0] as RemoteParticipant | undefined) ?? null;

  const toggleMic = () =>
    localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      padding: 24, gap: 16, overflowY: "auto",
      fontFamily: T.sans, background: T.bg,
    }}>

      {/* ── Hint banner ───────────────────────────────────────── */}
      <div style={{
        padding: "12px 18px", borderRadius: T.r4,
        background: T.primarySoft, border: `1px solid #cfc8f0`,
        display: "flex", alignItems: "flex-start", gap: 10,
        fontSize: 13.5, color: T.primarySoftInk, lineHeight: 1.6,
      }}>
        <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.4 }}>💡</span>
        <span>
          <strong>Speak naturally</strong> — the AI agent listens and responds in under 400 ms.
          {!isMicrophoneEnabled && (
            <span style={{ color: T.red }}>
              {" "}<strong>Your microphone is off.</strong> Tap <strong>Unmute microphone</strong> below to start speaking.
            </span>
          )}
        </span>
      </div>

      {/* ── Participant area ──────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", gap: 16, minHeight: 0 }}>
        {agentParticipant
          ? <AgentTileConnected participant={agentParticipant} name={agentName}/>
          : <AgentTile name={agentName} speaking={false} connected={false}/>
        }
        <YouTile muted={!isMicrophoneEnabled}/>
      </div>

      {/* ── Control bar ──────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10,
        padding: "16px 20px",
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: T.r5, boxShadow: T.shadow1,
      }}>
        {/* Mic — most important action */}
        <Btn
          kind={isMicrophoneEnabled ? "default" : "danger"}
          icon={isMicrophoneEnabled ? <MicOnSVG/> : <MicOffSVG/>}
          onClick={toggleMic}
          style={{ minWidth: 196 }}
        >
          {isMicrophoneEnabled ? "Mute microphone" : "Unmute microphone"}
        </Btn>

        {/* Copy link */}
        <Btn
          icon={copied ? <CheckSVG/> : <CopySVG/>}
          onClick={copyLink}
          style={{ color: copied ? T.green : T.ink2 }}
        >
          {copied ? "Link copied!" : "Copy invite link"}
        </Btn>

        {/* Spacer */}
        <div style={{ flex: 1 }}/>

        {/* Connection badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 13, color: agentParticipant ? T.green : T.ink3,
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
          background: T.surfaceAlt, padding: "4px 10px",
          borderRadius: T.r3, border: `1px solid ${T.borderSoft}`,
        }}>{roomName}</span>

        {/* End call */}
        <Btn kind="danger" icon={<EndCallSVG/>} onClick={onDisconnect}>
          End call
        </Btn>
      </div>

      {/* Invisible: plays the agent's audio */}
      <RoomAudioRenderer/>
    </div>
  );
}

/* ─── Public component ──────────────────────────────────────────── */
export interface CallRoomProps {
  token: string; serverUrl: string; roomName: string;
  videoEnabled: boolean; agentName: string; onDisconnect: () => void;
}

export default function CallRoom({
  token, serverUrl, roomName, videoEnabled, agentName, onDisconnect,
}: CallRoomProps) {
  return (
    <>
      <style>{`
        @keyframes orbFloat  { 0%,100%{transform:translateY(0);}  50%{transform:translateY(-8px);} }
        @keyframes ringPulse { 0%{transform:scale(1);opacity:.5;} 100%{transform:scale(1.6);opacity:0;} }
      `}</style>

      {/*
        LiveKitRoom: handles WebRTC connection only.
        NO data-lk-theme — avoids importing LiveKit's dark CSS theme.
      */}
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        audio={true}
        video={videoEnabled}
        onDisconnected={onDisconnect}
        style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <RoomUI agentName={agentName} onDisconnect={onDisconnect} roomName={roomName}/>
      </LiveKitRoom>
    </>
  );
}
