// Operational event vocabulary — types posted by admin via AdminShare,
// displayed to the client in OperationalTimeline on the portal status page.

export const OPERATIONAL_EVENTS = [
  { value: "account_note",        label: "Account note",              icon: "◎", color: "#727272" },
  { value: "campaign_launched",   label: "Campaign launched",         icon: "→", color: "#4EAD87" },
  { value: "campaign_paused",     label: "Campaign paused",           icon: "⏸", color: "#D4926A" },
  { value: "campaign_resumed",    label: "Campaign resumed",          icon: "▶", color: "#4EAD87" },
  { value: "lead_milestone",      label: "Lead milestone reached",    icon: "✓", color: "#4EAD87" },
  { value: "ad_spend_update",     label: "Ad spend updated",          icon: "$", color: "#8B6B3E" },
  { value: "payment_received",    label: "Payment received",          icon: "✓", color: "#4EAD87" },
  { value: "onboarding_complete", label: "Onboarding complete",       icon: "✓", color: "#4EAD87" },
  { value: "weekly_report",       label: "Weekly report posted",      icon: "◈", color: "#8B6B3E" },
  { value: "admin_message",       label: "Message from HOS",          icon: "✉", color: "#8B6B3E" },
] as const;

export type OperationalEventValue = typeof OPERATIONAL_EVENTS[number]["value"];

// System events (auto-logged by the app, not posted by admin)
export const SYSTEM_EVENT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  created:         { label: "Document created",         icon: "◎", color: "#555555" },
  email_sent:      { label: "Access email sent",        icon: "✉", color: "#8B6B3E" },
  viewed:          { label: "Document viewed",          icon: "◈", color: "#D4926A" },
  signed:          { label: "Agreement signed",         icon: "✓", color: "#4EAD87" },
  invoice_viewed:  { label: "Invoice viewed",           icon: "◈", color: "#D4926A" },
  payment_updated: { label: "Payment status updated",   icon: "$", color: "#4EAD87" },
};

export function getEventMeta(eventType: string): { label: string; icon: string; color: string } {
  const op = OPERATIONAL_EVENTS.find(e => e.value === eventType);
  if (op) return { label: op.label, icon: op.icon, color: op.color };
  return SYSTEM_EVENT_LABELS[eventType] ?? { label: eventType, icon: "·", color: "#555555" };
}
