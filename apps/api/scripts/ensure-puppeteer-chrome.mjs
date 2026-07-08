#!/usr/bin/env node
// Idempotently provision the Chrome build that puppeteer 23.x pins.
//
// Runs as `postinstall` so a fresh `pnpm install` leaves the API able to
// render PDFs without a manual `npx puppeteer browsers install chrome`
// (that omission caused fix/quote-pdf-crash — see /sot/05).
//
// No-ops when:
//   - PUPPETEER_EXECUTABLE_PATH is set (operator-supplied Chrome).
//   - PUPPETEER_SKIP_DOWNLOAD / PUPPETEER_SKIP_CHROMIUM_DOWNLOAD is truthy.
//   - The pinned Chrome build already exists on disk.
//   - The puppeteer package is not resolvable (e.g. non-API workspace install).
//
// Failures are logged as warnings, never thrown — so `pnpm install` does not
// break on a machine that will use PUPPETEER_EXECUTABLE_PATH at runtime.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

function truthy(v) {
  if (!v) return false;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "yes";
}

if (process.env.PUPPETEER_EXECUTABLE_PATH) {
  console.log(
    "[ensure-puppeteer-chrome] PUPPETEER_EXECUTABLE_PATH set — skipping install.",
  );
  process.exit(0);
}

if (
  truthy(process.env.PUPPETEER_SKIP_DOWNLOAD) ||
  truthy(process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD)
) {
  console.log(
    "[ensure-puppeteer-chrome] PUPPETEER_SKIP_DOWNLOAD set — skipping install.",
  );
  process.exit(0);
}

let puppeteer;
try {
  puppeteer = await import("puppeteer");
} catch (err) {
  console.warn(
    "[ensure-puppeteer-chrome] puppeteer not resolvable — skipping install.",
    err?.message ?? err,
  );
  process.exit(0);
}

try {
  const resolved = puppeteer.executablePath();
  if (resolved && existsSync(resolved)) {
    console.log(
      `[ensure-puppeteer-chrome] Chrome already present at ${resolved}.`,
    );
    process.exit(0);
  }
} catch {
  // executablePath() throws when no browser is installed yet — expected on a
  // first install; fall through to the install step below.
}

console.log(
  "[ensure-puppeteer-chrome] Installing Chrome for puppeteer (one-time)…",
);
const result = spawnSync(
  process.execPath,
  ["node_modules/puppeteer/lib/esm/puppeteer/node/cli.js", "browsers", "install", "chrome"],
  { stdio: "inherit", cwd: process.cwd() },
);

if (result.status === 0) {
  process.exit(0);
}

// Fall back to `npx puppeteer browsers install chrome` when the direct CLI
// invocation is not available in this puppeteer version.
const fallback = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["puppeteer", "browsers", "install", "chrome"],
  { stdio: "inherit", cwd: process.cwd(), shell: false },
);

if (fallback.status !== 0) {
  console.warn(
    "[ensure-puppeteer-chrome] Failed to install Chrome — PDF rendering will fail until this is resolved. Set PUPPETEER_EXECUTABLE_PATH or run `npx puppeteer browsers install chrome` manually.",
  );
}

// Never fail the install step: PDF rendering is not required for every
// consumer of the API package (e.g. CI jobs that only lint).
process.exit(0);
