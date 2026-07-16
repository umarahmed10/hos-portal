"use client";
import { useState } from "react";
import { css } from "@/lib/styles";
import { Copy } from "@/components/shared/Icons";

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
      setTimeout(() => setCopied(false), 2000);
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
      <span style={{
        display:    "inline-block",
        transition: "transform 150ms var(--ease-spring)",
        transform:  copied ? "scale(1.2)" : "scale(1)",
      }}>
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ animation: "scalePop 200ms var(--ease-spring)" }}>
            <polyline points="1,6 4.5,10 11,2" stroke="#4EAD87" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <Copy size={12} />
        )}
      </span>
      {copied ? "Copied!" : label}
    </button>
  );
}
