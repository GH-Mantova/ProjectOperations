#!/usr/bin/env node
// check-breadcrumb.mjs — the REPORT CONTRACT, enforced.
//
// lint-station.mjs checks that a station DOC says where findings go.
// Nothing checked that a station RUN actually put them there. A station could
// skip its breadcrumb entirely and the silence was indistinguishable from a
// healthy quiet run — the same shape as the defect the contract exists to stop.
//
//   node scripts/pipeline/check-breadcrumb.mjs              # structure-check tracked breadcrumbs (CI)
//   node scripts/pipeline/check-breadcrumb.mjs --freshness  # + which stations have gone silent (local)
//   node scripts/pipeline/check-breadcrumb.mjs --station 04
//
// Exit 0 = clean.  Exit 1 = a breadcrumb is malformed.  Exit 2 = a station is silent
// (only with --freshness; never in CI, where no station has run).
//
// Run from the repo root.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = 'docs/pr-prompts';
const ROOT = process.cwd();

// The report contract became real when PR #1309 merged at 2026-08-24T22:26Z.
// Breadcrumbs written before it are NOT retroactively failed: introducing a gate by
// declaring existing history broken teaches everyone to ignore the gate.
//
// The cutover is the following MIDNIGHT, not the merge minute. A Station 04 run wrote
// its breadcrumb at 22:16Z — ten minutes before the rule existed — having started
// earlier still, reading the old doc. Any boundary inside that window fails a run that
// could not possibly have complied. Midnight is the first unambiguously fair line.
const CONTRACT_FROM = '2026-08-25T0000';

// station -> cadence in hours. A station is SILENT past 2x its cadence.
const CADENCE = { '00': 2, '02': null, '03': 24, '04': 4, '05': 24 };

const SECTIONS = ['## GROUND', '## WHAT I MEASURED', '## WHAT CHANGED', '## FINDINGS', '## WHAT I DID NOT DO'];
const DISPOSITIONS = ['ACTIONED', 'DISPATCHED', 'ESCALATED', 'DEFERRED'];
// CASE-INSENSITIVE ON PURPOSE. This regex is the validator's ONLY gate: a file it does not
// match is not validated, not counted, and invisible to --freshness. The station segment and
// the slug were `[a-z0-9-]+`, so any breadcrumb with a capital in its name fell straight
// through — and stations capitalise exactly when the news is loud. Four post-contract reports
// named `...-BLIND-no-dc-...` were silently unvalidated, and three of them turn out to be
// missing sections nobody ever flagged. Measured 2026-08-29: 37 of 149 `00-*` files on main
// failed this pattern. A validator that skips the reports its own authors SHOUTED is worse
// than no validator, because its CLEAN reads as coverage. Widened, never narrowed.
export const NAME_RE = /^00-(\d\d)-([A-Za-z0-9-]+)-(\d{4}-\d{2}-\d{2})-(\d{4})-([A-Za-z0-9-]+)\.md$/;

// The gitignored-sink gate. A finding is only routed into a gitignored channel when the
// path is preceded by a routing verb + destination preposition — writing/reporting/logging
// INTO the file. A prose mention that DISCUSSES a gitignored path (e.g. "runs where
// docs/qa/qa-checklist.md is absent") is a legitimate finding, not a routing act, and must
// not be rejected. The prior implementation used a +/-200-char proximity scan for the word
// "gitignor" and rejected every mention that fell outside the window — punishing exactly
// the class of finding this contract exists to encourage.
export const ROUTING_VERBS = /(?:write|writes|written|wrote|report|reports|reported|route|routes|routed|log|logs|logged|append|appends|appended|record|records|recorded|output|outputs|save|saves|saved|put|puts|file|files|filed)\s+(?:it\s+|them\s+|this\s+|findings?\s+|the\s+\w+\s+)?(?:to|into|in|at|under)\s*$/i;
const GITIGNORED_PATHS = ['docs/qa/qa-findings.md', 'docs/qa/qa-checklist.md'];

// Exported for unit testing. Returns an array of "line N: ..." failure strings.
// A mention passes if EITHER (a) the path is not preceded by a routing construction, OR
// (b) the surrounding +/-200-character window notes that the path is gitignored — the
// original escape hatch, kept intact so nothing that passed before starts failing.
export function checkGitignoredSink(text) {
  const fails = [];
  for (const bad of GITIGNORED_PATHS) {
    let from = 0;
    for (;;) {
      const i = text.indexOf(bad, from);
      if (i === -1) break;
      from = i + bad.length;
      const before = text.slice(Math.max(0, i - 80), i);
      const window = text.slice(Math.max(0, i - 200), i + 200);
      const routedInto = ROUTING_VERBS.test(before);
      const gitignoreNoted = /gitignor/i.test(window);
      if (routedInto && !gitignoreNoted) {
        fails.push(`line ${text.slice(0, i).split('\n').length}: routes findings to \`${bad}\`, which is gitignored`);
      }
    }
  }
  return fails;
}

