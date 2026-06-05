// POST /api/portal-session — validate magic token + code, issue portal session cookie.
// Called from the portal entry page after client enters their 6-char code.
import { NextResponse } from "next/server";
import { z }            from "zod";
import { createHash }   from "crypto";
import { getDocBySlug } from "@/lib/data-access";
import { signPortalToken, buildPortalCookie } from "@/lib/portal-auth";

const Schema = z.object({
  slug:        z.string().min(1),
  code:        z.string().length(6),
  magicToken:  z.string().optional(),
});

export async function POST(req: Request) {
  const body   = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation error" },
      { status: 400 }
    );
  }

  const { slug, code, magicToken } = parsed.data;

  const doc = await getDocBySlug(slug);

  if (!doc) {
    return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
  }

  // Validate the 6-char code
  if (doc.code.toUpperCase() !== code.toUpperCase()) {
    return NextResponse.json({ ok: false, error: "Incorrect access code" }, { status: 401 });
  }

  // If a magic token was provided, validate it against the stored hash
  if (magicToken && doc.magic_token_hash) {
    const hash = createHash("sha256").update(magicToken).digest("hex");
    if (hash !== doc.magic_token_hash) {
      return NextResponse.json({ ok: false, error: "Invalid magic link" }, { status: 401 });
    }
  }

  // Issue portal session cookie
  const token  = await signPortalToken(doc.id, slug);
  const cookie = buildPortalCookie(token);

  return NextResponse.json(
    { ok: true, data: { slug, doc_id: doc.id } },
    { headers: { "Set-Cookie": cookie } }
  );
}
