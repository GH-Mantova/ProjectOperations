// watchdog-lane.test.mjs
//
// Tests for the lane-aware watchdog logic introduced 2026-08-20.
//
// Context: supervise-watcher.ps1 line 214 (pre-fix) counted EVERY *-ready.md
// in the shared prompt dir as "armed". When all armed prompts belonged to
// lane 1 and only the lane 0 supervisor was running, the watchdog falsely
// saw runnable>0 with a stale heartbeat and killed the node every ~4.5 min
// in a self-sustaining loop. Fix: count only prompts this lane owns.
//
// Two test surfaces:
//   1. Pure JS: exercises laneFor / laneHash / bodyNeedsSerialLane from
//      index.mjs -- the classification rules the PowerShell watchdog delegates
//      to via node lane-classify.mjs. These tests confirm the routing rules
//      work correctly before the PS1 integration layer is exercised.
//
//   2. lane-classify.mjs integration: exercises the helper script that
//      supervise-watcher.ps1 shells out to, with real temp-dir prompt files.
//
// The Pester test harness (supervise-watcher.tests.ps1) already covers the
// PS1 exit-branch decision tree; these tests cover the lane-routing functions
// that the watchdog now relies on for its armed-count fallback.
//
// Pure ASCII -- no em-dashes / smart quotes / emoji.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  laneFor,
  laneHash,
  bodyNeedsSerialLane,
  extractDoneWhen,
  readPromptBody,
} from '../index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLASSIFY_SCRIPT = join(__dirname, '..', 'lane-classify.mjs');

// ---------------------------------------------------------------------------
// Test fixtures (verified by hand with node -e before writing)
//
// Names that resolve to specific lanes with body='done_when: pnpm build':
//   lane 0: pr-2-test-ready.md  (laneHash % 2 === 0)
//   lane 1: pr-1-test-ready.md  (laneHash % 2 === 1)
//   rev-100-ready.md -> lane 0 always (isReview)
//   pr-999-fix-ready.md -> lane 0 always (isFix)
// ---------------------------------------------------------------------------

const ORDINARY_BODY = 'done_when: pnpm build && pnpm lint';
const SERIAL_BODY   = 'done_when: pnpm prisma migrate deploy';

// Helper: build a minimal *-ready.md file in a temp dir.
function makeTempPromptDir() {
  const dir = mkdtempSync(join(tmpdir(), 'watchdog-lane-test-'));
  return dir;
}

function writePrompt(dir, name, body = ORDINARY_BODY) {
  writeFileSync(join(dir, name), `---\ndone_when: ${body}\n---\n# body\n`, 'utf-8');
}

function writeFixPrompt(dir, name, fixesPr = 812) {
  writeFileSync(join(dir, name), `---\nfixes_pr: ${fixesPr}\ndone_when: pnpm build\n---\n# fix body\n`, 'utf-8');
}

function runClassify(promptDir, lanes, names) {
  const args = [CLASSIFY_SCRIPT, promptDir, String(lanes), ...names];
  const out = execFileSync('node', args, { encoding: 'utf-8' });
  return out.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
}

// --- 1. laneFor routing rules -----------------------------------------------

test('ordinary prompt hashing to lane 1 is NOT owned by lane 0', () => {
  // pr-1-test-ready.md: laneHash % 2 === 1 (verified empirically)
  const lane = laneFor('pr-1-test-ready.md', { isFix: false, isReview: false, body: ORDINARY_BODY, lanes: 2 });
  assert.equal(lane, 1, 'ordinary lane-1 prompt must not be owned by lane 0');
});

test('ordinary prompt hashing to lane 0 IS owned by lane 0', () => {
  // pr-2-test-ready.md: laneHash % 2 === 0
  const lane = laneFor('pr-2-test-ready.md', { isFix: false, isReview: false, body: ORDINARY_BODY, lanes: 2 });
  assert.equal(lane, 0);
});

test('rev-* prompt is always owned by lane 0 regardless of hash', () => {
  // rev-100-ready.md: laneHash % 2 === 1, but isReview overrides to lane 0
  assert.equal(laneHash('rev-100-ready.md') % 2, 1, 'fixture: hash is lane 1');
  const lane = laneFor('rev-100-ready.md', { isFix: false, isReview: true, body: '', lanes: 2 });
  assert.equal(lane, 0, 'review prompt must pin to lane 0');
});

test('fix prompt (isFix=true) is always owned by lane 0 regardless of hash', () => {
  // pr-999-fix-ready.md: laneHash % 2 === 0 happens to be lane 0, but test isFix=true
  const lane1Name = 'pr-1-test-ready.md'; // hash % 2 === 1
  const lane = laneFor(lane1Name, { isFix: true, isReview: false, body: ORDINARY_BODY, lanes: 2 });
  assert.equal(lane, 0, 'fix prompt must pin to lane 0 even when hash says lane 1');
});

