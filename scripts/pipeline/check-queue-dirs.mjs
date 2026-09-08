#!/usr/bin/env node
// check-queue-dirs.mjs — a pipeline script may not READ a queue subdirectory that no pipeline
// script WRITES. A count from a directory with no producer is [CANNOT MEASURE], never 0.
//
// WHY THIS EXISTS (measured 2026-09-01 at 1efd079c):
//   Three separate scripts counted files in docs/pr-prompts/in-progress/ — a directory
//   scripts/pr-watcher/index.mjs never creates and never files a prompt into. Get-ChildItem
//   returned nothing, every one of them printed 0, and a zero is indistinguishable from a real
//   measurement once it leaves the line that produced it:
//     - scripts/pipeline/status-sweep.ps1        fed $boardBusy and the DO NOT ACT verdict
//     - scripts/pr-watcher/supervise-watcher.ps1 fed the watchdog's "a build is running, not hung"
//     - a station board-sweep                    reported "queue empty" while a prompt sat armed
//   Two of the three gated a safety decision. Each was fixed by hand, one at a time. Nothing
//   stopped the fourth. This is the thing that stops the fourth.
//
// DOCTRINE 9.6: an empty result is not an empty world.
//
// THE BUG CLASS, STATED EXACTLY. Not "a read without a writer" — that is too wide. It is *a count
// from a directory no code path can ever populate*, which is therefore always 0 and always
// meaningless. A directory that carries committed files answers with a real number even though no
// script writes it, and is not this bug.
//
// THE RULE, three-way. Derive the first two sets by READING THE SOURCE — never a hard-coded
// allowlist:
//   PRODUCERS  subdirectory names some script CREATES or WRITES INTO.
//   CONSUMERS  subdirectory names some script READS, COUNTS or ITERATES.
// Then for each CONSUMER name:
//   1. in PRODUCERS                        -> fine. A script populates it.
//   2. not in PRODUCERS, but COMMITTED TO
//      THE REPOSITORY WITH CONTENT         -> fine. Committed files cannot silently answer 0.
//                                            docs/pr-prompts/superseded/ is this case: 360 tracked
//                                            files, retired there by board PRs, never by a script.
//   3. neither                             -> VIOLATION. Nothing writes it and it is not in the
//                                            repo, so a count from it is [CANNOT MEASURE], not 0.
//                                            docs/pr-prompts/in-progress/ is this case.
//
// A static allowlist would be the same bug one level up: it goes stale the moment index.mjs adds
// or renames a destination, and written today it would have passed all three defects above.
// Case 2 is a MEASUREMENT, not an exception list — nothing here names a directory.
//
// WHY THE CASE-2 PROBE IS NOT THE BANNED ONE (DOCTRINE 9.2). The banned probe is `git ls-tree` used
// to decide whether a directory EXISTS: given a glob pathspec it returns nothing at exit 0, so it
// reports "absent" and "empty" identically and passes its own positive control while doing it. This
// asks a different question — DOES THIS PATH CARRY COMMITTED FILES — and answers it with
// `git ls-files -- <dir>/`, a trailing slash and NO GLOB, reading the LINE COUNT, never the exit
// code (the nonsense probe below also exits 0; only its count is 0). The probe carries its own
// positive/negative control pair, printed on every run beside the analyzer's two. If the git call
// fails at all, that is exit 2 [CANNOT MEASURE] — a failed probe never becomes a silent pass.
//
// DOCTRINE 7: an instrument that cannot fail is not evidence. A POSITIVE CONTROL (a synthetic
// consumer of a directory nothing writes MUST be flagged) and a NEGATIVE CONTROL (a synthetic
// consumer of a directory that IS written MUST NOT be flagged) run through this exact analyzer on
// every invocation, before any real file is read, and both outcomes are printed pass or fail.
//
// EXIT  0 clean   1 violation   2 [CANNOT MEASURE]

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const ROOT = process.argv[2] ?? process.cwd();
const SCAN_DIRS = [
  ['scripts', 'pipeline'],
  ['scripts', 'pr-watcher'],
];
const SELF = 'check-queue-dirs.mjs';

// A queue subdirectory name: lowercase kebab. Deliberately narrow — it must not match "*",
// "*.md", "sot/01-....md" or a Windows path, all of which appear as literals in these scripts.
const NAME = String.raw`[a-z][a-z0-9]*(?:-[a-z0-9]+)*`;
const NAME_RE = new RegExp(`^${NAME}$`);

