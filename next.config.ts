import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN access during dev (Next 16 blocks cross-origin to /_next/* by default).
  allowedDevOrigins: ["192.168.1.100", "localhost", "127.0.0.1"],
};

export default nextConfig;
