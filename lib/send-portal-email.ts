// Shared portal email logic — used by /api/email-client (admin-triggered)
// and /api/docs POST (auto-send on new client creation).
import { randomBytes, createHash } from "crypto";
import { Resend }                  from "resend";
import { getDocByCode, updateDocMagicLink, logEvent } from "@/lib/data-access";
import { slugify }                 from "@/lib/utils";

async function uniqueSlug(base: string, existingSlug: string | null): Promise<string> {
  if (existingSlug) return existingSlug;
  const slug   = slugify(base) || "client";
  const suffix = randomBytes(2).toString("hex");
  return `${slug}-${suffix}`;
}

interface SendPortalEmailInput {
  code:     string;
  to?:      string | null;
  name?:    string | null;
  company?: string | null;
}

export async function sendPortalEmail({
  code,
  to,
  name,
  company,
}: SendPortalEmailInput): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" };

  const doc = await getDocByCode(code).catch(() => null);
  if (!doc) return { ok: false, error: "Document not found" };

  const recipientEmail   = to      ?? doc.email;
  const recipientName    = name    ?? doc.name;
  const recipientCompany = company !== undefined ? company : doc.company;

  if (!recipientEmail) return { ok: false, error: "No email address on file for this client" };

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const fromEmail = process.env.RESEND_FROM || process.env.RESEND_FROM_EMAIL || "solutions@hosautomations.co";

  const rawToken  = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const slug      = await uniqueSlug(recipientCompany || recipientName, doc.slug);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    await updateDocMagicLink(code, slug, tokenHash, expiresAt, recipientEmail);
  } catch (err) {
    return { ok: false, error: `Failed to generate link: ${String(err)}` };
  }

  const magicLink = `${appUrl}/portal/${slug}?mt=${rawToken}`;
  const codeUrl   = `${appUrl}/client`;

  const hosMarkSvg = `<svg viewBox="0 0 44 56" width="22" height="28" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
    <rect x="0" y="0" width="9" height="56" fill="#F3F1EC"/>
    <rect x="35" y="0" width="9" height="56" fill="#F3F1EC"/>
    <rect x="0" y="24" width="44" height="2" fill="#8B6B3E"/>
  </svg>`;

  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from:    `House Of Sales <${fromEmail}>`,
      to:      recipientEmail,
      subject: `Your portal is ready, ${recipientName}.`,
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
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:10px;">${hosMarkSvg}</td>
                  <td style="color:#727272;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;font-weight:600;font-family:'Courier New',monospace;">HOUSE OF SALES</td>
                </tr>
              </table>
              <p style="margin:18px 0 0;color:#727272;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-family:'Courier New',monospace;">Hi ${recipientName}${recipientCompany ? ` &middot; ${recipientCompany}` : ""},</p>
              <h1 style="margin:6px 0 0;color:#F3F1EC;font-size:28px;font-weight:400;font-style:italic;letter-spacing:-0.3px;line-height:1.25;font-family:Georgia,serif;">Your portal is ready.</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 36px;background:#111111;">
              <!-- Primary CTA -->
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${magicLink}" style="display:inline-block;background:#F3F1EC;color:#111111;text-decoration:none;padding:16px 44px;border-radius:8px;font-weight:700;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;">
                  ACCESS MY PORTAL &rarr;
                </a>
              </div>

              <!-- Onboarding steps -->
              <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:8px;padding:18px 20px;margin-bottom:24px;">
                <p style="margin:0 0 12px;color:#727272;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600;font-family:'Courier New',monospace;">WHAT'S NEXT</p>
                <p style="margin:0 0 6px;color:#F3F1EC;font-size:13px;"><span style="color:#8B6B3E;">&#10003;</span>&nbsp;&nbsp;Review your service agreement</p>
                <p style="margin:0 0 6px;color:#F3F1EC;font-size:13px;"><span style="color:#8B6B3E;">&#10003;</span>&nbsp;&nbsp;Confirm your invoice</p>
                <p style="margin:0 0 6px;color:#F3F1EC;font-size:13px;"><span style="color:#8B6B3E;">&#10003;</span>&nbsp;&nbsp;Sign to activate your account</p>
                <p style="margin:0;color:#F3F1EC;font-size:13px;"><span style="color:#8B6B3E;">&#10003;</span>&nbsp;&nbsp;First calls arrive within 3&ndash;7 days</p>
              </div>

              <!-- Backup code -->
              <div style="background:#0D0C0B;border:1px solid #2A2A2A;border-radius:8px;padding:16px 20px;text-align:center;margin-bottom:20px;">
                <p style="margin:0 0 6px;color:#727272;font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:600;font-family:'Courier New',monospace;">Backup Access Code</p>
                <p style="margin:0 0 8px;font-family:'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:#F3F1EC;">${code}</p>
                <p style="margin:0;color:#727272;font-size:11px;line-height:1.6;">
                  Or enter your code at <a href="${codeUrl}" style="color:#8B6B3E;">${codeUrl}</a>
                </p>
              </div>

              <p style="margin:0;color:#727272;font-size:12px;line-height:1.7;text-align:center;">
                Questions? <a href="mailto:team@hosautomations.co" style="color:#8B6B3E;text-decoration:none;">team@hosautomations.co</a>
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

    logEvent(doc.id, "email_sent", { to: recipientEmail, slug }).catch(() => {});
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
