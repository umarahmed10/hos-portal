// Portal Status tab — Amazon-style campaign progress tracker.
import { notFound, redirect } from "next/navigation";
import { getPortalSession }   from "@/lib/portal-auth";
import { getDocBySlug, getDocEvents, logEvent } from "@/lib/data-access";
import { StatusTracker }      from "@/components/client/StatusTracker";
import { BODY, BORDER, FONT, GREEN, MUTED, SURF, TEXT, css } from "@/lib/styles";
import { headers }            from "next/headers";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PortalStatusPage({ params }: Props) {
  const { slug }  = await params;
  const session   = await getPortalSession();
  if (!session || session.slug !== slug) redirect(`/portal/${slug}`);

  const doc = await getDocBySlug(slug);
  if (!doc) notFound();

  const events = await getDocEvents(doc.id);

  // Log invoice_viewed event (non-blocking)
  const hdrs    = await headers();
  const ip      = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua      = hdrs.get("user-agent") ?? null;
  logEvent(doc.id, "viewed", { via: "portal", tab: "status" }, ip, ua).catch(() => {});

  const isSigned = doc.status === "signed";

  return (
    <div style={{ animation: "fadeIn 200ms ease-out" }}>

      {/* Hero */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 10, letterSpacing: "2px", fontWeight: 800, color: MUTED, fontFamily: BODY, marginBottom: 8 }}>
          ONBOARDING STATUS
        </div>
        <h2 style={{ fontFamily: FONT, fontSize: 36, fontWeight: 900, letterSpacing: "-0.5px", color: TEXT, marginBottom: 10 }}>
          {isSigned ? "You're In." : "Almost There."}
        </h2>
        <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.7, maxWidth: 480 }}>
          {isSigned
            ? "Your agreement is signed. Here's where things stand as we set up your campaign."
            : "Review and sign your agreement to activate your account and start receiving qualified calls."}
        </p>
      </div>

      {/* Tracker card */}
      <div style={{ ...css.card, padding: "28px 28px 24px" }}>
        <StatusTracker doc={doc} events={events} />
      </div>

      {/* CTA if not signed */}
      {!isSigned && (
        <div style={{
          ...css.card,
          display:    "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap:        16,
          padding:    "20px 24px",
          borderColor: "rgba(234,179,8,0.2)",
          background:  "rgba(234,179,8,0.04)",
        }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 800, color: TEXT, marginBottom: 4 }}>
              SIGNATURE REQUIRED
            </div>
            <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
              Sign your agreement to activate your account and begin receiving calls.
            </p>
          </div>
          <a
            href={`/portal/${slug}/documents`}
            style={{
              ...css.btnP,
              textDecoration: "none",
              display:        "inline-block",
              whiteSpace:     "nowrap",
              padding:        "11px 24px",
              fontSize:       13,
            }}
          >
            REVIEW & SIGN →
          </a>
        </div>
      )}
    </div>
  );
}
