#!/usr/bin/env node
/**
 * RENDER ARTBOARDS — the second half of the STATION 02 vision review.
 *
 * The first half (visual-smoke.mjs) captures live app screens at 1440x900. This script
 * renders the corresponding designer artboards from the on-repo snapshot so that a
 * headless builder — which cannot open claude.ai — can compare them side-by-side.
 *
 * Design reference: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
 * On-repo snapshot: Claude Design/proposed/crm-visual-parity/  (see README.md there)
 *
 * Usage:
 *   node scripts/pipeline/render-artboards.mjs \
 *     --src "<dir with canvas.json>" \
 *     --out <dir> \
 *     [--compare <smoke-dir> --screens <screens.json>]
 *
 * --src   Directory containing canvas.json and the *.dc.html artboard files.
 * --out   Directory to write the rendered artboard PNGs into. Created if absent.
 * --compare  (optional) A smoke-output directory produced by visual-smoke.mjs.
 *            Requires --screens. For every screen entry whose artboard matches a
 *            rendered board, compose a side-by-side <name>.compare.png in <smoke-dir>.
 * --screens  (optional) Path to a screens.json whose entries carry an "artboard" key.
 *
 * Compose layout:
 *   Both images scaled to 1440px wide (aspect preserved). A 24px label strip above
 *   each panel: "app · <name>" on the left, "artboard · <title>" on the right.
 *   Page background #F6F6F6. App capture capped at (artboard-height + 300px).
 *   Composition is done with a Playwright page using two <img> data-URI tags —
 *   no pngjs / pixelmatch / sharp required.
 *
 * Exit codes:
 *   0  all artboards rendered (compare step is advisory — missing captures just log)
 *   1  bad arguments or missing canvas.json
 *   3  any artboard failed to render
 */

import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--src") out.src = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--compare") out.compare = argv[++i];
    else if (a === "--screens") out.screens = argv[++i];
    else if (a === "--help" || a === "-h") out.help = true;
    else {
      console.error(`render-artboards: unknown arg: ${a}`);
      return null;
    }
  }
  return out;
}

function usage() {
  console.log(
    'Usage: node scripts/pipeline/render-artboards.mjs --src "<dir with canvas.json>" --out <dir>\n' +
    "       [--compare <smoke-dir> --screens <screens.json>]"
  );
}

/**
 * Render a single artboard HTML file to a PNG at the artboard's own viewport size.
 * Route interception blocks external requests (Google Fonts, missing support.js, etc.)
 * so the run never hangs waiting for network.
 */
async function renderArtboard(browser, srcDir, artboard, outDir) {
  const { file, w, h, title } = artboard;
  const htmlPath = resolve(srcDir, file);
  if (!existsSync(htmlPath)) {
    throw new Error(`artboard file not found: ${htmlPath}`);
  }
  const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");
  const boardName = basename(file, ".dc.html");
  const outPath = join(outDir, `${boardName}.png`);

  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: w, height: h });

    // Block all non-file:// requests so missing CDN assets don't hang the run.
    await page.route("**/*", (route) => {
      if (route.request().url().startsWith("file://")) {
        route.continue();
      } else {
        route.abort();
      }
    });

    await page.goto(fileUrl, { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`render-artboards: rendered ${boardName} (${w}x${h}) -> ${outPath}`);
    return { boardName, title, outPath, w, h };
  } finally {
    await page.close();
  }
}

/**
 * Compose a side-by-side compare image: app capture (left) | artboard (right).
 * Both scaled to 1440px wide. Label strip 24px above each panel. Background #F6F6F6.
 * App capture capped at artboard height + 300px.
 * Uses a Playwright page with data-URI <img> tags — no extra deps.
 */