// ---- constructs ---------------------------------------------------------------------------
// A line WRITES when it creates a directory or puts a file into one.
const PROD_PS = /New-Item\b[^\n]*-ItemType\s+Directory|(?:^|[\s|(;])(?:Move-Item|Copy-Item|Out-File|Set-Content|Add-Content)\b/i;
const PROD_JS = /(?:^|[^\w.])(?:\w+\.)?(?:mkdir|mkdirSync|rename|renameSync|writeFile|writeFileSync|cp|cpSync|copyFile|copyFileSync)\s*\(/;
// A line READS when it lists, counts, probes or opens something under a directory.
const CONS_PS = /(?:^|[\s|(;])(?:Get-ChildItem|Get-Item|Get-Content|Test-Path|Resolve-Path)\b/i;
const CONS_JS = /(?:^|[^\w.])(?:\w+\.)?(?:readdir|readdirSync|existsSync|statSync|lstatSync|readFile|readFileSync|opendir|opendirSync)\s*\(/;

const isPs = (f) => f.toLowerCase().endsWith('.ps1');
const writes = (line, ps) => (ps ? PROD_PS : PROD_JS).test(line);
const reads = (line, ps) => (ps ? CONS_PS : CONS_JS).test(line);

// `Join-Path <root> "<name>"` / `path.join(<root>, "<name>")` — a subdirectory named against a
// root. This, and an iterated list of literal names, are the ONLY two ways a name enters the
// vocabulary at all; a bare string somewhere in the file is not a queue directory.
const JOIN_PS = new RegExp(String.raw`Join-Path\s+[^\s()]+\s+["'](${NAME})["']`, 'gi');
const JOIN_JS = new RegExp(String.raw`(?:path\.)?join\(\s*[A-Za-z_$][\w$.]*\s*,\s*["'](${NAME})["']\s*[),]`, 'g');
// The same, but bound to a variable, so a later line can use it.
const JOINVAR_PS = new RegExp(String.raw`^\s*\$(\w+)\s*=\s*Join-Path\s+[^\s()]+\s+["'](${NAME})["']`, 'i');
const JOINVAR_JS = new RegExp(String.raw`^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:path\.)?join\(\s*[A-Za-z_$][\w$.]*\s*,\s*["'](${NAME})["']\s*\)`);
// Joining a LOOP VARIABLE against a root: `Join-Path $Queue $sub`, `join(PROMPTS, folder)`.
const joinsVarPs = (line, v) => new RegExp(String.raw`Join-Path\s+[^\s()]+\s+\$${v}\b`, 'i').test(line);
const joinsVarJs = (line, v) => new RegExp(String.raw`(?:path\.)?join\(\s*[A-Za-z_$][\w$.]*\s*,\s*${v}\s*[),]`).test(line);

const literalNames = (blob) => {
  const out = [];
  for (const m of blob.matchAll(/["']([^"'\n]*)["']/g)) if (NAME_RE.test(m[1])) out.push(m[1]);
  return out;
};

/**
 * The whole analyzer, as a pure function over [{file, text}] so the controls exercise the same
 * code path the real scan does. Returns { producers, consumers } as name -> [{file, line}].
 */
export function analyze(files) {
  const producers = new Map();
  const consumers = new Map();
  const add = (map, name, file, line) => {
    if (!map.has(name)) map.set(name, []);
    if (!map.get(name).some((s) => s.file === file && s.line === line)) map.get(name).push({ file, line });
  };

  for (const { file, text } of files) {
    const ps = isPs(file);
    const lines = text.split(/\r?\n/);
    const key = (v) => (ps ? v.toLowerCase() : v);

    // ---- pass 1: names bound to a variable, and names used inline on the spot ----
    const pathVars = new Map(); // var -> { name, line }
    const lists = new Map();    // list var -> { names, line }
    lines.forEach((raw, i) => {
      const ln = i + 1;
      const jv = raw.match(ps ? JOINVAR_PS : JOINVAR_JS);
      if (jv) pathVars.set(key(jv[1]), { name: jv[2], line: ln });

      for (const m of raw.matchAll(ps ? JOIN_PS : JOIN_JS)) {
        // Inline use: classify by the verb on this very line. A bare declaration is classified
        // later, by what the lines that reference its variable do with it.
        if (writes(raw, ps)) add(producers, m[1], file, ln);
        else if (reads(raw, ps)) add(consumers, m[1], file, ln);
      }

      // ---- literal name lists (PowerShell @(...) on one line) ----
      if (ps) {
        const named = raw.match(/^\s*\$(\w+)\s*=\s*@\(([^)]*)\)/);
        if (named && !named[2].includes('$')) {
          const names = literalNames(named[2]);
          if (names.length >= 2) lists.set(key(named[1]), { names, line: ln });
        }
      }
    });

    // ---- JS multi-line object / array literals of folder names ----
    if (!ps) {
      lines.forEach((raw, i) => {
        const open = raw.match(/^\s*(?:const|let|var)\s+(\w+)\s*=\s*([[{])\s*$/);
        if (!open) return;
        const close = open[2] === '{' ? '}' : ']';
        const names = [];
        for (let j = i + 1; j < lines.length; j++) {
          const t = lines[j].trim();
          if (t.startsWith(close)) break;
          if (j - i > 60) break;
          const k = t.match(/^["']?([a-z][a-z0-9-]*)["']?\s*:/) || t.match(/^["']([a-z][a-z0-9-]*)["'],?$/);
          if (k && NAME_RE.test(k[1])) names.push(k[1]);
        }
        if (names.length >= 2) lists.set(open[1], { names, line: i + 1 });
      });
    }

    // ---- pass 2: loop variables bound to a literal list ----
    const bound = new Map(); // loop var -> { names, line }
    lines.forEach((raw, i) => {
      if (ps) {
        let m = raw.match(/foreach\s*\(\s*\$(\w+)\s+in\s+@\(([^)]*)\)\s*\)/i);
        if (m && !m[2].includes('$')) {
          const names = literalNames(m[2]);
          if (names.length >= 2) bound.set(key(m[1]), { names, line: i + 1 });
        }
        m = raw.match(/foreach\s*\(\s*\$(\w+)\s+in\s+\$(\w+)\s*\)/i);
        if (m && lists.has(key(m[2]))) bound.set(key(m[1]), lists.get(key(m[2])));
      } else {
        let m = raw.match(/for\s*\(\s*(?:const|let|var)\s*\[\s*(\w+)\s*[,\]][^)]*Object\.(?:entries|keys)\(\s*(\w+)\s*\)/);
        if (m && lists.has(m[2])) bound.set(m[1], lists.get(m[2]));
        m = raw.match(/for\s*\(\s*(?:const|let|var)\s+(\w+)\s+of\s+(?:Object\.keys\(\s*)?(\w+)\)?\s*\)/);
        if (m && lists.has(m[2])) bound.set(m[1], lists.get(m[2]));
      }
    });

    // ---- pass 3: classify the bound lists by what is done with the joined path ----
    for (const [v, info] of bound) {
      for (const raw of lines) {
        const joins = ps ? joinsVarPs(raw, v) : joinsVarJs(raw, v);
        if (!joins) continue;
        // A loop that CREATES each directory is a producer; anything else joining a folder name
        // onto the queue root and looking at it is a read.
        const target = writes(raw, ps) ? producers : consumers;
        for (const n of info.names) add(target, n, file, info.line);
      }
    }

    // ---- pass 4: classify variables holding a joined path, by every line that uses them ----
    for (const [v, info] of pathVars) {
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const ref = ps
          ? new RegExp(String.raw`\$${v}\b`, 'i').test(raw)
          : new RegExp(String.raw`\b${v}\b`).test(raw);
        if (!ref || i + 1 === info.line) continue;
        if (writes(raw, ps)) add(producers, info.name, file, info.line);
        if (reads(raw, ps)) add(consumers, info.name, file, info.line);
      }
    }
  }
  return { producers, consumers };
}

export function violationsOf({ producers, consumers }) {
  const out = [];
  for (const [name, sites] of consumers) {
    if (producers.has(name)) continue;
    for (const s of sites) out.push({ name, ...s });
  }
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.name.localeCompare(b.name));
}

// =============================================================================================
// CASE 2: is this subdirectory committed to the repository with content?
// =============================================================================================
// The queue root is DERIVED from the watcher's own resolvePromptDir(), not typed in here, so a
// move of the queue cannot leave this probe pointed at a stale path.
const QUEUE_ROOT_SRC = path.join(ROOT, 'scripts', 'pr-watcher', 'index.mjs');
function deriveQueueRoot() {
  let src;
  try { src = fs.readFileSync(QUEUE_ROOT_SRC, 'utf8'); } catch { return null; }
  const m = src.match(/path\.join\(\s*repoRoot\s*,\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/);
  return m ? `${m[1]}/${m[2]}` : null;
}

// Returns the number of COMMITTED files under <rel>/, or null if the instrument itself failed.
// Trailing slash, no glob. The line count is the answer; the exit code is not (see header).
function trackedFileCount(rel) {
  const r = spawnSync('git', ['-C', ROOT, 'ls-files', '--', `${rel}/`], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  return r.stdout.split('\n').filter((l) => l.trim() !== '').length;
}

const NONSENSE = 'qqzzxxnotarealqueuedirqqzzxx';
// =============================================================================================
// CONTROLS — same analyzer, synthetic input, before a single real file is opened.
// =============================================================================================
const CTRL_PS_PROD = [
  '$Queue = "C:\\q"',
  '$mk = Join-Path $Queue "ctrlwritten"',
  'New-Item -ItemType Directory -Path $mk -Force | Out-Null',
].join('\n');
const CTRL_JS_PROD = [
  'const WRITTEN_DIR = path.join(PROMPT_DIR, "ctrlwritten");',
  'await mkdir(WRITTEN_DIR, { recursive: true });',
].join('\n');
// The shape that shipped three times: a folder name in an iterated list, joined and counted,
// with nothing anywhere that writes it.
const CTRL_PS_BAD = 'foreach ($sub in @("ctrlwritten","ctrldead")) {\n  $d = Join-Path $Queue $sub\n  Get-ChildItem $d\n}';
const CTRL_JS_BAD = 'for (const [folder, stage] of Object.entries(CTRL_MAP)) {\n  const dir = join(PROMPTS, folder);\n  readdirSync(dir);\n}';
const CTRL_JS_MAP_BAD = 'const CTRL_MAP = {\n  "ctrlwritten": "a",\n  "ctrldead": "b",\n};\n';
const CTRL_JS_MAP_GOOD = 'const CTRL_MAP = {\n  "ctrlwritten": "a",\n  "ctrlalso": "b",\n};\n';
const CTRL_PS_GOOD = 'foreach ($sub in @("ctrlwritten","ctrlalso")) {\n  $d = Join-Path $Queue $sub\n  Get-ChildItem $d\n}';
const CTRL_EXTRA_PROD = [
  '$mk2 = Join-Path $Queue "ctrlalso"',
  'New-Item -ItemType Directory -Path $mk2 -Force | Out-Null',
].join('\n');

const posV = violationsOf(analyze([
  { file: 'ctrl/prod.ps1', text: CTRL_PS_PROD },
  { file: 'ctrl/prod.mjs', text: CTRL_JS_PROD },
  { file: 'ctrl/bad.ps1', text: CTRL_PS_BAD },
  { file: 'ctrl/bad.mjs', text: CTRL_JS_MAP_BAD + CTRL_JS_BAD },
]));
const posOk = posV.length > 0
  && posV.every((v) => v.name === 'ctrldead')
  && posV.some((v) => v.file === 'ctrl/bad.ps1')
  && posV.some((v) => v.file === 'ctrl/bad.mjs');

const negV = violationsOf(analyze([
  { file: 'ctrl/prod.ps1', text: CTRL_PS_PROD + '\n' + CTRL_EXTRA_PROD },
  { file: 'ctrl/prod.mjs', text: CTRL_JS_PROD },
  { file: 'ctrl/good.ps1', text: CTRL_PS_GOOD },
  { file: 'ctrl/good.mjs', text: CTRL_JS_MAP_GOOD + CTRL_JS_BAD },
]));
const negOk = negV.length === 0;

console.log(`controls: positive(dead read is caught)=${posOk}  negative(produced dir passes)=${negOk}`);
if (!posOk || !negOk) {
  if (!posOk) console.error(`  positive control saw: ${posV.map((v) => `${v.file}:${v.line} ${v.name}`).join(', ') || '(nothing)'}`);
  if (!negOk) console.error(`  negative control falsely flagged: ${negV.map((v) => `${v.file}:${v.line} ${v.name}`).join(', ')}`);
  console.error('[CANNOT MEASURE] the detector failed its own controls — not reporting on real files.');
  process.exit(2);
}

// The case-2 probe gets its own control pair: the queue root itself must come back with committed
// files, and a nonsense sibling must come back with none. Neither name is a queue subdirectory, so
// this is not an allowlist smuggled in as a control.
const QUEUE_ROOT = deriveQueueRoot();
if (!QUEUE_ROOT) {
  console.error(`[CANNOT MEASURE] cannot derive the queue root from ${QUEUE_ROOT_SRC} (resolvePromptDir changed shape?)`);
  process.exit(2);
}
const probeHit = trackedFileCount(QUEUE_ROOT);
const probeMiss = trackedFileCount(`${QUEUE_ROOT}/${NONSENSE}`);
const probeOk = probeHit !== null && probeMiss !== null && probeHit > 0 && probeMiss === 0;
console.log(`controls: tracked-probe positive(${QUEUE_ROOT}/ has committed files)=${probeHit !== null && probeHit > 0}  negative(a nonsense name has none)=${probeMiss === 0}`);
if (!probeOk) {
  if (probeHit === null || probeMiss === null) console.error('  the git ls-files probe failed to run');
  console.error(`[CANNOT MEASURE] the committed-content probe failed its own controls (hit=${probeHit}, miss=${probeMiss}) — not reporting on real files.`);
  process.exit(2);
}

// =============================================================================================
// The real scan.
// =============================================================================================
function walk(dir, acc) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p, acc); continue; }
    if (!/\.(ps1|mjs)$/i.test(e.name) || e.name === SELF) continue;
    acc.push(p);
  }
  return acc;
}

const paths = [];
for (const parts of SCAN_DIRS) {
  const d = path.join(ROOT, ...parts);
  if (!fs.existsSync(d)) { console.error(`[CANNOT MEASURE] scan root absent: ${d}`); process.exit(2); }
  walk(d, paths);
}
if (paths.length === 0) { console.error('[CANNOT MEASURE] scan matched no .ps1/.mjs files'); process.exit(2); }

const files = paths.sort().map((p) => ({
  file: path.relative(ROOT, p).split(path.sep).join('/'),
  text: fs.readFileSync(p, 'utf8'),
}));

const sets = analyze(files);
const producers = [...sets.producers.keys()].sort();
const consumers = [...sets.consumers.keys()].sort();

console.log(`scanned ${files.length} script(s) under scripts/pipeline/ and scripts/pr-watcher/`);
console.log(`PRODUCERS (a script creates or writes into it): ${producers.join(', ') || '(none)'}`);
console.log(`CONSUMERS (a script reads, counts or iterates it): ${consumers.join(', ') || '(none)'}`);

// A scan that matched nothing is a broken instrument, not a clean repo (DOCTRINE 9.6).
if (consumers.length === 0) {
  console.error('[CANNOT MEASURE] consumer scan matched nothing');
  process.exit(2);
}

// Case 1 already filtered by violationsOf(). Now split what is left by case 2 vs case 3.
const candidates = violationsOf(sets);
const trackedCounts = new Map();
for (const c of candidates) {
  if (trackedCounts.has(c.name)) continue;
  const n = trackedFileCount(`${QUEUE_ROOT}/${c.name}`);
  if (n === null) {
    console.error(`[CANNOT MEASURE] git ls-files failed while probing ${QUEUE_ROOT}/${c.name}/`);
    process.exit(2);
  }
  trackedCounts.set(c.name, n);
}
const tracked = [...trackedCounts].filter(([, n]) => n > 0).map(([k]) => k).sort();
console.log(`TRACKED (no script writes it, but it carries committed files): ${tracked.join(', ') || '(none)'}`);
for (const name of tracked) {
  console.log(`ADMIT   ${name}/  ${trackedCounts.get(name)} committed file(s) — a count from it is a real measurement`);
}

const bad = candidates.filter((c) => trackedCounts.get(c.name) === 0);
if (bad.length) {
  console.log('');
  for (const v of bad) {
    console.log(`REJECT  ${v.file}:${v.line}  ${v.name}/`);
    console.log('          - no script writes this directory and it carries no committed files;');
    console.log('            a count from it is [CANNOT MEASURE], not 0');
  }
  console.error(`\n${bad.length} dead queue-directory read(s). Either a producer is missing, or the read is`);
  console.error('describing a folder that will never exist — in which case delete the read, do not let it');
  console.error('report 0. See scripts/pipeline/status-sweep.ps1 and scripts/pr-watcher/supervise-watcher.ps1');
  console.error('for the shape of the fix (2026-09-01: three scripts counted in-progress/, all printed 0).');
  process.exit(1);
}

console.log('\nEvery queue subdirectory a script reads is either written by a script or carries committed');
console.log('files. Nothing here can silently answer 0. This is the boring, correct outcome.');
