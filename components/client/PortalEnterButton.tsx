"use client";
import { useState } from "react";
import { toast }    from "sonner";
import { css, UI }  from "@/lib/styles";

interface Props {
  slug: string;
  code: string;
  style?: React.CSSProperties;
}

export function PortalEnterButton({ slug, code, style }: Props) {
  const [loading, setLoading] = useState(false);

  async function enter() {
    setLoading(true);
    try {
      const res  = await fetch("/api/portal-session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ slug, code }),
      });
      const json = await res.json();
      if (json.ok && json.data?.slug) {
        window.location.href = `/portal/${json.data.slug}/status`;
        return;
      }
      // Fallback: redirect using the slug we know
      window.location.href = `/portal/${slug}/status`;
    } catch {
      toast.error("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={enter}
      disabled={loading}
      style={{
        ...css.btnP,
        width:         "100%",
        justifyContent: "center",
        display:       "inline-flex",
        padding:       "15px 44px",
        fontSize:      15,
        fontFamily:    UI,
        fontWeight:    600,
        letterSpacing: "0.04em",
        opacity:       loading ? 0.6 : 1,
        cursor:        loading ? "not-allowed" : "pointer",
        ...style,
      }}
    >
      {loading ? "Opening…" : "Enter my portal →"}
    </button>
  );
}
