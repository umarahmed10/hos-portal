// POST /api/email-client — send portal access email with magic link + code fallback.
// to/name/company are optional — falls back to doc fields if not supplied.
import { NextResponse }        from "next/server";
import { getAdminSession }     from "@/lib/auth";
import { sendPortalEmail }     from "@/lib/send-portal-email";
import { z }                   from "zod";

const Schema = z.object({
  code:    z.string().length(6),
  to:      z.string().email().optional(),
  name:    z.string().min(1).optional(),
  company: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body   = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation error", details: parsed.error.message }, { status: 400 });
  }

  const { code, to, name, company } = parsed.data;

  const result = await sendPortalEmail({ code, to, name, company });

  if (!result.ok) {
    const status = result.error?.includes("not found") ? 404
                 : result.error?.includes("No email")  ? 422
                 : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
