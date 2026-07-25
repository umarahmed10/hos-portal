"use client";
import { useState } from "react";
import Link                       from "next/link";
import { useRouter }              from "next/navigation";
import { toast }                  from "sonner";
import { SignaturePad }           from "@/components/client/SignaturePad";
import { ProgressBar }            from "@/components/client/ProgressBar";
import { CredibilitySection }     from "@/components/client/CredibilitySection";
import { TrustBox }               from "@/components/client/TrustBox";
import { fmt, money, rowTotal }   from "@/lib/utils";
import {
  DISPLAY, UI, BODY, MONO, MUTED, SUBTLE, TEXT, SURF, BORDER,
  GREEN, GREEN_DIM, GREEN_BORDER, AMBER, AMBER_DIM, AMBER_BORDER,
  GOLD, GOLD_DIM, GOLD_BORDER,
  css,
  GOLD_TEXT,
} from "@/lib/styles";
import type { PaymentStatus, Doc } from "@/types";

// Bronze PARTIAL badge — no purple anywhere
const PAYMENT_BADGE: Record<PaymentStatus, { bg: string; color: string; border: string; label: string }> = {
  unpaid:         { bg: AMBER_DIM,               color: AMBER,     border: AMBER_BORDER,               label: "Unpaid"  },
  partially_paid: { bg: "rgba(139,107,62,0.10)", color: "#C9A96E", border: "rgba(139,107,62,0.3)",      label: "Partial" },
  paid:           { bg: GREEN_DIM,               color: GREEN,     border: GREEN_BORDER,                label: "Paid"    },
};

// ── Step metadata ─────────────────────────────────────────────────────────────
const STEP_LABELS = ["Review", "Invoice", "Sign", "Confirm"];

const SIGN_CONFIRM_LINES = [
  "Service agreement executed",
  "Account activated",
  "Campaign queue initialized",
];

// ── Main Component ────────────────────────────────────────────────────────────
interface SignPageProps {
  doc: Doc;
  redirectAfter?: string;
  /** Short-lived token for the /api/pdf link — this flow has no session. */
  pdfToken?: string;
}

type SignStage = "idle" | "securing" | "confirmed" | "lines";
type ConfirmState = "idle" | "loading" | "ring" | "check" | "checklist" | "done";