const C = process.stdout.isTTY
  ? { red: (s) => `\x1b[31m${s}\x1b[0m`, grn: (s) => `\x1b[32m${s}\x1b[0m`, yel: (s) => `\x1b[33m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m` }
  : { red: (s) => s, grn: (s) => s, yel: (s) => s, dim: (s) => s };

// What has actually LANDED. Prefer origin/main: this repo's index AND working
// directory both lag main, and a lagging read produced three separate false
// verdicts — a false UNTRACKED, a false ok on a breadcrumb that never landed, and
// a false SILENT on station 00 (measured 2026-08-29T08:09Z: dev tree 3 behind, the
// 0608 breadcrumb present on main and absent from disk).
// `-r` is mandatory: `git ls-tree` without it returns the tree entry, not its
// contents, and any filter over that reports zero (DOCTRINE §9.2).
// Falls back to the local index so a shallow CI checkout with no `origin/main`
// keeps the previous behaviour instead of silently losing the check.
function tracked() {
  const probes = [`git ls-tree -r --name-only origin/main -- ${DIR}`, `git ls-files ${DIR}`];
  for (const cmd of probes) {
    try {
      const set = new Set(execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 })
        .split('\n').map((s) => s.trim()).filter(Boolean));
      if (set.size) return set;
    } catch { /* instrument unavailable — try the next one */ }
  }
  return null;
}

// A breadcrumb inside an OPEN PR is in neither of the other two inputs, and that is not a
// corner case - it is the normal life of a breadcrumb. MEASURED 2026-09-04: files do not enter
// a working tree when they are written; they arrive when a board PR merges and the tree syncs.
// Four breadcrumbs named 0109/0209/0309/0409 carried dev-tree mtimes of 02:15/04:11/04:11/04:21
// - two names an hour apart sharing one mtime to the second is a BATCH ARRIVAL, not authoring.
// So `onDisk` runs on the same merge clock as `origin/main`, just a little later, and on
// 2026-09-04T00:09Z BOTH were blind to 05's 21:54 breadcrumb: it reached main at 01:55 inside
// #1554. Station 05 was reported SILENT at 58h while healthy, twice, and two supervisor runs
// were preparing to escalate a stopped station. A false SILENT licenses destructive action
// (DOCTRINE 7), and the error is UNBOUNDED - a breadcrumb held in an open PR ages its station
// forever. The station contract calls "inside your own run's PR" the BEST home for a
// breadcrumb, so obeying the contract is what caused the false alarm.
//
// Marco's ruling 2026-09-04, option (a) on escalation
// `needs-marco/discharged/freshness-silent-is-merge-latency-2026-09-04.md`.
//
// `gh pr list --json files` is used rather than `git ls-tree <headRef>` ON PURPOSE: a head ref
// that has never been fetched is not in this tree, so the git form would reproduce the same
// per-tree blindness one level down. This asks GitHub, which always knows.
//
// FRESHNESS ONLY. CI runs this script with no --freshness and has no `gh` auth; widening the
// set there would buy nothing and add a failure mode to a required check.
export function breadcrumbsFromPrFiles(prs, dir, nameRe) {
  const out = [];
  for (const pr of Array.isArray(prs) ? prs : []) {
    for (const f of Array.isArray(pr && pr.files) ? pr.files : []) {
      const path = typeof f === 'string' ? f : (f && f.path);
      if (typeof path !== 'string' || !path.startsWith(dir + '/')) continue;
      const base = path.slice(path.lastIndexOf('/') + 1);
      if (nameRe.test(base)) out.push(base);
    }
  }
  return out;
}

// Impure wrapper. ANY failure - gh absent, unauthenticated, rate-limited, offline, bad JSON -
// degrades to [], i.e. exactly today's behaviour. It must never turn a working check into a
// failing one; a widened set is an improvement, not a dependency.
function fromOpenPrs() {
  try {
    const raw = execSync('gh pr list --state open --limit 100 --json files', {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024,
    });
    return breadcrumbsFromPrFiles(JSON.parse(raw), DIR, NAME_RE);
  } catch { return []; }
}

