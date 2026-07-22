"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { compressImage, readUploadResponse } from "@/lib/image";
import { TEXT, GOLD, SURF_2 } from "@/lib/styles";

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
  const [hover, setHover] = useState(false);
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
        title="Change photo"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: size, height: size, borderRadius: "50%",
          overflow: "hidden", cursor: uploading ? "wait" : "pointer",
          border: "none", padding: 0,
          background: avatarUrl ? "#000" : SURF_2, position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
          // Soft ring instead of a heavy graphite border — reads premium.
          boxShadow: hover
            ? `0 0 0 2px ${GOLD}, 0 4px 12px rgba(0,0,0,0.4)`
            : `0 0 0 1px rgba(243,241,236,0.12), 0 2px 6px rgba(0,0,0,0.3)`,
          transform: hover && !uploading ? "scale(1.05)" : "scale(1)",
          transition: "box-shadow 180ms, transform 180ms var(--ease-spring, ease)",
        }}
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
            fontSize: size * 0.36, fontWeight: 700, color: TEXT,
            fontFamily: "var(--font-ui)", letterSpacing: "0.02em",
          }}>{initials(name)}</span>
        )}

        {/* Camera badge — bottom-right, appears on hover (modern avatar editors) */}
        {!uploading && (
          <span style={{
            position: "absolute", bottom: -1, right: -1,
            width: Math.max(14, size * 0.42), height: Math.max(14, size * 0.42), borderRadius: "50%",
            background: GOLD, border: "2px solid #111111",
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: hover ? 1 : 0, transform: hover ? "scale(1)" : "scale(0.6)",
            transition: "opacity 160ms, transform 160ms var(--ease-spring, ease)",
          }}>
            <svg width={size * 0.22} height={size * 0.22} viewBox="0 0 24 24" fill="none" stroke="#111111" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </span>
        )}

        {uploading && (
          <span style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          </span>
        )}
      </button>
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
