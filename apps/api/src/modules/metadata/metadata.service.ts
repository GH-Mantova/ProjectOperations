import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// The Smart Wizard reads model/field metadata at RUNTIME (no compile-time
// snapshot, no code generation). This service locates the repo root, reads
// docs/data-model/metadata-catalog.json fresh on each request, and — if the
// file is missing — invokes the same generator script the docs pipeline uses
// so a fresh checkout produces a usable catalog without a manual step.
//
// Cost is a single small JSON read (~100–500 KB) per hit, no in-memory cache,
// so adding a model to the catalog surfaces in the wizard on the very next
// request with no restart.

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
  private readonly repoRoot: string | null;

  constructor() {
    this.repoRoot = findRepoRoot();
    if (!this.repoRoot) {
      this.logger.warn(
        "Metadata catalog: could not locate repo root; /meta/catalog will 503 until the generator is run manually."
      );
    }
  }

  getCatalog(): unknown {
    if (!this.repoRoot) {
      throw new ServiceUnavailableException(
        "Metadata catalog unavailable: repo root not found from API process."
      );
    }
    const catalogPath = path.join(this.repoRoot, CATALOG_REL_PATH);
    if (!fs.existsSync(catalogPath)) {
      this.tryGenerate();
    }
    if (!fs.existsSync(catalogPath)) {
      throw new ServiceUnavailableException(
        "Metadata catalog unavailable: run `node scripts/data-model/build-relationship-map.mjs` to generate it."
      );
    }
    try {
      const raw = fs.readFileSync(catalogPath, "utf8");
      return JSON.parse(raw);
    } catch (err) {
      this.logger.error(`Metadata catalog: failed to parse ${catalogPath}: ${(err as Error).message}`);
      throw new ServiceUnavailableException("Metadata catalog is present but not valid JSON.");
    }
  }

  private tryGenerate(): void {
    if (!this.repoRoot) return;
    const script = path.join(this.repoRoot, GENERATOR_REL_PATH);
    try {
      const result = spawnSync(process.execPath, [script], {
        cwd: this.repoRoot,
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
