"use client";
import { AMBER, BODY } from "@/lib/styles";
import type { Doc } from "@/types";

function getProgress(doc: Doc): { step: number; label: string } {
  if (doc.payment_status === "paid") return { step: 4, label: "Campaign is active — you're live." };
  if (doc.status === "signed")       return { step: 3, label: "Pay your invoice to begin campaign setup." };
  if (doc.status === "pending")      return { step: 2, label: "Sign your agreement to activate your account." };
  return { step: 1, label: "Your documents are ready to review." };
}

const STEPS = ["Document Received", "Agreement Signed", "Invoice Paid", "Campaign Active"];

interface Props { doc: Doc; }

export function ProgressBanner({ doc }: Props) {
  const { step, label } = getProgress(doc);

  return (
    <div style={{
      background:   "rgba(234,179,8,0.05)",
      borderBottom: "1px solid rgba(234,179,8,0.15)",
      padding:      "14px 24px",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Step dot track */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          {STEPS.map((_, i) => {
            const s      = i + 1;
            const done   = s < step;
            const active = s === step;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
                <div style={{
                  width:          done || active ? 18 : 11,
                  height:         done || active ? 18 : 11,
                  borderRadius:   "50%",
                  background:     done ? "rgba(234,179,8,0.3)" : active ? "rgba(234,179,8,0.12)" : "transparent",
                  border:         `2px solid ${done ? AMBER : active ? "rgba(234,179,8,0.5)" : "rgba(234,179,8,0.15)"}`,
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  fontSize:       8,
                  fontWeight:     700,
                  color:          AMBER,
                  flexShrink:     0,
                  transition:     "all 250ms ease",
                }}>
                  {done ? "✓" : ""}
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{
                    flex:       1,
                    height:     1,
                    background: done ? "rgba(234,179,8,0.35)" : "rgba(234,179,8,0.08)",
                    margin:     "0 6px",
                    transition: "background 300ms ease",
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Label */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontSize:      10,
            fontWeight:    700,
            color:         AMBER,
            fontFamily:    BODY,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            flexShrink:    0,
          }}>
            Step {step} of 4
          </span>
          <span style={{
            fontSize:   12,
            color:      "rgba(234,179,8,0.65)",
            fontFamily: BODY,
            lineHeight: 1.5,
          }}>
            — {label}
          </span>
        </div>
      </div>
    </div>
  );
}
