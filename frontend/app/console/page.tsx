/**
 * /console — AI Calling Agent management console
 *
 * Renders the Orbital Console UI (pure vanilla React + Babel, in public/console/)
 * inside a full-screen iframe so it runs as its own document and doesn't inherit
 * Next.js global styles or the dark body background.
 */
export default function ConsolePage() {
  return (
    <>
      {/* Override the dark body background for this page only */}
      <style>{`
        html, body { margin: 0; padding: 0; background: transparent !important; overflow: hidden; }
      `}</style>

      <iframe
        src="/console/shell.html"
        title="AI Calling Agent Console"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "none",
        }}
      />
    </>
  );
}
