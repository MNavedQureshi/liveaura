"use client";

/**
 * MeetRoom — wraps the LiveKit `<VideoConference />` prefab with:
 *   - token fetch from /api/token
 *   - a lightweight top bar showing room code + "Copy link" + "Leave"
 *   - graceful loading / error states
 *
 * The `<VideoConference />` prefab from @livekit/components-react renders
 * the full Zoom-style grid: tiled participant videos, mute/camera/screen-share
 * controls, chat panel, settings. Its dark theme is applied via the
 * @livekit/components-styles import in app/meet/layout.tsx.
 */

import { useCallback, useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from "@livekit/components-react";
import type { TokenResponse } from "@/lib/types";

export interface MeetRoomProps {
  room: string;
  name: string;
  onLeave: () => void;
}

export default function MeetRoom({ room, name, onLeave }: MeetRoomProps) {
  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Identity = display name + 4-char suffix so two people can share a
        // name without colliding. LiveKit uses identity as a unique key.
        const identity = `${name}-${Math.random().toString(36).slice(2, 6)}`;
        const res = await fetch("/api/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_name: room,
            identity,
            can_publish: true,
          }),
        });
        if (!res.ok) throw new Error(`Token request failed (${res.status})`);
        const data: TokenResponse = await res.json();
        if (!cancelled) setTokenData(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not connect");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [room, name]);

  const copyLink = useCallback(() => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(`${window.location.origin}/meet/${room}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }, [room]);

  if (error) {
    return (
      <div
        style={{
          minHeight: "100vh", background: "#0b0f1a", color: "#e2e8f0",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 16, padding: 24,
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600 }}>Could not join meeting</div>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>{error}</div>
        <button
          onClick={onLeave}
          style={{
            padding: "10px 18px", background: "#3F3A8C", color: "#fff",
            border: "none", borderRadius: 8, cursor: "pointer",
            fontWeight: 600, fontSize: 14,
          }}
        >
          Back to meet
        </button>
      </div>
    );
  }

  if (!tokenData) {
    return (
      <div
        style={{
          minHeight: "100vh", background: "#0b0f1a", color: "#e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <style>{`@keyframes spinB { to { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
          <div
            style={{
              width: 38, height: 38, borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.12)",
              borderTopColor: "#6b63d8",
              animation: "spinB 700ms linear infinite",
            }}
          />
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Joining meeting…</div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-lk-theme="default"
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--lk-bg, #0b0f1a)",
        overflow: "hidden",
      }}
    >
      <style>{`body { margin: 0; overflow: hidden; background: #0b0f1a; }`}</style>

      {/* Minimal top bar on top of the conference */}
      <div
        style={{
          position: "absolute", top: 12, left: 12, right: 12, zIndex: 5,
          display: "flex", alignItems: "center", gap: 8,
          pointerEvents: "none", // children re-enable individually
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            padding: "6px 10px",
            background: "rgba(16,22,38,0.72)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 999,
            backdropFilter: "blur(10px)",
            display: "inline-flex", alignItems: "center", gap: 8,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 11, color: "#cbd5e1",
          }}
        >
          <span
            style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "#ef4444",
              boxShadow: "0 0 8px #ef4444",
              animation: "spinB 0s",
            }}
          />
          LIVE · {room}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={copyLink}
          style={{
            pointerEvents: "auto",
            padding: "6px 12px",
            background: "rgba(16,22,38,0.72)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 999,
            backdropFilter: "blur(10px)",
            color: "#e2e8f0", fontSize: 12, fontWeight: 500,
            cursor: "pointer",
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {copied ? "✓ Link copied" : "Copy invite link"}
        </button>
      </div>

      <LiveKitRoom
        token={tokenData.token}
        serverUrl={tokenData.livekit_url || process.env.NEXT_PUBLIC_LIVEKIT_URL || ""}
        connect
        video
        audio
        onDisconnected={onLeave}
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
