import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  
  webpack: (config, { isServer }) => {
    // Only include the browser build when running in the browser
    if (!isServer) {
      config.resolve.alias.paper = 'paper/dist/paper-core';
    }
    return config;
  },
  /* config options here */
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://us.i.posthog.com/decide",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
