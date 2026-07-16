// Safe JSON POST for the comms module.
//
// Returns the parsed `data` payload on success and throws a *clean* Error when
// the server responds with a non-2xx status or a non-JSON body (e.g. an HTML
// 500 page emitted when a required env var is missing). This is the root-cause
// fix for the "join throws a JSON request error" bug: previously every call
// site did `await res.json()` unconditionally, so an HTML error page surfaced
// as an opaque `SyntaxError: Unexpected token '<'` instead of a readable
// message. Centralizes the pattern the CallPanel / ring call sites duplicated.
export async function postJSON<T = unknown>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify(body),
    });
  } catch {
    throw new Error("Network error — check your connection and try again.");
  }

  // Read as text first so a non-JSON body never throws mid-parse.
  const text = await res.text();
  let json: { ok?: boolean; data?: T; error?: string } | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* body was not JSON (HTML error page / proxy error) — handled below */
  }

  if (!res.ok || !json?.ok) {
    const msg =
      json?.error ||
      (res.status >= 500
        ? "Voice service is unavailable right now. Please try again shortly."
        : res.status === 401
        ? "Your session expired. Refresh the page and try again."
        : `Request failed (${res.status}).`);
    throw new Error(msg);
  }

  return json.data as T;
}
