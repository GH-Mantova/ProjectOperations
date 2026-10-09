/**
 * Tests for marco-queue.mjs — MARCO_QUEUE_LINE_V1.
 *
 *   node --test scripts/pipeline/__tests__/marco-queue.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { marcoQueue, formatLines } from '../marco-queue.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const CLI = join(REPO_ROOT, 'scripts', 'pipeline', 'marco-queue.mjs');
const SWEEP = join(REPO_ROOT, 'scripts', 'pipeline', 'status-sweep.ps1');

const DNM = { name: 'do-not-merge' };
const NOW = '2026-10-06T12:00:00Z';

function pr({ number, hoursAgo, isDraft = false, labels = [] }) {
  const createdMs = Date.parse(NOW) - hoursAgo * 3_600_000;
  return { number, isDraft, labels, createdAt: new Date(createdMs).toISOString() };
}

function runCli(args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function withTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'marco-queue-'));
  const file = join(dir, 'prs.json');
  return fn(file);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Three PRs: labelled do-not-merge (oldest), unlabelled, draft labelled.
//    Expect waiting 1, open 2, right oldest in each.
// ─────────────────────────────────────────────────────────────────────────────
test('counts waiting and open with mixed labels/drafts', () => {
  const prs = [
    pr({ number: 100, hoursAgo: 10, labels: [DNM] }),          // waiting + open, oldest in both
    pr({ number: 101, hoursAgo: 3 }),                           // open only
    pr({ number: 102, hoursAgo: 20, isDraft: true, labels: [DNM] }), // draft — excluded
  ];
  const r = marcoQueue(prs, NOW);
  assert.equal(r.waiting.count, 1);
  assert.deepEqual(r.waiting.oldest, { number: 100, hours: 10 });
  assert.equal(r.open.count, 2);
  assert.deepEqual(r.open.oldest, { number: 100, hours: 10 });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Labelled PR is NOT the oldest overall: waiting.oldest is the oldest LABELLED PR,
//    open.oldest is a different, older PR.
// ─────────────────────────────────────────────────────────────────────────────
test('waiting.oldest is the oldest labelled PR, not the oldest overall', () => {
  const prs = [
    pr({ number: 200, hoursAgo: 50 }),                 // oldest overall, unlabelled
    pr({ number: 201, hoursAgo: 10, labels: [DNM] }),  // oldest labelled
    pr({ number: 202, hoursAgo: 5, labels: [DNM] }),
  ];
  const r = marcoQueue(prs, NOW);
  assert.deepEqual(r.waiting.oldest, { number: 201, hours: 10 });
  assert.deepEqual(r.open.oldest, { number: 200, hours: 50 });
  assert.equal(r.waiting.count, 2);
  assert.equal(r.open.count, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Empty array: both counts 0, both oldest null; CLI prints the no-oldest line.
// ─────────────────────────────────────────────────────────────────────────────
test('empty input gives zero counts and null oldest, CLI prints no-oldest line', () => {
  const r = marcoQueue([], NOW);
  assert.equal(r.waiting.count, 0);
  assert.equal(r.waiting.oldest, null);
  assert.equal(r.open.count, 0);
  assert.equal(r.open.oldest, null);

  const [w, o] = formatLines(r);
  assert.equal(w, 'WAITING ON MARCO: 0 open PR(s) labelled do-not-merge');
  assert.equal(o, 'ALL OPEN (non-draft): 0');
  assert.ok(!/open \d+h/.test(w), 'empty waiting line must not carry an oldest clause');
  assert.ok(!/open \d+h/.test(o), 'empty open line must not carry an oldest clause');

  withTmp((file) => {
    writeFileSync(file, '[]', 'utf8');
    const r2 = runCli(['--now', NOW, '--file', file]);
    assert.equal(r2.status, 0);
    assert.ok(r2.stdout.includes('WAITING ON MARCO: 0 open PR(s) labelled do-not-merge'));
    assert.ok(r2.stdout.includes('ALL OPEN (non-draft): 0'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Hours round DOWN: 5h59m reads 5h.
// ─────────────────────────────────────────────────────────────────────────────
test('hours round down: 5h59m -> 5h', () => {
  const nearlySix = Date.parse(NOW) - (5 * 60 + 59) * 60_000;
  const prs = [{
    number: 300,
    isDraft: false,
    labels: [DNM],
    createdAt: new Date(nearlySix).toISOString(),
  }];
  const r = marcoQueue(prs, NOW);
  assert.equal(r.waiting.oldest.hours, 5);
  assert.equal(r.open.oldest.hours, 5);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Non-array input throws; CLI prints [CANNOT MEASURE], exits 2, no zero count.
// ─────────────────────────────────────────────────────────────────────────────
test('non-array input throws; CLI exits 2 with [CANNOT MEASURE] and no zero count', () => {
  assert.throws(() => marcoQueue({ not: 'an array' }, NOW), /must be an array/);
  assert.throws(() => marcoQueue(null, NOW), /must be an array/);

  withTmp((file) => {
    writeFileSync(file, '{"not":"an array"}', 'utf8');
    const r = runCli(['--now', NOW, '--file', file]);
    assert.equal(r.status, 2);
    assert.ok(r.stdout.includes('[CANNOT MEASURE]'), `expected CANNOT MEASURE, got: ${r.stdout}`);
    // The failure line must NOT carry a "0 open PR(s)" count — zero and unknown differ.
    assert.ok(!/\b0 open PR\(s\)/.test(r.stdout), `must not print a 0 count on failure: ${r.stdout}`);
    assert.ok(!/ALL OPEN \(non-draft\): 0/.test(r.stdout), `must not print ALL OPEN: 0 on failure: ${r.stdout}`);
  });

  // Unreadable file is also [CANNOT MEASURE] + exit 2.
  const r = runCli(['--now', NOW, '--file', join(tmpdir(), 'no-such-file-marco-queue.json')]);
  assert.equal(r.status, 2);
  assert.ok(r.stdout.includes('[CANNOT MEASURE]'));
  assert.ok(!/ALL OPEN \(non-draft\): 0/.test(r.stdout));
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Source check: status-sweep.ps1 calls marco-queue.mjs in section 1 and no
//    MARCO_QUEUE text appears in section 7.
// ─────────────────────────────────────────────────────────────────────────────
test('status-sweep.ps1 calls marco-queue.mjs in section 1 only, never from section 7', () => {
  const text = readFileSync(SWEEP, 'utf8');
  const s1 = text.indexOf('Section "1.');
  const s2 = text.indexOf('Section "2.');
  const s7 = text.indexOf('Section "7.');
  assert.ok(s1 >= 0 && s2 > s1 && s7 > s2, 'section markers must be present and ordered');

  const section1 = text.slice(s1, s2);
  const section7 = text.slice(s7);

  assert.ok(/marco-queue\.mjs/.test(section1), 'section 1 must invoke marco-queue.mjs');
  assert.ok(!/MARCO_QUEUE|marco-queue/.test(section7),
    'section 7 (VERDICT) must NOT reference marco-queue — the figures never gate the verdict');
});
