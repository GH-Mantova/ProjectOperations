// LOCAL-ONLY safeguards: .githooks/pre-commit, .githooks/pre-push, .githooks/local-only.sh
// (Phase 1 one-folder migration, 2026-10-17).
//
// Each case builds a throwaway repo + bare "remote" in the OS temp folder, points
// core.hooksPath at THIS repo's real .githooks, and drives git exactly as a person
// would. Nothing touches GitHub.
//
// Regression cover for two defects found in review before the first PR:
//   1. every *.example file was exempt, even .local/secrets/dummy.example;
//   2. the push check inspected nothing in a FIRST commit or a MERGE commit, and
//      waved the push through when git itself failed.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOKS = resolve(HERE, "..", "..", "..", ".githooks").replace(/\\/g, "/");

// A clean environment: no GIT_DIR / GIT_INDEX_FILE leaking in from an outer hook.
const ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));
ENV.GIT_TERMINAL_PROMPT = "0";

function git(cwd, args, input) {
  const r = spawnSync("git", args, { cwd, input, encoding: "utf8", env: ENV });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}
function ok(cwd, args) {
  const r = git(cwd, args);
  assert.equal(r.code, 0, `git ${args.join(" ")} failed:\n${r.out}`);
  return r.out;
}

// The shell git uses to run hooks (needed only to call pre-push directly). When git
// runs a hook on Windows it puts its own tool folder (dirname, sed, awk, sort) on
// PATH; a direct call must do the same.
const SH = (() => {
  if (process.platform !== "win32") return "sh";
  const r = spawnSync("git", ["var", "GIT_SHELL_PATH"], { encoding: "utf8", env: ENV });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : "sh";
})();
const HOOK_ENV = { ...ENV };
if (process.platform === "win32" && SH !== "sh") {
  const pathKey = Object.keys(HOOK_ENV).find((k) => k.toUpperCase() === "PATH") || "PATH";
  HOOK_ENV[pathKey] = dirname(SH) + ";" + (HOOK_ENV[pathKey] || "");
}

const made = [];
function sandbox() {
  const base = mkdtempSync(join(tmpdir(), "localonly-"));
  made.push(base);
  const remote = join(base, "remote.git");
  const repo = join(base, "repo");
  ok(base, ["init", "-q", "--bare", "remote.git"]);
  ok(base, ["init", "-q", "-b", "work", "repo"]); // never `main`: the NO-DRIFT guard would answer first
  for (const [k, v] of [
    ["user.email", "test@example.invalid"], ["user.name", "localonly-test"],
    ["core.hooksPath", HOOKS], ["commit.gpgsign", "false"], ["core.autocrlf", "false"],
  ]) ok(repo, ["config", k, v]);
  ok(repo, ["remote", "add", "origin", remote]);
  return { repo, remote };
}
function put(repo, rel, text = "x\n") {
  const p = join(repo, ...rel.split("/"));
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}
function commitFile(repo, rel, { verify = true } = {}) {
  put(repo, rel);
  ok(repo, ["add", "-f", "--", rel]);
  return git(repo, ["commit", "-q", ...(verify ? [] : ["--no-verify"]), "-m", `add ${rel}`]);
}
function remoteRefs(remote) {
  return git(remote, ["for-each-ref", "--format=%(refname)"]).out.trim();
}

process.on("exit", () => { for (const d of made) { try { rmSync(d, { recursive: true, force: true }); } catch { /* temp */ } } });

describe("pre-commit LOCAL-ONLY guard", () => {
  const refused = [
    [".local/dummy.txt", "anything under .local"],
    [".local/secrets/dummy.example", ".example inside .local is still .local (defect 1)"],
    [".local/secrets/.env.example", "even a template name inside .local"],
    ["apps/api/.local/x.txt", "a nested .local folder"],
    [".LOCAL/x.txt", "letter case does not matter"],
    [".local/café.txt", "a name Git would quote (non-ASCII)"],
    [".env", "a real .env"],
    ["config/.env.production", "a named .env"],
    ["certs/server.pem", "a certificate"],
    ["keys/deploy.key", "a key"],
    ["watcher-login.json", "a login token"],
    [".env.local", "a .env.<name> file that is not a template"],
  ];
  for (const [rel, why] of refused) {
    test(`REFUSES ${rel} (${why})`, () => {
      const { repo } = sandbox();
      const r = commitFile(repo, rel);
      assert.notEqual(r.code, 0, `commit of ${rel} should be refused:\n${r.out}`);
      assert.match(r.out, /LOCAL-ONLY/);
    });
  }
  const allowed = [
    [".env.example", "the repo's own template"],
    ["apps/api/.env.example", "a template in a sub-folder"],
    [".env.production.example", "a named template"],
    ["README.md", "an ordinary file"],
    ["docs/local-notes.md", "'local' in a name is not the .local folder"],
  ];
  for (const [rel, why] of allowed) {
    test(`ALLOWS ${rel} (${why})`, () => {
      const { repo } = sandbox();
      const r = commitFile(repo, rel);
      assert.equal(r.code, 0, `commit of ${rel} should be allowed:\n${r.out}`);
    });
  }
});

