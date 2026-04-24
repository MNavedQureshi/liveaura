"use client";

/**
 * /meet/[room] — join flow for a Zoom-style video conference room.
 *
 * Flow:
 *   1. Read the room slug from the URL.
 *   2. Show a pre-join card asking for a display name (remembered in sessionStorage).
 *      This also lets us show the share link before connecting.
 *   3. On submit → dynamically load MeetRoom (which holds the LiveKit WebRTC context).
 *
 * Dynamic import of MeetRoom (ssr: false) keeps the heavy livekit-client bundle
 * out of the SSR pass and avoids mediaDevices errors on the server.
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";

const MeetRoom = dynamic(() => import("@/components/MeetRoom"), {
  ssr: false,
  loading: () => <RoomLoading />,
});

/* ── Design tokens ─────────────────────────────────────────────── */
const T = {
  bg: "#F7F3EA",
  surface: "#FDFBF5",
  surfaceAlt: "#EFE9DA",
  border: "#E4DBC5",
  borderSoft: "#EDE5D0",
  ink: "#2A231A",
  ink2: "#554937",
  ink3: "#8C7F64",
  ink4: "#B5A98B",
  primary: "#3F3A8C",
  primaryHi: "#332E75",
  primaryInk: "#FDFBF5",
  primarySoft: "#E5E0F5",
  primarySoftInk: "#2C2773",
  accent: "#B08D57",
  green: "#4F7A4A",
  greenSoft: "#EAF3E8",
  shadow1: "0 1px 3px rgba(74,56,24,0.08)",
  shadowMd: "0 6px 20px -4px rgba(74,56,24,0.14), 0 2px 6px -2px rgba(74,56,24,0.08)",
  sans: "'Inter', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
  r3: 8, r4: 10, r5: 12, r6: 16, r7: 20,
} as const;

const CopyIcon = ({ color = T.ink2 }: { color?: string }) => (
  <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
    <rect x="5" y="5" width="8" height="8" rx="1.5" stroke={color} strokeWidth="1.4" />
    <path d="M3 11V4a1 1 0 011-1h7" stroke={color} strokeWidth="1.4" />
  </svg>
);
const CheckIcon = () => (
  <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
    <path d="M3 8.5l3 3 7-7" stroke={T.green} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const VideoIcon = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    <rect x="2" y="6" width="14" height="12" rx="2" stroke="#fff" strokeWidth="1.7" />
    <path d="M16 10l5-3v10l-5-3z" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);

/* ── Loading state shown while MeetRoom chunk is fetching ──────── */
function RoomLoading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: T.sans,
      }}
    >
      <style>{`@keyframes spinA { to { transform: rotate(360deg); } } body { margin: 0; }`}</style>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
        <div
          style={{
            width: 38, height: 38, borderRadius: "50%",
            border: `3px solid ${T.primarySoft}`,
            borderTopColor: T.primary,
            animation: "spinA 700ms linear infinite",
          }}
        />
        <div style={{ color: T.ink3, fontSize: 13 }}>Connecting to meeting…</div>
      </div>
    </div>
  );
}

