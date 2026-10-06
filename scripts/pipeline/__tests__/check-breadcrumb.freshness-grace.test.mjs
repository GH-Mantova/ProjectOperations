/**
 * FRESHNESS_ONE_CADENCE_V1 — the threshold is cadence + grace, not 2x cadence.
 *
 * Runs with: node --test scripts/pipeline/__tests__/check-breadcrumb.freshness-grace.test.mjs
 * ci.yml runs: node --test "scripts/pipeline/__tests__/*.mjs" on Ubuntu.
 *
 * WHY A PURE FUNCTION. The old threshold lived inline inside main() and could only be
 * exercised through the whole breadcrumb pipeline (git, readdir, Date.now). There was no
 * way to pin the ruling against hard numbers, so the 2x-cadence blind spot sat unseen for
 * weeks — a daily station could skip 09-02 outright and print `40.1h ago (cadence 24h) ok`
 * on 09-03 (recorded in docs/pipeline/stations/00-supervisor.md around line 319). Exporting
 * `freshnessVerdict` is what makes this blind spot a test, not an incident report.
 *
 * The negative control at the bottom is the 2026-09-03 instance: station 05 at ~40 h. The
 * old rule said `ok` (40 < 48). The new rule says `MISSED`. That test is the proof the
 * blind spot is closed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshnessVerdict, CADENCE, GRACE_HOURS } from '../check-breadcrumb.mjs';

// ── premise markers: the exported constants exist and carry the ruling's numbers ─────
test('CADENCE and GRACE_HOURS are exported and name every scheduled station', () => {
  assert.equal(CADENCE['00'], 1,  '00 is hourly');
  assert.equal(CADENCE['02'], null, '02 is dispatch-only');
  assert.equal(CADENCE['03'], 24, '03 is daily');
  assert.equal(CADENCE['04'], 4,  '04 is 4-hourly');
  assert.equal(CADENCE['05'], 24, '05 is daily');
  assert.equal(GRACE_HOURS['00'], 0.5, '00 grace: 30 min');
  assert.equal(GRACE_HOURS['04'], 1,   '04 grace: 1 h');
  assert.equal(GRACE_HOURS['03'], 3,   '03 grace: 3 h');
  assert.equal(GRACE_HOURS['05'], 3,   '05 grace: 3 h');
});

// ── station 03 (daily, cadence 24 + grace 3 = 27) ────────────────────────────────────
test('03 at 26.9 h: ok  (just inside cadence + grace = 27)', () => {
  assert.equal(freshnessVerdict('03', 26.9), 'ok');
});
test('03 at 27.1 h: MISSED  (just past cadence + grace = 27)', () => {
  assert.equal(freshnessVerdict('03', 27.1), 'MISSED');
});

// ── station 00 (hourly, cadence 1 + grace 0.5 = 1.5) ─────────────────────────────────
test('00 at 1.4 h: ok  (just inside cadence + grace = 1.5)', () => {
  assert.equal(freshnessVerdict('00', 1.4), 'ok');
});
test('00 at 1.6 h: MISSED  (just past cadence + grace = 1.5)', () => {
  assert.equal(freshnessVerdict('00', 1.6), 'MISSED');
});

// ── station 04 (4-hourly, cadence 4 + grace 1 = 5) ───────────────────────────────────
test('04 at 5.1 h: MISSED  (just past cadence + grace = 5)', () => {
  assert.equal(freshnessVerdict('04', 5.1), 'MISSED');
});

// ── station 02 is dispatch-only and can never be MISSED ──────────────────────────────
test('02 at any age: dispatch-only, never MISSED', () => {
  assert.equal(freshnessVerdict('02', 0),    'dispatch-only');
  assert.equal(freshnessVerdict('02', 1000), 'dispatch-only');
});

// ── NEGATIVE CONTROL: the 2026-09-03 blind spot. ─────────────────────────────────────
// Station 05 at 40 h: the OLD rule (hrs * 2 = 48) said `ok`. 05 had missed its 09-02
// occurrence outright and printed clean. The NEW rule (24 + 3 = 27) says MISSED. This
// test IS the proof the blind spot is closed — if it ever regresses, the old rule is
// back.
test('05 at 40 h: MISSED  (was `ok` under the old 2x rule — this is the 09-03 blind spot)', () => {
  assert.equal(freshnessVerdict('05', 40), 'MISSED');
});

// ── defensive: an unknown station throws rather than silently reading `ok` ──────────
test('unknown station throws rather than silently returning ok', () => {
  assert.throws(() => freshnessVerdict('99', 0), /unknown station/);
});
