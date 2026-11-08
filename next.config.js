/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  experimental: {
    outputFileTracingIncludes: {
      '/api/tools/*': ['./scripts/spectre-api-tool.cjs'],
    },
  },
};

module.exports = nextConfig;
