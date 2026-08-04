import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// The Smart Wizard reads model/field metadata at RUNTIME (no compile-time
// snapshot, no code generation). This service resolves the catalog via a
// three-source ordered lookup (see resolveCatalogPath), reads the file fresh
// on each request, and — if only the dev-walker branch is reachable — invokes
// the same generator script the docs pipeline uses so a fresh checkout produces
// a usable catalog without a manual step.
//
// Cost is a single small JSON read (~100–500 KB) per hit, no in-memory cache,
// so adding a model to the catalog surfaces in the wizard on the very next
// request with no restart.
//
// Resolution order (see §3 of docs/plans/smart-wizard-catalog-deploy-plan.md):
//   1. METADATA_CATALOG_PATH env var — if set AND the file exists.
//   2. Build-bundled copy at <__dirname>/assets/metadata-catalog.json — present
//      in the deployed App Service artifact after nest build.
//   3. Repo-root walk (dev fallback) — existing walker + tryGenerate() path,
//      unchanged in behaviour.

const CATALOG_REL_PATH = path.join("docs", "data-model", "metadata-catalog.json");
const GENERATOR_REL_PATH = path.join("scripts", "data-model", "build-relationship-map.mjs");

function findRepoRoot(): string | null {
  // __dirname is src/modules/metadata in dev, dist/src/modules/metadata in
  // build — walk upward until we find package.json + a scripts/data-model
  // sibling, which pins us to the actual monorepo root (not apps/api).
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const generator = path.join(dir, GENERATOR_REL_PATH);
    if (fs.existsSync(generator)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

@Injectable()
export class MetadataService {
  private readonly logger = new Logger(MetadataService.name);

  constructor() {
    // No work in the constructor — resolution is lazy per-request so that
    // tests can stage files before calling getCatalog().
  }

  /**
   * Resolve the catalog path using the three-source ordered lookup.
   * Returns the winning absolute path, or null if all sources were exhausted.
   * The outcome object also carries human-readable diagnostics for each
   * source so the terminal 503 can enumerate what was tried.
   */
  resolveCatalogPath(): { filePath: string | null; diagnostics: string[] } {
    const diagnostics: string[] = [];

    // Source 1: METADATA_CATALOG_PATH env override.
    const envPath = process.env.METADATA_CATALOG_PATH;
    if (envPath) {
      if (fs.existsSync(envPath)) {
        return { filePath: envPath, diagnostics };
      }
      diagnostics.push(`env METADATA_CATALOG_PATH set but file not found at: ${envPath}`);
    } else {
      diagnostics.push("env METADATA_CATALOG_PATH not set");
    }

    // Source 2: Build-bundled copy relative to __dirname.
    // In the compiled artifact __dirname === dist/src/modules/metadata so this
    // resolves to dist/src/modules/metadata/assets/metadata-catalog.json.
    const bundledPath = path.join(__dirname, "assets", "metadata-catalog.json");
    if (fs.existsSync(bundledPath)) {
      return { filePath: bundledPath, diagnostics };
    }
    diagnostics.push(`bundle not found at: ${bundledPath}`);

    // Source 3: Repo-root walk (dev fallback).
    const repoRoot = findRepoRoot();
    if (repoRoot) {
      const walkerPath = path.join(repoRoot, CATALOG_REL_PATH);
      if (!fs.existsSync(walkerPath)) {
        this.tryGenerate(repoRoot);
      }
      if (fs.existsSync(walkerPath)) {
        return { filePath: walkerPath, diagnostics };
      }
      diagnostics.push(`walker found repo root at ${repoRoot} but catalog still absent after tryGenerate()`);
    } else {
      diagnostics.push("walker: repo root not found (no scripts/data-model/build-relationship-map.mjs in any ancestor)");
    }

    return { filePath: null, diagnostics };
  }

  getCatalog(): unknown {
    const { filePath, diagnostics } = this.resolveCatalogPath();

    if (!filePath) {
      const detail = diagnostics.join("; ");
      throw new ServiceUnavailableException(
        `Metadata catalog unavailable. Sources tried: ${detail}`
      );
    }

    try {
      const raw = fs.readFileSync(filePath, "utf8");
      return JSON.parse(raw);
    } catch (err) {
      this.logger.error(`Metadata catalog: failed to parse ${filePath}: ${(err as Error).message}`);
      throw new ServiceUnavailableException("Metadata catalog is present but not valid JSON.");
    }
  }

  private tryGenerate(repoRoot: string): void {
    const script = path.join(repoRoot, GENERATOR_REL_PATH);
    try {
      const result = spawnSync(process.execPath, [script], {
        cwd: repoRoot,
        stdio: "ignore",
        timeout: 20_000
      });
      if (result.status !== 0) {
        this.logger.warn(
          `Metadata catalog: generator exited with status ${result.status ?? "unknown"} (signal ${result.signal ?? "none"})`
        );
      }
    } catch (err) {
      this.logger.warn(`Metadata catalog: generator invocation failed: ${(err as Error).message}`);
    }
  }
}
