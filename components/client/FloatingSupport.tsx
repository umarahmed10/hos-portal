"use client";
import { useState }    from "react";
import { SupportChat } from "./SupportChat";
import { BORDER }      from "@/lib/styles";

export function FloatingSupport({ slug, name }: { slug: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? "Close support" : "Get support"}
        style={{
          position:   "fixed", bottom: 24, right: 24,
          width: 52, height: 52, borderRadius: "50%",
          background:  open ? "#2A2A2A" : "#F3F1EC",
          color:       open ? "#F3F1EC" : "#111111",
          border:      `1px solid ${open ? BORDER : "transparent"}`,
          cursor:      "pointer", fontSize: 20, zIndex: 200,
          display:     "flex", alignItems: "center", justifyContent: "center",
          boxShadow:   "0 4px 24px rgba(0,0,0,0.4)",
          transition:  "background 200ms, color 200ms",
          minHeight:   52,
        }}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
      </button>

      {open && (
        <div style={{
          position:      "fixed", bottom: 86, right: 24,
          width:         "min(360px, calc(100vw - 48px))",
          height:        "min(520px, calc(100vh - 120px))",
          background:    "#1A1A1A", border: `1px solid ${BORDER}`,
          borderRadius:  14, overflow: "hidden", zIndex: 199,
          boxShadow:     "0 8px 48px rgba(0,0,0,0.5)",
          animation:     "scaleIn 200ms var(--ease-out) both",
          transformOrigin: "bottom right",
        }}>
          <SupportChat slug={slug} clientName={name} />
        </div>
      )}
    </>
  );
}
