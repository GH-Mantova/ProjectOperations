import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { MsalProvider } from "@azure/msal-react";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { consumeSsoRedirect } from "./auth/consumeSsoRedirect";
import { getMsalInstance } from "./auth/msalInstance";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { updatePromptStore } from "./pwa/updatePromptStore";
import { buildInfo } from "./buildInfo";
import "./styles/tokens.css";
import "./styles.css";

const queryClient = new QueryClient();

// Expose the running build SHA as a meta tag so operators can inspect the
// deployed commit straight from DevTools without hitting /version.json.
const buildMeta = document.createElement("meta");
buildMeta.name = "build-sha";
buildMeta.content = buildInfo.sha;
document.head.appendChild(buildMeta);

const msalInstance = getMsalInstance();

// Track whether the user has touched the page yet. If a new SW appears
// BEFORE any interaction, we apply it silently and reload once — the fresh
// open should always land on the latest build. After interaction we fall
// back to the non-blocking toast so we never yank an in-progress form out
// from under the user. sessionStorage guards against reload loops (cleared
// when the tab closes, so a fresh session can auto-reload again).
const RELOAD_GUARD_KEY = "__projectops_pwa_auto_reloaded__";
let hasInteracted = false;
const markInteracted = () => {
  hasInteracted = true;
};
for (const evt of ["pointerdown", "keydown", "input", "change"] as const) {
  window.addEventListener(evt, markInteracted, { capture: true, passive: true });
}

// Register the service worker in "prompt" mode (see vite.config.ts). Fresh
// opens get a silent auto-apply; long-open tabs get the non-blocking in-app
// toast (rendered by UpdatePromptToast) so deploys never yank the page out
// from under an in-progress form.
const updateSW = registerSW({
  onNeedRefresh() {
    const alreadyReloaded = sessionStorage.getItem(RELOAD_GUARD_KEY) === "1";
    if (!hasInteracted && !alreadyReloaded) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
      void updateSW(true);
      return;
    }
    updatePromptStore.signalNeedRefresh();
  },
  onOfflineReady() {
    // Brief, non-intrusive console log — the OfflineIndicator already
    // surfaces sync state in the field UI when needed.
    console.info("[ProjectOps] PWA ready — offline use available.");
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    // Belt for the SW's own update timer: force an update check on load
    // and every time the tab becomes visible again. Combined with
    // NetworkFirst navigations and no-cache headers on /sw.js, this makes
    // a fresh open reliably pick up the latest deploy.
    const check = () => {
      void registration.update().catch(() => {});
    };
    check();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
  }
});

updatePromptStore.setUpdater(() => updateSW(true));

const tree = (
  <React.StrictMode>
    {/* Top-level error boundary so a render-phase throw anywhere in the
        tree (including the login / SSO / request-access flows) renders a
        friendly fallback instead of a blank white page. */}
    <ErrorBoundary sectionName="Project Ops">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Process any pending MSAL redirect BEFORE we render. Otherwise the router
// renders first, the protected route sees `isAuthenticated === false`, and
// navigates to /login — clearing the auth response from the URL before
// MSAL can consume it. consumeSsoRedirect seeds localStorage so AuthContext
// reads an authenticated state on its very first render.
async function bootstrap() {
  if (msalInstance) {
    await consumeSsoRedirect(msalInstance);
  }
  ReactDOM.createRoot(document.getElementById("root")!).render(
    msalInstance ? <MsalProvider instance={msalInstance}>{tree}</MsalProvider> : tree
  );
}

void bootstrap();
