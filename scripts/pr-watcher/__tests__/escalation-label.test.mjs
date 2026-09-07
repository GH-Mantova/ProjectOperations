// Unit tests for decideEscalationAction — the pure policy function that governs
// whether the watcher applies `do-not-merge` on an escalates PR.
//
// The incident this suite guards against (2026-08-18):
//   - Marco removed `do-not-merge` from PR #1158 at 00:26:53Z.
//   - The watcher restarted with the same prompt still armed and re-processed it.
//   - holdForMarco unconditionally re-applied `do-not-merge` at 01:45:08Z.
//   - CP-26 went red again, the PR stopped merging, and a human decision was
//     silently reversed by automation 78 minutes later.
//
// The fix: decideEscalationAction returns "spent" (PR pre-dates run — do nothing),
// "already-labeled" (no duplicate apply), "declined" (last do-not-merge event was
// `unlabeled`, refuse to re-apply), or "apply" (safe to label + comment).
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  decideEscalationAction,
  holdForMarco,
  parseWatcherFrontMatter,
} from "../index.mjs";

const HOUR = 3600 * 1000;

test("prompt whose branch already has an open PR → action=spent (no label, no comment)", () => {
  // PR was created 6 hours before this run started — a re-run of an already-consumed
  // prompt. Caller must move to processed/ silently, apply no label, post no comment.
  const runStartedAtMs = Date.parse("2026-08-18T01:11:00Z");
  const prCreatedAtMs = Date.parse("2026-08-17T09:40:00Z");
  const decision = decideEscalationAction({
    prCreatedAtMs,
    runStartedAtMs,
    currentLabels: [],
    doNotMergeEvents: [],
  });
  assert.equal(decision.action, "spent");
  assert.match(decision.reason, /pre-dates this run/);
});

test("escalates PR with no label history → action=apply (label + comment)", () => {
  // Fresh PR created inside this run, no prior label events. Safe to label.
  const runStartedAtMs = Date.parse("2026-08-18T10:00:00Z");
  const decision = decideEscalationAction({
    prCreatedAtMs: runStartedAtMs + 5 * 60 * 1000,
    runStartedAtMs,
    currentLabels: ["needs-review"],
    doNotMergeEvents: [],
  });
  assert.equal(decision.action, "apply");
});

test("escalates PR whose last `do-not-merge` event is `unlabeled` → action=declined (label NOT applied)", () => {
  // This is the exact PR #1158 shape at the moment of the incident:
  //   09:40:49Z  labeled    do-not-merge   (previous run)
  //   00:26:53Z  unlabeled  do-not-merge   (Marco's review decision — MUST WIN)
  // A subsequent run must NOT re-apply. This test proves the fix.
  const runStartedAtMs = Date.parse("2026-08-18T01:11:00Z");
  // Newer than run start so the "spent" branch does NOT fire — we want to prove
  // the label-history branch is what protects us here.
  const prCreatedAtMs = runStartedAtMs + 60 * 1000;
  const decision = decideEscalationAction({
    prCreatedAtMs,
    runStartedAtMs,
    currentLabels: [],
    doNotMergeEvents: [
      { event: "labeled", createdAt: "2026-08-17T09:40:49Z" },
      { event: "unlabeled", createdAt: "2026-08-18T00:26:53Z" },
    ],
  });
  assert.equal(decision.action, "declined");
  assert.match(decision.reason, /human already released/);
});

test("event order does not matter — sort is by createdAt, not array order", () => {
  // Same fingerprint as the incident, but events supplied in the "wrong" order.
  // decideEscalationAction MUST sort by createdAt itself; relying on caller order
  // would be a latent bug.
  const runStartedAtMs = Date.parse("2026-08-18T01:11:00Z");
  const decision = decideEscalationAction({
    prCreatedAtMs: runStartedAtMs + 60 * 1000,
    runStartedAtMs,
    currentLabels: [],
    doNotMergeEvents: [
      { event: "unlabeled", createdAt: "2026-08-18T00:26:53Z" },
      { event: "labeled", createdAt: "2026-08-17T09:40:49Z" },
    ],
  });
  assert.equal(decision.action, "declined");
});

