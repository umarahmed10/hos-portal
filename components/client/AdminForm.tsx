"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter }                    from "next/navigation";
import { toast }                        from "sonner";
import { generateAgreement }            from "@/lib/api-client";
import { invTotal, interpolateTemplate } from "@/lib/utils";
import { BG, BODY, BORDER, FONT, GREEN, MUTED, SUBTLE, AMBER, TEXT, css } from "@/lib/styles";
import { SERVICE_TYPES, TERMS_TEMPLATES }   from "@/types";
import { Loader2, Plus, Minus, Zap }        from "@/components/shared/Icons";
import { HOSLogo }                          from "@/components/shared/HOSLogo";
import type { DocType, DocItem, Doc, PaymentStatus } from "@/types";

type Mode = "new" | "edit";

interface Props {
  mode?:       Mode;
  initialDoc?: Doc;
}

const RATE_PRESETS = ["25", "50", "75", "100"];

const SERVICE_PRESETS = [
  "Google Ads Management",
  "SEO Optimization",
  "Website Development",
  "Local Service Ads (LSA)",
  "Google Business Profile (GBP)",
  "Google My Business Setup",
  "Landing Page Design",
  "Custom — type manually",
];

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/gm, "")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/\*([\s\S]+?)\*/g, "$1")
    .replace(/^[*-]\s+/gm, "")
    .replace(/`(.+?)`/g, "$1")
    .trim();
}

function newItem(id: number): DocItem {
  return { id, desc: "", qty: "1", price: "" };
}

