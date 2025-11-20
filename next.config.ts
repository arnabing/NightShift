import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-map-gl", "mapbox-gl"],
  webpack: (config) => {
    // Handle mapbox-gl which has issues with webpack
    config.resolve.alias = {
      ...config.resolve.alias,
      "mapbox-gl": "mapbox-gl/dist/mapbox-gl.js",
    };
    return config;
  },
};

export default nextConfig;
