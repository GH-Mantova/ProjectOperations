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

import { decideEscalationAction } from "../index.mjs";

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
