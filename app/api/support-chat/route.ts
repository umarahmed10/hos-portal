// POST /api/support-chat — HOS Automations client support chatbot via OpenRouter.
// Accepts message history, responds as an HOS support agent.
import { NextResponse } from "next/server";
import { z }            from "zod";

const MessageSchema = z.object({
  role:    z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

const Schema = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
});

const SYSTEM_PROMPT = `You are an HOS Automations client support representative. HOS Automations is a premium lead generation company that delivers qualified inbound phone calls to plumbing and HVAC contractors across the United States.

Your role:
- Answer client questions about billing, onboarding, campaign status, call quality, and service terms
- Be concise, professional, and warm — never robotic or corporate
- Reassure clients about the process and next steps
- If you don't know something specific to the client's account, tell them to reply to their onboarding email or contact their account manager

Key facts about HOS Automations:
- We deliver live inbound calls from real homeowners in the client's service area
- Calls must be over 60 seconds, from genuine homeowners, within the service area to qualify
- Payment is per qualified call — no retainers, no setup fees
- Clients can cancel with 7 days written notice at any time
- Invoices are issued weekly (every Monday)
- Payment terms are net-7
- Campaign setup typically takes 3-5 business days after payment is received
- Clients receive signed copies of their agreement by email automatically

Tone: Calm, competent, direct. Never use excessive positivity or sales language. You represent a premium operation.`;

export async function POST(req: Request) {
  const body   = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid request" },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  const model  = process.env.OPENROUTER_MODEL || "meta-llama/llama-4-maverick";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "OPENROUTER_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer":  appUrl,
        "X-Title":       "HOS Client Portal Support",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...parsed.data.messages,
        ],
        temperature: 0.5,
        max_tokens:  400,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ ok: false, error: `Chat error: ${err}` }, { status: 502 });
    }

    const json    = await response.json();
    const content = json.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json({ ok: false, error: "Empty response" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, data: { content } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
