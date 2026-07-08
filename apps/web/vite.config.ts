import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8")
) as { version: string };

// Deploy pipeline exports VITE_BUILD_SHA (see .github/workflows/deploy.yml)
// so the client + version.json + X-Client-Version header all reflect the
// exact commit shipped. Locally we fall back to "dev" — health.commit does
// the same on the API side.
const BUILD_SHA = process.env.VITE_BUILD_SHA ?? "dev";
const BUILT_AT = new Date().toISOString();

// Emits a top-level version.json into the build output. The file is served
// no-cache (see apps/web/public/staticwebapp.config.json) so operators can
// always read the running SHA + build time by hitting /version.json.
function emitVersionJson(): PluginOption {
  return {
    name: "projectops-emit-version-json",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ sha: BUILD_SHA, builtAt: BUILT_AT }, null, 2)
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest so we can hand-roll the navigation strategy
      // (NetworkFirst with offline fallback — see apps/web/src/sw.ts). The
      // prior generateSW config used navigateFallback: "/index.html" which
      // serves the shell from precache and left returning browsers on a
      // stale bundle across deploys.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // "prompt" so vite-plugin-pwa fires onNeedRefresh and the new SW stays
      // in "waiting" until the user hits Reload in the in-app toast (see
      // updatePromptStore + UpdatePromptToast). autoUpdate + skipWaiting was
      // silently swapping the SW without ever reloading the open tab, leaving
      // users on a stale shell after every deploy.
      registerType: "prompt",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      },
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "Initial Services Project Operations",
        short_name: "ProjectOps",
        description:
          "Project Operations Platform for Initial Services — tendering, jobs, scheduler, field, safety.",
        theme_color: "#005B61",
        background_color: "#ffffff",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      devOptions: { enabled: false }
    }),
    emitVersionJson()
  ],
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"],
    // Keep the monorepo app pointed at the UI package source even after
    // packages/ui grew a dist/ build. The compiled bundle is for external
    // tooling (e.g. Claude Design's /design-sync); in-repo, source is faster
    // and avoids needing to rebuild packages/ui between edits.
    alias: {
      "@project-ops/ui": resolve(__dirname, "../../packages/ui/src/index.ts")
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    "import.meta.env.VITE_BUILD_SHA": JSON.stringify(BUILD_SHA),
    "import.meta.env.VITE_BUILT_AT": JSON.stringify(BUILT_AT)
  },
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-charts": ["recharts"],
          "vendor-msal": ["@azure/msal-browser", "@azure/msal-react"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"]
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
});
