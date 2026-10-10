import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: { cpus: 1 },
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] }];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_INTERNAL_URL ?? "http://localhost:5000"}/api/:path*`,
      },
      {
        source: "/hubs/:path*",
        destination: `${process.env.BACKEND_INTERNAL_URL ?? "http://localhost:5000"}/hubs/:path*`,
      },
    ];
  },
};

export default nextConfig;
