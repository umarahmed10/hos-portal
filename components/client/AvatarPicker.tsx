"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { compressImage, readUploadResponse } from "@/lib/image";
import { BORDER, MUTED, TEXT, GOLD, SURF_2 } from "@/lib/styles";

interface Props {
  code: string;
  name: string;
  size?: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AvatarPicker({ code, name, size = 36 }: Props) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/avatar?code=${code}`)
      .then(r => r.json())
      .then(j => { if (j.ok && j.data.url) setAvatarUrl(j.data.url); })
      .catch(() => {});
  }, [code]);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      // Downscale to a small avatar so any phone photo uploads fast and never
      // trips the platform body-size limit.
      const small = await compressImage(file, 512, 0.85);
      const form = new FormData();
      form.append("file", small);
      form.append("code", code);
      const res = await fetch("/api/avatar", { method: "POST", body: form });
      const result = await readUploadResponse(res);
      if (result.ok) setAvatarUrl(result.data.url + "?t=" + Date.now());
      else toast.error(result.error);
    } catch {
      toast.error("Couldn't upload that image. Please try another.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }, [code]);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label="Change avatar"
        title="Change avatar"
        style={{
          width: size, height: size, borderRadius: "50%",
          overflow: "hidden", cursor: uploading ? "wait" : "pointer",
          border: `2px solid ${BORDER}`, padding: 0,
          background: SURF_2, position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "border-color 200ms",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <span style={{
            fontSize: size * 0.35, fontWeight: 700, color: TEXT,
            fontFamily: "var(--font-ui)", letterSpacing: "0.02em",
          }}>{initials(name)}</span>
        )}

        {/* Edit overlay on hover */}
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: 0, transition: "opacity 150ms",
          borderRadius: "50%",
        }}
          onMouseEnter={e => { e.currentTarget.style.opacity = "1"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "0"; }}
        >
          <svg width={size * 0.3} height={size * 0.3} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
      </button>

      {uploading && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
        </div>
      )}
    </div>
  );
}

export function ClientAvatar({ code, name, size = 28 }: Props) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/avatar?code=${code}`)
      .then(r => r.json())
      .then(j => { if (j.ok && j.data.url) setAvatarUrl(j.data.url); })
      .catch(() => {});
  }, [code]);

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", display: "block", flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "#3A3A3A", color: TEXT,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, fontFamily: "var(--font-ui)",
    }}>{initials(name)}</div>
  );
}
