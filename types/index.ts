// ─────────────────────────────────────────────────────────────────────────────
// HOS Client Portal — Shared Types
// Single source of truth. Import from '@/types' everywhere.
// Mirrors schema.sql exactly — column names and value sets must stay in sync.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE ENUMS
// ─────────────────────────────────────────────────────────────────────────────
export type DocStatus     = "draft" | "pending" | "signed" | "archived";
export type DocType       = "both" | "agreement" | "invoice";
export type PaymentStatus = "unpaid" | "partially_paid" | "paid";

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN: Invoice line item stored as JSONB in docs.items
// ─────────────────────────────────────────────────────────────────────────────
export interface DocItem {
  id:    number;
  desc:  string;
  qty:   string;
  price: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN: Full document row (matches docs table 1:1)
// ─────────────────────────────────────────────────────────────────────────────
export interface Doc {
  id:             string;
  code:           string;
  status:         DocStatus;
  type:           DocType;

  // Client details
  name:           string;
  company:        string | null;
  service:        string | null;
  service_type:   string | null;
  service_area:   string | null;
  date:           string | null;
  fee:            string | null;

  // Agreement
  agreement_text: string | null;

  // Invoice
  items:          DocItem[];
  invoice_total:  number;
  due_date:       string | null;
  pay_notes:      string | null;

  // Payment
  payment_status: PaymentStatus;
  amount_paid:    number;

  // Magic link / portal
  slug:                string | null;
  magic_token_hash:    string | null;

  // Access tracking
  first_view_ip:  string | null;
  first_view_ua:  string | null;
  signed_ip:      string | null;
  signed_ua:      string | null;

  // E-sign compliance
  accepted_esign_terms: boolean;

  // Signature
  signature:      string | null;
  signed_at:      string | null;

  // Audit
  created_at:     string;
  updated_at:     string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN: Audit event (matches doc_events table 1:1)
// ─────────────────────────────────────────────────────────────────────────────
export type DocEventType =
  | "created"
  | "email_sent"
  | "viewed"
  | "signed"
  | "invoice_viewed"
  | "payment_updated";

export interface DocEvent {
  id:         string;
  doc_id:     string;
  event_type: DocEventType;
  metadata:   Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT: Create document (omits server-generated fields)
// ─────────────────────────────────────────────────────────────────────────────
export interface CreateDocInput {
  code:           string;
  status:         DocStatus;
  type:           DocType;
  name:           string;
  company?:       string;
  service?:       string;
  service_type?:  string;
  service_area?:  string;
  date?:          string;
  fee?:           string;
  agreement_text?: string;
  items:          DocItem[];
  invoice_total:  number;
  due_date?:      string;
  pay_notes?:     string;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT: Update document (all fields optional except code)
// ─────────────────────────────────────────────────────────────────────────────
export type UpdateDocInput = Partial<Omit<CreateDocInput, "code">> & {
  payment_status?:      PaymentStatus;
  amount_paid?:         number;
  slug?:                string;
  magic_token_hash?:    string;
  first_view_ip?:       string;
  first_view_ua?:       string;
  signed_ip?:           string;
  signed_ua?:           string;
  accepted_esign_terms?: boolean;
  signature?:           string;
  signed_at?:           string;
};

// ─────────────────────────────────────────────────────────────────────────────
// INPUT: Agreement generation (sent to /api/generate-agreement)
// ─────────────────────────────────────────────────────────────────────────────
export interface AgreementInput {
  name:         string;
  company?:     string;
  service_type?: string;
  service_area?: string;
  fee?:         string;
  date?:        string;
  terms?:       string;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT: Email notification (sent to /api/notify)
// ─────────────────────────────────────────────────────────────────────────────
export interface NotifyInput {
  name:         string;
  company?:     string | null;
  service?:     string | null;
  invoiceTotal: string;
  signedAt:     string;
  code:         string;
}

// ─────────────────────────────────────────────────────────────────────────────
// INPUT: Send doc link to client email (sent to /api/email-client)
// ─────────────────────────────────────────────────────────────────────────────
export interface EmailClientInput {
  to:      string;
  name:    string;
  code:    string;
  company?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// API RESPONSES
// ─────────────────────────────────────────────────────────────────────────────
export type ApiSuccess<T = void> = T extends void
  ? { ok: true }
  : { ok: true; data: T };

export interface ApiError {
  ok:      false;
  error:   string;
  details?: string;
}

export type ApiResponse<T = void> = ApiSuccess<T> | ApiError;

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────
export interface AdminJwtPayload {
  role:  "admin";
  iat?:  number;
  exp?:  number;
}

export interface PortalJwtPayload {
  role:   "portal_client";
  doc_id: string;
  slug:   string;
  iat?:   number;
  exp?:   number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE TYPES (dropdown options for the form)
// ─────────────────────────────────────────────────────────────────────────────
export const SERVICE_TYPES = [
  "Plumbing",
  "HVAC",
  "Plumbing + HVAC",
  "Emergency Only",
  "Maintenance Plans",
  "Drain Cleaning",
  "Water Heater",
  "Other",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// TERMS TEMPLATES (one-click populate in AdminForm)
// ─────────────────────────────────────────────────────────────────────────────
export interface TermsTemplate {
  label:       string;
  description: string;
  body:        string;
}

export const TERMS_TEMPLATES: TermsTemplate[] = [
  {
    label: "Standard",
    description: "Per-call, weekly invoicing, 7-day cancel",
    body: "We generate live inbound calls from homeowners seeking [service_type] services in [service_area]. Client pays $[fee] per qualified call (minimum 60 seconds, genuine homeowner, within service area). No setup fees, no retainers. Either party can cancel with 7 days written notice. Calls logged weekly, invoiced every Monday.",
  },
  {
    label: "HVAC Premium",
    description: "24/7 emergency included, weekly reporting",
    body: "Qualified inbound HVAC calls from homeowners in [service_area]. $[fee] per call over 60 seconds. 24/7 emergency calls included. Weekly performance reporting. Cancel anytime with 7 days written notice.",
  },
  {
    label: "Emergency Only",
    description: "After-hours, 90-second minimum, premium rate",
    body: "After-hours emergency plumbing/HVAC calls in [service_area]. $[fee] per qualified call. Minimum 90 seconds. Premium rate applies for nights and weekends. Cancel with 7 days written notice.",
  },
];
