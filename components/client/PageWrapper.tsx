"use client";
export function PageWrapper({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <div style={{
      animation: `fadeUp 320ms var(--ease-out) ${delay}ms both`,
    }}>
      {children}
    </div>
  );
}