test("escalates PR that still carries the label → action=already-labeled (no duplicate apply)", () => {
  const runStartedAtMs = Date.parse("2026-08-18T10:00:00Z");
  const decision = decideEscalationAction({
    prCreatedAtMs: runStartedAtMs + 60 * 1000,
    runStartedAtMs,
    currentLabels: ["do-not-merge", "escalated"],
    doNotMergeEvents: [
      { event: "labeled", createdAt: "2026-08-18T10:01:00Z" },
    ],
  });
  assert.equal(decision.action, "already-labeled");
});

test("spent takes precedence over declined — a re-run must be a full no-op", () => {
  // If a PR pre-dates the run AND has a prior `unlabeled` event, the outcome is
  // the same (no side effects) but the SEMANTICS differ. Spent → prompt is consumed.
  // Declined → human decision protected. Order matters for the log message and
  // for the caller's move-to-processed/ vs stay-open-for-Marco branching.
  const runStartedAtMs = Date.parse("2026-08-18T10:00:00Z");
  const prCreatedAtMs = runStartedAtMs - HOUR;
  const decision = decideEscalationAction({
    prCreatedAtMs,
    runStartedAtMs,
    currentLabels: [],
    doNotMergeEvents: [
      { event: "labeled", createdAt: "2026-08-17T09:40:49Z" },
      { event: "unlabeled", createdAt: "2026-08-18T00:26:53Z" },
    ],
  });
  assert.equal(decision.action, "spent");
});

test("multiple label/unlabel churn — only the MOST RECENT event decides", () => {
  // Marco removes → watcher (old code) re-applies → Marco removes AGAIN. Even
  // with several oscillations, the final event MUST be the one that decides.
  const runStartedAtMs = Date.parse("2026-08-18T03:00:00Z");
  const decision = decideEscalationAction({
    prCreatedAtMs: runStartedAtMs + 60 * 1000,
    runStartedAtMs,
    currentLabels: [],
    doNotMergeEvents: [
      { event: "labeled", createdAt: "2026-08-17T09:40:49Z" },
      { event: "unlabeled", createdAt: "2026-08-18T00:26:53Z" },
      { event: "labeled", createdAt: "2026-08-18T01:45:08Z" },
      { event: "unlabeled", createdAt: "2026-08-18T02:22:28Z" },
    ],
  });
  assert.equal(decision.action, "declined");
});

test("last event is `labeled` (previous run's apply, never removed) → action=apply is still safe", () => {
  // The label was applied once and never removed by a human. The PR's current
  // label state (currentLabels) is what governs the "already-labeled" branch;
  // an "apply" verdict here relies on the caller having already checked labels.
  // In practice fetchEscalationState populates BOTH, so the caller sees
  // "already-labeled" first. This test locks the ordering invariant.
  const runStartedAtMs = Date.parse("2026-08-18T10:00:00Z");
  const decision = decideEscalationAction({
    prCreatedAtMs: runStartedAtMs + 60 * 1000,
    currentLabels: ["do-not-merge"],
    runStartedAtMs,
    doNotMergeEvents: [
      { event: "labeled", createdAt: "2026-08-17T09:40:49Z" },
    ],
  });
  assert.equal(decision.action, "already-labeled");
});

test("empty inputs default to safe apply (belt-and-braces)", () => {
  const runStartedAtMs = Date.parse("2026-08-18T10:00:00Z");
  const decision = decideEscalationAction({
    prCreatedAtMs: runStartedAtMs + 60 * 1000,
    runStartedAtMs,
    currentLabels: undefined,
    doNotMergeEvents: undefined,
  });
  assert.equal(decision.action, "apply");
});

test("non-finite prCreatedAtMs does NOT trigger the spent branch (fail-safe)", () => {
  // If the createdAt query returned garbage, we must not silently drop the label
  // — better to try to apply (which either succeeds or logs a loud failure) than
  // to file the prompt as "spent" and vanish the escalates flag.
  const runStartedAtMs = Date.parse("2026-08-18T10:00:00Z");
  const decision = decideEscalationAction({
    prCreatedAtMs: NaN,
    runStartedAtMs,
    currentLabels: [],
    doNotMergeEvents: [],
  });
  assert.equal(decision.action, "apply");
});

