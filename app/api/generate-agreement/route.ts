// POST /api/generate-agreement
// Validates input, builds prompt, proxies to OpenRouter.
// Business logic (prompt construction) lives here, not in the client.
import { NextResponse } from "next/server";
import { z }            from "zod";

const Schema = z.object({
  name:          z.string().min(1),
  company:       z.string().optional(),
  service_type:  z.string().optional(),
  service_area:  z.string().optional(),
  fee:           z.string().optional(),
  date:          z.string().optional(),
  terms:         z.string().optional(),
});

export async function POST(req: Request) {
  const body   = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation error", details: parsed.error.message },
      { status: 400 }
    );
  }

  const { name, company, service_type, service_area, fee, date, terms } = parsed.data;

  const systemPrompt = `You are a professional contracts writer for House Of Sales (HOS), a US-based lead generation company that sends qualified inbound phone calls to plumbing and HVAC contractors. You write clear, professional service agreements that protect both parties. Write in plain business English — no legalese, no filler. Use numbered sections with ALL CAPS titles.

OUTPUT FORMAT: Plain text only. No markdown. No asterisks (*). No hash symbols (#). No bold or italic formatting. Section titles in ALL CAPS. Numbered sections only.`;

  const userPrompt = `Write a service agreement for the following client:

Client Name: ${name}
Company: ${company || "N/A"}
Service Type: ${service_type || "Home Services"}
Service Area: ${service_area || "TBD"}
Per-Call Rate: ${fee ? `$${fee}` : "TBD"}
Start Date: ${date || "TBD"}
${terms ? `\nCustom Terms:\n${terms}` : ""}

The agreement must include these sections:
1. PARTIES — House Of Sales (Provider) and ${company || name} (Client)
2. SERVICES — What House Of Sales provides (qualified inbound calls for ${service_type || "home services"} in ${service_area || "the agreed area"})
3. CALL QUALIFICATION CRITERIA — Minimum call duration (60 seconds), genuine homeowner, within service area, real service intent
4. RATES & BILLING — $${fee || "TBD"} per qualified call, weekly invoicing every Monday, net-7 payment terms
5. TERM & CANCELLATION — Either party may cancel with 7 days written notice
6. REPRESENTATIONS — Client confirms they are licensed and insured in their service area
7. LIMITATION OF LIABILITY — Provider not liable for missed calls, client conversion rates, or market conditions

Keep it under 500 words. Professional but readable. No signatures block (handled separately).

IMPORTANT: Plain text only. No markdown. No asterisks. No hash symbols. Section titles in ALL CAPS with numbers only. Do not use any markdown formatting characters.`;

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model  = process.env.OPENROUTER_MODEL || "meta-llama/llama-4-maverick";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "OPENROUTER_API_KEY not configured" }, { status: 500 });
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer":  appUrl,
        "X-Title":       "HOS Client Portal",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt   },
        ],
        temperature: 0.4,
        max_tokens:  900,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ ok: false, error: `OpenRouter error: ${err}` }, { status: 502 });
    }

    const json = await response.json();
    const text = json.choices?.[0]?.message?.content?.trim();

    if (!text) {
      return NextResponse.json({ ok: false, error: "Empty response from model" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, data: { text } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