async function composeSideBySide(browser, { appPngPath, artboardPngPath, appLabel, artboardLabel, artboardH, outPath }) {
  const appData = readFileSync(appPngPath).toString("base64");
  const artboardData = readFileSync(artboardPngPath).toString("base64");
  const capH = artboardH + 300;
  const labelH = 24;
  const gap = 16;
  const panelW = 1440;
  const totalW = panelW * 2 + gap * 3;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #F6F6F6; font-family: system-ui, sans-serif; font-size: 13px; color: #333; }
  .canvas { display: flex; gap: ${gap}px; padding: ${gap}px; }
  .panel { width: ${panelW}px; flex-shrink: 0; }
  .label { height: ${labelH}px; line-height: ${labelH}px; padding: 0 6px; background: #E8E8E8; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .img-wrap { width: ${panelW}px; overflow: hidden; }
  .img-wrap img { width: ${panelW}px; height: auto; display: block; max-height: ${capH}px; object-fit: cover; object-position: top; }
</style>
</head>
<body>
<div class="canvas">
  <div class="panel">
    <div class="label">app &middot; ${appLabel}</div>
    <div class="img-wrap"><img src="data:image/png;base64,${appData}"></div>
  </div>
  <div class="panel">
    <div class="label">artboard &middot; ${artboardLabel}</div>
    <div class="img-wrap"><img src="data:image/png;base64,${artboardData}"></div>
  </div>
</div>
</body>
</html>`;

  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: totalW, height: artboardH + labelH + gap * 2 });
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`render-artboards: compare -> ${outPath}`);
  } finally {
    await page.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args) return 1;
  if (args.help) {
    usage();
    return 0;
  }
  if (!args.src || !args.out) {
    console.error("render-artboards: --src and --out are required");
    usage();
    return 1;
  }
  if ((args.compare && !args.screens) || (!args.compare && args.screens)) {
    console.error("render-artboards: --compare and --screens must be used together");
    return 1;
  }

  const srcDir = resolve(args.src);
  const canvasPath = join(srcDir, "canvas.json");
  if (!existsSync(canvasPath)) {
    console.error(`render-artboards: canvas.json not found at ${canvasPath}`);
    return 1;
  }

  let canvas;
  try {
    canvas = JSON.parse(readFileSync(canvasPath, "utf8"));
  } catch (err) {
    console.error(`render-artboards: failed to parse canvas.json: ${err.message}`);
    return 1;
  }
  if (!Array.isArray(canvas.artboards) || canvas.artboards.length === 0) {
    console.error("render-artboards: canvas.json must have a non-empty artboards array");
    return 1;
  }

  const outDir = resolve(args.out);
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  const rendered = new Map(); // boardName -> { title, outPath, w, h }
  const failed = [];

  for (const artboard of canvas.artboards) {
    try {
      const result = await renderArtboard(browser, srcDir, artboard, outDir);
      rendered.set(result.boardName, result);
    } catch (err) {
      const boardName = basename(artboard.file || "unknown", ".dc.html");
      failed.push({ boardName, error: err.message });
      console.error(`render-artboards: FAILED ${boardName}: ${err.message}`);
    }
  }

  // Compare step (optional).
  if (args.compare && args.screens) {
    const compareDir = resolve(args.compare);
    const screensPath = resolve(args.screens);
    let screens;
    try {
      screens = JSON.parse(readFileSync(screensPath, "utf8"));
    } catch (err) {
      console.error(`render-artboards: failed to parse screens file: ${err.message}`);
      // Compare failure doesn't change exit code.
      screens = [];
    }

    for (const screen of screens) {
      if (!screen.artboard) continue;
      const board = rendered.get(screen.artboard);
      if (!board) {
        console.log(`render-artboards: artboard ${screen.artboard} not rendered, skipping compare for ${screen.name}`);
        continue;
      }
      const appPng = join(compareDir, `${screen.name}.png`);
      if (!existsSync(appPng)) {
        console.log(`render-artboards: no capture for ${screen.name}, skipped`);
        continue;
      }
      const comparePng = join(compareDir, `${screen.name}.compare.png`);
      try {
        await composeSideBySide(browser, {
          appPngPath: appPng,
          artboardPngPath: board.outPath,
          appLabel: screen.name,
          artboardLabel: board.title,
          artboardH: board.h,
          outPath: comparePng,
        });
      } catch (err) {
        console.error(`render-artboards: compare failed for ${screen.name}: ${err.message}`);
        // Compare failures are advisory — do not affect exit code.
      }
    }
  }

  await browser.close();

  console.log(`\nrender-artboards: rendered ${rendered.size}/${canvas.artboards.length} artboard(s) to ${outDir}`);
  if (failed.length > 0) {
    console.error(`render-artboards: ${failed.length} artboard(s) failed`);
    return 3;
  }
  return 0;
}

main().then(
  (code) => process.exit(code ?? 0),
  (err) => {
    console.error(`render-artboards: unexpected error: ${err.stack || err.message}`);
    process.exit(1);
  }
);