test("comment body constant survives spaces and backticks intact", async () => {
  // The old code passed the body as an unquoted --body arg through spawn(shell:true),
  // which split it into 42 arguments and failed every escalates PR (#1158, #1165, #1166).
  // The fix writes the body to a temp file. Rather than reach into the private
  // function, we assert on the raw body string embedded in the module source, which
  // is the material fact this regression guard is defending.
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const path = await import("node:path");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = await readFile(path.join(here, "..", "index.mjs"), "utf-8");
  assert.match(src, /Held for Marco: this prompt declared `escalates: true`/);
  assert.match(src, /--body-file/);
  // The old buggy call site (`"pr", "comment", ..., "--body",` immediately followed
  // by a bare string) must be gone.
  assert.doesNotMatch(
    src,
    /"pr",\s*"comment",\s*String\(prNumber\),\s*"--body",\s*\n\s*"Held for Marco/,
  );
});

// ---------------------------------------------------------------------------
// FIXES_PR_ESCALATION — the fix lane could never escalate
// ---------------------------------------------------------------------------
//
// THE DEFECT (measured 2026-09-07 at origin/main 5a824702). The `spent` guard
// above asks "was this PR created before this run started?" and reads YES as
// "an earlier run already consumed this prompt". For an ordinary prompt that
// holds — the watcher OPENS the PR during the run. For a FIX-LANE prompt
// (front matter `fixes_pr: N`) it is a tautology: such a prompt exists
// precisely to push onto a PR that is already open, so the guard fires on the
// first and only run, EVERY time, for the whole lane.
//
// Two consequences, and both are tested below rather than asserted in prose:
//
//   1. `escalates: true` was inert in the fix lane. No `do-not-merge` label was
//      applied and no comment was posted, so CP-26 never held the PR and the
//      routing the prompt author asked for did not exist. The first fix-lane
//      prompt ever dequeued here (pr-fix-1740-jest-cannot-parse-puppeteer-25-esm,
//      01:23:00Z–02:11:48Z) exited 0, pushed, turned CI green, and escalated
//      nothing.
//   2. The verdict it wrote was `{"spent":true,"reason":"PR pre-dates this run…"}`
//      — no `marco` key at all. RULE 2's only probe is `marco.:true` over
//      docs/pr-prompts/processed/pr-*.log, so a PR whose ONLY prompt log is a
//      fix-lane log reads as carrying no Marco routing: a fail-open of the same
//      shape DOCTRINE 9.5 records for the watcher-clone decoy directory.
//
// WHY THESE TESTS REACH holdForMarco AND NOT ONLY THE PURE FUNCTION. An
// assertion that decideEscalationAction returns "apply" proves a string, not a
// label. The failure mode this repo keeps hitting is a green unit test sitting
// beside an untested call site. So the integration tests below drive
// holdForMarco itself with an injected gh transport and assert on the RECORDED
// ARGV — the label is proven applied because `gh pr edit N --add-label
// do-not-merge` was actually issued, and proven NOT applied on the paths where
// a human already ruled.

// --- pure: decideEscalationAction with the new isFixLane input --------------

test("FIXES_PR_ESCALATION: a fix-lane prompt on a pre-existing PR is NOT spent", () => {
  // Exactly the #1740 shape: the PR was opened the previous evening, the fix
  // prompt runs against it hours later. Before this slice the run returned
  // `spent` here and the escalation vanished.
  const runStartedAtMs = Date.parse("2026-09-07T01:23:00Z");
  const prCreatedAtMs = Date.parse("2026-09-06T23:02:21Z");
  const decision = decideEscalationAction({
    prCreatedAtMs,
    runStartedAtMs,
    currentLabels: [],
    doNotMergeEvents: [],
    isFixLane: true,
  });
  assert.notEqual(decision.action, "spent");
  assert.equal(decision.action, "apply");
});

