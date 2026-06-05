"use client";
import { useEffect, useState } from "react";
import { useRouter }           from "next/navigation";
import { MUTED, BODY }         from "@/lib/styles";

interface Props {
  slug?: string | null;
}

export function DoneCountdown({ slug }: Props) {
  const router        = useRouter();
  const [count, setCount] = useState(6);

  useEffect(() => {
    const id = setInterval(() => {
      setCount(n => {
        if (n <= 1) {
          clearInterval(id);
          // Route to portal if slug is available, otherwise fall back to /client
          router.push(slug ? `/portal/${slug}/status` : "/client");
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [router, slug]);

  return (
    <p style={{ fontSize: 12, color: MUTED, fontFamily: BODY, marginBottom: 20 }}>
      {slug
        ? `Opening your client portal in ${count}…`
        : `Redirecting in ${count}…`}
    </p>
  );
}
