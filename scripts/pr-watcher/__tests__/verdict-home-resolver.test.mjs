// Tests for resolveVerdictPath (VERDICT_HOME_RESOLVER_V1) and its integration
// with verdictApproves. Each case uses a temp dir — never the real trees.
//
// Measured 2026-09-05: 9 of 12 verdicts landed in the dev tree, 1 was archived
// 16s before the mirror ran — all 12 were filed [ok] despite being invisible to
// the old hardcoded clone path. These tests are the regression guard.
//
// Style: node:test, node:assert/strict, zero external dependencies.
// All FS work uses os.tmpdir() + unique subdirs — never touches real trees.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { resolveVerdictPath, verdictApproves } from "../index.mjs";

// Create an isolated sandbox with three empty dirs that represent the three homes.
//
// resolveVerdictPath({ repoRoot, archiveDir, devTree }) accepts:
//   repoRoot   — the clone root; verdict is at repoRoot/docs/pr-reviews/pr-N-review.md
//   archiveDir — the archive dir directly; verdict is at archiveDir/pr-N-review.md
//   devTree    — the dev-tree reviews dir directly; verdict is at devTree/pr-N-review.md
//
// Returns { cloneReviews, archiveDir, devReviews, opts } where opts can be
// passed directly to resolveVerdictPath / verdictApproves.
async function makeSandbox(tag) {
  const base = await mkdtemp(path.join(tmpdir(), `vhr-${tag}-`));
  // Clone home: repoRoot/docs/pr-reviews/
  const repoRoot = path.join(base, "clone");
  const cloneReviews = path.join(repoRoot, "docs", "pr-reviews");
  // Archive home: an explicit directory (not derived from repoRoot parent)
  const archiveDir = path.join(base, "archive");
  // Dev-tree home: the reviews dir directly (matches production VERDICT_DEV_TREE_DEFAULT
  // which is "C:\ProjectOperations2\docs\pr-reviews" — already the reviews dir)
  const devReviews = path.join(base, "devtree-reviews");

  await mkdir(cloneReviews, { recursive: true });
  await mkdir(archiveDir, { recursive: true });
  await mkdir(devReviews, { recursive: true });

  const opts = {
    repoRoot,
    archiveDir,
    devTree: devReviews,
  };
  return { base, repoRoot, cloneReviews, archiveDir, devReviews, opts };
}

// Write a file and optionally set its mtime to a specific Date.
async function writeVerdict(dir, prNumber, content, mtime) {
  const p = path.join(dir, `pr-${prNumber}-review.md`);
  await writeFile(p, content, "utf-8");
  if (mtime != null) {
    await utimes(p, mtime, mtime);
  }
  return p;
}

// ─── Case 1: file in clone only ──────────────────────────────────────────────
test("case 1 — file in clone only resolves to clone path (regression guard)", async () => {
  const { cloneReviews, opts } = await makeSandbox("c1");
  await writeVerdict(cloneReviews, 100, "VERDICT: MERGE\n");

  const result = await resolveVerdictPath(100, opts);
  assert.ok(result.path != null, "path should not be null");
  assert.equal(result.path, path.join(cloneReviews, "pr-100-review.md"));
  assert.ok(typeof result.mtimeMs === "number", "mtimeMs should be a number");
});

// ─── Case 2: file in dev tree only ───────────────────────────────────────────
test("case 2 — file in dev tree only resolves (cause A: measured 2026-09-05 9/12)", async () => {
  const { devReviews, opts } = await makeSandbox("c2");
  await writeVerdict(devReviews, 200, "VERDICT: MERGE\n");

  const result = await resolveVerdictPath(200, opts);
  assert.ok(result.path != null, "path should not be null");
  assert.equal(result.path, path.join(devReviews, "pr-200-review.md"));
});

// ─── Case 3: file in archive only ────────────────────────────────────────────
test("case 3 — file in archive only resolves (cause B: archived 16s before mirror)", async () => {
  const { archiveDir, opts } = await makeSandbox("c3");
  await writeVerdict(archiveDir, 300, "VERDICT: MERGE\n");

  const result = await resolveVerdictPath(300, opts);
  assert.ok(result.path != null, "path should not be null");
  assert.equal(result.path, path.join(archiveDir, "pr-300-review.md"));
});

