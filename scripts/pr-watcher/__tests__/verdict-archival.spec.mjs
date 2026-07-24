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
  });

  assert.deepEqual(stats, { archived: 1, kept: 0, skipped: 0 });
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
  });

  assert.deepEqual(stats, { archived: 1, kept: 0, skipped: 0 });
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
  });

  assert.deepEqual(stats, { archived: 0, kept: 1, skipped: 0 });
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
    logger: (level, msg) => logged.push([level, msg]),
  });

  assert.deepEqual(stats, { archived: 0, kept: 0, skipped: 1 });
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
  });

  assert.deepEqual(stats, { archived: 0, kept: 0, skipped: 0 });
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
  });

  assert.deepEqual(stats, { archived: 1, kept: 1, skipped: 1 });
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
  });
  assert.deepEqual(stats, { archived: 0, kept: 0, skipped: 0 });
});
