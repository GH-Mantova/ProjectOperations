#!/usr/bin/env node
// Prebuild step: copies docs/data-model/metadata-catalog.json into
// apps/api/src/modules/metadata/assets/ so nest-cli.json can bundle it into
// dist/src/modules/metadata/assets/metadata-catalog.json.
// This file is intentionally dependency-free (uses only Node built-ins).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

const src = resolve(repoRoot, "docs", "data-model", "metadata-catalog.json");
const destDir = resolve(here, "..", "src", "modules", "metadata", "assets");
const dest = resolve(destDir, "metadata-catalog.json");

if (!existsSync(src)) {
  console.error(
    `[copy-metadata-catalog] ERROR: source file not found: ${src}\n` +
    `Run 'pnpm data-model:build' from the repo root to regenerate it.`
  );
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-metadata-catalog] copied metadata-catalog.json -> ${dest}`);
