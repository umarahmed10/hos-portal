// Skeleton screen components for async loading states.
// Used in Server Components (Suspense fallbacks) and Client Components.
import { BORDER, SURF } from "@/lib/styles";

interface SkeletonProps {
  width?:  string | number;
  height?: string | number;
  radius?: number;
  style?:  React.CSSProperties;
}

export function Skeleton({ width = "100%", height = 16, radius = 4, style }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background:   `linear-gradient(90deg, ${SURF} 0%, #1a1a1a 50%, ${SURF} 100%)`,
        backgroundSize: "200% 100%",
        animation:    "shimmer 1.4s ease infinite",
        ...style,
      }}
    />
  );
}

export function DocRowSkeleton() {
  return (
    <div style={{
      display:      "flex",
      alignItems:   "center",
      gap:          12,
      padding:      "16px 20px",
      borderBottom: `1px solid ${BORDER}`,
    }}>
      <Skeleton width={48}  height={20} radius={20} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="25%" height={11} />
      </div>
      <Skeleton width={80} height={28} radius={6} />
      <Skeleton width={60} height={28} radius={6} />
    </div>
  );
}

export function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div style={{
      background:   SURF,
      border:       `1px solid ${BORDER}`,
      borderRadius: 10,
      padding:      24,
      marginBottom: 14,
      display:      "flex",
      flexDirection: "column",
      gap:          12,
    }}>
      <Skeleton width="30%" height={10} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "60%" : "100%"} height={13} />
      ))}
    </div>
  );
}

export function LoadingSkeleton({ type }: { type: "portal" | "admin" | "generic" }) {
  const block = (height: number, width = "100%") => (
    <div className="skeleton" style={{ height, width, marginBottom: 8, borderRadius: 6 }} />
  );

  if (type === "portal") return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", animation: "fadeIn 200ms ease" }}>
      {block(20, "40%")}
      {block(52, "60%")}
      {block(16, "80%")}
      <div style={{ height: 32 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 100, borderRadius: 10 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 200, borderRadius: 10 }} />
    </div>
  );

  if (type === "admin") return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 80px", animation: "fadeIn 200ms ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 100, borderRadius: 10 }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 48, borderRadius: 8, marginBottom: 14 }} />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 62, borderRadius: 0, marginBottom: 1 }} />
      ))}
    </div>
  );

  return <div className="skeleton" style={{ height: 200, borderRadius: 10, margin: 24 }} />;
}