test("FIXES_PR_ESCALATION: the same inputs WITHOUT the fix-lane flag still return spent", () => {
  // The normal-lane guard is narrowed, not deleted. This is the paired negative
  // control for the test above: identical timestamps, one flag different.
  const runStartedAtMs = Date.parse("2026-09-07T01:23:00Z");
  const prCreatedAtMs = Date.parse("2026-09-06T23:02:21Z");
  const decision = decideEscalationAction({
    prCreatedAtMs,
    runStartedAtMs,
    currentLabels: [],
    doNotMergeEvents: [],
    isFixLane: false,
  });
  assert.equal(decision.action, "spent");
  assert.match(decision.reason, /pre-dates this run/);
});

test("isFixLane defaults to false — every existing caller keeps normal-lane behaviour", () => {
  // The parameter is omitted entirely here, which is how every non-fix-lane
  // call reaches this function.
  const runStartedAtMs = Date.parse("2026-08-18T01:11:00Z");
  const decision = decideEscalationAction({
    prCreatedAtMs: Date.parse("2026-08-17T09:40:00Z"),
    runStartedAtMs,
    currentLabels: [],
    doNotMergeEvents: [],
  });
  assert.equal(decision.action, "spent");
});

test("fix-lane prompt whose `do-not-merge` a human REMOVED → declined (2026-08-18 guarantee holds)", () => {
  // This is the load-bearing one. Skipping the `spent` test for the fix lane
  // must not reopen the #1158 incident. The fix-lane prompt now falls THROUGH
  // to the label-history branch, where Marco's removal still wins — and note
  // the PR pre-dates the run, so before this slice `spent` short-circuited
  // before the history was ever consulted.
  const runStartedAtMs = Date.parse("2026-09-07T01:23:00Z");
  const decision = decideEscalationAction({
    prCreatedAtMs: runStartedAtMs - 6 * HOUR,
    runStartedAtMs,
    currentLabels: [],
    doNotMergeEvents: [
      { event: "labeled", createdAt: "2026-09-06T09:40:49Z" },
      { event: "unlabeled", createdAt: "2026-09-07T00:26:53Z" },
    ],
    isFixLane: true,
  });
  assert.equal(decision.action, "declined");
  assert.match(decision.reason, /human already released/);
});

test("fix-lane prompt whose PR still carries the label → already-labeled (no duplicate apply)", () => {
  const runStartedAtMs = Date.parse("2026-09-07T01:23:00Z");
  const decision = decideEscalationAction({
    prCreatedAtMs: runStartedAtMs - 6 * HOUR,
    runStartedAtMs,
    currentLabels: ["do-not-merge"],
    doNotMergeEvents: [{ event: "labeled", createdAt: "2026-09-06T09:41:00Z" }],
    isFixLane: true,
  });
  assert.equal(decision.action, "already-labeled");
});

// --- integration: holdForMarco actually applies the label -------------------

// Records every gh invocation and answers the two read calls fetchEscalationState
// makes. Nothing spawns, nothing touches the network, nothing writes to disk.
function ghStub({ prCreatedAt, labels = [], events = [] }) {
  const calls = [];
  const impl = async (args) => {
    calls.push(args);
    if (args[0] === "pr" && args[1] === "view") {
      return { createdAt: prCreatedAt, labels: labels.map((name) => ({ name })) };
    }
    if (args[0] === "api") {
      return events.map((e) => ({
        event: e.event,
        created_at: e.createdAt,
        label: { name: "do-not-merge" },
      }));
    }
    return "";
  };
  impl.calls = calls;
  // The write calls only — the two reads above are unconditional and say nothing
  // about whether a decision was acted on.
  impl.writes = () => calls.filter((a) => a[1] === "edit" || a[1] === "comment");
  impl.addedLabels = () =>
    calls
      .filter((a) => a[0] === "pr" && a[1] === "edit" && a.includes("--add-label"))
      .map((a) => a[a.indexOf("--add-label") + 1]);
  return impl;
}

// Silences the heartbeat (no disk, no timer that outlives the test) and the log.
function quietOpts() {
  const logged = [];
  const comments = [];
  return {
    _appendLine: async () => {},
    _intervalMs: 60_000,
    _log: (level, msg) => logged.push(`${level}: ${msg}`),
    _postHeldForMarcoComment: async (prNumber, opts) => {
      comments.push({ prNumber, hasTransport: typeof opts?.runGhImpl === "function" });
    },
    logged,
    comments,
  };
}

