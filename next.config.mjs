/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Prescription files are uploaded through a server action; the API takes files up to 10 MB
    // (the default limit of a server action body is 1 MB).
    serverActions: { bodySizeLimit: '11mb' },
  },
};

export default nextConfig;
