"use client";

/**
 * /meet — LiveKit Meet landing page.
 *
 * Ported from livekit-examples/meet with two adjustments for in-tree use:
 *   1. Routes nested under /meet instead of the upstream repo root
 *      (e.g. /meet/rooms/<id> instead of /rooms/<id>).
 *   2. The Custom-token tab was omitted to keep the surface area small —
 *      all meetings use our own /api/meet/connection-details endpoint.
 *
 * The cream-themed alternative still lives at /meet-lite.
 */

import { useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useState } from "react";
import { encodePassphrase, generateRoomId, randomString } from "@/lib/meet/client-utils";
import styles from "@/styles/meet/Home.module.css";

function Tabs(props: React.PropsWithChildren<{}>) {
  const searchParams = useSearchParams();
  const tabIndex = searchParams?.get("tab") === "custom" ? 1 : 0;

  const router = useRouter();
  function onTabSelected(index: number) {
    const tab = index === 1 ? "custom" : "demo";
    router.push(`/meet?tab=${tab}`);
  }

  const childrenArr = React.Children.toArray(props.children);

  const tabs = childrenArr.map((child, index) => (
    <button
      key={index}
      className="lk-button"
      onClick={() => onTabSelected(index)}
      aria-pressed={tabIndex === index}
    >
      {/* @ts-ignore */}
      {child?.props?.label}
    </button>
  ));

  return (
    <div className={styles.tabContainer}>
      <div className={styles.tabSelect}>{tabs}</div>
      {childrenArr[tabIndex] ?? null}
    </div>
  );
}

function DemoMeetingTab(_props: { label: string }) {
  const router = useRouter();
  const [e2ee, setE2ee] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));
  const startMeeting = () => {
    if (e2ee) {
      router.push(`/meet/rooms/${generateRoomId()}#${encodePassphrase(sharedPassphrase)}`);
    } else {
      router.push(`/meet/rooms/${generateRoomId()}`);
    }
  };
  return (
    <div className={styles.tabContent}>
      <p style={{ margin: 0 }}>Start an instant meeting. Share the link that appears after &ldquo;Start Meeting.&rdquo;</p>
      <button style={{ marginTop: "1rem" }} className="lk-button" onClick={startMeeting}>
        Start Meeting
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "row", gap: "1rem" }}>
          <input
            id="use-e2ee"
            type="checkbox"
            checked={e2ee}
            onChange={(ev) => setE2ee(ev.target.checked)}
          />
          <label htmlFor="use-e2ee">Enable end-to-end encryption</label>
        </div>
        {e2ee && (
          <div style={{ display: "flex", flexDirection: "row", gap: "1rem" }}>
            <label htmlFor="passphrase">Passphrase</label>
            <input
              id="passphrase"
              type="password"
              value={sharedPassphrase}
              onChange={(ev) => setSharedPassphrase(ev.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function JoinMeetingTab(_props: { label: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");

  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const slug = normalize(code);
    if (!slug) return;
    router.push(`/meet/rooms/${slug}`);
  };

  return (
    <form className={styles.tabContent} onSubmit={onSubmit}>
      <p style={{ marginTop: 0 }}>Enter the room code or paste the shared link path.</p>
      <input
        id="roomCode"
        name="roomCode"
        type="text"
        placeholder="e.g. amber-falcon"
        value={code}
        onChange={(ev) => setCode(ev.target.value)}
        required
      />
      <hr
        style={{ width: "100%", borderColor: "rgba(255, 255, 255, 0.15)", marginBlock: "1rem" }}
      />
      <button
        style={{ paddingInline: "1.25rem", width: "100%" }}
        className="lk-button"
        type="submit"
      >
        Join
      </button>
    </form>
  );
}

export default function Page() {
  return (
    <>
      <main className={styles.main} data-lk-theme="default">
        <div className="lk-meet-header">
          <h1
            style={{
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: -1,
              lineHeight: 1.1,
              margin: "2rem 0 0",
              textAlign: "center",
              color: "#fff",
            }}
          >
            LiveKit Meet
          </h1>
          <h2>
            Open source video conferencing built on{" "}
            <a href="https://github.com/livekit/components-js?ref=meet" rel="noopener noreferrer" target="_blank">
              LiveKit&nbsp;Components
            </a>{" "}
            and Next.js. Lightweight cream-themed variant at{" "}
            <a href="/meet-lite">/meet-lite</a>.
          </h2>
        </div>
        <Suspense fallback="Loading">
          <Tabs>
            <DemoMeetingTab label="New meeting" />
            <JoinMeetingTab label="Join with code" />
          </Tabs>
        </Suspense>
      </main>
      <footer className="lk-meet-footer" data-lk-theme="default">
        Powered by{" "}
        <a href="https://livekit.io/cloud?ref=meet" rel="noopener noreferrer" target="_blank">
          LiveKit
        </a>
        . Forked from{" "}
        <a href="https://github.com/livekit/meet?ref=meet" rel="noopener noreferrer" target="_blank">
          livekit-examples/meet
        </a>
        .
      </footer>
    </>
  );
}
