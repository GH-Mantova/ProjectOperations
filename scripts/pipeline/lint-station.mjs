#!/usr/bin/env node
// lint-station.mjs — the gate for STATION INSTRUCTION DOCS.
//
// docs/pr-prompts/* are gated by lint-prompt.mjs, which is why the prompt queue is trustworthy.
// docs/pipeline/stations/* had no gate at all — which is exactly why five pasted instruction
// copies drifted for weeks, four of them carrying advice this pipeline had already disproved.
//
//   node scripts/pipeline/lint-station.mjs                    # lint DOCTRINE + every station doc
//   node scripts/pipeline/lint-station.mjs <file> [...]       # lint specific docs
//   node scripts/pipeline/lint-station.mjs --write-canonical  # re-record the canonical hashes
//
// Exit 0 = ADMIT.  Exit 1 = REJECT.  Run from the repo root.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve, relative, sep } from 'node:path';

const ROOT = process.cwd();
const STATION_DIR = 'docs/pipeline/stations';
const DOCTRINE = 'docs/pipeline/DOCTRINE.md';
const CANON_FILE = join(STATION_DIR, '_canonical-blocks.json');

const C = process.stdout.isTTY
  ? { red: (s) => `\x1b[31m${s}\x1b[0m`, grn: (s) => `\x1b[32m${s}\x1b[0m`,
      yel: (s) => `\x1b[33m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m` }
  : { red: (s) => s, grn: (s) => s, yel: (s) => s, dim: (s) => s };

const REQUIRED_SECTIONS = [
  '## PREFLIGHT — run this before anything else',
  '## AUTHORITY — what this station may and may not do',
  "## REPORT CONTRACT — where this run's output goes",
  '## HARD STOPS — absolute, all stations',
];

const ALLOWED_WIN_ROOTS = [
  'C:\\ProjectOperations2', 'C:\\po-watcher', 'C:\\po-sup-fix-scripts', 'C:\\po-worktrees',
  'C:\\po-wt', 'C:\\po-wt-h', 'C:\\po-watcher-worktrees', 'C:\\Users\\Marco\\Claude\\Scheduled',
  'C:\\ProjectOperations-Reference',
];

const FORBIDDEN_OUTPUTS = ['docs/qa/qa-findings.md', 'docs/qa/qa-checklist.md'];

