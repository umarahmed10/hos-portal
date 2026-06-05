// POST /api/email-client — send portal access email with magic link + code fallback.
import { NextResponse }    from "next/server";
import { Resend }          from "resend";
import { randomBytes, createHash } from "crypto";
import { getAdminSession } from "@/lib/auth";
import { getDocByCode, updateDocMagicLink, logEvent } from "@/lib/data-access";
import { slugify }         from "@/lib/utils";
import { z }               from "zod";

const Schema = z.object({
  to:      z.string().email(),
  name:    z.string().min(1),
  code:    z.string().length(6),
  company: z.string().nullable().optional(),
});

async function uniqueSlug(base: string, existingSlug: string | null): Promise<string> {
  // If doc already has a slug, reuse it
  if (existingSlug) return existingSlug;
  // Otherwise derive from base (company > name)
  const slug = slugify(base) || "client";
  // Append a short random suffix to guarantee uniqueness without a DB lookup loop
  const suffix = randomBytes(2).toString("hex");
  return `${slug}-${suffix}`;
}

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body   = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Validation error", details: parsed.error.message }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const { to, name, code, company } = parsed.data;
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const fromEmail = process.env.RESEND_FROM_EMAIL   || "onboarding@resend.dev";

  // Fetch doc for id and existing slug
  const doc = await getDocByCode(code);
  if (!doc) {
    return NextResponse.json({ ok: false, error: "Document not found" }, { status: 404 });
  }

  // Generate magic token and slug
  const rawToken   = randomBytes(32).toString("hex");
  const tokenHash  = createHash("sha256").update(rawToken).digest("hex");
  const slug       = await uniqueSlug(company || name, doc.slug);

  await updateDocMagicLink(code, slug, tokenHash);

  const magicLink  = `${appUrl}/portal/${slug}?mt=${rawToken}`;
  const codeLink   = `${appUrl}/client`;

  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from:    fromEmail,
      to,
      subject: `Your HOS Automations client portal is ready`,
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f0eeeb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0eeeb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#0a0a0a;border-radius:12px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 36px 24px;border-bottom:1px solid #1a1a1a;">
              <p style="margin:0 0 6px;color:#444;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;font-weight:700;">HOS AUTOMATIONS</p>
              <h1 style="margin:0;color:#f5f0eb;font-size:26px;font-weight:800;letter-spacing:-0.3px;line-height:1.2;">Your client portal<br>is ready.</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 36px;">
              <p style="margin:0 0 6px;color:#666;font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:600;">Hi ${name}${company ? ` · ${company}` : ""},</p>
              <p style="margin:0 0 24px;color:#888;font-size:14px;line-height:1.7;">
                Your HOS Automations onboarding documents are ready to review and sign. Takes about 2 minutes.
              </p>

              <!-- Primary CTA -->
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${magicLink}" style="display:inline-block;background:#f5f0eb;color:#0a0a0a;text-decoration:none;padding:15px 40px;border-radius:8px;font-weight:800;font-size:14px;letter-spacing:0.8px;text-transform:uppercase;">
                  Open My Portal &rarr;
                </a>
              </div>

              <!-- What's inside -->
              <div style="background:#111;border:1px solid #1d1d1d;border-radius:8px;padding:18px 20px;margin-bottom:24px;">
                <p style="margin:0 0 12px;color:#555;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">WHAT YOU'LL FIND INSIDE</p>
                <p style="margin:0 0 6px;color:#888;font-size:13px;">✓ &nbsp;Your service agreement to review</p>
                <p style="margin:0 0 6px;color:#888;font-size:13px;">✓ &nbsp;Your invoice and payment details</p>
                <p style="margin:0 0 6px;color:#888;font-size:13px;">✓ &nbsp;Digital signature — takes 30 seconds</p>
                <p style="margin:0;color:#888;font-size:13px;">✓ &nbsp;Your onboarding status tracker</p>
              </div>

              <!-- Code fallback -->
              <div style="background:#0d0d0d;border:1px solid #1a1a1a;border-radius:8px;padding:16px 20px;text-align:center;margin-bottom:20px;">
                <p style="margin:0 0 8px;color:#444;font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Your Access Code</p>
                <p style="margin:0 0 8px;font-family:'Courier New',monospace;font-size:30px;font-weight:700;letter-spacing:10px;color:#f5f0eb;">${code}</p>
                <p style="margin:0;color:#444;font-size:11px;line-height:1.6;">
                  Or visit <a href="${codeLink}" style="color:#666;">${codeLink}</a> and enter the code above.
                </p>
              </div>

              <p style="margin:0;color:#333;font-size:12px;line-height:1.7;text-align:center;">
                Questions? Reply to this email anytime.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 36px;border-top:1px solid #111;">
              <p style="margin:0;color:#2a2a2a;font-size:11px;text-align:center;">
                HOS Automations &bull; Qualified Lead Generation
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

    // Log the email_sent event (non-blocking)
    logEvent(doc.id, "email_sent", { to, slug }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
