"use client";
import { useEffect } from "react";
import { BODY, BORDER, MUTED, SURF, TEXT } from "@/lib/styles";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div style={{ padding: "60px 20px", textAlign: "center" }}>
      <div style={{
        background:   SURF,
        border:       `1px solid ${BORDER}`,
        borderRadius: 12,
        padding:      "36px 28px",
        maxWidth:     400,
        margin:       "0 auto",
      }}>
        <div style={{ fontFamily: BODY, fontSize: 13, color: MUTED, marginBottom: 16 }}>
          Something went wrong loading this page.
        </div>
        <button
          onClick={reset}
          style={{
            background:   TEXT,
            color:        "#111111",
            border:       "none",
            borderRadius: 8,
            padding:      "12px 28px",
            fontSize:     13,
            fontWeight:   600,
            cursor:       "pointer",
            fontFamily:   BODY,
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
