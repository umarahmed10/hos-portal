import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer uses canvas — needs to be server-only
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
