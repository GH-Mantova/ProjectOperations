#!/usr/bin/env node
// check-queue-layout.mjs — enforce the prompt-queue layout standard.
//
// QUEUE_LAYOUT_LINE_AT_TODAY_V1
//
// Decision record: docs/pipeline/QUEUE-LAYOUT.md
// "In force from 2026-10-02 (QUEUE_LAYOUT_LINE_AT_TODAY_V1)" section.
//
// Usage:
//   node scripts/pipeline/check-queue-layout.mjs --range <base>...<head>   # CI and local
//   node scripts/pipeline/check-queue-layout.mjs --legacy-report            # informational only
//
// EXIT CODES
//   0  all checked paths are compliant (or 0 paths were checked)
//   1  at least one VIOLATION
//   2  [CANNOT MEASURE] — range cannot be read (bad ref, shallow clone), or
//      controls misbehaved.
//      NEVER 0 when nothing was read. Same contract as check-pr-title.mjs.
//
// --range lists `git diff --name-status --find-renames <range> -- docs/pr-prompts/`.
//   A (added) paths and R (renamed) DESTINATIONS are checked.
//   M and D are never checked: editing or deleting a legacy file is not a layout event.
//
// --legacy-report walks the tracked tree on HEAD and prints counts per state,
//   plus a count of existing paths that would fail. Always exits 0 — this is the
//   record of what the line at today grandfathers.
//
// CONTROLS (DOCTRINE §7 — an instrument that cannot fail is not evidence):
//   Two control paths are classified before any real verdict:
//     known-good  → archive/some-report.md (expect: ok)
//     known-bad   → processed/some-file.md (expect: violation)
//   Exit 2 if either comes out wrong.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyQueuePath } from './queue-layout.mjs';

const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM    = '\x1b[2m';
const RESET  = '\x1b[0m';

// Module's own repo root — two levels up from scripts/pipeline/.
// Can be overridden with --root <path> for testing with fixture repos.
const MODULE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const QUEUE_DIR = 'docs/pr-prompts';

// ---------------------------------------------------------------------------
// git(root, args) — thin wrapper around spawnSync.
// Uses an argument ARRAY, never a shell string, so metacharacters in args
// (e.g. `origin/main...HEAD`) are passed verbatim to git rather than
// interpreted by a shell.
// Returns { ok, stdout, stderr, status }.
// ---------------------------------------------------------------------------

function git(root, args) {
  const r = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    ok: r.status === 0,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    status: r.status,
  };
}

// ---------------------------------------------------------------------------
// Controls — run before every verdict.
// ---------------------------------------------------------------------------

function runControls() {
  const cases = [
    { label: 'known-good: archive/report.md', path: 'archive/some-report.md',  wantOk: true  },
    { label: 'known-bad:  processed/file.md', path: 'processed/some-file.md',  wantOk: false },
  ];
  let allPassed = true;
  const lines = [];
  for (const c of cases) {
    const result = classifyQueuePath(c.path);
    const pass = result.ok === c.wantOk;
    lines.push(c.label + '=' + pass);
    if (!pass) {
      allPassed = false;
      console.error('  control MISBEHAVED: ' + c.label +
        ' wanted ok=' + c.wantOk + ', got ok=' + result.ok +
        ' state=' + result.state + ' reason=' + result.reason);
    }
  }
  console.log('controls: ' + lines.join('  '));
  return allPassed;
}

// ---------------------------------------------------------------------------
// Parse `git diff --name-status` output (tab-separated).
// Returns array of { status, path } where status is 'A', 'M', 'D', or 'R'
// (for renames, path is the DESTINATION).
// ---------------------------------------------------------------------------

function parseDiffNameStatus(output) {
  const lines = output.split('\n').filter(Boolean);
  const result = [];
  for (const line of lines) {
    const parts = line.split('\t');
    const status = parts[0];
    if (status === 'A' || status === 'M' || status === 'D') {
      result.push({ status, path: parts[1] });
    } else if (status.startsWith('R')) {
      // R<score>\t<old-path>\t<new-path>
      // The destination (new-path) is what we classify.
      result.push({ status: 'R', path: parts[2] });
    }
    // C (copy), T (type-change) etc. are not expected here; ignore.
  }
  return result;
}

// ---------------------------------------------------------------------------
// Strip the docs/pr-prompts/ prefix from a full repo-relative path.
// Returns null if the path is not under docs/pr-prompts/.
// Normalises backslashes so Windows paths work on both platforms.
// ---------------------------------------------------------------------------

