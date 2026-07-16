"use client";
// Silently re-fetches the current page's server data on an interval.
// Drop into any server component page to keep data fresh without a full reload.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  intervalMs?: number;
}

export function AutoRefresh({ intervalMs = 30000 }: Props) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
