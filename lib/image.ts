// Client-side image downscale/compress. Phone photos are often 5–12 MB, which
// exceeds Vercel's ~4.5 MB serverless request-body limit — the upload route
// never even runs and the platform returns a non-JSON error. Compressing in the
// browser first keeps uploads well under the limit AND makes them load fast.
export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.82,
): Promise<File> {
  // Leave non-images and GIFs (animation) untouched.
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob) return file;
    // If compression somehow made it bigger, keep the original.
    if (blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// Read a fetch Response defensively — a platform 413 (body too large) returns
// non-JSON, which would throw on res.json(). Returns a clean error message.
export async function readUploadResponse(res: Response): Promise<{ ok: true; data: { url: string; filename?: string; size?: number; type?: string } } | { ok: false; error: string }> {
  const text = await res.text().catch(() => "");
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  const j = json as { ok?: boolean; data?: { url: string }; error?: string } | null;
  if (res.ok && j?.ok && j.data) return { ok: true, data: j.data as { url: string } };
  const error = j?.error
    || (res.status === 413 ? "That file is too large. Please use one under 4 MB."
      : res.status === 429 ? "Too many uploads — give it a moment."
      : `Upload failed (${res.status}).`);
  return { ok: false, error };
}
