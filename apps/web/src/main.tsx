import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { App } from "./App";
import { isSsoEnabled, msalConfig } from "./auth/msal.config";
import "./styles.css";

const queryClient = new QueryClient();

const msalInstance = isSsoEnabled ? new PublicClientApplication(msalConfig) : null;

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
