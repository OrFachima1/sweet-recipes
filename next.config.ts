import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
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
