// POST /api/portal-session — validate credentials and issue portal session cookie.
// Three valid paths:
//   1. Magic token only  (slug + magicToken)  — one-click from email link
//   2. Code + slug       (slug + code)         — existing flow with known slug
//   3. Code only         (code)                — sign-to-portal handoff, no slug needed
import { NextResponse } from "next/server";
import { z }            from "zod";
import { createHash }   from "crypto";
import { getDocBySlug, getDocByCode } from "@/lib/data-access";
import { signPortalToken, buildPortalCookie } from "@/lib/portal-auth";
import type { Doc } from "@/types";

const Schema = z.object({
  slug:        z.string().min(1).optional(),
  code:        z.string().length(6).optional(),
  magicToken:  z.string().optional(),
});

export async function POST(req: Request) {
  const body   = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation error" }, { status: 400 });
  }

  const { slug, code, magicToken } = parsed.data;

  if (!code && !magicToken) {
    return NextResponse.json({ ok: false, error: "Access code or magic link required" }, { status: 400 });
  }

  let doc: Doc | null = null;

  // ── Path 1: magic-token-only (one-click from email link) ───────────────────
  if (magicToken && !code) {
    if (!slug) {
      return NextResponse.json({ ok: false, error: "Slug required for magic link" }, { status: 400 });
    }
    doc = await getDocBySlug(slug);
    if (!doc) {
      return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
    }
    if (!doc.magic_token_hash) {
      return NextResponse.json({ ok: false, error: "No magic link on file — use your access code" }, { status: 401 });
    }
    const hash = createHash("sha256").update(magicToken).digest("hex");
    if (hash !== doc.magic_token_hash) {
      return NextResponse.json({ ok: false, error: "Invalid or expired link — use your access code instead" }, { status: 401 });
    }
    const expiresAt = (doc as unknown as Record<string, unknown>).magic_token_expires_at as string | null;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return NextResponse.json({ ok: false, error: "This magic link has expired — use your access code instead" }, { status: 401 });
    }
  }

  // ── Path 2/3: code-based (slug optional) ──────────────────────────────────
  if (code) {
    if (slug) {
      // Slug provided — try slug lookup first for speed, fallback to code lookup
      doc = await getDocBySlug(slug);
      if (!doc || doc.code.toUpperCase() !== code.toUpperCase()) {
        // Slug mismatch or not found — fall back to code lookup (slug may have changed)
        doc = await getDocByCode(code);
      }
    } else {
      // No slug — look up by code only
      doc = await getDocByCode(code);
    }

    if (!doc) {
      return NextResponse.json({ ok: false, error: "Invalid access code" }, { status: 401 });
    }

    if (doc.code.toUpperCase() !== code.toUpperCase()) {
      return NextResponse.json({ ok: false, error: "Incorrect access code" }, { status: 401 });
    }

    // Optional magic token cross-check when both are provided
    if (magicToken && doc.magic_token_hash) {
      const hash = createHash("sha256").update(magicToken).digest("hex");
      if (hash !== doc.magic_token_hash) {
        return NextResponse.json({ ok: false, error: "Invalid magic link" }, { status: 401 });
      }
    }
  }

  if (!doc) {
    return NextResponse.json({ ok: false, error: "Authentication failed" }, { status: 401 });
  }

  if (doc.status === "archived") {
    return NextResponse.json({ ok: false, error: "This document has been archived" }, { status: 403 });
  }

  // Use the doc's actual slug — always redirect client to the canonical slug
  const portalSlug = doc.slug ?? doc.code.toLowerCase();

  const token  = await signPortalToken(doc.id, portalSlug);
  const cookie = buildPortalCookie(token);
  return NextResponse.json(
    { ok: true, data: { slug: portalSlug, doc_id: doc.id } },
    { headers: { "Set-Cookie": cookie } }
  );
}
