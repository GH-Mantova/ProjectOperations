import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { AUTH_DIR } from "./storage-state";

/**
 * ONE set of API access tokens for the WHOLE run, shared across every
 * Playwright worker.
 *
 * Why this file exists
 * --------------------
 * The pr-acceptance suite runs with several workers, and a worker is a
 * separate Node process. The token cache in pr-acceptance/api-helpers.ts is an
 * in-memory `Map`, so it is per PROCESS: with N workers the suite cold-logged
 * in as admin + field worker N times over. The API throttles /auth/login at
 * 5 per 60s per IP (auth-throttle.config.ts) and every worker calls from
 * 127.0.0.1, so the burst 429s and poisons unrelated specs. Both CI and the
 * local smoke harness paper over it by setting AUTH_THROTTLE_LIMIT=1000, which
 * means the real throttle is never exercised.
 *
 * The structural fix: the setup project (which runs ONCE, before any worker
 * starts) publishes the tokens here, and workers read them instead of logging
 * in. Login count becomes CONSTANT in worker count.
 *
 * Cost accounting
 * ---------------
 * auth.setup.ts already performs four browser form logins to build the
 * storageState files, and the web app persists its access token in
 * localStorage — so those four logins have ALREADY minted exactly the tokens
 * we want. We harvest them out of the storageState rather than spending two
 * more /auth/login calls. Four logins for a whole run is under the production
 * 5/60s limit, so the harness passes at the real throttle rather than only at
 * the relaxed CI one. Minting is kept as a fallback for the case where the
 * harvest comes up empty (see mintOrHarvestToken in auth.setup.ts).
 *
 * The file lives in playwright/.auth/ alongside the storageState files, which
 * .gitignore already excludes (`/playwright/.auth/`), and is rewritten on
 * every run by setup.
 */

/** email -> access token. */
export type ApiTokenBundle = Record<string, string>;

export const API_TOKENS_FILE = path.join(AUTH_DIR, "api-tokens.json");

/**
 * localStorage key the web app persists its access token under — see
 * apps/web/src/auth/AuthContext.tsx. Harvesting is best-effort: if this key
 * ever moves, `accessTokenFromStorageState` returns null and the caller mints
 * a token instead, so the harness degrades to "a couple of extra logins",
 * never to a failure.
 */
const WEB_ACCESS_TOKEN_KEY = "project-ops.accessToken";

/**
 * Treat a token as spent this long before its real `exp`. Access tokens live
 * 15m (auth.accessTtl); a request that starts 59s before expiry must not be
 * allowed to 401 halfway through a fixture teardown.
 */
export const TOKEN_EXPIRY_MARGIN_MS = 60_000;

type StorageStateFile = {
  origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
};

type AccessTokenClaims = { email?: string; exp?: number };

/**
 * Reads a JWT's claims WITHOUT verifying the signature. The harness is not
 * making a trust decision here — the API still verifies every token on every
 * request. All we need locally is "is this token still going to be accepted,
 * and is it the persona we asked for", which is answerable from the payload.
 */
function decodeAccessTokenClaims(token: string): AccessTokenClaims | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AccessTokenClaims;
  } catch {
    return null;
  }
}

/**
 * True when `token` will still be accepted for the next
 * TOKEN_EXPIRY_MARGIN_MS, and (when `email` is given) was actually issued to
 * that persona.
 *
 * The email check is what makes a LEFTOVER token file from an earlier run
 * harmless: a token for the wrong persona, or one whose 15 minutes are up, is
 * rejected here and the caller mints a fresh one.
 */
export function tokenIsFresh(token: string | null | undefined, email?: string): token is string {
  if (!token) return false;
  const claims = decodeAccessTokenClaims(token);
  if (!claims?.exp) return false;
  if (email && claims.email !== email) return false;
  return claims.exp * 1000 - Date.now() > TOKEN_EXPIRY_MARGIN_MS;
}

/** Pulls the access token the web app stashed in a saved storageState, if any. */
export function accessTokenFromStorageState(statePath: string): string | null {
  if (!existsSync(statePath)) return null;
  try {
    const state = JSON.parse(readFileSync(statePath, "utf8")) as StorageStateFile;
    for (const origin of state.origins ?? []) {
      for (const entry of origin.localStorage ?? []) {
        if (entry.name === WEB_ACCESS_TOKEN_KEY && entry.value) return entry.value;
      }
    }
  } catch {
    // A truncated or half-written state file is not worth failing setup over —
    // the caller falls back to minting.
  }
  return null;
}

/** Removes any bundle left behind by a previous run. Called by setup before it republishes. */
export function clearSharedApiTokens(): void {
  rmSync(API_TOKENS_FILE, { force: true });
}

/**
 * Publishes the run's tokens. Written to a temp file and renamed so a worker
 * can never observe a half-written bundle, even though the setup project is
 * ordered before every worker by `dependencies: ["setup"]`.
 */
export function writeSharedApiTokens(tokens: ApiTokenBundle): void {
  mkdirSync(AUTH_DIR, { recursive: true });
  const tmp = `${API_TOKENS_FILE}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(tokens, null, 2)}\n`, "utf8");
  renameSync(tmp, API_TOKENS_FILE);
}

/**
 * Returns the shared token for `email`, or null when there is no bundle, no
 * entry, or the entry is stale. Never throws: a missing or malformed bundle
 * simply means "log in yourself".
 */
export function readSharedApiToken(email: string): string | null {
  if (!existsSync(API_TOKENS_FILE)) return null;
  try {
    const bundle = JSON.parse(readFileSync(API_TOKENS_FILE, "utf8")) as ApiTokenBundle;
    const token = bundle[email];
    return tokenIsFresh(token, email) ? token : null;
  } catch {
    return null;
  }
}
