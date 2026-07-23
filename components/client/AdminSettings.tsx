"use client";
// Admin settings popover — currently the payment-routing cutoff (Skydo vs Wise).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SURF, BORDER, MUTED, TEXT, GOLD, css } from "@/lib/styles";

export function AdminSettings() {
  const [open, setOpen] = useState(false);
  const [cutoff, setCutoff] = useState("399");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    fetch("/api/settings")
      .then(r => r.json())
      .then(j => { if (j.ok) setCutoff(String(j.data.payment_cutoff)); setLoaded(true); })
      .catch(() => {});
  }, [open, loaded]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_cutoff: Number(cutoff) || 0 }),
      });
      const j = await res.json();
      if (j.ok) { toast.success("Settings saved"); setOpen(false); }
      else toast.error(j.error ?? "Save failed");
    } catch {
      toast.error("Save failed");
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} title="Settings" aria-label="Settings"
        style={{ ...css.btnS, display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, padding: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", top: 48, right: 0, zIndex: 41, width: 280, background: SURF, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, boxShadow: "0 16px 48px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: GOLD, fontFamily: "var(--font-mono)", marginBottom: 12 }}>Payment Routing</div>
            <label style={{ fontSize: 11, color: MUTED, fontFamily: "var(--font-mono)", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Skydo / Wise cutoff (USD)</label>
            <input type="number" min="0" step="10" value={cutoff} onChange={e => setCutoff(e.target.value)}
              style={{ ...css.inp, fontSize: 16, marginBottom: 8 }} />
            <p style={{ fontSize: 11, color: MUTED, fontFamily: "var(--font-body)", lineHeight: 1.5, margin: "0 0 14px" }}>
              Invoices <strong style={{ color: TEXT }}>≥ ${cutoff || 0}</strong> route to <strong style={{ color: TEXT }}>Skydo</strong>; anything below → <strong style={{ color: TEXT }}>Wise</strong>.
            </p>
            <button onClick={save} disabled={saving} style={{ ...css.btnP, width: "100%", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
