import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use serverExternalPackages instead of transpilePackages
  // to avoid conflicts in Turbopack
  serverExternalPackages: ["react-map-gl", "mapbox-gl"],
};

export default nextConfig;