// ─── Case 4a: two homes, archive is newer ────────────────────────────────────
test("case 4a — two homes, archive is newer than clone -> resolves to archive", async () => {
  const { cloneReviews, archiveDir, opts } = await makeSandbox("c4a");
  const old = new Date("2026-09-05T22:00:00Z");
  const fresh = new Date("2026-09-05T22:16:00Z"); // 16 min newer
  await writeVerdict(cloneReviews, 400, "VERDICT: MERGE\n", old);
  await writeVerdict(archiveDir, 400, "VERDICT: MERGE\n", fresh);

  const result = await resolveVerdictPath(400, opts);
  assert.ok(result.path != null, "path should not be null");
  assert.equal(result.path, path.join(archiveDir, "pr-400-review.md"),
    "archive is newer — must win");
});

// ─── Case 4b: two homes, clone is newer ──────────────────────────────────────
test("case 4b — two homes, clone is newer than dev tree -> resolves to clone", async () => {
  const { cloneReviews, devReviews, opts } = await makeSandbox("c4b");
  const old = new Date("2026-09-05T22:00:00Z");
  const fresh = new Date("2026-09-05T22:30:00Z");
  await writeVerdict(devReviews, 401, "VERDICT: MERGE\n", old);
  await writeVerdict(cloneReviews, 401, "VERDICT: MERGE\n", fresh);

  const result = await resolveVerdictPath(401, opts);
  assert.ok(result.path != null, "path should not be null");
  assert.equal(result.path, path.join(cloneReviews, "pr-401-review.md"),
    "clone is newer — must win");
});

// ─── Case 5: file in no home -> returns { path: null }, searched names all three ─
test("case 5 — file in no home: path is null and searched names all three paths", async () => {
  const { opts, cloneReviews, archiveDir, devReviews } = await makeSandbox("c5");
  // Write nothing — all homes are empty.

  const result = await resolveVerdictPath(500, opts);
  assert.equal(result.path, null, "path should be null when file is absent from all homes");
  assert.ok(Array.isArray(result.searched), "result.searched must be an array");
  assert.equal(result.searched.length, 3, "searched must contain exactly three paths");

  // Verify that all three candidate paths are present in result.searched, so the
  // log message in mirrorVerdictToPr can name them.
  const expectedClone = path.join(cloneReviews, "pr-500-review.md");
  const expectedArchive = path.join(archiveDir, "pr-500-review.md");
  const expectedDev = path.join(devReviews, "pr-500-review.md");

  assert.ok(
    result.searched.includes(expectedClone),
    `searched must include clone path: ${expectedClone}`,
  );
  assert.ok(
    result.searched.includes(expectedArchive),
    `searched must include archive path: ${expectedArchive}`,
  );
  assert.ok(
    result.searched.includes(expectedDev),
    `searched must include dev tree path: ${expectedDev}`,
  );
});

// ─── Case 6: verdictApproves returns true for MERGE verdict in archive only ──
test("case 6 — verdictApproves returns true for MERGE verdict that exists only in archive", async () => {
  const { archiveDir, opts } = await makeSandbox("c6");
  // Verdict lives only in the archive — the clone and dev tree have no file.
  await writeVerdict(archiveDir, 600, "VERDICT: MERGE\n\nThis PR looks good.\n");

  // verdictApproves must find the verdict via the resolver, read it from the
  // archive, and return true. prFiles=null skips the guard cross-check.
  const approved = await verdictApproves(600, null, opts);
  assert.equal(approved, true,
    "verdictApproves must return true when MERGE verdict is found only in archive");
});

// ─── Case 6b: verdictApproves returns false for non-MERGE verdict ────────────
test("case 6b — verdictApproves returns false for FIX verdict in archive", async () => {
  const { archiveDir, opts } = await makeSandbox("c6b");
  await writeVerdict(archiveDir, 601, "VERDICT: FIX\n\nNeeds changes.\n");

  const approved = await verdictApproves(601, null, opts);
  assert.equal(approved, false,
    "verdictApproves must return false for non-MERGE verdict");
});
