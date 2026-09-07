import path from "node:path";

// Saved by tests/e2e/auth.setup.ts, consumed by playwright.config.ts and the
// pr-acceptance login helpers. playwright/.auth/ is already gitignored.
// Exported so tests/e2e/api-tokens.ts can put the shared API token bundle in
// the same already-ignored directory instead of inventing a second one.
export const AUTH_DIR = path.resolve(__dirname, "..", "..", "playwright", ".auth");

export const ADMIN_STORAGE_STATE = path.join(AUTH_DIR, "admin.json");
export const FIELD_WORKER_STORAGE_STATE = path.join(AUTH_DIR, "field-worker.json");
export const VIEWER_STORAGE_STATE = path.join(AUTH_DIR, "viewer.json");
// SLICE 17: scoped admin — users.view only, no roles.view.
export const SCOPED_ADMIN_STORAGE_STATE = path.join(AUTH_DIR, "scoped-admin.json");
