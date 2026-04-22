import type { CallRecord, CreateCallRequest, TokenResponse } from "./types";

const API_BASE = "/api";

export async function createCall(req: CreateCallRequest): Promise<CallRecord> {
  const res = await fetch(`${API_BASE}/calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function listCalls(): Promise<CallRecord[]> {
  const res = await fetch(`${API_BASE}/calls`);
  if (!res.ok) return [];
  return res.json();
}

export async function endCall(roomName: string): Promise<void> {
  await fetch(`${API_BASE}/calls/${roomName}`, { method: "DELETE" });
}

export async function getToken(
  roomName: string,
  identity: string
): Promise<TokenResponse> {
  const res = await fetch(`${API_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ room_name: roomName, identity }),
  });
  if (!res.ok) throw new Error("Failed to get token");
  return res.json();
}
