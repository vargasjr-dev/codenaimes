import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  eslint: {
    // Lint runs as a separate CI step; don't block builds on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
