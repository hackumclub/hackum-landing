// Service-worker "kill switch". This site has no service worker, but a browser that once had one registered for
// this origin (e.g. another project that ran on localhost:3000) keeps fetching /sw.js to update it. A 404 leaves
// that stale worker installed and in control of the origin; a valid script that unregisters itself removes it.
// It also stops /sw.js from falling through to /[lang] (as lang="sw.js"). No visitor ever requests this
// unless such a stale worker exists, so it is inert in production.
const KILL_SWITCH = `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.registration.unregister());
});
`;

export function GET() {
  return new Response(KILL_SWITCH, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      // Browsers must re-check this file rather than cache it, so the unregister takes effect.
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
