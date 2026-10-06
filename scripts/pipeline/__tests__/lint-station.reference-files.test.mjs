/**
 * DOCTRINE_CORE_SPLIT_V1 — tests for the Full-detail pointer check in lint-station.mjs.
 *
 * Runs with: node --test scripts/pipeline/__tests__/lint-station.reference-files.test.mjs
 *
 * The split introduces one new failure mode: a `Full detail: FILE §SECTION` pointer in the core
 * that does not resolve to a heading in FILE. These tests exercise the resolver directly against
 * temp files, so they do not depend on the live DOCTRINE / supervisor documents.
 *
 * The checks:
 *   1. a DANGLING pointer (target file missing, OR section missing) is a REJECT.
 *   2. a VALID pointer (file exists, heading matches) passes with no fails.
 *   3. negative control: a core file with NO pointers lints exactly as before — zero pointer fails.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkFullDetailPointers } from '../lint-station.mjs';

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'lint-fulldetail-'));
}

// ── 1a. DANGLING: target file absent ────────────────────────────────────────
test('a Full detail pointer whose TARGET FILE is missing is a REJECT', () => {
  const dir = makeTempDir();
  try {
    const corePath = join(dir, 'CORE.md');
    const coreText = [
      '# Core',
      '',
      '## 9.1 The shell',
      '',
      'See the reference.',
      '',
      'Full detail: NONEXISTENT-REFERENCE.md §9.1.',
      '',
    ].join('\n');
    writeFileSync(corePath, coreText, 'utf8');
    const fails = checkFullDetailPointers(corePath, coreText);
    assert.ok(
      fails.some((f) => /NONEXISTENT-REFERENCE\.md/.test(f) && /not found/i.test(f)),
      `expected a fail naming the missing target file; got: ${JSON.stringify(fails)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 1b. DANGLING: target file present, section heading absent ───────────────
test('a Full detail pointer whose SECTION is absent in the target file is a REJECT', () => {
  const dir = makeTempDir();
  try {
    const refPath = join(dir, 'REFERENCE.md');
    const refText = [
      '# Reference',
      '',
      '## 9.1 The shell',
      '',
      'Shell content here.',
      '',
    ].join('\n');
    writeFileSync(refPath, refText, 'utf8');
    const corePath = join(dir, 'CORE.md');
    const coreText = [
      '# Core',
      '',
      '## 9.2 Git',
      '',
      'See the reference.',
      '',
      'Full detail: REFERENCE.md §9.99.',
      '',
    ].join('\n');
    writeFileSync(corePath, coreText, 'utf8');
    const fails = checkFullDetailPointers(corePath, coreText);
    assert.ok(
      fails.some((f) => /§9\.99/.test(f) && /not resolve/i.test(f)),
      `expected a fail naming the missing section; got: ${JSON.stringify(fails)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 2. VALID: both file and section resolve ─────────────────────────────────
test('a Full detail pointer whose file AND section resolve passes with zero fails', () => {
  const dir = makeTempDir();
  try {
    const refPath = join(dir, 'REFERENCE.md');
    const refText = [
      '# Reference',
      '',
      '## 9.1 The shell',
      '',
      'The full shell write-up.',
      '',
      '## 9.2 Git',
      '',
      'The full git write-up.',
      '',
      '### §AUTHORITY-STALE',
      '',
      'The full stale-row write-up.',
      '',
    ].join('\n');
    writeFileSync(refPath, refText, 'utf8');

    const corePath = join(dir, 'CORE.md');
    const coreText = [
      '# Core',
      '',
      '## 9.1 The shell',
      '- one short rule',
      '',
      'Full detail: REFERENCE.md §9.1.',
      '',
      '## 9.2 Git',
      '- another short rule',
      '',
      'Full detail: REFERENCE.md §9.2.',
      '',
      '## AUTHORITY',
      '- the rule itself',
      '',
      'Full detail: REFERENCE.md §AUTHORITY-STALE.',
      '',
    ].join('\n');
    writeFileSync(corePath, coreText, 'utf8');
    const fails = checkFullDetailPointers(corePath, coreText);
    assert.deepEqual(fails, [], `expected zero fails; got: ${JSON.stringify(fails)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 3. NEGATIVE CONTROL: no pointers at all → no pointer fails ──────────────
test('a core file with NO Full detail pointers produces zero pointer fails (negative control)', () => {
  const dir = makeTempDir();
  try {
    const corePath = join(dir, 'CORE.md');
    const coreText = [
      '# Core',
      '',
      '## 1. The read-back rule',
      '',
      'Rule text with no pointers.',
      '',
      '## 2. Evidence not assertion',
      '',
      'More rule text.',
      '',
    ].join('\n');
    writeFileSync(corePath, coreText, 'utf8');
    const fails = checkFullDetailPointers(corePath, coreText);
    assert.deepEqual(fails, [], `expected zero fails; got: ${JSON.stringify(fails)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


// -- 4. BACKTICKED file name: the pointer form the 00-supervisor core actually uses ------------------
// Before this case existed the resolver regex required the file name immediately after "Full detail:",
// so `Full detail: \`FILE.md\` §X` was never checked at all and three dangling pointers passed lint.
test('a BACKTICKED Full detail pointer is checked: dangling is a REJECT, valid passes', () => {
  const dir = makeTempDir();
  try {
    writeFileSync(join(dir, 'REF.md'), ['# Ref', '', '### §GOOD-ANCHOR - text', ''].join('\n'), 'utf8');
    const corePath = join(dir, 'CORE.md');
    const bad = 'Full detail: `REF.md` §MISSING-ANCHOR.\n';
    const good = 'Full detail: `REF.md` §GOOD-ANCHOR.\n';
    const badFails = checkFullDetailPointers(corePath, bad);
    assert.ok(badFails.some((x) => /MISSING-ANCHOR/.test(x)), `expected a REJECT for the dangling backticked pointer; got: ${JSON.stringify(badFails)}`);
    assert.deepEqual(checkFullDetailPointers(corePath, good), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
