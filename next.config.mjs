/** @type {import('next').NextConfig} */
const nextConfig = {
  // No Next.js dev badge: store owners see the store in a dev-mode preview (AI Designer).
  devIndicators: false,
  experimental: {
    // Prescription files are uploaded through a server action; the API takes files up to 10 MB
    // (the default limit of a server action body is 1 MB).
    serverActions: { bodySizeLimit: '11mb' },
  },
  // The old storefront's sitemap file names (src/lib/sitemap.ts), served by the sitemap routes.
  async rewrites() {
    return [
      { source: '/sitemap_index.xml', destination: '/sitemap.xml' },
      { source: '/:name(sitemap_[a-z_]+_(?:en|ar)(?:_\\d+)?\\.xml)', destination: '/sitemaps/:name' },
    ];
  },
};

export default nextConfig;
