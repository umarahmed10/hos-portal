export function HOSTeamAvatar({ size = 28 }: { size?: number }) {
  const iconSize = size * 0.55;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "#1A1A1A", border: "1px solid rgba(139,107,62,0.2)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 44 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left stem */}
        <rect x="0" y="0" width="9" height="56" rx="1.5" fill="#F3F1EC" />
        {/* Right stem */}
        <rect x="35" y="0" width="9" height="56" rx="1.5" fill="#F3F1EC" />
        {/* Bronze crossbar at 43% */}
        <rect x="0" y="24" width="44" height="3" fill="#8B6B3E" />
      </svg>
    </div>
  );
}
