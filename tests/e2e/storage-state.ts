import path from "node:path";

// Saved by tests/e2e/auth.setup.ts, consumed by playwright.config.ts and the
// pr-acceptance login helpers. playwright/.auth/ is already gitignored.
const AUTH_DIR = path.resolve(__dirname, "..", "..", "playwright", ".auth");

export const ADMIN_STORAGE_STATE = path.join(AUTH_DIR, "admin.json");
export const FIELD_WORKER_STORAGE_STATE = path.join(AUTH_DIR, "field-worker.json");
export const VIEWER_STORAGE_STATE = path.join(AUTH_DIR, "viewer.json");
