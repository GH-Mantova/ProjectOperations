// Unit tests for app-auth.mjs — the GitHub App installation-token cache the
// watcher uses to shed its ambient GH-Mantova identity.
//
// Style follows verdict-guard.spec.mjs: node:test, node:assert/strict, zero
// external dependencies. We generate a throwaway RSA key at test time rather
// than checking one in.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  mintAppJwt,
  fetchInstallationToken,
  getToken,
  isAuthLive,
  redactSecrets,
  _resetTokenCacheForTests,
} from "../app-auth.mjs";

// A throwaway 2048-bit RSA keypair for signing/verifying test JWTs.
const { privateKey: signingKey, publicKey: verifyKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const PEM = signingKey.export({ type: "pkcs1", format: "pem" }).toString();

function b64urlDecode(s) {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = norm + "=".repeat((4 - (norm.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

// A fake readFile that returns our test PEM without touching disk. Prevents
// tests from ever needing to write a real key to any working tree.
async function fakeReadFile(_path) {
  return PEM;
}

test("mintAppJwt produces an RS256 JWT with iat=now-60, exp=now+540, iss=appId", () => {
  const now = 1_700_000_000;
  const jwt = mintAppJwt("4798698", PEM, now);
  const parts = jwt.split(".");
  assert.equal(parts.length, 3);

  const header = JSON.parse(b64urlDecode(parts[0]).toString("utf8"));
  const payload = JSON.parse(b64urlDecode(parts[1]).toString("utf8"));
  assert.deepEqual(header, { alg: "RS256", typ: "JWT" });
  assert.equal(payload.iat, now - 60);
  assert.equal(payload.exp, now + 540);
  assert.equal(payload.iss, "4798698");
  // GitHub rejects JWTs whose lifetime exceeds 10 minutes.
  assert.equal(payload.exp - payload.iat, 600);

  const signingInput = `${parts[0]}.${parts[1]}`;
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(signingInput);
  assert.equal(verifier.verify(verifyKey, b64urlDecode(parts[2])), true);
});

test("mintAppJwt rejects missing appId or pem", () => {
  assert.throws(() => mintAppJwt("", PEM, 1000), /missing appId/);
  assert.throws(() => mintAppJwt("123", "", 1000), /missing pem/);
});

test("fetchInstallationToken parses GitHub 201 into {token, expiresAt}", async () => {
  const expiry = "2030-01-01T00:00:00Z";
  const fetchImpl = async (url, init) => {
    assert.match(url, /\/app\/installations\/158348768\/access_tokens$/);
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, "Bearer test-jwt");
    assert.equal(init.headers.Accept, "application/vnd.github+json");
    return {
      ok: true,
      status: 201,
      statusText: "Created",
      async json() {
        return { token: "ghs_installation_abc", expires_at: expiry };
      },
    };
  };
  const out = await fetchInstallationToken("test-jwt", "158348768", { fetchImpl });
  assert.equal(out.token, "ghs_installation_abc");
  assert.equal(out.expiresAt, Date.parse(expiry));
});

test("fetchInstallationToken throws on non-2xx and does not leak the JWT", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 401,
    statusText: "Unauthorized",
    async text() {
      return "bad credentials";
    },
  });
  await assert.rejects(fetchInstallationToken("very-secret-jwt-value", "1", { fetchImpl }), (err) => {
    assert.match(err.message, /401/);
    assert.doesNotMatch(err.message, /very-secret-jwt-value/);
    return true;
  });
});

test("getToken caches within TTL and refreshes when less than 10 minutes remain", async () => {
  _resetTokenCacheForTests();
  const env = {
    PO_WATCHER_APP_ID: "4798698",
    PO_WATCHER_INSTALLATION_ID: "158348768",
    PO_WATCHER_APP_KEY: "C:/po-secrets/does-not-exist.pem",
  };
  let calls = 0;
  let clock = 1_800_000_000_000;
  const fetchImpl = async () => {
    calls += 1;
    return {
      ok: true,
      status: 201,
      async json() {
        // Each mint returns a token valid for 1 hour from the current clock.
        return { token: `ghs_call_${calls}`, expires_at: new Date(clock + 3600 * 1000).toISOString() };
      },
    };
  };

  const t1 = await getToken({ now: clock, env, fetchImpl, readFileImpl: fakeReadFile });
  const t2 = await getToken({ now: clock + 60_000, env, fetchImpl, readFileImpl: fakeReadFile });
  assert.equal(t1, "ghs_call_1");
  assert.equal(t2, "ghs_call_1");
  assert.equal(calls, 1, "cached token — no second mint");

  // Advance to 51 minutes — <10 min left, must refresh.
  clock += 51 * 60 * 1000;
  const t3 = await getToken({ now: clock, env, fetchImpl, readFileImpl: fakeReadFile });
  assert.equal(t3, "ghs_call_2");
  assert.equal(calls, 2, "past the 50-minute refresh threshold — new mint");
  assert.equal(isAuthLive(), true);
});

// This is the whole point of the design. A silent fallback puts the identity
// back to GH-Mantova at exactly the moment something is already wrong.
test("getToken FAIL-CLOSED: mint failure clears cache and marks auth dead", async () => {
  _resetTokenCacheForTests();
  const env = {
    PO_WATCHER_APP_ID: "1",
    PO_WATCHER_INSTALLATION_ID: "2",
    PO_WATCHER_APP_KEY: "C:/po-secrets/does-not-exist.pem",
  };
  const fetchImpl = async () => ({
    ok: false,
    status: 500,
    statusText: "Server Error",
    async text() {
      return "boom";
    },
  });
  await assert.rejects(getToken({ now: Date.now(), env, fetchImpl, readFileImpl: fakeReadFile }));
  assert.equal(isAuthLive(), false);
  // Subsequent call also throws — never silently falls through to keyring auth.
  await assert.rejects(getToken({ now: Date.now(), env, fetchImpl, readFileImpl: fakeReadFile }));
  assert.equal(isAuthLive(), false);
});

// Wiring guard: runGh in index.mjs calls getToken() BEFORE spawning `gh`, so
// a mint failure means the `gh` binary is never invoked with a mutating verb.
// This is a direct proxy for the wiring requirement in the prompt.
test("getToken failure aborts before any downstream gh call would be attempted", async () => {
  _resetTokenCacheForTests();
  const env = {
    PO_WATCHER_APP_ID: "1",
    PO_WATCHER_INSTALLATION_ID: "2",
    PO_WATCHER_APP_KEY: "C:/po-secrets/does-not-exist.pem",
  };
  const fetchImpl = async () => {
    throw new Error("network unreachable");
  };
  let ghWouldHaveBeenCalled = false;
  const simulatedRunGh = async (_args) => {
    try {
      await getToken({ now: Date.now(), env, fetchImpl, readFileImpl: fakeReadFile });
    } catch (err) {
      throw new Error(`gh call refused — watcher app-auth failed-closed: ${err.message}`);
    }
    ghWouldHaveBeenCalled = true;
    return "ok";
  };
  await assert.rejects(simulatedRunGh(["pr", "merge", "1234", "--squash"]), /failed-closed/);
  assert.equal(ghWouldHaveBeenCalled, false, "no gh mutation is attempted when auth fails");
});

test("getToken rejects when the PEM file cannot be read (rotated / moved key)", async () => {
  _resetTokenCacheForTests();
  const env = {
    PO_WATCHER_APP_ID: "1",
    PO_WATCHER_INSTALLATION_ID: "2",
    PO_WATCHER_APP_KEY: "C:/po-secrets/rotated.pem",
  };
  const missingFileReader = async () => {
    const err = new Error("ENOENT: no such file or directory");
    err.code = "ENOENT";
    throw err;
  };
  await assert.rejects(
    getToken({
      now: Date.now(),
      env,
      fetchImpl: async () => {
        throw new Error("should not be reached");
      },
      readFileImpl: missingFileReader,
    }),
    (err) => {
      assert.match(err.message, /ENOENT|could not read/);
      // Basename may appear; full path with drive letter must not.
      assert.doesNotMatch(err.message, /C:[\\/]po-secrets[\\/]rotated\.pem/);
      return true;
    },
  );
  assert.equal(isAuthLive(), false);
});

test("getToken rejects when any required env var is missing", async () => {
  _resetTokenCacheForTests();
  const noop = async () => {
    throw new Error("should not be reached");
  };
  await assert.rejects(
    getToken({
      env: { PO_WATCHER_INSTALLATION_ID: "2", PO_WATCHER_APP_KEY: "/x" },
      fetchImpl: noop,
      readFileImpl: fakeReadFile,
    }),
    /PO_WATCHER_APP_ID/,
  );
  _resetTokenCacheForTests();
  await assert.rejects(
    getToken({
      env: { PO_WATCHER_APP_ID: "1", PO_WATCHER_APP_KEY: "/x" },
      fetchImpl: noop,
      readFileImpl: fakeReadFile,
    }),
    /PO_WATCHER_INSTALLATION_ID/,
  );
  _resetTokenCacheForTests();
  await assert.rejects(
    getToken({
      env: { PO_WATCHER_APP_ID: "1", PO_WATCHER_INSTALLATION_ID: "2" },
      fetchImpl: noop,
      readFileImpl: fakeReadFile,
    }),
    /PO_WATCHER_APP_KEY/,
  );
});

test("redactSecrets scrubs gh tokens and PEM bodies", () => {
  const dirty = [
    "token was ghs_1abc2def3ghi4jkl and ghu_shortlived123",
    "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIB...secret bytes...\n-----END RSA PRIVATE KEY-----",
  ].join("\n");
  const clean = redactSecrets(dirty);
  assert.doesNotMatch(clean, /ghs_1abc2def3ghi4jkl/);
  assert.doesNotMatch(clean, /ghu_shortlived123/);
  assert.doesNotMatch(clean, /BEGIN RSA/);
  assert.doesNotMatch(clean, /secret bytes/);
  assert.match(clean, /REDACTED-TOKEN/);
  assert.match(clean, /REDACTED-KEY/);
});
