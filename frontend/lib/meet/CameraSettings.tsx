import React from 'react';
import {
  MediaDeviceMenu,
  TrackReference,
  TrackToggle,
  useLocalParticipant,
  VideoTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';

/**
 * Camera settings pane.
 *
 * Note: the upstream livekit-examples/meet version also exposes background
 * blur / virtual background selectors powered by `@livekit/track-processors`
 * plus bundled sample images. Those were intentionally dropped here to keep
 * the dependency footprint small — we can re-enable background processors
 * later by adding `@livekit/track-processors` and wiring in image assets.
 */
export function CameraSettings() {
  const { cameraTrack, localParticipant } = useLocalParticipant();

  const camTrackRef: TrackReference | undefined = React.useMemo(() => {
    return cameraTrack
      ? { participant: localParticipant, publication: cameraTrack, source: Track.Source.Camera }
      : undefined;
  }, [localParticipant, cameraTrack]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {camTrackRef && (
        <VideoTrack
          style={{
            maxHeight: '280px',
            objectFit: 'contain',
            objectPosition: 'right',
            transform: 'scaleX(-1)',
          }}
          trackRef={camTrackRef}
        />
      )}

      <section className="lk-button-group">
        <TrackToggle source={Track.Source.Camera}>Camera</TrackToggle>
        <div className="lk-button-group-menu">
          <MediaDeviceMenu kind="videoinput" />
        </div>
      </section>
    </div>
  );
}
