/**
 * Tests for retire-escalation.mjs
 *
 * Two git repos in temp dirs: one acting as the "dev tree" (--repo), one as the
 * record worktree (--record-into). The script is invoked via spawnSync so the
 * real exit codes and stdout/stderr are captured.
 *
 * Run with:
 *   node --test "scripts/pipeline/__tests__/retire-escalation.test.mjs"
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
  mkdirSync as _mkdirSync,
  writeFileSync as _writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const SCRIPT     = join(__dirname, '..', 'retire-escalation.mjs');

// ---------------------------------------------------------------------------
// Shared temp directories -- one pair per test suite run.
// ---------------------------------------------------------------------------
let devTree    = '';  // acts as --repo
let recTree    = '';  // acts as --record-into
let tempRoot   = '';

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

function makeNeedsMarcoDir(root) {
  const dir = join(root, 'docs', 'pr-prompts', 'needs-marco');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeEscalation(nmDir, name = 'my-escalation.md', heading = 'The Escalation Title') {
  const p = join(nmDir, name);
  writeFileSync(p, '# ' + heading + '\n\nBody text.\n');
  return p;
}

function run(extraArgs) {
  const result = spawnSync(
    process.execPath,
    [SCRIPT, ...extraArgs],
    { encoding: 'utf8' }
  );
  return result;
}

before(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'retire-esc-test-'));
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
// Case 1: Happy path
// ---------------------------------------------------------------------------
test('happy path: file moves to discharged/, note written with all front-matter fields', () => {
  const nmDir  = makeNeedsMarcoDir(devTree);
  const srcFile = makeEscalation(nmDir, 'happy-esc.md', 'My Happy Escalation');

  const result = run([
    '--file',        join(devTree, 'docs', 'pr-prompts', 'needs-marco', 'happy-esc.md'),
    '--actor',       'station-00.interactive-0004',
    '--evidence',    'PR #1234 merged at 2026-10-01; artifact exists on main.',
    '--record-into', recTree,
    '--repo',        devTree,
  ]);

  assert.equal(result.status, 0, 'exit 0 on success. stderr: ' + result.stderr);

  // Source file must no longer exist.
  assert.equal(existsSync(srcFile), false, 'source file should be gone after move');

  // Discharged file must exist.
  const discharged = join(nmDir, 'discharged', 'happy-esc.md');
  assert.equal(existsSync(discharged), true, 'discharged file must exist');

  // Note must exist in record worktree.
  const dischargesDir = join(recTree, 'docs', 'pipeline', 'discharges');
  assert.equal(existsSync(dischargesDir), true, 'discharges/ dir must exist in record worktree');
  const notes = readdirSync(dischargesDir).filter((f) => f.endsWith('.md'));
  assert.equal(notes.length, 1, 'exactly one note should be written');

  const noteContent = readFileSync(join(dischargesDir, notes[0]), 'utf8');

  // All five front-matter fields must be present.
  assert.match(noteContent, /^item: happy-esc\.md$/m,    'front-matter: item');
  assert.match(noteContent, /^title: My Happy Escalation$/m, 'front-matter: title');
  assert.match(noteContent, /^retired_at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m, 'front-matter: retired_at');
  assert.match(noteContent, /^actor: station-00\.interactive-0004$/m, 'front-matter: actor');
  assert.match(noteContent, /^moved_to: docs\/pr-prompts\/needs-marco\/discharged\/happy-esc\.md$/m, 'front-matter: moved_to');

  // Evidence section must be present.
  assert.match(noteContent, /## Evidence\nPR #1234 merged at 2026-10-01/m, 'evidence section');

  // Stdout must be the note path (plus optional trailing newline).
  const stdout = result.stdout.trim();
  assert.equal(stdout, join(dischargesDir, notes[0]), 'stdout is the absolute note path');
});

// ---------------------------------------------------------------------------
// Case 2: --record-into equal to --repo
// ---------------------------------------------------------------------------
test('refuses when --record-into equals --repo', () => {
  const nmDir   = makeNeedsMarcoDir(devTree);
  const srcFile = makeEscalation(nmDir, 'same-dir-esc.md');

  const result = run([
    '--file',        join(devTree, 'docs', 'pr-prompts', 'needs-marco', 'same-dir-esc.md'),
    '--actor',       'station-00',
    '--evidence',    'PR merged',
    '--record-into', devTree,
    '--repo',        devTree,
  ]);

  assert.notEqual(result.status, 0, 'must exit non-zero when record-into === repo');
  assert.match(result.stderr, /same path/, 'stderr must mention same path');

  // Nothing moved.
  assert.equal(existsSync(srcFile), true, 'source file must still exist');
  const discharged = join(nmDir, 'discharged', 'same-dir-esc.md');
  assert.equal(existsSync(discharged), false, 'discharged must NOT exist');
});

// ---------------------------------------------------------------------------
// Case 3: File outside needs-marco/
// ---------------------------------------------------------------------------
test('refuses file outside needs-marco/', () => {
  const otherDir = join(devTree, 'docs', 'pr-prompts', 'other');
  mkdirSync(otherDir, { recursive: true });
  const srcFile = join(otherDir, 'wrong-dir.md');
  writeFileSync(srcFile, '# Wrong Dir\n');

  const result = run([
    '--file',        srcFile,
    '--actor',       'station-00',
    '--evidence',    'whatever',
    '--record-into', recTree,
    '--repo',        devTree,
  ]);

  assert.notEqual(result.status, 0, 'must exit non-zero for file outside needs-marco/');
  assert.match(result.stderr, /needs-marco/, 'stderr mentions needs-marco');

  // Nothing moved.
  assert.equal(existsSync(srcFile), true, 'source file must still exist');
});

// ---------------------------------------------------------------------------
// Case 4: Destination already exists in discharged/
// ---------------------------------------------------------------------------
test('refuses when discharged destination already exists', () => {
  const nmDir   = makeNeedsMarcoDir(devTree);
  const srcFile = makeEscalation(nmDir, 'dup-esc.md');

  // Pre-create the destination.
  const dischargedDir = join(nmDir, 'discharged');
  mkdirSync(dischargedDir, { recursive: true });
  writeFileSync(join(dischargedDir, 'dup-esc.md'), 'already retired\n');

  const result = run([
    '--file',        srcFile,
    '--actor',       'station-00',
    '--evidence',    'PR merged',
    '--record-into', recTree,
    '--repo',        devTree,
  ]);

  assert.notEqual(result.status, 0, 'must exit non-zero when destination already exists');
  assert.match(result.stderr, /already exists/, 'stderr mentions already exists');

  // Original untouched.
  assert.equal(existsSync(srcFile), true, 'original source file must still exist');
  const dupDest = join(dischargedDir, 'dup-esc.md');
  assert.equal(readFileSync(dupDest, 'utf8'), 'already retired\n', 'pre-existing destination unmodified');
});

// ---------------------------------------------------------------------------
// Case 5: Note write fails -> rollback
// We pass a --record-into where docs/pipeline/discharges/ exists as a FILE
// (not a directory), so mkdirSync fails and the write never completes.
// Validation passes because the worktree .git entry exists. Then we provoke
// the write failure by creating the discharges dir as a file beforehand.
// ---------------------------------------------------------------------------
test('rolls back move when note write fails', () => {
  // Use a separate temp dir for this test to avoid collision with earlier notes.
  const localRec = mkdtempSync(join(tmpdir(), 'retire-esc-rec-'));
  initRepo(localRec);

  const nmDir   = makeNeedsMarcoDir(devTree);
  const srcFile = makeEscalation(nmDir, 'rollback-esc.md');

  // Create docs/pipeline/discharges as a FILE inside the record worktree, so
  // mkdirSync(..., { recursive: true }) throws ENOTDIR or EEXIST (varies by OS).
  const blockDir = join(localRec, 'docs', 'pipeline');
  mkdirSync(blockDir, { recursive: true });
  writeFileSync(join(blockDir, 'discharges'), 'I am a file, not a dir\n');

  const result = run([
    '--file',        srcFile,
    '--actor',       'station-00',
    '--evidence',    'PR merged',
    '--record-into', localRec,
    '--repo',        devTree,
  ]);

  assert.notEqual(result.status, 0, 'must exit non-zero when note write fails');
  assert.match(result.stderr, /rolled back|moved BACK|rollback|moved back/i, 'stderr describes rollback');

  // File must be back at the source.
  assert.equal(existsSync(srcFile), true, 'source file must be restored after rollback');
  const discharged = join(nmDir, 'discharged', 'rollback-esc.md');
  assert.equal(existsSync(discharged), false, 'discharged path must NOT exist after rollback');

  try { rmSync(localRec, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ---------------------------------------------------------------------------
// Case 6: --dry-run
// ---------------------------------------------------------------------------
test('dry-run: nothing moved, nothing written; stdout contains plan info', () => {
  const nmDir   = makeNeedsMarcoDir(devTree);
  const srcFile = makeEscalation(nmDir, 'dryrun-esc.md');

  const result = run([
    '--file',        srcFile,
    '--actor',       'station-00',
    '--evidence',    'PR merged',
    '--record-into', recTree,
    '--repo',        devTree,
    '--dry-run',
  ]);

  assert.equal(result.status, 0, 'dry-run exits 0. stderr: ' + result.stderr);

  // Source must still exist.
  assert.equal(existsSync(srcFile), true, 'source file must still exist after dry-run');

  // Discharged must NOT exist.
  const discharged = join(nmDir, 'discharged', 'dryrun-esc.md');
  assert.equal(existsSync(discharged), false, 'discharged must not exist after dry-run');

  // Stdout must contain something plan-ish.
  assert.match(result.stdout, /dry.run|would write/i, 'stdout indicates dry-run plan');
});

// ---------------------------------------------------------------------------
// Case 7: Whitespace-only --evidence is refused
// ---------------------------------------------------------------------------
test('refuses whitespace-only --evidence', () => {
  const nmDir   = makeNeedsMarcoDir(devTree);
  const srcFile = makeEscalation(nmDir, 'no-evidence-esc.md');

  const result = run([
    '--file',        srcFile,
    '--actor',       'station-00',
    '--evidence',    '   ',
    '--record-into', recTree,
    '--repo',        devTree,
  ]);

  assert.notEqual(result.status, 0, 'must exit non-zero for whitespace evidence');
  assert.match(result.stderr, /evidence/, 'stderr mentions evidence');

  // Nothing moved.
  assert.equal(existsSync(srcFile), true, 'source file must still exist');
});