function checkOne(file, name) {
  const fails = [];
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

  if (!/^# Station \d\d/m.test(text)) fails.push('no `# Station <NN>` heading');

  // sections present AND in order — order is what makes a report skimmable
  let last = -1;
  for (const s of SECTIONS) {
    const i = text.indexOf(s);
    if (i === -1) { fails.push(`missing section: ${s}`); continue; }
    if (i < last) fails.push(`section out of order: ${s}`);
    last = i;
  }

  // every finding carries a disposition
  const fi = text.indexOf('## FINDINGS');
  if (fi !== -1) {
    const end = SECTIONS.slice(SECTIONS.indexOf('## FINDINGS') + 1)
      .map((s) => text.indexOf(s)).find((i) => i > fi) ?? text.length;
    const body = text.slice(fi, end);
    const nothing = /\b(none|nothing|no findings)\b/i.test(body) && body.length < 400;
    const found = DISPOSITIONS.filter((d) => body.includes(d)).length;
    if (!nothing && found === 0) {
      fails.push('FINDINGS section carries no disposition — every finding must end in ACTIONED / DISPATCHED / ESCALATED / DEFERRED, or say plainly there were none');
    }
  }

  // never route findings into a gitignored channel — see checkGitignoredSink above
  for (const fail of checkGitignoredSink(text)) fails.push(fail);
  return fails;
}

// ── main ─────────────────────────────────────────────────────────────────────
// Guard: only run the CLI when invoked directly. Importing this module from a
// test (or any other consumer) must not execute the breadcrumb sweep.
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) main();

function main() {
const args = process.argv.slice(2);
const freshness = args.includes('--freshness');
const only = (() => { const i = args.indexOf('--station'); return i === -1 ? null : args[i + 1]; })();

if (!existsSync(DIR)) { console.error(C.red('REJECT') + `  ${DIR} does not exist`); process.exit(1); }

const trackedSet = tracked();
// Freshness must count breadcrumbs that LANDED on main but are not in THIS working
// directory, or a tree behind main reports a station SILENT on the very run whose
// breadcrumb just merged. Structural checks still run only on files present on
// disk — a file we cannot read cannot be validated.
const onDisk = readdirSync(DIR).filter((f) => NAME_RE.test(f));
const fromMain = trackedSet
  ? [...trackedSet].map((p) => p.slice(p.lastIndexOf('/') + 1)).filter((f) => NAME_RE.test(f))
  : [];
// Structural checks still run only on files present on disk (the loop skips anything absent):
// a file we cannot read cannot be validated. Only the FRESHNESS set widens.
const fromPrs = freshness ? fromOpenPrs() : [];
const all = [...new Set([...onDisk, ...fromMain, ...fromPrs])];
const newest = new Map();
let bad = 0, checked = 0, skipped = 0;

for (const f of all.sort()) {
  const m = f.match(NAME_RE);
  const [, nn, , date, hhmm] = m;
  if (only && nn !== only) continue;

  // record freshness from ALL breadcrumbs, including pre-contract ones
  const stamp = `${date}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`;
  const prev = newest.get(nn);
  if (!prev || stamp > prev.stamp) newest.set(nn, { stamp, file: f });

  // Landed on main, absent from this working tree: it counts for freshness and
  // is by definition tracked, so there is nothing left to check here.
  if (!existsSync(`${DIR}/${f}`)) continue;

  if (`${date}T${hhmm}` < CONTRACT_FROM) { skipped++; continue; }
  if (trackedSet && !trackedSet.has(`${DIR}/${f}`)) {
    console.log(C.yel('NOTE  ') + `  ${f} is UNTRACKED — it reaches nobody until a board PR commits it`);
  }
  checked++;
  const fails = checkOne(`${DIR}/${f}`, f);
  if (fails.length) {
    bad++;
    console.log(C.red('REJECT') + `  ${f}`);
    for (const x of fails) console.log(`          ${C.red('x')} ${x}`);
  } else {
    console.log(C.grn('ADMIT ') + `  ${f}`);
  }
}

console.log('');
console.log(`structure: ${checked} checked, ${bad} malformed, ${skipped} skipped as pre-contract (before ${CONTRACT_FROM})`);

let silent = 0;
if (freshness) {
  console.log('');
  console.log('freshness (a station is SILENT past 2x its cadence):');
  const now = Date.now();
  for (const [nn, hrs] of Object.entries(CADENCE)) {
    if (only && nn !== only) continue;
    if (hrs === null) { console.log(`  ${nn}  ${C.dim('dispatch-only — no cadence to miss')}`); continue; }
    const n = newest.get(nn);
    if (!n) { silent++; console.log(`  ${nn}  ${C.red('NO BREADCRUMB EVER')}`); continue; }
    const ageH = (now - Date.parse(n.stamp)) / 3.6e6;
    const over = ageH > hrs * 2;
    if (over) silent++;
    console.log(`  ${nn}  last ${n.stamp}  ${ageH.toFixed(1)}h ago  (cadence ${hrs}h)  ${over ? C.red('SILENT') : C.grn('ok')}`);
  }
  if (silent) {
    console.log('');
    console.log(C.yel('  A silent station is not a quiet one. Either it did not run, or it ran and did not report.'));
    console.log(C.yel('  Both are defects. Station 00: disposition this.'));
  }
}

console.log('');
if (bad) { console.log(C.red(`REJECT: ${bad} malformed breadcrumb(s)`)); process.exit(1); }
if (silent) { console.log(C.yel(`SILENT: ${silent} station(s) past cadence`)); process.exit(2); }
console.log(C.grn('CLEAN'));
process.exit(0);
}
