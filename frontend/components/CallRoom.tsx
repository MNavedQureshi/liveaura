"use client";

/**
 * CallRoom — custom voice call UI.
 * Controls bar is at the TOP. Agent + mic cards fill all remaining height.
 * Only LiveKitRoom (WebRTC context) and RoomAudioRenderer (plays audio)
 * come from LiveKit. Everything visual is inline styles — no LiveKit CSS.
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
      padding: "32px 32px 28px",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 20,
      flex: 1, minWidth: 0,
    }}>
      <div style={{
        fontFamily: C.sans, fontSize: 11, fontWeight: 600,
        letterSpacing: 1, textTransform: "uppercase", color: C.ink4,
      }}>AI Agent</div>

      {/* Orb */}
      <div style={{ position: "relative", width: 130, height: 130 }}>
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
          <svg width={38} height={38} viewBox="0 0 16 16" fill="none">
            <rect x="3" y="5" width="10" height="8" rx="2"
                  stroke="rgba(255,255,255,0.88)" strokeWidth="1.3"/>
            <circle cx="6"  cy="9" r="1.1" fill="rgba(255,255,255,0.88)"/>
            <circle cx="10" cy="9" r="1.1" fill="rgba(255,255,255,0.88)"/>
            <path d="M8 5V2.5M6 2.5h4"
                  stroke="rgba(255,255,255,0.88)" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* Name + status */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: C.sans, fontSize: 22, fontWeight: 700, color: C.ink, letterSpacing: -0.4 }}>
          {name}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: statusDot,
            boxShadow: speaking ? `0 0 10px ${C.primary}` : "none",
            transition: "all 400ms ease",
          }}/>
          <span style={{
            fontFamily: C.sans, fontSize: 15, color: statusText,
            fontWeight: speaking ? 600 : 400, transition: "color 400ms ease",
          }}>{status}</span>
        </div>
      </div>

      {/* Agent waveform */}
      <div style={{ width: "100%", paddingTop: 4 }}>
        <Waveform active={speaking} color={C.primary} bars={44} height={52}/>
      </div>

      {/* Context hint */}
      <div style={{
        fontFamily: C.sans, fontSize: 12.5, color: C.ink3,
        textAlign: "center", lineHeight: 1.65, maxWidth: 280,
        padding: "10px 14px", background: C.surfaceAlt,
        borderRadius: C.r4, border: `1px solid ${C.borderSoft}`,
      }}>
        {!connected && "Setting up the voice connection…"}
        {connected && speaking && "🔊 Speaking — it pauses automatically when you talk."}
        {connected && !speaking && "🎙 Listening — just speak, no button needed."}
      </div>
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
      padding: "28px 22px",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 18,
      width: 230, flexShrink: 0,
    }}>
      <div style={{
        fontFamily: C.sans, fontSize: 11, fontWeight: 600,
        letterSpacing: 1, textTransform: "uppercase", color: C.ink4,
      }}>Your Mic</div>

      {/* Big mic status circle */}
      <div style={{
        width: 80, height: 80, borderRadius: "50%",
        background: muted ? C.redSoft : C.greenSoft,
        border: `2px solid ${muted ? "#f0b8b8" : "#b8ddb4"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 300ms ease",
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: "50%",
          background: muted ? C.red : C.green,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {muted ? Ico.micOff("#fff") : Ico.micOn("#fff")}
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: C.sans, fontSize: 14, fontWeight: 600,
          color: muted ? C.red : C.green,
        }}>
          {muted ? "Microphone OFF" : "Microphone ON"}
        </div>
        <div style={{ fontFamily: C.sans, fontSize: 12, color: C.ink3, marginTop: 4, lineHeight: 1.5 }}>
          {muted ? "Tap Unmute to speak" : "Agent can hear you"}
        </div>
      </div>

      {/* Your waveform */}
      <div style={{ width: "100%" }}>
        <Waveform active={!muted} color={muted ? C.red : C.green} bars={22} height={40}/>
      </div>
      <div style={{ fontFamily: C.sans, fontSize: 11, color: C.ink4 }}>Voice activity</div>
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
        {/* Agent card (large) */}
        {agentParticipant
          ? <AgentCardConnected participant={agentParticipant} name={agentName}/>
          : <AgentCard name={agentName} speaking={false} connected={false}/>
        }

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
