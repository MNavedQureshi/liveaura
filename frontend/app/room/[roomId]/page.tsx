"use client";

import "@livekit/components-styles";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import CallRoom from "@/components/CallRoom";
import type { TokenResponse } from "@/lib/types";

/* ── Design tokens ─────────────────────────────────────────────────── */
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
  red:         "#B64242",
  redSoft:     "#F3D9D4",
  green:       "#4F7A4A",
  accent:      "#B08D57",
  shadow1:     "0 1px 2px rgba(74,56,24,0.06)",
  shadowMd:    "0 4px 10px -2px rgba(74,56,24,0.12), 0 2px 4px -1px rgba(74,56,24,0.06)",
  sans:        "'Inter', -apple-system, system-ui, sans-serif",
  mono:        "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
  r3: 8, r4: 10, r5: 12, r6: 16,
} as const;

/* ── Tiny SVGs ─────────────────────────────────────────────────────── */
const MicIcon = () => (
  <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
    <rect x="6" y="2" width="4" height="8" rx="2" stroke="#fff" strokeWidth="1.4"/>
    <path d="M3.5 7.5v.5a4.5 4.5 0 009 0v-.5M8 12.5V14M5.5 14h5"
          stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const ArrowLeft = () => (
  <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
    <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const AlertCircle = () => (
  <svg width={28} height={28} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke={T.red} strokeWidth="1.5"/>
    <path d="M12 7v6M12 16.5v.5" stroke={T.red} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

/* ── Button ────────────────────────────────────────────────────────── */
function Btn({ children, onClick, kind = "default", icon, style: sx = {} }: {
  children: React.ReactNode; onClick?: () => void;
  kind?: "default" | "primary" | "danger"; icon?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [hov, setHov] = useState(false);
  const s = {
    primary: { bg: hov ? T.primaryHi : T.primary, fg: T.primaryInk, bd: "transparent" },
    danger:  { bg: hov ? "#a33" : T.red,           fg: "#fff",        bd: "transparent" },
    default: { bg: hov ? T.surfaceAlt : T.surface,  fg: T.ink2,        bd: T.border },
  }[kind];
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        height: 32, padding: "0 12px",
        fontFamily: T.sans, fontSize: 13, fontWeight: 500,
        color: s.fg, background: s.bg,
        border: s.bd === "transparent" ? "none" : `1px solid ${s.bd}`,
        borderRadius: T.r3, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 6,
        boxShadow: kind === "default" ? T.shadow1 : "none",
        transition: "background 120ms ease", whiteSpace: "nowrap", ...sx,
      }}>
      {icon}{children}
    </button>
  );
}

/* ── Live chip ─────────────────────────────────────────────────────── */
function LiveChip() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      height: 20, padding: "0 7px",
      fontFamily: T.sans, fontSize: 11, fontWeight: 500, letterSpacing: 0.1,
      color: "#991B1B", background: "#FEF2F2",
      border: "1px solid #FBC7C7", borderRadius: 999,
    }}>
      <span style={{ position: "relative", width: 6, height: 6, display: "inline-block" }}>
        <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#DC2626" }}/>
        <span style={{
          position: "absolute", inset: -2, borderRadius: "50%",
          background: "#DC2626", opacity: 0.25,
          animation: "livePulse 1.6s ease-out infinite",
        }}/>
      </span>
      Live
    </span>
  );
}