export function SignPage({ doc, redirectAfter, pdfToken }: SignPageProps) {
  const router   = useRouter();
  const [step, setStep]               = useState(1);
  const [prevStep, setPrevStep]       = useState(0);
  const [stepKey, setStepKey]         = useState(1);
  const [signStage, setSignStage]     = useState<SignStage>("idle");
  const [confirmState, setConfirmState] = useState<ConfirmState>("idle");
  const [accepted, setAccepted]       = useState(false);
  const [enteringPortal, setEnteringPortal] = useState(false);
  const [readComplete, setReadComplete] = useState(false);

  const isGoingForward = step > prevStep;

  function advance(n: number) {
    setPrevStep(step);
    setStep(n);
    setStepKey(k => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleAgreementScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40 && !readComplete) {
      setReadComplete(true);
    }
  }

  async function handleSign(sigDataUrl: string) {
    if (!accepted) {
      toast.error("Please check the e-signature confirmation first.");
      return;
    }
    setConfirmState("loading");
    setSignStage("securing");

    const signPromise = fetch("/api/sign", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        code:                 doc.code,
        signature:            sigDataUrl,
        accepted_esign_terms: accepted,
      }),
    });

    try {
      await new Promise(r => setTimeout(r, 300));
      setConfirmState("ring");

      await new Promise(r => setTimeout(r, 500));
      setConfirmState("check");

      const res  = await signPromise;
      const json = await res.json();

      if (!json.ok) {
        toast.error(json.error || "Signature failed. Please try again.");
        setConfirmState("idle");
        setSignStage("idle");
        return;
      }

      setSignStage("confirmed");
      await new Promise(r => setTimeout(r, 600));
      setConfirmState("checklist");

      await new Promise(r => setTimeout(r, 1600));
      setConfirmState("done");
    } catch {
      toast.error("Something went wrong. Please try again.");
      setConfirmState("idle");
      setSignStage("idle");
    }
  }

  async function handleEnterPortal() {
    setEnteringPortal(true);
    try {
      const res  = await fetch("/api/portal-session", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ slug: doc.slug ?? undefined, code: doc.code }),
      });
      const json = await res.json();
      if (json.ok && json.data?.slug) {
        // Honour redirectAfter when the caller set one — the portal signing page
        // passes /portal/[slug]/status to keep the client inside the portal
        // shell. Without this the prop was silently ignored and portal signers
        // were bounced out to the standalone /client/[code]/done page.
        window.location.href = redirectAfter ?? `/portal/${json.data.slug}/status`;
        return;
      }
    } catch { /* fall through to fallback */ }
    // Fallback: if portal-session fails or returns no slug, go to done page
    window.location.href = redirectAfter ?? `/client/${doc.code}/done`;
  }

  // Step label style — DM Mono, bronze tint
  const stepLabelStyle: React.CSSProperties = {
    fontFamily:    MONO,
    fontSize:      9,
    letterSpacing: "0.18em",
    color:         GOLD_TEXT,
    textTransform: "uppercase",
    marginBottom:  10,
  };

  // Step heading style — Cormorant italic
  const stepHeadingStyle: React.CSSProperties = {
    fontFamily:    DISPLAY,
    fontSize:      "clamp(28px, 4vw, 44px)",
    fontWeight:    300,
    fontStyle:     "italic",
    letterSpacing: "-0.01em",
    lineHeight:    1.05,
    color:         TEXT,
    marginBottom:  8,
  };

  return (
    <div style={{ ...css.app, paddingBottom: 100 }}>
      {/* Sticky exit button */}
      <div style={{ position: "fixed", top: 16, right: 20, zIndex: 1000 }}>
        <Link
          href="/"
          style={{
            fontFamily:     MONO,
            fontSize:       9,
            letterSpacing:  "0.12em",
            textTransform:  "uppercase",
            // Was #404040 — 1.82:1 contrast, far below WCAG AA for a control.
            color:          MUTED,
            textDecoration: "none",
            padding:        "6px 12px",
            border:         "1px solid #2A2A2A",
            borderRadius:   4,
            background:     "#111111",
          }}
        >
          Exit
        </Link>
      </div>

      <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 24px 0" }}>

        {/* Back nav */}
        {step < 4 && (
          <button
            onClick={() => step > 1 ? advance(step - 1) : router.back()}
            style={{
              background:   "none",
              border:       "none",
              color:        SUBTLE,
              cursor:       "pointer",
              fontSize:     13,
              padding:      "4px 0",
              marginBottom: 28,
              fontFamily:   BODY,
              display:      "flex",
              alignItems:   "center",
              gap:          6,
            }}
          >
            ← Back
          </button>
        )}

        <ProgressBar current={step} total={4} labels={STEP_LABELS} />

        {/* ── STEP 1: Review Agreement ──────────────────────────────────────── */}
        {step === 1 && (
          <div key={stepKey} style={{ animation: `${isGoingForward ? "slideInRight" : "slideInLeft"} 320ms var(--ease-out) both` }}>
            <div style={stepLabelStyle}>Step 1 of 4</div>
            <h2 style={stepHeadingStyle}>Review your agreement.</h2>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, marginBottom: 20, fontFamily: BODY }}>
              Read the service agreement carefully, then continue to confirm your invoice.
            </p>

            <div
              onScroll={handleAgreementScroll}
              style={{
                background:     SURF,
                border:         `1px solid ${BORDER}`,
                borderRadius:   12,
                maxHeight:      480,
                overflowY:      "auto",
                padding:        "28px 32px",
                scrollbarWidth: "thin",
                scrollbarColor: "#2C2925 #0D0C0B",
                position:       "relative",
                maskImage:      readComplete ? "none" : "linear-gradient(to bottom, black 80%, transparent 100%)",
                WebkitMaskImage: readComplete ? "none" : "linear-gradient(to bottom, black 80%, transparent 100%)",
                transition:     "mask-image 400ms ease",
              }}
            >
              <div style={{ fontSize: 9, letterSpacing: "0.14em", fontWeight: 700, color: SUBTLE, fontFamily: MONO, marginBottom: 16, textTransform: "uppercase" }}>
                Service Agreement · House Of Sales
              </div>
              {doc.agreement_text
                ? (() => {
                    // Split on numbered clauses like "1. PARTIES", "2. SERVICES", ...
                    const raw = doc.agreement_text.trim();
                    const parts = raw
                      .split(/(?=\s\d+\.\s+[A-Z][A-Z &]{2,})/g)
                      .map(s => s.trim())
                      .filter(Boolean);
                    // If splitting didn't help (single chunk), fall back to whitespace-preserving text
                    if (parts.length <= 1) {
                      return (
                        <div style={{
                          fontFamily: BODY,
                          fontSize:   14,
                          lineHeight: 1.8,
                          color:      "#E0DED9",
                          whiteSpace: "pre-wrap",
                        }}>
                          {raw}
                        </div>
                      );
                    }
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {parts.map((part, i) => {
                          // Match leading "N. TITLE" (title = uppercase words) and split heading from body
                          const m = part.match(/^(\d+)\.\s+([A-Z][A-Z &]{2,}?)(?=\s+[A-Z][a-z]|\s+This|\s+Either|\s+Provider|\s+Client|\s+Payment|\s+To|\s+Upon|$)\s*/);
                          const num   = m?.[1];
                          const title = m?.[2];
                          const body  = m ? part.slice(m[0].length).trim() : part;
                          return (
                            <div key={i}>
                              {title && (
                                <div style={{
                                  fontFamily:    MONO,
                                  fontSize:      10,
                                  letterSpacing: "0.14em",
                                  color:         "#C9A96E",
                                  textTransform: "uppercase",
                                  marginBottom:  6,
                                  fontWeight:    600,
                                }}>
                                  {num}. {title}
                                </div>
                              )}
                              <div style={{
                                fontFamily: BODY,
                                fontSize:   14,
                                lineHeight: 1.8,
                                color:      "#E0DED9",
                              }}>
                                {body}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                : <div style={{ color: MUTED, fontSize: 13, fontFamily: BODY }}>No agreement text attached.</div>
              }
            </div>

            {/* Scroll to continue hint */}
            {!readComplete && (
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <div style={{
                  fontFamily:    MONO,
                  fontSize:      9,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color:         GOLD_TEXT,
                  animation:     "pulse 2s infinite",
                }}>
                  Scroll to continue ↓
                </div>
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <CredibilitySection />
            </div>

            {/* CTA — reveals when agreement is read */}
            <div style={{
              position:   "sticky",
              bottom:     20,
              paddingTop: 28,
              background: "linear-gradient(to top, #0D0C0B 70%, transparent)",
              marginTop:  -8,
            }}>
              <button
                onClick={() => advance(2)}
                style={{
                  ...css.btnP,
                  width:         "100%",
                  padding:       "16px 24px",
                  fontSize:      13,
                  fontFamily:    UI,
                  fontWeight:    600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  animation:     readComplete ? "stampIn 400ms var(--ease-spring) both" : "none",
                }}
              >
                I&apos;ve read the agreement →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Invoice ───────────────────────────────────────────────── */}
        {step === 2 && (
          <div key={stepKey} style={{ animation: `${isGoingForward ? "slideInRight" : "slideInLeft"} 320ms var(--ease-out) both` }}>
            <div style={stepLabelStyle}>Step 2 of 4</div>
            <h2 style={stepHeadingStyle}>Confirm your invoice.</h2>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, marginBottom: 20, fontFamily: BODY }}>
              Review the services and total before signing.
            </p>

            {/* Invoice hero card */}
            {doc.invoice_total > 0 && (
              <div style={{
                background:     GOLD_DIM,
                border:         `1px solid ${GOLD_BORDER}`,
                borderLeft:     "3px solid #8B6B3E",
                borderRadius:   12,
                padding:        "22px 28px",
                marginBottom:   16,
                display:        "flex",
                justifyContent: "space-between",
                alignItems:     "flex-end",
                flexWrap:       "wrap",
                gap:            16,
              }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: "rgba(139,107,62,0.6)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 6 }}>
                    Total Due
                  </div>
                  <div style={{ fontFamily: UI, fontSize: 44, fontWeight: 600, letterSpacing: "-0.04em", color: TEXT, lineHeight: 1 }}>
                    {money(doc.invoice_total)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {doc.due_date && (
                    <>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>
                        Due Date
                      </div>
                      <div style={{ fontFamily: UI, fontWeight: 600, fontSize: 16, color: TEXT }}>
                        {fmt(doc.due_date)}
                      </div>
                    </>
                  )}
                  {(() => {
                    const ps = PAYMENT_BADGE[doc.payment_status ?? "unpaid"] ?? PAYMENT_BADGE.unpaid;
                    return (
                      <div style={{
                        display:       "inline-block",
                        marginTop:     8,
                        padding:       "3px 10px",
                        borderRadius:  20,
                        fontSize:      10,
                        fontWeight:    700,
                        fontFamily:    MONO,
                        letterSpacing: "0.6px",
                        background:    ps.bg,
                        color:         ps.color,
                        border:        `1px solid ${ps.border}`,
                      }}>
                        {ps.label}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Line items table — scrollable to prevent cut-off */}
            <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${BORDER}`, marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 440 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    {["DESCRIPTION", "QTY", "UNIT PRICE", "TOTAL"].map(h => (
                      <th key={h} style={{
                        fontFamily:    MONO,
                        fontSize:      9,
                        letterSpacing: "0.12em",
                        color:         MUTED,
                        textTransform: "uppercase",
                        padding:       "12px 16px",
                        textAlign:     h === "DESCRIPTION" ? "left" : "right",
                        fontWeight:    500,
                        background:    SURF,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((item, i) => (
                    <tr key={i} style={{
                      borderBottom: i < doc.items.length - 1 ? `1px solid rgba(243,241,236,0.04)` : "none",
                      background:   i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                    }}>
                      <td style={{ fontFamily: BODY, fontSize: 14, color: TEXT, padding: "12px 16px" }}>{item.desc}</td>
                      <td style={{ fontFamily: MONO, fontSize: 13, color: MUTED, padding: "12px 16px", textAlign: "right" }}>{item.qty}</td>
                      <td style={{ fontFamily: MONO, fontSize: 13, color: MUTED, padding: "12px 16px", textAlign: "right" }}>{money(item.price)}</td>
                      <td style={{ fontFamily: UI, fontSize: 14, fontWeight: 600, color: TEXT, padding: "12px 16px", textAlign: "right" }}>{money(rowTotal(item))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
              <div style={{ background: "#111111", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 24px", minWidth: 220 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 40 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.12em", textTransform: "uppercase" }}>Subtotal</span>
                  <span style={{ fontFamily: MONO, fontSize: 13, color: TEXT }}>{money(doc.invoice_total)}</span>
                </div>
                <div style={{ height: 1, background: "rgba(243,241,236,0.08)", marginBottom: 10 }} />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 40 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: TEXT, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>Total Due</span>
                  <span style={{ fontFamily: UI, fontSize: 18, fontWeight: 700, color: TEXT, letterSpacing: "-0.02em" }}>{money(doc.invoice_total)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => advance(3)}
              style={{
                ...css.btnP,
                width:         "100%",
                padding:       "16px 24px",
                fontSize:      13,
                fontFamily:    UI,
                fontWeight:    600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Looks good — continue →
            </button>
          </div>
        )}

        {/* ── STEP 3: Sign ──────────────────────────────────────────────────── */}
        {step === 3 && (
          <div key={stepKey} style={{ animation: `${isGoingForward ? "slideInRight" : "slideInLeft"} 320ms var(--ease-out) both` }}>
            <div style={stepLabelStyle}>Step 3 of 4</div>
            <h2 style={stepHeadingStyle}>Sign your agreement.</h2>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, marginBottom: 24, fontFamily: BODY }}>
              Draw your signature below. Your signed copy will be emailed automatically.
            </p>

            <TrustBox style={{ marginBottom: 18 }} />

            {/* Signing card */}
            <div style={{ ...css.card, marginBottom: 14 }}>
              {/* Signer identity */}
              <div style={{
                display:        "flex",
                justifyContent: "space-between",
                alignItems:     "flex-start",
                flexWrap:       "wrap",
                gap:            8,
                paddingBottom:  16,
                borderBottom:   `1px solid ${BORDER}`,
                marginBottom:   18,
              }}>
                <div>
                  <div style={{ fontSize: 9, color: MUTED, letterSpacing: "0.12em", fontFamily: MONO, marginBottom: 4, textTransform: "uppercase" }}>
                    Signing as
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: TEXT, fontFamily: BODY }}>
                    {doc.name}{doc.company ? ` · ${doc.company}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 9, color: MUTED, letterSpacing: "0.12em", fontFamily: MONO, marginBottom: 4, textTransform: "uppercase" }}>
                    Date
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 12, color: SUBTLE }}>{fmt(new Date())}</div>
                </div>
              </div>

              {signStage === "idle" ? (
                <SignaturePad
                  onConfirm={handleSign}
                  accepted={accepted}
                />
              ) : (
                <div style={{ textAlign: "center", padding: "40px 0", animation: "fadeIn 320ms var(--ease-out)" }}>
                  <div style={{
                    width:          64,
                    height:         64,
                    borderRadius:   "50%",
                    margin:         "0 auto 16px",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    fontSize:       26,
                    background:     signStage === "securing" ? "transparent" : GREEN_DIM,
                    border:         `2px solid ${signStage === "securing" ? GOLD : GREEN_BORDER}`,
                    color:          signStage === "securing" ? GOLD : GREEN,
                    transition:     "background 320ms ease, border-color 320ms ease, color 320ms ease",
                    animation:      signStage === "securing"
                      ? "pulseGold 1.4s ease-in-out infinite"
                      : "scalePop 420ms var(--spring)",
                  }}>
                    {signStage === "securing" ? "" : "✓"}
                  </div>
                  <div style={{
                    fontSize:      12,
                    fontFamily:    MONO,
                    letterSpacing: "0.08em",
                    color:         signStage === "securing" ? GOLD : GREEN,
                    marginBottom:  signStage === "lines" ? 22 : 0,
                    transition:    "color 320ms ease",
                    textTransform: "uppercase",
                  }}>
                    {signStage === "securing" ? "Securing your signature…" : "Signature confirmed"}
                  </div>

                  {signStage === "lines" && (
                    <div style={{ textAlign: "left", maxWidth: 280, margin: "0 auto" }}>
                      {SIGN_CONFIRM_LINES.map((line, i) => (
                        <div key={line} style={{
                          display:    "flex",
                          alignItems: "center",
                          gap:        10,
                          padding:    "8px 0",
                          opacity:    0,
                          animation:  `fadeInFast 320ms var(--ease-out) ${i * 180}ms both`,
                        }}>
                          <span style={{ color: GREEN, fontWeight: 700, fontSize: 14 }}>✓</span>
                          <span style={{ fontFamily: BODY, fontSize: 14, fontWeight: 600, color: TEXT }}>
                            {line}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* E-sign consent */}
            <label style={{
              display:      "flex",
              alignItems:   "flex-start",
              gap:          12,
              cursor:       "pointer",
              padding:      "14px 16px",
              background:   accepted ? GREEN_DIM : "transparent",
              border:       `1px solid ${accepted ? GREEN_BORDER : BORDER}`,
              borderRadius: 10,
              transition:   "background 200ms ease, border-color 200ms ease",
            }}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={e => setAccepted(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0, accentColor: GREEN, width: 16, height: 16, cursor: "pointer" }}
              />
              <span style={{ fontSize: 12, color: accepted ? GREEN : MUTED, lineHeight: 1.7, fontFamily: BODY }}>
                I confirm that my electronic signature is legally binding and carries the same legal effect as a handwritten signature under applicable e-signature laws.
              </span>
            </label>
          </div>
        )}

        {/* ── STEP 4: Confirmed ─────────────────────────────────────────────── */}
        {step === 4 && (
          <div key={stepKey} style={{ textAlign: "center", paddingTop: 40, animation: "fadeIn 350ms var(--ease-out)" }}>

            <div style={{
              width:          76,
              height:         76,
              borderRadius:   "50%",
              border:         `2px solid ${GREEN}`,
              background:     GREEN_DIM,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              margin:         "0 auto 24px",
              fontSize:       30,
              color:          GREEN,
              animation:      "scalePop 500ms var(--spring)",
            }}>
              ✓
            </div>

            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.18em", color: GOLD_TEXT, marginBottom: 12, textTransform: "uppercase" }}>
              Agreement Executed
            </div>

            <h2 style={{
              fontFamily:    DISPLAY,
              fontStyle:     "italic",
              fontSize:      "clamp(40px, 6vw, 60px)",
              fontWeight:    300,
              letterSpacing: "-0.01em",
              lineHeight:    1.0,
              color:         TEXT,
              marginBottom:  20,
            }}>
              You&apos;re in.
            </h2>

            <div style={{
              maxWidth:     360,
              margin:       "0 auto 24px",
              background:   SURF,
              border:       `1px solid ${BORDER}`,
              borderRadius: 12,
              padding:      "20px 24px",
              textAlign:    "left",
            }}>
              {SIGN_CONFIRM_LINES.map((line, i) => (
                <div key={line} style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          12,
                  padding:      "10px 0",
                  borderBottom: i < SIGN_CONFIRM_LINES.length - 1 ? `1px solid ${BORDER}` : "none",
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: GREEN_DIM, border: `1px solid ${GREEN_BORDER}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: GREEN, fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    ✓
                  </div>
                  <span style={{ fontFamily: BODY, fontSize: 15, fontWeight: 600, color: TEXT }}>
                    {line}
                  </span>
                </div>
              ))}
            </div>

            {/* Portal CTA — establishes session before redirecting */}
            <div style={{ maxWidth: 360, margin: "0 auto 12px" }}>
              <button
                onClick={handleEnterPortal}
                disabled={enteringPortal}
                style={{
                  ...css.btnP,
                  width:         "100%",
                  padding:       "15px 44px",
                  fontSize:      13,
                  fontFamily:    UI,
                  fontWeight:    600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  opacity:       enteringPortal ? 0.6 : 1,
                  cursor:        enteringPortal ? "not-allowed" : "pointer",
                }}
              >
                {enteringPortal ? "Opening…" : "Enter My Portal →"}
              </button>
            </div>

            <div style={{ marginTop: 8 }}>
              <a
                href={`/api/pdf?code=${doc.code}${pdfToken ? `&t=${pdfToken}` : ""}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: MUTED, fontFamily: BODY, textDecoration: "none", opacity: 0.5 }}
              >
                Download signed copy (PDF) ↗
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Submission animation overlay ──────────────────────────────────── */}
      {confirmState !== "idle" && (
        <div style={{
          position:       "fixed",
          inset:          0,
          background:     "rgba(17,17,17,0.97)",
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          zIndex:         100,
          animation:      "fadeIn 300ms var(--ease-out)",
        }}>
          {/* Ring + check */}
          <div style={{ position: "relative", width: 72, height: 72, marginBottom: 32 }}>

            {confirmState !== "loading" && (
              <svg width="72" height="72" viewBox="0 0 72 72" style={{ position: "absolute", inset: 0, animation: "ringExpand 400ms var(--ease-spring) both" }}>
                <circle
                  cx="36" cy="36" r="30"
                  fill="none"
                  stroke={confirmState === "check" || confirmState === "checklist" || confirmState === "done"
                    ? "rgba(78,173,135,0.5)"
                    : "rgba(139,107,62,0.3)"}
                  strokeWidth="1.5"
                  style={{ transition: "stroke 300ms ease" }}
                />
                <circle
                  cx="36" cy="36" r="30"
                  fill="none"
                  stroke="#4EAD87"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="188 188"
                  style={{
                    transformOrigin: "50% 50%",
                    transform:       "rotate(-90deg)",
                    transition:      "stroke 300ms ease",
                  }}
                />
              </svg>
            )}

            {/* Loading spinner */}
            {confirmState === "loading" && (
              <div style={{
                position:       "absolute",
                inset:          0,
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
              }}>
                <div style={{
                  width:        36,
                  height:       36,
                  border:       "2px solid rgba(139,107,62,0.2)",
                  borderTop:    "2px solid #8B6B3E",
                  borderRadius: "50%",
                  animation:    "spin 700ms linear infinite",
                }} />
              </div>
            )}

            {/* Check SVG */}
            {(confirmState === "check" || confirmState === "checklist" || confirmState === "done") && (
              <svg width="72" height="72" viewBox="0 0 72 72" style={{ position: "absolute", inset: 0, animation: "scalePop 400ms var(--ease-spring) both" }}>
                <circle cx="36" cy="36" r="28" fill="rgba(78,173,135,0.1)" />
                <polyline
                  points="22,36 31,46 50,26"
                  fill="none" stroke="#4EAD87"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="100" strokeDashoffset="0"
                  style={{ animation: "drawCheck 400ms var(--ease-out) 100ms both" }}
                />
              </svg>
            )}
          </div>

          {/* Status text */}
          {confirmState === "loading" && (
            <div style={{
              fontFamily:    MONO,
              fontSize:      10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color:         "rgba(139,107,62,0.6)",
              animation:     "pulse 1.5s infinite",
            }}>
              Processing signature…
            </div>
          )}

          {confirmState === "check" && (
            <div style={{
              fontFamily:    MONO,
              fontSize:      10,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color:         GREEN,
              animation:     "fadeUp 300ms var(--ease-out) 200ms both",
            }}>
              Signature confirmed
            </div>
          )}

          {/* Checklist */}
          {(confirmState === "checklist" || confirmState === "done") && (
            <div className="stagger" style={{ marginTop: 24, width: "100%", maxWidth: 320, padding: "0 24px" }}>
              {SIGN_CONFIRM_LINES.map((line, i) => (
                <div
                  key={line}
                  style={{
                    display:        "flex",
                    alignItems:     "center",
                    gap:            12,
                    marginBottom:   i < SIGN_CONFIRM_LINES.length - 1 ? 10 : 0,
                    animation:      "stampIn 400ms var(--ease-spring) both",
                    animationDelay: `${i * 150}ms`,
                  }}
                >
                  <div style={{
                    width:          20,
                    height:         20,
                    borderRadius:   "50%",
                    border:         "1.5px solid rgba(78,173,135,0.4)",
                    background:     "rgba(78,173,135,0.08)",
                    display:        "flex",
                    alignItems:     "center",
                    justifyContent: "center",
                    flexShrink:     0,
                    animation:      "scalePop 300ms var(--ease-spring) both",
                    animationDelay: `${i * 150 + 100}ms`,
                  }}>
                    <svg width="10" height="8" viewBox="0 0 10 8">
                      <polyline
                        points="1,4 3.5,7 9,1"
                        fill="none" stroke="#4EAD87"
                        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                        strokeDasharray="20" strokeDashoffset="0"
                        style={{ animation: `drawCheck 250ms var(--ease-out) ${i * 150 + 200}ms both` }}
                      />
                    </svg>
                  </div>
                  <span style={{ fontFamily: BODY, fontSize: 14, color: TEXT, fontWeight: 500 }}>
                    {line}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Continue CTA */}
          {confirmState === "done" && (
            <div style={{ animation: "fadeUp 400ms var(--ease-out) 600ms both", marginTop: 36, width: "100%", maxWidth: 280, padding: "0 24px" }}>
              <button
                onClick={handleEnterPortal}
                disabled={enteringPortal}
                style={{
                  display:        "block",
                  width:          "100%",
                  background:     "#F3F1EC",
                  color:          "#111111",
                  border:         "none",
                  textAlign:      "center",
                  padding:        "15px 28px",
                  borderRadius:   8,
                  fontFamily:     UI,
                  fontSize:       13,
                  fontWeight:     600,
                  letterSpacing:  "0.08em",
                  textTransform:  "uppercase",
                  cursor:         "pointer",
                  boxShadow:      "0 0 40px rgba(139,107,62,0.15)",
                }}
              >
                {enteringPortal ? "Opening…" : "Enter My Portal →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
