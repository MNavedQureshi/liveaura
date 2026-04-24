/**
 * Meet Lite layout — scopes @livekit/components-styles to the /meet-lite/* segment only.
 *
 * This is the lightweight, custom cream-themed conferencing flow kept as a backup
 * alongside the full upstream LiveKit Meet port at /meet.
 */
import "@livekit/components-styles";

export const metadata = {
  title: "Meet Lite",
  description: "Lightweight cream-themed video conferencing (backup)",
};

export default function MeetLiteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
