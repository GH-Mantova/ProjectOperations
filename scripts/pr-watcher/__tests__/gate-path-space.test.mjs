// GATE_PATH_SPACE_V1 — a dependency gate whose path contains a space must read
// as SATISFIED when the file is on origin/main.
//
// The defect this pins: every `spawn("git", …)` in index.mjs used to pass
// `shell: true`. With a shell, node does not escape the argv array — it joins
// it into a single command string and hands that to cmd.exe / sh (node
// DEP0190), so the shell re-splits every argument containing a space. A gate on
// "Claude Design/docs/01-commercial.md" therefore reached git as two arguments
// and `cat-file -e` exited 129 ("fatal: too many arguments") rather than 0.
// unmetDependencies() catches every non-zero exit and writes one sentence for
// all of them, so exit 129 (git USAGE error) was indistinguishable from exit
// 128 (genuine absence): a satisfied gate was reported as unsatisfied and the
// prompt deferred forever. Measured 2026-09-05: twelve consecutive deferrals
// over 59 minutes on a file that had been on origin/main since 09-04.
//
// Design notes, so the next reader does not weaken this file:
//
//   * These tests run EVERYWHERE. The shell re-split is not Windows-only —
//     `/bin/sh -c "git cat-file -e origin/main:Claude Design/x.md"` splits
//     identically on Linux and macOS (verified: exit 129 with a shell, exit 0
//     without, same box that runs CI). There is deliberately no t.skip() —
//     the CI job asserts skipped == 0.
//
//   * The fixture must actually carry the hazard. `fixture paths carry the
//     hazard` below asserts the spaced path really contains U+0020 and that
//     the control really does not, so this file cannot quietly decay into a
//     space-free test that proves nothing.
//
//   * Controls in both directions. A space-FREE path that is present (must
//     stay met — it was met even with the bug, so it is the control that
//     isolates the space as the variable) and paths that are genuinely absent
//     (must stay unmet — so a build of unmetDependencies that returned []
//     unconditionally would fail here rather than pass everything).
//
//   * Assertions are deepStrictEqual over the COMPLETE reason list, never
//     "some reason matched". A gate evaluator that reported one extra
//     spurious reason alongside the right one would satisfy a containment
//     check and must not satisfy this file.
//
// The fixture git commands below use execFileSync WITHOUT a shell on purpose:
// the harness that builds the repo must not itself be subject to the bug it
// is testing for.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.join(__dirname, "..", "index.mjs");

// --- fixture paths -----------------------------------------------------------
// THE HAZARD: a repo-relative path with an interior space, exactly the shape
// measured in the field ("Claude Design/**" is a real top-level directory on
// origin/main and holds 11 of the repo's whitespace-bearing tracked files).
const SPACED_PRESENT = "Claude Design/docs/01-commercial.md";
// NEGATIVE CONTROL A — same repo, present, but no space. Met before and after
// the fix; it is here so a green run on SPACED_PRESENT proves the space was
// the variable and not, say, a broken fixture repo.
const SPACELESS_PRESENT = "CLAUDE.md";
// NEGATIVE CONTROL B — genuinely absent, with a space. Must stay UNMET: this
// is what stops the fix from being "treat every git failure as met".
const SPACED_ABSENT = "Claude Design/docs/zzzNoSuchNeedleZzz.md";
// NEGATIVE CONTROL C — genuinely absent, no space.
const SPACELESS_ABSENT = "zzzNoSuchNeedleZzz.md";

const NEEDLE_PRESENT = "GATE_NEEDLE_ON_MAIN";
const NEEDLE_ABSENT = "GATE_NEEDLE_NOT_ON_MAIN";

// --- fixture: a real repo whose origin/main is a real remote-tracking ref ----
function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// mkdtemp under a SPACE-FREE parent on purpose: cwd is passed to spawn as an
// option, not as an argv element, so a space there would not exercise anything.
// The only space in play must be inside the git ARGUMENT.
const root = mkdtempSync(path.join(tmpdir(), "wgate-path-space-"));
assert.ok(!root.includes(" "), `temp root must be space-free, got ${root}`);

const originDir = path.join(root, "origin.git");
const seedDir = path.join(root, "seed");
const cloneDir = path.join(root, "clone");

git(root, ["init", "--bare", "-b", "main", originDir]);
git(root, ["init", "-b", "main", seedDir]);
git(seedDir, ["config", "user.email", "watcher-test@example.invalid"]);
git(seedDir, ["config", "user.name", "watcher test"]);
git(seedDir, ["config", "commit.gpgsign", "false"]);

