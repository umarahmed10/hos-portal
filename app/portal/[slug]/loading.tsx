// Portal loading skeleton — mirrors the real dashboard shape (growth header +
// daily-read strip + KPI grid + budget) with a shimmer, so waiting reads as
// "your dashboard is on its way," not "something is broken." (UX report §4.1)
function Bone({ w, h = 14, radius = 6, style }: { w: string | number; h?: number; radius?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: radius, ...style }} />;
}

export default function PortalLoading() {
  return (
    <div style={{ padding: "28px 20px 100px", maxWidth: 800, margin: "0 auto" }}>
      {/* Growth header */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <Bone w={60} h={9} />
        <Bone w="55%" h={32} radius={8} />
      </div>

      {/* Daily-read strip */}
      <div style={{ border: "1px solid rgba(139,107,62,0.14)", borderRadius: 12, padding: "18px 20px", marginBottom: 16, background: "rgba(139,107,62,0.03)", display: "flex", flexDirection: "column", gap: 10 }}>
        <Bone w={90} h={9} />
        <Bone w="92%" h={14} />
        <Bone w="80%" h={12} />
        <Bone w="86%" h={12} />
      </div>

      {/* ROI hero */}
      <div style={{ border: "1px solid #2A2A2A", borderRadius: 12, padding: "26px 28px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <Bone w={120} h={9} />
        <Bone w="42%" h={52} radius={8} />
        <Bone w="60%" h={12} />
      </div>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ border: "1px solid #2A2A2A", borderRadius: 10, padding: "18px 20px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <Bone w="55%" h={9} />
            <Bone w="40%" h={30} radius={6} />
            <Bone w="70%" h={9} />
          </div>
        ))}
      </div>

      {/* Budget bar */}
      <div style={{ border: "1px solid #2A2A2A", borderRadius: 10, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <Bone w={70} h={9} />
        <Bone w="45%" h={22} radius={6} />
        <Bone w="100%" h={8} radius={4} />
      </div>
    </div>
  );
}
