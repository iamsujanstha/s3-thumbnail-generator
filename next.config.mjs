/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    /**
     * All profile images come through /api/img/[...key] — a same-origin
     * proxy route. next/image treats same-origin paths as optimisable by
     * default, so no remotePatterns entry is needed for those.
     *
     * minimumCacheTTL: next/image caches the optimised output on the
     * server/CDN for up to 1 year, matching the Cache-Control: immutable
     * header our proxy sets on thumbnails.
     */
    minimumCacheTTL: 31536000,

    /**
     * Keep amazonaws.com allowed in case any code path still generates
     * a direct presigned URL (e.g. during a future migration or fallback).
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
