#!/usr/bin/env node
// queue-layout.mjs — shared constants for the prompt-queue layout standard.
//
// QUEUE_LAYOUT_LINE_AT_TODAY_V1
//
// This module is PURE: no I/O, no side effects on import.  It is the single
// source of truth for the queue layout constants; every other script imports
// from here rather than re-implementing.
//
// Decision record: docs/pipeline/QUEUE-LAYOUT.md
// "In force from 2026-10-02 (QUEUE_LAYOUT_LINE_AT_TODAY_V1)" section.

// ---------------------------------------------------------------------------
// Breadcrumb name regex — byte-identical copy from check-breadcrumb.mjs.
// check-breadcrumb.mjs RE-EXPORTS this symbol (`export { NAME_RE } from './queue-layout.mjs'`)
// so there is EXACTLY ONE definition; anything that needs it imports from either module.
//
// CASE-INSENSITIVE ON PURPOSE — see the measurement comment in check-breadcrumb.mjs.
// ---------------------------------------------------------------------------
export const NAME_RE = /^00-(\d\d)-([A-Za-z0-9-]+)-(\d{4}-\d{2}-\d{2})-(\d{4})-([A-Za-z0-9-]+)\.md$/;

// ---------------------------------------------------------------------------
// EXCEPTION_REASONS — the CLOSED vocabulary for exceptions/<reason>/ folders.
// Adding a new reason is a change to this constant AND to docs/pipeline/QUEUE-LAYOUT.md.
// It is never done by creating a new folder unilaterally.
// ---------------------------------------------------------------------------
export const EXCEPTION_REASONS = new Set([
  'needs-marco',
  'blocked',
  'failed',
  'paused',
  'no-pr-opened',
  'abandoned',
]);

// ---------------------------------------------------------------------------
// ROOT_FIXED_FILES — files that are permanently allowed at the queue root.
// These are infrastructure files that are not prompts, not reports, not HOLDs.
// Pattern "TEMPLATE-*.md" is matched by the classifier; the list here names
// the fixed (non-pattern) members only.
// ---------------------------------------------------------------------------
export const ROOT_FIXED_FILES = new Set([
  'README.md',
  'PROMPT-SCHEMA.md',
  'BACKLOG.yaml',
  'BACKLOG-DECISIONS.md',
  'ESCALATIONS.yaml',
  '.arming-log.txt',
  '.queue-sync-ledger.txt',
  'queue-watch-state.md',
  'shepherd-state.md',
]);

// ---------------------------------------------------------------------------
// classifyQueuePath(path)
//
// Takes a repo-relative path under docs/pr-prompts/ (the part AFTER the
// "docs/pr-prompts/" prefix) and returns { ok, state, reason }.
//
//   ok      — boolean; false means a VIOLATION.
//   state   — string label (see table in QUEUE-LAYOUT.md).
//   reason  — human-readable string: for violations, the rule that fired;
//             for warnings, a note (even though ok=true).
//   warn    — optional boolean; true when ok=true but a warning was emitted.
//
// The path argument must be normalised to forward slashes and must NOT include
// the "docs/pr-prompts/" prefix.  The caller is responsible for stripping it.
//
// Path classification rules (in order):
//   1. root *-HOLD.md                 → ok, hold
//   2. root matching breadcrumb NAME_RE → ok, report (in transit to archive/)
//   3. root file in ROOT_FIXED_FILES  → ok, queue-file
//   4. root TEMPLATE-*.md             → ok, queue-file
//   5. root *-ready.md                → VIOLATION (armed prompts never tracked)
//   6. any other root file            → VIOLATION (unknown root file)
//   7. archive/**                     → ok, report
//   8. superseded/**                  → ok, superseded
//   9. merged/**                      → ok, merged
//  10. draft/**                       → ok, draft
//  11. brainstorm/**                  → ok, brainstorm
//  12. exceptions/<reason>/**         → ok, exception  (reason in EXCEPTION_REASONS)
//  13. exceptions/<other>/**          → VIOLATION (unknown reason)
//  14. needs-marco/**                 → ok WITH WARNING (gitignored folder force-added)
//  15. binned-shipped-*/**,
//      processed/**, any other folder → VIOLATION (legacy or unknown folder)
// ---------------------------------------------------------------------------
export function classifyQueuePath(relPath) {
  // Normalise to forward-slash, strip leading slash if any.
  const p = relPath.replace(/\\/g, '/').replace(/^\/+/, '');

  const slashIdx = p.indexOf('/');
  const isRoot = slashIdx === -1;

  if (isRoot) {
    // Root-level file.
    const name = p;

    // 1. HOLD file
    if (name.endsWith('-HOLD.md')) {
      return { ok: true, state: 'hold', reason: 'root HOLD file' };
    }

    // 2. Breadcrumb (report in transit to archive/)
    if (NAME_RE.test(name)) {
      return { ok: true, state: 'report', reason: 'breadcrumb in transit to archive/' };
    }

    // 3. Fixed root files
    if (ROOT_FIXED_FILES.has(name)) {
      return { ok: true, state: 'queue-file', reason: 'infrastructure file' };
    }

    // 4. Template files
    if (name.startsWith('TEMPLATE-') && name.endsWith('.md')) {
      return { ok: true, state: 'queue-file', reason: 'template file' };
    }

    // 5. Armed prompts — never tracked
    if (name.endsWith('-ready.md')) {
      return {
        ok: false,
        state: 'violation',
        reason: 'armed prompts are never tracked; the rename is the dispatch',
      };
    }

    // 6. Any other root file
    return {
      ok: false,
      state: 'violation',
      reason: 'unknown root file; prompts go in draft/, HOLDs stay as root *-HOLD.md',
    };
  }

  // Subdirectory file — extract top-level folder.
  const folder = p.slice(0, slashIdx);

  // 7. archive/
  if (folder === 'archive') {
    return { ok: true, state: 'report', reason: 'archived report' };
  }

  // 8. superseded/
  if (folder === 'superseded') {
    return { ok: true, state: 'superseded', reason: 'superseded prompt' };
  }

  // 9. merged/
  if (folder === 'merged') {
    return { ok: true, state: 'merged', reason: 'merged prompt' };
  }

  // 10. draft/
  if (folder === 'draft') {
    return { ok: true, state: 'draft', reason: 'draft prompt' };
  }

  // 11. brainstorm/
  if (folder === 'brainstorm') {
    return { ok: true, state: 'brainstorm', reason: 'brainstorm note' };
  }

  // 12-13. exceptions/<reason>/
  if (folder === 'exceptions') {
    const afterExceptions = p.slice(slashIdx + 1); // "<reason>/..." or "<reason>"
    const reasonSlash = afterExceptions.indexOf('/');
    const reason = reasonSlash === -1 ? afterExceptions : afterExceptions.slice(0, reasonSlash);
    if (EXCEPTION_REASONS.has(reason)) {
      return { ok: true, state: 'exception', reason: 'exception: ' + reason };
    }
    return {
      ok: false,
      state: 'violation',
      reason: 'unknown exception reason "' + reason + '"; valid reasons: ' + [...EXCEPTION_REASONS].join(', '),
    };
  }

  // 14. needs-marco/ — gitignored folder, force-added; warn but allow.
  if (folder === 'needs-marco') {
    return {
      ok: true,
      state: 'exception',
      reason: 'gitignored folder force-added; prefer exceptions/needs-marco/',
      warn: true,
    };
  }

  // 15. Everything else — legacy or unknown folder.
  return {
    ok: false,
    state: 'violation',
    reason: 'legacy or unknown folder "' + folder + '"; nothing new goes here',
  };
}
