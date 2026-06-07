/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // All images now come through /api/img/[...key] (same-origin proxy).
    // next/image caches the optimised output for up to 1 year.
    minimumCacheTTL: 31536000, // 1 year — matches thumbnail Cache-Control

    // Keep amazonaws.com allowed for the detail sheet's originalUrl
    // in case any caller still passes a presigned URL directly.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
