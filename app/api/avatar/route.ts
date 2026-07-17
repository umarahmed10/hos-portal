// GET  /api/avatar?code=XXXXXX — get avatar URL for a client
// POST /api/avatar — upload avatar image
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, svcKey, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code || code.length !== 6) {
    return NextResponse.json({ ok: false, error: "code required" }, { status: 400 });
  }

  const supabase = db();
  const { data } = await supabase.storage.from("avatars").list(code.toUpperCase(), { limit: 1 });

  if (!data || data.length === 0) {
    return NextResponse.json({ ok: true, data: { url: null } });
  }

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(`${code.toUpperCase()}/${data[0].name}`);
  return NextResponse.json({ ok: true, data: { url: urlData.publicUrl } });
}

export async function POST(req: Request) {
  const rl = rateLimit("avatar:upload", { windowMs: 60_000, max: 5 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Too many uploads" }, { status: 429 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const code = formData.get("code") as string | null;

  if (!file || !code || code.length !== 6) {
    return NextResponse.json({ ok: false, error: "file and code required" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: "Image too large (max 2 MB)" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ ok: false, error: "Only JPEG, PNG, WebP, or GIF" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${code.toUpperCase()}/avatar.${ext}`;
  const buf = await file.arrayBuffer();
  const supabase = db();

  // Delete old avatar(s) first
  const { data: existing } = await supabase.storage.from("avatars").list(code.toUpperCase());
  if (existing && existing.length > 0) {
    await supabase.storage.from("avatars").remove(existing.map(f => `${code.toUpperCase()}/${f.name}`));
  }

  const { error } = await supabase.storage.from("avatars").upload(path, buf, {
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    console.error("[avatar] Upload error:", error);
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
  return NextResponse.json({ ok: true, data: { url: urlData.publicUrl } });
}
