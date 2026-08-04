/**
 * metadata.service.spec.ts
 *
 * Unit tests for MetadataService.resolveCatalogPath() / getCatalog().
 * Covers the three-source resolution order introduced in SLICE 2 of
 * docs/plans/smart-wizard-catalog-deploy-plan.md.
 *
 * Strategy:
 *   - jest.mock("node:fs") so existsSync and readFileSync are fully under our
 *     control. All file I/O inside the service goes through the mock.
 *   - jest.mock("node:child_process") to prevent actual generator invocations.
 *   - We set up per-test implementations in beforeEach / per-case mockImpl.
 */

// Must be hoisted above imports.
jest.mock("node:fs");
jest.mock("node:child_process", () => ({
  spawnSync: jest.fn(() => ({ status: 0, signal: null })),
}));

import * as fs from "node:fs";
import * as path from "node:path";
import { ServiceUnavailableException } from "@nestjs/common";
import { spawnSync } from "node:child_process";

const mockExistsSync = fs.existsSync as jest.Mock;
const mockReadFileSync = fs.readFileSync as jest.Mock;
const mockSpawnSync = spawnSync as jest.Mock;

import { MetadataService } from "../../../src/modules/metadata/metadata.service";

// ------ Path constants -------------------------------------------------------
// ts-jest sets __dirname on *this* spec to the spec file's source directory.
// The service's __dirname (when imported) is the service's source directory.
// We compute BUNDLE_PATH the same way the service does:
//   path.join(<service __dirname>, "assets", "metadata-catalog.json")
const SERVICE_DIRNAME = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "src",
  "modules",
  "metadata"
);
const BUNDLE_PATH = path.join(SERVICE_DIRNAME, "assets", "metadata-catalog.json");

// The generator marker file the walker looks for (relative to a candidate root).
const GENERATOR_BASENAME = path.join(
  "scripts",
  "data-model",
  "build-relationship-map.mjs"
);

const CATALOG_JSON = JSON.stringify({ models: ["Foo"], version: "test" });
const ENV_JSON     = JSON.stringify({ models: ["EnvModel"], version: "env" });

// A path that clearly does not exist on any real filesystem.
const FAKE_ENV_PATH      = "/fake/env/catalog.json";
const FAKE_MISSING_PATH  = "/fake/missing/catalog.json";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function buildFakeRepoRootPath(): string {
  // Walk the same ancestor chain the service's findRepoRoot() will walk,
  // starting from SERVICE_DIRNAME.  Pick the first ancestor one step up.
  const parent = path.dirname(SERVICE_DIRNAME);
  return parent; // e.g. src/modules — far enough from the real repo root
}

