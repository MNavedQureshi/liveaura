"use client";

import { useState } from "react";
import { Mic, Phone, Video, Globe, Zap, MessageCircle, Plus } from "lucide-react";
import CallLauncher from "@/components/CallLauncher";
import ActiveCalls from "@/components/ActiveCalls";
import type { CallRecord } from "@/lib/types";

const FEATURES = [
  { icon: <Globe className="w-5 h-5" />, title: "Web Calls", desc: "Share a link — anyone joins instantly in-browser, no app needed" },
  { icon: <Phone className="w-5 h-5" />, title: "Phone Calls", desc: "Agent dials any phone number directly via SIP trunk" },
  { icon: <MessageCircle className="w-5 h-5" />, title: "WhatsApp", desc: "Sends an invite link via WhatsApp to reach contacts" },
  { icon: <Video className="w-5 h-5" />, title: "Video Support", desc: "Enable video for presentations with screen share" },
  { icon: <Zap className="w-5 h-5" />, title: "Custom Prompts", desc: "Give the AI any persona, script, or sales deck to deliver" },
  { icon: <Mic className="w-5 h-5" />, title: "Natural Voice", desc: "Real-time STT → Claude LLM → Cartesia TTS pipeline" },
];

export default function HomePage() {
  const [showLauncher, setShowLauncher] = useState(false);
  const [recentCall, setRecentCall] = useState<CallRecord | null>(null);

  const handleCallCreated = (call: CallRecord) => {
    setRecentCall(call);
    setShowLauncher(false);
  };

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Mic className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white text-lg">AI Calling Agent</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/console"
            className="flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white text-sm font-medium rounded-xl hover:bg-white/10 transition-colors"
          >
            Console
          </a>
          <button
            onClick={() => setShowLauncher(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Call
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-4xl mx-auto px-6 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full text-sm text-slate-400 mb-8">
          <Zap className="w-3.5 h-3.5 text-brand-500" />
          Powered by LiveKit · Claude AI · Deepgram · Cartesia
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
          AI Agent That Makes{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-purple-400">
            Real Calls
          </span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
          Launch an AI voice agent that calls people via web link, phone number, or WhatsApp.
          Give it any prompt — sales pitch, presentation, support script — and let it talk.
        </p>
        <button
          onClick={() => setShowLauncher(true)}
          className="inline-flex items-center gap-3 px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-2xl transition-colors text-lg"
        >
          <Mic className="w-5 h-5" />
          Launch Your AI Agent
        </button>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          {FEATURES.map((f, i) => (
            <div key={i} className="glass glass-hover rounded-xl p-5">
              <div className="w-10 h-10 rounded-xl bg-brand-600/20 flex items-center justify-center text-brand-400 mb-3">
                {f.icon}
              </div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Active Calls */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Active Calls</h2>
            <button
              onClick={() => setShowLauncher(true)}
              className="flex items-center gap-1.5 text-sm text-brand-400 hover:text-brand-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Call
            </button>
          </div>
          <ActiveCalls />
        </div>

        {/* Recent call banner */}
        {recentCall && (
          <div className="mt-4 p-4 glass rounded-xl border border-brand-500/30 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">
                Call launched: {recentCall.agent_name}
              </p>
              {recentCall.call_type === "web" && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Share:{" "}
                  <a
                    href={recentCall.room_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-400 hover:underline font-mono"
                  >
                    {recentCall.room_url}
                  </a>
                </p>
              )}
              {recentCall.call_type === "phone" && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Calling {recentCall.phone_number}…
                </p>
              )}
              {recentCall.call_type === "whatsapp" && (
                <p className="text-xs text-slate-400 mt-0.5">
                  WhatsApp invite sent to {recentCall.whatsapp_number}
                </p>
              )}
            </div>
            <a
              href={`/room/${recentCall.room_name}`}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-xl transition-colors"
            >
              Join Room
            </a>
          </div>
        )}
      </div>

      {showLauncher && (
        <CallLauncher
          onCallCreated={handleCallCreated}
          onClose={() => setShowLauncher(false)}
        />
      )}
    </div>
  );
}
