#!/usr/bin/env node
// next-sweep.mjs — tells Station 04 which named sweep to run, and advances the rotation.
//
// "Take one sweep and rotate" is not implementable as an instruction alone: a fresh
// run has no memory, so it picks the first entry every time. That narrows coverage
// WITHOUT rotating it - gate liveness gets checked forever and instruction drift
// never does, which is strictly worse than the shallow-everything pass it replaced.
// The rotation needs state. This is it.
//
//   node scripts/pipeline/next-sweep.mjs             # print the sweep to run now
//   node scripts/pipeline/next-sweep.mjs --advance   # ...and record that it ran
//   node scripts/pipeline/next-sweep.mjs --status    # show the whole rotation
//
// Run from the repo root.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const FILE = 'docs/pipeline/sweep-rotation.json';
const args = process.argv.slice(2);
const advance = args.includes('--advance');
const status = args.includes('--status');
const stampArg = (() => { const i = args.indexOf('--utc'); return i === -1 ? null : args[i + 1]; })();

if (!existsSync(FILE)) {
  console.error(`REJECT  ${FILE} is missing — the rotation has no state, so "rotate" cannot mean anything`);
  process.exit(1);
}

const raw = readFileSync(FILE, 'utf8');
const state = JSON.parse(raw);
const n = state.sweeps.length;
if (!n) { console.error('REJECT  no sweeps defined'); process.exit(1); }

const next = (Number(state.last_index) + 1 + n * 2) % n;   // -1 -> 0 on first ever run
const sweep = state.sweeps[next];

if (status) {
  console.log(`rotation: ${n} sweeps | last_index=${state.last_index} | last_run=${state.last_run_utc ?? 'never'}`);
  state.sweeps.forEach((s, i) => {
    const mark = i === next ? '-> NEXT' : (i === state.last_index ? '   last' : '       ');
    console.log(`  ${mark}  [${i}] ${s.key.padEnd(20)} ${s.title}`);
  });
  process.exit(0);
}

console.log(`SWEEP: ${sweep.key}`);
console.log(`TITLE: ${sweep.title}`);
console.log('');
console.log(sweep.brief);
console.log('');
console.log(`(rotation position ${next + 1} of ${n}; previous run: ${state.last_run_utc ?? 'never'})`);

if (advance) {
  // The caller supplies the timestamp. This script does not invent one - a run that
  // stamps its own clock can claim any time it likes, and the point of the record
  // is that Station 00 can trust it.
  if (!stampArg) {
    console.error('');
    console.error('REJECT  --advance requires --utc <ISO timestamp> — pass the time you actually measured');
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/.test(stampArg)) {
    console.error('');
    console.error(`REJECT  --utc must look like 2026-08-24T23:45:00Z (got ${JSON.stringify(stampArg)})`);
    process.exit(1);
  }
  state.last_index = next;
  state.last_run_utc = stampArg;
  state.last_station = '04-scanner';
  const crlf = raw.includes('\r\n');
  let out = JSON.stringify(state, null, 2) + '\n';
  if (crlf) out = out.replace(/\n/g, '\r\n');
  writeFileSync(FILE, out, 'utf8');
  console.log('');
  console.log(`advanced: last_index=${next} last_run_utc=${stampArg}`);
  // This line used to read "COMMIT THIS FILE with your breadcrumb". 04-scanner.md:162-164 was
  // corrected to say the opposite — 04 leaves it dirty and Station 00 commits it — but the tool
  // was not, so the last line on 04's screen told it to do the one thing it is forbidden to do.
  console.log('LEFT DIRTY: name this file in your breadcrumb. Station 00 commits it with the next');
  console.log('board PR — the station that ran this sweep must not commit to the shared dev tree.');
}
