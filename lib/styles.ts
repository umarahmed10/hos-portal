// ─────────────────────────────────────────────────────────────────────────────
// Design token constants.
// All visual values live here — zero magic strings anywhere else in the app.
// CSS variables (--font-*, --bg, etc.) are set in app/globals.css.
// ─────────────────────────────────────────────────────────────────────────────
import type { CSSProperties } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────────────────────────────────────
export const FONT = "var(--font-header)";  // Barlow Condensed — headers, labels
export const BODY = "var(--font-body)";    // Barlow — body text, UI
export const MONO = "var(--font-mono)";    // JetBrains Mono — codes, numbers
export const SERIF = "var(--font-serif)";  // Georgia — agreement text

// ─────────────────────────────────────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────────────────────────────────────
export const BG          = "#090909";
export const SURF        = "#111111";
export const SURF_HOVER  = "#161616";
export const BORDER      = "#1d1d1d";
export const BORDER_LIGHT = "#2a2a2a";
export const TEXT        = "#f5f0eb";
export const MUTED       = "#555555";
export const SUBTLE      = "#777777";
export const GREEN       = "#22c55e";
export const GREEN_DIM   = "rgba(34,197,94,0.10)";
export const GREEN_BORDER = "rgba(34,197,94,0.25)";
export const AMBER       = "#eab308";
export const AMBER_DIM   = "rgba(234,179,8,0.08)";
export const AMBER_BORDER = "rgba(234,179,8,0.20)";
export const RED         = "#ef4444";
export const RED_DIM     = "rgba(239,68,68,0.10)";

// ─────────────────────────────────────────────────────────────────────────────
// REUSABLE STYLE OBJECTS
// ─────────────────────────────────────────────────────────────────────────────
export const css = {
  // Full-page wrapper — applied to every page's outermost div
  app: {
    background: BG,
    minHeight:  "100vh",
    color:      TEXT,
    fontFamily: BODY,
    fontSize:   14,
  } as CSSProperties,

  // Centered content container
  wrap: {
    maxWidth: 720,
    margin:   "0 auto",
    padding:  "0 24px",
  } as CSSProperties,

  // Content card
  card: {
    background:   SURF,
    border:       `1px solid ${BORDER}`,
    borderRadius: 10,
    padding:      24,
    marginBottom: 14,
  } as CSSProperties,

  // Form input
  inp: {
    background:  "#0c0c0c",
    border:      `1px solid #242424`,
    borderRadius: 7,
    padding:     "10px 13px",
    color:       TEXT,
    fontSize:    14,
    width:       "100%",
    outline:     "none",
    fontFamily:  BODY,
    colorScheme: "dark",
    boxSizing:   "border-box",
  } as CSSProperties,

  // Form label
  lbl: {
    color:         MUTED,
    fontSize:      10,
    fontWeight:    600,
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    display:       "block",
    marginBottom:  6,
    fontFamily:    BODY,
  } as CSSProperties,

  // Primary button — cream bg, dark text
  btnP: {
    background:    TEXT,
    color:         "#0a0a0a",
    border:        "none",
    padding:       "11px 24px",
    borderRadius:  7,
    fontSize:      13,
    fontWeight:    800,
    cursor:        "pointer",
    fontFamily:    FONT,
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    transition:    "opacity 150ms",
  } as CSSProperties,

  // Secondary button — transparent bg, subtle border
  btnS: {
    background:   "transparent",
    color:        SUBTLE,
    border:       `1px solid #242424`,
    padding:      "11px 24px",
    borderRadius: 7,
    fontSize:     13,
    fontWeight:   600,
    cursor:       "pointer",
    fontFamily:   BODY,
    transition:   "color 150ms, border-color 150ms",
  } as CSSProperties,

  // Danger button — subtle red
  btnD: {
    background:   RED_DIM,
    color:        RED,
    border:       `1px solid rgba(239,68,68,0.25)`,
    padding:      "11px 24px",
    borderRadius: 7,
    fontSize:     13,
    fontWeight:   600,
    cursor:       "pointer",
    fontFamily:   BODY,
    transition:   "opacity 150ms",
  } as CSSProperties,
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
    fontWeight:    700,
    fontFamily:    BODY,
    background:    s.bg,
    color:         s.color,
    border:        `1px solid ${s.border}`,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };
}
