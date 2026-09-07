// Unit tests for runVerdictArchiveSweep — the REPORTING half of the
// verdict-archive sweep.
//
// WHY THIS SUITE EXISTS. The sweep's summary line used to be gated on a
// non-zero counter, so an empty board logged NOTHING. An idle watcher and a
// dead watcher then produced byte-identical log tails, and every supervisor
// run had to make a judgement call about whether the silence was benign. The
// board emptied at 2026-08-25T07:01Z and the log went mute inside the same
// rescan; two write-ups had to warn readers not to read that as a death.
//
// So these tests do NOT assert "a line was written". They assert the two
// things that actually make idle POSITIVELY OBSERVABLE:
//   1. an idle sweep emits EXACTLY ONE line, and it carries the stable
//      `verdict-archive sweep: idle` marker;
//   2. the counted branch is UNCHANGED — a sweep that saw verdict files still
//      reports counts and NEVER claims to be idle.
// A suite that only exercised the new branch would not prove (2).
//
// Pure Node, no external deps, no network, no gh. Run with:
//   node --test "scripts/pr-watcher/__tests__/*.mjs"
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runVerdictArchiveSweep } from "../index.mjs";

const IDLE_LINE = "verdict-archive sweep: idle - 0 verdict files, watcher alive";

// The exact substring the premise, done_when and future log probes grep for.
// If a reword ever breaks this, the whole liveness signal breaks silently.
const IDLE_MARKER = "verdict-archive sweep: idle";

function makeLogger() {
  const calls = [];
  const logger = (level, msg) => calls.push({ level, msg });
  logger.calls = calls;
  logger.messages = () => calls.map((c) => c.msg);
  return logger;
}

async function makeSandbox({ createReviewsDir = true } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "sweep-idle-tick-"));
  const reviewsDir = path.join(root, "docs", "pr-reviews");
  const archiveDir = path.join(root, "verdicts-archive");
  if (createReviewsDir) await mkdir(reviewsDir, { recursive: true });
  return { root, reviewsDir, archiveDir };
}

// A fetchPrState that fails the test if the sweep ever reaches the network
// path on an empty board. An idle sweep must cost zero gh quota.
function neverCalledFetchPrState() {
  return async (prNumber) => {
    assert.fail(`fetchPrState must not be called on an idle board (got PR #${prNumber})`);
  };
}

test("an EMPTY reviews directory logs the idle liveness tick exactly once", async () => {
  const { reviewsDir, archiveDir } = await makeSandbox();
  const logger = makeLogger();

  const stats = await runVerdictArchiveSweep({
    reviewsDir,
    archiveDir,
    fetchPrState: neverCalledFetchPrState(),
    listTrackedVerdicts: async () => [],
    logger,
  });

  // Every counter zero — this is the case that used to print nothing at all.
  assert.deepStrictEqual(stats, { archived: 0, kept: 0, skipped: 0, tracked: 0 });

  // EXACTLY ONE line, and it is the idle line verbatim. Asserting the whole
  // call list (not "some call matched") is what makes "exactly once" real.
  assert.deepStrictEqual(logger.calls, [{ level: "review", msg: IDLE_LINE }]);
  assert.ok(logger.calls[0].msg.includes(IDLE_MARKER));
});

test("a MISSING reviews directory still logs the idle tick, not silence", async () => {
  // ENOENT is an early return inside archiveSettledVerdicts. Before this
  // change that path was doubly mute: no readdir, no summary. A watcher whose
  // clone has no docs/pr-reviews yet is idle, not dead.
  const { reviewsDir, archiveDir } = await makeSandbox({ createReviewsDir: false });
  const logger = makeLogger();

  const stats = await runVerdictArchiveSweep({
    reviewsDir,
    archiveDir,
    fetchPrState: neverCalledFetchPrState(),
    listTrackedVerdicts: async () => [],
    logger,
  });

  assert.deepStrictEqual(stats, { archived: 0, kept: 0, skipped: 0, tracked: 0 });
  assert.deepStrictEqual(logger.calls, [{ level: "review", msg: IDLE_LINE }]);
});

test("files that are not verdicts do not count as board activity", async () => {
  const { reviewsDir, archiveDir } = await makeSandbox();
  await writeFile(path.join(reviewsDir, "README.md"), "not a verdict", "utf-8");
  await writeFile(path.join(reviewsDir, "pr-notanumber-review.md"), "nope", "utf-8");
  const logger = makeLogger();

  const stats = await runVerdictArchiveSweep({
    reviewsDir,
    archiveDir,
    fetchPrState: neverCalledFetchPrState(),
    listTrackedVerdicts: async () => [],
    logger,
  });

  assert.deepStrictEqual(stats, { archived: 0, kept: 0, skipped: 0, tracked: 0 });
  assert.deepStrictEqual(logger.calls, [{ level: "review", msg: IDLE_LINE }]);
});

