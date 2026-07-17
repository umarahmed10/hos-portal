// POST /api/comms/token — mint a short-lived LiveKit access token.
// Body: { code: string, asRole: "admin" | "client" }
// Room name = code. Identity = "admin" or "client:<code>".
import { NextResponse } from "next/server";
import { z }            from "zod";
import { AccessToken }  from "livekit-server-sdk";
import { authorizeCommsCaller } from "@/lib/comms-auth";
import { getDocByCode }         from "@/lib/data-access";
import { rateLimit }            from "@/lib/rate-limit";
import {
  LIVEKIT_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
} from "@/lib/env";

const Body = z.object({
  code:   z.string().length(6),
  asRole: z.enum(["admin", "client"]),
});

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = rateLimit(`token:${ip}`, { windowMs: 60_000, max: 10 });
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }
  const code = parsed.data.code.toUpperCase();

  const caller = await authorizeCommsCaller(code, parsed.data.asRole);
  if (!caller) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Resolve display names so each side can label the peer in the UI.
    const doc        = await getDocByCode(code);
    const clientName = doc?.name ?? `Client ${code}`;
    const identity   = caller.role === "admin" ? "admin"    : `client:${code}`;
    const myName     = caller.role === "admin" ? "HOS Team" : clientName;
    const peerName   = caller.role === "admin" ? clientName : "HOS Team";

    // Env accessors throw synchronously when a LIVEKIT_* var is unset. Guarded
    // here so misconfiguration surfaces as a readable JSON error instead of an
    // HTML 500 that the client blindly parses (the admin-join bug).
    const at = new AccessToken(LIVEKIT_API_KEY(), LIVEKIT_API_SECRET(), {
      identity,
      name: myName,
      ttl:  60 * 60, // 1h
    });
    at.addGrant({
      room:         code,
      roomJoin:     true,
      canPublish:   true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await at.toJwt();

    return NextResponse.json({
      ok:   true,
      data: {
        token:    jwt,
        url:      LIVEKIT_URL(),
        room:     code,
        identity,
        peerName,
      },
    });
  } catch (err) {
    const missingEnv = err instanceof Error && err.message.includes("[env]");
    console.error("[comms/token] failed to mint token:", err);
    return NextResponse.json(
      {
        ok:    false,
        error: missingEnv
          ? "Voice service is not configured. Set the LIVEKIT_* environment variables."
          : "Could not start the call. Please try again.",
      },
      { status: missingEnv ? 503 : 500 },
    );
  }
}
