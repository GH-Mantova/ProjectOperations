// Unit tests for archiveSettledVerdicts — the settled-verdict sweep that
// moves docs/pr-reviews/pr-N-review.md for MERGED/CLOSED PRs out of the
// live watcher clone into a sibling verdicts-archive directory.
//
// The sweep must:
//   - move verdicts for MERGED / CLOSED PRs,
//   - leave verdicts for OPEN PRs exactly where they are,
//   - leave verdicts in place (never delete) when the state query fails,
//   - never throw into the caller.
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { archiveSettledVerdicts } from "../index.mjs";

async function makeSandbox() {
  const root = await mkdtemp(path.join(tmpdir(), "verdict-archival-"));
  const reviewsDir = path.join(root, "docs", "pr-reviews");
  const archiveDir = path.join(root, "..", "verdicts-archive-" + path.basename(root));
  await import("node:fs/promises").then((m) => m.mkdir(reviewsDir, { recursive: true }));
  return { root, reviewsDir, archiveDir };
}

test("archives a verdict when its PR is MERGED", async () => {
  const { reviewsDir, archiveDir } = await makeSandbox();
  const name = "pr-42-review.md";
  await writeFile(path.join(reviewsDir, name), "verdict-body", "utf-8");

  const stats = await archiveSettledVerdicts({
    reviewsDir,
    archiveDir,
    fetchPrState: async (n) => {
      assert.equal(n, 42);
      return "MERGED";
    },
    listTrackedVerdicts: async () => [],
  });

  assert.deepEqual(stats, { archived: 1, kept: 0, skipped: 0, tracked: 0 });
  assert.equal(existsSync(path.join(reviewsDir, name)), false);
  const moved = await readFile(path.join(archiveDir, name), "utf-8");
  assert.equal(moved, "verdict-body");
});

test("archives a verdict when its PR is CLOSED", async () => {
  const { reviewsDir, archiveDir } = await makeSandbox();
  await writeFile(path.join(reviewsDir, "pr-7-review.md"), "x", "utf-8");

  const stats = await archiveSettledVerdicts({
    reviewsDir,
    archiveDir,
    fetchPrState: async () => "CLOSED",
    listTrackedVerdicts: async () => [],
  });

  assert.deepEqual(stats, { archived: 1, kept: 0, skipped: 0, tracked: 0 });
  assert.equal(existsSync(path.join(archiveDir, "pr-7-review.md")), true);
});

test("leaves a verdict in place when its PR is OPEN", async () => {
  const { reviewsDir, archiveDir } = await makeSandbox();
  const name = "pr-99-review.md";
  await writeFile(path.join(reviewsDir, name), "still-live", "utf-8");

  const stats = await archiveSettledVerdicts({
    reviewsDir,
    archiveDir,
    fetchPrState: async () => "OPEN",
    listTrackedVerdicts: async () => [],
  });

  assert.deepEqual(stats, { archived: 0, kept: 1, skipped: 0, tracked: 0 });
  assert.equal(existsSync(path.join(reviewsDir, name)), true);
  assert.equal(existsSync(archiveDir), false);
});

test("failed state query leaves file in place and does not throw", async () => {
  const { reviewsDir, archiveDir } = await makeSandbox();
  const name = "pr-13-review.md";
  await writeFile(path.join(reviewsDir, name), "keep-me", "utf-8");
  const logged = [];

  const stats = await archiveSettledVerdicts({
    reviewsDir,
    archiveDir,
    fetchPrState: async () => {
      throw new Error("gh exited 1: rate-limited");
    },
    listTrackedVerdicts: async () => [],
    logger: (level, msg) => logged.push([level, msg]),
  });

  assert.deepEqual(stats, { archived: 0, kept: 0, skipped: 1, tracked: 0 });
  assert.equal(existsSync(path.join(reviewsDir, name)), true);
  assert.equal(existsSync(archiveDir), false);
  assert.ok(
    logged.some(([, m]) => m.includes("PR #13") && m.includes("leaving")),
    `expected skip log mentioning PR #13, got ${JSON.stringify(logged)}`,
  );
});

test("ignores files that don't match pr-N-review.md", async () => {
  const { reviewsDir, archiveDir } = await makeSandbox();
  await writeFile(path.join(reviewsDir, "README.md"), "docs", "utf-8");
  await writeFile(path.join(reviewsDir, "pr-notes.md"), "notes", "utf-8");
  await writeFile(path.join(reviewsDir, "pr-abc-review.md"), "no", "utf-8");

  let calls = 0;
  const stats = await archiveSettledVerdicts({
    reviewsDir,
    archiveDir,
    fetchPrState: async () => {
      calls++;
      return "MERGED";
    },
    listTrackedVerdicts: async () => [],
  });

  assert.deepEqual(stats, { archived: 0, kept: 0, skipped: 0, tracked: 0 });
  assert.equal(calls, 0);
  const remaining = await readdir(reviewsDir);
  assert.deepEqual(remaining.sort(), ["README.md", "pr-abc-review.md", "pr-notes.md"]);
});

test("handles a mix of MERGED, OPEN, and failing PRs in one sweep", async () => {
  const { reviewsDir, archiveDir } = await makeSandbox();
  await writeFile(path.join(reviewsDir, "pr-1-review.md"), "merged", "utf-8");
  await writeFile(path.join(reviewsDir, "pr-2-review.md"), "open", "utf-8");
  await writeFile(path.join(reviewsDir, "pr-3-review.md"), "boom", "utf-8");

  const stats = await archiveSettledVerdicts({
    reviewsDir,
    archiveDir,
    fetchPrState: async (n) => {
      if (n === 1) return "MERGED";
      if (n === 2) return "OPEN";
      throw new Error("nope");
    },
    listTrackedVerdicts: async () => [],
  });

  assert.deepEqual(stats, { archived: 1, kept: 1, skipped: 1, tracked: 0 });
  assert.equal(existsSync(path.join(archiveDir, "pr-1-review.md")), true);
  assert.equal(existsSync(path.join(reviewsDir, "pr-2-review.md")), true);
  assert.equal(existsSync(path.join(reviewsDir, "pr-3-review.md")), true);
});

