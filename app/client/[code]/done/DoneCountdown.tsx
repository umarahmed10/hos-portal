"use client";
import { useEffect, useState } from "react";
import { MUTED, BODY, MONO, BORDER, SUBTLE }   from "@/lib/styles";

interface Props {
  slug?: string | null;
  code?: string | null;
}

const REDIRECT_SECONDS = 30;

export function DoneCountdown({ slug, code }: Props) {
  const [count,        setCount]        = useState(REDIRECT_SECONDS);
  const [cancelled,    setCancelled]    = useState(false);
  const [resolvedSlug, setResolvedSlug] = useState(slug ?? null);

  useEffect(() => {
    if (!code || cancelled) return;

    // Establish session and resolve canonical slug
    fetch("/api/portal-session", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ slug: slug ?? undefined, code }),
    })
      .then(r => r.json())
      .then(json => {
        if (json.ok && json.data?.slug) {
          setResolvedSlug(json.data.slug);
        }
      })
      .catch(() => {});

    const id = setInterval(() => {
      setCount(n => {
        if (n <= 1) {
          clearInterval(id);
          const dest = resolvedSlug ?? slug;
          if (dest) window.location.href = `/portal/${dest}/status`;
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelled]);

  if (!slug && !code) {
    return (
      <p style={{ fontSize: 11, color: MUTED, fontFamily: BODY, textAlign: "center", marginBottom: 20 }}>
        You can close this window.
      </p>
    );
  }

  if (cancelled) {
    return (
      <p style={{ fontSize: 11, color: MUTED, fontFamily: MONO, textAlign: "center", marginBottom: 20, letterSpacing: "0.04em" }}>
        You can return to your portal at any time.
      </p>
    );
  }

  return (
    <div style={{ textAlign: "center", marginBottom: 20 }}>
      <p style={{ fontSize: 11, color: MUTED, fontFamily: MONO, margin: "0 0 8px", letterSpacing: "0.04em" }}>
        Redirecting to your portal in {count}s…
      </p>
      <button
        onClick={() => setCancelled(true)}
        style={{
          background:   "transparent",
          border:       `1px solid ${BORDER}`,
          color:        SUBTLE,
          borderRadius: 6,
          padding:      "5px 14px",
          fontSize:     11,
          cursor:       "pointer",
          fontFamily:   MONO,
          letterSpacing: "0.04em",
        }}
      >
        Stay on this page
      </button>
    </div>
  );
}
