import type { Metadata, Viewport } from "next";
import {
  Cormorant_Garamond,
  Space_Grotesk,
  DM_Sans,
  DM_Mono,
} from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// ── Fonts ──────────────────────────────────────────────────────────────────
// CSS variables: --font-display, --font-ui, --font-body, --font-mono
// Consumed via lib/styles.ts DISPLAY/UI/BODY/MONO constants.
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-body",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

// ── Metadata ───────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title:       "HOS Client Portal",
  description: "Review and sign your HOS Automations service agreement.",
  robots:      { index: false, follow: false }, // private portal
  icons: {
    icon:     "/icon.svg",
    shortcut: "/icon.svg",
    apple:    "/icon.svg",
  },
};

export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
};

// ── Root Layout ────────────────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontClasses = [
    cormorant.variable,
    spaceGrotesk.variable,
    dmSans.variable,
    dmMono.variable,
  ].join(" ");

  return (
    <html lang="en" className={fontClasses}>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              background:    "#1A1A1A",
              border:        "1px solid #2A2A2A",
              color:         "#F3F1EC",
              borderRadius:  10,
              fontFamily:    "var(--font-body), sans-serif",
              fontSize:      13,
              boxShadow:     "0 8px 32px rgba(0,0,0,0.4)",
            },
          }}
        />
      </body>
    </html>
  );
}
