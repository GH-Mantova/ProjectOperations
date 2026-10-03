/**
 * Tests for BOOTSTRAP_PREFLIGHT_CHECK_V1 in lint-station.mjs.
 *
 * Runs with: node --test scripts/pipeline/__tests__/lint-station.bootstrap-check.test.mjs
 *
 * The scheduled-task bootstraps live outside this repo (C:\Users\Marco\Claude\Scheduled on
 * Marco's PC). GitHub CI cannot see them — on CI this check SKIPs. These tests exercise the
 * same code locally against a disposable temp folder pinned via `PO_BOOTSTRAP_DIR`.
 *
 * The checks:
 *   - every <dir>/<name>/SKILL.md (where <name> does NOT start with `_` and the file has a
 *     line starting `## STEP 1`) must contain the four preflight needles:
 *       ToolSearch, vm-git-guard, show origin/main, GROUND block
 *   - it must NOT cite `.gitignore:\d+` line numbers (those move).
 *   - folders starting with `_` (e.g. `_backup-*`, `_retired-*`) are skipped entirely.
 *   - a SKILL.md with no STEP block is reported as "not checked", NOT a failure.
 *   - a missing/nonexistent folder returns `skipped: true` — a SKIP, never an ADMIT.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { checkBootstraps, resolveBootstrapDir, BOOTSTRAP_NEEDLES } from '../lint-station.mjs';

// Minimal payload that passes every needle check.
const COMPLETE_BOOTSTRAP = `# some scheduled task

## STEP 1 — preflight

Load the ToolSearch schema before declaring any tool blind.
Install vm-git-guard so git calls refuse the shared watcher tree.
Run \`git show origin/main\` against the binding docs before trusting local copies.
Stamp a GROUND block at the top of your first message.
`;

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'lint-bootstrap-'));
}

function writeBootstrap(root, name, body) {
  mkdirSync(join(root, name), { recursive: true });
  writeFileSync(join(root, name, 'SKILL.md'), body, 'utf8');
}

// ── 1. complete bootstrap: no REJECT ────────────────────────────────────────
test('a complete bootstrap passes with no fails', () => {
  const dir = makeTempDir();
  try {
    writeBootstrap(dir, 'station-00', COMPLETE_BOOTSTRAP);
    const result = checkBootstraps(dir);
    assert.equal(result.skipped, false);
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].status, 'clean');
    assert.deepEqual(result.results[0].fails, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 2. missing a needle: REJECT naming file + item ──────────────────────────
test('a bootstrap missing vm-git-guard is REJECTed naming the file and the item', () => {
  const dir = makeTempDir();
  try {
    const broken = COMPLETE_BOOTSTRAP.replace(/vm-git-guard/g, 'the-guard');
    writeBootstrap(dir, 'station-01', broken);
    const result = checkBootstraps(dir);
    assert.equal(result.skipped, false);
    const r = result.results.find((x) => x.name === 'station-01');
    assert.ok(r, 'station-01 should be in results');
    assert.equal(r.status, 'reject');
    assert.ok(
      r.fails.some((f) => f.includes('vm-git-guard')),
      `expected a fail mentioning vm-git-guard; got: ${JSON.stringify(r.fails)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 3. forbidden .gitignore line-number citation ────────────────────────────
test('a bootstrap citing .gitignore:107-111 is REJECTed', () => {
  const dir = makeTempDir();
  try {
    const text = COMPLETE_BOOTSTRAP + '\nSee `.gitignore:107-111` for the sinks.\n';
    writeBootstrap(dir, 'station-02', text);
    const result = checkBootstraps(dir);
    assert.equal(result.skipped, false);
    const r = result.results.find((x) => x.name === 'station-02');
    assert.ok(r, 'station-02 should be in results');
    assert.equal(r.status, 'reject');
    assert.ok(
      r.fails.some((f) => /gitignore/.test(f) && /107/.test(f)),
      `expected a fail mentioning the gitignore line citation; got: ${JSON.stringify(r.fails)}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 4. _backup-* folders are ignored entirely ───────────────────────────────
test('folders whose names start with `_` are ignored (no REJECT)', () => {
  const dir = makeTempDir();
  try {
    // Put a nested, empty SKILL.md inside a backup folder — it must not be checked.
    mkdirSync(join(dir, '_backup-x', 'a'), { recursive: true });
    writeFileSync(join(dir, '_backup-x', 'a', 'SKILL.md'), '', 'utf8');
    writeFileSync(join(dir, '_backup-x', 'SKILL.md'), '', 'utf8');
    // Also a `_retired-foo` top-level directory.
    mkdirSync(join(dir, '_retired-foo'), { recursive: true });
    writeFileSync(join(dir, '_retired-foo', 'SKILL.md'), '', 'utf8');
    const result = checkBootstraps(dir);
    assert.equal(result.skipped, false);
    assert.equal(result.results.length, 0, `expected zero results, got: ${JSON.stringify(result.results)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 5. a folder with no STEP block is reported, not a REJECT ────────────────
test('a SKILL.md with no `## STEP 1` line is reported as not-checked, not a REJECT', () => {
  const dir = makeTempDir();
  try {
    writeBootstrap(dir, 'weekly-security-audit', '# weekly-security-audit\n\nJust prose, no STEPs.\n');
    const result = checkBootstraps(dir);
    assert.equal(result.skipped, false);
    const r = result.results.find((x) => x.name === 'weekly-security-audit');
    assert.ok(r, 'should still be in results');
    assert.equal(r.status, 'no-step');
    assert.deepEqual(r.fails, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── 6. negative control: nonexistent folder returns a SKIP ──────────────────
test('PO_BOOTSTRAP_DIR pointing at a nonexistent path SKIPs (no REJECT) and names the path', () => {
  const nonexistent = join(tmpdir(), 'lint-bootstrap-does-not-exist-' + Date.now());
  const result = checkBootstraps(nonexistent);
  assert.equal(result.skipped, true, 'skipped must be true');
  assert.equal(result.dir, nonexistent, 'the resolved path must appear in the SKIP payload');
  assert.ok(result.reason && /no bootstrap folder|not exist|absent/i.test(result.reason), `reason should mention the folder is absent; got: ${result.reason}`);
  // And the shape must NOT carry a results array — nothing was checked.
  assert.equal(result.results, undefined);
});

// ── resolveBootstrapDir honours PO_BOOTSTRAP_DIR first, then USERPROFILE ────
test('resolveBootstrapDir prefers PO_BOOTSTRAP_DIR over USERPROFILE', () => {
  const picked = resolveBootstrapDir({ PO_BOOTSTRAP_DIR: 'C:/x', USERPROFILE: 'C:/Users/Z' });
  assert.equal(picked, 'C:/x');
});

test('resolveBootstrapDir falls back to USERPROFILE/Claude/Scheduled', () => {
  const picked = resolveBootstrapDir({ USERPROFILE: 'C:/Users/Z' });
  assert.ok(picked && picked.includes('Claude'), `expected Claude\\Scheduled under USERPROFILE; got ${picked}`);
  assert.ok(picked.endsWith('Scheduled'), `expected to end with Scheduled; got ${picked}`);
});

test('resolveBootstrapDir returns null when neither env var is set', () => {
  const picked = resolveBootstrapDir({});
  assert.equal(picked, null);
});

// ── sanity: the exported needle list is what the prompt pinned ──────────────
test('BOOTSTRAP_NEEDLES exports the four preflight needles verbatim', () => {
  assert.deepEqual(BOOTSTRAP_NEEDLES, ['ToolSearch', 'vm-git-guard', 'show origin/main', 'GROUND block']);
});
