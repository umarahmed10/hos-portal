// ─────────────────────────────────────────────────────────────────────────────
// Design token constants.
// All visual values live here — zero magic strings anywhere else in the app.
// CSS variables (--font-*, --bg, etc.) are set in app/globals.css.
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────────────────────────────────────
export const DISPLAY = "var(--font-display)"; // Cormorant Garamond — headlines, display
export const UI      = "var(--font-ui)";      // Space Grotesk — all UI, H2, buttons, KPIs
export const BODY    = "var(--font-body)";    // DM Sans — body copy, supporting text
export const MONO    = "var(--font-mono)";    // DM Mono — labels, codes, numbers

// Legacy aliases — keep for files that still reference FONT/SERIF
export const FONT  = UI;
export const SERIF = DISPLAY;

// ─────────────────────────────────────────────────────────────────────────────
// COLORS — matte black + bone white + deep bronze
// ─────────────────────────────────────────────────────────────────────────────
export const BG           = "#111111";   // Matte Black — primary background (55%)
export const SURF         = "#1A1A1A";   // Elevated surface (glass panels)
export const SURF_2       = "#222222";   // Input backgrounds
export const SURF_HOVER   = "#252525";
export const BORDER       = "#2A2A2A";   // Graphite borders (dark surfaces)
export const BORDER_LIGHT = "#333333";
export const TEXT         = "#F3F1EC";   // Bone White — primary text (30%)
// Contrast note (measured 2026-07-25 against BG #111111):
//   #727272 → 3.93:1 and #404040 → 1.82:1, both below the WCAG AA 4.5:1 minimum
//   for body text. Raised to the values below, which measure 5.47:1 and 4.52:1
//   on #111111 (and 5.04:1 / 4.16:1 on SURF #1A1A1A), while keeping the two
//   tiers visually distinct.
export const MUTED        = "#8A8A8A";   // Slate Grey — secondary text
export const SUBTLE       = "#7C7C7C";   // Ghost text — dimmest readable tier

// Bronze accent — <5% usage only
export const GOLD         = "#8B6B3E";       // Deep Bronze — fills, borders, buttons
// GOLD measures only 3.84:1 on BG as text, and the rgba(139,107,62,0.5) tint used
// for small eyebrow labels was far worse. This lighter bronze reads 8.44:1 on
// BG — use it for any bronze TEXT, and keep GOLD for non-text surfaces.
export const GOLD_TEXT    = "#C9A96E";       // Light Bronze — accessible text tone
export const GOLD_DIM     = "rgba(139,107,62,0.09)";
export const GOLD_BORDER  = "rgba(139,107,62,0.22)";

// Success / signed
export const GREEN        = "#4EAD87";
export const GREEN_DIM    = "rgba(78,173,135,0.09)";
export const GREEN_BORDER = "rgba(78,173,135,0.22)";

// Warning / pending
export const AMBER        = "#D4926A";
export const AMBER_DIM    = "rgba(212,146,106,0.09)";
export const AMBER_BORDER = "rgba(212,146,106,0.22)";

