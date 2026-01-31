import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  
  // Allow WebGL in production
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    return config;
  },
};

export default nextConfig;
