"use client";
import Link from "next/link";
import { BORDER, GOLD, BG } from "@/lib/styles";

// Floating "Call HOS" button, positioned to the LEFT of the existing
// FloatingSupport bubble so both can coexist on the client portal.
export function CommsFAB({ code }: { code: string }) {
  return (
    <Link
      href={`/comms-test/client/${code}`}
      aria-label="Call or message the HOS team"
      style={{
        position: "fixed", bottom: 24, right: 88,
        width: 52, height: 52, borderRadius: "50%",
        background: GOLD, color: BG,
        border: `1px solid ${BORDER}`,
        cursor: "pointer", fontSize: 22, zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        textDecoration: "none",
        minHeight: 52,
      }}
    >
      <span aria-hidden="true">📞</span>
    </Link>
  );
}
