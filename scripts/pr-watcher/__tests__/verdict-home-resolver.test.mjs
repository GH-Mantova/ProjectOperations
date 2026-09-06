// Unit tests for resolveVerdictPath (VERDICT_HOME_RESOLVER_V1) and
// verdictCandidatePaths — the multi-home verdict locator that searches the
// watcher clone, the verdicts-archive sibling, and the dev tree.
//
// All tests use isolated temp directories (never touch real trees).
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { resolveVerdictPath, verdictCandidatePaths } from "../index.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function makeDirs(...dirs) {
  for (const d of dirs) await mkdir(d, { recursive: true });
}

// Build a fake statImpl that returns a stat-like object for known paths and
// throws ENOENT for everything else.
function fakeStatFor(entries) {
  // entries: Array of { p: string, mtimeMs: number }
  const map = new Map(entries.map((e) => [e.p, e.mtimeMs]));
  return async (p) => {
    if (map.has(p)) return { mtimeMs: map.get(p) };
    const err = Object.assign(new Error(`ENOENT: no such file or directory, stat '${p}'`), { code: "ENOENT" });
    throw err;
  };
}

// Build a stable repoRoot inside a temp sandbox.
async function makeSandbox(label = "vhr") {
  const base = await mkdtemp(path.join(tmpdir(), `${label}-`));
  const repoRoot = path.join(base, "ProjectOperations");
  const archiveDir = path.join(base, "verdicts-archive");
  const devTree = path.join(base, "dev-tree", "docs", "pr-reviews");
  await makeDirs(
    path.join(repoRoot, "docs", "pr-reviews"),
    archiveDir,
    devTree,
  );
  return { base, repoRoot, archiveDir, devTree };
}

// ---------------------------------------------------------------------------
// Test 1: file in the clone only -> resolves to clone path
// ---------------------------------------------------------------------------
test("resolves to clone path when file is only in the clone", async () => {
  const { repoRoot, archiveDir, devTree } = await makeSandbox();
  const clonePath = path.join(repoRoot, "docs", "pr-reviews", "pr-42-review.md");
  await writeFile(clonePath, "VERDICT: MERGE\n", "utf-8");

  const result = await resolveVerdictPath(42, { repoRoot, devTree });
  assert.equal(result, clonePath);
});

// ---------------------------------------------------------------------------
// Test 2: file in the dev tree only -> resolves
// ---------------------------------------------------------------------------
test("resolves to dev-tree path when file is only in the dev tree", async () => {
  const { repoRoot, devTree } = await makeSandbox();
  const devPath = path.join(devTree, "pr-99-review.md");
  await writeFile(devPath, "VERDICT: FIX\n", "utf-8");

  const result = await resolveVerdictPath(99, { repoRoot, devTree });
  assert.equal(result, devPath);
});

// ---------------------------------------------------------------------------
// Test 3: file in the archive only -> resolves
// ---------------------------------------------------------------------------
test("resolves to archive path when file is only in the archive", async () => {
  const { repoRoot, archiveDir, devTree } = await makeSandbox();
  const archivePath = path.join(archiveDir, "pr-7-review.md");
  await writeFile(archivePath, "VERDICT: MERGE\n", "utf-8");

  // Archive dir is derived from path.dirname(repoRoot) + "verdicts-archive"
  // so repoRoot's parent must be the base that contains archiveDir
  const result = await resolveVerdictPath(7, { repoRoot, devTree });
  assert.equal(result, archivePath);
});

// ---------------------------------------------------------------------------
// Test 4a: file in two homes with different mtimes -> resolves to NEWEST
//          (archive newer than clone)
// ---------------------------------------------------------------------------
test("resolves to newest file when two homes match (archive newer)", async () => {
  // Use real temp dirs so path.join in the resolver and in the stat map agree.
  const { repoRoot, archiveDir, devTree } = await makeSandbox("vhr-4a");
  const clonePath = path.join(repoRoot, "docs", "pr-reviews", "pr-1-review.md");
  const archivePath = path.join(archiveDir, "pr-1-review.md");

  const statImpl = fakeStatFor([
    { p: clonePath, mtimeMs: 1000 },
    { p: archivePath, mtimeMs: 2000 }, // newer
  ]);

  const result = await resolveVerdictPath(1, { repoRoot, devTree, statImpl });
  assert.equal(result, archivePath);
});

// ---------------------------------------------------------------------------
// Test 4b: file in two homes with different mtimes -> resolves to NEWEST
//          (clone newer than archive)
// ---------------------------------------------------------------------------
test("resolves to newest file when two homes match (clone newer)", async () => {
  const { repoRoot, archiveDir, devTree } = await makeSandbox("vhr-4b");
  const clonePath = path.join(repoRoot, "docs", "pr-reviews", "pr-2-review.md");
  const archivePath = path.join(archiveDir, "pr-2-review.md");

  const statImpl = fakeStatFor([
    { p: clonePath, mtimeMs: 5000 }, // newer
    { p: archivePath, mtimeMs: 3000 },
  ]);

  const result = await resolveVerdictPath(2, { repoRoot, devTree, statImpl });
  assert.equal(result, clonePath);
});

// ---------------------------------------------------------------------------
// Test 5: file in no home -> returns null; verdictCandidatePaths names all three
// ---------------------------------------------------------------------------
test("returns null when no home has the file", async () => {
  const { repoRoot, devTree } = await makeSandbox("vhr-5");
  const statImpl = fakeStatFor([]); // nothing exists

  const result = await resolveVerdictPath(123, { repoRoot, devTree, statImpl });
  assert.equal(result, null);

  // The candidate list must name all three paths so the caller can log them.
  const candidates = verdictCandidatePaths(123, { repoRoot, devTree });
  assert.equal(candidates.length, 3);
  // Clone path contains pr-reviews and the filename
  assert.ok(
    candidates[0].includes("pr-reviews") && candidates[0].endsWith("pr-123-review.md"),
    `clone candidate should contain pr-reviews/pr-123-review.md, got: ${candidates[0]}`,
  );
  // Archive path contains verdicts-archive and the filename
  assert.ok(
    candidates[1].includes("verdicts-archive") && candidates[1].endsWith("pr-123-review.md"),
    `archive candidate should contain verdicts-archive/pr-123-review.md, got: ${candidates[1]}`,
  );
  // Dev tree path contains the filename
  assert.ok(
    candidates[2].endsWith("pr-123-review.md"),
    `dev candidate should end with pr-123-review.md, got: ${candidates[2]}`,
  );
});

// ---------------------------------------------------------------------------
// Test 6: resolveVerdictPath returns the archive path when only the archive
//         has the file (validates that verdictApproves would see it via resolver)
// ---------------------------------------------------------------------------
test("resolves archive path for a MERGE verdict that exists only in the archive", async () => {
  const { repoRoot, archiveDir, devTree } = await makeSandbox("vhr-merge");
  const archivePath = path.join(archiveDir, "pr-200-review.md");
  await writeFile(archivePath, "VERDICT: MERGE\nSome review content.\n", "utf-8");

  // The resolver must find the archive path.
  const resolved = await resolveVerdictPath(200, { repoRoot, devTree });
  assert.equal(resolved, archivePath);

  // The resolved file must contain the MERGE verdict (simulating what
  // verdictApproves does after resolveVerdictPath returns the path).
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(resolved, "utf-8");
  assert.match(content, /^VERDICT:\s*MERGE\b/m);
});
