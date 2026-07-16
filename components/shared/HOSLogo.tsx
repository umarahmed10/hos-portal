interface HOSLogoProps {
  size?: number;
  theme?: "dark" | "light"; // dark = on dark bg, light = on light bg
  showWordmark?: boolean;
  showTagline?: boolean;
}

export function HOSLogo({
  size = 40,
  theme = "dark",
  showWordmark = true,
  showTagline = false,
}: HOSLogoProps) {
  const stemColor  = theme === "dark" ? "#F3F1EC" : "#111111";
  const crossColor = "#8B6B3E";
  const textColor  = theme === "dark" ? "#F3F1EC" : "#111111";
  const mutedColor = theme === "dark" ? "rgba(243,241,236,0.25)" : "rgba(17,17,17,0.4)";

  const markHeight = size;
  const markWidth  = Math.round(size * (44 / 56));

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.18) }}>
      {/* H bracket mark */}
      <svg
        viewBox="0 0 44 56"
        width={markWidth}
        height={markHeight}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="HOS mark"
      >
        <rect x="0"  y="0" width="9"  height="56" fill={stemColor} />
        <rect x="35" y="0" width="9"  height="56" fill={stemColor} />
        <rect x="0"  y="24" width="44" height="2"  fill={crossColor} />
      </svg>

      {showWordmark && (
        <div>
          <div style={{
            fontFamily:    "var(--font-display)",
            fontSize:      Math.round(size * 1.1),
            fontWeight:    400,
            letterSpacing: "0.005em",
            lineHeight:    1,
            color:         textColor,
          }}>
            OS
          </div>
          {showTagline && (
            <div style={{
              fontFamily:    "var(--font-mono)",
              fontSize:      Math.round(size * 0.22),
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color:         mutedColor,
              marginTop:     Math.round(size * 0.1),
            }}>
              Demand Infrastructure
            </div>
          )}
        </div>
      )}
    </div>
  );
}
