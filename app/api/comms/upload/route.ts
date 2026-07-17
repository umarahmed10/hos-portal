// POST /api/comms/upload — upload a file to Supabase Storage for chat attachments
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authorizeCommsCaller } from "@/lib/comms-auth";
import { rateLimit } from "@/lib/rate-limit";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
]);

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, svcKey, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const rl = rateLimit("upload:comms", { windowMs: 60_000, max: 10 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Too many uploads" }, { status: 429 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const code = formData.get("code") as string | null;
  const asRole = formData.get("asRole") as string | null;

  if (!file || !code || code.length !== 6 || !asRole || !["admin", "client"].includes(asRole)) {
    return NextResponse.json({ ok: false, error: "file, code, and asRole required" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: "File too large (max 10 MB)" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ ok: false, error: "File type not supported" }, { status: 400 });
  }

  const caller = await authorizeCommsCaller(code, asRole as "admin" | "client");
  if (!caller) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const ext = file.name.split(".").pop() || "bin";
  const safeName = `${code}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const buf = await file.arrayBuffer();
  const supabase = db();

  const { error: uploadError } = await supabase.storage
    .from("comms-attachments")
    .upload(safeName, buf, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[comms/upload] Storage error:", uploadError);
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("comms-attachments")
    .getPublicUrl(safeName);

  return NextResponse.json({
    ok: true,
    data: {
      url: urlData.publicUrl,
      filename: file.name,
      size: file.size,
      type: file.type,
    },
  });
}
