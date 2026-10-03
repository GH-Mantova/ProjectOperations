/**
 * Tests for dispatch.mjs
 *
 * Two git repos in temp dirs: one acting as the "dev tree" (--repo), one as the
 * record worktree (--record-into). The script is invoked via spawnSync so the
 * real exit codes and stdout/stderr are captured.
 *
 * Run with:
 *   node --test "scripts/pipeline/__tests__/dispatch.test.mjs"
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  rmSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const SCRIPT     = join(__dirname, '..', 'dispatch.mjs');

// ---------------------------------------------------------------------------
// Shared temp directories -- one pair per test suite run.
// ---------------------------------------------------------------------------
let devTree  = '';  // acts as --repo
let recTree  = '';  // acts as --record-into
let tempRoot = '';

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(
      'git ' + args.join(' ') + ' in ' + cwd + ' failed (exit ' + r.status + '):\n' +
      (r.stderr || '') + (r.stdout || '')
    );
  }
  return r;
}

function initRepo(root) {
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'user.name', 'test']);
  git(root, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(root, '.seed'), 'seed\n');
  git(root, ['add', '.seed']);
  git(root, ['commit', '-q', '-m', 'seed']);
}

function run(extraArgs) {
  return spawnSync(process.execPath, [SCRIPT, ...extraArgs], { encoding: 'utf8' });
}

before(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'dispatch-test-'));
  devTree  = join(tempRoot, 'dev');
  recTree  = join(tempRoot, 'rec');
  mkdirSync(devTree, { recursive: true });
  mkdirSync(recTree, { recursive: true });
  initRepo(devTree);
  initRepo(recTree);
});

after(() => {
  try { rmSync(tempRoot, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ---------------------------------------------------------------------------
// Case 1: open writes file with all seven front-matter fields; stdout is EXACTLY
// the written path + newline, nothing else. File lives inside record worktree.
// ---------------------------------------------------------------------------
test('open: writes file with all seven front-matter fields; stdout is exact path', () => {
  const result = run([
    'open',
    '--to',          '05',
    '--slug',        'test-finding-one',
    '--finding',     'The API is missing an endpoint',
    '--done-when',   'PR adding the endpoint is merged to main',
    '--from',        'station-04.sweep-0001',
    '--source',      'PR #1234',
    '--record-into', recTree,
    '--repo',        devTree,
  ]);

  assert.equal(result.status, 0, 'exit 0. stderr: ' + result.stderr);

  // Stdout is ONLY the written path (+ newline).
  const writtenPath = result.stdout.trim();
  assert.ok(writtenPath.length > 0, 'stdout must not be empty');
  // No extra lines.
  assert.equal(result.stdout.trim().split('\n').length, 1, 'stdout must be exactly one line');

  // File must exist inside the record worktree.
  assert.equal(existsSync(writtenPath), true, 'written file must exist at stdout path');
  assert.ok(
    writtenPath.startsWith(recTree),
    'written path must be inside record worktree. Got: ' + writtenPath
  );
  assert.ok(
    writtenPath.includes('docs/pipeline/dispatched') || writtenPath.includes('docs\\pipeline\\dispatched'),
    'written path must be under docs/pipeline/dispatched'
  );
  assert.ok(writtenPath.endsWith('-05-test-finding-one.md'), 'filename must encode to/slug');

  // Check all seven front-matter fields.
  const content = readFileSync(writtenPath, 'utf8');
  assert.match(content, /^id: .+-05-test-finding-one$/m,          'front-matter: id');
  assert.match(content, /^from: station-04\.sweep-0001$/m,         'front-matter: from');
  assert.match(content, /^to: 05$/m,                               'front-matter: to');
  assert.match(content, /^opened_at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m, 'front-matter: opened_at');
  assert.match(content, /^finding: The API is missing an endpoint$/m, 'front-matter: finding');
  assert.match(content, /^done_when: PR adding the endpoint is merged to main$/m, 'front-matter: done_when');
  assert.match(content, /^source: PR #1234$/m,                     'front-matter: source');
});

// ---------------------------------------------------------------------------
// Case 2: close moves file to closed/ and content has all three closed-* fields;
// original path is gone.
// ---------------------------------------------------------------------------
test('close: moves file to closed/ with three extra fields; original gone', () => {
  // Open a dispatch first.
  const openResult = run([
    'open',
    '--to',          '03',
    '--slug',        'close-test',
    '--finding',     'Something needs fixing',
    '--done-when',   'Fix is merged',
    '--from',        'station-04.sweep-0002',
    '--source',      'breadcrumb.md',
    '--record-into', recTree,
    '--repo',        devTree,
  ]);
  assert.equal(openResult.status, 0, 'open must succeed. stderr: ' + openResult.stderr);
  const openPath = openResult.stdout.trim();

  // Extract the id from the filename.
  const filename = openPath.split(/[/\\]/).pop();
  const idArg = filename.replace(/\.md$/, '');

  const closeResult = run([
    'close',
    '--id',          idArg,
    '--by',          'station-03.sweep-0010',
    '--evidence',    'PR #5678 merged; artifact confirmed on main',
    '--record-into', recTree,
    '--repo',        devTree,
  ]);
  assert.equal(closeResult.status, 0, 'close must succeed. stderr: ' + closeResult.stderr);

  const closedPath = closeResult.stdout.trim();

  // Original open path must be gone.
  assert.equal(existsSync(openPath), false, 'original open path must be deleted');

  // Closed path must exist.
  assert.equal(existsSync(closedPath), true, 'closed file must exist');
  assert.ok(
    closedPath.includes('dispatched/closed') || closedPath.includes('dispatched\\closed'),
    'closed path must be under dispatched/closed'
  );

  // Closed content must have all three extra fields.
  const content = readFileSync(closedPath, 'utf8');
  assert.match(content, /^closed_at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m, 'closed_at field');
  assert.match(content, /^closed_by: station-03\.sweep-0010$/m,                 'closed_by field');
  assert.match(content, /^evidence: PR #5678 merged; artifact confirmed on main$/m, 'evidence field');

  // Original seven fields must also be preserved.
  assert.match(content, /^finding: Something needs fixing$/m, 'original finding preserved');
});

// ---------------------------------------------------------------------------
// Case 3: list returns three dispatches oldest first with age in days.
// ---------------------------------------------------------------------------
test('list: returns open dispatches oldest first with age in days', () => {
  // Use a fresh record tree to avoid interference from earlier tests.
  const localRec = mkdtempSync(join(tmpdir(), 'dispatch-list-test-'));
  initRepo(localRec);

  const dispDir = join(localRec, 'docs', 'pipeline', 'dispatched');
  mkdirSync(dispDir, { recursive: true });

  // Three dispatches with different opened_at dates.
  const day1 = '2026-01-01T10:00:00Z';
  const day2 = '2026-06-15T12:00:00Z';
  const day3 = '2026-09-30T08:00:00Z';

  writeFileSync(join(dispDir, '2026-01-01-05-oldest.md'), [
    '---',
    'id: 2026-01-01-05-oldest',
    'from: station-04.test',
    'to: 05',
    'opened_at: ' + day1,
    'finding: oldest finding',
    'done_when: fix it',
    'source: breadcrumb.md',
    '---',
    '',
  ].join('\n'), 'utf8');

  writeFileSync(join(dispDir, '2026-06-15-03-middle.md'), [
    '---',
    'id: 2026-06-15-03-middle',
    'from: station-04.test',
    'to: 03',
    'opened_at: ' + day2,
    'finding: middle finding',
    'done_when: fix it too',
    'source: breadcrumb.md',
    '---',
    '',
  ].join('\n'), 'utf8');

  writeFileSync(join(dispDir, '2026-09-30-01-newest.md'), [
    '---',
    'id: 2026-09-30-01-newest',
    'from: station-04.test',
    'to: 01',
    'opened_at: ' + day3,
    'finding: newest finding',
    'done_when: fix it last',
    'source: breadcrumb.md',
    '---',
    '',
  ].join('\n'), 'utf8');

  const result = run(['list', '--repo', localRec]);
  assert.equal(result.status, 0, 'list must succeed. stderr: ' + result.stderr);

  const lines = result.stdout.trim().split('\n').filter(Boolean);
  assert.equal(lines.length, 3, 'must return three lines');

  // Oldest first.
  assert.ok(lines[0].startsWith('2026-01-01-05-oldest'), 'first line is oldest');
  assert.ok(lines[1].startsWith('2026-06-15-03-middle'), 'second line is middle');
  assert.ok(lines[2].startsWith('2026-09-30-01-newest'), 'third line is newest');

  // Each line has age in days.
  assert.match(lines[0], /\tage=\d+d\t/, 'first line has age');
  assert.match(lines[1], /\tage=\d+d\t/, 'second line has age');
  assert.match(lines[2], /\tage=\d+d\t/, 'third line has age');

  // Oldest should have larger age.
  const ageOf = (line) => parseInt(line.match(/age=(\d+)d/)[1], 10);
  assert.ok(ageOf(lines[0]) > ageOf(lines[2]), 'oldest has larger age than newest');

  // Each line has finding.
  assert.match(lines[0], /finding=oldest finding$/, 'first line has finding');

  try { rmSync(localRec, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ---------------------------------------------------------------------------
// Case 4: --record-into resolving to same realpath as --repo is refused.
// ---------------------------------------------------------------------------
test('refuses when --record-into equals --repo (same realpath)', () => {
  const result = run([
    'open',
    '--to',          '05',
    '--slug',        'same-tree-test',
    '--finding',     'Some finding',
    '--done-when',   'Some done-when',
    '--from',        'station-04',
    '--source',      'breadcrumb.md',
    '--record-into', devTree,   // <-- same as --repo
    '--repo',        devTree,
  ]);

  assert.notEqual(result.status, 0, 'must exit non-zero');
  assert.match(result.stderr, /same path|FF-blocker|dev tree/i, 'stderr describes the same-path error');

  // Nothing written.
  const dispDir = join(devTree, 'docs', 'pipeline', 'dispatched');
  if (existsSync(dispDir)) {
    const files = readdirSync(dispDir).filter((f) => f.endsWith('.md'));
    assert.equal(files.length, 0, 'no dispatch files must be written');
  }
});

// ---------------------------------------------------------------------------
// Case 5a: duplicate open with same date+to+slug is refused.
// Case 5b: close with unknown id is refused.
// ---------------------------------------------------------------------------
test('5a: duplicate open is refused (exit 1)', () => {
  // Open once successfully.
  const firstResult = run([
    'open',
    '--to',          '02',
    '--slug',        'dup-test',
    '--finding',     'First finding',
    '--done-when',   'First done-when',
    '--from',        'station-04',
    '--source',      'breadcrumb.md',
    '--record-into', recTree,
    '--repo',        devTree,
  ]);
  assert.equal(firstResult.status, 0, 'first open must succeed. stderr: ' + firstResult.stderr);

  // Try to open again with same slug -- same date means same id.
  const secondResult = run([
    'open',
    '--to',          '02',
    '--slug',        'dup-test',
    '--finding',     'Duplicate finding',
    '--done-when',   'Duplicate done-when',
    '--from',        'station-04',
    '--source',      'breadcrumb.md',
    '--record-into', recTree,
    '--repo',        devTree,
  ]);

  assert.equal(secondResult.status, 1, 'second open must fail with exit 1');
  assert.match(secondResult.stderr, /duplicate|already exists/i, 'stderr mentions duplicate');
});

test('5b: close with unknown id is refused (exit 1)', () => {
  const result = run([
    'close',
    '--id',          'totally-unknown-id',
    '--by',          'station-03',
    '--evidence',    'Some evidence',
    '--record-into', recTree,
    '--repo',        devTree,
  ]);

  assert.equal(result.status, 1, 'must exit 1 for unknown id');
  assert.match(result.stderr, /not an open dispatch|does not exist|not currently open/i, 'stderr describes missing id');
});

// ---------------------------------------------------------------------------
// Case 6: close with empty --evidence is refused AND nothing moves.
// ---------------------------------------------------------------------------
test('close with empty --evidence refused; source untouched', () => {
  // Open a dispatch to have something to try closing.
  const openResult = run([
    'open',
    '--to',          '05',
    '--slug',        'empty-evidence-test',
    '--finding',     'Some finding',
    '--done-when',   'Some done-when',
    '--from',        'station-04',
    '--source',      'breadcrumb.md',
    '--record-into', recTree,
    '--repo',        devTree,
  ]);
  assert.equal(openResult.status, 0, 'open must succeed. stderr: ' + openResult.stderr);

  const openPath = openResult.stdout.trim();
  const filename = openPath.split(/[/\\]/).pop();
  const idArg = filename.replace(/\.md$/, '');

  // Try to close with empty evidence.
  const closeResult = run([
    'close',
    '--id',          idArg,
    '--by',          'station-05',
    '--evidence',    '   ',   // whitespace-only
    '--record-into', recTree,
    '--repo',        devTree,
  ]);

  assert.equal(closeResult.status, 1, 'must exit 1 for empty evidence');
  assert.match(closeResult.stderr, /evidence/i, 'stderr mentions evidence');

  // Source must still be at the open location.
  assert.equal(existsSync(openPath), true, 'source file must still exist after refused close');

  // Closed file must NOT exist.
  const dispDir = join(recTree, 'docs', 'pipeline', 'dispatched');
  const closedPath = join(dispDir, 'closed', idArg + '.md');
  assert.equal(existsSync(closedPath), false, 'closed file must NOT exist after refused close');
});