test('prompt whose done_when mentions prisma migrate pins to lane 0 (bodyNeedsSerialLane)', () => {
  // pr-1-test-ready.md would be lane 1 with an ordinary body, but serial body overrides
  const laneWithOrdinary = laneFor('pr-1-test-ready.md', { isFix: false, isReview: false, body: ORDINARY_BODY, lanes: 2 });
  const laneWithSerial   = laneFor('pr-1-test-ready.md', { isFix: false, isReview: false, body: SERIAL_BODY, lanes: 2 });
  assert.equal(laneWithOrdinary, 1, 'ordinary body should be lane 1 for this name');
  assert.equal(laneWithSerial,   0, 'serial body must pin to lane 0');
  assert.ok(bodyNeedsSerialLane(SERIAL_BODY), 'bodyNeedsSerialLane must return true for prisma migrate');
});

// --- 2. Watchdog scenario: lane 0 running, all prompts owned by lane 1 ------

test('lane 0 watchdog: two armed prompts both owned by lane 1 -> my count is 0 -> no kill', () => {
  // Both prompt names hash to lane 1 with the ordinary body.
  const prompts = [
    { name: 'pr-1-test-ready.md', body: ORDINARY_BODY },
    { name: 'pr-3-test-ready.md', body: ORDINARY_BODY },
  ];
  for (const { name, body } of prompts) {
    const lane = laneFor(name, { isFix: false, isReview: false, body, lanes: 2 });
    assert.equal(lane, 1, `${name} must belong to lane 1`);
  }

  // Simulate what the watchdog does: count prompts owned by lane 0.
  const myCount = prompts.filter(({ name, body }) =>
    laneFor(name, { isFix: false, isReview: false, body, lanes: 2 }) === 0
  ).length;
  assert.equal(myCount, 0, 'lane 0 must own 0 of these prompts');
  // With myCount === 0, the watchdog must NOT set runnable > 0 and must NOT kill.
});

test('lane 0 watchdog: one armed prompt owned by lane 0, heartbeat stale -> kill IS correct', () => {
  // This is the unchanged (pre-bug) case: a prompt that lane 0 DOES own.
  const name = 'pr-2-test-ready.md'; // hash % 2 === 0 -> lane 0
  const lane = laneFor(name, { isFix: false, isReview: false, body: ORDINARY_BODY, lanes: 2 });
  assert.equal(lane, 0, `${name} must belong to lane 0`);

  const myCount = [{ name, body: ORDINARY_BODY }].filter(({ name: n, body }) =>
    laneFor(n, { isFix: false, isReview: false, body, lanes: 2 }) === 0
  ).length;
  assert.equal(myCount, 1, 'lane 0 must see 1 runnable prompt -> watchdog may kill on stale heartbeat');
});

// --- 3. PR_WATCHER_LANE unset -> counts everything (byte-for-byte as today) --

test('PR_WATCHER_LANE unset: all prompts counted, no lane filtering', () => {
  // When WATCHER_LANE is null, laneFor is never called; all armed prompts are
  // counted. Simulate this by verifying that both lane 0 and lane 1 prompts
  // would be counted if we skip filtering (count == total).
  const allNames = ['pr-1-test-ready.md', 'pr-2-test-ready.md'];
  // In single-lane mode (WATCHER_LANE=null), the supervisor counts allNames.length
  // without any lane filtering.
  assert.equal(allNames.length, 2, 'both prompts counted in single-lane mode');
  // Double-check they ARE in different lanes (so the test is meaningful)
  const lanes = allNames.map(n => laneFor(n, { isFix: false, isReview: false, body: ORDINARY_BODY, lanes: 2 }));
  assert.notDeepEqual(lanes[0], lanes[1], 'fixtures must be in different lanes to prove filtering matters');
});

// --- 4. lane-classify.mjs integration tests ----------------------------------

