// GitHub App authentication for the PR watcher (option B, part 2).
//
// The watcher formerly shelled out to `gh` with ambient keyring auth, which
// authenticates as `GH-Mantova` — the same identity as Marco, Station 00 and
// Station 06. That made every `LABELED by GH-Mantova` / `UNLABELED by
// GH-Mantova` pair unattributable and had to be resolved eight times by asking
// Marco what he did. Runbook: docs/runbooks/watcher-identity-github-app.md.
//
// This module mints an installation access token for the `projectops-watcher`
// GitHub App and hands it to `runGh` via `GH_TOKEN`. The token expires after
// one hour; the cache refreshes when less than ten minutes remain.
//
// Design invariants that must hold:
//   1. Node built-ins only. No `jsonwebtoken`, no `@octokit/*`.
//   2. Configuration comes from the environment only. The `.pem` lives at
//      C:\po-secrets\ and MUST NEVER be read from or written to a working tree.
//   3. FAIL CLOSED. If minting fails, callers throw and no `gh` call is
//      attempted. The watcher must NOT fall back to ambient keyring auth —
//      a silent fallback puts the identity back to `GH-Mantova` at the
//      moment something is already wrong, which is when you most need the
//      audit trail to be readable.
//   4. Never log the token or the PEM. Redact both in every error message.

import crypto from "node:crypto";
import { readFile } from "node:fs/promises";

// GitHub JWT ceiling is 10 minutes; we back-date iat by 60s to absorb clock
// skew and set exp to iat + 600s = 10 minutes exactly (the maximum).
const JWT_IAT_BACKDATE_S = 60;
const JWT_EXP_AHEAD_S = 540;

// Refresh the installation token when less than 10 minutes remain on its
// 1-hour TTL. With a startup mint at t=0 and a 5-minute refresh cadence, this
// means the next re-mint happens at ~t=50min — never per-call and never at
// expiry.
const REFRESH_LEAD_MS = 10 * 60 * 1000;

let cache = null; // { token: string, expiresAt: number(ms) } | null
let authLive = false;

function base64url(input) {
  const buf = typeof input === "string" ? Buffer.from(input) : Buffer.from(input);
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Strip anything that could be a token or PEM body from an error message.
// Applied to every error thrown from this module.
export function redactSecrets(msg) {
  return String(msg)
    .replace(/gh[opsu]_[A-Za-z0-9_]+/g, "[REDACTED-TOKEN]")
    .replace(/-----BEGIN[^-]+-----[\s\S]*?-----END[^-]+-----/g, "[REDACTED-KEY]");
}

function redactedError(msg) {
  return new Error(redactSecrets(msg));
}

// Mint a GitHub App JWT signed with the App's private key. `nowSeconds` is
// passed by the caller so tests can drive the clock deterministically.
export function mintAppJwt(appId, pem, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!appId) throw redactedError("mintAppJwt: missing appId");
  if (!pem) throw redactedError("mintAppJwt: missing pem");
  const iat = nowSeconds - JWT_IAT_BACKDATE_S;
  const exp = nowSeconds + JWT_EXP_AHEAD_S;
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iat, exp, iss: String(appId) }));
  const signingInput = `${header}.${payload}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  let sig;
  try {
    sig = signer.sign(pem);
  } catch (err) {
    throw redactedError(`JWT signing failed: ${err.code || err.message}`);
  }
  return `${signingInput}.${base64url(sig)}`;
}

// Exchange an App JWT for an installation access token. Returns
// `{ token, expiresAt }` where expiresAt is a millisecond epoch.
export async function fetchInstallationToken(jwt, installationId, { fetchImpl = fetch } = {}) {
  if (!jwt) throw redactedError("fetchInstallationToken: missing jwt");
  if (!installationId) throw redactedError("fetchInstallationToken: missing installationId");
  const url = `https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`;
  let res;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "projectops-watcher",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch (err) {
    throw redactedError(`installation token request failed: ${err.code || err.message}`);
  }
  if (!res.ok) {
    let body = "";
    try {
      body = (await res.text()).slice(0, 200);
    } catch {
      // best-effort — body is optional
    }
    throw redactedError(`installation token exchange returned ${res.status} ${res.statusText}: ${body}`);
  }
  let payload;
  try {
    payload = await res.json();
  } catch (err) {
    throw redactedError(`installation token response was not JSON: ${err.message}`);
  }
  if (!payload || typeof payload.token !== "string" || typeof payload.expires_at !== "string") {
    throw redactedError("installation token response missing token or expires_at");
  }
  const expiresAt = Date.parse(payload.expires_at);
  if (!Number.isFinite(expiresAt)) {
    throw redactedError(`installation token response has invalid expires_at`);
  }
  return { token: payload.token, expiresAt };
}

// Cached installation token accessor. Reads config from `env`, reads the PEM
// off disk, mints a fresh JWT, exchanges it, and caches the result. Refreshes
// automatically when less than ten minutes remain on the current token.
//
// Fail-closed on ANY failure: clears the cache, marks auth dead, and rejects.
// Callers that see a rejection MUST NOT fall back to ambient keyring auth.
export async function getToken({
  now = Date.now(),
  env = process.env,
  fetchImpl = fetch,
  readFileImpl = readFile,
} = {}) {
  if (cache && now < cache.expiresAt - REFRESH_LEAD_MS) {
    return cache.token;
  }
  const appId = env.PO_WATCHER_APP_ID;
  const installationId = env.PO_WATCHER_INSTALLATION_ID;
  const keyPath = env.PO_WATCHER_APP_KEY;
  if (!appId) {
    authLive = false;
    cache = null;
    throw redactedError("PO_WATCHER_APP_ID is not set");
  }
  if (!installationId) {
    authLive = false;
    cache = null;
    throw redactedError("PO_WATCHER_INSTALLATION_ID is not set");
  }
  if (!keyPath) {
    authLive = false;
    cache = null;
    throw redactedError("PO_WATCHER_APP_KEY is not set");
  }
  let pem;
  try {
    pem = await readFileImpl(keyPath, "utf-8");
  } catch (err) {
    authLive = false;
    cache = null;
    // Redact the full path — leave just the basename for diagnostics.
    const basename = keyPath.replace(/^.*[\\/]/, "");
    throw redactedError(`could not read PO_WATCHER_APP_KEY (${basename}): ${err.code || err.message}`);
  }
  try {
    const jwt = mintAppJwt(appId, pem, Math.floor(now / 1000));
    const { token, expiresAt } = await fetchInstallationToken(jwt, installationId, { fetchImpl });
    cache = { token, expiresAt };
    authLive = true;
    return token;
  } catch (err) {
    authLive = false;
    cache = null;
    throw redactedError(err.message);
  }
}

// Whether the last getToken() call succeeded. False until the first mint,
// false after any failure, true only after a successful mint. Callers can
// use this to decide whether the audit trail is currently trustworthy.
export function isAuthLive() {
  return authLive;
}

// Test-only. Resets the module-level cache so tests can start from a clean
// state. Never call from production code.
export function _resetTokenCacheForTests() {
  cache = null;
  authLive = false;
}
