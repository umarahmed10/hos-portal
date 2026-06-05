"use client";
import { useState } from "react";
import { css } from "@/lib/styles";
import { Check, Copy } from "@/components/shared/Icons";

interface Props {
  text:     string;
  label?:   string;
  size?:    "sm" | "md";
  variant?: "primary" | "secondary";
}

export function CopyButton({ text, label = "Copy", size = "md", variant = "secondary" }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const base = variant === "primary" ? css.btnP : css.btnS;
  const pad  = size === "sm" ? "6px 14px" : "8px 20px";
  const fs   = size === "sm" ? 11 : 13;

  return (
    <button
      onClick={handleCopy}
      style={{ ...base, padding: pad, fontSize: fs, display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      {copied
        ? <span className="copied-badge"><Check size={13} />Copied!</span>
        : <><Copy size={13} />{" "}{label}</>
      }
    </button>
  );
}
