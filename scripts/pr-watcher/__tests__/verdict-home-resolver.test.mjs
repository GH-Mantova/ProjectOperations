// Unit tests for VERDICT_HOME_RESOLVER_V1 — resolveVerdictPath searches all
// three verdict homes (clone, archive, dev tree) and returns the newest hit.
//
// Measured causes addressed:
//   (a) WRONG TREE: 9 of 12 verdicts on 2026-09-05 landed in the dev tree, not
//       the clone — the old single-path reader silently missed every one.
//   (b) ARCHIVE RACE: 1 of 12 was swept to verdicts-archive 16 s before the
//       mirror ran — the old reader declared "not found" and filed the job [ok].
//
// All tests use isolated temp directories; no real tree is read or written.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { resolveVerdictPath, verdictApproves } from "../index.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a self-contained sandbox with all three homes as temp dirs. */
async function makeSandbox() {
  const base = await mkdtemp(path.join(tmpdir(), "vhr-test-"));
  // Home A: clone (repoRoot)
  const cloneRoot = path.join(base, "clone");
  const cloneReviewsDir = path.join(cloneRoot, "docs", "pr-reviews");
  // Home B: archive (sibling of cloneRoot, or injected directly)
  const archiveDir = path.join(base, "verdicts-archive");
  // Home C: dev tree (injected as devTree)
  const devTree = path.join(base, "dev");
  const devReviewsDir = path.join(devTree, "docs", "pr-reviews");

  await mkdir(cloneReviewsDir, { recursive: true });
  await mkdir(archiveDir, { recursive: true });
  await mkdir(devReviewsDir, { recursive: true });

  return { base, cloneRoot, cloneReviewsDir, archiveDir, devTree, devReviewsDir };
}

/** Write a verdict file and optionally force its mtime to a specific epoch ms. */
async function writeVerdict(filePath, content, mtimeMs) {
  await writeFile(filePath, content, "utf-8");
  if (mtimeMs != null) {
    const t = new Date(mtimeMs);
    await utimes(filePath, t, t);
  }
}

/** Options shorthand — inject all three homes so REPO_ROOT and env are never touched. */
function opts(sandbox) {
  return {
    repoRoot: sandbox.cloneRoot,
    archiveDir: sandbox.archiveDir,
    devTree: sandbox.devTree,
  };
}

// ---------------------------------------------------------------------------
// Test 1: file in clone only -> resolves to the clone path (regression guard)
// ---------------------------------------------------------------------------
test("resolves to clone path when file is only in the clone", async () => {
  const sb = await makeSandbox();
  const filename = "pr-101-review.md";
  const clonePath = path.join(sb.cloneReviewsDir, filename);
  await writeVerdict(clonePath, "VERDICT: MERGE\n\nLooks good.", null);

  const result = await resolveVerdictPath(101, opts(sb));
  assert.ok(result !== null, "expected a hit, got null");
  assert.equal(result.path, clonePath, "should resolve to clone path");
});

// ---------------------------------------------------------------------------
// Test 2: file in dev tree only -> resolves (cause (a), currently a MISS)
// ---------------------------------------------------------------------------
test("resolves to dev-tree path when file is only in the dev tree", async () => {
  const sb = await makeSandbox();
  const filename = "pr-202-review.md";
  const devPath = path.join(sb.devReviewsDir, filename);
  await writeVerdict(devPath, "VERDICT: MERGE\n\nDev tree verdict.", null);

  const result = await resolveVerdictPath(202, opts(sb));
  assert.ok(result !== null, "expected a hit, got null");
  assert.equal(result.path, devPath, "should resolve to dev-tree path");
});

// ---------------------------------------------------------------------------
// Test 3: file in archive only -> resolves (cause (b), currently a MISS)
// ---------------------------------------------------------------------------
test("resolves to archive path when file is only in the archive", async () => {
  const sb = await makeSandbox();
  const filename = "pr-303-review.md";
  const archivePath = path.join(sb.archiveDir, filename);
  await writeVerdict(archivePath, "VERDICT: MERGE\n\nArchive verdict.", null);

  const result = await resolveVerdictPath(303, opts(sb));
  assert.ok(result !== null, "expected a hit, got null");
  assert.equal(result.path, archivePath, "should resolve to archive path");
});

