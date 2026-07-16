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
 *     --screens <path/to/screens.json>
 *
 * screens.json shape:
 *   [
 *     { "name": "dashboard",     "path": "/"                                        },
 *     { "name": "budget-detail", "path": "/finance/jobs/job-001",  "waitFor": "text=Committed" }
 *   ]
 *
 * Output: docs/pr-reviews/pr-{n}-smoke/{name}.png (one file per entry, in input order).
 *
 * Exit codes:
 *   0  every screen captured
 *   1  bad arguments / screens file
 *   2  login failed
 *   3  capture failed on any screen (the rest are still attempted, but exit non-zero)
 */

import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const ADMIN_EMAIL = "admin@projectops.local";
const ADMIN_PASSWORD = "Password123!";

function parseArgs(argv) {
  const out = { base: "http://localhost:5174" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pr") out.pr = argv[++i];
    else if (a === "--base") out.base = argv[++i];
    else if (a === "--screens") out.screens = argv[++i];
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
    "Usage: node scripts/pipeline/visual-smoke.mjs --pr <n> [--base <url>] --screens <file>"
  );
}

async function loginAsAdmin(page, baseUrl) {
  await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByPlaceholder("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "Operations Overview" })
    .waitFor({ state: "visible", timeout: 30_000 });
}

async function captureOne(page, baseUrl, entry, outDir) {
  const url = new URL(entry.path, baseUrl).toString();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  if (entry.waitFor) {
    await page.waitForSelector(entry.waitFor, { timeout: 15_000 });
  }
  const outPath = join(outDir, `${entry.name}.png`);
  await page.screenshot({ path: outPath, fullPage: true });
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

  const outDir = join(REPO_ROOT, "docs", "pr-reviews", `pr-${args.pr}-smoke`);
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
  const failed = [];
  for (const entry of screens) {
    try {
      const p = await captureOne(page, args.base, entry, outDir);
      written.push(p);
      console.log(`captured ${entry.name} -> ${p}`);
    } catch (err) {
      failed.push({ name: entry.name, error: err.message });
      console.error(`FAILED ${entry.name}: ${err.message}`);
    }
  }

  await browser.close();

  console.log(`\nvisual-smoke: wrote ${written.length}/${screens.length} screen(s) to ${outDir}`);
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