// A path is REAL only if git tracks it. `existsSync` passes for untracked and gitignored files
// that exist on one machine and nowhere else — which is precisely the defect this catches: the
// supervisor brief named docs/pr-prompts/queue-watch-state.md, present on Marco's disk, absent from
// every clone, from CI, and from any cloud-fired station reading the same instruction. Retired
// 2026-09-02: the station briefs now point at the tracked breadcrumbs instead. The check stays -
// it is what would catch the next one.
let TRACKED = null;
function isTracked(p) {
  if (TRACKED === null) {
    try {
      TRACKED = new Set(execSync('git ls-files', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
        .split('\n').map((x) => x.trim()).filter(Boolean));
    } catch {
      TRACKED = false;   // git unavailable — say so at the end rather than passing silently
    }
  }
  if (TRACKED === false) return existsSync(p);
  if (TRACKED.has(p)) return true;
  const dir = p.replace(/\/$/, '') + '/';
  for (const t of TRACKED) if (t.startsWith(dir)) return true;
  return false;
}

const sha = (s) => createHash('sha256').update(s.replace(/\r\n/g, '\n'), 'utf8').digest('hex').slice(0, 16);

const BLOCK_RE = (id) => new RegExp(
  `<!--\\s*CANONICAL-BLOCK:\\s*${id}\\s+v(\\d+)[^>]*-->([\\s\\S]*?)<!--\\s*END-CANONICAL-BLOCK:\\s*${id}\\s+v\\1\\s*-->`);

function frontMatter(text) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

// A path named inside an explicit gitignore warning is NOT a claim that the file exists —
// the point of naming it is that it is absent from a clean checkout.
const nearGitignore = (t, i) => /gitignor/i.test(t.slice(Math.max(0, i - 240), i + 240));

function repoPathsIn(text) {
  const found = new Set();
  for (const m of text.matchAll(/`([A-Za-z0-9_.\-]+(?:\/[A-Za-z0-9_.\-*]+)+)`/g)) {
    const p = m[1];
    if (p.includes('://') || p.includes('*')) continue;
    if (!/^(docs|scripts|apps|sot|packages|prisma|\.github)\//.test(p)) continue;
    if (/:\d+(-\d+)?$/.test(p)) continue;
    if (/^sot\/\d\d$/.test(p)) continue;        // `sot/05` is the established shorthand for sot/05-*.md
    if (nearGitignore(text, m.index)) continue;
    found.add(p);
  }
  for (const m of text.matchAll(/`((?:docs|scripts|apps|sot|packages|prisma|\.github)\/[A-Za-z0-9_.\-/]+):\d+(?:-\d+)?`/g)) {
    if (!nearGitignore(text, m.index)) found.add(m[1]);
  }
  return [...found];
}

function stationDocs() {
  if (!existsSync(STATION_DIR)) return [];
  return readdirSync(STATION_DIR).filter((f) => /^\d\d-[a-z0-9-]+\.md$/.test(f))
    .map((f) => join(STATION_DIR, f)).sort();
}

function lintOne(file, canon, collect) {
  const fails = [], warns = [];
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const isDoctrine = file.replace(/\\/g, '/').endsWith('DOCTRINE.md');
  const blocks = isDoctrine ? ['instruments'] : ['station-contract'];

  if (!isDoctrine) {
    const fm = frontMatter(text);
    if (!fm) {
      fails.push('no YAML front matter — expected station, station_doc_version, contract_version');
    } else {
      if (!fm.station) fails.push('front matter missing `station:`');
      for (const k of ['station_doc_version', 'contract_version']) {
        const v = Number(fm[k]);
        if (!Number.isInteger(v) || v < 1) fails.push(`front matter \`${k}\` must be an integer >= 1 (got ${JSON.stringify(fm[k])})`);
      }
      const base = file.split(/[\\/]/).pop().replace(/\.md$/, '');
      if (fm.station && fm.station !== base) fails.push(`front matter \`station: ${fm.station}\` does not match filename \`${base}\``);
    }
    for (const h of REQUIRED_SECTIONS) if (!text.includes(h)) fails.push(`missing required section heading: "${h}"`);
  }

  for (const id of blocks) {
    const m = text.match(BLOCK_RE(id));
    if (!m) { fails.push(`canonical block \`${id}\` missing, or its open/close markers disagree on version`); continue; }
    const digest = sha(m[2]);
    if (collect) { collect[id] = { version: Number(m[1]), sha: digest }; continue; }
    const want = canon[id];
    if (!want) { fails.push(`canonical block \`${id}\` has no recorded hash — run --write-canonical deliberately`); continue; }
    if (Number(m[1]) !== want.version) fails.push(`canonical block \`${id}\` is v${m[1]}, the recorded contract is v${want.version}`);
    else if (digest !== want.sha) fails.push(`canonical block \`${id}\` has been EDITED (sha ${digest}, expected ${want.sha}) — it is byte-identical across every station by design`);
  }

  for (const p of repoPathsIn(text)) {
    if (!isTracked(p)) fails.push(`names a repo path that git does not track: \`${p}\` — it may exist on one machine, but a clone, CI, and any cloud-fired station will not see it`);
  }

  for (const m of text.matchAll(/([A-Za-z]:\\[A-Za-z0-9_.\-\\ ]+)/g)) {
    const p = m[1].replace(/[ .]+$/, '');
    if (!ALLOWED_WIN_ROOTS.some((r) => p.toLowerCase().startsWith(r.toLowerCase())))
      warns.push(`names a Windows path outside the known folder map: ${p}`);
  }

  // EVERY occurrence must sit inside a gitignore warning, not just the first. The first is the
  // legitimate warning; a later "write your findings there" is the defect this check exists for.
  for (const bad of FORBIDDEN_OUTPUTS) {
    let from = 0;
    for (;;) {
      const i = text.indexOf(bad, from);
      if (i === -1) break;
      from = i + bad.length;
      if (!nearGitignore(text, i))
        fails.push(`line ${text.slice(0, i).split('\n').length}: mentions \`${bad}\` outside a gitignore warning — that path is gitignored and swallows findings`);
    }
  }

  if (/watcher-launcher\.ps1/.test(text) && !/watcher-launcher-singlelane\.ps1/.test(text))
    fails.push('names `watcher-launcher.ps1` without naming `watcher-launcher-singlelane.ps1` — singlelane is the real launcher');

  const fm2 = isDoctrine ? null : frontMatter(text);
  return { file, fails, warns, version: fm2 ? Number(fm2.station_doc_version) : null };
}

// ── main ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const writeCanonical = args.includes('--write-canonical');
const explicit = args.filter((a) => !a.startsWith('--'));
const targets = explicit.length ? explicit : [DOCTRINE, ...stationDocs()];

if (writeCanonical) {
  const collected = {};
  for (const f of [DOCTRINE, ...stationDocs()]) {
    if (!existsSync(f)) continue;
    lintOne(f, {}, collected);
    if (collected.instruments && collected['station-contract']) break;
  }
  for (const need of ['instruments', 'station-contract']) {
    if (!collected[need]) {
      console.error(C.red('REJECT') + `  cannot record canonical hashes: no source carries \`${need}\``);
      process.exit(1);
    }
  }
  writeFileSync(CANON_FILE, JSON.stringify(collected, null, 2) + '\n', 'utf8');
  console.log(C.grn('WROTE ') + `  ${CANON_FILE}`);
  for (const [k, v] of Object.entries(collected)) console.log(`          ${k} v${v.version} ${v.sha}`);
  process.exit(0);
}

if (!existsSync(CANON_FILE)) {
  console.error(C.red('REJECT') + `  ${CANON_FILE} is missing — run: node scripts/pipeline/lint-station.mjs --write-canonical`);
  process.exit(1);
}
const canon = JSON.parse(readFileSync(CANON_FILE, 'utf8'));

let bad = 0;
const versions = new Map();
for (const f of targets) {
  if (!existsSync(f)) { console.log(C.red('REJECT') + `  ${f} does not exist`); bad++; continue; }
  const r = lintOne(f, canon, null);
  if (r.version !== null) versions.set(f, r.version);
  const name = relative(ROOT, resolve(f)).split(sep).join('/');
  if (r.fails.length) {
    bad++;
    console.log(C.red('REJECT') + `  ${name}` + (r.version !== null ? C.dim(`  (v${r.version})`) : ''));
    for (const m of r.fails) console.log(`          ${C.red('x')} ${m}`);
  } else {
    console.log(C.grn('ADMIT ') + `  ${name}` + (r.version !== null ? C.dim(`  (v${r.version})`) : ''));
  }
  for (const m of r.warns) console.log(`          ${C.yel('!')} ${m}`);
}

// every station doc must declare the same contract version
const contractV = canon['station-contract']?.version;
const off = [...versions.entries()].filter(([, v]) => v !== contractV);
if (contractV && off.length) {
  console.log('');
  console.log(C.yel('NOTE  ') + `  contract is v${contractV}; these declare a different station_doc_version:`);
  for (const [f, v] of off) console.log(`          ${relative(ROOT, resolve(f)).split(sep).join('/')} -> v${v}`);
  console.log(C.dim('          the scheduled-task bootstrap must declare the same number, or the run goes read-only'));
}

console.log('');
if (TRACKED === false) console.log(C.yel('NOTE  ') + '  git ls-files was unavailable — fell back to filesystem existence, which is weaker');
console.log(bad ? C.red(`REJECT: ${bad} of ${targets.length} docs failed`) : C.grn(`ADMIT: all ${targets.length} docs clean`));
process.exit(bad ? 1 : 0);
