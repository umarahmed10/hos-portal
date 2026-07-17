// POST /api/notify — send notifications to admin (signing + payment events)
import { NextResponse } from "next/server";
import { Resend }       from "resend";
import { z }            from "zod";
import { fmtDateTime }  from "@/lib/utils";

const SignSchema = z.object({
  name:         z.string(),
  company:      z.string().nullable().optional(),
  service:      z.string().nullable().optional(),
  invoiceTotal: z.string(),
  signedAt:     z.string(),
  code:         z.string(),
  ip:           z.string().nullable().optional(),
  ua:           z.string().nullable().optional(),
});

function truncateUA(ua: string | null | undefined): string {
  if (!ua) return "Unknown";
  return ua.length > 90 ? `${ua.slice(0, 90)}…` : ua;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const fromEmail = process.env.RESEND_FROM || process.env.RESEND_FROM_EMAIL || "solutions@hosautomations.co";
  const toEmail   = process.env.NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  if (!toEmail) {
    return NextResponse.json({ ok: false, error: "NOTIFY_EMAIL not configured" }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // ── Payment received ─────────────────────────────────────────────────────────
  if (body.event === "payment_received") {
    const { name, company, code, amount, email } = body;
    try {
      await resend.emails.send({
        from:    `House Of Sales <${fromEmail}>`,
        to:      toEmail,
        subject: `💳 [PAID] ${name}${company ? ` · ${company}` : ""} — $${Number(amount).toFixed(2)}`,
        html: `
          <div style="background:#111;color:#F3F1EC;padding:32px;font-family:-apple-system,sans-serif;max-width:500px;border-radius:12px;">
            <p style="color:#727272;font-size:10px;letter-spacing:3px;text-transform:uppercase;margin:0 0 8px">HOUSE OF SALES</p>
            <h2 style="margin:0 0 20px;font-size:22px;font-style:italic;font-weight:400;font-family:Georgia,serif">Payment received.</h2>
            <table style="border-collapse:collapse;width:100%">
              <tr><td style="padding:8px 0;color:#727272;font-size:12px;border-bottom:1px solid #2A2A2A">Client</td><td style="color:#F3F1EC;font-size:13px;text-align:right;border-bottom:1px solid #2A2A2A">${name}${company ? ` · ${company}` : ""}</td></tr>
              <tr><td style="padding:8px 0;color:#727272;font-size:12px;border-bottom:1px solid #2A2A2A">Amount</td><td style="color:#4EAD87;font-size:18px;font-weight:700;text-align:right;border-bottom:1px solid #2A2A2A">$${Number(amount).toFixed(2)}</td></tr>
              ${email ? `<tr><td style="padding:8px 0;color:#727272;font-size:12px;border-bottom:1px solid #2A2A2A">Email</td><td style="color:#F3F1EC;font-size:13px;text-align:right;border-bottom:1px solid #2A2A2A">${email}</td></tr>` : ""}
              <tr><td style="padding:8px 0;color:#727272;font-size:12px;border-bottom:1px solid #2A2A2A">Code</td><td style="color:#F3F1EC;font-size:13px;font-family:monospace;text-align:right;border-bottom:1px solid #2A2A2A">${code}</td></tr>
              <tr><td style="padding:8px 0;color:#727272;font-size:12px">Time</td><td style="color:#F3F1EC;font-size:13px;text-align:right">${new Date().toLocaleString("en-US")}</td></tr>
            </table>
            <div style="margin-top:24px">
              <a href="${appUrl}/admin/share?code=${code}" style="background:#F3F1EC;color:#111;padding:12px 24px;text-decoration:none;font-weight:600;font-size:12px;letter-spacing:1px;text-transform:uppercase;border-radius:6px">VIEW CLIENT →</a>
            </div>
          </div>
        `,
      });
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    }
  }

  // ── Signing notification (existing behavior) ─────────────────────────────────
  const parsed = SignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation error" }, { status: 400 });
  }

  const { name, company, service, invoiceTotal, signedAt, code, ip, ua } = parsed.data;
  const shareLink = `${appUrl}/admin/share?code=${code}`;

  try {
    await resend.emails.send({
      from:    `House Of Sales <${fromEmail}>`,
      to:      toEmail,
      subject: `🔔 ${name}${company ? ` · ${company}` : ""} has signed — HOS`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0A0A0A; margin: 0; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: #111111; border-radius: 12px; overflow: hidden; border: 1px solid #2A2A2A;">
    <div style="background: #0D0C0B; padding: 24px 28px; border-bottom: 1px solid #2A2A2A;">
      <p style="color: #727272; font-size: 11px; letter-spacing: 2.5px; margin: 0 0 6px; text-transform: uppercase; font-family: 'Courier New', monospace;">House Of Sales</p>
      <h1 style="color: #F3F1EC; font-size: 22px; font-weight: 400; font-style: italic; font-family: Georgia, serif; margin: 0;">New signature received.</h1>
    </div>
    <div style="padding: 28px;">
      <div style="background: #1A1A1A; border-radius: 8px; padding: 16px 18px; margin-bottom: 20px; border-left: 2px solid #8B6B3E;">
        <p style="margin: 0 0 4px; font-weight: 600; font-size: 16px; color: #F3F1EC; font-family: -apple-system, sans-serif;">${name}</p>
        ${company ? `<p style="margin: 0; color: #727272; font-size: 14px;">${company}</p>` : ""}
        ${service  ? `<p style="margin: 4px 0 0; color: #727272; font-size: 13px;">${service}</p>` : ""}
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #727272; font-size: 13px; border-bottom: 1px solid #2A2A2A;">Invoice Total</td>
          <td style="padding: 8px 0; font-weight: 700; text-align: right; border-bottom: 1px solid #2A2A2A; color: #F3F1EC;">${invoiceTotal}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #727272; font-size: 13px; border-bottom: 1px solid #2A2A2A;">Signed At</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right; border-bottom: 1px solid #2A2A2A; font-size: 13px; color: #F3F1EC;">${fmtDateTime(signedAt)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #727272; font-size: 13px; border-bottom: 1px solid #2A2A2A;">Doc Code</td>
          <td style="padding: 8px 0; font-family: 'Courier New', monospace; font-weight: 700; text-align: right; letter-spacing: 2px; color: #F3F1EC;">${code}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #727272; font-size: 13px; border-bottom: 1px solid #2A2A2A;">Signed IP</td>
          <td style="padding: 8px 0; font-family: 'Courier New', monospace; font-weight: 600; text-align: right; font-size: 12px; color: #F3F1EC;">${ip || "Unknown"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #727272; font-size: 13px; vertical-align: top;">Browser</td>
          <td style="padding: 8px 0; font-weight: 500; text-align: right; font-size: 11px; color: #727272; max-width: 260px;">${truncateUA(ua)}</td>
        </tr>
      </table>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${shareLink}" style="background: #F3F1EC; color: #111111; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-weight: 700; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">View Document &rarr;</a>
      </div>
    </div>
    <div style="padding: 16px 28px; background: #0A0A0A; border-top: 1px solid #2A2A2A;">
      <p style="margin: 0; color: #404040; font-size: 11px; text-align: center;">HOS &bull; House Of Sales &bull; hosautomations.co</p>
    </div>
  </div>
</body>
</html>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
