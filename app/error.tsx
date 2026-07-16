"use client";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#111111", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "40px 24px" }}>
          <div style={{ color: "#727272", fontSize: 13, fontFamily: "sans-serif", marginBottom: 20 }}>
            An unexpected error occurred.
          </div>
          <button
            onClick={reset}
            style={{
              background:   "#F3F1EC",
              color:        "#111111",
              border:       "none",
              borderRadius: 8,
              padding:      "12px 28px",
              fontSize:     13,
              fontWeight:   600,
              cursor:       "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
