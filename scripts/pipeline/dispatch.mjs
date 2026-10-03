#!/usr/bin/env node
// dispatch.mjs -- open, close, and list DISPATCHED findings in the tracked register.
//
// DISPATCH_REGISTER_V1
//
// WHY THIS EXISTS (measured 2026-10-03 against origin/main):
//   A finding with disposition DISPATCHED had no file-backed home. ESCALATED has
//   docs/pr-prompts/needs-marco/ and the sweep reads it. DISPATCHED lived only in
//   archived breadcrumbs that no instrument reads. This script fixes that with the
//   same shape as retire-escalation.mjs.
//
// Usage:
//   node scripts/pipeline/dispatch.mjs open  \
//     --to <station-number> --slug <s> --finding "<...>" --done-when "<...>" \
//     --from <station id> --source <ref> --record-into <PR worktree>
//
//   node scripts/pipeline/dispatch.mjs close \
//     --id <id> --by <station id> --evidence "<...>" --record-into <PR worktree>
//
//   node scripts/pipeline/dispatch.mjs list [--repo <path>]
//
// Exit codes:
//   0  success; stdout for open/close is ONLY the written/moved path (one line).
//   1  validation error or runtime failure; message on stderr prefixed "dispatch: ".
//
// On success, stdout prints ONLY the dispatch file path so a caller can `git add` it.
// All other output goes to stderr.

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, readdirSync } from 'node:fs';
import { realpathSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Resolve the repo root from this file's location -- never from process.cwd()
// (DOCTRINE section 9.1 pattern used across check-*.mjs).
// ---------------------------------------------------------------------------
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = resolve(SCRIPT_DIR, '..', '..');

// ---------------------------------------------------------------------------
// Argv parsing -- no external deps. Same style as retire-escalation.mjs.
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      args[key] = argv[i + 1] ?? '';
      i++;
    }
  }
  return args;
}

const subcommand = process.argv[2] ?? '';
const args = parseArgs(process.argv);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function die(msg) {
  process.stderr.write('dispatch: ' + msg + '\n');
  process.exit(1);
}

function realOrNull(p) {
  try { return realpathSync(p); } catch { return null; }
}

function isGitWorktree(p) {
  return existsSync(join(p, '.git'));
}

function padTwo(n) {
  return String(n).padStart(2, '0');
}