/* ── Pre-join card ─────────────────────────────────────────────── */
function PreJoin({
  room,
  onJoin,
}: {
  room: string;
  onJoin: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);

  // Prefill from sessionStorage if they were here before
  useEffect(() => {
    const saved = sessionStorage.getItem("meet-name");
    if (saved) setName(saved);
  }, []);

  const shareLink =
    typeof window !== "undefined" ? `${window.location.origin}/meet-lite/${room}` : "";

  const copy = () => {
    navigator.clipboard
      .writeText(shareLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    sessionStorage.setItem("meet-name", n);
    onJoin(n);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        fontFamily: T.sans,
        color: T.ink,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`body { background: ${T.bg}; margin: 0; }`}</style>

      {/* Topbar */}
      <header
        style={{
          height: 64, padding: "0 24px", flexShrink: 0,
          background: T.surface, borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", gap: 12, boxShadow: T.shadow1,
        }}
      >
        <a
          href="/meet-lite"
          style={{
            display: "flex", alignItems: "center", gap: 10,
            textDecoration: "none", color: T.ink,
          }}
        >
          <div
            style={{
              width: 32, height: 32, borderRadius: T.r3,
              background: `linear-gradient(135deg, ${T.primary}, ${T.accent})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 2px 8px ${T.primary}33`,
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <rect x="2" y="6" width="14" height="12" rx="2" stroke="#fff" strokeWidth="1.7" />
              <path d="M16 10l5-3v10l-5-3z" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: -0.2 }}>Meet Lite</span>
        </a>
      </header>

      {/* Card */}
      <main
        style={{
          flex: 1, display: "flex", alignItems: "center",
          justifyContent: "center", padding: "24px",
        }}
      >
        <div
          style={{
            background: T.surface, border: `1px solid ${T.border}`,
            borderRadius: T.r7, padding: 32, boxShadow: T.shadowMd,
            display: "flex", flexDirection: "column", gap: 18,
            width: "100%", maxWidth: 440,
          }}
        >
          <div
            style={{
              width: 52, height: 52, borderRadius: T.r4,
              background: `linear-gradient(135deg, ${T.primary}, ${T.accent})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 4px 14px ${T.primary}44`,
            }}
          >
            <VideoIcon />
          </div>

          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: T.ink4 }}>
              Meeting code
            </div>
            <div
              style={{
                fontFamily: T.mono, fontSize: 18, fontWeight: 600,
                color: T.ink, marginTop: 4, letterSpacing: 0.3,
                wordBreak: "break-all",
              }}
            >
              {room}
            </div>
          </div>

          {/* Share link */}
          <div>
            <label
              style={{
                fontSize: 12, fontWeight: 500, color: T.ink3,
                display: "block", marginBottom: 6,
              }}
            >
              Share this link
            </label>
            <div
              style={{
                display: "flex", gap: 6, alignItems: "stretch",
                background: T.surfaceAlt, border: `1px solid ${T.borderSoft}`,
                borderRadius: T.r3, padding: 4,
              }}
            >
              <div
                style={{
                  flex: 1, padding: "8px 10px",
                  fontFamily: T.mono, fontSize: 11.5, color: T.ink2,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  alignSelf: "center",
                }}
              >
                {shareLink}
              </div>
              <button
                onClick={copy}
                style={{
                  height: 32, padding: "0 10px",
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: T.r3, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontFamily: T.sans, fontSize: 12, color: T.ink2,
                  whiteSpace: "nowrap", boxShadow: T.shadow1,
                }}
              >
                {copied ? (<><CheckIcon />Copied</>) : (<><CopyIcon />Copy</>)}
              </button>
            </div>
          </div>

          {/* Name input */}
          <div>
            <label
              style={{
                fontSize: 12, fontWeight: 500, color: T.ink3,
                display: "block", marginBottom: 6,
              }}
            >
              Your name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="How should others see you?"
              style={{
                width: "100%", height: 44, padding: "0 14px",
                background: "#fff", border: `1px solid ${T.border}`,
                borderRadius: T.r3, fontFamily: T.sans, fontSize: 14,
                color: T.ink, outline: "none", transition: "border-color 120ms ease",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = T.primary)}
              onBlur={(e) => (e.currentTarget.style.borderColor = T.border)}
            />
          </div>

          <button
            onClick={submit}
            disabled={!name.trim()}
            style={{
              height: 48, padding: "0 18px",
              background: name.trim() ? T.primary : T.surfaceAlt,
              color: name.trim() ? T.primaryInk : T.ink4,
              border: name.trim() ? "none" : `1px solid ${T.border}`,
              borderRadius: T.r3, fontFamily: T.sans, fontSize: 15, fontWeight: 600,
              cursor: name.trim() ? "pointer" : "not-allowed",
              boxShadow: name.trim() ? `0 4px 12px ${T.primary}33` : "none",
              transition: "background 130ms ease",
            }}
            onMouseOver={(e) => {
              if (name.trim()) (e.currentTarget as HTMLButtonElement).style.background = T.primaryHi;
            }}
            onMouseOut={(e) => {
              if (name.trim()) (e.currentTarget as HTMLButtonElement).style.background = T.primary;
            }}
          >
            Join meeting
          </button>

          <div
            style={{
              fontSize: 11.5, color: T.ink4, lineHeight: 1.5, textAlign: "center",
            }}
          >
            Your camera and mic turn on after you join. You can toggle either before anyone sees or hears you.
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */
export default function MeetRoomPage() {
  const params = useParams();
  const router = useRouter();
  const room = (params?.room as string | undefined) ?? "";
  const [name, setName] = useState<string | null>(null);

  if (!name) {
    return <PreJoin room={room} onJoin={setName} />;
  }

  return (
    <MeetRoom
      room={room}
      name={name}
      onLeave={() => router.push("/meet-lite")}
    />
  );
}
