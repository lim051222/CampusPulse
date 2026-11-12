import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Same-origin proxy so the browser never needs CORS during development.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000";
    return [
      { source: "/api/:path*", destination: `${target}/api/:path*` },
      { source: "/healthz", destination: `${target}/healthz` },
    ];
  },
};

export default nextConfig;
