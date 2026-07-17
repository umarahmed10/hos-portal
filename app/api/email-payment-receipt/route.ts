import { NextResponse } from "next/server";
import { z }           from "zod";
import { Resend }      from "resend";
import { money }       from "@/lib/utils";

const Schema = z.object({
  to:         z.string().email(),
  name:       z.string(),
  company:    z.string().nullable().optional(),
  amount:     z.number().positive(),
  sessionId:  z.string().optional(),
  portalSlug: z.string().optional(),
});

export async function POST(req: Request) {
  const headerSecret = req.headers.get("x-internal-secret");
  if (!process.env.INTERNAL_SECRET || headerSecret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body   = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation error" }, { status: 400 });
  }

  const { to, name, company, amount, portalSlug } = parsed.data;
  const fromEmail = process.env.RESEND_FROM || process.env.RESEND_FROM_EMAIL || "solutions@hosautomations.co";
  const apiKey    = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "RESEND_API_KEY not configured" }, { status: 500 });

  const resend = new Resend(apiKey);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const hosMarkSvg = `<svg viewBox="0 0 44 56" width="22" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="9" height="56" fill="#F3F1EC"/>
    <rect x="35" y="0" width="9" height="56" fill="#F3F1EC"/>
    <rect x="0" y="24" width="44" height="2" fill="#8B6B3E"/>
  </svg>`;

  try {
    await resend.emails.send({
      from:    `House Of Sales <${fromEmail}>`,
      to,
      subject: `Payment confirmed — ${money(amount)} received`,
      html: `
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
  <tr><td align="center">
  <table width="100%" style="max-width:520px;background:#111111;border-radius:12px;overflow:hidden;">

    <!-- Header -->
    <tr><td style="padding:32px 36px 24px;background:#0D0C0B;border-bottom:1px solid #2A2A2A;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:10px;vertical-align:middle;">${hosMarkSvg}</td>
        <td style="vertical-align:middle;font-family:'Courier New',monospace;font-size:10px;letter-spacing:3px;color:#727272;text-transform:uppercase;">HOUSE OF SALES</td>
      </tr></table>
      <p style="margin:18px 0 0;color:#727272;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:'Courier New',monospace;">Hi ${name}${company ? ` · ${company}` : ""},</p>
      <h1 style="margin:6px 0 0;color:#F3F1EC;font-size:26px;font-weight:400;font-style:italic;font-family:Georgia,serif;">Payment confirmed.</h1>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:28px 36px;">
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-left:2px solid #4EAD87;border-radius:8px;padding:18px 20px;margin-bottom:24px;">
        <p style="margin:0 0 4px;color:#727272;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-family:'Courier New',monospace;">Amount Received</p>
        <p style="margin:0;color:#4EAD87;font-size:28px;font-weight:700;letter-spacing:-0.5px;">${money(amount)}</p>
        <p style="margin:6px 0 0;color:#727272;font-size:12px;">${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
      </div>

      ${portalSlug ? `
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${appUrl}/portal/${portalSlug}/status" style="display:inline-block;background:#F3F1EC;color:#111111;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">
          OPEN MY PORTAL →
        </a>
      </div>
      ` : ""}

      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:8px;padding:18px 20px;">
        <p style="margin:0 0 12px;color:#727272;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;font-family:'Courier New',monospace;">WHAT HAPPENS NEXT</p>
        <p style="margin:0 0 6px;color:#F3F1EC;font-size:13px;"><span style="color:#8B6B3E;">&#10003;</span>&nbsp;&nbsp;Campaign deployment — within 48 hours</p>
        <p style="margin:0 0 6px;color:#F3F1EC;font-size:13px;"><span style="color:#8B6B3E;">&#10003;</span>&nbsp;&nbsp;First leads — 3–7 days after launch</p>
        <p style="margin:0;color:#F3F1EC;font-size:13px;"><span style="color:#8B6B3E;">&#10003;</span>&nbsp;&nbsp;Weekly reporting — every Monday</p>
      </div>

      <p style="margin:20px 0 0;color:#727272;font-size:12px;line-height:1.7;text-align:center;">
        Questions? Reply to this email anytime.
      </p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:16px 36px;background:#0A0A0A;border-top:1px solid #2A2A2A;">
      <p style="margin:0;color:#404040;font-size:11px;text-align:center;">
        HOS &bull; House Of Sales &bull; hosautomations.co
      </p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
