/// <reference lib="webworker" />

// Custom service worker (injectManifest strategy — see vite.config.ts).
//
// Why a hand-rolled SW instead of generateSW: the previous generateSW config
// used `navigateFallback: "/index.html"`, which registers a NavigationRoute
// that serves index.html directly from the precache. That means a returning
// browser always got the OLD shell (pointing at the OLD hashed bundle) until
// the SW updated — the deploy-then-open-fresh case that people notice as
// "the site is stale". Here we go NetworkFirst for navigations (3s timeout)
// so an online open always fetches the current index.html; offline we fall
// back to the precached shell so field workers keep working.
//
// Every safety rule from the prior config is preserved verbatim:
//   * MSAL auth-redirect denylist (code/state/etc + login.microsoftonline.com)
//   * /api NetworkFirst with 5s timeout
//   * login.microsoftonline.com NetworkOnly
//
// skipWaiting is only triggered when the client explicitly posts a
// SKIP_WAITING message (which registerSW's updateSW(true) does under the
// hood). We NEVER call skipWaiting unconditionally on install — that would
// yank the SW out from under a tab the user is mid-form on.

import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute, setCatchHandler } from "workbox-routing";
import { NetworkFirst, NetworkOnly } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string } | undefined;
  if (data?.type === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});

const AUTH_REDIRECT_QUERY = /[?&](code|state|error|error_description|session_state)=/;
const API_URL = /^https?:\/\/[^/]+\/api\//i;
const MSAL_URL = /^https:\/\/login\.microsoftonline\.com\//i;

// login.microsoftonline.com must never touch a cache.
registerRoute(({ url }) => MSAL_URL.test(url.href), new NetworkOnly());

// /api: NetworkFirst, 5s timeout, 24h expiration, 200 entries — same policy
// as before, moved from generateSW's runtimeCaching to explicit registerRoute.
registerRoute(
  ({ url }) => API_URL.test(url.href),
  new NetworkFirst({
    cacheName: "api-cache",
    networkTimeoutSeconds: 5,
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 })]
  })
);

// App-shell navigations: NetworkFirst with a 3s timeout so fresh opens
// always hit the current index.html and its new hashed bundles. On failure
// (offline / slow), setCatchHandler serves the precached shell so field
// workers keep working.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: "navigation-shell",
      networkTimeoutSeconds: 3,
      plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 })]
    }),
    {
      denylist: [/^\/api/, AUTH_REDIRECT_QUERY, /login\.microsoftonline\.com/]
    }
  )
);

setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate") {
    const cached = await matchPrecache("/index.html");
    if (cached) return cached;
  }
  return Response.error();
});
