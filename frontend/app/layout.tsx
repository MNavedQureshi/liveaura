import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Calling Agent",
  description: "Launch AI-powered audio and video calls via web, phone, or WhatsApp",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
