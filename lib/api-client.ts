// ─────────────────────────────────────────────────────────────────────────────
// Frontend API client — all fetch() calls from Client Components live here.
// Never call fetch() directly in components. Import from this file.
// All functions are typed end-to-end with the API response shapes from @/types.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  Doc,
  AgreementInput,
  NotifyInput,
  EmailClientInput,
  ApiResponse,
} from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function post<T>(
  path:    string,
  body:    unknown
): Promise<ApiResponse<T>> {
  const res = await fetch(path, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  return res.json() as Promise<ApiResponse<T>>;
}

async function get<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(path);
  return res.json() as Promise<ApiResponse<T>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

/** Authenticate as admin. Sets httpOnly session cookie on success. */
export async function loginAdmin(
  password: string
): Promise<ApiResponse> {
  return post("/api/auth", { password });
}

/** Clear admin session cookie. */
export async function logoutAdmin(): Promise<ApiResponse> {
  return post("/api/logout", {});
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCS
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch all docs for the admin dashboard (used by SWR polling). */
export async function fetchAllDocs(): Promise<Doc[]> {
  const res = await get<Doc[]>("/api/docs");
  if (!res.ok) throw new Error(res.error);
  return res.data;
}

/** Archive a document. */
export async function archiveDoc(code: string): Promise<ApiResponse> {
  return post(`/api/docs/${code}/archive`, {});
}

// ─────────────────────────────────────────────────────────────────────────────
// AI AGREEMENT GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate an agreement via OpenRouter.
 * Returns the raw agreement text string on success.
 */
export async function generateAgreement(
  input: AgreementInput
): Promise<string> {
  const res = await post<{ text: string }>("/api/generate-agreement", input);
  if (!res.ok) throw new Error(res.error);
  return res.data.text;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send signing notification email to admin.
 * Fire-and-forget — errors are logged but not surfaced to the client.
 */
export async function notifyAdmin(input: NotifyInput): Promise<void> {
  post("/api/notify", input).catch(() => {});
}

/**
 * Send document access link to a client's email.
 */
export async function emailClient(
  input: EmailClientInput
): Promise<ApiResponse> {
  return post("/api/email-client", input);
}
