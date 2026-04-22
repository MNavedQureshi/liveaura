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
  agentName,
  onDisconnect,
}: Props) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between bg-black/30">
        <div className="flex items-center gap-3">
          <div className="relative w-2.5 h-2.5">
            <span className="absolute inset-0 rounded-full bg-green-500 call-pulse" />
            <span className="relative block w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <span className="text-sm font-medium text-white">Live — {agentName}</span>
        </div>
        <span className="text-xs text-slate-500 font-mono">{roomName}</span>
      </div>

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
        <ControlBar className="border-t border-white/10" />
      </LiveKitRoom>
    </div>
  );
}
