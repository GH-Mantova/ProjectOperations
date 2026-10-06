#!/usr/bin/env node
// marco-queue.mjs — MARCO_QUEUE_LINE_V1 (Marco, 2026-10-03).
//
// Count the PRs waiting on Marco (open, non-draft, labelled do-not-merge) and all open
// non-draft PRs, plus the oldest in each set. REPORT ONLY — nothing gates on these numbers.
//
// Pure function + thin CLI. The sweep (status-sweep.ps1 section 1) feeds this a JSON array
// from `gh pr list --state open --json number,isDraft,labels,createdAt`.
//
//   node scripts/pipeline/marco-queue.mjs --now <iso> --file <json path>
//
// Exits:
//   0  — printed both lines.
//   2  — the input file is unreadable or not an array. Prints `[CANNOT MEASURE] <reason>`;
//        NEVER prints a zero count on failure (zero and unknown are different answers).

import { readFileSync } from 'node:fs';

export function marcoQueue(prs, nowIso) {
  if (!Array.isArray(prs)) {
    throw new TypeError('marcoQueue: prs must be an array');
  }
  const nowMs = parseIso(nowIso);
  if (Number.isNaN(nowMs)) {
    throw new TypeError('marcoQueue: nowIso must be a parseable ISO timestamp');
  }

  const nonDraft = prs.filter((p) => !p.isDraft);
  const waiting = nonDraft.filter((p) =>
    Array.isArray(p.labels) && p.labels.some((l) => l && l.name === 'do-not-merge'),
  );

  return {
    waiting: { count: waiting.length, oldest: pickOldest(waiting, nowMs) },
    open: { count: nonDraft.length, oldest: pickOldest(nonDraft, nowMs) },
  };
}

function parseIso(iso) {
  // The sweep's $nowUtc is "yyyy-MM-dd HH:mm:ssZ" (space, not T). Node parses that in current
  // engines but ECMA-262 does not require it; normalise so this never silently returns NaN.
  const normalised = typeof iso === 'string' ? iso.replace(' ', 'T') : iso;
  return Date.parse(normalised);
}

function pickOldest(list, nowMs) {
  if (list.length === 0) return null;
  let best = null;
  for (const p of list) {
    const createdMs = Date.parse(p.createdAt);
    if (Number.isNaN(createdMs)) continue;
    const hours = Math.floor((nowMs - createdMs) / 3_600_000);
    if (best === null || hours > best.hours) {
      best = { number: p.number, hours };
    }
  }
  return best;
}

export function formatLines(result) {
  // "open <N>h" means "open for N hours", not "waiting for N hours". The waiting label on a
  // PR arrived at some point after it was created, and gh does not record when; the honest
  // thing to say is how long the PR has existed.
  const w = result.waiting;
  const o = result.open;
  const waitingLine = w.count === 0 || !w.oldest
    ? `WAITING ON MARCO: ${w.count} open PR(s) labelled do-not-merge`
    : `WAITING ON MARCO: ${w.count} open PR(s) labelled do-not-merge; oldest #${w.oldest.number}, open ${w.oldest.hours}h`;
  const openLine = o.count === 0 || !o.oldest
    ? `ALL OPEN (non-draft): ${o.count}`
    : `ALL OPEN (non-draft): ${o.count}; oldest #${o.oldest.number}, open ${o.oldest.hours}h`;
  return [waitingLine, openLine];
}

function parseArgs(argv) {
  const out = { now: null, file: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--now') out.now = argv[++i];
    else if (a === '--file') out.file = argv[++i];
  }
  return out;
}

function main() {
  const { now, file } = parseArgs(process.argv.slice(2));
  if (!now || !file) {
    console.log('WAITING ON MARCO: [CANNOT MEASURE] usage: marco-queue.mjs --now <iso> --file <path>');
    process.exit(2);
  }
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (err) {
    console.log(`WAITING ON MARCO: [CANNOT MEASURE] cannot read ${file}: ${err.message}`);
    process.exit(2);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.log(`WAITING ON MARCO: [CANNOT MEASURE] ${file} is not JSON: ${err.message}`);
    process.exit(2);
  }
  let result;
  try {
    result = marcoQueue(parsed, now);
  } catch (err) {
    console.log(`WAITING ON MARCO: [CANNOT MEASURE] ${err.message}`);
    process.exit(2);
  }
  for (const line of formatLines(result)) console.log(line);
  process.exit(0);
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
