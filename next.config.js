/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },

  // Build settings for Electron
  output: "export",
  trailingSlash: true,
  distDir: "build",
  assetPrefix: process.env.NODE_ENV === "production" ? "." : undefined,
  images: {
    unoptimized: true,
  },

  /* config options here */
  // async rewrites() {
  //   return [
  //     {
  //       source: "/ingest/static/:path*",
  //       destination: "https://us-assets.i.posthog.com/static/:path*",
  //     },
  //     {
  //       source: "/ingest/:path*",
  //       destination: "https://us.i.posthog.com/:path*",
  //     },
  //     {
  //       source: "/ingest/decide",
  //       destination: "https://us.i.posthog.com/decide",
  //     },
  //   ];
  // },
  // This is required to support PostHog trailing slash API requests
  // skipTrailingSlashRedirect: true,
};

export default nextConfig;
