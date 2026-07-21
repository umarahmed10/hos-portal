"use client";
// Animated number — counts up from 0 on mount (ease-out cubic). A number that
// *arrives* feels earned; a static number reads like a spreadsheet. Used for the
// dashboard ROI + KPIs (the "is my money working?" screen).
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

interface Props {
  value: number;
  money?: boolean;
  suffix?: string;
  duration?: number;
  style?: CSSProperties;
}

const fmtMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = new Intl.NumberFormat("en-US");

export function CountUp({ value, money, suffix = "", duration = 1000, style }: Props) {
  const [n, setN] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    // Jump straight to the value if motion is unwanted or the tab is hidden
    // (animating an unseen number is pointless — and rAF is throttled there).
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || (typeof document !== "undefined" && document.visibilityState === "hidden")) {
      setN(value);
      return;
    }
    const start = performance.now();
    let done = false;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(value * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else { done = true; setN(value); }
    };
    raf.current = requestAnimationFrame(tick);
    // Safety net: if rAF is throttled or never fires, the CORRECT value must
    // still land — showing $0 for a real ROI would be catastrophic.
    const fallback = setTimeout(() => { if (!done) setN(value); }, duration + 300);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      clearTimeout(fallback);
    };
  }, [value, duration]);

  const text = money ? fmtMoney.format(n) : fmtNum.format(Math.round(n)) + suffix;
  return <span style={style}>{text}</span>;
}
