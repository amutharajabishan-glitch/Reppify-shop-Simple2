/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'reppify.ch' },
      { protocol: 'https', hostname: '**.vercel.app' }
    ]
  }
};
module.exports = nextConfig;
