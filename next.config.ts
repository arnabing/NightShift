import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-map-gl", "mapbox-gl"],
  serverExternalPackages: ["react-map-gl", "mapbox-gl"],
  experimental: {
    serverComponentsExternalPackages: ["react-map-gl", "mapbox-gl"],
  },
  turbopack: {},
};

export default nextConfig;