mkdirSync(path.join(seedDir, path.dirname(SPACED_PRESENT)), { recursive: true });
writeFileSync(
  path.join(seedDir, SPACED_PRESENT),
  `# commercial\n\n${NEEDLE_PRESENT}\n`,
  "utf-8",
);
writeFileSync(path.join(seedDir, SPACELESS_PRESENT), `# root\n\n${NEEDLE_PRESENT}\n`, "utf-8");
git(seedDir, ["add", "--", SPACED_PRESENT, SPACELESS_PRESENT]);
git(seedDir, ["commit", "-m", "fixture"]);
git(seedDir, ["remote", "add", "origin", originDir]);
git(seedDir, ["push", "-u", "origin", "main"]);
git(root, ["clone", originDir, cloneDir]);

// Point the watcher module at the fixture clone BEFORE importing it: index.mjs
// resolves REPO_ROOT from PR_WATCHER_REPO_ROOT at module-evaluation time.
process.env.PR_WATCHER_REPO_ROOT = cloneDir;
const { unmetDependencies, parseWatcherFrontMatter } = await import("../index.mjs");

// Build a complete deps object. requiresMerged stays empty in every case so
// unmetDependencies never spawns gh — this file must not need the network.
function deps({ files = [], onMain = [] } = {}) {
  return { requiresMerged: [], requiresFilesOnMain: files, requiresOnMain: onMain, fixesPr: null, escalates: false };
}

// ---------------------------------------------------------------------------

test("fixture paths carry the hazard, and the controls do not", () => {
  // If this ever fails, every other assertion in this file is meaningless.
  assert.ok(SPACED_PRESENT.includes(" "), "SPACED_PRESENT must contain a space");
  assert.ok(SPACED_ABSENT.includes(" "), "SPACED_ABSENT must contain a space");
  assert.ok(!SPACELESS_PRESENT.includes(" "), "SPACELESS_PRESENT must NOT contain a space");
  assert.ok(!SPACELESS_ABSENT.includes(" "), "SPACELESS_ABSENT must NOT contain a space");

  // …and the spaced file really is on origin/main in the fixture, established
  // independently of index.mjs so a red test below cannot be blamed on setup.
  git(cloneDir, ["cat-file", "-e", `origin/main:${SPACED_PRESENT}`]);
  git(cloneDir, ["cat-file", "-e", `origin/main:${SPACELESS_PRESENT}`]);
  assert.throws(() => git(cloneDir, ["cat-file", "-e", `origin/main:${SPACED_ABSENT}`]));
});

test("requires_file_on_main: a present path WITH a space reads as met", async () => {
  assert.deepStrictEqual(await unmetDependencies(deps({ files: [SPACED_PRESENT] })), []);
});

test("requires_file_on_main: a present path WITHOUT a space reads as met (control)", async () => {
  assert.deepStrictEqual(await unmetDependencies(deps({ files: [SPACELESS_PRESENT] })), []);
});

test("requires_file_on_main: an absent path WITH a space still reads as unmet", async () => {
  assert.deepStrictEqual(await unmetDependencies(deps({ files: [SPACED_ABSENT] })), [
    `file "${SPACED_ABSENT}" not on origin/main`,
  ]);
});

test("requires_file_on_main: an absent path WITHOUT a space still reads as unmet", async () => {
  assert.deepStrictEqual(await unmetDependencies(deps({ files: [SPACELESS_ABSENT] })), [
    `file "${SPACELESS_ABSENT}" not on origin/main`,
  ]);
});

test("requires_file_on_main: mixed gates report ONLY the genuinely absent one", async () => {
  // The complete list, in declaration order. A build that reported the spaced
  // present file as absent would add a second entry here.
  assert.deepStrictEqual(
    await unmetDependencies(
      deps({ files: [SPACED_PRESENT, SPACED_ABSENT, SPACELESS_PRESENT, SPACELESS_ABSENT] }),
    ),
    [
      `file "${SPACED_ABSENT}" not on origin/main`,
      `file "${SPACELESS_ABSENT}" not on origin/main`,
    ],
  );
});

test("requires_on_main path-only: a present path WITH a space reads as met", async () => {
  // Second git call site: `git show origin/main:<path>`, not `cat-file`.
  assert.deepStrictEqual(await unmetDependencies(deps({ onMain: [SPACED_PRESENT] })), []);
});

test("requires_on_main content gate: needle found through a spaced path", async () => {
  assert.deepStrictEqual(
    await unmetDependencies(deps({ onMain: [`${SPACED_PRESENT} :: ${NEEDLE_PRESENT}`] })),
    [],
  );
});

test("requires_on_main content gate: a spaced path that EXISTS but lacks the needle says so", async () => {
  // The discriminating assertion. With a shell, `git show` failed outright, so
  // fileContent was null and the reason was the ABSENCE sentence. Without a
  // shell the file is read and the reason names the missing string instead.
  // Two different sentences for two different facts — which is the whole point
  // of the fix.
  assert.deepStrictEqual(
    await unmetDependencies(deps({ onMain: [`${SPACED_PRESENT} :: ${NEEDLE_ABSENT}`] })),
    [`string ${JSON.stringify(NEEDLE_ABSENT)} not found in "${SPACED_PRESENT}" on origin/main`],
  );
});

