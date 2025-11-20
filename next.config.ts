import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-map-gl", "mapbox-gl"],
  // Empty turbopack config to silence webpack warning
  // transpilePackages handles the map libraries
  turbopack: {},
};

export default nextConfig;
