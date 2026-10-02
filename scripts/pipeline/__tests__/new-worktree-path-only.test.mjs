// Tests for scripts/pipeline/new-worktree.ps1 (NEW_WORKTREE_PATH_ONLY_V1).
//
// new-worktree.ps1 promises "The ONLY success-stream output: the path", but every
// native `git` call it made leaked to stdout, so `$wt = & new-worktree.ps1 ...` captured
// git's "Preparing worktree ..." / "HEAD is now at ..." text alongside the path, and the
// next `git -C $wt ...` failed on a multi-line value.
//
// This test drives the script against a disposable bare origin + clone, and asserts:
//   1. stdout is exactly one non-empty line — the worktree path.
//   2. -Remove exits 0.
//   3. an invalid slug exits 2 with EMPTY stdout (negative control — distinguishes
//      "printed only the path" from "printed nothing").
//
// CI's pipeline-tests job runs on Linux. If `pwsh` is not on PATH we skip, not fail.
import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(__dirname, "..", "new-worktree.ps1");

function haveTool(name) {
  const probe = spawnSync(process.platform === "win32" ? "where" : "which", [name], {
    stdio: "ignore",
  });
  return probe.status === 0;
}

function runGit(cwd, args) {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

function makeRepos() {
  const root = mkdtempSync(path.join(tmpdir(), "nwt-"));
  const origin = path.join(root, "origin.git");
  const clone = path.join(root, "clone");
  const wtroot = path.join(root, "worktrees");

  mkdirSync(origin, { recursive: true });
  execFileSync("git", ["init", "--bare", "-b", "main", origin], { stdio: "ignore" });

  mkdirSync(clone, { recursive: true });
  execFileSync("git", ["init", "-b", "main", clone], { stdio: "ignore" });
  runGit(clone, ["config", "user.email", "t@t"]);
  runGit(clone, ["config", "user.name", "t"]);
  writeFileSync(path.join(clone, "README.md"), "x\n");
  runGit(clone, ["add", "README.md"]);
  runGit(clone, ["commit", "-m", "init"]);
  runGit(clone, ["remote", "add", "origin", origin]);
  runGit(clone, ["push", "-u", "origin", "main"]);

  mkdirSync(wtroot, { recursive: true });
  return { root, clone, wtroot };
}

// Real callers consume the script as `$wt = & new-worktree.ps1 ...`, which captures
// ONLY the success stream. `Write-Host` goes to the information stream and is not
// captured. Running the script via `pwsh -File` would merge every stream into the
// subprocess stdout, which does not match how the caller sees it. So we drive it with
// `-Command`, do the assignment ourselves, and print only the captured value between
// unambiguous markers. Everything outside those markers is noise we ignore.
const MARK_START = "<<<NWT_CAPTURE_START>>>";
const MARK_END = "<<<NWT_CAPTURE_END>>>";

function psQuote(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

// Parameter names like `-Slug` must NOT be quoted — a quoted `-Slug` becomes a
// positional string argument instead of a parameter name. Values are always quoted.
function psArg(s) {
  const str = String(s);
  if (/^-[A-Za-z][A-Za-z0-9]*$/.test(str)) return str;
  return psQuote(str);
}

function runScript(args) {
  // Build the argument list as inline literals so PowerShell parses switches like
  // `-NoFetch` and `-Remove` as switch parameters rather than positional strings
  // (which is what `@sargs` splatting of a plain string array does).
  const argLiteral = args.map(psArg).join(" ");
  const cmd = [
    "$ErrorActionPreference = 'Continue'",
    `$captured = & ${psQuote(SCRIPT)} ${argLiteral} 6>$null`,
    `$code = $LASTEXITCODE`,
    `Write-Output ${psQuote(MARK_START)}`,
    `if ($null -ne $captured) { foreach ($line in @($captured)) { Write-Output $line } }`,
    `Write-Output ${psQuote(MARK_END)}`,
    `exit $code`,
  ].join("; ");

  const res = spawnSync(
    "pwsh",
    ["-NoProfile", "-NonInteractive", "-Command", cmd],
    { encoding: "utf8" },
  );
  const raw = (res.stdout ?? "").replace(/\r\n/g, "\n");
  const start = raw.indexOf(MARK_START);
  const end = raw.indexOf(MARK_END);
  let captured = "";
  if (start !== -1 && end !== -1 && end > start) {
    captured = raw.slice(start + MARK_START.length, end).replace(/^\n+/, "").replace(/\n+$/, "");
  }
  return {
    stdout: captured,
    rawStdout: raw,
    stderr: res.stderr ?? "",
    status: res.status,
  };
}

test("new-worktree.ps1: stdout is exactly the worktree path (NEW_WORKTREE_PATH_ONLY_V1)", (t) => {
  if (!haveTool("pwsh")) {
    t.skip("pwsh not available");
    return;
  }
  if (!existsSync(SCRIPT)) {
    t.skip(`script not found: ${SCRIPT}`);
    return;
  }

  const { root, clone, wtroot } = makeRepos();
  try {
    const slug = "t1";
    const create = runScript([
      "-Slug", slug,
      "-Repo", clone,
      "-Root", wtroot,
      "-NoFetch",
    ]);

    assert.equal(
      create.status,
      0,
      `exit=${create.status} stderr=${create.stderr}\nraw=${create.rawStdout}`,
    );

    // `create.stdout` is the captured success stream only — this is what a caller
    // doing `$wt = & new-worktree.ps1 ...` would get.
    const lines = create.stdout.split("\n").filter((l) => l !== "");
    assert.equal(
      lines.length,
      1,
      `expected exactly one captured line (the path), got ${lines.length}:\n` +
        `captured=<<<${create.stdout}>>>\nraw=${create.rawStdout}`,
    );
    const expected = path.join(wtroot, slug);
    assert.equal(lines[0], expected, `captured value should be the worktree path`);

    const remove = runScript([
      "-Slug", slug,
      "-Repo", clone,
      "-Root", wtroot,
      "-Remove",
    ]);
    assert.equal(remove.status, 0, `-Remove exit=${remove.status} stderr=${remove.stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("new-worktree.ps1: invalid slug exits 2 with empty stdout (negative control)", (t) => {
  if (!haveTool("pwsh")) {
    t.skip("pwsh not available");
    return;
  }
  if (!existsSync(SCRIPT)) {
    t.skip(`script not found: ${SCRIPT}`);
    return;
  }

  const { root, clone, wtroot } = makeRepos();
  try {
    const bad = runScript([
      "-Slug", "../escape",
      "-Repo", clone,
      "-Root", wtroot,
      "-NoFetch",
    ]);
    assert.equal(
      bad.status,
      2,
      `expected exit 2, got ${bad.status}; stderr=${bad.stderr}\nraw=${bad.rawStdout}`,
    );
    assert.equal(
      bad.stdout.trim(),
      "",
      `expected EMPTY captured value for bad slug (REFUSED goes to Write-Host), ` +
        `got: <<<${bad.stdout}>>>\nraw=${bad.rawStdout}`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
