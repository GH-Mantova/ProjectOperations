#!/usr/bin/env node
// retire-escalation.mjs -- move a needs-marco escalation to discharged/ and write a
// tracked note in docs/pipeline/discharges/ so any station can verify a retirement.
//
// WHY THIS EXISTS (measured 2026-10-02 at origin/main cf09be41):
//   Retiring an escalation left no tracked record. docs/pr-prompts/needs-marco/ is
//   gitignored, so the move and any _DISCHARGE-NOTE written beside it reached nobody
//   through git. A Station 00 on 2026-09-23 found 18 escalations gone, saw no record
//   anywhere, and filed "18 escalations deleted by an actor I cannot identify" at S1.
//   It cost most of a run and a correction PR (#2106).
//
// Usage:
//   node scripts/pipeline/retire-escalation.mjs \
//     --file docs/pr-prompts/needs-marco/<name>.md \
//     --actor <station id> \
//     --evidence "<one line proving it is resolved>" \
//     --record-into <worktree path that will carry the note in a PR> \
//     [--repo <dev tree root, default: cwd>] [--dry-run]
//
// Exit codes:
//   0  success; stdout is the absolute path of the written note (one line)
//   1  validation error or runtime failure; message on stderr
//
// On success, stdout prints ONLY the note path so a caller can `git add` it.
// All other output goes to stderr.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Resolve the repo root from this file's location, so the script runs from
// any working directory (DOCTRINE section 9.1 pattern used across check-*.mjs).
// ---------------------------------------------------------------------------
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = resolve(SCRIPT_DIR, '..', '..');

// ---------------------------------------------------------------------------
// Argv parsing — no external deps.
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') { args['dry-run'] = true; continue; }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      args[key] = argv[i + 1] ?? '';
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv);

const filePath   = args['file']        ?? '';
const actor      = (args['actor']      ?? '').trim();
const evidence   = (args['evidence']   ?? '').trim();
const recordInto = args['record-into'] ?? '';
const repoArg    = args['repo']        ?? DEFAULT_REPO;
const dryRun     = args['dry-run']     ?? false;

// Capture the timestamp once at the start of the run.
const NOW = new Date();
const isoNow = NOW.toISOString().replace(/\.\d{3}Z$/, 'Z'); // 2026-10-03T14:05:00Z
// Filename timestamp: YYYY-MM-DD-HHmm
const pad = (n) => String(n).padStart(2, '0');
const stampFile = [
  NOW.getUTCFullYear(),
  '-',
  pad(NOW.getUTCMonth() + 1),
  '-',
  pad(NOW.getUTCDate()),
  '-',
  pad(NOW.getUTCHours()),
  pad(NOW.getUTCMinutes()),
].join('');

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------
function die(msg) {
  process.stderr.write('retire-escalation: ' + msg + '\n');
  process.exit(1);
}

function realOrNull(p) {
  try { return realpathSync(p); } catch { return null; }
}

function isGitWorktree(p) {
  // A git worktree has either a .git directory or a .git file (for linked worktrees).
  const dot = join(p, '.git');
  return existsSync(dot);
}

// ---------------------------------------------------------------------------
// Validate: --file
// ---------------------------------------------------------------------------
if (!filePath) die('--file is required');

const absFile = resolve(repoArg, filePath);
if (!existsSync(absFile)) {
  die('--file does not exist: ' + absFile);
}

// Parent directory must be named exactly "needs-marco" (not a subdirectory of it).
const parentDir = basename(dirname(absFile));
if (parentDir !== 'needs-marco') {
  die(
    '--file must be directly under a directory named "needs-marco" (got parent "' +
      parentDir +
      '"). Files in subdirectories of needs-marco/ are not accepted.'
  );
}

// ---------------------------------------------------------------------------
// Validate: --actor and --evidence
// ---------------------------------------------------------------------------
if (!actor) die('--actor must be a non-empty, non-whitespace station identifier');
if (!evidence) die('--evidence must be non-empty and non-whitespace; a record cannot be written without proof');

// ---------------------------------------------------------------------------
// Validate: --record-into
// ---------------------------------------------------------------------------
if (!recordInto) die('--record-into is required');

const absRecordInto = resolve(recordInto);
if (!isGitWorktree(absRecordInto)) {
  die(
    '--record-into "' +
      absRecordInto +
      '" is not a git worktree (no .git entry). The note must ride in a PR; an untracked file left in the dev tree blocks its fast-forward (the known trap behind the 2026-09-04 FF blocker).'
  );
}