/* ── Spinner ───────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div style={{
      width: 38, height: 38, borderRadius: "50%",
      border: `3px solid ${T.primarySoft}`,
      borderTopColor: T.primary,
      animation: "spinAnim 700ms linear infinite",
    }}/>
  );
}

/* ── Page ──────────────────────────────────────────────────────────── */
export default function RoomPage() {
  const params  = useParams();
  const router  = useRouter();
  const roomId  = params.roomId as string;

  const [tokenData,     setTokenData]     = useState<TokenResponse | null>(null);
  const [agentName,     setAgentName]     = useState("AI Assistant");
  const [videoEnabled,  setVideoEnabled]  = useState(false);
  const [error,         setError]         = useState("");
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    const identity = `user-${Math.random().toString(36).slice(2, 8)}`;
    (async () => {
      try {
        const metaRes = await fetch(`/api/calls/${roomId}`).catch(() => null);
        if (metaRes?.ok) {
          const m = await metaRes.json();
          if (m.agent_name)    setAgentName(m.agent_name);
          if (m.video_enabled) setVideoEnabled(true);
        }
        const res = await fetch("/api/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_name: roomId, identity }),
        });
        if (!res.ok) throw new Error("Failed to get access token");
        setTokenData(await res.json());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Could not connect");
      } finally {
        setLoading(false);
      }
    })();
  }, [roomId]);

  /* Shared chrome wrapper */
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: T.bg, fontFamily: T.sans, overflow: "hidden",
    }}>
      <style>{`
        body { background: ${T.bg} !important; margin: 0; overflow: hidden; }
        @keyframes spinAnim  { to { transform: rotate(360deg); } }
        @keyframes livePulse { 0%   { transform:scale(1);   opacity:0.6; }
                               100% { transform:scale(2.2);  opacity:0;   } }
      `}</style>

      {/* Topbar */}
      <header style={{
        height: 64, padding: "0 24px", flexShrink: 0,
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", gap: 14,
        boxShadow: T.shadow1,
      }}>
        {/* Back to console */}
        <Btn onClick={() => router.push("/console")} icon={<ArrowLeft/>}>
          Console
        </Btn>

        <div style={{ width: 1, height: 28, background: T.borderSoft, flexShrink: 0 }}/>

        {/* Brand orb */}
        <div style={{
          width: 32, height: 32, borderRadius: T.r3, flexShrink: 0,
          background: `linear-gradient(135deg, ${T.primary}, ${T.accent})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 2px 8px ${T.primary}33`,
        }}>
          <MicIcon/>
        </div>

        {/* Agent name */}
        <span style={{
          fontFamily: T.sans, fontSize: 16, fontWeight: 600,
          color: T.ink, letterSpacing: -0.2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          flex: 1,
        }}>{agentName}</span>

        {/* Live chip */}
        {!loading && !error && tokenData && <LiveChip/>}

        {/* Room ID */}
        <span style={{
          fontFamily: T.mono, fontSize: 10.5, color: T.ink4,
          background: T.surfaceAlt, padding: "3px 9px",
          borderRadius: T.r3, border: `1px solid ${T.borderSoft}`,
          flexShrink: 0,
        }}>{roomId}</span>
      </header>

      {children}
    </div>
  );

  /* Loading */
  if (loading) {
    return (
      <Shell>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: T.r6, padding: "40px 48px", boxShadow: T.shadowMd,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
          }}>
            <Spinner/>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: T.sans, fontSize: 15, fontWeight: 600, color: T.ink }}>
                Connecting to room
              </div>
              <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink3, marginTop: 5 }}>
                Setting up your AI agent…
              </div>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  /* Error */
  if (error || !tokenData) {
    return (
      <Shell>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: T.r6, padding: "40px 48px", boxShadow: T.shadowMd,
            maxWidth: 420, width: "100%",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center",
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%",
              background: T.redSoft, border: "1px solid #FBC7C7",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <AlertCircle/>
            </div>
            <div>
              <div style={{ fontFamily: T.sans, fontSize: 16, fontWeight: 600, color: T.ink }}>
                Could not connect
              </div>
              <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink3, marginTop: 6, lineHeight: 1.6 }}>
                {error || "Room not found or the token has expired."}
              </div>
            </div>
            <Btn kind="primary" onClick={() => router.push("/console")}>
              Back to Console
            </Btn>
          </div>
        </div>
      </Shell>
    );
  }

  /* Live call */
  return (
    <Shell>
      <CallRoom
        token={tokenData.token}
        serverUrl={tokenData.livekit_url || process.env.NEXT_PUBLIC_LIVEKIT_URL || ""}
        roomName={roomId}
        videoEnabled={videoEnabled}
        agentName={agentName}
        onDisconnect={() => router.push("/console")}
      />
    </Shell>
  );
}
