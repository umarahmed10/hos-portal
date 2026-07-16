"use client";
// Done-page status checklist — first 3 items fade in staggered, the 4th
// shows a spinning ring that resolves to a checkmark after 2000ms.
import { useState, useEffect } from "react";
import { BODY, GREEN, GREEN_DIM, GREEN_BORDER, GOLD, GOLD_BORDER, TEXT, BORDER } from "@/lib/styles";

const ITEMS = [
  "Service agreement executed",
  "Campaign queue initialized",
  "Account provisioning",
];

const STAGGER = [0, 200, 400, 600];

export function SetupChecklist() {
  const [visible, setVisible]   = useState<number[]>([]);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    ITEMS.forEach((_, i) => {
      setTimeout(() => setVisible(v => [...v, i]), STAGGER[i]);
    });
    const t = setTimeout(() => setResolved(true), STAGGER[3] + 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div>
      {ITEMS.map((label, i) => {
        const isLast    = i === ITEMS.length - 1;
        const isShown   = visible.includes(i);
        const isPending = isLast && !resolved;
        return (
          <div
            key={label}
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          12,
              padding:      "9px 0",
              borderBottom: i < ITEMS.length - 1 ? `1px solid ${BORDER}` : "none",
              opacity:      isShown ? 1 : 0,
              transform:    isShown ? "translateX(0)" : "translateX(-10px)",
              transition:   "opacity 300ms ease, transform 300ms ease",
            }}
          >
            <div style={{
              width:          26,
              height:         26,
              borderRadius:   "50%",
              background:     isPending ? "transparent" : GREEN_DIM,
              border:         `1px solid ${isPending ? GOLD_BORDER : GREEN_BORDER}`,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              color:          isPending ? GOLD : GREEN,
              fontSize:       12,
              fontWeight:     700,
              flexShrink:     0,
              transition:     "background 300ms ease, border-color 300ms ease, color 300ms ease",
              animation:      isPending && isShown ? "spin 1.1s linear infinite" : "none",
            }}>
              {isPending ? "⟳" : isShown ? "✓" : ""}
            </div>
            <span style={{
              fontFamily:    BODY,
              fontSize:      16,
              fontWeight:    600,
              color:         TEXT,
              letterSpacing: "0.1px",
            }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
