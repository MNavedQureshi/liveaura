"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertCircle, ArrowLeft, Copy, Check } from "lucide-react";
import CallRoom from "@/components/CallRoom";
import type { TokenResponse } from "@/lib/types";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [tokenData, setTokenData] = useState<TokenResponse | null>(null);
  const [callMeta, setCallMeta] = useState<{ agent_name?: string; video_enabled?: boolean } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const identity = `user-${Math.random().toString(36).slice(2, 8)}`;

    const init = async () => {
      try {
        // Fetch call metadata
        const metaRes = await fetch(`/api/calls/${roomId}`).catch(() => null);
        if (metaRes?.ok) {
          const meta = await metaRes.json();
          setCallMeta({ agent_name: meta.agent_name, video_enabled: meta.video_enabled });
        }

        // Get token — try backend first, fall back to Next.js API route
        const tokenRes = await fetch(`/api/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_name: roomId, identity }),
        });
        if (!tokenRes.ok) throw new Error("Failed to get access token");
        const data: TokenResponse = await tokenRes.json();
        setTokenData(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Could not connect to room");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [roomId]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-brand-500 mx-auto" />
          <p className="text-slate-400">Connecting to AI Agent…</p>
        </div>
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-semibold text-white">Could not connect</h2>
          <p className="text-slate-400 text-sm">{error || "Room not found or token expired."}</p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl transition-colors w-full"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between bg-black/20">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </button>
        <button
          onClick={copyLink}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>

      {/* Room */}
      <div className="flex-1">
        <CallRoom
          token={tokenData.token}
          serverUrl={tokenData.livekit_url || process.env.NEXT_PUBLIC_LIVEKIT_URL || ""}
          roomName={roomId}
          videoEnabled={callMeta?.video_enabled ?? false}
          agentName={callMeta?.agent_name ?? "AI Assistant"}
          onDisconnect={() => router.push("/")}
        />
      </div>
    </div>
  );
}
