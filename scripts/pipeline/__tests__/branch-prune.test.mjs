/**
 * branch-prune - the guard that must be INCAPABLE of eating unpushed work.
 *
 * Runs with: node --test scripts/pipeline/__tests__/branch-prune.test.mjs
 * ci.yml runs: node --test "scripts/pipeline/__tests__/*.mjs" on Ubuntu AND on Windows.
 *
 * WHAT THIS FILE CAN AND CANNOT COVER, STATED UP FRONT.
 * The thing being guarded is a .ps1, and the pipeline suite runs on ubuntu-latest where there
 * is no PowerShell. The Windows job that does have PowerShell asserts `skipped == 0`, so a
 * platform-gated `t.skip()` would fail CI outright. That rules out executing the script here.
 * So this file covers the two things that CAN be pinned on every runner, and is explicit that
 * neither is a substitute for running it:
 *
 *   PART A - THE DESIGN, against real git. Throwaway repos under os.tmpdir(), never the dev
 *            tree. These prove the CLAIMS the script's safety rests on: that `git cherry`
 *            reports '+' for work that exists nowhere else, that `git branch --merged` is
 *            useless against squash-merges, that a combined patch-id does find the squash,
 *            and that a remote-tracking ref is NOT proof a remote still has the commit.
 *            If git ever stopped behaving this way the script would be unsafe, and this is
 *            the only place that would notice.
 *
 *   PART B - THE SCRIPT, as shipped text. Every safety property named in Part A has to be
 *            present in scripts/branch-prune.ps1, in the right order, with the destructive
 *            call downstream of the quarantine and the manifest. Reverting any one of those
 *            properties turns this file red. It cannot prove the script RUNS correctly; it
 *            proves the script still SAYS the safe thing.
 *
 *   PART C - THE CALLER. .vscode/tasks.json must not carry a force-delete, and must invoke
 *            the script in its default dry-run mode.
 *
 * Unverified by this file, on purpose and by necessity: that the .ps1 parses under Windows
 * PowerShell 5.1, and that its runtime behaviour matches its text.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PS1 = path.join(REPO_ROOT, "scripts", "branch-prune.ps1");
const SWEEP = path.join(REPO_ROOT, "scripts", "pipeline", "status-sweep.ps1");
const TASKS = path.join(REPO_ROOT, ".vscode", "tasks.json");

// ---------------------------------------------------------------------------
// PART A helpers - real git, in a throwaway directory, never the dev tree.
// ---------------------------------------------------------------------------

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "prune test",
  GIT_AUTHOR_EMAIL: "prune@test.invalid",
  GIT_COMMITTER_NAME: "prune test",
  GIT_COMMITTER_EMAIL: "prune@test.invalid",
  GIT_CONFIG_NOSYSTEM: "1",
  HOME: os.tmpdir(),
};

/** Run git and return trimmed stdout. Throws on non-zero. */
function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, env: GIT_ENV, encoding: "utf8" }).trim();
}

/** Run git and return { ok, out } instead of throwing - for probes whose exit code IS the answer. */
function gitTry(cwd, ...args) {
  try {
    return { ok: true, out: git(cwd, ...args) };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() };
  }
}

