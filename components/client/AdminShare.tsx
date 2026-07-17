"use client";
import { useState }    from "react";
import { useRouter }   from "next/navigation";
import { toast }       from "sonner";
import { CopyButton }  from "./CopyButton";
import { EventTimeline } from "./EventTimeline";
import { OPERATIONAL_EVENTS } from "@/lib/operational-events";
import {
  AMBER, AMBER_DIM, AMBER_BORDER,
  BODY, BORDER, FONT, GREEN, GREEN_DIM, GREEN_BORDER,
  MONO, MUTED, SUBTLE, TEXT, css,
} from "@/lib/styles";
import { Loader2 }     from "@/components/shared/Icons";
import { HOSLogo }     from "@/components/shared/HOSLogo";
import { emailClient } from "@/lib/api-client";
import type { Doc, DocEvent, PaymentStatus } from "@/types";

interface Props {
  doc:    Doc;
  events: DocEvent[];
  sent?:  boolean;
}

const PAYMENT_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: "unpaid",         label: "Unpaid"         },
  { value: "partially_paid", label: "Partially paid"  },
  { value: "paid",           label: "Paid in full"    },
];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AdminShare({ doc, events, sent: sentProp = false }: Props) {
  const router    = useRouter();
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || "";
  const portalUrl = doc.slug ? `${appUrl}/portal/${doc.slug}` : null;

  const [email, setEmail]     = useState(doc.email ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(sentProp);

  const [payStatus, setPayStatus]   = useState<PaymentStatus>(doc.payment_status ?? "unpaid");
  const [updatingPay, setUpdatingPay] = useState(false);

  // Payment link field
  const [paymentLink, setPaymentLink]       = useState(doc.payment_link ?? "");
  const [savingLink, setSavingLink]         = useState(false);
  const [linkSaved, setLinkSaved]           = useState(false);

  // Operational event posting
  const [opType,     setOpType]    = useState(OPERATIONAL_EVENTS[0].value as string);
  const [opDetail,   setOpDetail]  = useState("");
  const [postingOp,  setPostingOp] = useState(false);

  async function handlePostEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!opType || postingOp) return;
    setPostingOp(true);
    try {
      const res  = await fetch(`/api/docs/${doc.code}/events/post`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ event_type: opType, detail: opDetail.trim() || undefined }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setOpDetail("");
      toast.success("Update posted to client timeline");
      router.refresh();
    } catch (err) {
      toast.error(`Failed: ${String(err)}`);
    } finally {
      setPostingOp(false);
    }
  }

  // "Viewed not signed" indicator
  const viewedEvents    = events.filter(e => e.event_type === "viewed");
  const viewedNotSigned = doc.status === "pending" && viewedEvents.length > 0;
  const lastViewedTs    = viewedEvents.length > 0 ? viewedEvents[viewedEvents.length - 1].created_at : null;

  const suggestedMsg = portalUrl
    ? `Hi ${doc.name}! Your HOS client portal is ready. Access it here: ${portalUrl}\nIf that doesn't work, use code ${doc.code} at ${appUrl}`
    : `Hi ${doc.name}! Your HOS onboarding docs are ready. Go to ${appUrl} and enter code ${doc.code}.`;

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email || sending) return;
    setSending(true);
    try {
      const res = await emailClient({ to: email, name: doc.name, code: doc.code, company: doc.company });
      if (!res.ok) throw new Error(res.error);
      setSent(true);
      toast.success(`Portal email sent to ${email}`);
    } catch (err) {
      toast.error(`Email failed: ${String(err)}`);
    } finally {
      setSending(false);
    }
  }

  async function handleUpdatePayment(status: PaymentStatus) {
    setPayStatus(status);
    setUpdatingPay(true);
    try {
      const res  = await fetch(`/api/docs/${doc.code}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ payment_status: status }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      toast.success(`Payment status updated`);
    } catch (err) {
      toast.error(`Update failed: ${String(err)}`);
      setPayStatus(doc.payment_status ?? "unpaid");
    } finally {
      setUpdatingPay(false);
    }
  }

  async function handleSavePaymentLink(e: React.FormEvent) {
    e.preventDefault();
    setSavingLink(true);
    try {
      const res  = await fetch(`/api/docs/${doc.code}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ payment_link: paymentLink || null }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setLinkSaved(true);
      toast.success("Payment link saved");
      setTimeout(() => setLinkSaved(false), 3000);
    } catch (err) {
      toast.error(`Failed to save: ${String(err)}`);
    } finally {
      setSavingLink(false);
    }
  }

  const sectionLabel: React.CSSProperties = {
    fontSize:      10,
    letterSpacing: "1.2px",
    fontWeight:    700,
    color:         SUBTLE,
    fontFamily:    BODY,
    marginBottom:  12,
    textTransform: "uppercase",
  };

  return (
    <div style={{ ...css.app, minHeight: "100vh" }}>
      {/* Top bar */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "0" }}>
        <div style={{ maxWidth: 580, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => router.push("/admin")} style={{ ...css.btnS, padding: "7px 14px", fontSize: 12 }}>
              ← Dashboard
            </button>
            <HOSLogo size={24} theme="dark" showWordmark={false} />
            <div>
              <div style={{ fontSize: 9, letterSpacing: "2px", color: MUTED, fontFamily: BODY, fontWeight: 700 }}>HOS AUTOMATIONS</div>
              <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: TEXT }}>SHARE DOCUMENT</div>
            </div>
          </div>
          <button onClick={() => router.push("/admin/new")} style={{ ...css.btnS, padding: "7px 14px", fontSize: 12 }}>
            New doc
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 580, margin: "0 auto", padding: "28px 20px 80px" }}>

        {/* Client name */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, letterSpacing: "1.5px", fontWeight: 700, color: MUTED, fontFamily: BODY, marginBottom: 5 }}>
            Document for
          </div>
          <div style={{ fontFamily: BODY, fontSize: 26, fontWeight: 700, letterSpacing: "-0.3px", color: TEXT }}>
            {doc.name}
          </div>
          {doc.company && (
            <div style={{ fontSize: 13, color: MUTED, marginTop: 3, fontFamily: BODY }}>{doc.company}</div>
          )}
        </div>

        {/* "Viewed not signed" warning */}
        {viewedNotSigned && lastViewedTs && (
          <div style={{
            background:   AMBER_DIM,
            border:       `1px solid ${AMBER_BORDER}`,
            borderRadius: 10,
            padding:      "14px 18px",
            marginBottom: 16,
            display:      "flex",
            alignItems:   "flex-start",
            gap:          12,
          }}>
            <span style={{ color: AMBER, fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: AMBER, fontFamily: BODY, marginBottom: 3 }}>
                Client viewed but hasn&apos;t signed
              </div>
              <div style={{ fontSize: 12, color: MUTED, fontFamily: BODY, lineHeight: 1.6 }}>
                Last viewed {relativeTime(lastViewedTs)}. Consider a follow-up or resending the magic link.
              </div>
            </div>
          </div>
        )}

        {/* 1. Send Magic Link Email */}
        <div style={{ ...css.card, marginBottom: 12 }}>
          <div style={sectionLabel}>Send magic link email</div>

          {sent ? (
            <div style={{
              background:   GREEN_DIM,
              border:       `1px solid ${GREEN_BORDER}`,
              borderRadius: 8,
              padding:      "14px 16px",
              display:      "flex",
              alignItems:   "center",
              gap:          10,
              fontSize:     13,
              color:        GREEN,
              fontFamily:   BODY,
            }}>
              <span style={{ fontWeight: 700 }}>✓</span>
              Email sent — client has a one-click magic link and backup code.
              <button
                onClick={() => setSent(false)}
                style={{ marginLeft: "auto", background: "none", border: "none", color: GREEN, fontSize: 12, cursor: "pointer", padding: 0, opacity: 0.6 }}
              >
                Resend
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendEmail} style={{ display: "flex", gap: 8 }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="client@example.com"
                required
                style={{ ...css.inp, flex: 1 }}
              />
              <button
                type="submit"
                disabled={sending || !email}
                style={{
                  ...css.btnP,
                  padding:   "10px 18px",
                  fontSize:  13,
                  flexShrink: 0,
                  opacity:   sending || !email ? 0.4 : 1,
                  minHeight: 44,
                }}
              >
                {sending && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
                {sending ? "Sending…" : "Send →"}
              </button>
            </form>
          )}
          <p style={{ fontSize: 11, color: SUBTLE, marginTop: 10, fontFamily: BODY, lineHeight: 1.5 }}>
            Sends a branded email with a one-click magic link. Access code included as fallback.
          </p>
        </div>

        {/* 2. Portal URL */}
        {portalUrl && (
          <div style={{ ...css.card, marginBottom: 12 }}>
            <div style={sectionLabel}>Client portal URL</div>
            <div style={{
              background:   "rgba(255,255,255,0.02)",
              border:       `1px solid ${BORDER}`,
              borderRadius: 8,
              padding:      "10px 14px",
              fontFamily:   MONO,
              fontSize:     12,
              color:        MUTED,
              wordBreak:    "break-all",
              marginBottom: 10,
            }}>
              {portalUrl}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <CopyButton text={portalUrl} label="Copy URL" variant="secondary" />
              <button
                onClick={() => window.open(portalUrl, "_blank")}
                style={{ ...css.btnS, padding: "7px 14px", fontSize: 12 }}
              >
                Preview
              </button>
            </div>
          </div>
        )}

        {/* 3. Backup Access Code */}
        <div style={{ ...css.card, marginBottom: 12, textAlign: "center" }}>
          <div style={sectionLabel}>Backup access code</div>
          <div style={{ fontFamily: MONO, fontSize: 36, fontWeight: 700, letterSpacing: "8px", color: TEXT, marginBottom: 14 }}>
            {doc.code}
          </div>
          <div style={{ fontSize: 11, color: SUBTLE, marginBottom: 14, fontFamily: BODY }}>
            Use at <span style={{ color: MUTED }}>{appUrl || "hosautomations.co"}</span> if the magic link doesn&apos;t work.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <CopyButton text={doc.code} label="Copy code" variant="secondary" />
            <button
              onClick={() => window.open(`/api/pdf?code=${doc.code}`, "_blank")}
              style={{ ...css.btnS, padding: "7px 14px", fontSize: 12 }}
            >
              PDF ↗
            </button>
          </div>
        </div>

        {/* 4. Payment */}
        <div style={{ ...css.card, marginBottom: 12 }}>
          <div style={sectionLabel}>Payment</div>

          {/* Status */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...css.lbl, marginBottom: 6 }}>Status</label>
            <select
              value={payStatus}
              onChange={e => handleUpdatePayment(e.target.value as PaymentStatus)}
              disabled={updatingPay}
              style={{ ...css.inp, maxWidth: 220, cursor: "pointer", opacity: updatingPay ? 0.5 : 1 }}
            >
              {PAYMENT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {updatingPay && (
              <span style={{ fontSize: 12, color: MUTED, fontFamily: BODY, marginLeft: 10 }}>Saving…</span>
            )}
          </div>

          {/* Payment Link */}
          <form onSubmit={handleSavePaymentLink}>
            <label style={{ ...css.lbl, marginBottom: 6 }}>Payment Link</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="url"
                value={paymentLink}
                onChange={e => { setPaymentLink(e.target.value); setLinkSaved(false); }}
                placeholder="https://pay.example.com/..."
                style={{ ...css.inp, flex: 1 }}
              />
              <button
                type="submit"
                disabled={savingLink}
                style={{
                  ...css.btnS,
                  padding:     "10px 14px",
                  fontSize:    12,
                  flexShrink:  0,
                  opacity:     savingLink ? 0.5 : 1,
                  color:       linkSaved ? GREEN : MUTED,
                  borderColor: linkSaved ? GREEN_BORDER : BORDER,
                }}
              >
                {savingLink ? "Saving…" : linkSaved ? "✓ Saved" : "Save"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: SUBTLE, marginTop: 6, fontFamily: BODY, lineHeight: 1.5 }}>
              Paste any payment URL. Shown to client as a &quot;Pay Now&quot; button in their portal.
            </p>
          </form>
        </div>

        {/* 5. Campaign Performance → dedicated page */}
        <div style={{ ...css.card, marginBottom: 12 }}>
          <div style={sectionLabel}>Campaign Performance</div>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: MUTED, margin: "0 0 12px", lineHeight: 1.6 }}>
            Enter calls, budget spend, and daily data to update the client&apos;s dashboard.
          </p>
          <button
            onClick={() => router.push(`/admin/stats?code=${doc.code}`)}
            style={{ ...css.btnS, width: "100%", padding: "12px 20px" }}
          >
            Open Stats Page →
          </button>
        </div>

        {/* 6. Suggested message */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ ...sectionLabel, marginBottom: 10 }}>Suggested WhatsApp / SMS message</div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
            {suggestedMsg}
          </div>
          <div style={{ marginTop: 12 }}>
            <CopyButton text={suggestedMsg} label="Copy message" variant="secondary" />
          </div>
        </div>

        {/* 7. Post operational update */}
        <div style={{ ...css.card, marginBottom: 12 }}>
          <div style={sectionLabel}>Post client update</div>
          <form onSubmit={handlePostEvent}>
            <div style={{ marginBottom: 10 }}>
              <label style={css.lbl}>Update type</label>
              <select
                value={opType}
                onChange={e => setOpType(e.target.value)}
                style={{ ...css.inp, cursor: "pointer" }}
              >
                {OPERATIONAL_EVENTS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={css.lbl}>Detail (optional — shown to client)</label>
              <input
                type="text"
                value={opDetail}
                onChange={e => setOpDetail(e.target.value)}
                placeholder="e.g. First qualified calls arriving this week."
                style={css.inp}
                maxLength={500}
              />
            </div>
            <button
              type="submit"
              disabled={postingOp}
              style={{ ...css.btnP, padding: "9px 20px", fontSize: 13, opacity: postingOp ? 0.5 : 1 }}
            >
              {postingOp ? "Posting…" : "Post update →"}
            </button>
          </form>
        </div>

        {/* 8. Event timeline */}
        {events.length > 0 && (
          <div style={{ ...css.card, marginBottom: 16 }}>
            <div style={sectionLabel}>Activity timeline</div>
            <EventTimeline events={events} />
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 8 }}>
          <button onClick={() => router.push("/admin")} style={{ ...css.btnP, padding: "12px 28px", fontSize: 14 }}>
            Dashboard →
          </button>
          <button onClick={() => router.push(`/admin/edit/${doc.code}`)} style={css.btnS}>
            Edit doc
          </button>
        </div>
      </div>
    </div>
  );
}
