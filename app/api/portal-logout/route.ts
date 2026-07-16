// POST /api/portal-logout — clears the portal session cookie.
import { NextResponse }          from "next/server";
import { buildClearPortalCookie } from "@/lib/portal-auth";

export async function POST() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": buildClearPortalCookie() } }
  );
}