function stripQueuePrefix(fullPath) {
  const p = fullPath.replace(/\\/g, '/');
  const prefix = QUEUE_DIR + '/';
  if (!p.startsWith(prefix)) return null;
  return p.slice(prefix.length);
}

// ---------------------------------------------------------------------------
// --range mode
// ---------------------------------------------------------------------------

function runRange(root, range) {
  // Run controls first — exit 2 if they misbehave.
  if (!runControls()) {
    console.error('[CANNOT MEASURE] check-queue-layout failed its own controls.');
    process.exit(2);
  }

  // git diff --name-status --find-renames <range> -- docs/pr-prompts
  // Arguments are passed as an array, not a shell string, so the range token
  // (e.g. "origin/main...HEAD") is passed verbatim to git without shell
  // interpretation.
  const r = git(root, ['diff', '--name-status', '--find-renames', range, '--', QUEUE_DIR]);

  if (!r.ok) {
    console.error('[CANNOT MEASURE] git diff failed for range ' + JSON.stringify(range) + ':');
    console.error('  ' + r.stderr.trim());
    console.error('  Possible causes: bad ref, shallow clone, range not fetched.');
    console.error('  Exit 2 — never 0: a range check that passes when it cannot see the range');
    console.error('  reports green forever.');
    process.exit(2);
  }

  const allEntries = parseDiffNameStatus(r.stdout);
  // Only A (added) and R (renamed destination) are layout events.
  const toCheck = allEntries.filter((e) => e.status === 'A' || e.status === 'R');

  let violations = 0;
  let warnings = 0;

  for (const entry of toCheck) {
    const rel = stripQueuePrefix(entry.path);
    if (rel === null) continue; // outside docs/pr-prompts/ — shouldn't happen given the pathspec

    const result = classifyQueuePath(rel);

    if (!result.ok) {
      violations++;
      console.log(RED + 'VIOLATION' + RESET + ' ' + entry.path + ': ' + result.reason);
    } else if (result.warn) {
      warnings++;
      console.log(YELLOW + 'WARN     ' + RESET + ' ' + entry.path + ': ' + result.reason);
    } else {
      console.log(GREEN + 'ok' + RESET + ' ' + result.state + '  ' + entry.path);
    }
  }

  console.log('');
  console.log('summary: checked=' + toCheck.length +
    '  violations=' + violations +
    '  warnings=' + warnings);

  process.exit(violations > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// --legacy-report mode
// ---------------------------------------------------------------------------

function runLegacyReport(root) {
  // Always exits 0 — informational only, not enforced.
  const r = git(root, ['ls-tree', '-r', '--name-only', 'HEAD', '--', QUEUE_DIR]);

  if (!r.ok) {
    console.error('[CANNOT MEASURE] git ls-tree failed: ' + r.stderr.trim());
    console.log('(legacy-report always exits 0)');
    process.exit(0);
  }

  const paths = r.stdout.split('\n').filter(Boolean);
  const counts = new Map();
  let wouldFail = 0;

  for (const fullPath of paths) {
    const rel = stripQueuePrefix(fullPath);
    if (rel === null) continue;

    const result = classifyQueuePath(rel);
    const bucket = result.ok ? result.state : 'VIOLATION';
    counts.set(bucket, (counts.get(bucket) || 0) + 1);

    if (!result.ok) {
      wouldFail++;
      console.log(RED + 'would-fail' + RESET + ' ' + fullPath + ': ' + result.reason);
    } else {
      console.log(DIM + 'ok ' + result.state + RESET + '  ' + fullPath);
    }
  }

  console.log('');
  console.log('legacy-report summary (informational — these files are grandfathered):');
  for (const [state, count] of [...counts.entries()].sort()) {
    console.log('  ' + state + ': ' + count);
  }
  console.log('  total tracked: ' + paths.length);
  console.log('  would-fail under new rule: ' + wouldFail + '  (grandfathered — not enforced)');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);

  // --root <path> overrides the repo root — used by tests pointing at fixture repos.
  const rootIdx = args.indexOf('--root');
  const root = (rootIdx !== -1 && args[rootIdx + 1]) ? args[rootIdx + 1] : MODULE_ROOT;

  if (args.includes('--legacy-report')) {
    runLegacyReport(root);
  } else {
    const rangeIdx = args.indexOf('--range');
    if (rangeIdx === -1 || !args[rangeIdx + 1]) {
      console.error('Usage: node check-queue-layout.mjs --range <base>...<head>');
      console.error('       node check-queue-layout.mjs --legacy-report');
      process.exit(2);
    }
    runRange(root, args[rangeIdx + 1]);
  }
}
