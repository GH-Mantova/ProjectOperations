#!/usr/bin/env node
// Lane-classification helper invoked by supervise-watcher.ps1.
//
// Shells out to node so that index.mjs remains the SINGLE source of truth for
// laneFor / laneHash / bodyNeedsSerialLane / readFixesPr / readPromptBody --
// the PowerShell watchdog does NOT re-implement these rules.
//
// Mirrors the writeQueueState path in index.mjs (lines 1121-1125): full body
// passed to laneFor, which passes it to bodyNeedsSerialLane. This is the
// authoritative "what this node owns" calculation that the queue-state file
// also uses; the watchdog must agree with it.
//
// Usage:
//   node lane-classify.mjs <promptDir> <lanes> <name1> [name2 ...]
//
// stdout: one JSON object per line:
//   { "name": "pr-100-foo-ready.md", "lane": 0 }
//   ...
//
// Exit 0 always (a classification error is printed to stderr and the prompt is
// conservatively assigned lane 0 so it never looks like a safe-to-ignore
// orphan for this lane's watchdog).
//
// Pure ASCII only -- no em-dashes / smart quotes / emoji.

import { laneFor, readFixesPr, readPromptBody } from './index.mjs';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const [,, promptDir, lanesArg, ...names] = process.argv;

const lanes = Number(lanesArg) >= 1 ? Number(lanesArg) : 2;

// isReviewJob mirrors the logic in index.mjs (not exported, so inline here).
function isReviewJob(name) {
  return /^rev-/i.test(name) || /-auto-review-ready\.md$/i.test(name);
}

for (const name of names) {
  try {
    const filePath = path.join(promptDir, name);
    const isReview = isReviewJob(name);
    const body = readPromptBody(filePath);
    const fixesPr = isReview ? null : readFixesPr(filePath, { readFileSyncImpl: readFileSync });
    const isFix = fixesPr !== null;
    // Mirror index.mjs writeQueueState path: pass full body to laneFor.
    const assignedLane = laneFor(name, { isFix, isReview, body, lanes });
    process.stdout.write(JSON.stringify({ name, lane: assignedLane }) + '\n');
  } catch (err) {
    process.stderr.write('lane-classify: error for ' + name + ': ' + err.message + '\n');
    // Conservatively assign lane 0: a misclassified prompt will be counted
    // by lane 0 and may trigger a spurious watchdog kill, but it will NEVER
    // be silently dropped as "another lane's orphan" when it is not.
    process.stdout.write(JSON.stringify({ name, lane: 0 }) + '\n');
  }
}
