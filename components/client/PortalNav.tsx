"use client";
import Link          from "next/link";
import { usePathname } from "next/navigation";
import { BODY, BORDER, BG, MUTED, SURF, TEXT } from "@/lib/styles";

interface NavItem {
  label: string;
  href:  string;
}

interface Props {
  slug: string;
}

export function PortalNav({ slug }: Props) {
  const pathname = usePathname();

  const items: NavItem[] = [
    { label: "Status",            href: `/portal/${slug}/status`    },
    { label: "Documents",         href: `/portal/${slug}/documents` },
    { label: "Invoices",          href: `/portal/${slug}/invoices`  },
    { label: "Call Reports",      href: `/portal/${slug}/reports`   },
    { label: "Campaign Updates",  href: `/portal/${slug}/campaigns` },
    { label: "Support",           href: `/portal/${slug}/support`   },
  ];

  return (
    <nav style={{
      borderBottom:  `1px solid ${BORDER}`,
      background:    BG,
      overflowX:     "auto",
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "none",
    }}>
      <div style={{
        display:    "flex",
        gap:        0,
        minWidth:   "max-content",
        padding:    "0 24px",
        maxWidth:   900,
        margin:     "0 auto",
      }}>
        {items.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display:       "block",
                padding:       "14px 16px",
                fontSize:      13,
                fontWeight:    isActive ? 700 : 500,
                fontFamily:    BODY,
                color:         isActive ? TEXT : MUTED,
                textDecoration: "none",
                borderBottom:  isActive ? `2px solid ${TEXT}` : "2px solid transparent",
                whiteSpace:    "nowrap",
                transition:    "color 150ms, border-color 150ms",
                letterSpacing: isActive ? "0.2px" : 0,
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
