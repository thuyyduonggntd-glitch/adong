/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
    ],
  },
  experimental: {
    // i18next/react-i18next의 배럴 import 중 실제 쓰는 모듈만 번들에 포함시킨다.
    optimizePackageImports: ['react-i18next', 'i18next'],
  },
};

module.exports = nextConfig;