test("requires_on_main content gate: an absent spaced path still reports absence", async () => {
  assert.deepStrictEqual(
    await unmetDependencies(deps({ onMain: [`${SPACED_ABSENT} :: ${NEEDLE_PRESENT}`] })),
    [`file "${SPACED_ABSENT}" not on origin/main`],
  );
});

test("end to end: a prompt front-matter gate on a spaced path arms", async () => {
  // The real chain: prompt body -> parseWatcherFrontMatter -> unmetDependencies.
  const body = [
    "---",
    "premise: 'true'",
    "requires_file_on_main:",
    `  - ${SPACED_PRESENT}`,
    "requires_on_main:",
    `  - ${SPACED_PRESENT} :: ${NEEDLE_PRESENT}`,
    "---",
    "",
    "# body",
  ].join("\n");
  const parsed = parseWatcherFrontMatter(body);
  // The parser must hand the path over with its space intact.
  assert.deepStrictEqual(parsed.requiresFilesOnMain, [SPACED_PRESENT]);
  assert.deepStrictEqual(parsed.requiresOnMain, [`${SPACED_PRESENT} :: ${NEEDLE_PRESENT}`]);
  assert.deepStrictEqual(await unmetDependencies(parsed), []);
});

// --- source ratchet ---------------------------------------------------------
// syncMain's fetch/checkout/pull and warnOnUntrackedReadyPrompts' `git -C
// <PROMPT_DIR> ls-files` have no unit-testable seam (they need a real remote /
// a real queue dir), but they carry the identical defect: PROMPT_DIR is an
// absolute path and PR_WATCHER_PROMPT_DIR can put it under a folder with a
// space. This asserts the invariant directly on the source instead.

// Returns the source text of every spawn() call in index.mjs whose first
// argument is the literal "git". Both the one-line and the multi-line call
// shapes are in the file, so this cannot be a line-oriented grep.
function gitSpawnCallSites(src) {
  const sites = [];
  const NEEDLE = "spawn(";
  let from = 0;
  for (;;) {
    const at = src.indexOf(NEEDLE, from);
    if (at === -1) break;
    from = at + NEEDLE.length;
    // Reject a suffix match inside a longer identifier (e.g. "respawn(").
    const prev = at === 0 ? "" : src[at - 1];
    if (/[A-Za-z0-9_$.]/.test(prev)) continue;
    const open = at + NEEDLE.length - 1;
    let depth = 0;
    let quote = null;
    let i = open;
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === "\\") i++;
        else if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
      if (c === "(") depth++;
      else if (c === ")") { depth--; if (depth === 0) break; }
    }
    const call = src.slice(at, i + 1);
    from = i + 1;
    // First argument, whitespace/newlines allowed before it.
    if (!call.slice(NEEDLE.length).trimStart().startsWith('"git"')) continue;
    sites.push(call);
  }
  return sites;
}

test("no spawn(\"git\", …) in index.mjs passes a shell", () => {
  const src = readFileSync(INDEX_PATH, "utf-8");
  const sites = gitSpawnCallSites(src);
  // Guard against the scanner silently matching nothing (which would make the
  // assertion below vacuously true). There were five sites when this landed.
  assert.ok(sites.length >= 5, `expected >= 5 git spawn sites, found ${sites.length}`);
  const offenders = sites.filter((s) => s.includes("shell"));
  assert.deepStrictEqual(offenders, []);
});

test("the source ratchet's scanner actually detects a shell option", () => {
  // Proves the previous test CAN fail: feed the scanner both pre-fix call
  // shapes and confirm it finds them and flags the shell option — and that it
  // ignores a non-git spawn (runGh legitimately still passes a shell) and a
  // lookalike identifier.
  const preFix = [
    "function runGit(args) {",
    '  const child = spawn("git", args, { cwd: REPO_ROOT, shell: true });',
    "}",
    "const gh = spawn(GH_BIN, args, { cwd: REPO_ROOT, shell: true });",
    "const nope = respawn(\"git\", args, { shell: true });",
    "const multi = spawn(",
    '  "git",',
    '  ["-C", PROMPT_DIR, "ls-files", "--others", "--exclude-standard", "--", "."],',
    "  { shell: true },",
    ");",
  ].join("\n");
  const sites = gitSpawnCallSites(preFix);
  assert.strictEqual(sites.length, 2, "one-line and multi-line git spawns, gh and respawn excluded");
  assert.strictEqual(sites.filter((s) => s.includes("shell")).length, 2);
});