test("the tick repeats: one idle line PER sweep, so the cadence is the signal", async () => {
  // Liveness is a CADENCE, not a single line. Two sweeps must produce two
  // ticks — one line that never repeats would be indistinguishable from a
  // watcher that died right after startup.
  const { reviewsDir, archiveDir } = await makeSandbox();
  const logger = makeLogger();

  const opts = {
    reviewsDir,
    archiveDir,
    fetchPrState: neverCalledFetchPrState(),
    listTrackedVerdicts: async () => [],
    logger,
  };
  await runVerdictArchiveSweep(opts);
  await runVerdictArchiveSweep(opts);

  assert.deepStrictEqual(logger.calls, [
    { level: "review", msg: IDLE_LINE },
    { level: "review", msg: IDLE_LINE },
  ]);
});

test("the COUNTED branch still fires for an untracked verdict on an OPEN PR", async () => {
  // Proof the old branch survived. A suite that only drove the empty board
  // would pass even if the counted line had been deleted outright.
  const { reviewsDir, archiveDir } = await makeSandbox();
  await writeFile(path.join(reviewsDir, "pr-1234-review.md"), "verdict-body", "utf-8");
  const logger = makeLogger();

  const stats = await runVerdictArchiveSweep({
    reviewsDir,
    archiveDir,
    fetchPrState: async (prNumber) => {
      assert.equal(prNumber, 1234);
      return "OPEN";
    },
    listTrackedVerdicts: async () => [],
    logger,
  });

  assert.deepStrictEqual(stats, { archived: 0, kept: 1, skipped: 0, tracked: 0 });
  assert.deepStrictEqual(logger.calls, [
    {
      level: "review",
      msg: "verdict-archive sweep: archived=0 kept=1 skipped=0 tracked=0",
    },
  ]);
  // The two branches are mutually exclusive: a board with work never lies
  // about being idle.
  assert.ok(!logger.messages().some((m) => m.includes(IDLE_MARKER)));
});

test("a TRACKED verdict counts as activity, so no idle line is emitted", async () => {
  // tracked>0 is the common real-world case: docs/pr-reviews is a git-tracked
  // directory, so the truly-silent case is rarer than the prompt's `archived +
  // kept + skipped` framing suggests. The gate must include tracked.
  const { reviewsDir, archiveDir } = await makeSandbox();
  await writeFile(path.join(reviewsDir, "pr-77-review.md"), "committed verdict", "utf-8");
  const logger = makeLogger();

  const stats = await runVerdictArchiveSweep({
    reviewsDir,
    archiveDir,
    fetchPrState: neverCalledFetchPrState(), // tracked files skip the gh call
    listTrackedVerdicts: async () => ["pr-77-review.md"],
    logger,
  });

  assert.deepStrictEqual(stats, { archived: 0, kept: 0, skipped: 0, tracked: 1 });
  assert.deepStrictEqual(logger.calls, [
    {
      level: "review",
      msg: "verdict-archive sweep: archived=0 kept=0 skipped=0 tracked=1",
    },
  ]);
  assert.ok(!logger.messages().some((m) => m.includes(IDLE_MARKER)));
});

test("a crashed sweep reports the crash and never claims to be idle", async () => {
  // The idle line means "the sweep ran to completion and found nothing". It
  // must never be emitted for a sweep that blew up — that would turn the
  // liveness tick into the very kind of reassuring lie it exists to remove.
  const { reviewsDir, archiveDir } = await makeSandbox();
  const logger = makeLogger();

  const stats = await runVerdictArchiveSweep({
    reviewsDir,
    archiveDir,
    fetchPrState: async () => "OPEN",
    // Omitted listTrackedVerdicts => archiveSettledVerdicts throws TypeError.
    logger,
  });

  assert.strictEqual(stats, null);
  assert.strictEqual(logger.calls.length, 1);
  assert.strictEqual(logger.calls[0].level, "review");
  assert.ok(logger.calls[0].msg.startsWith("verdict-archive sweep crashed (swallowed): "));
  assert.ok(!logger.calls[0].msg.includes(IDLE_MARKER));
});

test("the sweep never throws into the caller, even when the logger itself throws", async () => {
  // The rescan loop calls this and then writeQueueState(). If a logging fault
  // could escape, the authoritative liveness probe (.queue-state.json `ts`)
  // would stop being written — the log fix would have broken the real probe.
  const { reviewsDir, archiveDir } = await makeSandbox();
  let reached = false;

  await assert.doesNotReject(async () => {
    await runVerdictArchiveSweep({
      reviewsDir,
      archiveDir,
      fetchPrState: neverCalledFetchPrState(),
      listTrackedVerdicts: async () => [],
      logger: (_level, msg) => {
        if (msg.includes(IDLE_MARKER)) {
          reached = true;
          throw new Error("stdout is gone");
        }
      },
    });
  });

  assert.strictEqual(reached, true, "the idle branch must have been the one that threw");
});
