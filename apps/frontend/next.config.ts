import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Required for Docker production image
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3021/api/:path*",
      },
    ];
  },
};

export default nextConfig;
