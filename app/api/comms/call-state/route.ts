// GET /api/comms/call-state?code=XXXXXX&asRole=admin|client
// Real-time ring detection via LiveKit room presence (reliable — no push needed).
// If the OTHER party is currently connected to the call room and I am not, then
// they are waiting on the call for me → I am "ringing". Polled by an open page.
import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";
import { authorizeCommsCaller } from "@/lib/comms-auth";
import { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from "@/lib/env";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") ?? "").toUpperCase();
  const asRole = url.searchParams.get("asRole");

  if (code.length !== 6 || (asRole !== "admin" && asRole !== "client")) {
    return NextResponse.json({ ok: false, error: "Invalid params" }, { status: 400 });
  }

  const caller = await authorizeCommsCaller(code, asRole);
  if (!caller) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const myIdentity   = asRole === "admin" ? "admin" : `client:${code}`;
  const peerIdentity = asRole === "admin" ? `client:${code}` : "admin";

  try {
    const host = LIVEKIT_URL().replace(/^wss:/, "https:").replace(/^ws:/, "http:");
    const svc = new RoomServiceClient(host, LIVEKIT_API_KEY(), LIVEKIT_API_SECRET());
    const participants = await svc.listParticipants(code).catch(() => []);
    const identities = participants.map(p => p.identity);

    const peerPresent = identities.includes(peerIdentity);
    const mePresent   = identities.includes(myIdentity);

    // Ringing = peer is sitting in the call, I haven't joined yet.
    const ringing = peerPresent && !mePresent;

    return NextResponse.json({
      ok: true,
      data: {
        ringing,
        caller: asRole === "admin" ? "them" : "HOS Team",
        peerPresent,
        mePresent,
      },
    });
  } catch (err) {
    // Room doesn't exist / service error → nobody's calling.
    console.error("[comms/call-state] presence check failed:", err);
    return NextResponse.json({ ok: true, data: { ringing: false, caller: "", peerPresent: false, mePresent: false } });
  }
}
