// POST /api/email-signed — send signed-copy confirmation to client (fire-and-forget)
import { NextResponse }       from "next/server";
import { Resend }             from "resend";
import { z }                  from "zod";
import { fmtDateTime, money } from "@/lib/utils";

const Schema = z.object({
  to:           z.string().email(),
  name:         z.string(),
  company:      z.string().nullable().optional(),
  code:         z.string().length(6),
  invoiceTotal: z.number(),
  signedAt:     z.string(),
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

  const { to, name, company, code, invoiceTotal, signedAt } = parsed.data;
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const fromEmail = process.env.RESEND_FROM || process.env.RESEND_FROM_EMAIL || "solutions@hosautomations.co";
  const pdfLink   = `${appUrl}/api/pdf?code=${code}`;

  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from:    `House Of Sales <${fromEmail}>`,
      to,
      subject: `Your signed agreement is ready — House Of Sales`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#111111;border-radius:12px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 36px 24px;background:#0D0C0B;border-bottom:1px solid #2A2A2A;">
              <p style="margin:0;color:#727272;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;font-weight:600;font-family:'Courier New',monospace;">HOUSE OF SALES</p>
              <p style="margin:18px 0 0;color:#727272;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:'Courier New',monospace;">Hi ${name}${company ? ` · ${company}` : ""},</p>
              <h1 style="margin:6px 0 0;color:#F3F1EC;font-size:28px;font-weight:400;font-style:italic;letter-spacing:-0.3px;line-height:1.25;font-family:Georgia,serif;">You&rsquo;re in. Agreement signed.</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 36px;background:#111111;">
              <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-left:2px solid #8B6B3E;border-radius:8px;padding:18px 20px;margin-bottom:24px;">
                <p style="margin:0 0 4px;color:#727272;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-family:'Courier New',monospace;">Agreement Executed</p>
                <p style="margin:0;color:#F3F1EC;font-size:14px;">Signed ${fmtDateTime(signedAt)}</p>
                <p style="margin:6px 0 0;color:#727272;font-size:13px;">Invoice total &mdash; <span style="color:#F3F1EC;font-weight:700;">${money(invoiceTotal)}</span></p>
              </div>

              <div style="text-align:center;margin-bottom:28px;">
                <a href="${pdfLink}" style="display:inline-block;background:#F3F1EC;color:#111111;text-decoration:none;padding:16px 44px;border-radius:8px;font-weight:700;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;">
                  DOWNLOAD SIGNED COPY &rarr;
                </a>
              </div>

              <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:8px;padding:18px 20px;margin-bottom:8px;">
                <p style="margin:0 0 12px;color:#727272;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;font-family:'Courier New',monospace;">WHAT HAPPENS NEXT</p>
                <p style="margin:0 0 6px;color:#F3F1EC;font-size:13px;"><span style="color:#8B6B3E;">&#10003;</span>&nbsp;&nbsp;Account setup &mdash; within 24 hours</p>
                <p style="margin:0 0 6px;color:#F3F1EC;font-size:13px;"><span style="color:#8B6B3E;">&#10003;</span>&nbsp;&nbsp;Campaign launch &mdash; within 48 hours</p>
                <p style="margin:0 0 6px;color:#F3F1EC;font-size:13px;"><span style="color:#8B6B3E;">&#10003;</span>&nbsp;&nbsp;First leads arrive &mdash; 3&ndash;7 days</p>
                <p style="margin:0;color:#F3F1EC;font-size:13px;"><span style="color:#8B6B3E;">&#10003;</span>&nbsp;&nbsp;Weekly performance reports &mdash; every Monday</p>
              </div>

              <p style="margin:24px 0 0;color:#727272;font-size:12px;line-height:1.7;text-align:center;">
                Questions? Reply to this email anytime.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 36px;background:#0A0A0A;border-top:1px solid #2A2A2A;">
              <p style="margin:0;color:#404040;font-size:11px;text-align:center;letter-spacing:0.3px;">
                HOS &bull; House Of Sales &bull; hosautomations.co
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