describe("pre-push LOCAL-ONLY check", () => {
  test("REFUSES a FIRST commit (no parent) that contains a .local file (defect 2)", () => {
    const { repo, remote } = sandbox();
    put(repo, "README.md");
    assert.equal(commitFile(repo, ".local/dummy.txt", { verify: false }).code, 0);
    const r = git(repo, ["push", "origin", "work"]);
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.out, /LOCAL-ONLY[\s\S]*\.local\/dummy\.txt/);
    assert.equal(remoteRefs(remote), "", "the remote must not receive anything");
  });

  test("ALLOWS a clean FIRST commit (control)", () => {
    const { repo, remote } = sandbox();
    assert.equal(commitFile(repo, "README.md").code, 0);
    const r = git(repo, ["push", "origin", "work"]);
    assert.equal(r.code, 0, r.out);
    assert.equal(remoteRefs(remote), "refs/heads/work");
  });

  test("REFUSES a later forced commit on a branch the remote already has", () => {
    const { repo, remote } = sandbox();
    commitFile(repo, "README.md");
    ok(repo, ["push", "-q", "origin", "work"]);
    const before = git(remote, ["rev-parse", "work"]).out.trim();
    assert.equal(commitFile(repo, ".local/dummy.txt", { verify: false }).code, 0);
    const r = git(repo, ["push", "origin", "work"]);
    assert.notEqual(r.code, 0, r.out);
    assert.equal(git(remote, ["rev-parse", "work"]).out.trim(), before);
  });

  // A merge whose only bad file was added while resolving it: neither parent's
  // own commit carries it, so only inspecting the MERGE commit can see it.
  function mergeScenario(addBadFile) {
    const { repo, remote } = sandbox();
    commitFile(repo, "a.txt");
    ok(repo, ["push", "-q", "origin", "work"]);
    ok(repo, ["switch", "-q", "-c", "side"]);
    commitFile(repo, "b.txt");
    ok(repo, ["push", "-q", "origin", "side"]);
    ok(repo, ["switch", "-q", "work"]);
    commitFile(repo, "c.txt");
    ok(repo, ["merge", "--no-ff", "--no-commit", "side"]);
    if (addBadFile) { put(repo, ".local/dummy.txt"); ok(repo, ["add", "-f", "--", ".local/dummy.txt"]); }
    ok(repo, ["commit", "-q", "--no-verify", "-m", "merge side"]);
    const before = git(remote, ["rev-parse", "work"]).out.trim();
    return { repo, remote, before };
  }

  test("REFUSES a MERGE commit that slipped a .local file in during the merge (defect 2)", () => {
    const { repo, remote, before } = mergeScenario(true);
    const r = git(repo, ["push", "origin", "work"]);
    assert.notEqual(r.code, 0, r.out);
    assert.match(r.out, /LOCAL-ONLY[\s\S]*\.local\/dummy\.txt/);
    assert.equal(git(remote, ["rev-parse", "work"]).out.trim(), before);
  });

  test("ALLOWS a clean MERGE commit (control)", () => {
    const { repo } = mergeScenario(false);
    const r = git(repo, ["push", "origin", "work"]);
    assert.equal(r.code, 0, r.out);
  });

  test("REFUSES (fails closed) when Git cannot inspect the outgoing commit", () => {
    const { repo } = sandbox();
    commitFile(repo, "README.md");
    const bogus = "f".repeat(40);
    const zero = "0".repeat(40);
    const r = spawnSync(SH, [`${HOOKS}/pre-push`, "origin", "x"], {
      cwd: repo, env: HOOK_ENV, encoding: "utf8",
      input: `refs/heads/work ${bogus} refs/heads/work ${zero}\n`,
    });
    assert.notEqual(r.status, 0, `${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /could not inspect/);
  });

  test("still checks when the remote's commit is not on this PC (falls back, does not skip)", () => {
    const { repo } = sandbox();
    commitFile(repo, "README.md");
    const unknown = "e".repeat(40);
    const run = () => spawnSync(SH, [`${HOOKS}/pre-push`, "origin", "x"], {
      cwd: repo, env: HOOK_ENV, encoding: "utf8",
      input: `refs/heads/work ${git(repo, ["rev-parse", "HEAD"]).out.trim()} refs/heads/work ${unknown}\n`,
    });
    assert.equal(run().status, 0, "a clean commit passes");
    assert.equal(commitFile(repo, ".local/dummy.txt", { verify: false }).code, 0);
    const r = run();
    assert.notEqual(r.status, 0, "a bad commit is still refused");
    assert.match(r.stderr, /LOCAL-ONLY/);
  });
});