describe("MetadataService — SLICE-2 resolver order", () => {
  let savedEnv: string | undefined;

  beforeEach(() => {
    savedEnv = process.env.METADATA_CATALOG_PATH;
    delete process.env.METADATA_CATALOG_PATH;
    jest.clearAllMocks();
    // Default: nothing exists and nothing is readable.
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockImplementation(() => {
      throw new Error("readFileSync: not mocked for this path");
    });
  });

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env.METADATA_CATALOG_PATH;
    } else {
      process.env.METADATA_CATALOG_PATH = savedEnv;
    }
  });

  // -------------------------------------------------------------------------
  // Case 1: production-shape proof — bundled asset wins, no env, no repo root.
  // This MUST fail on origin/main (walker-only) and MUST pass after SLICE 2.
  // It is the CI proof-point for the entire plan.
  // -------------------------------------------------------------------------
  it("case 1 (production-shape): bundled asset wins with no env and no repo root", () => {
    // Only the bundle path exists.
    mockExistsSync.mockImplementation((p: string) => p === BUNDLE_PATH);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === BUNDLE_PATH) return CATALOG_JSON;
      throw new Error(`unexpected readFileSync: ${p}`);
    });

    const service = new MetadataService();
    const result = service.getCatalog() as { models: string[]; version: string };

    expect(result).toEqual({ models: ["Foo"], version: "test" });
    // Generator must NOT have been invoked (walker branch not reached).
    expect(mockSpawnSync).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Case 2: METADATA_CATALOG_PATH set to an existing file wins over bundle.
  // -------------------------------------------------------------------------
  it("case 2: env override wins over bundle when env file exists", () => {
    process.env.METADATA_CATALOG_PATH = FAKE_ENV_PATH;

    // Env file exists; bundle absent.
    mockExistsSync.mockImplementation((p: string) => p === FAKE_ENV_PATH);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === FAKE_ENV_PATH) return ENV_JSON;
      throw new Error(`unexpected readFileSync: ${p}`);
    });

    const service = new MetadataService();
    const result = service.getCatalog() as { models: string[]; version: string };

    expect(result.models).toContain("EnvModel");
    expect(result.version).toBe("env");

    // Bundle must NOT have been read.
    const bundleRead = mockReadFileSync.mock.calls.some(
      (call: unknown[]) => String(call[0]) === BUNDLE_PATH
    );
    expect(bundleRead).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Case 3: METADATA_CATALOG_PATH set but file missing → falls through to bundle.
  // -------------------------------------------------------------------------
  it("case 3: missing env file falls through to bundle", () => {
    process.env.METADATA_CATALOG_PATH = FAKE_MISSING_PATH;

    // Env path does NOT exist; bundle exists.
    mockExistsSync.mockImplementation((p: string) => {
      if (p === FAKE_MISSING_PATH) return false;
      if (p === BUNDLE_PATH)       return true;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === BUNDLE_PATH) return CATALOG_JSON;
      throw new Error(`unexpected readFileSync: ${p}`);
    });

    const service = new MetadataService();
    const result = service.getCatalog() as { models: string[]; version: string };

    expect(result).toEqual({ models: ["Foo"], version: "test" });
  });

  // -------------------------------------------------------------------------
  // Case 4: no env, no bundle, no walker → new enumerating 503.
  // -------------------------------------------------------------------------
  it("case 4: all sources missing → 503 message mentioning all three sources", () => {
    // existsSync always false — nothing exists at all.
    mockExistsSync.mockReturnValue(false);

    const service = new MetadataService();

    let caught: Error | undefined;
    try {
      service.getCatalog();
    } catch (err) {
      caught = err as Error;
    }

    expect(caught).toBeDefined();
    expect(caught).toBeInstanceOf(ServiceUnavailableException);

    // Extract the string message regardless of NestJS response envelope.
    const exc = caught as ServiceUnavailableException;
    const response = exc.getResponse();
    const msg =
      typeof response === "string"
        ? response
        : (response as { message: string }).message;

    // The message must mention all three sources.
    expect(msg).toMatch(/METADATA_CATALOG_PATH/);
    expect(msg).toMatch(/bundle/i);
    expect(msg).toMatch(/walker/i);
  });

  // -------------------------------------------------------------------------
  // Case 5: dev walker branch fires tryGenerate() when repo root is reachable.
  // -------------------------------------------------------------------------
  it("case 5: walker branch fires tryGenerate() when repo root is found", () => {
    const fakeRepoRoot = buildFakeRepoRootPath();
    const fakeGeneratorPath = path.join(fakeRepoRoot, GENERATOR_BASENAME);
    const fakeCatalogPath = path.join(
      fakeRepoRoot,
      "docs",
      "data-model",
      "metadata-catalog.json"
    );

    // Env not set, bundle absent.
    // Generator marker at fakeRepoRoot → walker hits.
    // Catalog appears only after spawnSync has been called (simulates tryGenerate).
    mockExistsSync.mockImplementation((p: string) => {
      if (p === BUNDLE_PATH)         return false;
      if (p === fakeGeneratorPath)   return true;
      if (p === fakeCatalogPath)     return mockSpawnSync.mock.calls.length > 0;
      return false;
    });
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === fakeCatalogPath) return CATALOG_JSON;
      throw new Error(`unexpected readFileSync: ${p}`);
    });

    const service = new MetadataService();
    const result = service.getCatalog() as { models: string[]; version: string };

    // tryGenerate() must have been called once with the correct script path.
    expect(mockSpawnSync).toHaveBeenCalledTimes(1);
    expect(mockSpawnSync).toHaveBeenCalledWith(
      process.execPath,
      [fakeGeneratorPath],
      expect.objectContaining({ cwd: fakeRepoRoot })
    );
    expect(result).toEqual({ models: ["Foo"], version: "test" });
  });
});
