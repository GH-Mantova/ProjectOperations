#!/usr/bin/env node
// check-agent-doctrine.mjs — the compiled station agents must POINT at the doctrine, never carry it.
//
// WHY THIS EXISTS (measured 2026-08-31):
//   .claude/agents/{00..05}.md each carried TWO embedded copies of the shared doctrine, both
//   encoding-damaged, both frozen at §7.1 — so every station spawned from them was acting on a
//   stale, corrupted excerpt with §8, §9 and §10 missing entirely. They referenced
//   docs/pipeline/DOCTRINE.md ZERO times. The copies had been frozen since 2026-08-17 while the
//   real doctrine grew from 99 lines to 645, and NO instrument measured the gap.
//
//   An embedded copy of a living document always drifts. The only fix that holds is to forbid the
//   copy and gate the ban. That is this file.
//
// CONTRACT, per numbered station agent (.claude/agents/NN-*.md):
//   1. NO embedded doctrine  — no line-start markdown heading matching a DOCTRINE section title.
//   2. A POINTER            — at least one reference to docs/pipeline/DOCTRINE.md.
//   3. Front matter intact  — the file still starts with '---' or it will not register as an agent.
//
// DOCTRINE §7: an instrument that cannot fail is not evidence. This runs a POSITIVE CONTROL
// (a synthetic agent carrying a copy MUST be flagged) and a NEGATIVE CONTROL (a synthetic
// compliant agent MUST pass) before it reports on the real files. If either control misbehaves,
// it exits 2 — [CANNOT MEASURE] — rather than printing a clean bill of health it cannot support.

import fs from 'fs';
import path from 'path';

const ROOT = process.argv[2] ?? process.cwd();
const DIR = path.join(ROOT, '.claude', 'agents');
const DOCTRINE_REF = 'docs/pipeline/DOCTRINE.md';

// A line-start markdown heading naming a doctrine section == an embedded copy.
const EMBEDDED = /^#{1,3}\s*\d+(\.\d+)?\.\s+(THE READ-BACK RULE|EVIDENCE, NOT ASSERTION|NEVER DIAGNOSE FROM SILENCE|STAY IN YOUR STATION|.*HARD STOPS|NEVER EXIT SILENTLY)/mi;

function violations(text) {
  const v = [];
  if (EMBEDDED.test(text)) v.push('carries an EMBEDDED doctrine copy (a doctrine section heading is present)');
  if (!text.includes(DOCTRINE_REF)) v.push(`has NO pointer to ${DOCTRINE_REF}`);
  if (!text.startsWith('---')) v.push('front matter missing — it will not register as an agent');
  return v;
}

// ---- controls, before any real reading ----
const CONTROL_BAD = `---\nname: x\n---\n# X\n\n## 1. THE READ-BACK RULE\nbody\n`;
const CONTROL_GOOD = `---\nname: x\n---\n# X\n\nRead ${DOCTRINE_REF} from origin/main before acting.\n`;
const badFired = violations(CONTROL_BAD).some(s => s.startsWith('carries an EMBEDDED'));
const goodClean = violations(CONTROL_GOOD).length === 0;
console.log(`controls: positive(copy is caught)=${badFired}  negative(pointer passes)=${goodClean}`);
if (!badFired || !goodClean) {
  console.error('[CANNOT MEASURE] the detector failed its own controls — not reporting on real files.');
  process.exit(2);
}

// ---- the real files ----
if (!fs.existsSync(DIR)) { console.error(`[CANNOT MEASURE] no ${DIR}`); process.exit(2); }
const agents = fs.readdirSync(DIR).filter(f => /^\d\d-.*\.md$/.test(f)).sort();
if (agents.length === 0) { console.error(`[CANNOT MEASURE] no numbered station agents in ${DIR}`); process.exit(2); }

let failed = 0;
for (const f of agents) {
  const text = fs.readFileSync(path.join(DIR, f), 'utf8');
  const v = violations(text);
  if (v.length) { failed++; console.log(`REJECT  ${f}`); for (const x of v) console.log(`          - ${x}`); }
  else console.log(`ADMIT   ${f}`);
}

console.log(`\n${agents.length} station agent(s) checked, ${failed} in violation.`);
if (failed) {
  console.error('\nThe doctrine lives in docs/pipeline/DOCTRINE.md and nowhere else. Replace the copy with a');
  console.error('pointer — see .claude/agents/06-pr-master.md for the shape.');
  process.exit(1);
}
console.log('Every station agent points at the doctrine and carries no copy. This is the boring, correct outcome.');
