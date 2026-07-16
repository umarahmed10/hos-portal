import { BORDER, SURF } from "@/lib/styles";

function Bone({ w, h = 14, radius = 6 }: { w: string | number; h?: number; radius?: number }) {
  return (
    <div style={{
      width:        w,
      height:       h,
      borderRadius: radius,
      background:   SURF,
      border:       `1px solid ${BORDER}`,
      animation:    "pulse 1.6s ease-in-out infinite",
    }} />
  );
}

export default function PortalLoading() {
  return (
    <div style={{ padding: "32px 20px", maxWidth: 680, margin: "0 auto" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Bone w="40%" h={10} />
        <Bone w="60%" h={28} radius={8} />
        <Bone w="85%" h={14} />
        <div style={{ height: 8 }} />
        <Bone w="100%" h={120} radius={12} />
        <Bone w="100%" h={80}  radius={12} />
      </div>
    </div>
  );
}
