// POST /api/notify — send signing notification to admin (fire-and-forget)
import { NextResponse } from "next/server";
import { Resend }       from "resend";
import { z }            from "zod";
import { fmtDateTime }  from "@/lib/utils";

const Schema = z.object({
  name:         z.string(),
  company:      z.string().nullable().optional(),
  service:      z.string().nullable().optional(),
  invoiceTotal: z.string(),
  signedAt:     z.string(),
  code:         z.string(),
});

export async function POST(req: Request) {
  const body   = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation error" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const { name, company, service, invoiceTotal, signedAt, code } = parsed.data;
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const fromEmail = process.env.RESEND_FROM_EMAIL   || "onboarding@resend.dev";
  const toEmail   = process.env.NOTIFY_EMAIL;

  if (!toEmail) {
    return NextResponse.json({ ok: false, error: "NOTIFY_EMAIL not configured" }, { status: 500 });
  }

  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from:    fromEmail,
      to:      toEmail,
      subject: `✅ ${name}${company ? ` (${company})` : ""} has signed — HOS Automations`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f4; margin: 0; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e5e5;">
    <div style="background: #090909; padding: 24px 28px;">
      <p style="color: #555; font-size: 11px; letter-spacing: 2px; margin: 0 0 6px; text-transform: uppercase;">HOS Automations</p>
      <h1 style="color: #f5f0eb; font-size: 22px; font-weight: 800; margin: 0;">New Signature Received</h1>
    </div>
    <div style="padding: 28px;">
      <div style="background: #f9f9f9; border-radius: 6px; padding: 16px; margin-bottom: 20px; border-left: 3px solid #22c55e;">
        <p style="margin: 0 0 4px; font-weight: 700; font-size: 16px; color: #111;">${name}</p>
        ${company ? `<p style="margin: 0; color: #555; font-size: 14px;">${company}</p>` : ""}
        ${service  ? `<p style="margin: 4px 0 0; color: #777; font-size: 13px;">${service}</p>` : ""}
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #888; font-size: 13px; border-bottom: 1px solid #eee;">Invoice Total</td>
          <td style="padding: 8px 0; font-weight: 700; text-align: right; border-bottom: 1px solid #eee;">${invoiceTotal}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #888; font-size: 13px; border-bottom: 1px solid #eee;">Signed At</td>
          <td style="padding: 8px 0; font-weight: 600; text-align: right; border-bottom: 1px solid #eee; font-size: 13px;">${fmtDateTime(signedAt)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #888; font-size: 13px;">Doc Code</td>
          <td style="padding: 8px 0; font-family: monospace; font-weight: 700; text-align: right; letter-spacing: 2px;">${code}</td>
        </tr>
      </table>
      <div style="margin-top: 24px; text-align: center;">
        <a href="${appUrl}/admin" style="background: #090909; color: #f5f0eb; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">VIEW IN DASHBOARD</a>
      </div>
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
