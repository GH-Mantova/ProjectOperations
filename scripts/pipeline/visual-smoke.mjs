#!/usr/bin/env node
/**
 * VISUAL SMOKE — reusable Playwright capture tool for STATION 02's rule-6 VISION REVIEW.
 *
 * The functional e2e suite proves flows. It does NOT prove appearance — that check was left to
 * the manual "Marco test" and the screenshots the shepherd already writes into
 * docs/pr-reviews/pr-{n}-smoke/ have never been evaluated by anything. This tool is the pure
 * CAPTURE half: it launches headless chromium, logs in once as the seed admin, drives a list of
 * routes, and writes one PNG per screen with a deterministic name. It asserts NOTHING; the
 * vision-capable station agent opens the PNGs and judges them (see 02-board-driver.md rule 6).
 *
 * Usage:
 *   node scripts/pipeline/visual-smoke.mjs \
 *     --pr <n> \
 *     [--base http://localhost:5174] \
 *     [--out <dir>] \
 *     --screens <path/to/screens.json>
 *
 * screens.json shape:
 *   [
 *     { "name": "dashboard",     "path": "/"                                        },
 *     { "name": "budget-detail", "path": "/finance/jobs/job-001",  "waitFor": "text=Committed" },
 *     { "name": "accounts-list", "path": "/crm/accounts",
 *       "actions": [{ "waitFor": "text=Accounts" }]                                 },
 *     { "name": "account-360",   "path": "/crm/accounts",
 *       "actions": [{ "click": "table tbody tr:first-child a" }], "optional": true  }
 *   ]
 *
 * Per-entry optional keys (applied after navigation, before screenshot):
 *   actions?: Array<
 *     | { click: string }              — page.click(selector)
 *     | { fill: { selector: string; value: string } }  — page.fill(selector, value)
 *     | { waitFor: string }            — page.waitForSelector(selector)
 *   >  Run in order.
 *   optional?: boolean  — if any waitFor or action selector isn't found within the timeout,
 *     log "visual-smoke: SKIPPED <name> (optional): <reason>" and skip (no PNG, not counted
 *     as a failure). Legacy "waitFor" at the top level still works unchanged.
 *
 * Output: docs/pr-reviews/pr-{n}-smoke/{name}.png (one file per entry, in input order).
 *   With --out <dir> the PNGs land in <dir> instead. The summary line names the
 *   resolved directory either way.
 *
 * Exit codes:
 *   0  every screen captured
 *   1  bad arguments / screens file
 *   2  login failed
 *   3  capture failed on any screen (the rest are still attempted, but exit non-zero).
 *      An OVERSIZE PNG (> MAX_PNG_BYTES) is deleted and counted as a capture failure.
 */

import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const ADMIN_EMAIL = "admin@projectops.local";
const ADMIN_PASSWORD = "Password123!";

// A full-page screenshot of an unbounded list can be enormous. Cap it, so a single
// runaway render cannot commit a 40 MB PNG into the repo. Cross this and the file is
// deleted and the screen counts as a capture failure (exit 3).
const MAX_PNG_BYTES = 2_000_000;

function parseArgs(argv) {
  const out = { base: "http://localhost:5174" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pr") out.pr = argv[++i];
    else if (a === "--base") out.base = argv[++i];
    else if (a === "--screens") out.screens = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
    else {
      console.error(`visual-smoke: unknown arg: ${a}`);
      return null;
    }
  }
  return out;
}

function usage() {
  console.log(
    "Usage: node scripts/pipeline/visual-smoke.mjs --pr <n> [--base <url>] [--out <dir>] --screens <file>"
  );
}

async function loginAsAdmin(page, baseUrl) {
  await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByPlaceholder("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "Home" })
    .waitFor({ state: "visible", timeout: 30_000 });
}

// Sentinel thrown when an optional screen's selector is not found.
class SkipError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "SkipError";
  }
}

