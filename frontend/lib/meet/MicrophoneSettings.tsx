import React from 'react';
import { TrackToggle, MediaDeviceMenu } from '@livekit/components-react';
import { Track } from 'livekit-client';

/**
 * Microphone settings pane.
 *
 * Note: the upstream livekit-examples/meet version bundles Krisp noise
 * cancellation via `@livekit/components-react/krisp` + `@livekit/krisp-noise-filter`.
 * That was dropped here to avoid the extra dependency; browsers already apply
 * echoCancellation + noiseSuppression by default on getUserMedia.
 */
export function MicrophoneSettings() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '10px',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <section className="lk-button-group">
        <TrackToggle source={Track.Source.Microphone}>Microphone</TrackToggle>
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="audioinput" />
        </div>
      </section>
    </div>
  );
}