test("INTEGRATION: a fix-lane escalating run APPLIES `do-not-merge` to the pre-existing PR", async () => {
  // The #1740 timings exactly. Before this slice holdForMarco returned
  // { spent: true } here and issued no write call at all.
  const runStartedAtMs = Date.parse("2026-09-07T01:23:00Z");
  const gh = ghStub({ prCreatedAt: "2026-09-06T23:02:21Z" });
  const opts = quietOpts();
  const result = await holdForMarco(1740, "pr-fix-1740-ready.md", runStartedAtMs, {
    ...opts,
    fixesPr: 1740,
    _runGh: gh,
  });

  // THE LABEL WAS APPLIED — proven by the argv that was issued, not by a
  // decision string.
  assert.deepEqual(gh.addedLabels(), ["do-not-merge"]);
  assert.deepEqual(
    gh.writes()[0],
    ["pr", "edit", "1740", "--add-label", "do-not-merge"],
    "the first write call must be the label apply",
  );
  // …and the human was told why.
  assert.deepEqual(opts.comments, [{ prNumber: 1740, hasTransport: true }]);
  // …and the verdict RULE 2 reads says Marco owns this PR.
  assert.equal(result.spent, undefined);
  assert.equal(result.ok, false);
  assert.equal(result.marco, true);
  assert.equal(result.fixLane, true);
  assert.match(JSON.stringify(result), /marco.:true/);
});

test("INTEGRATION NEGATIVE: the identical run WITHOUT `fixes_pr` applies no label and says marco:false", async () => {
  // Same PR, same clock, same stub — only the front-matter fact differs. This
  // is what stops the fix above from being a blanket removal of the guard.
  const runStartedAtMs = Date.parse("2026-09-07T01:23:00Z");
  const gh = ghStub({ prCreatedAt: "2026-09-06T23:02:21Z" });
  const opts = quietOpts();
  const result = await holdForMarco(1740, "pr-ordinary-ready.md", runStartedAtMs, {
    ...opts,
    fixesPr: null,
    _runGh: gh,
  });

  assert.deepEqual(gh.writes(), [], "a spent re-run must issue NO write call");
  assert.deepEqual(opts.comments, []);
  assert.equal(result.spent, true);
  assert.match(result.reason, /pre-dates this run/);
  // The verdict is now EXPLICIT about Marco instead of silent: the probe must
  // read false, and must not read true.
  assert.equal(result.marco, false);
  assert.equal(result.fixLane, false);
  assert.match(JSON.stringify(result), /marco.:false/);
  assert.doesNotMatch(JSON.stringify(result), /marco.:true/);
});

test("INTEGRATION: a fix-lane run does NOT re-apply a label a human removed", async () => {
  // #1158's shape carried into the fix lane. The run must reach `declined`,
  // issue no write, and still route to Marco in its verdict.
  const runStartedAtMs = Date.parse("2026-09-07T01:23:00Z");
  const gh = ghStub({
    prCreatedAt: "2026-09-06T23:02:21Z",
    labels: [],
    events: [
      { event: "labeled", createdAt: "2026-09-06T23:40:49Z" },
      { event: "unlabeled", createdAt: "2026-09-07T00:26:53Z" },
    ],
  });
  const opts = quietOpts();
  const result = await holdForMarco(1740, "pr-fix-1740-ready.md", runStartedAtMs, {
    ...opts,
    fixesPr: 1740,
    _runGh: gh,
  });

  assert.deepEqual(gh.addedLabels(), [], "a human's removal must not be reversed");
  assert.deepEqual(gh.writes(), []);
  assert.equal(result.marco, true);
  assert.equal(result.fixLane, true);
  assert.match(result.reason, /human already released/);
  assert.match(JSON.stringify(result), /marco.:true/);
  assert.ok(
    opts.logged.some((l) => /REFUSING to re-apply/.test(l)),
    "the decline must be logged loudly",
  );
});

