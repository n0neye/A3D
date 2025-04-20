/** @type {import('next').NextConfig} */
const nextConfig = {

  // Build settings for Electron
  output: 'export',
	trailingSlash: true,
	distDir: 'build',
	assetPrefix: process.env.NODE_ENV === 'production' ? '.' : undefined,
	images: {
		unoptimized: true,
	},
  
	// Configure SVGR
	webpack(config) {
		const fileLoaderRule = config.module.rules.find(rule =>
			rule.test?.test?.('.svg')
		)
		config.module.rules.push(
			{
				...fileLoaderRule,
				test: /\.svg$/i,
				resourceQuery: /url/,
			},
			{
				test: /\.svg$/i,
				issuer: fileLoaderRule.issuer,
				resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] },
				use: ['@svgr/webpack'],
			}
		)
		fileLoaderRule.exclude = /\.svg$/i
		return config
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
