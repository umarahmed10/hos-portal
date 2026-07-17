export function HOSTeamAvatar({ size = 28 }: { size?: number }) {
  const iconSize = size * 0.52;
  const pad = (size - iconSize) / 2;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "#1A1A1A",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Roof */}
        <path d="M12 2L2 10h3v10h14V10h3L12 2z" fill="none" stroke="#8B6B3E" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        {/* Door */}
        <rect x="9.5" y="14" width="5" height="6" rx="0.5" fill="none" stroke="#8B6B3E" strokeWidth="1.4" />
        {/* Crossbar accent */}
        <line x1="5" y1="13" x2="19" y2="13" stroke="#8B6B3E" strokeWidth="0.8" opacity="0.5" />
      </svg>
    </div>
  );
}
