/**
 * Tests for the check-breadcrumb.mjs gitignored-sink gate.
 *
 * Runs with: node --test scripts/pipeline/__tests__/check-breadcrumb.gitignored-sink.test.mjs
 *
 * The gate exists to catch station breadcrumbs that route findings into a gitignored
 * file — which is silently invisible to reviewers. Before this test file existed, the
 * gate rejected on ANY mention of the path whose text lacked "gitignor" within +/-200
 * characters. That punished breadcrumbs that were legitimately DISCUSSING a gitignored
 * dead-fallback, which is the class of finding the gate exists to encourage.
 *
 * The gate now tests the routing DESTINATION: a fail requires a routing verb before
 * the path AND no "gitignored" note in the surrounding window. The escape hatch is
 * kept intact — a mention accompanied by "gitignored" always passes.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ROUTING_VERBS, checkGitignoredSink } from '../check-breadcrumb.mjs';

// ── the ROUTING_VERBS constant is the premise marker ─────────────────────────
test('ROUTING_VERBS is exported and matches routing constructions', () => {
  assert.ok(ROUTING_VERBS instanceof RegExp, 'ROUTING_VERBS must be a RegExp');
  assert.ok(ROUTING_VERBS.test('Findings are written to '), 'written to');
  assert.ok(ROUTING_VERBS.test('Report it into '), 'report ... into');
  assert.ok(ROUTING_VERBS.test('Logged findings to '), 'logged findings to');
  assert.ok(ROUTING_VERBS.test('appended the record to '), 'appended the record to');
});

// ── measured false positives — MUST FAIL ─────────────────────────────────────
test('FAIL: findings written to a gitignored path (no gitignore note)', () => {
  const text = 'Findings are written to docs/qa/qa-findings.md.';
  const fails = checkGitignoredSink(text);
  assert.equal(fails.length, 1, `expected 1 fail, got ${fails.length}: ${JSON.stringify(fails)}`);
  assert.match(fails[0], /routes findings to `docs\/qa\/qa-findings\.md`, which is gitignored/);
});

test('FAIL: report routed into gitignored checklist (no gitignore note)', () => {
  const text = 'Report it into docs/qa/qa-checklist.md and move on.';
  const fails = checkGitignoredSink(text);
  assert.equal(fails.length, 1, `expected 1 fail, got ${fails.length}: ${JSON.stringify(fails)}`);
  assert.match(fails[0], /routes findings to `docs\/qa\/qa-checklist\.md`, which is gitignored/);
});

// ── measured false positive that the old gate wrongly rejected — MUST PASS ──
test('PASS: prose that discusses a gitignored path without routing into it', () => {
  // Quoted verbatim from the 0617 instruction-drift breadcrumb (the false positive
  // the old proximity window rejected because the nearest "gitignored" was ~250
  // characters away). It mentions the path as a topic, not a destination.
  const text = 'becomes urgent the first time a scanner runs where docs/qa/qa-checklist.md is absent';
  const fails = checkGitignoredSink(text);
  assert.deepEqual(fails, [], `expected clean, got: ${JSON.stringify(fails)}`);
});

// ── escape hatch preserved — MUST PASS ───────────────────────────────────────
test('PASS: gitignore note in the surrounding window (escape hatch intact)', () => {
  // The old positive control: a mention accompanied by "gitignored" nearby. Keeps
  // passing so nothing that admitted under the old rule starts failing under the new.
  const text = 'Findings are written to docs/qa/qa-findings.md and it is gitignored (`.gitignore:106`).';
  const fails = checkGitignoredSink(text);
  assert.deepEqual(fails, [], `expected clean, got: ${JSON.stringify(fails)}`);
});

test('PASS: gitignore note within window, even with a routing verb preceding', () => {
  // Rule (2) from the prompt: "A line that says the path is gitignored still passes
  // even if a routing verb happens to precede it."
  const text = 'The station used to write findings to docs/qa/qa-findings.md, which is gitignored.';
  const fails = checkGitignoredSink(text);
  assert.deepEqual(fails, [], `expected clean, got: ${JSON.stringify(fails)}`);
});

// ── extra coverage: multiple occurrences, mixed dispositions ────────────────
test('reports every routed occurrence, not just the first', () => {
  const text = [
    'Findings are written to docs/qa/qa-findings.md.',
    'And a second finding is logged to docs/qa/qa-findings.md.',
  ].join('\n');
  const fails = checkGitignoredSink(text);
  assert.equal(fails.length, 2, `expected 2 fails, got ${fails.length}: ${JSON.stringify(fails)}`);
});

test('handles both gitignored paths independently', () => {
  const text = [
    'Findings are written to docs/qa/qa-findings.md.',
    'And routed into docs/qa/qa-checklist.md too.',
  ].join('\n');
  const fails = checkGitignoredSink(text);
  assert.equal(fails.length, 2, `expected 2 fails, got ${fails.length}: ${JSON.stringify(fails)}`);
  assert.ok(fails.some((f) => f.includes('qa-findings.md')), 'includes findings');
  assert.ok(fails.some((f) => f.includes('qa-checklist.md')), 'includes checklist');
});

test('empty text produces no fails', () => {
  assert.deepEqual(checkGitignoredSink(''), []);
});

test('a bare markdown link to the path is not a routing act', () => {
  // Common shape in station docs: linking to a doc for discussion, not writing to it.
  const text = 'See [the checklist](docs/qa/qa-checklist.md) for prior findings.';
  const fails = checkGitignoredSink(text);
  assert.deepEqual(fails, [], `expected clean, got: ${JSON.stringify(fails)}`);
});
