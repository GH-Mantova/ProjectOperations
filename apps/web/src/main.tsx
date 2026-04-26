import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { isSsoEnabled, msalConfig } from "./auth/msal.config";
import "./styles/tokens.css";
import "./styles.css";

const queryClient = new QueryClient();

const msalInstance = isSsoEnabled ? new PublicClientApplication(msalConfig) : null;

// PR F FIX 2 — register the service worker explicitly so we can prompt the
// user when a fresh shell is ready. A simple confirm() is intentional here:
// the toast system lives inside React tree and isn't reachable from this
// module-level callback. Reload only if the user opts in; otherwise the new
// SW still takes over on next full navigation.
const updateSW = registerSW({
  onNeedRefresh() {
    if (window.confirm("A new version of Project Operations is available. Reload now?")) {
      void updateSW(true);
    }
  },
  onOfflineReady() {
    // Brief, non-intrusive console log — the OfflineIndicator already
    // surfaces sync state in the field UI when needed.
    console.info("[ProjectOps] PWA ready — offline use available.");
  }
});

const tree = (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  msalInstance ? <MsalProvider instance={msalInstance}>{tree}</MsalProvider> : tree
);