export function AdminForm({ mode = "new", initialDoc }: Props) {
  const router = useRouter();
  const handleGenerateRef = useRef<() => void>(() => {});

  // ── Form state ────────────────────────────────────────────────────────────
  const [docType, setDocType]         = useState<DocType>(initialDoc?.type      ?? "both");
  const [name, setName]               = useState(initialDoc?.name               ?? "");
  const [company, setCompany]         = useState(initialDoc?.company            ?? "");
  const [email, setEmail]             = useState(initialDoc?.email              ?? "");
  const [serviceType, setServiceType] = useState(initialDoc?.service_type       ?? "");
  const [serviceArea, setServiceArea] = useState(initialDoc?.service_area       ?? "");
  const [fee, setFee]                 = useState(mode === "edit" ? (initialDoc?.fee ?? "") : "100");
  const [date, setDate]               = useState(initialDoc?.date               ?? new Date().toISOString().slice(0, 10));
  const [terms, setTerms]             = useState("");
  const [agreement, setAgreement]     = useState(initialDoc?.agreement_text     ?? "");
  const [items, setItems]             = useState<DocItem[]>(
    initialDoc?.items?.length ? initialDoc.items : [newItem(1)]
  );
  const [dueDate, setDueDate]         = useState(initialDoc?.due_date  ?? "");
  const [payNotes, setPayNotes]       = useState(initialDoc?.pay_notes ?? "");
  const [presetService, setPresetService] = useState("");

  // ── Payment state (edit mode only) ───────────────────────────────────────
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    initialDoc?.payment_status ?? "unpaid"
  );
  const [amountPaid, setAmountPaid]   = useState(
    initialDoc?.amount_paid?.toString() ?? "0"
  );
  const [paymentLink, setPaymentLink] = useState(initialDoc?.payment_link ?? "");

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving]         = useState(false);

  const total   = invTotal(items);
  const showAg  = docType === "both" || docType === "agreement";
  const showInv = docType === "both" || docType === "invoice";

  // ── Templates ─────────────────────────────────────────────────────────────
  function applyTemplate(body: string) {
    setTerms(interpolateTemplate(body, { service_type: serviceType, service_area: serviceArea, fee }));
  }

  function applyServicePreset(preset: string) {
    if (!preset || preset === "Custom — type manually") { setPresetService(""); return; }
    setItems(prev => {
      const emptyIdx = prev.findIndex(i => !i.desc.trim());
      if (emptyIdx !== -1) {
        return prev.map((item, idx) =>
          idx === emptyIdx ? { ...item, desc: preset, qty: "1", price: fee || "" } : item
        );
      }
      return [...prev, { id: Date.now(), desc: preset, qty: "1", price: fee || "" }];
    });
    setPresetService("");
  }

  // ── Agreement generation ──────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!name) { toast.error("Enter client name first"); return; }
    setGenerating(true);
    try {
      const text = await generateAgreement({ name, company, service_type: serviceType, service_area: serviceArea, fee, date, terms });
      setAgreement(stripMarkdown(text));
      toast.success("Agreement generated");
    } catch {
      toast.error("Generation failed. Check your OpenRouter key.");
    } finally {
      setGenerating(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, company, serviceType, serviceArea, fee, date, terms]);

  // ── Invoice items ─────────────────────────────────────────────────────────
  function addItem() {
    setItems(prev => [...prev, newItem(Date.now())]);
  }
  function removeItem(id: number) {
    setItems(prev => prev.filter(i => i.id !== id));
  }
  function updateItem(id: number, field: keyof DocItem, value: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  // ── Payment validation ────────────────────────────────────────────────────
  function validatePayment(): boolean {
    const paid = parseFloat(amountPaid) || 0;
    if (paymentStatus === "paid" && paid < total) {
      toast.error(`Amount paid (${paid}) must equal invoice total (${total}) to mark as Paid.`);
      return false;
    }
    if (paymentStatus === "partially_paid" && paid <= 0) {
      toast.error("Enter an amount paid greater than 0 for Partially Paid.");
      return false;
    }
    if (paymentStatus === "unpaid" && paid > 0) {
      toast.error("Amount paid must be 0 for Unpaid status.");
      return false;
    }
    return true;
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave(status: "pending" | "draft" = "pending") {
    if (!name.trim()) { toast.error("Client name is required"); return; }
    if (mode === "edit" && !validatePayment()) return;

    setSaving(true);

    const payload: Record<string, unknown> = {
      type:           docType,
      status,
      name:           name.trim(),
      company:        company.trim()  || undefined,
      email:          email.trim()    || undefined,
      service_type:   serviceType     || undefined,
      service_area:   serviceArea     || undefined,
      fee:            fee             || undefined,
      date:           date            || undefined,
      agreement_text: agreement       || undefined,
      items:          showInv ? items : [],
      due_date:       dueDate         || undefined,
      pay_notes:      payNotes        || undefined,
    };

    if (mode === "edit") {
      payload.payment_status = paymentStatus;
      payload.amount_paid    = parseFloat(amountPaid) || 0;
      payload.payment_link   = paymentLink.trim() || undefined;
    }

    try {
      if (mode === "edit" && initialDoc) {
        const res = await fetch(`/api/docs/${initialDoc.code}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);
        toast.success("Document updated");
        router.push("/admin");
      } else {
        const res = await fetch("/api/docs", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error);
        router.push(`/admin/share?code=${json.data.code}${email.trim() ? "&sent=1" : ""}`);
      }
    } catch (err) {
      toast.error(`Save failed: ${String(err)}`);
      setSaving(false);
    }
  }

  useEffect(() => { handleGenerateRef.current = handleGenerate; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleGenerateRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ ...css.app, paddingBottom: 100 }}>
      {/* Nav */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "0" }}>
        <div style={{ ...css.wrap, maxWidth: 760, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => router.push("/admin")} style={{ ...css.btnS, padding: "7px 14px", fontSize: 12 }}>
              ← Back
            </button>
            <HOSLogo size={24} theme="dark" showWordmark={false} />
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", color: MUTED, textTransform: "uppercase", marginBottom: 2 }}>
                HOS
              </div>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 400, fontStyle: "italic", color: TEXT, letterSpacing: "0.005em", margin: 0 }}>
                {mode === "edit" ? `Edit — ${initialDoc?.name}` : "New Client"}
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...css.wrap, maxWidth: 760, paddingTop: 24 }}>

        {/* Warn if already signed */}
        {mode === "edit" && initialDoc?.status === "signed" && (
          <div style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", borderRadius: 8, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#eab308" }}>
            ⚠ This document has been signed. Changes to the agreement will require the client to re-sign.
          </div>
        )}

        {/* Doc type */}
        <div style={css.card}>
          <div style={{ ...css.lbl, color: "rgba(139,107,62,0.5)", letterSpacing: "0.18em" }}>Document Type</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {(["both", "agreement", "invoice"] as DocType[]).map(t => (
              <button
                key={t}
                onClick={() => setDocType(t)}
                style={{
                  padding:       "12px 8px",
                  borderRadius:  7,
                  border:        docType === t ? "none" : `1px solid #2A2A2A`,
                  background:    docType === t ? "#8B6B3E" : "transparent",
                  color:         docType === t ? "#F3F1EC" : MUTED,
                  fontFamily:    "var(--font-mono)",
                  fontSize:      10,
                  fontWeight:    700,
                  cursor:        "pointer",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  transition:    "all 120ms",
                }}
              >
                {t === "both" ? "Agreement + Invoice" : t === "agreement" ? "Agreement Only" : "Invoice Only"}
              </button>
            ))}
          </div>
        </div>

        {/* Client details */}
        <div style={css.card}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", color: "rgba(139,107,62,0.5)", textTransform: "uppercase", marginBottom: 16 }}>Client Details</div>
          <div className="admin-client-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={css.lbl}>Name *</label>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="John Smith" autoComplete="name" style={css.inp} />
            </div>
            <div>
              <label style={css.lbl}>Company</label>
              <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Smith Plumbing LLC" autoComplete="organization" style={css.inp} />
            </div>
            <div>
              <label style={css.lbl}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="client@company.com" autoComplete="email" inputMode="email" style={css.inp} />
            </div>
            <div>
              <label style={css.lbl}>Service Type</label>
              <select value={serviceType} onChange={e => setServiceType(e.target.value)} style={{ ...css.inp, cursor: "pointer" }}>
                <option value="">Select…</option>
                {SERVICE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={css.lbl}>Service Area</label>
              <input value={serviceArea} onChange={e => setServiceArea(e.target.value)} placeholder="Phoenix, AZ" autoComplete="off" style={css.inp} />
            </div>
            <div>
              <label style={css.lbl}>Rate Per Call ($)</label>
              <input value={fee} onChange={e => setFee(e.target.value)} placeholder="150" type="number" min="0" inputMode="decimal" style={css.inp} />
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {RATE_PRESETS.map(p => (
                  <button
                    key={p}
                    onClick={() => setFee(p)}
                    style={{
                      padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer",
                      background: fee === p ? "rgba(245,240,235,0.1)" : "transparent",
                      border: `1px solid ${fee === p ? BORDER : "#1a1a1a"}`,
                      color:  fee === p ? TEXT : MUTED,
                      fontFamily: BODY,
                    }}
                  >
                    ${p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={css.lbl}>Start Date</label>
              <input value={date} onChange={e => setDate(e.target.value)} type="date" style={css.inp} />
            </div>
          </div>
        </div>

        {/* Agreement */}
        {showAg && (
          <div style={css.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", color: "rgba(139,107,62,0.5)", textTransform: "uppercase" }}>Service Agreement</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={css.lbl}>Quick Templates</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {TERMS_TEMPLATES.map(t => (
                  <button key={t.label} onClick={() => applyTemplate(t.body)} title={t.description}
                    style={{ ...css.btnS, padding: "6px 14px", fontSize: 12 }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={css.lbl}>Custom Terms (optional)</label>
              <textarea
                value={terms}
                onChange={e => setTerms(e.target.value)}
                rows={3}
                placeholder="Describe any special terms, exclusions, or notes for this client…"
                style={{ ...css.inp, fontFamily: BODY, lineHeight: 1.6 }}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{ ...css.btnS, display: "flex", alignItems: "center", gap: 8, marginBottom: 14, opacity: generating ? 0.6 : 1 }}
            >
              {generating ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Zap size={13} />}
              {generating ? "Generating…" : "Generate Agreement"}
            </button>

            {(agreement || generating) && (
              <div>
                <label style={css.lbl}>Agreement Text (editable)</label>
                {generating ? (
                  <div style={{ ...css.inp, minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 13 }}>
                    Writing your agreement…
                  </div>
                ) : (
                  <textarea
                    value={agreement}
                    onChange={e => setAgreement(e.target.value)}
                    rows={12}
                    style={{ ...css.inp, fontFamily: "var(--font-display)", fontSize: 13, lineHeight: 1.9, color: "#b0b0b0" }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Invoice */}
        {showInv && (
          <div style={css.card}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", color: "rgba(139,107,62,0.5)", textTransform: "uppercase", marginBottom: 16 }}>Invoice</div>

            <div style={{ marginBottom: 14 }}>
              <label style={css.lbl}>Quick-add Service</label>
              <select value={presetService} onChange={e => applyServicePreset(e.target.value)} style={{ ...css.inp, cursor: "pointer" }}>
                <option value="">Select a service to pre-fill…</option>
                {SERVICE_PRESETS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="admin-line-item-header admin-line-item-row" style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 36px", gap: 8, marginBottom: 8 }}>
              {["Description", "Qty", "Price", ""].map((h, i) => (
                <div key={i} style={{ ...css.lbl, marginBottom: 0 }}>{h}</div>
              ))}
            </div>

            {items.map(item => (
              <div key={item.id} className="admin-line-item-row" style={{ display: "grid", gridTemplateColumns: "1fr 80px 110px 36px", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <input value={item.desc} onChange={e => updateItem(item.id, "desc", e.target.value)} placeholder="Service description" style={css.inp} />
                <input value={item.qty} onChange={e => updateItem(item.id, "qty", e.target.value)} type="number" min="0" step="1" style={{ ...css.inp, textAlign: "right" }} />
                <input value={item.price} onChange={e => updateItem(item.id, "price", e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" style={{ ...css.inp, textAlign: "right", fontFamily: "var(--font-mono)" }} />
                <button onClick={() => removeItem(item.id)} disabled={items.length === 1}
                  style={{ ...css.btnS, padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", opacity: items.length === 1 ? 0.2 : 1 }}>
                  <Minus size={13} />
                </button>
              </div>
            ))}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <button onClick={addItem} style={{ ...css.btnS, display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12 }}>
                <Plus size={12} /> Add Line
              </button>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: TEXT }}>
                Total: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(total)}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
              <div>
                <label style={css.lbl}>Payment Due Date</label>
                <input value={dueDate} onChange={e => setDueDate(e.target.value)} type="date" style={css.inp} />
              </div>
              <div>
                <label style={css.lbl}>Payment Notes</label>
                <input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="e.g. Pay via ACH or check" style={css.inp} />
              </div>
            </div>
          </div>
        )}

        {/* Payment status — edit mode only */}
        {mode === "edit" && (
          <div style={css.card}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", color: "rgba(139,107,62,0.5)", textTransform: "uppercase", marginBottom: 16 }}>Payment Status</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={css.lbl}>Status</label>
                <select
                  value={paymentStatus}
                  onChange={e => setPaymentStatus(e.target.value as PaymentStatus)}
                  style={{ ...css.inp, cursor: "pointer" }}
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Paid in Full</option>
                </select>
              </div>
              <div>
                <label style={css.lbl}>Amount Collected ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  style={{ ...css.inp, fontFamily: "var(--font-mono)" }}
                />
              </div>
            </div>
            {paymentStatus === "paid" && parseFloat(amountPaid) < total && (
              <div style={{ marginTop: 10, fontSize: 12, color: AMBER, fontFamily: BODY }}>
                ⚠ Amount collected ({parseFloat(amountPaid).toFixed(2)}) is less than invoice total ({total.toFixed(2)}). Set to "Partially Paid" or increase the amount.
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <label style={css.lbl}>Payment Link (optional)</label>
              <input
                value={paymentLink}
                onChange={e => setPaymentLink(e.target.value)}
                placeholder="https://pay.example.com/..."
                type="url"
                style={css.inp}
              />
              <div style={{ fontSize: 11, color: SUBTLE, marginTop: 4, fontFamily: BODY }}>
                Shown to client as a "Pay Now" button in their portal.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: BG, borderTop: `1px solid ${BORDER}`,
        padding: "14px 24px", display: "flex", gap: 10,
        justifyContent: "flex-end", zIndex: 100,
      }}>
        <button onClick={() => router.push("/admin")} style={{ ...css.btnS, padding: "10px 18px", fontSize: 12 }}>
          Cancel
        </button>
        <button
          onClick={() => handleSave("draft")}
          disabled={saving || !name.trim()}
          style={{ ...css.btnS, padding: "10px 18px", fontSize: 12, opacity: saving || !name.trim() ? 0.4 : 1 }}
        >
          Save Draft
        </button>
        <button
          onClick={() => handleSave("pending")}
          disabled={saving || !name.trim()}
          style={{ ...css.btnP, padding: "10px 24px", opacity: saving || !name.trim() ? 0.4 : 1 }}
        >
          {saving ? "Saving…" : mode === "edit" ? "SAVE CHANGES →" : "SAVE & GENERATE CODE →"}
        </button>
      </div>
    </div>
  );
}
