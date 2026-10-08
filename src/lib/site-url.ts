// Absolute site origin for metadata, sitemap and robots. On Vercel the production domain is provided automatically;
// SITE_URL can override it (e.g. a custom domain); local builds fall back to localhost.
export const SITE_URL = (
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");
