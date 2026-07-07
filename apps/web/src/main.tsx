import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { consumeSsoRedirect } from "./auth/consumeSsoRedirect";
import { isSsoEnabled, msalConfig } from "./auth/msal.config";
import { updatePromptStore } from "./pwa/updatePromptStore";
import "./styles/tokens.css";
import "./styles.css";

const queryClient = new QueryClient();

const msalInstance = isSsoEnabled ? new PublicClientApplication(msalConfig) : null;

// Register the service worker in "prompt" mode (see vite.config.ts). The new
// SW installs but waits — we surface a non-blocking in-app toast (rendered by
// UpdatePromptToast) and only call updateSW(true) when the user opts in, so a
// deploy never yanks the page out from under an in-progress form.
const updateSW = registerSW({
  onNeedRefresh() {
    updatePromptStore.signalNeedRefresh();
  },
  onOfflineReady() {
    // Brief, non-intrusive console log — the OfflineIndicator already
    // surfaces sync state in the field UI when needed.
    console.info("[ProjectOps] PWA ready — offline use available.");
  }
});

updatePromptStore.setUpdater(() => updateSW(true));

const tree = (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
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