// Error
export const RED          = "#C96A6A";
export const RED_DIM      = "rgba(201,106,106,0.10)";

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE STYLE OBJECTS
// ─────────────────────────────────────────────────────────────────────────────
export const css = {
  app: {
    background: BG,
    minHeight:  "100vh",
    color:      TEXT,
    fontFamily: BODY,
    fontSize:   15,
  } as CSSProperties,

  wrap: {
    maxWidth: 680,
    margin:   "0 auto",
    padding:  "0 20px",
  } as CSSProperties,

  card: {
    background:   SURF,
    border:       `1px solid ${BORDER}`,
    borderRadius: 12,
    padding:      24,
    marginBottom: 12,
  } as CSSProperties,

  inp: {
    background:   SURF_2,
    border:       `1px solid ${BORDER}`,
    borderRadius: 8,
    padding:      "12px 14px",
    color:        TEXT,
    fontSize:     15,
    width:        "100%",
    outline:      "none",
    fontFamily:   BODY,
    colorScheme:  "dark",
    boxSizing:    "border-box",
    transition:   "border-color 180ms",
  } as CSSProperties,

  lbl: {
    color:         MUTED,
    fontSize:      10,
    fontWeight:    500,
    letterSpacing: "0.13em",
    textTransform: "uppercase",
    display:       "block",
    marginBottom:  6,
    fontFamily:    MONO,
  } as CSSProperties,

  // Primary: Bone White bg, Matte Black text
  btnP: {
    background:    TEXT,
    color:         "#111111",
    border:        "none",
    padding:       "14px 28px",
    borderRadius:  8,
    fontSize:      13,
    fontWeight:    600,
    cursor:        "pointer",
    fontFamily:    UI,
    letterSpacing: "0.02em",
    minHeight:     52,
    display:       "inline-flex",
    alignItems:    "center",
    justifyContent: "center",
    gap:           8,
    transition:    "opacity 150ms, transform 150ms",
  } as CSSProperties,

  // Secondary: transparent, border
  btnS: {
    background:   "transparent",
    color:        MUTED,
    border:       `1px solid ${BORDER}`,
    padding:      "12px 20px",
    borderRadius: 8,
    fontSize:     13,
    fontWeight:   500,
    cursor:       "pointer",
    fontFamily:   UI,
    minHeight:    44,
    display:      "inline-flex",
    alignItems:   "center",
    justifyContent: "center",
    gap:          8,
    transition:   "border-color 150ms, color 150ms",
  } as CSSProperties,

  // Ghost: no border, muted text
  btnG: {
    background:   "transparent",
    color:        SUBTLE,
    border:       "none",
    padding:      "10px 16px",
    borderRadius: 8,
    fontSize:     13,
    fontWeight:   500,
    cursor:       "pointer",
    fontFamily:   UI,
    minHeight:    40,
  } as CSSProperties,

  // Danger
  btnD: {
    background:   RED_DIM,
    color:        RED,
    border:       `1px solid rgba(201,106,106,0.25)`,
    padding:      "12px 20px",
    borderRadius: 8,
    fontSize:     13,
    fontWeight:   600,
    cursor:       "pointer",
    fontFamily:   UI,
  } as CSSProperties,

  // Bronze accent button — use sparingly
  btnAccent: {
    background:    GOLD,
    color:         TEXT,
    border:        "none",
    padding:       "14px 28px",
    borderRadius:  8,
    fontSize:      13,
    fontWeight:    600,
    cursor:        "pointer",
    fontFamily:    UI,
    letterSpacing: "0.02em",
    minHeight:     52,
    display:       "inline-flex",
    alignItems:    "center",
    justifyContent: "center",
    gap:           8,
  } as CSSProperties,
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE BUTTON HANDLERS
// ─────────────────────────────────────────────────────────────────────────────
export const primaryBtnHandlers = {
  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!e.currentTarget.disabled) {
      e.currentTarget.style.opacity   = "0.92";
      e.currentTarget.style.transform = "translateY(-1px)";
      e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.25)";
    }
  },
  onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.opacity   = "1";
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "none";
  },
  onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "translateY(0) scale(0.97)";
  },
  onMouseUp: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "translateY(-1px) scale(1)";
  },
};

export const secondaryBtnHandlers = {
  onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!e.currentTarget.disabled) {
      e.currentTarget.style.borderColor = "rgba(139,107,62,0.4)";
      e.currentTarget.style.color       = "#F3F1EC";
    }
  },
  onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.borderColor = "#2A2A2A";
    e.currentTarget.style.color       = "#727272";
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────
export function badge(status: string): CSSProperties {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    signed:   { bg: GREEN_DIM,  color: GREEN, border: GREEN_BORDER },
    pending:  { bg: AMBER_DIM,  color: AMBER, border: AMBER_BORDER },
    draft:    { bg: "rgba(255,255,255,0.04)", color: SUBTLE, border: BORDER },
    archived: { bg: "rgba(255,255,255,0.04)", color: MUTED,  border: BORDER },
  };
  const s = map[status] ?? map.pending;
  return {
    display:       "inline-flex",
    alignItems:    "center",
    gap:           5,
    padding:       "3px 10px",
    borderRadius:  20,
    fontSize:      11,
    fontWeight:    600,
    fontFamily:    UI,
    background:    s.bg,
    color:         s.color,
    border:        `1px solid ${s.border}`,
    letterSpacing: "0.3px",
  };
}