async function captureOne(page, baseUrl, entry, outDir) {
  const url = new URL(entry.path, baseUrl).toString();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });

  // Legacy top-level waitFor still works.
  if (entry.waitFor) {
    try {
      await page.waitForSelector(entry.waitFor, { timeout: 15_000 });
    } catch (err) {
      if (entry.optional) throw new SkipError(`waitFor "${entry.waitFor}": ${err.message}`);
      throw err;
    }
  }

  // entry.actions: array of { click } | { fill } | { waitFor } steps, run in order.
  if (entry.actions) {
    for (const action of entry.actions) {
      try {
        if (action.waitFor !== undefined) {
          await page.waitForSelector(action.waitFor, { timeout: 15_000 });
        } else if (action.click !== undefined) {
          await page.click(action.click, { timeout: 15_000 });
        } else if (action.fill !== undefined) {
          await page.fill(action.fill.selector, action.fill.value);
        }
      } catch (err) {
        if (entry.optional) throw new SkipError(`action ${JSON.stringify(action)}: ${err.message}`);
        throw err;
      }
    }
  }

  const outPath = join(outDir, `${entry.name}.png`);
  await page.screenshot({ path: outPath, fullPage: true });
  const { size } = statSync(outPath);
  if (size > MAX_PNG_BYTES) {
    unlinkSync(outPath);
    console.error(`OVERSIZE ${entry.name}: ${size} > MAX_PNG_BYTES, not kept`);
    throw new Error(`oversize (${size} > ${MAX_PNG_BYTES})`);
  }
  return outPath;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args) return 1;
  if (args.help) {
    usage();
    return 0;
  }
  if (!args.pr || !args.screens) {
    usage();
    return 1;
  }

  const screensPath = resolve(args.screens);
  if (!existsSync(screensPath)) {
    console.error(`visual-smoke: screens file not found: ${screensPath}`);
    return 1;
  }
  let screens;
  try {
    screens = JSON.parse(readFileSync(screensPath, "utf8"));
  } catch (err) {
    console.error(`visual-smoke: failed to parse ${screensPath}: ${err.message}`);
    return 1;
  }
  if (!Array.isArray(screens) || screens.length === 0) {
    console.error("visual-smoke: screens file must be a non-empty JSON array");
    return 1;
  }
  for (const s of screens) {
    if (!s || typeof s.name !== "string" || typeof s.path !== "string") {
      console.error("visual-smoke: every screen needs a string 'name' and 'path'");
      return 1;
    }
  }

  const outDir = args.out
    ? resolve(args.out)
    : join(REPO_ROOT, "docs", "pr-reviews", `pr-${args.pr}-smoke`);
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  let loginOk = false;
  try {
    await loginAsAdmin(page, args.base);
    loginOk = true;
  } catch (err) {
    console.error(`visual-smoke: login failed against ${args.base}: ${err.message}`);
  }
  if (!loginOk) {
    await browser.close();
    return 2;
  }

  const written = [];
  const skipped = [];
  const failed = [];
  for (const entry of screens) {
    try {
      const p = await captureOne(page, args.base, entry, outDir);
      written.push(p);
      console.log(`captured ${entry.name} -> ${p}`);
    } catch (err) {
      if (err.name === "SkipError") {
        skipped.push({ name: entry.name, reason: err.message });
        console.log(`visual-smoke: SKIPPED ${entry.name} (optional): ${err.message}`);
      } else {
        failed.push({ name: entry.name, error: err.message });
        console.error(`FAILED ${entry.name}: ${err.message}`);
      }
    }
  }

  await browser.close();

  const total = screens.length;
  console.log(`\nvisual-smoke: wrote ${written.length}/${total} screen(s) to ${outDir}` +
    (skipped.length > 0 ? ` (${skipped.length} optional skipped)` : ""));
  if (failed.length > 0) {
    console.error(`visual-smoke: ${failed.length} screen(s) failed`);
    return 3;
  }
  return 0;
}

main().then(
  (code) => process.exit(code ?? 0),
  (err) => {
    console.error(`visual-smoke: unexpected error: ${err.stack || err.message}`);
    process.exit(1);
  }
);
