"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BORDER, GOLD, BG, RED } from "@/lib/styles";

export function CommsFAB({ code }: { code: string }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/comms/unread?code=${code}&asRole=client`);
        const j = await res.json();
        if (!cancelled && j.ok) setUnread(j.data.count);
      } catch { /* best-effort */ }
    };
    void poll();
    const t = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [code]);

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
      {unread > 0 && (
        <span style={{
          position: "absolute", top: -4, right: -4,
          minWidth: 18, height: 18, borderRadius: 9,
          background: RED, color: "#fff",
          fontSize: 10, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 4px",
          fontFamily: "var(--font-mono)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}>
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
