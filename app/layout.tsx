import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// ── Fonts ──────────────────────────────────────────────────────────────────
// CSS variables: --font-bc (header), --font-b (body), --font-jm (mono)
// Consumed via lib/styles.ts FONT/BODY/MONO constants.
const barlowCondensed = Barlow_Condensed({
  subsets:  ["latin"],
  weight:   ["400", "600", "700", "800", "900"],
  variable: "--font-bc",
  display:  "swap",
});

const barlow = Barlow({
  subsets:  ["latin"],
  weight:   ["400", "500", "600", "700"],
  variable: "--font-b",
  display:  "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets:  ["latin"],
  weight:   ["400", "600", "700"],
  variable: "--font-jm",
  display:  "swap",
});

// ── Metadata ───────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title:       "HOS Client Portal",
  description: "Review and sign your HOS Automations service agreement.",
  robots:      { index: false, follow: false }, // private portal
};

export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
  // Prevents iOS auto-zoom on input focus (critical for mobile signing flow)
  maximumScale: 1,
};

// ── Root Layout ────────────────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontClasses = [
    barlowCondensed.variable,
    barlow.variable,
    jetBrainsMono.variable,
  ].join(" ");

  return (
    <html lang="en" className={fontClasses}>
      <body>
        {children}
        <Toaster
          position="top-right"
          duration={3000}
          closeButton
          theme="dark"
          toastOptions={{
            style: {
              background:  "#111111",
              border:      "1px solid #2a2a2a",
              color:       "#f5f0eb",
              fontFamily:  "var(--font-b), Barlow, sans-serif",
              fontSize:    "13px",
              borderRadius: "8px",
            },
          }}
        />
      </body>
    </html>
  );
}