test("missing reviewsDir is a no-op, returns zeroed stats", async () => {
  const { root } = await makeSandbox();
  const stats = await archiveSettledVerdicts({
    reviewsDir: path.join(root, "does", "not", "exist"),
    archiveDir: path.join(root, "..", "archive"),
    fetchPrState: async () => {
      throw new Error("should not be called");
    },
    listTrackedVerdicts: async () => [],
  });
  assert.deepEqual(stats, { archived: 0, kept: 0, skipped: 0, tracked: 0 });
});

// ── New tests for tracked-file protection ──────────────────────────────────

test("skips a tracked verdict — no fetchPrState call, file stays, tracked:1", async () => {
  const { reviewsDir, archiveDir } = await makeSandbox();
  const name = "pr-55-review.md";
  await writeFile(path.join(reviewsDir, name), "tracked-body", "utf-8");

  let fetchCalls = 0;
  const stats = await archiveSettledVerdicts({
    reviewsDir,
    archiveDir,
    fetchPrState: async () => {
      fetchCalls++;
      return "MERGED";
    },
    listTrackedVerdicts: async () => [name],
  });

  assert.deepEqual(stats, { archived: 0, kept: 0, skipped: 0, tracked: 1 });
  assert.equal(existsSync(path.join(reviewsDir, name)), true, "file must remain in reviewsDir");
  assert.equal(existsSync(path.join(archiveDir, name)), false, "file must not appear in archiveDir");
  assert.equal(fetchCalls, 0, "fetchPrState must never be called for a tracked file");
});

test("still archives an untracked verdict when tracked set is non-empty", async () => {
  const { reviewsDir, archiveDir } = await makeSandbox();
  const tracked = "pr-10-review.md";
  const untracked = "pr-20-review.md";
  await writeFile(path.join(reviewsDir, tracked), "tracked", "utf-8");
  await writeFile(path.join(reviewsDir, untracked), "untracked", "utf-8");

  const stats = await archiveSettledVerdicts({
    reviewsDir,
    archiveDir,
    fetchPrState: async () => "MERGED",
    listTrackedVerdicts: async () => [tracked],
  });

  assert.deepEqual(stats, { archived: 1, kept: 0, skipped: 0, tracked: 1 });
  assert.equal(existsSync(path.join(reviewsDir, tracked)), true, "tracked file must stay");
  assert.equal(existsSync(path.join(archiveDir, untracked)), true, "untracked file must be archived");
});

test("mixed sweep: one tracked and one untracked MERGED verdict — exactly one moves", async () => {
  const { reviewsDir, archiveDir } = await makeSandbox();
  const trackedName = "pr-100-review.md";
  const untrackedName = "pr-200-review.md";
  await writeFile(path.join(reviewsDir, trackedName), "t", "utf-8");
  await writeFile(path.join(reviewsDir, untrackedName), "u", "utf-8");

  const stats = await archiveSettledVerdicts({
    reviewsDir,
    archiveDir,
    fetchPrState: async () => "MERGED",
    listTrackedVerdicts: async () => [trackedName],
  });

  assert.deepEqual(stats, { archived: 1, kept: 0, skipped: 0, tracked: 1 });
  assert.equal(existsSync(path.join(reviewsDir, trackedName)), true);
  assert.equal(existsSync(path.join(archiveDir, trackedName)), false);
  assert.equal(existsSync(path.join(archiveDir, untrackedName)), true);
});

test("tracked lookup throws — all files skipped, nothing moves, one log line, no throw", async () => {
  const { reviewsDir, archiveDir } = await makeSandbox();
  await writeFile(path.join(reviewsDir, "pr-77-review.md"), "body", "utf-8");
  const logged = [];

  const stats = await archiveSettledVerdicts({
    reviewsDir,
    archiveDir,
    fetchPrState: async () => "MERGED",
    listTrackedVerdicts: async () => {
      throw new Error("git subprocess failed");
    },
    logger: (level, msg) => logged.push([level, msg]),
  });

  // Fail-closed: everything counted as tracked, nothing moved
  assert.deepEqual(stats, { archived: 0, kept: 0, skipped: 0, tracked: 1 });
  assert.equal(existsSync(path.join(reviewsDir, "pr-77-review.md")), true, "file must stay");
  assert.equal(existsSync(archiveDir), false, "archiveDir must not be created");
  assert.equal(logged.length, 1, "exactly one log line");
  assert.ok(
    logged[0][1].includes("listTrackedVerdicts failed"),
    `expected 'listTrackedVerdicts failed' in log, got: ${logged[0][1]}`,
  );
});

test("missing listTrackedVerdicts dependency throws TypeError", async () => {
  const { reviewsDir, archiveDir } = await makeSandbox();
  await assert.rejects(
    () =>
      archiveSettledVerdicts({
        reviewsDir,
        archiveDir,
        fetchPrState: async () => "MERGED",
        // listTrackedVerdicts intentionally omitted
      }),
    (err) => {
      assert.ok(err instanceof TypeError, `expected TypeError, got ${err.constructor.name}`);
      assert.ok(
        err.message.includes("listTrackedVerdicts is required"),
        `expected message about listTrackedVerdicts, got: ${err.message}`,
      );
      return true;
    },
  );
});
