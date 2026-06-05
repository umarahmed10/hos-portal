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
