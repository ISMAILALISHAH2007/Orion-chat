import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.pollinations.ai',
      },
      {
        protocol: 'https',
        hostname: 'images.pollinations.ai',
      },
    ],
  },
  serverExternalPackages: ['@prisma/client', 'prisma'],
};

export default nextConfig;
