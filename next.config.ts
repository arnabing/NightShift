import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Experimental: tell Turbopack to skip these packages during optimization
  experimental: {
    optimizePackageImports: [],
    turbo: {
      resolveAlias: {
        "mapbox-gl": "mapbox-gl/dist/mapbox-gl.js",
      },
    },
  },
};

export default nextConfig;
