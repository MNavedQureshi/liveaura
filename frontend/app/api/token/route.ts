import { AccessToken, VideoGrant } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";
const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";

export async function POST(req: NextRequest) {
  const { room_name, identity, can_publish = true } = await req.json();

  if (!room_name || !identity) {
    return NextResponse.json({ error: "room_name and identity required" }, { status: 400 });
  }

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name: identity,
    ttl: "1h",
  });

  token.addGrant({
    roomJoin: true,
    room: room_name,
    canPublish: can_publish,
    canSubscribe: true,
  } satisfies VideoGrant);

  return NextResponse.json({
    token: await token.toJwt(),
    livekit_url: LIVEKIT_URL,
    room_name,
  });
}
