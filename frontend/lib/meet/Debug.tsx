import * as React from 'react';
import { useRoomContext } from '@livekit/components-react';
import { setLogLevel, LogLevel, RemoteTrackPublication } from 'livekit-client';
// @ts-ignore
import { tinykeys } from 'tinykeys';

import styles from '@/styles/meet/Debug.module.css';

/**
 * Debug overlay panel — toggled with Shift+D.
 *
 * The upstream livekit-examples/meet version also forwards LiveKit client logs
 * to Datadog via `@datadog/browser-logs`. That was dropped here to keep the
 * dependency footprint small; we can re-add it behind env-gated imports if we
 * ever want to ship LiveKit client-side telemetry to Datadog.
 */

export const useDebugMode = ({ logLevel }: { logLevel?: LogLevel }) => {
  const room = useRoomContext();

  React.useEffect(() => {
    setLogLevel(logLevel ?? 'debug');

    // @ts-expect-error
    window.__lk_room = room;

    return () => {
      // @ts-expect-error
      window.__lk_room = undefined;
    };
  }, [room, logLevel]);
};

export const DebugMode = ({ logLevel }: { logLevel?: LogLevel }) => {
  const room = useRoomContext();
  const [isOpen, setIsOpen] = React.useState(false);
  const [, setRender] = React.useState({});
  const [roomSid, setRoomSid] = React.useState('');

  React.useEffect(() => {
    room.getSid().then(setRoomSid);
  }, [room]);

  useDebugMode({ logLevel });

  React.useEffect(() => {
    if (window) {
      const unsubscribe = tinykeys(window, {
        'Shift+D': () => {
          console.log('setting open');
          setIsOpen((open) => !open);
        },
      });

      // timer to re-render
      const interval = setInterval(() => {
        setRender({});
      }, 1000);

      return () => {
        unsubscribe();
        clearInterval(interval);
      };
    }
  }, [isOpen]);

  if (typeof window === 'undefined' || !isOpen) {
    return null;
  }

  const handleSimulate = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target;
    if (value == '') {
      return;
    }
    event.target.value = '';
    // @ts-expect-error
    room.simulateScenario(value);
  };
  void handleSimulate;

  const lp = room.localParticipant;

  return (
    <div className={styles.overlay}>
      <section id="room-info">
        <h3>
          Room Info {room.name}: {roomSid}
        </h3>
      </section>
      <details open>
        <summary>
          <b>Local Participant: {lp.identity}</b>
        </summary>
        <details open className={styles.detailsSection}>
          <summary>
            <b>Published tracks</b>
          </summary>
          <div>
            {Array.from(lp.trackPublications.values()).map((t) => (
              <React.Fragment key={t.trackSid}>
                <div>
                  <i>
                    {t.source.toString()}
                    &nbsp;<span>{t.trackSid}</span>
                  </i>
                </div>
                <table>
                  <tbody>
                    <tr>
                      <td>Kind</td>
                      <td>
                        {t.kind}&nbsp;
                        {t.kind === 'video' && (
                          <span>
                            {t.track?.dimensions?.width}x{t.track?.dimensions?.height}
                          </span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>Bitrate</td>
                      <td>{t.track ? Math.ceil(t.track.currentBitrate / 1000) : 0} kbps</td>
                    </tr>
                  </tbody>
                </table>
              </React.Fragment>
            ))}
          </div>
        </details>
        <details open className={styles.detailsSection}>
          <summary>
            <b>Permissions</b>
          </summary>
          <div>
            <table>
              <tbody>
                {lp.permissions &&
                  Object.entries(lp.permissions).map(([key, val]) => (
                    <tr key={key}>
                      <td>{key}</td>
                      {key !== 'canPublishSources' ? (
                        <td>{(val as any).toString()}</td>
                      ) : (
                        <td> {(val as any[]).join(', ')} </td>
                      )}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      </details>

      <details>
        <summary>
          <b>Remote Participants</b>
        </summary>
        {Array.from(room.remoteParticipants.values()).map((p) => (
          <details key={p.sid} className={styles.detailsSection}>
            <summary>
              <b>
                {p.identity}
                <span></span>
              </b>
            </summary>
            <div>
              {Array.from(p.trackPublications.values()).map((t) => (
                <React.Fragment key={t.trackSid}>
                  <div>
                    <i>
                      {t.source.toString()}
                      &nbsp;<span>{t.trackSid}</span>
                    </i>
                  </div>
                  <table>
                    <tbody>
                      <tr>
                        <td>Kind</td>
                        <td>
                          {t.kind}&nbsp;
                          {t.kind === 'video' && (
                            <span>
                              {t.dimensions?.width}x{t.dimensions?.height}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>Status</td>
                        <td>{trackStatus(t)}</td>
                      </tr>
                      {t.track && (
                        <tr>
                          <td>Bitrate</td>
                          <td>{Math.ceil(t.track.currentBitrate / 1000)} kbps</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </React.Fragment>
              ))}
            </div>
          </details>
        ))}
      </details>
    </div>
  );
};

function trackStatus(t: RemoteTrackPublication): string {
  if (t.isSubscribed) {
    return t.isEnabled ? 'enabled' : 'disabled';
  } else {
    return 'unsubscribed';
  }
}