// ---------------------------------------------------------------------------
// Test 4a: two homes present, archive newer -> picks archive
// ---------------------------------------------------------------------------
test("picks the newest file when clone and archive both have it (archive newer)", async () => {
  const sb = await makeSandbox();
  const filename = "pr-404-review.md";
  const clonePath = path.join(sb.cloneReviewsDir, filename);
  const archivePath = path.join(sb.archiveDir, filename);

  const olderMs = Date.now() - 60_000;
  const newerMs = Date.now() - 5_000;

  await writeVerdict(clonePath, "VERDICT: MERGE\n\nClone copy.", olderMs);
  await writeVerdict(archivePath, "VERDICT: MERGE\n\nArchive copy (newer).", newerMs);

  const result = await resolveVerdictPath(404, opts(sb));
  assert.ok(result !== null, "expected a hit, got null");
  assert.equal(result.path, archivePath, "should pick archive (newer mtime)");
});

// ---------------------------------------------------------------------------
// Test 4b: two homes present, clone newer -> picks clone (both orderings covered)
// ---------------------------------------------------------------------------
test("picks the newest file when clone and archive both have it (clone newer)", async () => {
  const sb = await makeSandbox();
  const filename = "pr-405-review.md";
  const clonePath = path.join(sb.cloneReviewsDir, filename);
  const archivePath = path.join(sb.archiveDir, filename);

  const olderMs = Date.now() - 60_000;
  const newerMs = Date.now() - 5_000;

  await writeVerdict(archivePath, "VERDICT: MERGE\n\nArchive copy.", olderMs);
  await writeVerdict(clonePath, "VERDICT: MERGE\n\nClone copy (newer).", newerMs);

  const result = await resolveVerdictPath(405, opts(sb));
  assert.ok(result !== null, "expected a hit, got null");
  assert.equal(result.path, clonePath, "should pick clone (newer mtime)");
});

// ---------------------------------------------------------------------------
// Test 5: file in no home -> path is null, searched list names all three paths
// ---------------------------------------------------------------------------
test("returns null path and lists all three searched paths when file is missing", async () => {
  const sb = await makeSandbox();
  // No verdict file written anywhere.

  const result = await resolveVerdictPath(505, opts(sb));

  // path must be null (or falsy) when no home has the file
  assert.ok(!result.path, "expected path to be null/falsy when file is missing");

  // The searched list must name all three homes
  const { searched } = result;
  assert.ok(Array.isArray(searched) && searched.length === 3, "searched must list exactly 3 paths");
  assert.ok(
    searched.some((p) => p.includes("clone") || p.includes(sb.cloneRoot)),
    "searched must include the clone home",
  );
  assert.ok(
    searched.some((p) => p.includes("verdicts-archive") || p.includes(sb.archiveDir)),
    "searched must include the archive home",
  );
  assert.ok(
    searched.some((p) => p.includes("dev") || p.includes(sb.devTree)),
    "searched must include the dev-tree home",
  );
});

// ---------------------------------------------------------------------------
// Test 6: verdictApproves returns true for MERGE verdict that exists only
//         in the archive (cause (b) — the auto-merge gate was broken too)
// ---------------------------------------------------------------------------
test("verdictApproves returns true when MERGE verdict exists only in archive", async () => {
  const sb = await makeSandbox();
  const filename = "pr-606-review.md";
  const archivePath = path.join(sb.archiveDir, filename);
  await writeVerdict(
    archivePath,
    "VERDICT: MERGE\n\nAll checks pass. No issues found.",
    null,
  );

  const approved = await verdictApproves(606, null, opts(sb));
  assert.equal(approved, true, "verdictApproves must return true for MERGE verdict in archive");
});

// ---------------------------------------------------------------------------
// Test 6b: verdictApproves returns false when verdict does not say MERGE
// ---------------------------------------------------------------------------
test("verdictApproves returns false when verdict says FIX (in archive)", async () => {
  const sb = await makeSandbox();
  const filename = "pr-607-review.md";
  const archivePath = path.join(sb.archiveDir, filename);
  await writeVerdict(archivePath, "VERDICT: FIX\n\nNeeds work.", null);

  const approved = await verdictApproves(607, null, opts(sb));
  assert.equal(approved, false, "verdictApproves must return false when verdict is FIX");
});
