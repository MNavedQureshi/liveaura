/**
 * Meet layout — scopes @livekit/components-styles to the /meet/* segment only.
 *
 * The AI call room (/room/[roomId]) explicitly avoids this CSS because it
 * clashes with its custom cream/indigo palette. Next.js App Router only
 * loads CSS imported by a layout when that segment is active, so importing
 * it here keeps the two experiences isolated.
 */
import "@livekit/components-styles";

export const metadata = {
  title: "LiveKit Meet",
  description: "Zoom-style multi-party audio & video conferencing",
};

export default function MeetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
