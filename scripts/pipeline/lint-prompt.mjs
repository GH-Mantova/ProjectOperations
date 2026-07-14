#!/usr/bin/env node
/**
 * STATION 0 - INTAKE LINT.  A jig, not a worker. Costs zero tokens.
 *
 * Kills 39 of 194 historical failures BEFORE an agent is ever spawned:
 *   - 34 "stale prompt" runs  (work already on main; agent boots, greps, exits, no PR)
 *   -  5 "false premise" runs (prompt describes a repo that does not exist)
 *
 * Also refuses oversized prompts. pr-replace-native-browser-dialogs tried 48 call sites,
 * burned 240 turns (DOUBLE the normal budget), left 33 files in the shared tree, and killed
 * the queue for 13 hours. Raising the turn cap does not help. Splitting does.
 *
 * Exit 0 = admit.  1 = reject.  3 = stale (binned).
 */

import { readFileSync, readdirSync, renameSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, basename } from "node:path";

const MAX_SIZE = 10;
const REQUIRED = ["premise", "premise_means", "scope", "done_when", "size"];

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

/** Minimal YAML front-matter parser. Deliberately dumb: no dependency, no surprises. */
function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  let key = null;

  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && key) {
      if (!Array.isArray(out[key])) out[key] = [];
      out[key].push(listItem[1].trim());
      continue;
    }

    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (kv) {
      key = kv[1];
      let v = kv[2].trim();
      // Strip surrounding quotes. WITHOUT THIS, a premise written as
      //     premise: '! grep -q "X" file'
      // executes WITH its quotes, the shell cannot find that "file", it fails, and the
      // prompt is silently binned as STALE.
      // A linter that bins VALID work is worse than no linter. This bug bit on first test.
      const q = v.slice(0, 1);
      if ((q === "'" || q === '"') && v.slice(-1) === q && v.length > 1) v = v.slice(1, -1);
      out[key] = v === "" ? [] : v;
    }
  }
  return out;
}

/**
 * Run the premise. EXIT 0 => the work is STILL NEEDED.
 *
 * Telling "premise legitimately false" from "premise is BROKEN" is the whole game:
 *   grep finds nothing  -> exit 1   -> already satisfied  -> BIN     (correct)
 *   command not found   -> exit 127 -> the PROMPT is wrong -> REJECT (do NOT bin)
 *   file missing        -> exit 2   -> the PROMPT is wrong -> REJECT (do NOT bin)
 * Getting this backwards silently discards real work.
 */
/**
 * Find a real bash. Premises are written in bash (`!`, `grep -q`, pipes) and Windows has neither
 * /bin/bash nor grep.
 *
 * THIS BUG SHIPPED AND WAS CAUGHT ON FIRST USE: with a hardcoded shell:"/bin/bash", every premise
 * on Windows failed to SPAWN. err.status came back undefined -> -1, which was not in the broken
 * list, so the linter concluded "premise not satisfied => work already done" and BINNED THE PROMPT.
 * It would have silently discarded the entire backlog while printing a cheerful green message.
 */
