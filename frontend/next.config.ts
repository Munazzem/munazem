import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import path from "path";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: ({ url }: { url: URL }) => {
          return (
            url.pathname.startsWith('/api/') ||
            url.pathname.startsWith('/students') ||
            url.pathname.startsWith('/groups') ||
            url.pathname.startsWith('/sessions') ||
            url.pathname.startsWith('/attendance')
          );
        },
        handler: 'NetworkFirst',
        options: {
          cacheName: 'munazem-api-cache',
          networkTimeoutSeconds: 3,
          expiration: {
            maxEntries: 120,
            maxAgeSeconds: 86400 * 7, // 7 days
          },
        },
      },
    ],
  },
  fallbacks: {
    document: "/~offline",
  },
});

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    return [
      {
        source: '/api/v1/centers/:path*',
        destination: `${backendUrl}/centers/:path*`,
      },
      {
        source: '/centers/cards/batch/:batchId/print',
        destination: `${backendUrl}/centers/cards/batch/:batchId/print`,
      },
    ];
  },
};

export default withPWA(nextConfig);

