import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts", // Where you will write your service worker
  swDest: "public/sw.js", // Where the compiled service worker will output
  disable: process.env.NODE_ENV !== "production", // Only enable in production
});

const nextConfig: NextConfig = {
  turbopack: {}, // Add turbopack config to silence the warning
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },
};

export default withSerwist(nextConfig);