function findBash() {
  if (process.platform !== "win32") return "/bin/bash";
  const candidates = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    process.env.ProgramFiles ? process.env.ProgramFiles + "\\Git\\bin\\bash.exe" : null,
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

const BASH = findBash();

function runPremise(cmd, cwd) {
  if (!BASH) {
    // FAIL SAFE. Never bin work because the TOOL is broken.
    return { needed: false, broken: true, status: -1, stderr: "no bash found (install Git for Windows)" };
  }
  try {
    execSync(cmd, { cwd, stdio: ["ignore", "ignore", "pipe"], shell: BASH, timeout: 60000 });
    return { needed: true };
  } catch (err) {
    const status = typeof err.status === "number" ? err.status : -1;
    const stderr = String(err.stderr || "").trim();

    // A premise is "legitimately false" ONLY on a clean non-zero exit from a command that RAN.
    // Anything else - could not spawn, could not find the command, could not read the file - means
    // the PROMPT (or the tool) is wrong, not that the work is done. Those REJECT; they never BIN.
    // Getting this backwards silently discards real work, which is strictly worse than no linter.
    const broken =
      status === -1 ||          // spawn failure: no shell, ENOENT, killed
      status === 127 ||         // command not found
      status === 126 ||         // not executable
      status === 2 ||           // grep: file missing / usage error
      /command not found|No such file or directory|is not recognized|cannot access/i.test(stderr);

    return { needed: false, broken, status, stderr: stderr.slice(0, 200) };
  }
}

function lint(file, opts) {
  const dequeue = opts && opts.dequeue;
  const repoRoot = (opts && opts.repoRoot) || process.cwd();
  const name = basename(file);
  const fm = parseFrontMatter(readFileSync(file, "utf8"));
  const fail = (code, msg) => ({ ok: false, code, msg, name });

  if (!fm) {
    return fail("NO_FRONT_MATTER",
      "No YAML front-matter. See docs/pr-prompts/PROMPT-SCHEMA.md.\n" +
      "        Every prompt needs an EXECUTABLE premise, or nothing can tell whether it is stale.");
  }

  const missing = REQUIRED.filter((k) => !fm[k] || (Array.isArray(fm[k]) && fm[k].length === 0));
  if (missing.length) return fail("MISSING_FIELD", "Missing required field(s): " + missing.join(", "));

  const size = Number(fm.size);
  if (!Number.isFinite(size)) {
    return fail("MISSING_FIELD", "`size` must be a number (files this prompt expects to touch).");
  }
  if (size > MAX_SIZE) {
    return fail("SIZE_TOO_LARGE",
      "size=" + size + " exceeds the limit of " + MAX_SIZE + " files. SPLIT IT.\n" +
      "        pr-replace-native-browser-dialogs tried 48 call sites, burned 240 turns (DOUBLE the\n" +
      "        normal budget), left 33 files in the shared tree, killed the queue for 13 hours.\n" +
      "        Raising the turn cap does NOT help. Splitting does.");
  }

  // GATE-ALLOW coherence. 10 PRs failed CP-11 on a mis-declared or mis-formatted marker.
  const scope = (Array.isArray(fm.scope) ? fm.scope : [fm.scope]).join(" ");
  const scopeHasMigration = /migrations/.test(scope);
  const declaresMigration = String(fm.gate_allow || "none").indexOf("migrations") !== -1;

  if (scopeHasMigration && !declaresMigration) {
    return fail("GATE_ALLOW_MISMATCH",
      "scope touches migrations/ but gate_allow does not declare `migrations`. CP-11 will fail this PR.");
  }
  if (declaresMigration && !scopeHasMigration) {
    return fail("GATE_ALLOW_MISMATCH", "gate_allow declares `migrations` but scope has no migrations/ path.");
  }

  // THE CHECK THAT PAYS FOR THIS WHOLE FILE.
  const res = runPremise(String(fm.premise), repoRoot);

  if (res.broken) {
    return fail("PREMISE_INVALID",
      "The premise command ERRORED (exit " + res.status + ") - your assumption about the repo is wrong.\n" +
      "        " + DIM + (res.stderr || "(no stderr)") + RESET + "\n" +
      "        5 historical runs died on prompts whose premise was simply FALSE (pr-23 mirrored a spec\n" +
      "        file that does not exist; pr-ops-map-m1 was told to read a doc that does not exist).");
  }

  if (!res.needed) {
    if (dequeue) {
      renameSync(file, file.replace(/-ready\.md$/, ".md") + ".stale-premise-already-satisfied");
    }
    return {
      ok: false, stale: true, code: "PREMISE_ALREADY_SATISFIED", name,
      msg: 'Premise no longer holds: "' + fm.premise_means + '"\n' +
           "        The work is ALREADY DONE. Binned before spawning an agent.\n" +
           "        " + GREEN + "This is the lint working." + RESET + " 34 historical runs were burned on exactly this.",
    };
  }

  return { ok: true, name, size, premise: String(fm.premise) };
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: lint-prompt.mjs <file.md> | --all <dir> | --dequeue <file.md>");
  process.exit(64);
}

const repoRoot = process.env.LINT_REPO_ROOT || process.cwd();
let files = [];
let dequeue = false;

if (args[0] === "--all") {
  files = readdirSync(args[1]).filter((f) => f.endsWith("-ready.md")).map((f) => join(args[1], f));
} else if (args[0] === "--dequeue") {
  dequeue = true;
  files = [args[1]];
} else {
  files = [args[0]];
}

let admitted = 0;
let rejected = 0;
let stale = 0;

for (const f of files) {
  if (!existsSync(f)) {
    console.log(RED + "MISSING" + RESET + " " + f);
    rejected++;
    continue;
  }
  const r = lint(f, { dequeue, repoRoot });
  if (r.ok) {
    console.log(GREEN + "ADMIT  " + RESET + " " + r.name + "  " + DIM + "(size " + r.size + ")" + RESET);
    admitted++;
  } else if (r.stale) {
    console.log(YELLOW + "STALE  " + RESET + " " + r.name + "\n        " + r.msg);
    stale++;
  } else {
    console.log(RED + "REJECT " + RESET + " " + r.name + "  [" + r.code + "]\n        " + r.msg);
    rejected++;
  }
}

if (files.length > 1) {
  console.log("\n" + DIM + "----------------------------------------" + RESET);
  console.log("admitted " + GREEN + admitted + RESET + " | stale " + YELLOW + stale + RESET + " | rejected " + RED + rejected + RESET);
}

process.exit(stale > 0 && files.length === 1 ? 3 : rejected > 0 ? 1 : 0);
