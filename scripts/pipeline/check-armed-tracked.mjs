/**
 * check-armed-tracked.mjs — detect docs/pr-prompts/*-ready.md files that exist
 * in the working tree but are UNTRACKED because .gitignore:75
 * (`docs/pr-prompts/*-ready.md`) swallowed them.
 *
 * Background — why this exists at all
 * -----------------------------------
 * .gitignore:75 was added by d5bd4f58 (#805). The rationale ("committing them
 * causes phantom dirty trees on branch switches") is real and this checker does
 * NOT touch it. But .gitignore has no effect on already-tracked paths, so two
 * states coexist:
 *
 *   Arming by rename (git mv pr-x-HOLD.md pr-x-ready.md)
 *     — file stays tracked. Survives. This is the intended path.
 *
 *   Arming by creation (author a new pr-x-ready.md)
 *     — silently swallowed. Invisible to 04-scanner, code-writer agents,
 *       05-sot-keeper. One `git clean` from gone. Three sets have been
 *       rescued by hand (#1261, the rates-column-hygiene cluster, Supervisor's
 *       own rev-1257). One of those was destroyed while its prompt was being
 *       written.
 *
 * git status does NOT report gitignored paths as `??`. So `git status` cannot
 * find these. The only two probes that can:
 *   - git check-ignore -v <path>          (exit 0 => ignored)
 *   - git ls-files --error-unmatch <path> (exit 0 => tracked)
 * This checker uses the second, which is authoritative for our question.
 *
 * Rule per top-level docs/pr-prompts/*-ready.md file:
 *   1. If it is tracked                          -> pass
 *   2. If untracked but a `-HOLD.md` twin exists on origin/main
 *      (a legitimate arming-by-rename mid-flight)-> pass
 *   3. Otherwise                                 -> FAIL
 *
 * The glob is intentionally NON-RECURSIVE. It matches the .gitignore rule
 * shape (`docs/pr-prompts/*-ready.md`) — the swallow only happens at that
 * exact depth. Files inside processed/, superseded/, archive/, etc. are not
 * ignored and are not this checker's concern.
 *
 * Usage:  node scripts/pipeline/check-armed-tracked.mjs [--root <repoRoot>]
 *
 * Exit codes:
 *   0 — every *-ready.md is either tracked or has a HOLD twin on origin/main.
 *       Also 0 when zero *-ready.md files are present in the working tree
 *       (the normal state in a fresh CI checkout — see the header comment
 *        in scripts/pipeline/__tests__/check-armed-tracked.test.mjs for why
 *        the quiet-CI-pass is expected, not a bug to "fix").
 *   1 — at least one *-ready.md is untracked AND has no HOLD twin on
 *       origin/main. That file is invisible to every station.
 */

import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootArgIdx = process.argv.indexOf("--root");
const repoRoot = rootArgIdx !== -1 && process.argv[rootArgIdx + 1]
  ? path.resolve(process.argv[rootArgIdx + 1])
  : process.cwd();

const PROMPTS_DIR = path.join(repoRoot, "docs", "pr-prompts");

// Non-recursive scan: only the top level of docs/pr-prompts/, matching the
// .gitignore rule shape. A -ready.md deeper in a subdirectory is not ignored
// and is not this checker's problem.
function findTopLevelReadyFiles() {
  let entries;
  try {
    entries = readdirSync(PROMPTS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith("-ready.md"))
    .map((e) => e.name)
    .sort();
}

function isTracked(relPathPosix) {
  const r = spawnSync(
    "git",
    ["ls-files", "--error-unmatch", "--", relPathPosix],
    { cwd: repoRoot, encoding: "utf8" },
  );
  return r.status === 0;
}

// A legitimate arming-by-rename mid-flight leaves the -ready.md untracked in
// the working tree but the -HOLD.md counterpart still present on origin/main.
// git ls-tree exits 0 with empty stdout when the path is missing; require both
// exit 0 AND non-empty output.
function twinExistsOnOriginMain(readyRelPathPosix) {
  const holdPath = readyRelPathPosix.replace(/-ready\.md$/, "-HOLD.md");
  const r = spawnSync(
    "git",
    ["ls-tree", "origin/main", "--", holdPath],
    { cwd: repoRoot, encoding: "utf8" },
  );
  return r.status === 0 && (r.stdout || "").trim().length > 0;
}

const readyFiles = findTopLevelReadyFiles();

console.log(
  "=== ARMED-TRACKED CHECK --- " +
    readyFiles.length +
    " top-level *-ready.md file(s) in docs/pr-prompts/",
);

const failures = [];
const passes = [];

for (const name of readyFiles) {
  const rel = "docs/pr-prompts/" + name;
  if (isTracked(rel)) {
    passes.push({ path: rel, reason: "tracked" });
    continue;
  }
  if (twinExistsOnOriginMain(rel)) {
    passes.push({ path: rel, reason: "arming-by-rename (HOLD twin on origin/main)" });
    continue;
  }
  failures.push(rel);
}

for (const p of passes) {
  console.log("  PASS  " + p.path + "  (" + p.reason + ")");
}

if (failures.length > 0) {
  console.log("");
  console.log(
    "!!! SWALLOWED-BY-GITIGNORE (" +
      failures.length +
      ") --- these files exist on disk but git does not track them. They are " +
      "invisible to 04-scanner, to the code-writer agents, to 05-sot-keeper, " +
      "and to every other station. One `git clean` deletes them.",
  );
  for (const f of failures) {
    console.log("  FAIL  " + f);
  }
  console.log("");
  console.log(
    "Fix: commit each file first as its `-HOLD.md` counterpart, then arm by " +
      "`git mv pr-<slug>-HOLD.md pr-<slug>-ready.md`. That keeps the file " +
      "tracked across the rename; .gitignore only ignores UNTRACKED matching paths.",
  );
  console.log("");
  console.log(
    "found=" + readyFiles.length + "  swallowed=" + failures.length + "  ok=" + passes.length,
  );
  process.exit(1);
}

console.log(
  "found=" + readyFiles.length + "  swallowed=0  ok=" + passes.length,
);
console.log(
  "armed-tracked: no swallowed prompts. The quiet, correct outcome — " +
    "expected in a fresh CI checkout where the working tree carries none.",
);
process.exit(0);
