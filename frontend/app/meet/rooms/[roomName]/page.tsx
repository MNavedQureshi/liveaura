import * as React from "react";
import { PageClientImpl } from "./PageClientImpl";
import { isVideoCodec } from "@/lib/meet/types";

/**
 * Server component for /meet/rooms/[roomName].
 *
 * Next.js 14 uses sync `params` / `searchParams`. Upstream livekit-examples/meet
 * targets Next.js 15 which made these Promises, so this file drops the `await`s
 * from the upstream version.
 */
export default function Page({
  params,
  searchParams,
}: {
  params: { roomName: string };
  searchParams: {
    region?: string;
    hq?: string;
    codec?: string;
    singlePC?: string;
  };
}) {
  const codec =
    typeof searchParams.codec === "string" && isVideoCodec(searchParams.codec)
      ? searchParams.codec
      : "vp9";
  const hq = searchParams.hq === "true";
  const singlePC = searchParams.singlePC !== "false";

  return (
    <PageClientImpl
      roomName={params.roomName}
      region={searchParams.region}
      hq={hq}
      codec={codec}
      singlePeerConnection={singlePC}
    />
  );
}
