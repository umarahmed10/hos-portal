"use client";
import Link            from "next/link";
import { usePathname } from "next/navigation";
import { BORDER, BG, GOLD, MUTED, TEXT } from "@/lib/styles";

interface NavItem {
  label: string;
  href:  string;
}

interface Props {
  slug: string;
  mode: "active" | "onboarding";
}

export function PortalNav({ slug, mode }: Props) {
  const pathname = usePathname();

  const activeItems: NavItem[] = [
    { label: "Dashboard", href: `/portal/${slug}/dashboard`   },
    { label: "Calls",     href: `/portal/${slug}/performance` },
    { label: "Billing",   href: `/portal/${slug}/invoices`    },
  ];

  const onboardingItems: NavItem[] = [
    { label: "Status",    href: `/portal/${slug}/status`    },
    { label: "Documents", href: `/portal/${slug}/documents` },
    { label: "Billing",   href: `/portal/${slug}/invoices`  },
  ];

  const items = mode === "active" ? activeItems : onboardingItems;

  return (
    <nav className="portal-nav-scroll" style={{
      borderBottom: `1px solid ${BORDER}`,
      background:   BG,
      overflowX:    "auto",
      WebkitOverflowScrolling: "touch",
    }}>
      <div style={{
        display:   "flex",
        gap:       0,
        minWidth:  "max-content",
        padding:   "0 20px",
        maxWidth:  800,
        margin:    "0 auto",
      }}>
        {items.map(item => {
          const isActive = pathname === item.href
            || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display:        "block",
                padding:        "14px 16px",
                fontSize:       9,
                fontWeight:     isActive ? 700 : 400,
                fontFamily:     "var(--font-mono)",
                letterSpacing:  "0.14em",
                textTransform:  "uppercase",
                color:          isActive ? TEXT : MUTED,
                textDecoration: "none",
                whiteSpace:     "nowrap",
                flexShrink:     0,
                /*
                 * Active indicator: CSS border-bottom derived from pathname.
                 * Computed server-side — correct on first paint, no DOM measurement,
                 * no hydration mismatch.
                 */
                borderBottom:   isActive ? `2px solid ${GOLD}` : "2px solid transparent",
                transition:     "color 150ms, border-color 150ms",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