// --record-into must not equal --repo (resolve both to real paths).
const realRepo      = realOrNull(resolve(repoArg)) ?? resolve(repoArg);
const realRecordInto = realOrNull(absRecordInto)    ?? absRecordInto;
if (realRepo === realRecordInto) {
  die(
    '--record-into resolves to the same path as --repo (' +
      realRepo +
      '). The note must ride in a PR worktree, not the dev tree. An untracked note left in the dev tree blocks the next fast-forward (the known trap behind the 2026-09-04 FF blocker).'
  );
}

// ---------------------------------------------------------------------------
// Validate: destination must not already exist.
// ---------------------------------------------------------------------------
const nameWithExt   = basename(absFile);                         // my-escalation.md
const nameNoExt     = nameWithExt.replace(/\.md$/i, '');         // my-escalation
const dischargedDir = join(dirname(absFile), 'discharged');
const destFile      = join(dischargedDir, nameWithExt);

if (existsSync(destFile)) {
  die(
    'destination already exists: ' +
      destFile +
      '. Never overwrite a discharged escalation. If the file was previously retired, the original is still at the source.'
  );
}

// ---------------------------------------------------------------------------
// Read the title BEFORE the move (while the file is still at the source).
// ---------------------------------------------------------------------------
let title = nameWithExt; // fallback: basename
try {
  const src = readFileSync(absFile, 'utf8');
  const m   = src.match(/^#\s+(.+)$/m);
  if (m) title = m[1].trim();
} catch (e) {
  process.stderr.write('retire-escalation: warning: could not read title from ' + absFile + ': ' + e.message + '\n');
}

// ---------------------------------------------------------------------------
// Build the note content.
// ---------------------------------------------------------------------------
const movedTo  = 'docs/pr-prompts/needs-marco/discharged/' + nameWithExt;
const noteSlug = nameNoExt;
const noteFilename = stampFile + 'Z-' + noteSlug + '.md';
const noteDirAbs   = join(absRecordInto, 'docs', 'pipeline', 'discharges');
const notePathAbs  = join(noteDirAbs, noteFilename);

const noteBody = [
  '---',
  'item: ' + nameWithExt,
  'title: ' + title,
  'retired_at: ' + isoNow,
  'actor: ' + actor,
  'moved_to: ' + movedTo,
  '---',
  '',
  '## Evidence',
  evidence,
  '',
].join('\n');

// ---------------------------------------------------------------------------
// Dry run: validate, print plan, touch nothing.
// ---------------------------------------------------------------------------
if (dryRun) {
  process.stderr.write('retire-escalation: DRY RUN -- nothing will be moved or written\n');
  process.stderr.write('  source:      ' + absFile + '\n');
  process.stderr.write('  destination: ' + destFile + '\n');
  process.stderr.write('  note:        ' + notePathAbs + '\n');
  process.stderr.write('  actor:       ' + actor + '\n');
  process.stderr.write('  evidence:    ' + evidence + '\n');
  process.stdout.write('[dry-run] would write note to: ' + notePathAbs + '\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Step 1: Move the file.
// ---------------------------------------------------------------------------
if (!existsSync(dischargedDir)) {
  mkdirSync(dischargedDir, { recursive: true });
}

renameSync(absFile, destFile);

// ---------------------------------------------------------------------------
// Step 2: Write the tracked note.
// If this fails, move the file BACK and exit non-zero.
// ---------------------------------------------------------------------------
try {
  if (!existsSync(noteDirAbs)) {
    mkdirSync(noteDirAbs, { recursive: true });
  }
  writeFileSync(notePathAbs, noteBody, { encoding: 'utf8', flag: 'wx' });
} catch (writeErr) {
  // Rollback: rename back to source.
  try {
    renameSync(destFile, absFile);
    process.stderr.write(
      'retire-escalation: note write failed (' +
        writeErr.message +
        '). The escalation file has been moved BACK to ' +
        absFile +
        '. No record was written and the source is untouched.\n'
    );
  } catch (rollbackErr) {
    process.stderr.write(
      'retire-escalation: note write failed (' +
        writeErr.message +
        ') AND rollback also failed (' +
        rollbackErr.message +
        '). The escalation file may be at ' +
        destFile +
        ' with no note. Manual intervention required.\n'
    );
  }
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Success: print the note path to stdout (the ONLY success-stream line).
// ---------------------------------------------------------------------------
process.stdout.write(notePathAbs + '\n');
