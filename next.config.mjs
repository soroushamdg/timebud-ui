/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@clerk/nextjs', '@tanstack/react-query']
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  },
  swcMinify: true,
  poweredByHeader: false
};

export default nextConfig;
