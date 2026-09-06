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

import { mirrorVerdictToPr, resolveVerdictPath, verdictApproves } from "../index.mjs";

// Create an isolated sandbox with three empty dirs that represent the three homes.
//
// resolveVerdictPath({ repoRoot, archiveDir, devTree }) accepts:
//   repoRoot   — the clone ROOT; verdict is at repoRoot/docs/pr-reviews/pr-N-review.md
//   archiveDir — the archive dir directly; verdict is at archiveDir/pr-N-review.md
//   devTree    — the dev-tree ROOT; verdict is at devTree/docs/pr-reviews/pr-N-review.md
//
// Both tree roots are treated identically: docs/pr-reviews is joined onto each. That
// is what PR_WATCHER_DEV_TREE's name promises an operator, so the sandbox mirrors it.
//
// repoRoot deliberately sits one level under `base` so that dirname(repoRoot) === base:
// the DERIVED archive location (base/verdicts-archive) is a real, distinct directory a
// test can write into without injecting archiveDir. See "derived archive" case below.
//
// Returns { cloneReviews, archiveDir, derivedArchiveDir, devRoot, devReviews, opts }
// where opts can be passed directly to resolveVerdictPath / verdictApproves.
async function makeSandbox(tag) {
  const base = await mkdtemp(path.join(tmpdir(), `vhr-${tag}-`));
  // Clone home: repoRoot/docs/pr-reviews/
  const repoRoot = path.join(base, "clone");
  const cloneReviews = path.join(repoRoot, "docs", "pr-reviews");
  // Archive home: an explicit directory (NOT the one the resolver would derive)
  const archiveDir = path.join(base, "archive");
  // The archive location the resolver derives when archiveDir is NOT injected:
  // path.join(path.dirname(repoRoot), "verdicts-archive").
  const derivedArchiveDir = path.join(base, "verdicts-archive");
  // Dev-tree home: a tree ROOT, matching production VERDICT_DEV_TREE_DEFAULT
  // ("C:\ProjectOperations2"); the reviews dir hangs off it.
  const devRoot = path.join(base, "devtree");
  const devReviews = path.join(devRoot, "docs", "pr-reviews");

  await mkdir(cloneReviews, { recursive: true });
  await mkdir(archiveDir, { recursive: true });
  await mkdir(devReviews, { recursive: true });

  const opts = {
    repoRoot,
    archiveDir,
    devTree: devRoot,
  };
  return { base, repoRoot, cloneReviews, archiveDir, derivedArchiveDir, devRoot, devReviews, opts };
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

// ─── Case 7: PR_WATCHER_DEV_TREE names the TREE ROOT, not the reviews dir ────
// The variable's name promises a tree root, and REPO_ROOT's sibling variable
// (PR_WATCHER_REPO_ROOT) is one. An operator who sets PR_WATCHER_DEV_TREE to the
// root — the value the name asks for — must get a HIT, not a silent miss.
// This is the only case that exercises the env var itself; every other case
// injects devTree directly.
test("case 7 — PR_WATCHER_DEV_TREE is a tree root: docs/pr-reviews is joined onto it", async () => {
  const { devRoot, devReviews, repoRoot, archiveDir } = await makeSandbox("c7");
  await writeVerdict(devReviews, 700, "VERDICT: MERGE\n");

  const before = process.env.PR_WATCHER_DEV_TREE;
  process.env.PR_WATCHER_DEV_TREE = devRoot;
  try {
    // devTree is NOT injected — the env var must supply it, and be read as a root.
    const result = await resolveVerdictPath(700, { repoRoot, archiveDir });
    assert.equal(
      result.path,
      path.join(devReviews, "pr-700-review.md"),
      "PR_WATCHER_DEV_TREE must be joined with docs/pr-reviews, not used as the reviews dir",
    );
  } finally {
    if (before === undefined) delete process.env.PR_WATCHER_DEV_TREE;
    else process.env.PR_WATCHER_DEV_TREE = before;
  }
});

// ─── Case 8: the archive path is DERIVED when archiveDir is not injected ────
// Every case above hands the resolver an explicit archiveDir, so the derivation
// path.join(path.dirname(repoRoot), "verdicts-archive") is never executed. This
// case omits archiveDir entirely and writes the verdict ONLY where the derivation
// points. Checked by inspection against the sweep that puts files there:
// runArchiveSettledVerdicts uses path.join(REPO_ROOT, "..", "verdicts-archive"),
// which normalises to the same directory for any resolved REPO_ROOT.
test("case 8 — archive path is derived from repoRoot's parent when archiveDir is omitted", async () => {
  const { repoRoot, derivedArchiveDir, devRoot } = await makeSandbox("c8");
  await mkdir(derivedArchiveDir, { recursive: true });
  // The ONLY copy lives at dirname(repoRoot)/verdicts-archive — nowhere else.
  await writeVerdict(derivedArchiveDir, 800, "VERDICT: MERGE\n\nArchived by the sweep.\n");

  // archiveDir deliberately NOT passed: the resolver must derive it.
  const result = await resolveVerdictPath(800, { repoRoot, devTree: devRoot });
  assert.equal(
    result.path,
    path.join(derivedArchiveDir, "pr-800-review.md"),
    "resolver must derive dirname(repoRoot)/verdicts-archive — the dir the archive sweep moves verdicts into",
  );

  // And the derived path must be good enough for the gate that consults it.
  const approved = await verdictApproves(800, null, { repoRoot, devTree: devRoot });
  assert.equal(approved, true, "verdictApproves must read the verdict from the DERIVED archive dir");
});

// ─── Case 9: verdict resolves but cannot be read -> verdictMissing, not [ok] ─
// The archive sweep runs every five minutes and races the mirror: #1679 was moved
// 16s before the mirror looked for it. If it moves between the resolver's stat and
// mirrorVerdictToPr's readFile, the read throws — and the caller in drain() files
// the job [ok] unless it gets { verdictMissing: true } back. An unread verdict must
// never be recorded as a delivered one.
//
// The race is simulated by making the resolved path stat-able but unreadable: a
// DIRECTORY named pr-N-review.md. stat() succeeds (the resolver takes the hit),
// readFile() throws EISDIR. No timing, no injected clock, no gh call — the function
// returns before it reaches runGh.
test("case 9 — verdict stat's but fails to read: returns { verdictMissing: true }", async () => {
  const { repoRoot, archiveDir, devRoot } = await makeSandbox("c9");
  await mkdir(path.join(archiveDir, "pr-900-review.md"), { recursive: true });

  // Real review-job filename convention (rev-N-ready.md) — reviewJobPrNumber must
  // parse it, or the function bails before the branch under test.
  const result = await mirrorVerdictToPr("rev-900-ready.md", { repoRoot, archiveDir, devTree: devRoot });
  assert.deepEqual(
    result,
    { verdictMissing: true },
    "a resolved-but-unreadable verdict must return the same marker as a not-found-anywhere verdict, or drain() files the job [ok]",
  );
});
