import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // All photos/posters/icons go through next/image: AVIF/WebP at the width each slot needs.
  // Assets in /public never change in place, so optimized results can be cached for a long time.
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75],
    // Fewer candidate widths: shorter srcset markup and fewer variants to generate. Covers every slot at 1x and 2x
    // (smallest icon 44px → 96, cards 290px → 640, lightbox 980px → 1920).
    imageSizes: [48, 64, 96, 128, 256, 384],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    minimumCacheTTL: 2678400, // 31 days
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Old route names → new ones (permanent). Runs before proxy.ts, which then adds the locale prefix.
  async redirects() {
    return [
      { source: "/hackathons", destination: "/events", permanent: true },
      { source: "/hackathons/:slug", destination: "/events/:slug", permanent: true },
      { source: "/organize", destination: "/join", permanent: true },
      { source: "/:lang(mn|en)/hackathons", destination: "/:lang/events", permanent: true },
      { source: "/:lang(mn|en)/hackathons/:slug", destination: "/:lang/events/:slug", permanent: true },
      { source: "/:lang(mn|en)/organize", destination: "/:lang/join", permanent: true },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    // Pin the workspace root to this project (a stray lockfile in the home folder otherwise confuses root detection).
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
