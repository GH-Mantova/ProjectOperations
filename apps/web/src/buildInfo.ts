// Build identity for the running bundle. Values are baked in at build time
// by vite.config.ts (see the `define` block) from the deploy pipeline's
// VITE_BUILD_SHA. Locally, both fall back to sentinel values so nothing
// crashes and the UI/telemetry can still surface a "dev" build.

const rawSha = (import.meta.env.VITE_BUILD_SHA as string | undefined) ?? "dev";
const rawBuiltAt = (import.meta.env.VITE_BUILT_AT as string | undefined) ?? "";

export const buildInfo = {
  sha: rawSha,
  shortSha: rawSha === "dev" ? "dev" : rawSha.slice(0, 7),
  builtAt: rawBuiltAt
} as const;
