/**
 * /meet — LiveKit Meet layout.
 *
 * This is the in-tree port of livekit-examples/meet. CSS imports here are
 * scoped to the /meet/* route segment by Next.js App Router — they do NOT
 * leak into /, /room, or /meet-lite.
 *
 * The lightweight cream-themed conferencing UI remains available at /meet-lite
 * as a backup.
 */

import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";

import "@livekit/components-styles";
import "@livekit/components-styles/prefabs";
import "@/styles/meet/meet-home.css";

export const metadata: Metadata = {
  title: "LiveKit Meet",
  description: "Open source video conferencing built on LiveKit.",
};

export const viewport: Viewport = {
  themeColor: "#070707",
};

export default function MeetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-lk-theme="default"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#111",
        color: "rgba(255,255,255,0.95)",
      }}
    >
      <Toaster />
      {children}
    </div>
  );
}
