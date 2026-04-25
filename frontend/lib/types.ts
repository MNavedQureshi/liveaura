export type CallType = "web" | "phone" | "whatsapp";

// "pipeline"    → Deepgram STT + LLM (Anthropic/Cerebras/Gemini/Groq) + Aura TTS
// "gemini_live" → single WebSocket to Gemini Live API (native voice in/out)
export type VoiceMode = "pipeline" | "gemini_live";

export interface CreateCallRequest {
  call_type: CallType;
  agent_name: string;
  prompt: string;
  presentation_script?: string;
  phone_number?: string;
  whatsapp_number?: string;
  greeting?: string;
  video_enabled: boolean;
  source_lang?: string;
  target_lang?: string;
  voice_mode?: VoiceMode;
}

export interface CallRecord {
  room_name: string;
  room_url: string;
  call_type: CallType;
  agent_name: string;
  status: "created" | "calling" | "invite_sent" | "active" | "ended";
  created_at: number;
  phone_number?: string;
  whatsapp_number?: string;
  sip_participant_id?: string;
  whatsapp_message_sid?: string;
}

export interface TokenResponse {
  token: string;
  livekit_url: string;
  room_name: string;
}