const tmpDirs = [];
function scratch(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `branch-prune-${label}-`));
  tmpDirs.push(d);
  return d;
}
process.on("exit", () => {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

function commit(repo, name, body) {
  fs.writeFileSync(path.join(repo, name), body);
  git(repo, "add", "--", name);
  git(repo, "commit", "-m", `add ${name}`);
  return git(repo, "rev-parse", "HEAD");
}

/** A work repo with an `origin` bare remote, main pushed, one base commit. */
function newRepoWithOrigin(label) {
  const root = scratch(label);
  const bare = path.join(root, "origin.git");
  const work = path.join(root, "work");
  fs.mkdirSync(work);
  execFileSync("git", ["init", "--bare", "-b", "main", bare], { env: GIT_ENV });
  git(work, "init", "-b", "main");
  git(work, "remote", "add", "origin", bare);
  commit(work, "base.txt", "base\n");
  git(work, "push", "-u", "origin", "main");
  return { root, bare, work };
}

/** The exact probe the script uses for the A3 squash proof. */
function combinedPatchId(repo, from, to) {
  const diff = execFileSync("git", ["diff", "--no-color", "--no-ext-diff", from, to],
    { cwd: repo, env: GIT_ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (!diff) return null;
  const out = execFileSync("git", ["patch-id", "--stable"],
    { cwd: repo, env: GIT_ENV, encoding: "utf8", input: diff });
  const m = out.match(/^([0-9a-f]{40,64})\b/);
  return m ? m[1] : null;
}

/** The patch-id of one commit, the way Get-SquashMap does it. `--root` matters: `diff <c>~1 <c>`
 *  throws on a repository's first commit, which has no parent. */
function commitPatchId(repo, sha) {
  const diff = execFileSync("git",
    ["diff-tree", "-p", "--root", "--no-color", "--no-ext-diff", sha],
    { cwd: repo, env: GIT_ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (!diff) return null;
  const out = execFileSync("git", ["patch-id", "--stable"],
    { cwd: repo, env: GIT_ENV, encoding: "utf8", input: diff });
  const m = out.match(/^([0-9a-f]{40,64})\b/);
  return m ? m[1] : null;
}

/** Fingerprint the newest non-merge commits on a ref, the way Get-SquashMap does. */
function squashMap(repo, ref, depth = 100) {
  const shas = git(repo, "rev-list", "--no-merges", `--max-count=${depth}`, ref)
    .split("\n").filter(Boolean);
  const map = new Map();
  for (const c of shas) {
    const id = commitPatchId(repo, c);
    if (id) map.set(id, c);
  }
  return map;
}

/** `git cherry` '+' lines - commits with no patch-identical twin upstream. */
function cherryPlus(repo, upstream, branch) {
  return git(repo, "cherry", upstream, branch)
    .split("\n").filter((l) => l.startsWith("+"));
}

// ===========================================================================
// PART A - the design, proven against real git
// ===========================================================================

test("A: THE fix1483 CONTROL - a [gone] upstream is not evidence the work is safe", () => {
  // This is the incident, reconstructed. fix1483 read [gone] and carried 28 commits that
  // existed nowhere else. The old tasks.json rule keyed on ': gone]' and nothing else.
  const { bare, work } = newRepoWithOrigin("fix1483");
  git(work, "checkout", "-b", "fix1483");
  commit(work, "a.txt", "a\n");
  git(work, "push", "-u", "origin", "fix1483");
  // The remote branch goes away (as a squash-merge would do), and the local unique work lands
  // AFTER the push - which is the whole trap.
  git(bare, "update-ref", "-d", "refs/heads/fix1483");
  git(work, "fetch", "--prune");
  const unique = commit(work, "b.txt", "only here\n");
  git(work, "checkout", "main");

  // The OLD rule fires: this branch reads [gone] and would have been force-deleted.
  const vv = git(work, "branch", "-vv");
  const goneLine = vv.split("\n").find((l) => l.includes("fix1483"));
  assert.match(goneLine, /: gone\]/,
    "precondition: the old rule's ': gone]' marker must be present, or this is not the trap");

  // The NEW rules all refuse.
  assert.equal(gitTry(work, "merge-base", "--is-ancestor", unique, "origin/main").ok, false,
    "A1 must not fire: the tip is not on origin/main");
  assert.ok(cherryPlus(work, "origin/main", "fix1483").length > 0,
    "A2 must report '+': commits exist here that exist nowhere upstream");
  const mb = git(work, "merge-base", "origin/main", "fix1483");
  const id = combinedPatchId(work, mb, "fix1483");
  assert.equal(squashMap(work, "origin/main").has(id), false,
    "A3 must not fire: no commit on origin/main carries this combined diff");
});

test("A: git branch --merged is blind to a squash - which is why it is not the test", () => {
  const { work } = newRepoWithOrigin("merged-blind");
  git(work, "checkout", "-b", "feature");
  commit(work, "f1.txt", "one\n");
  commit(work, "f2.txt", "two\n");
  commit(work, "f3.txt", "three\n");
  git(work, "checkout", "main");
  git(work, "merge", "--squash", "feature");
  git(work, "commit", "-m", "squash feature (#1)");
  git(work, "push", "origin", "main");

  const merged = git(work, "branch", "--merged", "main").split("\n").map((s) => s.replace(/^\*?\s*/, ""));
  assert.equal(merged.includes("feature"), false,
    "the naive criterion finds nothing after a squash - this is the documented reason it is rejected");
});

test("A: a SINGLE-commit squash is caught by the patch-equivalence arm", () => {
  const { work } = newRepoWithOrigin("squash-one");
  git(work, "checkout", "-b", "one");
  commit(work, "o.txt", "content\n");
  git(work, "checkout", "main");
  git(work, "merge", "--squash", "one");
  git(work, "commit", "-m", "squash one (#2)");
  git(work, "push", "origin", "main");

  assert.deepEqual(cherryPlus(work, "origin/main", "one"), [],
    "A2 must fire: the squash commit's patch is identical to the branch's only commit");
});

test("A: a MULTI-commit squash keeps the branch under A2, and is only released by A3", () => {
  // The honest limit of `git cherry`: three commits collapsed into one upstream commit have
  // three patch-ids that match nothing. A2 alone therefore KEEPS every multi-commit squash -
  // safe, but so useless that an operator would go back to force-deleting by hand. A3 exists
  // to close that gap without weakening anything, by matching the branch's COMBINED diff.
  const { work } = newRepoWithOrigin("squash-many");
  git(work, "checkout", "-b", "three");
  commit(work, "t1.txt", "one\n");
  commit(work, "t2.txt", "two\n");
  const tip = commit(work, "t3.txt", "three\n");
  git(work, "checkout", "main");
  git(work, "merge", "--squash", "three");
  git(work, "commit", "-m", "squash three (#3)");
  const squashSha = git(work, "rev-parse", "HEAD");
  git(work, "push", "origin", "main");

  assert.equal(cherryPlus(work, "origin/main", "three").length, 3,
    "A2 conservatively keeps it - the failure mode is refusal, never loss");
  assert.equal(gitTry(work, "merge-base", "--is-ancestor", tip, "origin/main").ok, false,
    "A1 does not fire either - the branch's own commits are genuinely unreachable");

  const mb = git(work, "merge-base", "origin/main", "three");
  const id = combinedPatchId(work, mb, "three");
  assert.ok(id, "the branch must have a combined patch-id");
  assert.equal(squashMap(work, "origin/main").get(id), squashSha,
    "A3 must resolve to the actual squash commit - a match means the content landed");
});

test("A: A3 cannot fire on a branch that adds anything the squash did not carry", () => {
  // The dangerous shape: content squash-merged, then MORE work added locally. A3 keys on the
  // whole merge-base..tip range, so one extra commit changes the combined diff and the match
  // is gone. It is not possible for A3 to release a branch that has grown since the squash.
  const { work } = newRepoWithOrigin("squash-plus");
  git(work, "checkout", "-b", "grown");
  commit(work, "g1.txt", "one\n");
  commit(work, "g2.txt", "two\n");
  git(work, "checkout", "main");
  git(work, "merge", "--squash", "grown");
  git(work, "commit", "-m", "squash grown (#4)");
  git(work, "push", "origin", "main");
  git(work, "checkout", "grown");
  commit(work, "g3.txt", "added after the squash - exists nowhere else\n");
  git(work, "checkout", "main");

  const mb = git(work, "merge-base", "origin/main", "grown");
  const id = combinedPatchId(work, mb, "grown");
  assert.equal(squashMap(work, "origin/main").has(id), false,
    "A3 must miss: the range now contains work the squash never saw");
  assert.ok(cherryPlus(work, "origin/main", "grown").length > 0, "A2 also refuses");
});

test("A: the ancestor arm fires only for a tip actually on origin/main", () => {
  const { work } = newRepoWithOrigin("ancestor");
  const base = git(work, "rev-parse", "HEAD");
  commit(work, "next.txt", "next\n");
  git(work, "push", "origin", "main");
  git(work, "branch", "old-pointer", base);
  git(work, "checkout", "-b", "off-to-the-side", base);
  const off = commit(work, "side.txt", "side\n");
  git(work, "checkout", "main");

  assert.equal(gitTry(work, "merge-base", "--is-ancestor", base, "origin/main").ok, true,
    "A1 fires for a branch pointing at a commit on origin/main");
  assert.equal(gitTry(work, "merge-base", "--is-ancestor", off, "origin/main").ok, false,
    "A1 must not fire for a commit that only exists on the side branch");
});

test("A: THE REJECTED DESIGN - a remote-tracking ref is not proof the remote has the commit", () => {
  // `git branch -r --contains <tip>` looks like a stronger proof than origin/main and is not
  // one. refs/remotes/* is a local cache: it can name a commit GitHub deleted weeks ago, and
  // "contained in origin/foo" is then a proof of nothing. Every arm is anchored on origin/main
  // for exactly this reason, and this test is what would notice if that were relaxed.
  const { bare, work } = newRepoWithOrigin("stale-tracking");
  git(work, "checkout", "-b", "pushed-then-deleted");
  const tip = commit(work, "p.txt", "p\n");
  git(work, "push", "-u", "origin", "pushed-then-deleted");
  git(bare, "update-ref", "-d", "refs/heads/pushed-then-deleted"); // gone on the server
  git(work, "checkout", "main");

  const serverHas = git(bare, "for-each-ref", "--format=%(refname)", "refs/heads/");
  assert.equal(serverHas.includes("pushed-then-deleted"), false, "the server no longer has it");

  const contains = git(work, "branch", "-r", "--contains", tip);
  assert.ok(contains.includes("origin/pushed-then-deleted"),
    "yet the stale remote-tracking ref still 'contains' it - which is why this probe is not used");
});

test("A: a worktree-held branch is readable from the porcelain, not guessed", () => {
  const { root, work } = newRepoWithOrigin("worktree");
  git(work, "branch", "held");
  const wt = path.join(root, "held-wt");
  git(work, "worktree", "add", wt, "held");

  const porcelain = git(work, "worktree", "list", "--porcelain");
  // The exact regex the script applies, transliterated.
  const held = porcelain.split("\n")
    .map((l) => /^branch\s+refs\/heads\/(.+)$/.exec(l.trim()))
    .filter(Boolean).map((m) => m[1]);
  assert.ok(held.includes("held"), "the worktree's branch must be named by the porcelain output");
  assert.ok(held.includes("main"), "the main worktree's own branch is in the same list");
});

test("A: for-each-ref %(upstream:track) is the field that says [gone]", () => {
  const { bare, work } = newRepoWithOrigin("track");
  git(work, "checkout", "-b", "tracked");
  commit(work, "t.txt", "t\n");
  git(work, "push", "-u", "origin", "tracked");
  git(work, "checkout", "-b", "untracked", "main");
  git(work, "checkout", "main");

  const SEP = "\u001f";
  const read = () => Object.fromEntries(
    git(work, "for-each-ref", `--format=%(refname:short)${SEP}%(upstream)${SEP}%(upstream:track)`,
      "refs/heads/")
      .split("\n").filter(Boolean)
      .map((l) => { const f = l.split(SEP); return [f[0], { upstream: f[1], track: f[2] }]; }));

  let refs = read();
  assert.equal(refs["tracked"].upstream, "refs/remotes/origin/tracked");
  assert.equal(refs["tracked"].track.includes("gone"), false, "live upstream is not [gone]");
  assert.equal(refs["untracked"].upstream, "", "a never-pushed branch has no upstream at all");
  assert.equal(refs["untracked"].track, "", "and no track field - it must not be read as [gone]");

  git(bare, "update-ref", "-d", "refs/heads/tracked");
  git(work, "fetch", "--prune");
  refs = read();
  assert.equal(refs["tracked"].track, "[gone]", "after the remote branch goes, the field says so");

  // The 0x1f separator survives even a branch name full of delimiters people might have picked.
  // NOT a pipe. The pipe is RESERVED on Windows, so a loose ref file for a branch name
  // containing one cannot be created at all and this test dies before it measures anything
  // (#1756, Windows CI, 2026-09-07). Every character below is legal in a git refname AND in a
  // Windows filename, so the assertion runs on both platforms.
  git(work, "branch", "weird,name;with=stuff");
  refs = read();
  assert.ok(Object.keys(refs).includes("weird,name;with=stuff"),
    "field splitting must not break on a branch name containing delimiter characters");
});

// ===========================================================================
// PART B - the shipped script must still say the safe thing
// ===========================================================================

const src = fs.readFileSync(PS1, "utf8");

test("B: the script exists and is pure ASCII", () => {
  // A BOM-less UTF-8 .ps1 with non-ASCII bytes is decoded as Windows-1252 by Windows
  // PowerShell 5.1 and fails to parse. Pure ASCII decodes identically with or without a BOM,
  // so it cannot hit that trap at all.
  const bytes = fs.readFileSync(PS1);
  const bad = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    const ok = b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e);
    if (!ok) bad.push(`byte 0x${b.toString(16)} at offset ${i}`);
  }
  assert.deepEqual(bad, [], "non-ASCII bytes found in scripts/branch-prune.ps1");
});

test("B: dry run is the default - -Apply is a bare switch that is never defaulted on", () => {
  assert.match(src, /\[switch\]\$Apply\s*,/, "-Apply must be declared as a bare switch");
  assert.doesNotMatch(src, /\[switch\]\$Apply\s*=/, "-Apply must never carry a default value");
  assert.doesNotMatch(src, /\$Apply\s*=\s*\$true/, "-Apply must never be forced on inside the script");
  assert.match(src, /\[switch\]\$DryRun\s*,/, "-DryRun must be declared as a bare switch");
  assert.doesNotMatch(src, /\[switch\]\$DryRun\s*=/,
    "-DryRun must not carry a $true default: that shape can only be turned off by -DryRun:$false");
  assert.match(src, /\$applying\s*=\s*\[bool\]\$Apply/,
    "-Apply must be the sole thing that decides whether anything is deleted");
});

test("B: contradictory switches abort rather than being resolved", () => {
  assert.match(src, /if\s*\(\$DryRun\s+-and\s+\$Apply\)/,
    "passing both -DryRun and -Apply must be refused, not guessed at");
});

test("B: every exclusion the design names is present and read, not assumed", () => {
  const required = {
    "protected branch names": /\$PROTECTED\s*=\s*@\("main"/,
    "the currently checked-out branch": /"rev-parse",\s*"--abbrev-ref",\s*"HEAD"/,
    "worktrees from the porcelain": /"worktree",\s*"list",\s*"--porcelain"/,
    "the worktree branch regex": /\^branch\\s\+refs\/heads\//,
    "upstream track state": /%\(upstream:track\)/,
    "open PRs from GitHub": /gh pr list --state open/,
    "a -Keep glob list": /\[string\[\]\]\$Keep/,
  };
  for (const [what, re] of Object.entries(required)) {
    assert.match(src, re, `missing exclusion: ${what}`);
  }
});

test("B: gh pr list is bounded and the run aborts if the list may be incomplete", () => {
  // `gh pr list` defaults to THIRTY results. Without an explicit limit, open PR heads past
  // the 30th are invisible and would be pruned.
  assert.match(src, /\$PR_LIMIT\s*=\s*\d+/, "the PR page size must be explicit");
  assert.match(src, /--limit \$PR_LIMIT/, "the explicit limit must actually be passed to gh");
  assert.match(src, /\$openPrHeads\.Count -ge \$PR_LIMIT/,
    "hitting the limit means the list cannot be proven complete and must abort");
  assert.match(src, /if \(\$ghCode -ne 0\)[\s\S]{0,400}exit \$EXIT_ABORT/,
    "a failed gh query must abort - a prune that cannot see open PRs is the one that eats one");
});

test("B: all three proofs are present and all three are anchored on origin/main", () => {
  assert.match(src, /\$UPSTREAM\s*=\s*"origin\/main"/);
  assert.match(src, /"merge-base",\s*"--is-ancestor",\s*\$B\.Sha,\s*\$UPSTREAM/, "A1 missing");
  assert.match(src, /Invoke-Git @\("cherry",\s*\$UPSTREAM,\s*\$B\.Name\)/, "A2 missing");
  assert.match(src, /patch-id/, "A3 missing");
  assert.doesNotMatch(src, /@\([^)]*"--contains"/,
    "the rejected remote-tracking-containment probe must not come back - refs/remotes is a cache");
});

test("B: the proofs are fail-closed - a failed probe keeps the branch", () => {
  assert.match(src, /if \(-not \$cherry\.Ok\)[\s\S]{0,200}Delete = \$false/,
    "a failed git cherry must keep the branch");
  assert.match(src, /if \(-not \$mbRes\.Ok\)[\s\S]{0,200}Delete = \$false/,
    "a failed merge-base must keep the branch");
  assert.match(src, /Reason = "\$\(\$ahead\.Count\) commit\(s\) exist ONLY here/,
    "the terminal case must be KEEP with a stated reason, not a fall-through to delete");
  // The default return of the classifier is a keep: there is no `Delete = $true` that is not
  // immediately preceded by a named proof.
  const deletes = src.match(/Delete = \$true; Reason = "(A\d)[^"]*"/g) ?? [];
  assert.equal(deletes.length, 3, "exactly three ways to become eligible, each a named proof");
});

test("B: nothing is destroyed - a quarantine ref is written and verified before deletion", () => {
  assert.match(src, /\$QUARANTINE_ROOT\s*=\s*"refs\/quarantine\/branch-prune"/);
  const iCheck = src.indexOf('"check-ref-format"');
  const iWrite = src.indexOf('"update-ref", $qref');
  const iRead = src.indexOf('"rev-parse", "--verify", "--quiet", $qref');
  const iDel = src.indexOf('@("branch", "-D"');
  assert.ok(iCheck > 0 && iWrite > iCheck, "the quarantine ref name must be validated first");
  assert.ok(iRead > iWrite, "the quarantine ref must be read back after being written");
  assert.ok(iDel > iRead,
    "the deletion must come after the quarantine ref has been proven to hold the same sha");
  assert.match(src, /if \("\$qsha" -ne \$d\.Sha\)[\s\S]{0,200}\$skipped\+\+/,
    "a quarantine ref that does not read back as the branch sha must block that deletion");
});

test("B: there is exactly one deletion, and it is re-proven immediately before it happens", () => {
  const dels = src.match(/@\("branch",\s*"-D"/g) ?? [];
  assert.equal(dels.length, 1, "one deletion site only - a second one is a second thing to audit");
  const iManifest = src.indexOf("Set-Content -LiteralPath $manifest");
  const iReread = src.indexOf('"for-each-ref", "--format=$fmt", "refs/heads/$($d.Name)"');
  const iVerdict = src.indexOf("$again = Get-BranchVerdict");
  const iDel = src.indexOf('@("branch", "-D"');
  assert.ok(iManifest > 0 && iManifest < iDel, "the manifest is written before anything is deleted");
  assert.ok(iReread > iManifest && iReread < iDel, "the branch record is re-read before deleting");
  assert.ok(iVerdict > iReread && iVerdict < iDel, "and re-classified before deleting");
  assert.match(src, /if \("\$nowSha" -ne \$d\.Sha\)[\s\S]{0,200}\$skipped\+\+/,
    "a tip that moved since the plan was computed must not be deleted on the old proof");
});

test("B: an unwritable manifest aborts the run", () => {
  assert.match(src, /catch \{[\s\S]{0,200}cannot write the restore manifest[\s\S]{0,200}exit \$EXIT_ABORT/,
    "if the restore manifest cannot be written, nothing may be deleted");
  assert.match(src, /\$ManifestRoot\s*=\s*"C:\\_SWEEP-branch-prune"/);
  assert.match(src, /git branch <name> <sha>/, "the manifest header must carry the recovery command");
});

test("B: the sweep gate uses the verdict strings status-sweep.ps1 actually emits", () => {
  // Cross-file on purpose. If someone rewords the sweep's verdict, this goes red here rather
  // than silently turning the gate into a no-op that always passes or always blocks.
  const sweepSrc = fs.readFileSync(SWEEP, "utf8");
  for (const [name, literal] of [
    ["$SWEEP_SAFE", "SAFE TO ACT:"],
    ["$SWEEP_BLOCK", "DO NOT ACT:"],
    ["$SWEEP_CAUTION", "CAUTION:"],
  ]) {
    assert.ok(src.includes(`= "${literal}"`), `branch-prune.ps1 must define ${name} as "${literal}"`);
    assert.ok(sweepSrc.includes(literal), `status-sweep.ps1 no longer emits "${literal}"`);
  }
  assert.match(src, /\(\(-not \$sawSafe\) -or \$sawBlock -or \$sawCaution\)/,
    "the safe verdict must be required AND both unsafe verdicts absent");
  assert.match(src, /status-sweep\.ps1 not found[\s\S]{0,120}exit \$EXIT_ABORT/,
    "a missing sweep script must abort rather than be treated as permission");
});

test("B: a large plan is refused whole, never silently truncated", () => {
  assert.match(src, /\$MaxDelete\s*=\s*50/, "there must be a default ceiling on one run");
  assert.match(src, /\$toDelete\.Count -gt \$MaxDelete[\s\S]{0,300}exit \$EXIT_ABORT/,
    "over the ceiling the whole run must abort - truncating would hide what was skipped");
});

test("B: the script has no path that can touch a remote, a stash or the working tree", () => {
  // These match INVOCATION shapes, not words. The header comment has to stay free to name the
  // things that were deliberately rejected and say why - that prose is the main thing a
  // reviewer of a destructive tool needs, and a word-level ban would delete it.
  //   - `@("verb"` / `@("git", "verb"` is how Invoke-Git and Test-GitOk are called;
  //   - `& git -C $... verb` is the only other way this script reaches git;
  //   - `& gh ...` is the only way it reaches GitHub.
  const forbidden = {
    "a push of any kind": /@\(\s*"push"|&\s*git\s+-C\s+\$\w+\s+push\b/,
    "a --delete argument": /"--delete"/,
    "a gh write": /&\s*gh\s+(?!pr list\b)|gh\s+api\b\s*[-<]/,
    "dropping a stash": /@\(\s*"stash"|&\s*git\s+-C\s+\$\w+\s+stash\b/,
    "git clean": /@\(\s*"clean"|&\s*git\s+-C\s+\$\w+\s+clean\b/,
    "a hard reset": /"--hard"|@\(\s*"reset"/,
    "a checkout": /@\(\s*"checkout"|&\s*git\s+-C\s+\$\w+\s+checkout\b/,
    "git rm": /@\(\s*"rm"/,
    "deleting any ref": /@\(\s*"update-ref",\s*"-d"|"--delete-ref"/,
    "touching refs\/remotes": /refs\/remotes\/[^*\s]*"/,
  };
  for (const [what, re] of Object.entries(forbidden)) {
    assert.doesNotMatch(src, re, `scripts/branch-prune.ps1 must contain no ${what}`);
  }
  // Positive control for the pattern shapes above: the one destructive call the script IS
  // allowed to make is written in exactly this form, so a miss here would mean the whole
  // forbidden list is scanning for a syntax the script never uses.
  assert.match(src, /@\("branch",\s*"-D"/,
    "the invocation shape these patterns scan for must be the shape the script actually uses");
});

test("B: the timestamp uses no format specifier that might not be one", () => {
  // "T" is not a documented .NET custom date-format specifier; "t" is the AM/PM designator.
  // A stamp that throws FormatException would abort every apply run, and it cannot be tried
  // out from Linux, so the script must not depend on how an unrecognised character is treated.
  assert.doesNotMatch(src, /ToString\("yyyyMMddTHHmmss"\)/,
    "do not embed a bare T in a custom date-format string");
  assert.match(src, /ToString\("yyyyMMdd"\)\s*\+\s*"T"\s*\+\s*\$utcNow\.ToString\("HHmmss"\)/,
    "build the stamp from two unambiguous formats");
});

test("B: a branch the ASCII manifest could not name faithfully is never eligible", () => {
  assert.match(src, /\$B\.Name -notmatch '\^\[\\x20-\\x7E\]\+\$'[\s\S]{0,200}Delete = \$false/,
    "a non-ASCII branch name must be kept: the manifest is ASCII and would misname it");
  assert.match(src, /-Encoding ASCII/, "the manifest encoding this rule exists for must be ASCII");
});

test("B: the watcher clone is refused by path, not by convention", () => {
  assert.match(src, /\$WATCHER_CLONE\s*=\s*"C:\\po-watcher\\ProjectOperations"/);
  assert.match(src, /refusing to run in the watcher clone[\s\S]{0,120}exit \$EXIT_ABORT/);
});

test("B: a missing origin/main aborts, because every proof is anchored on it", () => {
  assert.match(src, /rev-parse",\s*"--verify",\s*"--quiet",\s*"\$UPSTREAM\^\{commit\}"[\s\S]{0,300}exit \$EXIT_ABORT/,
    "without origin/main nothing can be proven and nothing may be deleted");
});

// ===========================================================================
// PART C - the caller
// ===========================================================================

const tasksRaw = fs.readFileSync(TASKS, "utf8");

test("C: tasks.json carries no force-delete of branches anywhere", () => {
  // The literal done_when gate for this slice, asserted here so it cannot regress quietly.
  assert.doesNotMatch(tasksRaw, /branch\s+-D/, "the force-delete fall-through must not come back");
  assert.doesNotMatch(tasksRaw, /branch\s+--delete/);
  assert.doesNotMatch(tasksRaw, /: gone\]/,
    "the ': gone]' sweep that drove the force-delete must not come back either");
});

test("C: the prune task invokes the script in its default dry-run mode", () => {
  const tasks = JSON.parse(tasksRaw).tasks;
  const prune = tasks.filter((t) => typeof t.command === "string" && t.command.includes("branch-prune.ps1"));
  assert.equal(prune.length, 1, "exactly one task should invoke branch-prune.ps1");
  const cmd = prune[0].command;
  assert.match(cmd, /powershell -NoProfile -File scripts\/branch-prune\.ps1/);
  assert.doesNotMatch(cmd, /-Apply/,
    "a one-click VS Code task must never be the thing that deletes branches");
  assert.match(cmd, /git fetch --prune/,
    "keep the fetch: pruning stale remote-tracking refs destroys nothing and freshens [gone]");
  assert.ok(cmd.indexOf("git fetch --prune") < cmd.indexOf("branch-prune.ps1"),
    "fetch first, so the plan is computed against fresh upstream state");
});

test("C: no other task in the file deletes branches", () => {
  const tasks = JSON.parse(tasksRaw).tasks;
  for (const t of tasks) {
    const cmd = typeof t.command === "string" ? t.command : "";
    assert.doesNotMatch(cmd, /branch\s+-[dD]\b/, `task "${t.label}" deletes branches`);
  }
});
