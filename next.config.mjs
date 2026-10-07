/** @type {import('next').NextConfig} */
const nextConfig = {
  // No Next.js dev badge: store owners see the store in a dev-mode preview (AI Designer).
  devIndicators: false,
  experimental: {
    // Prescription files are uploaded through a server action; the API takes files up to 10 MB
    // (the default limit of a server action body is 1 MB).
    serverActions: { bodySizeLimit: '11mb' },
  },
};

export default nextConfig;
