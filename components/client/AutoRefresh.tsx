"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Props {
  intervalMs?: number;
}

export function AutoRefresh({ intervalMs = 30000 }: Props) {
  const router = useRouter();
  const visibleRef = useRef(true);

  useEffect(() => {
    const onVis = () => { visibleRef.current = document.visibilityState === "visible"; };
    document.addEventListener("visibilitychange", onVis);
    const id = setInterval(() => {
      if (visibleRef.current) router.refresh();
    }, intervalMs);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [router, intervalMs]);
  return null;
}
