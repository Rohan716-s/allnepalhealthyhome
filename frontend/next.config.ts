import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
