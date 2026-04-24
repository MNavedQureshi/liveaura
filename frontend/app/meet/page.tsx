"use client";

/**
 * /meet — landing for the Zoom-style conferencing feature.
 * Two actions:
 *   1. Start new meeting → generates a readable slug and navigates.
 *   2. Join with code    → navigates to /meet/{code}.
 *
 * Uses the same cream/indigo palette as /room/[roomId] for brand cohesion.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

/* ── Design tokens (match /room) ───────────────────────────────── */
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
  shadow1: "0 1px 3px rgba(74,56,24,0.08)",
  shadowMd:
    "0 6px 20px -4px rgba(74,56,24,0.14), 0 2px 6px -2px rgba(74,56,24,0.08)",
  sans: "'Inter', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
  r3: 8,
  r4: 10,
  r5: 12,
  r6: 16,
  r7: 20,
} as const;

const ADJECTIVES = [
  "calm", "swift", "bright", "copper", "amber", "indigo", "lunar", "solar",
  "crimson", "jade", "ivory", "neon", "mellow", "velvet", "quiet", "bold",
  "rosy", "misty", "silver", "golden", "dusky", "cobalt", "emerald", "vivid",
];
const NOUNS = [
  "harbor", "falcon", "meadow", "river", "canyon", "lantern", "forest",
  "echo", "cascade", "delta", "willow", "summit", "aurora", "orbit",
  "comet", "prairie", "ember", "glade", "reef", "atlas", "cipher", "quill",
];

