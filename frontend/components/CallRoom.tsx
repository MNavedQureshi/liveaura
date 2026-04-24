"use client";

import {
  AudioConference,
  ControlBar,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  VideoConference,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";

interface Props {
  token: string;
  serverUrl: string;
  roomName: string;
  videoEnabled: boolean;
  agentName: string;
  onDisconnect: () => void;
}

function VideoLayout() {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
  return (
    <GridLayout tracks={tracks} className="h-full w-full">
      <ParticipantTile />
    </GridLayout>
  );
}

export default function CallRoom({
  token,
  serverUrl,
  roomName,
  videoEnabled,
  onDisconnect,
}: Props) {
  return (
    /*
     * Outer div fills the space given by the room page.
     * CSS variables here override LiveKit's default dark theme so the
     * control bar and participant tiles blend with the console palette.
     */
    <div
      className="h-full flex flex-col"
      style={
        {
          "--lk-theme-color":       "63, 58, 140",   /* indigo RGB */
          "--lk-bg":                "#F7F3EA",
          "--lk-bg2":               "#FDFBF5",
          "--lk-bg3":               "#EFE9DA",
          "--lk-border":            "#E4DBC5",
          "--lk-fg":                "#2A231A",
          "--lk-fg2":               "#554937",
          "--lk-control-bar-bg":    "#FDFBF5",
          "--lk-control-bar-height":"60px",
        } as React.CSSProperties
      }
    >
      <LiveKitRoom
        video={videoEnabled}
        audio={true}
        token={token}
        serverUrl={serverUrl}
        className="flex-1 flex flex-col"
        onDisconnected={onDisconnect}
        data-lk-theme="default"
      >
        <div className="flex-1 overflow-hidden">
          {videoEnabled ? <VideoConference /> : <AudioConference />}
        </div>
        <RoomAudioRenderer />
        {/* Control bar sits at the bottom of the call area */}
        <ControlBar
          style={{
            borderTop: "1px solid #E4DBC5",
            background: "#FDFBF5",
          }}
        />
      </LiveKitRoom>
    </div>
  );
}
