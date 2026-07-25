"use client";
import { logoutPortal } from "@/lib/api-client";
import { BORDER, SUBTLE } from "@/lib/styles";

export function PortalLogoutButton() {
  async function handleLogout() {
    try {
      await logoutPortal();
    } catch { /* ignore */ }
    // Hard redirect — clears any stale server component cache and portal state
    window.location.href = "/";
  }

  return (
    <button
      onClick={handleLogout}
      title="Exit portal"
      style={{
        background:   "transparent",
        border:       `1px solid ${BORDER}`,
        color:        SUBTLE,
        borderRadius: 8,
        padding:      "7px 12px",
        fontSize:     12,
        cursor:       "pointer",
        fontFamily:   "var(--font-body)",
        minHeight:    44,
        flexShrink:   0,
      }}
    >
      Exit
    </button>
  );
}
