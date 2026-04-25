"use client";

import { useState } from "react";
import { Phone, Video, MessageCircle, Globe, Mic, ChevronDown, ChevronUp, Loader2, X, Zap } from "lucide-react";
import type { CallRecord, CallType, CreateCallRequest, VoiceMode } from "@/lib/types";
import { createCall } from "@/lib/api";
import { useRouter } from "next/navigation";

const CALL_TYPES: { value: CallType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "web", label: "Web Link", icon: <Globe className="w-5 h-5" />, desc: "Share a link — anyone can join" },
  { value: "phone", label: "Phone Call", icon: <Phone className="w-5 h-5" />, desc: "Call a phone number via SIP" },
  { value: "whatsapp", label: "WhatsApp", icon: <MessageCircle className="w-5 h-5" />, desc: "Send invite via WhatsApp" },
];

const PROMPT_PRESETS = [
  { label: "Sales Pitch", value: "You are a professional sales representative. Introduce the product clearly, highlight key benefits, address objections politely, and guide the prospect toward a next step." },
  { label: "Customer Support", value: "You are a helpful customer support agent. Listen to the customer's issue patiently, ask clarifying questions if needed, and resolve their problem or escalate appropriately." },
  { label: "Survey / Interview", value: "You are conducting a brief survey. Ask questions one at a time, wait for responses, acknowledge answers, and wrap up warmly when done." },
  { label: "Appointment Reminder", value: "You are reminding the person about their upcoming appointment. Confirm details, offer to reschedule if needed, and answer any questions they have." },
  { label: "Custom", value: "" },
];

interface Props {
  onCallCreated: (call: CallRecord) => void;
  onClose: () => void;
}

export default function CallLauncher({ onCallCreated, onClose }: Props) {
  const router = useRouter();
  const [callType, setCallType] = useState<CallType>("web");
  const [agentName, setAgentName] = useState("AI Assistant");
  const [prompt, setPrompt] = useState(PROMPT_PRESETS[0].value);
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [presentationScript, setPresentationScript] = useState("");
  const [showPresentation, setShowPresentation] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("en");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("pipeline");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePreset = (idx: number) => {
    setSelectedPreset(idx);
    if (PROMPT_PRESETS[idx].value) setPrompt(PROMPT_PRESETS[idx].value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const req: CreateCallRequest = {
      call_type: callType,
      agent_name: agentName,
      prompt,
      presentation_script: showPresentation ? presentationScript : undefined,
      phone_number: callType === "phone" ? phoneNumber : undefined,
      whatsapp_number: callType === "whatsapp" ? whatsappNumber : undefined,
      video_enabled: videoEnabled,
      source_lang: sourceLang,
      target_lang: targetLang,
      voice_mode: voiceMode,
    };

    try {
      const call = await createCall(req);
      onCallCreated(call);
      router.push(`/room/${call.room_name}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create call");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-white">Launch AI Call</h2>
            <p className="text-sm text-slate-400 mt-0.5">Configure your AI calling agent</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Call Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Call Channel</label>
            <div className="grid grid-cols-3 gap-3">
              {CALL_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  type="button"
                  onClick={() => setCallType(ct.value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-sm ${
                    callType === ct.value
                      ? "bg-brand-600/20 border-brand-500 text-brand-500"
                      : "glass-hover glass border-white/10 text-slate-400"
                  }`}
                >
                  {ct.icon}
                  <span className="font-medium">{ct.label}</span>
                  <span className="text-xs text-center leading-tight opacity-70">{ct.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Phone / WhatsApp number */}
          {callType === "phone" && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 000-0000"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
          )}

          {callType === "whatsapp" && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">WhatsApp Number</label>
              <input
                type="tel"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="+1 (555) 000-0000"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
              />
              <p className="text-xs text-slate-500 mt-1.5">
                We will send a WhatsApp message with the call link to this number.
              </p>
            </div>
          )}

          {/* Agent Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Agent Name</label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="AI Assistant"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Agent Prompt / Behavior</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {PROMPT_PRESETS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePreset(i)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    selectedPreset === i
                      ? "bg-brand-600/20 border-brand-500 text-brand-400"
                      : "border-white/10 text-slate-400 hover:border-white/20"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what the AI agent should do and how it should behave..."
              rows={4}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors resize-none"
            />
          </div>

          {/* Presentation Script */}
          <div>
            <button
              type="button"
              onClick={() => setShowPresentation(!showPresentation)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              {showPresentation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Add Presentation Script (optional)
            </button>
            {showPresentation && (
              <textarea
                value={presentationScript}
                onChange={(e) => setPresentationScript(e.target.value)}
                placeholder="Enter the script or presentation content the AI should deliver..."
                rows={6}
                className="mt-3 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors resize-none"
              />
            )}
          </div>

          {/* Voice backend */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Voice Engine</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVoiceMode("pipeline")}
                className={`flex flex-col items-start gap-1 p-4 rounded-xl border transition-all text-left ${
                  voiceMode === "pipeline"
                    ? "bg-brand-600/20 border-brand-500 text-brand-500"
                    : "glass-hover glass border-white/10 text-slate-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  <span className="font-medium text-sm">Standard Pipeline</span>
                </div>
                <span className="text-xs opacity-70 leading-tight">
                  Deepgram STT → LLM → Aura TTS. Stable, swap any LLM provider.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setVoiceMode("gemini_live")}
                className={`flex flex-col items-start gap-1 p-4 rounded-xl border transition-all text-left ${
                  voiceMode === "gemini_live"
                    ? "bg-brand-600/20 border-brand-500 text-brand-500"
                    : "glass-hover glass border-white/10 text-slate-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span className="font-medium text-sm">Gemini Live (beta)</span>
                </div>
                <span className="text-xs opacity-70 leading-tight">
                  Single WebSocket: native voice in/out. Lower latency, ~10 min/session.
                </span>
              </button>
            </div>
          </div>

          {/* Video toggle */}
          <div className="flex items-center justify-between p-4 glass rounded-xl">
            <div className="flex items-center gap-3">
              <Video className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-white">Enable Video</p>
                <p className="text-xs text-slate-500">Allow video in the call (web only)</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setVideoEnabled(!videoEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                videoEnabled ? "bg-brand-600" : "bg-white/10"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  videoEnabled ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Launching Agent...
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                Launch AI Agent
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