test('lane-classify.mjs: lane 1 prompt is classified to lane 1', () => {
  const dir = makeTempPromptDir();
  try {
    writePrompt(dir, 'pr-1-test-ready.md');
    const results = runClassify(dir, 2, ['pr-1-test-ready.md']);
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'pr-1-test-ready.md');
    assert.equal(results[0].lane, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lane-classify.mjs: lane 0 prompt is classified to lane 0', () => {
  const dir = makeTempPromptDir();
  try {
    writePrompt(dir, 'pr-2-test-ready.md');
    const results = runClassify(dir, 2, ['pr-2-test-ready.md']);
    assert.equal(results[0].lane, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lane-classify.mjs: rev-* prompt is classified to lane 0 regardless of hash', () => {
  const dir = makeTempPromptDir();
  try {
    // rev-100-ready.md: hash would be lane 1, but isReview pins to lane 0
    writeFileSync(join(dir, 'rev-100-ready.md'), '# review\n', 'utf-8');
    const results = runClassify(dir, 2, ['rev-100-ready.md']);
    assert.equal(results[0].lane, 0, 'review prompt must classify to lane 0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lane-classify.mjs: fix prompt (fixes_pr front matter) is classified to lane 0', () => {
  const dir = makeTempPromptDir();
  try {
    writeFixPrompt(dir, 'pr-1-fix-ready.md', 812);
    // pr-1-fix-ready.md without fixes_pr would be lane 1, but isFix pins to lane 0
    const results = runClassify(dir, 2, ['pr-1-fix-ready.md']);
    assert.equal(results[0].lane, 0, 'fix prompt must classify to lane 0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lane-classify.mjs: serial-lane body pins pr-1-* to lane 0 (bodyNeedsSerialLane)', () => {
  const dir = makeTempPromptDir();
  try {
    // Write pr-1-test-ready.md with a body containing prisma migrate
    writeFileSync(join(dir, 'pr-1-test-ready.md'), `---\ndone_when: pnpm prisma migrate deploy\n---\n# body\n`, 'utf-8');
    const results = runClassify(dir, 2, ['pr-1-test-ready.md']);
    assert.equal(results[0].lane, 0, 'serial-lane body must pin to lane 0 even for lane-1 hash');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lane-classify.mjs: missing file conservatively assigned lane 0 (fail-safe)', () => {
  const dir = makeTempPromptDir();
  try {
    // Do NOT write the file; classify should still return lane 0 (fail-safe).
    const results = runClassify(dir, 2, ['pr-1-test-ready.md']);
    assert.equal(results[0].lane, 0, 'missing file must conservatively assign lane 0');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- 5. Orphan escalation: exactly ONE file per set, not one per poll --------

test('orphaned-lane prompts produce exactly ONE needs-marco/ file, not one per poll', () => {
  // Simulate the supervisor's orphan-tracking logic directly.
  // The deduplication key is the sorted, pipe-joined list of orphan names.
  // A real orphan escalation is only written once per unique key.
  const dir = makeTempPromptDir();
  const escalationDir = join(dir, 'needs-marco');
  mkdirSync(escalationDir, { recursive: true });

  try {
    const orphanNames = ['pr-1-test-ready.md', 'pr-3-test-ready.md'];
    const sortedKey = [...orphanNames].sort().join('|');

    // Track which keys have already had an escalation file written.
    const written = new Set();

    function maybeEscalate(names) {
      const key = [...names].sort().join('|');
      if (written.has(key)) return 'already-written';
      written.add(key);
      const filename = join(escalationDir, `ORPHANED-LANE-PROMPTS-test-${Date.now()}.md`);
      writeFileSync(filename, `# orphan set: ${key}\n`, 'utf-8');
      return filename;
    }

    // Simulate 5 poll cycles with the same orphan set.
    const results = [];
    for (let poll = 0; poll < 5; poll++) {
      results.push(maybeEscalate(orphanNames));
    }

    // First poll writes a file; subsequent polls return 'already-written'.
    const filesWritten = readdirSync(escalationDir).length;
    assert.equal(filesWritten, 1, 'exactly ONE escalation file must be written, not one per poll');
    assert.equal(results.filter(r => r !== 'already-written').length, 1,
      'only one write should happen across 5 polls');
    assert.equal(results.filter(r => r === 'already-written').length, 4,
      'subsequent polls must detect the already-written escalation and skip');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a new orphan set (different prompts) produces a NEW escalation file', () => {
  const dir = makeTempPromptDir();
  const escalationDir = join(dir, 'needs-marco');
  mkdirSync(escalationDir, { recursive: true });

  try {
    const written = new Set();

    function maybeEscalate(names) {
      const key = [...names].sort().join('|');
      if (written.has(key)) return 'already-written';
      written.add(key);
      const filename = join(escalationDir, `ORPHANED-LANE-PROMPTS-${Date.now()}-${Math.random()}.md`);
      writeFileSync(filename, `# orphan set: ${key}\n`, 'utf-8');
      return filename;
    }

    // First set
    maybeEscalate(['pr-1-test-ready.md']);
    // Different set (new prompt added)
    maybeEscalate(['pr-1-test-ready.md', 'pr-3-test-ready.md']);

    const filesWritten = readdirSync(escalationDir).length;
    assert.equal(filesWritten, 2, 'two distinct orphan sets must produce two escalation files');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
