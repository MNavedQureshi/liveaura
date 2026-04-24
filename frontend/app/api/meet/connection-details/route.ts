import { randomString } from "@/lib/meet/client-utils";
import { getLiveKitURL } from "@/lib/meet/getLiveKitURL";
import { ConnectionDetails } from "@/lib/meet/types";
import { AccessToken, AccessTokenOptions, VideoGrant } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/meet/connection-details?roomName=...&participantName=...[&region=...][&metadata=...]
 *
 * Port of upstream livekit-examples/meet connection-details endpoint.
 * Returns a short-lived token + serverUrl suitable for joining a room.
 *
 * NOTE: the existing /api/token (POST) endpoint used by /room and /meet-lite
 * is left untouched — both endpoints can coexist.
 */

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
// Prefer the server-only LIVEKIT_URL; fall back to the public one so existing
// single-env deployments keep working without adding a new variable.
const LIVEKIT_URL = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;

const COOKIE_KEY = "random-participant-postfix";

export async function GET(request: NextRequest) {
  try {
    const roomName = request.nextUrl.searchParams.get("roomName");
    const participantName = request.nextUrl.searchParams.get("participantName");
    const metadata = request.nextUrl.searchParams.get("metadata") ?? "";
    const region = request.nextUrl.searchParams.get("region");

    if (!LIVEKIT_URL) {
      throw new Error("LIVEKIT_URL is not defined");
    }
    if (!API_KEY || !API_SECRET) {
      throw new Error("LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not defined");
    }

    const livekitServerUrl = region ? getLiveKitURL(LIVEKIT_URL, region) : LIVEKIT_URL;
    let randomParticipantPostfix = request.cookies.get(COOKIE_KEY)?.value;
    if (livekitServerUrl === undefined) {
      throw new Error("Invalid region");
    }

    if (typeof roomName !== "string") {
      return new NextResponse("Missing required query parameter: roomName", { status: 400 });
    }
    if (participantName === null) {
      return new NextResponse("Missing required query parameter: participantName", { status: 400 });
    }

    if (!randomParticipantPostfix) {
      randomParticipantPostfix = randomString(4);
    }
    const participantToken = await createParticipantToken(
      {
        identity: `${participantName}__${randomParticipantPostfix}`,
        name: participantName,
        metadata,
      },
      roomName,
    );

    const data: ConnectionDetails = {
      serverUrl: livekitServerUrl,
      roomName,
      participantToken,
      participantName,
    };
    return new NextResponse(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `${COOKIE_KEY}=${randomParticipantPostfix}; Path=/; HttpOnly; SameSite=Strict; Secure; Expires=${getCookieExpirationTime()}`,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      return new NextResponse(error.message, { status: 500 });
    }
    return new NextResponse("Unknown error", { status: 500 });
  }
}

function createParticipantToken(userInfo: AccessTokenOptions, roomName: string) {
  const at = new AccessToken(API_KEY, API_SECRET, userInfo);
  at.ttl = "5m";
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);
  return at.toJwt();
}

function getCookieExpirationTime(): string {
  const now = new Date();
  const time = now.getTime();
  const expireTime = time + 60 * 120 * 1000;
  now.setTime(expireTime);
  return now.toUTCString();
}