function isoNowSeconds() {
  const d = new Date();
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function utcDateStr(d) {
  return [
    d.getUTCFullYear(),
    padTwo(d.getUTCMonth() + 1),
    padTwo(d.getUTCDate()),
  ].join('-');
}

function ageInDays(openedAt) {
  const opened = new Date(openedAt);
  const now = new Date();
  const diffMs = now.getTime() - opened.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function parseFrontMatter(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const m = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Validate common args for open/close: --record-into
// ---------------------------------------------------------------------------
function validateRecordInto(recordInto, repoPath) {
  if (!recordInto) die('--record-into is required');

  const absRecordInto = resolve(recordInto);
  if (!isGitWorktree(absRecordInto)) {
    die(
      '--record-into "' + absRecordInto + '" is not a git worktree (no .git entry). ' +
      'The dispatch file must ride in a PR; an untracked file left in the dev tree blocks ' +
      'its fast-forward (the known trap behind the 2026-09-04 FF blocker).'
    );
  }

  const realRepo = realOrNull(resolve(repoPath)) ?? resolve(repoPath);
  const realRecordInto = realOrNull(absRecordInto) ?? absRecordInto;
  if (realRepo === realRecordInto) {
    die(
      '--record-into resolves to the same path as --repo (' + realRepo + '). ' +
      'The dispatch file must ride in a PR worktree, not the dev tree. An untracked file ' +
      'left in the dev tree blocks the next fast-forward (the known trap behind the ' +
      '2026-09-04 FF blocker).'
    );
  }

  return absRecordInto;
}

// ---------------------------------------------------------------------------
// Subcommand: open
// ---------------------------------------------------------------------------
function cmdOpen() {
  const toArg       = (args['to']          ?? '').trim();
  const slugArg     = (args['slug']         ?? '').trim();
  const findingArg  = (args['finding']      ?? '').trim();
  const doneWhenArg = (args['done-when']    ?? '').trim();
  const fromArg     = (args['from']         ?? '').trim();
  const sourceArg   = (args['source']       ?? '').trim();
  const recordInto  =  args['record-into']  ?? '';
  const repoArg     =  args['repo']         ?? DEFAULT_REPO;

  if (!toArg)       die('--to is required');
  if (!slugArg)     die('--slug is required');
  if (!findingArg)  die('--finding must be non-empty and non-whitespace');
  if (!doneWhenArg) die('--done-when must be non-empty and non-whitespace');
  if (!fromArg)     die('--from is required');
  if (!sourceArg)   die('--source is required');

  // Validate slug format
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slugArg)) {
    die('--slug must match /^[a-z0-9][a-z0-9-]*$/ (got: "' + slugArg + '")');
  }

  // Zero-pad station number
  const toNum = String(parseInt(toArg, 10)).padStart(2, '0');
  if (isNaN(parseInt(toArg, 10))) {
    die('--to must be a station number (got: "' + toArg + '")');
  }

  const absRecordInto = validateRecordInto(recordInto, repoArg);

  // Build filename and id
  const now = new Date();
  const dateStr = utcDateStr(now);
  const id = dateStr + '-' + toNum + '-' + slugArg;
  const filename = id + '.md';

  const destDir = join(absRecordInto, 'docs', 'pipeline', 'dispatched');
  const destPath = join(destDir, filename);

  // Refuse duplicate
  if (existsSync(destPath)) {
    die('duplicate: destination already exists: ' + destPath + '. A dispatch with this date/to/slug is already open.');
  }

  const openedAt = isoNowSeconds();

  const body = [
    '---',
    'id: ' + id,
    'from: ' + fromArg,
    'to: ' + toNum,
    'opened_at: ' + openedAt,
    'finding: ' + findingArg,
    'done_when: ' + doneWhenArg,
    'source: ' + sourceArg,
    '---',
    '',
  ].join('\n');

  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  writeFileSync(destPath, body, { encoding: 'utf8', flag: 'wx' });

  // Success: print ONLY the written path to stdout.
  process.stdout.write(destPath + '\n');
}

// ---------------------------------------------------------------------------
// Subcommand: close
// ---------------------------------------------------------------------------
function cmdClose() {
  const idArg      = (args['id']           ?? '').trim();
  const byArg      = (args['by']           ?? '').trim();
  const evidenceArg = (args['evidence']    ?? '').trim();
  const recordInto  =  args['record-into'] ?? '';
  const repoArg     =  args['repo']        ?? DEFAULT_REPO;

  if (!idArg)       die('--id is required');
  if (!byArg)       die('--by is required');
  if (!evidenceArg) die('--evidence must be non-empty and non-whitespace; a record cannot be written without proof');

  const absRecordInto = validateRecordInto(recordInto, repoArg);

  const srcDir  = join(absRecordInto, 'docs', 'pipeline', 'dispatched');
  const srcPath = join(srcDir, idArg + '.md');

  // Refuse if source does not exist (not currently open)
  if (!existsSync(srcPath)) {
    const closedPath = join(srcDir, 'closed', idArg + '.md');
    if (existsSync(closedPath)) {
      die('--id "' + idArg + '" is already closed (file exists at closed/' + idArg + '.md)');
    }
    die('--id "' + idArg + '" is not an open dispatch (no file at ' + srcPath + ')');
  }

  // Read existing content to preserve front matter
  const existing = readFileSync(srcPath, 'utf8').replace(/\r\n/g, '\n');
  const fields = parseFrontMatter(existing);
  if (!fields) {
    die('could not parse front matter from ' + srcPath);
  }

  const closedAt = isoNowSeconds();

  // Build new content: preserve original front matter, append closed fields
  const newFrontMatter = [
    '---',
    'id: ' + (fields['id'] ?? idArg),
    'from: ' + (fields['from'] ?? ''),
    'to: ' + (fields['to'] ?? ''),
    'opened_at: ' + (fields['opened_at'] ?? ''),
    'finding: ' + (fields['finding'] ?? ''),
    'done_when: ' + (fields['done_when'] ?? ''),
    'source: ' + (fields['source'] ?? ''),
    'closed_at: ' + closedAt,
    'closed_by: ' + byArg,
    'evidence: ' + evidenceArg,
    '---',
    '',
  ].join('\n');

  const closedDir = join(srcDir, 'closed');
  const destPath  = join(closedDir, idArg + '.md');

  if (!existsSync(closedDir)) {
    mkdirSync(closedDir, { recursive: true });
  }

  // Atomic write-then-unlink pattern:
  // 1. Write to destination with 'wx' (fail if exists).
  // 2. Only then unlink the source.
  // 3. If destination write fails, do not touch source.
  // 4. If source unlink fails, delete destination and exit 1.
  try {
    writeFileSync(destPath, newFrontMatter, { encoding: 'utf8', flag: 'wx' });
  } catch (writeErr) {
    die('could not write closed file (' + writeErr.message + '). Source is untouched at ' + srcPath);
  }

  try {
    unlinkSync(srcPath);
  } catch (unlinkErr) {
    // Rollback: delete the destination we just wrote.
    try {
      unlinkSync(destPath);
    } catch (rollbackErr) {
      process.stderr.write(
        'dispatch: source unlink failed (' + unlinkErr.message + ') AND destination rollback ' +
        'also failed (' + rollbackErr.message + '). Manual intervention required. ' +
        'Source: ' + srcPath + ' Destination: ' + destPath + '\n'
      );
    }
    die('could not remove source file (' + unlinkErr.message + '). Destination has been rolled back.');
  }

  // Success: print ONLY the destination path to stdout.
  process.stdout.write(destPath + '\n');
}

// ---------------------------------------------------------------------------
// Subcommand: list
// ---------------------------------------------------------------------------
function cmdList() {
  const repoArg = args['repo'] ?? DEFAULT_REPO;
  const absRepo = resolve(repoArg);
  const dispatchedDir = join(absRepo, 'docs', 'pipeline', 'dispatched');

  if (!existsSync(dispatchedDir)) {
    // Not an error; list is informational.
    process.exit(0);
  }

  let entries;
  try {
    entries = readdirSync(dispatchedDir).filter((f) => f.endsWith('.md') && f !== 'README.md');
  } catch {
    process.exit(0);
  }

  if (entries.length === 0) {
    process.exit(0);
  }

  // Parse each entry and sort by opened_at ascending (oldest first).
  const dispatches = [];
  for (const filename of entries) {
    const filePath = join(dispatchedDir, filename);
    try {
      const text = readFileSync(filePath, 'utf8');
      const fields = parseFrontMatter(text);
      if (!fields) continue;
      dispatches.push({
        id: fields['id'] ?? basename(filename, '.md'),
        to: fields['to'] ?? '',
        opened_at: fields['opened_at'] ?? '',
        finding: fields['finding'] ?? '',
      });
    } catch {
      // Skip unreadable files silently.
    }
  }

  // Sort ascending by opened_at.
  dispatches.sort((a, b) => a.opened_at.localeCompare(b.opened_at));

  for (const d of dispatches) {
    const age = ageInDays(d.opened_at);
    process.stdout.write(
      d.id + '\tto=' + d.to + '\topened=' + d.opened_at + '\tage=' + age + 'd\tfinding=' + d.finding + '\n'
    );
  }
}

// ---------------------------------------------------------------------------
// Route subcommand
// ---------------------------------------------------------------------------
if (subcommand === 'open') {
  cmdOpen();
} else if (subcommand === 'close') {
  cmdClose();
} else if (subcommand === 'list') {
  cmdList();
} else {
  die('unknown subcommand "' + subcommand + '". Use: open, close, list');
}
