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
const CADENCE = { '00': 2, '02': null, '03': 4, '04': 4, '05': 24 };

const SECTIONS = ['## GROUND', '## WHAT I MEASURED', '## WHAT CHANGED', '## FINDINGS', '## WHAT I DID NOT DO'];
const DISPOSITIONS = ['ACTIONED', 'DISPATCHED', 'ESCALATED', 'DEFERRED'];
const NAME_RE = /^00-(\d\d)-([a-z0-9-]+)-(\d{4}-\d{2}-\d{2})-(\d{4})-([a-z0-9-]+)\.md$/;

const C = process.stdout.isTTY
  ? { red: (s) => `\x1b[31m${s}\x1b[0m`, grn: (s) => `\x1b[32m${s}\x1b[0m`, yel: (s) => `\x1b[33m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m` }
  : { red: (s) => s, grn: (s) => s, yel: (s) => s, dim: (s) => s };

function tracked() {
  try {
    return new Set(execSync(`git ls-files ${DIR}`, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
      .split('\n').map((s) => s.trim()).filter(Boolean));
  } catch { return null; }
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

  // never route findings into a gitignored channel
  for (const bad of ['docs/qa/qa-findings.md', 'docs/qa/qa-checklist.md']) {
    let from = 0;
    for (;;) {
      const i = text.indexOf(bad, from);
      if (i === -1) break;
      from = i + bad.length;
      if (!/gitignor/i.test(text.slice(Math.max(0, i - 200), i + 200))) {
        fails.push(`line ${text.slice(0, i).split('\n').length}: routes findings to \`${bad}\`, which is gitignored`);
      }
    }
  }
  return fails;
}

// ── main ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const freshness = args.includes('--freshness');
const only = (() => { const i = args.indexOf('--station'); return i === -1 ? null : args[i + 1]; })();

if (!existsSync(DIR)) { console.error(C.red('REJECT') + `  ${DIR} does not exist`); process.exit(1); }

const trackedSet = tracked();
const all = readdirSync(DIR).filter((f) => NAME_RE.test(f));
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
