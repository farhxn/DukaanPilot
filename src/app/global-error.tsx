"use client";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body style={{ fontFamily: "system-ui", margin: "48px auto", padding: 24, maxWidth: 600 }}><h1>Your workspace is temporarily unavailable.</h1><p>No action should be assumed saved from this screen. Check your records before repeating a financial action.</p><button onClick={reset} style={{ padding: 12 }}>Try again</button><p>If this continues, contact your business support contact.</p></body></html>;
}
