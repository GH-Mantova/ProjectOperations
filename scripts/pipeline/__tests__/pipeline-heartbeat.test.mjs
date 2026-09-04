// Tests for scripts/pipeline/check-pipeline-heartbeat.mjs
//
// The script was rescued from an orphaned worktree and preserved in #1585 with no tests,
// no workflow and no registry entry - generated, committed, and read by nothing. This
// wires it up, and these are the assertions that make the wiring safe to trust.
//
// Style follows the pipeline suite: node:test, node:assert/strict, no dependencies.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  newestBreadcrumb,
  parsePause,
  evaluateHeartbeat,
  DEFAULT_THRESHOLD_HOURS,
  MAX_PAUSE_HOURS,
} from "../check-pipeline-heartbeat.mjs";

const NOW = Date.parse("2026-09-04T12:00:00Z");
const H = 3.6e6;

// --- newestBreadcrumb -------------------------------------------------------

test("newestBreadcrumb: nothing to read is null, not zero", () => {
  assert.equal(newestBreadcrumb([]), null);
  assert.equal(newestBreadcrumb(undefined), null);
});

test("newestBreadcrumb: ignores files that are not breadcrumbs", () => {
  assert.equal(newestBreadcrumb(["README.md", "blocked", "00-notes.txt"]), null);
});

test("newestBreadcrumb: picks the latest stamp regardless of station", () => {
  const got = newestBreadcrumb([
    "00-00-supervisor-2026-09-04-0900-took-04s-clean.md",
    "00-04-scanner-2026-09-04-1130-took-11s-two-findings.md",
    "00-05-sot-keeper-2026-09-03-0210-took-02s-clean.md",
  ]);
  assert.equal(got.station, "04");
  assert.equal(got.stamp, "2026-09-04T11:30:00Z");
});

// The validator regex is case-insensitive on the slug because stations capitalise
// exactly when the news is loud. The heartbeat must not lose those.
test("newestBreadcrumb: counts SHOUTED breadcrumbs", () => {
  const got = newestBreadcrumb(["00-04-scanner-2026-09-04-1100-took-09s-BLIND-no-dc.md"]);
  assert.equal(got.stamp, "2026-09-04T11:00:00Z");
});

// --- parsePause -------------------------------------------------------------
// Every unhappy path returns null. null means "not paused", and not-paused is the safe
// answer: a malformed file must never be able to silence the alarm, because that is the
// exact failure mode that hides an outage.

test("parsePause: a real pause parses", () => {
  const p = parsePause(JSON.stringify({ until: "2026-09-05T09:00:00Z", reason: "away" }), NOW);
  assert.equal(p.untilMs, Date.parse("2026-09-05T09:00:00Z"));
  assert.equal(p.reason, "away");
});

test("parsePause: missing reason still pauses, with a placeholder", () => {
  const p = parsePause(JSON.stringify({ until: "2026-09-05T09:00:00Z" }), NOW);
  assert.equal(p.reason, "(no reason given)");
});

test("parsePause: malformed, empty and non-object input do not pause", () => {
  assert.equal(parsePause("{ until: nope", NOW), null);
  assert.equal(parsePause("", NOW), null);
  assert.equal(parsePause("   \n", NOW), null);
  assert.equal(parsePause("null", NOW), null);
  assert.equal(parsePause('[{"until":"2026-09-05T09:00:00Z"}]', NOW), null);
});

test("parsePause: a missing or unparseable until does not pause", () => {
  assert.equal(parsePause(JSON.stringify({ reason: "away" }), NOW), null);
  assert.equal(parsePause(JSON.stringify({ until: "next tuesday" }), NOW), null);
});

// The one that matters most: an unbounded pause is an off switch.
test("parsePause: a pause beyond MAX_PAUSE_HOURS does not pause", () => {
  const far = new Date(NOW + (MAX_PAUSE_HOURS + 1) * H).toISOString();
  assert.equal(parsePause(JSON.stringify({ until: far }), NOW), null);
  assert.equal(parsePause(JSON.stringify({ until: "2099-01-01T00:00:00Z" }), NOW), null);

  const inside = new Date(NOW + (MAX_PAUSE_HOURS - 1) * H).toISOString();
  assert.ok(parsePause(JSON.stringify({ until: inside }), NOW));
});

// --- evaluateHeartbeat ------------------------------------------------------

const fresh = { ms: Date.parse("2026-09-04T09:00:00Z"), station: "00", stamp: "2026-09-04T09:00:00Z" };
const stale = { ms: Date.parse("2026-09-03T12:00:00Z"), station: "00", stamp: "2026-09-03T12:00:00Z" };

test("evaluateHeartbeat: a recent breadcrumb is alive and ok", () => {
  const r = evaluateHeartbeat({ nowMs: NOW, newest: fresh, pause: null });
  assert.equal(r.state, "alive");
  assert.equal(r.ok, true);
});

test("evaluateHeartbeat: nothing for the whole window is silent and NOT ok", () => {
  const r = evaluateHeartbeat({ nowMs: NOW, newest: stale, pause: null });
  assert.equal(r.state, "silent");
  assert.equal(r.ok, false);
});

test("evaluateHeartbeat: the boundary is exclusive", () => {
  const at = { ...fresh, ms: NOW - DEFAULT_THRESHOLD_HOURS * H };
  assert.equal(evaluateHeartbeat({ nowMs: NOW, newest: at, pause: null }).state, "alive");
  const past = { ...fresh, ms: NOW - DEFAULT_THRESHOLD_HOURS * H - 1000 };
  assert.equal(evaluateHeartbeat({ nowMs: NOW, newest: past, pause: null }).state, "silent");
});

// Deliberate, and worth pinning: no breadcrumbs at all means the glob or the path is
// wrong, not that the pipeline is dead. It must never page anyone.
test("evaluateHeartbeat: no breadcrumbs at all is unknown, and is NOT an alarm", () => {
  const r = evaluateHeartbeat({ nowMs: NOW, newest: null, pause: null });
  assert.equal(r.state, "unknown");
  assert.equal(r.ok, true);
});

test("evaluateHeartbeat: a live pause silences a silent pipeline", () => {
  const pause = { untilMs: NOW + 2 * H, reason: "parked" };
  const r = evaluateHeartbeat({ nowMs: NOW, newest: stale, pause });
  assert.equal(r.state, "paused");
  assert.equal(r.ok, true);
  assert.match(r.message, /parked/);
});

test("evaluateHeartbeat: an expired pause silences nothing", () => {
  const pause = { untilMs: NOW - 1, reason: "parked" };
  assert.equal(evaluateHeartbeat({ nowMs: NOW, newest: stale, pause }).state, "silent");
});

test("evaluateHeartbeat: a wider window explains a longer gap", () => {
  assert.equal(
    evaluateHeartbeat({ nowMs: NOW, newest: stale, pause: null, thresholdHours: 48 }).state,
    "alive",
  );
});
