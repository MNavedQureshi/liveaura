export type CallType = "web" | "phone" | "whatsapp";

export interface CreateCallRequest {
  call_type: CallType;
  agent_name: string;
  prompt: string;
  presentation_script?: string;
  phone_number?: string;
  whatsapp_number?: string;
  greeting?: string;
  video_enabled: boolean;
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
