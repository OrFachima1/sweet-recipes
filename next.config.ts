import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      canvas: { browser: "./empty-module.js" },
    },
  },
  webpack: (config, { isServer }) => {
    // pdfjs-dist optionally requires 'canvas' for DOMMatrix/Path2D polyfills.
    // We only use text extraction (no rendering), so ignore it.
    if (isServer) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    return config;
  },
};

export default nextConfig;
