import type { NextConfig } from "next";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.21", "localhost"],

  async rewrites() {
    return [
      {
        source: "/mixparty-api/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;