function generateSlug() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${a}-${n}-${num}`;
}

/** Sanitize a user-typed room code: lowercase, strip spaces/punctuation → a-z 0-9 and `-`. */
function normalizeCode(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ── Small icons ───────────────────────────────────────────────── */
const VideoIcon = ({ color = "#fff", size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2" y="6" width="14" height="12" rx="2" stroke={color} strokeWidth="1.7" />
    <path d="M16 10l5-3v10l-5-3z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
  </svg>
);
const UsersIcon = ({ color = "#fff", size = 18 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth="1.6" />
    <path d="M3 19c0-2.8 2.7-5 6-5s6 2.2 6 5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="17" cy="9" r="2.4" stroke={color} strokeWidth="1.5" />
    <path d="M14 13.5c1-.5 2-.8 3-.8 2.5 0 4 1.6 4 3.6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const ArrowRight = ({ color = "#fff", size = 16 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10m-4-4l4 4-4 4" stroke={color} strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ── Page ──────────────────────────────────────────────────────── */
export default function MeetLandingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [starting, setStarting] = useState(false);
  const [joining, setJoining] = useState(false);

  const startNew = () => {
    setStarting(true);
    const slug = generateSlug();
    router.push(`/meet/${slug}`);
  };

  const joinExisting = () => {
    const slug = normalizeCode(code);
    if (!slug) return;
    setJoining(true);
    router.push(`/meet/${slug}`);
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

      {/* Top nav */}
      <header
        style={{
          height: 64,
          padding: "0 24px",
          background: T.surface,
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: T.shadow1,
        }}
      >
        <a
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
            color: T.ink,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: T.r3,
              background: `linear-gradient(135deg, ${T.primary}, ${T.accent})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 2px 8px ${T.primary}33`,
            }}
          >
            <VideoIcon color="#fff" size={16} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: -0.2 }}>LiveKit Meet</span>
        </a>
        <div style={{ flex: 1 }} />
        <a
          href="/"
          style={{
            fontSize: 13,
            color: T.ink3,
            textDecoration: "none",
            padding: "8px 12px",
            borderRadius: T.r3,
          }}
        >
          ← Back to app
        </a>
      </header>

      {/* Hero */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px 60px",
          gap: 32,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 560 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              fontFamily: T.mono,
              fontSize: 11,
              letterSpacing: 0.5,
              color: T.primarySoftInk,
              background: T.primarySoft,
              borderRadius: 999,
              marginBottom: 18,
            }}
          >
            <UsersIcon color={T.primary} size={13} />
            GROUP CALLS · UP TO 50 PEOPLE
          </div>
          <h1
            style={{
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: -1,
              lineHeight: 1.1,
              margin: 0,
              color: T.ink,
            }}
          >
            Video meetings made simple
          </h1>
          <p
            style={{
              fontSize: 16,
              color: T.ink3,
              lineHeight: 1.6,
              marginTop: 14,
              marginBottom: 0,
            }}
          >
            Start an instant meeting and share the link. Anyone with the link joins in their browser —
            no downloads, no account required.
          </p>
        </div>

        {/* Two action cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
            width: "100%",
            maxWidth: 760,
          }}
        >
          {/* Start new */}
          <div
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: T.r7,
              padding: 24,
              boxShadow: T.shadowMd,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: T.r4,
                background: `linear-gradient(135deg, ${T.primary}, ${T.accent})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 2px 10px ${T.primary}44`,
              }}
            >
              <VideoIcon color="#fff" size={22} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: T.ink }}>Start a new meeting</div>
              <div style={{ fontSize: 13, color: T.ink3, lineHeight: 1.5, marginTop: 4 }}>
                Generates a unique link you can share. Anyone can join from any device.
              </div>
            </div>
            <button
              onClick={startNew}
              disabled={starting}
              style={{
                marginTop: 4,
                height: 44,
                padding: "0 18px",
                background: T.primary,
                color: T.primaryInk,
                border: "none",
                borderRadius: T.r3,
                fontFamily: T.sans,
                fontSize: 14,
                fontWeight: 600,
                cursor: starting ? "progress" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: `0 4px 12px ${T.primary}33`,
                transition: "background 130ms ease",
                opacity: starting ? 0.75 : 1,
              }}
              onMouseOver={(e) => {
                if (!starting) (e.currentTarget as HTMLButtonElement).style.background = T.primaryHi;
              }}
              onMouseOut={(e) => {
                if (!starting) (e.currentTarget as HTMLButtonElement).style.background = T.primary;
              }}
            >
              {starting ? "Creating…" : (<>
                New meeting <ArrowRight color="#fff" />
              </>)}
            </button>
          </div>

          {/* Join existing */}
          <div
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: T.r7,
              padding: 24,
              boxShadow: T.shadowMd,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: T.r4,
                background: T.surfaceAlt,
                border: `1px solid ${T.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UsersIcon color={T.ink2} size={20} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: T.ink }}>Join with a code</div>
              <div style={{ fontSize: 13, color: T.ink3, lineHeight: 1.5, marginTop: 4 }}>
                Enter the meeting code or paste the link someone shared with you.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinExisting()}
                placeholder="e.g. amber-falcon-1234"
                style={{
                  flex: 1,
                  height: 44,
                  padding: "0 12px",
                  background: "#fff",
                  border: `1px solid ${T.border}`,
                  borderRadius: T.r3,
                  fontFamily: T.mono,
                  fontSize: 13,
                  color: T.ink,
                  outline: "none",
                  transition: "border-color 120ms ease",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = T.primary)}
                onBlur={(e) => (e.currentTarget.style.borderColor = T.border)}
              />
              <button
                onClick={joinExisting}
                disabled={!code.trim() || joining}
                style={{
                  height: 44,
                  padding: "0 16px",
                  background: code.trim() ? T.ink : T.surfaceAlt,
                  color: code.trim() ? T.primaryInk : T.ink4,
                  border: code.trim() ? "none" : `1px solid ${T.border}`,
                  borderRadius: T.r3,
                  fontFamily: T.sans,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: code.trim() ? "pointer" : "not-allowed",
                  transition: "background 120ms ease",
                }}
              >
                Join
              </button>
            </div>
          </div>
        </div>

        {/* Helper text */}
        <div
          style={{
            fontSize: 12,
            color: T.ink4,
            textAlign: "center",
            maxWidth: 560,
            lineHeight: 1.5,
          }}
        >
          Meetings are peer-routed through your LiveKit server. Everyone in the room can see each other&apos;s
          video and audio. Use the built-in controls to mute, toggle camera, or share your screen.
        </div>
      </main>
    </div>
  );
}
