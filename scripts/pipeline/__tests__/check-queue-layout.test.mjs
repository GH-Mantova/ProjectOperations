/**
 * Tests for queue-layout.mjs (classifyQueuePath) and check-queue-layout.mjs (CLI).
 *
 * Run with:
 *   node --test "scripts/pipeline/__tests__/check-queue-layout.test.mjs"
 *
 * Tests:
 *   1. classifyQueuePath — every row of the classification table.
 *   2. Git fixture: legacy files in processed/ and binned-shipped-x/; a head commit
 *      that MODIFIES one and ADDS a valid HOLD exits 0. Legacy files are not judged.
 *   3. Git fixture: a head commit that ADDS a file to processed/ exits 1.
 *   4. Git fixture: rename of a root HOLD into superseded/ exits 0;
 *      rename into binned-shipped-x/ exits 1.
 *   5. Unreadable range exits 2, never 0.
 *   6. Negative control: a range with no docs/pr-prompts/ changes exits 0 and
 *      reports checked=0.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { classifyQueuePath, EXCEPTION_REASONS, NAME_RE } from '../queue-layout.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CHECKER = join(__dirname, '..', 'check-queue-layout.mjs');

// ---------------------------------------------------------------------------
// Helpers for git fixture repos
// ---------------------------------------------------------------------------

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'queue-layout-test-'));
  return {
    root,
    cleanup() {
      try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
}

function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(
      'git ' + args.join(' ') + ' failed (status ' + r.status + '):\n' +
        (r.stdout || '') + (r.stderr || ''),
    );
  }
  return r;
}

function initRepo(root) {
  git(root, ['init', '-q']);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'user.name', 'test']);
  git(root, ['config', 'commit.gpgsign', 'false']);
}

function writeAndAdd(root, relPath, content) {
  const abs = join(root, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  git(root, ['add', '--', relPath]);
}

function commit(root, msg) {
  git(root, ['commit', '-q', '-m', msg]);
}

// runChecker always passes --root pointing at the fixture so the checker does not
// accidentally use the real repo's git state.
function runChecker(root, args) {
  const r = spawnSync(process.execPath, [CHECKER, '--root', root, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000,
  });
  return {
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    combined: (r.stdout || '') + (r.stderr || ''),
  };
}

// ---------------------------------------------------------------------------
// Test 1: classifyQueuePath — every row of the classification table
// ---------------------------------------------------------------------------

test('classifyQueuePath: root *-HOLD.md → ok, hold', () => {
  const r = classifyQueuePath('pr-some-feature-HOLD.md');
  assert.equal(r.ok, true);
  assert.equal(r.state, 'hold');
});

test('classifyQueuePath: root breadcrumb matching NAME_RE → ok, report', () => {
  // A valid breadcrumb: 00-04-scanner-2026-09-17-0611-abc123.md
  const name = '00-04-scanner-2026-09-17-0611-abc123.md';
  assert.ok(NAME_RE.test(name), 'test assumes NAME_RE matches this breadcrumb');
  const r = classifyQueuePath(name);
  assert.equal(r.ok, true);
  assert.equal(r.state, 'report');
});

test('classifyQueuePath: root README.md → ok, queue-file', () => {
  const r = classifyQueuePath('README.md');
  assert.equal(r.ok, true);
  assert.equal(r.state, 'queue-file');
});

test('classifyQueuePath: root TEMPLATE-*.md → ok, queue-file', () => {
  const r = classifyQueuePath('TEMPLATE-prompt.md');
  assert.equal(r.ok, true);
  assert.equal(r.state, 'queue-file');
});

test('classifyQueuePath: root *-ready.md → violation (armed prompts never tracked)', () => {
  const r = classifyQueuePath('pr-my-feature-ready.md');
  assert.equal(r.ok, false);
  assert.ok(r.reason.includes('armed prompts are never tracked'));
});

test('classifyQueuePath: other root file → violation', () => {
  const r = classifyQueuePath('random-notes.md');
  assert.equal(r.ok, false);
  assert.ok(r.reason.length > 0, 'reason should be non-empty');
});

test('classifyQueuePath: archive/** → ok, report', () => {
  const r = classifyQueuePath('archive/00-04-scanner-2026-09-17-0611-abc123.md');
  assert.equal(r.ok, true);
  assert.equal(r.state, 'report');
});

test('classifyQueuePath: superseded/** → ok, superseded', () => {
  const r = classifyQueuePath('superseded/pr-old-feature-HOLD.md');
  assert.equal(r.ok, true);
  assert.equal(r.state, 'superseded');
});

test('classifyQueuePath: merged/** → ok, merged', () => {
  const r = classifyQueuePath('merged/pr-done-HOLD.md');
  assert.equal(r.ok, true);
  assert.equal(r.state, 'merged');
});

test('classifyQueuePath: draft/** → ok, draft', () => {
  const r = classifyQueuePath('draft/idea.md');
  assert.equal(r.ok, true);
  assert.equal(r.state, 'draft');
});

test('classifyQueuePath: brainstorm/** → ok, brainstorm', () => {
  const r = classifyQueuePath('brainstorm/concept.md');
  assert.equal(r.ok, true);
  assert.equal(r.state, 'brainstorm');
});

test('classifyQueuePath: exceptions/<valid-reason>/** → ok, exception', () => {
  for (const reason of EXCEPTION_REASONS) {
    const r = classifyQueuePath('exceptions/' + reason + '/some-prompt-HOLD.md');
    assert.equal(r.ok, true, 'reason=' + reason + ' should be ok');
    assert.equal(r.state, 'exception', 'reason=' + reason + ' should be exception state');
  }
});

test('classifyQueuePath: exceptions/<unknown-reason>/** → violation naming closed list', () => {
  const r = classifyQueuePath('exceptions/somerandombucket/foo.md');
  assert.equal(r.ok, false);
  assert.ok(r.reason.includes('unknown exception reason'), 'reason should name the problem');
  // The reason string should list valid reasons.
  assert.ok(r.reason.includes('needs-marco'), 'reason should list valid reasons');
});

test('classifyQueuePath: needs-marco/** → ok with warning', () => {
  const r = classifyQueuePath('needs-marco/some-issue.md');
  assert.equal(r.ok, true);
  assert.equal(r.warn, true, 'needs-marco should carry warn=true');
  assert.ok(r.reason.includes('gitignored'), 'reason should mention gitignored');
});

test('classifyQueuePath: processed/** → violation (legacy folder)', () => {
  const r = classifyQueuePath('processed/pr-old.md');
  assert.equal(r.ok, false);
  assert.ok(r.reason.includes('legacy or unknown folder'), 'reason should say legacy');
});

test('classifyQueuePath: binned-shipped-x/** → violation (legacy folder)', () => {
  const r = classifyQueuePath('binned-shipped-x/something.md');
  assert.equal(r.ok, false);
  assert.ok(r.reason.includes('legacy or unknown folder'), 'reason should say legacy');
});

test('classifyQueuePath: unknown-folder/** → violation', () => {
  const r = classifyQueuePath('random-new-folder/file.md');
  assert.equal(r.ok, false);
});

// ---------------------------------------------------------------------------
// Test 2: legacy files in processed/ and binned-shipped-x/; head MODIFIES one
// and ADDS a valid HOLD → exits 0 (legacy files not judged).
// ---------------------------------------------------------------------------

test('git fixture: legacy files + modify-only + new HOLD → exit 0', () => {
  const { root, cleanup } = createFixture();
  try {
    initRepo(root);

    // Base commit: legacy files that would fail if newly added, but they predate the line.
    writeAndAdd(root, 'docs/pr-prompts/processed/pr-old.md', '# old\n');
    writeAndAdd(root, 'docs/pr-prompts/binned-shipped-x/another.md', '# another\n');
    writeAndAdd(root, 'other.txt', 'seed\n');
    commit(root, 'base: legacy files');

    // Fake origin/main at the base commit.
    git(root, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);

    // Head commit: MODIFY the legacy file (M — not checked) + ADD a valid HOLD (A — ok).
    writeAndAdd(root, 'docs/pr-prompts/processed/pr-old.md', '# old updated\n');
    writeAndAdd(root, 'docs/pr-prompts/pr-new-feature-HOLD.md', '# new hold\n');
    commit(root, 'head: modify legacy + add HOLD');

    const { status, combined } = runChecker(root, ['--range', 'HEAD^1...HEAD']);

    assert.equal(status, 0,
      'exit must be 0: modifying legacy files and adding a valid HOLD is ok;\n' + combined);
    // The HOLD file should be checked and pass.
    assert.ok(combined.includes('pr-new-feature-HOLD.md'), 'output should mention the HOLD file');
    assert.ok(!combined.includes('VIOLATION'), 'no violations should be reported');
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: head commit ADDS a file to processed/ → exits 1.
// ---------------------------------------------------------------------------

test('git fixture: adding file to processed/ → exit 1', () => {
  const { root, cleanup } = createFixture();
  try {
    initRepo(root);
    writeAndAdd(root, 'other.txt', 'seed\n');
    commit(root, 'base');
    git(root, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);

    writeAndAdd(root, 'docs/pr-prompts/processed/new-prompt.md', '# new\n');
    commit(root, 'head: add to processed/');

    const { status, combined } = runChecker(root, ['--range', 'HEAD^1...HEAD']);

    assert.equal(status, 1,
      'exit must be 1 when a new file is added to processed/;\n' + combined);
    assert.ok(combined.includes('VIOLATION'), 'output should contain VIOLATION');
    assert.ok(combined.includes('processed'), 'output should name the offending folder');
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4a: rename of root HOLD into superseded/ → exits 0.
// Test 4b: rename of root HOLD into binned-shipped-x/ → exits 1.
// ---------------------------------------------------------------------------

test('git fixture: rename root HOLD into superseded/ → exit 0', () => {
  const { root, cleanup } = createFixture();
  try {
    initRepo(root);
    writeAndAdd(root, 'docs/pr-prompts/pr-foo-HOLD.md', '# hold\n');
    commit(root, 'base');
    git(root, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);

    // Rename: the destination is superseded/ which is valid.
    mkdirSync(join(root, 'docs/pr-prompts/superseded'), { recursive: true });
    git(root, ['mv',
      'docs/pr-prompts/pr-foo-HOLD.md',
      'docs/pr-prompts/superseded/pr-foo-HOLD.md',
    ]);
    commit(root, 'head: move to superseded/');

    const { status, combined } = runChecker(root, ['--range', 'HEAD^1...HEAD']);

    assert.equal(status, 0,
      'exit must be 0 when renaming a HOLD into superseded/;\n' + combined);
    assert.ok(!combined.includes('VIOLATION'), 'no violations;\n' + combined);
  } finally {
    cleanup();
  }
});

test('git fixture: rename root HOLD into binned-shipped-x/ → exit 1', () => {
  const { root, cleanup } = createFixture();
  try {
    initRepo(root);
    writeAndAdd(root, 'docs/pr-prompts/pr-bar-HOLD.md', '# hold\n');
    commit(root, 'base');
    git(root, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);

    mkdirSync(join(root, 'docs/pr-prompts/binned-shipped-x'), { recursive: true });
    git(root, ['mv',
      'docs/pr-prompts/pr-bar-HOLD.md',
      'docs/pr-prompts/binned-shipped-x/pr-bar-HOLD.md',
    ]);
    commit(root, 'head: move to binned-shipped-x/');

    const { status, combined } = runChecker(root, ['--range', 'HEAD^1...HEAD']);

    assert.equal(status, 1,
      'exit must be 1 when renaming into a legacy/unknown folder;\n' + combined);
    assert.ok(combined.includes('VIOLATION'), 'output should contain VIOLATION;\n' + combined);
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: unreadable range → exits 2, never 0.
// ---------------------------------------------------------------------------

test('git fixture: unreadable range exits 2, never 0', () => {
  const { root, cleanup } = createFixture();
  try {
    initRepo(root);
    writeAndAdd(root, 'seed.txt', 'seed\n');
    commit(root, 'base');

    const { status, combined } = runChecker(root, ['--range', 'nonexistent-sha-abc123...HEAD']);

    assert.notEqual(status, 0,
      'exit must be non-zero for an unreadable range; got:\n' + combined);
    assert.equal(status, 2,
      'exit must be exactly 2 for [CANNOT MEASURE]; got ' + status + ':\n' + combined);
    assert.ok(
      combined.includes('[CANNOT MEASURE]'),
      'output must contain [CANNOT MEASURE];\n' + combined,
    );
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 6: negative control — no docs/pr-prompts/ changes → exits 0, checked=0.
// ---------------------------------------------------------------------------

test('git fixture: no docs/pr-prompts/ changes → exit 0, checked=0', () => {
  const { root, cleanup } = createFixture();
  try {
    initRepo(root);
    writeAndAdd(root, 'seed.txt', 'seed\n');
    commit(root, 'base');
    git(root, ['update-ref', 'refs/remotes/origin/main', 'HEAD']);

    // Head commit touches only a non-queue file.
    writeAndAdd(root, 'other.txt', 'hello\n');
    commit(root, 'head: no queue changes');

    const { status, combined } = runChecker(root, ['--range', 'HEAD^1...HEAD']);

    assert.equal(status, 0,
      'exit must be 0 when no queue paths changed;\n' + combined);
    assert.ok(
      combined.includes('checked=0'),
      'output must say checked=0;\n' + combined,
    );
  } finally {
    cleanup();
  }
});
