"use client";
// Shared between portal /status tab and the done/confirmation page.
// Reflects real doc state where possible; remaining steps shown as upcoming.
import type { Doc, DocEvent } from "@/types";
import { fmtDateTime }        from "@/lib/utils";
import { GREEN, MUTED, SURF, BORDER, TEXT, BODY, FONT } from "@/lib/styles";

interface Step {
  key:       string;
  label:     string;
  sub:       string;
  done:      boolean;
  ts?:       string | null;
}

function buildSteps(doc: Doc, events: DocEvent[]): Step[] {
  const isSigned  = doc.status === "signed";
  const isPaid    = doc.payment_status === "paid";
  const eventTs   = (type: string) =>
    events.find(e => e.event_type === type)?.created_at ?? null;

  return [
    {
      key:   "sent",
      label: "Agreement Sent",
      sub:   "Your onboarding documents were prepared and sent.",
      done:  true,
      ts:    doc.created_at,
    },
    {
      key:   "viewed",
      label: "Agreement Reviewed",
      sub:   "You opened and reviewed the documents.",
      done:  !!eventTs("viewed") || isSigned,
      ts:    eventTs("viewed"),
    },
    {
      key:   "signed",
      label: "Agreement Signed",
      sub:   "Your digital signature was recorded.",
      done:  isSigned,
      ts:    doc.signed_at,
    },
    {
      key:   "activated",
      label: "Client Activated",
      sub:   "Your account is live in our system.",
      done:  isSigned,
      ts:    isSigned ? doc.signed_at : null,
    },
    {
      key:   "invoice",
      label: "Invoice Issued",
      sub:   "Your first invoice is ready for review.",
      done:  isSigned,
      ts:    isSigned ? doc.signed_at : null,
    },
    {
      key:   "paid",
      label: "Invoice Paid",
      sub:   "Payment received — thank you.",
      done:  isPaid,
      ts:    isPaid ? eventTs("payment_updated") : null,
    },
    {
      key:   "queued",
      label: "Campaign Queued",
      sub:   "Your campaign is in the launch queue.",
      done:  isPaid,
      ts:    isPaid ? eventTs("payment_updated") : null,
    },
    {
      key:   "setup",
      label: "Campaign Setup",
      sub:   "Ad accounts, targeting, and creatives configured.",
      done:  false,
      ts:    null,
    },
    {
      key:   "review",
      label: "Ad Account Review",
      sub:   "Final compliance and quality check.",
      done:  false,
      ts:    null,
    },
    {
      key:   "live",
      label: "Launching",
      sub:   "Live calls starting to route to your team.",
      done:  false,
      ts:    null,
    },
  ];
}

interface Props {
  doc:     Doc;
  events:  DocEvent[];
  compact?: boolean;
}

export function StatusTracker({ doc, events, compact = false }: Props) {
  const steps = buildSteps(doc, events);

  return (
    <div style={{ position: "relative" }}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const dotColor = step.done ? GREEN : BORDER;
        const lineColor = step.done ? "rgba(34,197,94,0.2)" : "#141414";

        return (
          <div
            key={step.key}
            style={{
              display:     "flex",
              gap:         compact ? 14 : 18,
              paddingBottom: isLast ? 0 : (compact ? 18 : 24),
              animation:   step.done ? "fadeIn 250ms ease-out both" : undefined,
              animationDelay: step.done ? `${i * 40}ms` : undefined,
            }}
          >
            {/* Timeline column */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: 20 }}>
              {/* Dot */}
              <div style={{
                width:        step.done ? 20 : 14,
                height:       step.done ? 20 : 14,
                borderRadius: "50%",
                border:       `2px solid ${dotColor}`,
                background:   step.done ? "rgba(34,197,94,0.12)" : "transparent",
                display:      "flex",
                alignItems:   "center",
                justifyContent: "center",
                flexShrink:   0,
                marginTop:    2,
                transition:   "all 250ms ease",
              }}>
                {step.done && (
                  <span style={{ color: GREEN, fontSize: 10, fontWeight: 700, lineHeight: 1 }}>✓</span>
                )}
              </div>
              {/* Connector line */}
              {!isLast && (
                <div style={{
                  width:      1,
                  flex:       1,
                  background: lineColor,
                  marginTop:  4,
                  minHeight:  compact ? 18 : 24,
                  transition: "background 250ms ease",
                }} />
              )}
            </div>

            {/* Content */}
            <div style={{ paddingTop: 1, flex: 1 }}>
              <div style={{
                fontFamily:    FONT,
                fontSize:      compact ? 13 : 15,
                fontWeight:    700,
                color:         step.done ? TEXT : "#2a2a2a",
                letterSpacing: "0.2px",
                marginBottom:  compact ? 0 : 2,
                transition:    "color 250ms ease",
              }}>
                {step.label}
              </div>
              {!compact && (
                <div style={{ fontSize: 12, color: step.done ? MUTED : "#222", lineHeight: 1.5, marginBottom: step.ts ? 3 : 0 }}>
                  {step.sub}
                </div>
              )}
              {step.ts && step.done && (
                <div style={{ fontSize: 11, color: "#2d5c3a", fontFamily: BODY }}>
                  {fmtDateTime(step.ts)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