test("INTEGRATION: a fix-lane PR that already carries the label is not labelled twice", async () => {
  const runStartedAtMs = Date.parse("2026-09-07T01:23:00Z");
  const gh = ghStub({
    prCreatedAt: "2026-09-06T23:02:21Z",
    labels: ["do-not-merge"],
    events: [{ event: "labeled", createdAt: "2026-09-06T23:40:49Z" }],
  });
  const opts = quietOpts();
  const result = await holdForMarco(1740, "pr-fix-1740-ready.md", runStartedAtMs, {
    ...opts,
    fixesPr: 1740,
    _runGh: gh,
  });
  assert.deepEqual(gh.writes(), []);
  assert.equal(result.marco, true);
  assert.match(JSON.stringify(result), /marco.:true/);
});

test("INTEGRATION: the label apply survives a failed comment post, and fails LOUD if the label itself fails", async () => {
  // Two hazards in one: the comment is best-effort (its failure must not
  // suppress the label), and a failed label apply must NOT return a quiet
  // success — an unlabelled escalates PR is the whole hazard.
  const runStartedAtMs = Date.parse("2026-09-07T01:23:00Z");
  const gh = ghStub({ prCreatedAt: "2026-09-06T23:02:21Z" });
  const opts = quietOpts();
  const soft = await holdForMarco(1740, "pr-fix-1740-ready.md", runStartedAtMs, {
    ...opts,
    fixesPr: 1740,
    _runGh: gh,
    _postHeldForMarcoComment: async () => {
      throw new Error("comment exploded");
    },
  });
  assert.deepEqual(gh.addedLabels(), ["do-not-merge"]);
  assert.equal(soft.marco, true);

  const failing = ghStub({ prCreatedAt: "2026-09-06T23:02:21Z" });
  const base = failing;
  const throwing = async (args) => {
    if (args[1] === "edit") throw new Error("label API 403");
    return base(args);
  };
  const opts2 = quietOpts();
  const hard = await holdForMarco(1740, "pr-fix-1740-ready.md", runStartedAtMs, {
    ...opts2,
    fixesPr: 1740,
    _runGh: throwing,
  });
  assert.equal(hard.marco, true);
  assert.equal(hard.fixLane, true);
  assert.match(hard.reason, /could NOT be applied/);
  assert.match(JSON.stringify(hard), /marco.:true/);
});

test("INTEGRATION: the chain runs from real front matter, not a hand-set boolean", async () => {
  // parseWatcherFrontMatter → deps.fixesPr → holdForMarco → gh --add-label.
  // Every link the dispatcher uses except its own literal call line, which the
  // source assertion below pins.
  const body = [
    "---",
    "fixes_pr: 1740",
    "escalates: true",
    "---",
    "",
    "# body",
  ].join("\n");
  const deps = parseWatcherFrontMatter(body);
  assert.equal(deps.escalates, true);
  assert.equal(deps.fixesPr, 1740);

  const runStartedAtMs = Date.parse("2026-09-07T01:23:00Z");
  const gh = ghStub({ prCreatedAt: "2026-09-06T23:02:21Z" });
  const opts = quietOpts();
  const result = await holdForMarco(1740, "pr-fix-1740-ready.md", runStartedAtMs, {
    ...opts,
    fixesPr: deps.fixesPr,
    _runGh: gh,
  });
  assert.deepEqual(gh.addedLabels(), ["do-not-merge"]);
  assert.match(JSON.stringify(result), /marco.:true/);
});

test("the dispatcher threads deps.fixesPr into holdForMarco, and the anchor token is present", async () => {
  // The escalates dispatch sits inside the watcher's run loop and cannot be
  // called from a unit test without spawning an agent, so this pins the one
  // link in the chain the tests above cannot execute. Same technique the
  // comment-body guard at the top of this file uses.
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const path = await import("node:path");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = await readFile(path.join(here, "..", "index.mjs"), "utf-8");
  assert.match(
    src,
    /holdForMarco\(prNumber, name, runStartedAtMs, \{ fixesPr: deps\.fixesPr \}\)/,
    "the escalates dispatch must pass the prompt's fixes_pr through",
  );
  // The premise probe for this slice greps for this token; if it is ever
  // reworded the whole fix-lane escalation branch loses its anchor.
  assert.match(src, /FIXES_PR_ESCALATION/);
});
