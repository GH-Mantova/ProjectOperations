/**
 * Tests for scripts/pipeline/arm-prompt.ps1
 *
 * Runs with: node --test scripts/pipeline/__tests__/arm-prompt.test.mjs
 *
 * Each test spins up a throwaway git repo under os.tmpdir() so nothing touches
 * the real C:\ProjectOperations2 index. The script is invoked via pwsh (PowerShell 7)
 * falling back to powershell.exe; if neither is available the suite is skipped.
 *
 * Windows-only runtime: arm-prompt.ps1 calls [System.IO.File]::Open which requires
 * a real Windows filesystem. Tests are skipped on non-Windows platforms.
 */

import assert from "node:assert/strict";
import { test, describe, before, after } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { execFileSync, spawnSync, spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import fs from "node:fs";

// ---------------------------------------------------------------------------
// Platform guard
// ---------------------------------------------------------------------------

const IS_WIN = process.platform === "win32";

// Locate pwsh or powershell.exe.
function findPwsh() {
  for (const candidate of ["pwsh", "powershell.exe"]) {
    const res = spawnSync(candidate, ["-Command", "1"], { encoding: "utf8", timeout: 5000 });
    if (res.status === 0) return candidate;
  }
  return null;
}

const PWSH = IS_WIN ? findPwsh() : null;

// Absolute path to the script under test (in the real repo, not the temp repo).
const HERE     = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const ARM_SCRIPT = join(REPO_ROOT, "scripts", "pipeline", "arm-prompt.ps1");
const LINT_SCRIPT = join(REPO_ROOT, "scripts", "pipeline", "lint-prompt.mjs");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal but lint-passing HOLD file content.
 * The premise is a shell command that always succeeds (exits 0) meaning the
 * work IS needed. On Windows the linter runs premises via git-bash; we use a
 * premise that always returns "needed": `! grep -q XYZZY_SENTINEL_ABSENT /dev/null`
 * (grep exits 1 when the pattern is not found, so `!` flips it to 0 = needed).
 *
 * For lint to ADMIT: all required fields must be present, size <= 10.
 */
function validHoldContent(extra = "") {
  return `---
premise: '! grep -q XYZZY_SENTINEL_ABSENT /dev/null'
premise_means: sentinel absent, work is needed
scope:
  - scripts/pipeline/arm-prompt.ps1
done_when: test -f scripts/pipeline/arm-prompt.ps1
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# Test HOLD prompt

This is a test prompt for the arm-prompt.ps1 test suite.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
${extra}
`.trimStart();
}

/**
 * Content that will cause lint to REJECT (missing required fields).
 * lint-prompt.mjs requires: premise, premise_means, scope, done_when, size.
 */
function rejectHoldContent() {
  return `---
scope:
  - some/file.ts
---

# A prompt with no premise (will be rejected by lint).
`.trimStart();
}

/**
 * Initialize a throwaway git repo under os.tmpdir().
 * Returns the path to the repo root.
 * The structure mirrors what arm-prompt.ps1 expects:
 *   <root>/.git/
 *   <root>/docs/pr-prompts/
 *   <root>/scripts/pipeline/lint-prompt.mjs  (symlink-copied for the linter path)
 */
function makeTempRepo() {
  const dir = mkdtempSync(join(os.tmpdir(), "arm-test-"));
  execFileSync("git", ["init", dir], { encoding: "utf8" });
  execFileSync("git", ["-C", dir, "config", "user.email", "test@test.com"], { encoding: "utf8" });
  execFileSync("git", ["-C", dir, "config", "user.name", "Test"], { encoding: "utf8" });

  // Create directory structure.
  mkdirSync(join(dir, "docs", "pr-prompts"), { recursive: true });
  mkdirSync(join(dir, "scripts", "pipeline"), { recursive: true });

  // Write a placeholder so git has something to commit.
  writeFileSync(join(dir, "README.md"), "test\n");
  execFileSync("git", ["-C", dir, "add", "."], { encoding: "utf8" });
  execFileSync("git", ["-C", dir, "commit", "-m", "init"], { encoding: "utf8" });

  return dir;
}

/**
 * Add a HOLD file to the temp repo, git-add, and commit it so the file is
 * tracked. Returns the slug used.
 */
function addHoldFile(repoDir, slug, content) {
  const rel = `docs/pr-prompts/${slug}-HOLD.md`;
  writeFileSync(join(repoDir, rel.replace(/\//g, "\\")), content, "utf8");
  execFileSync("git", ["-C", repoDir, "add", rel], { encoding: "utf8" });
  execFileSync("git", ["-C", repoDir, "commit", "-m", `add ${slug}-HOLD.md`], { encoding: "utf8" });
  return rel;
}

/**
 * Run arm-prompt.ps1 against a temp repo.
 * arm-prompt.ps1 hardcodes REPO_ROOT = "C:\ProjectOperations2" so we override
 * it by patching the repo root via a wrapper script that sets the variable
 * before dot-sourcing. We also override LINT_SCRIPT to point at the real
 * lint-prompt.mjs in the actual repo.
 *
 * Returns { status, stdout, stderr }.
 */
function runArmPrompt(repoDir, args = [], opts = {}) {
  if (!PWSH) throw new Error("pwsh not available");

  // Build a small wrapper that overrides the constants before running the script body.
  // We do this by dot-sourcing the script but prefixing variable overrides.
  // arm-prompt.ps1 sets $REPO_ROOT etc. in its own scope; we need to override those.
  // The cleanest approach: invoke via a wrapper that sets the variables, then runs the script.
  const lockTimeoutSeconds = opts.lockTimeoutSeconds || 5;

  // Escape paths for PowerShell string literals.
  const escapedRepo  = repoDir.replace(/\\/g, "\\\\").replace(/'/g, "''");
  const escapedLint  = LINT_SCRIPT.replace(/\\/g, "\\\\").replace(/'/g, "''");
  const escapedArm   = ARM_SCRIPT.replace(/\\/g, "\\\\").replace(/'/g, "''");

  // Build the extra args string.
  const extraArgs = args.map((arg) => `'${arg.replace(/'/g, "''")}'`).join(" ");

  // We use a sed-like approach: read the script content, replace the constants, execute.
  // Simpler: pass override values as environment variables and patch the script's constants
  // by wrapping with a small PS prologue that redefines the variables.
  const wrapper = `
$ErrorActionPreference = 'Continue'
$script:_origDir = Get-Location
# Override the hardcoded paths that arm-prompt.ps1 uses.
# We dot-source the script to run it in our scope, then override its constants after parsing.
# Actually the cleanest: define a function that replaces the constants, then call the script.
# The script uses module-level variables, so we need to inline-patch.
# Strategy: read the script, substitute the constant strings, run from temp file.

$scriptContent = Get-Content -Raw -Encoding UTF8 '${escapedArm}'
$scriptContent = $scriptContent -replace [regex]::Escape('C:\\\\ProjectOperations2'), '${escapedRepo}'
$scriptContent = $scriptContent -replace [regex]::Escape('C:\\ProjectOperations2'), '${escapedRepo}'
$scriptContent = $scriptContent -replace [regex]::Escape('$REPO_ROOT\\\\\\\\scripts\\\\\\\\pipeline\\\\\\\\lint-prompt.mjs'), '${escapedLint}'

$tmpFile = [System.IO.Path]::GetTempFileName() + '.ps1'
Set-Content -Path $tmpFile -Value $scriptContent -Encoding UTF8
try {
    & pwsh -NoProfile -NonInteractive -File $tmpFile -Name ${extraArgs} -LockTimeoutSeconds ${lockTimeoutSeconds} ${opts.whatIf ? '-WhatIf' : ''}
    $exitCode = $LASTEXITCODE
} finally {
    Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
}
exit $exitCode
`.trim();

  const result = spawnSync(PWSH, ["-NoProfile", "-NonInteractive", "-Command", wrapper], {
    encoding: "utf8",
    timeout: (lockTimeoutSeconds + 10) * 1000,
    env: { ...process.env },
  });

  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

/**
 * Get the git status --porcelain of a repo for change detection.
 */
function gitStatus(repoDir) {
  const result = execFileSync("git", ["-C", repoDir, "status", "--porcelain"], { encoding: "utf8" });
  return result.trim();
}

/**
 * Get git diff --cached for a repo.
 */
function gitDiffCached(repoDir) {
  const result = execFileSync("git", ["-C", repoDir, "diff", "--cached", "--name-only"], { encoding: "utf8" });
  return result.trim();
}

// ---------------------------------------------------------------------------
// Alternative: direct invocation with path injection via env var
// ---------------------------------------------------------------------------

/**
 * Simplified runner that injects repo root via a modified invocation.
 * We use PowerShell's -Command with inline variable overrides so the script
 * can be sourced with overridden constants.
 */
function runArmPromptSimple(repoDir, slug, args = [], opts = {}) {
  if (!PWSH) throw new Error("pwsh not available");

  const lockTimeoutSeconds = opts.lockTimeoutSeconds != null ? opts.lockTimeoutSeconds : 5;

  // Read the arm script content.
  const scriptContent = readFileSync(ARM_SCRIPT, "utf8");

  // Replace the hardcoded REPO_ROOT and LINT_SCRIPT constants.
  // PowerShell uses single backslash in double-quoted strings (no escape sequences for \).
  // Do NOT double-escape — "C:\Users\foo" in PS is the correct path, not "C:\\Users\\foo".
  let patched = scriptContent;
  // Replace the REPO_ROOT assignment line.
  patched = patched.replace(
    /\$REPO_ROOT\s*=\s*"C:\\ProjectOperations2"/,
    `$REPO_ROOT   = "${repoDir}"`
  );
  // Replace the LINT_SCRIPT assignment.
  patched = patched.replace(
    /\$LINT_SCRIPT\s*=\s*"[^"]*lint-prompt\.mjs"/,
    `$LINT_SCRIPT = "${LINT_SCRIPT}"`
  );

  // Write the patched script to a temp file.
  const tmpFile = join(os.tmpdir(), `arm-test-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`);
  // String.replace with a non-matching regex returns the input UNCHANGED, silently.
  // If either constant is ever reformatted, the 'patched' script would keep pointing at
  // C:\ProjectOperations2 and this test suite would run `git mv` against the live shared
  // dev tree - the precise incident arm-prompt.ps1 exists to prevent. Fail closed instead.
  if (patched === scriptContent) {
    throw new Error("arm-prompt.test: REPO_ROOT/LINT_SCRIPT patch did not apply (script unchanged)");
  }
  if (patched.includes('"C:\\ProjectOperations2"')) {
    throw new Error("arm-prompt.test: patched script still references the live repo C:\\ProjectOperations2");
  }
  if (!patched.includes(repoDir)) {
    throw new Error(`arm-prompt.test: patched script does not reference the temp repo ${repoDir}`);
  }

  writeFileSync(tmpFile, patched, "utf8");

  try {
    const psArgs = ["-NoProfile", "-NonInteractive", "-File", tmpFile, "-Name", slug,
      "-LockTimeoutSeconds", String(lockTimeoutSeconds)];
    // -Actor is MANDATORY on the script. Every test that is not specifically testing
    // the refusal path supplies one, so these tests exercise the same call shape a
    // real caller must use. opts.omitActor drops it; opts.actor overrides the value.
    if (!opts.omitActor) psArgs.push("-Actor", opts.actor != null ? opts.actor : "test-suite");
    if (args.includes("-WhatIf") || opts.whatIf) psArgs.push("-WhatIf");
    // -Force waives the ALREADY_ARMED refusal (RULE 4). Only the -Force tests
    // pass this; every other test exercises the refusal path.
    if (opts.force) psArgs.push("-Force");

    const result = spawnSync(PWSH, psArgs, {
      encoding: "utf8",
      timeout: (lockTimeoutSeconds + 15) * 1000,
    });

    return {
      status: result.status == null ? -1 : result.status,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
    };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("arm-prompt.ps1", { skip: !IS_WIN || !PWSH ? "Windows + pwsh required" : false }, () => {

  // -------------------------------------------------------------------------
  // Happy path: clean index + valid HOLD -> renames, exits 0
  // -------------------------------------------------------------------------
  test("clean index + valid HOLD renames to ready and exits 0", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-valid-hold";
    addHoldFile(repo, slug, validHoldContent());

    const holdPath  = join(repo, "docs", "pr-prompts", `${slug}-HOLD.md`);
    const readyPath = join(repo, "docs", "pr-prompts", `${slug}-ready.md`);

    const res = runArmPromptSimple(repo, slug);

    assert.equal(res.status, 0, `expected exit 0, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);

    // The HOLD file should no longer exist; the ready file should.
    assert.ok(!existsSync(holdPath), "HOLD file should have been renamed away");
    assert.ok(existsSync(readyPath), "ready file should now exist");

    // Step 7 (ARM_INDEX_RELEASED): the index must be CLEAN after arming.
    // Before Step 7 the rename was left staged; that is the defect this change fixes.
    const cached = gitDiffCached(repo);
    assert.equal(cached, "", `index must be clean after arming (Step 7), got: ${cached}`);
  });

  // -------------------------------------------------------------------------
  // Dirty index -> exits 2 and changes nothing
  // -------------------------------------------------------------------------
  test("dirty index exits 2 and changes nothing", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-dirty-index";
    addHoldFile(repo, slug, validHoldContent());

    // Stage a file to make the index dirty.
    const extraFile = join(repo, "dirty-file.txt");
    writeFileSync(extraFile, "dirty\n", "utf8");
    execFileSync("git", ["-C", repo, "add", "dirty-file.txt"], { encoding: "utf8" });

    const holdPath  = join(repo, "docs", "pr-prompts", `${slug}-HOLD.md`);
    const readyPath = join(repo, "docs", "pr-prompts", `${slug}-ready.md`);

    const statusBefore = gitStatus(repo);
    const res = runArmPromptSimple(repo, slug);

    assert.equal(res.status, 2, `expected exit 2 (dirty index), got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);

    // Working tree must be unchanged: HOLD still exists, ready does not.
    assert.ok(existsSync(holdPath), "HOLD file must still exist after dirty-index failure");
    assert.ok(!existsSync(readyPath), "ready file must not exist after dirty-index failure");

    // The staged dirty file must still be staged (we didn't unstage it).
    const cachedAfter = gitDiffCached(repo);
    assert.ok(cachedAfter.includes("dirty-file.txt"),
      `dirty-file.txt should still be staged, got: ${cachedAfter}`);
  });

  // -------------------------------------------------------------------------
  // HOLD absent -> exits non-zero, changes nothing
  // -------------------------------------------------------------------------
  test("missing HOLD file exits non-zero and changes nothing", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-no-hold";
    // Do NOT add a HOLD file.

    const res = runArmPromptSimple(repo, slug);

    assert.notEqual(res.status, 0, `expected non-zero exit when HOLD is absent, got 0\nstdout: ${res.stdout}`);
    assert.equal(gitStatus(repo), "", "working tree must be clean after absent-HOLD failure");
  });

  // -------------------------------------------------------------------------
  // Lint REJECT -> exits non-zero, changes nothing
  // -------------------------------------------------------------------------
  test("lint-rejected HOLD exits non-zero and changes nothing", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-lint-reject";
    // This content is missing required fields -> lint will REJECT.
    addHoldFile(repo, slug, rejectHoldContent());

    const holdPath  = join(repo, "docs", "pr-prompts", `${slug}-HOLD.md`);
    const readyPath = join(repo, "docs", "pr-prompts", `${slug}-ready.md`);

    const res = runArmPromptSimple(repo, slug);

    assert.notEqual(res.status, 0, `expected non-zero exit when lint rejects, got 0\nstdout: ${res.stdout}`);
    assert.ok(existsSync(holdPath), "HOLD file must still exist after lint rejection");
    assert.ok(!existsSync(readyPath), "ready file must not exist after lint rejection");
    assert.equal(gitDiffCached(repo), "", "index must be clean after lint rejection");
  });

  // -------------------------------------------------------------------------
  // Body carries DO NOT ARM -> exits non-zero, changes nothing
  // -------------------------------------------------------------------------
  test("HOLD body containing 'DO NOT ARM' exits non-zero and changes nothing", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-do-not-arm";
    // Valid lint fields but body contains the sentinel.
    const content = validHoldContent("DO NOT ARM — this prompt is blocked from arming.");
    addHoldFile(repo, slug, content);

    const holdPath  = join(repo, "docs", "pr-prompts", `${slug}-HOLD.md`);
    const readyPath = join(repo, "docs", "pr-prompts", `${slug}-ready.md`);

    const res = runArmPromptSimple(repo, slug);

    assert.notEqual(res.status, 0, `expected non-zero exit for DO NOT ARM, got 0\nstdout: ${res.stdout}`);
    assert.ok(existsSync(holdPath), "HOLD file must still exist");
    assert.ok(!existsSync(readyPath), "ready file must not exist");
    assert.equal(gitDiffCached(repo), "", "index must be clean");
  });

  // -------------------------------------------------------------------------
  // Lock held by another process -> exits non-zero within timeout
  // -------------------------------------------------------------------------
  test("lock held by another process causes non-zero exit within timeout", async () => {
    const repo = makeTempRepo();
    const slug  = "pr-test-lock-held";
    addHoldFile(repo, slug, validHoldContent());

    // Compute the lock path the patched script would use.
    const lockPath = join(repo, ".git", "po-arm.lock");

    // Spawn a PowerShell process that acquires the exclusive lock and signals readiness
    // via stdout, then sleeps for 30s to hold the lock while arm-prompt runs.
    const acquireLockScript = [
      `$stream = [System.IO.File]::Open('${lockPath}', [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)`,
      `$bytes = [System.Text.Encoding]::ASCII.GetBytes('99999')`,
      `$stream.Write($bytes, 0, $bytes.Length)`,
      `$stream.Flush()`,
      `Write-Host 'LOCK_ACQUIRED'`,
      `$host.UI.RawUI.FlushInputBuffer()`,
      `Start-Sleep -Seconds 30`,
      `$stream.Close()`,
    ].join("; ");

    // Spawn async so we can wait for the "LOCK_ACQUIRED" signal without blocking.
    const lockHolder = spawn(PWSH, ["-NoProfile", "-NonInteractive", "-Command", acquireLockScript], {
      stdio: ["ignore", "pipe", "ignore"],
    });

    // Wait for the lock-holder to signal that it has the lock, or timeout.
    await new Promise((resolve) => {
      let buf = "";
      lockHolder.stdout.on("data", (chunk) => {
        buf += chunk.toString();
        if (buf.includes("LOCK_ACQUIRED")) resolve();
      });
      lockHolder.on("error", () => resolve());
      // Safety timeout in case the process doesn't signal.
      setTimeout(resolve, 5000);
    });

    try {
      // Now try to arm with a short timeout (3 s max wait).
      const res = runArmPromptSimple(repo, slug, [], { lockTimeoutSeconds: 3 });
      assert.notEqual(res.status, 0, `expected non-zero exit when lock is held, got 0\nstdout: ${res.stdout}`);
    } finally {
      // Kill the lock-holder process so it releases the lock.
      try { lockHolder.kill(); } catch (_) {}
    }
  });

  // -------------------------------------------------------------------------
  // Lock held by ANOTHER arm-prompt run -> the timeout message names the holder
  // -------------------------------------------------------------------------
  // The test above holds the lock with FileShare::None, which no waiter can read.
  // The case that actually matters is arm-prompt vs arm-prompt, where the holder
  // shares Read. Before 2026-08-26 the waiter used File::ReadAllText (FileShare.Read),
  // which cannot coexist with the holder's ReadWrite handle, so the read threw every
  // time and the message always said '(unknown)'. Assert on the PID, not just the code.
  test("timeout message names the holder PID when the lock is held by an arm-prompt-style writer", async () => {
    const repo = makeTempRepo();
    const slug = "pr-test-lock-pid";
    addHoldFile(repo, slug, validHoldContent());

    const lockPath = join(repo, ".git", "po-arm.lock");
    const holderPid = "424242";

    // Mirror arm-prompt.ps1's own Acquire-Lock exactly: ReadWrite + FileShare::Read.
    const acquireLockScript = [
      `$stream = [System.IO.File]::Open('${lockPath}', [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::Read)`,
      `$stream.SetLength(0)`,
      `$bytes = [System.Text.Encoding]::ASCII.GetBytes('${holderPid}')`,
      `$stream.Write($bytes, 0, $bytes.Length)`,
      `$stream.Flush()`,
      `Write-Host 'LOCK_ACQUIRED'`,
      `Start-Sleep -Seconds 30`,
      `$stream.Close()`,
    ].join("; ");

    const lockHolder = spawn(PWSH, ["-NoProfile", "-NonInteractive", "-Command", acquireLockScript], {
      stdio: ["ignore", "pipe", "ignore"],
    });

    await new Promise((resolve) => {
      let buf = "";
      lockHolder.stdout.on("data", (chunk) => {
        buf += chunk.toString();
        if (buf.includes("LOCK_ACQUIRED")) resolve();
      });
      lockHolder.on("error", () => resolve());
      setTimeout(resolve, 5000);
    });

    try {
      const res = runArmPromptSimple(repo, slug, [], { lockTimeoutSeconds: 3 });
      const out = `${res.stdout || ""}${res.stderr || ""}`;
      assert.notEqual(res.status, 0, `expected non-zero exit when lock is held, got 0\n${out}`);
      assert.ok(
        out.includes(`Held by PID ${holderPid}`),
        `timeout message must name the holder PID ${holderPid}, got:\n${out}`
      );
      assert.ok(
        !out.includes("Held by PID (unknown)"),
        `holder PID must be readable, not '(unknown)'. Output:\n${out}`
      );
      assert.equal(gitDiffCached(repo), "", "index must be clean");
    } finally {
      try { lockHolder.kill(); } catch (_) {}
    }
  });

  // -------------------------------------------------------------------------
  // -WhatIf: exits 0, working tree and index byte-identical afterwards
  // -------------------------------------------------------------------------
  test("-WhatIf exits 0 and leaves working tree and index unchanged", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-whatif";
    addHoldFile(repo, slug, validHoldContent());

    const statusBefore = gitStatus(repo);
    const cachedBefore = gitDiffCached(repo);

    const res = runArmPromptSimple(repo, slug, [], { whatIf: true });

    assert.equal(res.status, 0, `expected exit 0 from -WhatIf, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);

    const statusAfter = gitStatus(repo);
    const cachedAfter = gitDiffCached(repo);

    assert.equal(statusAfter, statusBefore, "-WhatIf must not change working tree status");
    assert.equal(cachedAfter, cachedBefore, "-WhatIf must not change staged files");

    // The HOLD file must still exist and ready must not.
    const holdPath  = join(repo, "docs", "pr-prompts", `${slug}-HOLD.md`);
    const readyPath = join(repo, "docs", "pr-prompts", `${slug}-ready.md`);
    assert.ok(existsSync(holdPath), "HOLD file must still exist after -WhatIf");
    assert.ok(!existsSync(readyPath), "ready file must not exist after -WhatIf");
  });

  // -------------------------------------------------------------------------
  // Step 7 regression: index clean after a successful arm
  // This is the primary test for ARM_INDEX_RELEASED.
  // -------------------------------------------------------------------------
  test("index is clean after a successful arm (Step 7 ARM_INDEX_RELEASED)", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-index-released";
    addHoldFile(repo, slug, validHoldContent());

    const readyPath = join(repo, "docs", "pr-prompts", `${slug}-ready.md`);

    const res = runArmPromptSimple(repo, slug);
    assert.equal(res.status, 0, `expected exit 0\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);

    // The ready file must be on disk — watcher reads from filesystem.
    assert.ok(existsSync(readyPath), "ready file must exist on disk after arming");

    // The index must be clean: no staged paths remain.
    const result = execFileSync("git", ["-C", repo, "diff", "--cached", "--name-status"], { encoding: "utf8" });
    assert.equal(result.trim(), "", `index must be empty after Step 7, got:\n${result}`);
  });

  // -------------------------------------------------------------------------
  // ready file survives the index release (the watcher reads the filesystem)
  // -------------------------------------------------------------------------
  test("ready file is on disk after the index release", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-ready-survives";
    addHoldFile(repo, slug, validHoldContent());

    const holdPath  = join(repo, "docs", "pr-prompts", `${slug}-HOLD.md`);
    const readyPath = join(repo, "docs", "pr-prompts", `${slug}-ready.md`);

    const res = runArmPromptSimple(repo, slug);
    assert.equal(res.status, 0, `expected exit 0\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);

    // HOLD is gone, ready is present — the filesystem state the watcher needs.
    assert.ok(!existsSync(holdPath), "HOLD must be gone after arming");
    assert.ok(existsSync(readyPath), "ready file must exist on disk — watcher reads filesystem");
  });

  // -------------------------------------------------------------------------
  // Audit line is still written after the index release
  // -------------------------------------------------------------------------
  test("audit line written to .arming-log.txt even after index release", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-audit-after-release";
    addHoldFile(repo, slug, validHoldContent());

    const res = runArmPromptSimple(repo, slug);
    assert.equal(res.status, 0, `expected exit 0\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);

    const logPath = join(repo, "docs", "pr-prompts", ".arming-log.txt");
    assert.ok(existsSync(logPath), ".arming-log.txt must exist after arming");
    const logContent = readFileSync(logPath, "utf8");
    assert.ok(logContent.includes(`ARMED  ${slug}`), `audit line must mention the slug, got:\n${logContent}`);
  });

  // -------------------------------------------------------------------------
  // Back-to-back arming: arm A then arm B without an intervening commit.
  // Before Step 7, arm B failed Assert-CleanIndex because arm A left the
  // rename staged. This is the regression that reopened the bypass.
  //
  // After the ARMGUARD slice added RULE 4 enforcement, arm B is now refused
  // FIRST by Assert-NotAlreadyArmed (arm A's ready file is on disk). Passing
  // -Force lets arm B proceed so this test still exercises what it was written
  // to prove: that arm A's rename was released from the index by Step 7 and
  // arm B does not trip Assert-CleanIndex.
  // -------------------------------------------------------------------------
  test("back-to-back arming succeeds: arm A then arm B (with -Force) without a commit in between", () => {
    const repo = makeTempRepo();
    const slugA = "pr-test-back-to-back-a";
    const slugB = "pr-test-back-to-back-b";
    addHoldFile(repo, slugA, validHoldContent());
    addHoldFile(repo, slugB, validHoldContent());

    const readyPathA = join(repo, "docs", "pr-prompts", `${slugA}-ready.md`);
    const readyPathB = join(repo, "docs", "pr-prompts", `${slugB}-ready.md`);

    // Arm A.
    const resA = runArmPromptSimple(repo, slugA);
    assert.equal(resA.status, 0, `arm A expected exit 0\nstdout: ${resA.stdout}\nstderr: ${resA.stderr}`);
    assert.ok(existsSync(readyPathA), "arm A: ready file must exist");

    // Without Step 7, the staged rename from arm A would make arm B fail
    // Assert-CleanIndex with exit 2 (the original regression). With Step 7 the
    // index is clean; -Force waives the new RULE 4 refusal so we still probe
    // Assert-CleanIndex the way this test was designed to.
    const resB = runArmPromptSimple(repo, slugB, [], { force: true });
    assert.equal(resB.status, 0,
      `arm B expected exit 0 (back-to-back arming regression)\nstdout: ${resB.stdout}\nstderr: ${resB.stderr}`);
    assert.ok(existsSync(readyPathB), "arm B: ready file must exist");

    // Index must still be clean after both arms.
    const cached = gitDiffCached(repo);
    assert.equal(cached, "", `index must be clean after both arms, got: ${cached}`);
  });

  // -------------------------------------------------------------------------
  // Unexpected-stage path: with a foreign path staged during the window,
  // the run restores it, undoes the rename, and exits 3 with a clean index.
  //
  // We simulate this by having a foreign file staged BEFORE arming (arm-prompt
  // will see it in Assert-CleanIndex and reject early) — we instead test the
  // rollback path directly by staging a foreign file AFTER the lock check
  // would occur. Since we cannot intercept the PS script mid-run, we verify
  // the established rollback behaviour: a pre-staged foreign file makes the
  // arm exit 2 with a clean index (no HOLD->ready rename on disk or staged).
  // -------------------------------------------------------------------------
  test("unexpected-stage path: pre-existing staged foreign file causes exit 2 with clean index", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-unexpected-stage";
    addHoldFile(repo, slug, validHoldContent());

    // Stage a foreign file to simulate a dirty index.
    const foreignFile = join(repo, "foreign-staged.txt");
    writeFileSync(foreignFile, "foreign\n", "utf8");
    execFileSync("git", ["-C", repo, "add", "foreign-staged.txt"], { encoding: "utf8" });

    const holdPath  = join(repo, "docs", "pr-prompts", `${slug}-HOLD.md`);
    const readyPath = join(repo, "docs", "pr-prompts", `${slug}-ready.md`);

    const res = runArmPromptSimple(repo, slug);

    // Must exit 2 (dirty index guard).
    assert.equal(res.status, 2, `expected exit 2 (dirty-index guard), got ${res.status}\nstdout: ${res.stdout}`);

    // HOLD still present, ready absent.
    assert.ok(existsSync(holdPath), "HOLD must still exist after exit 2");
    assert.ok(!existsSync(readyPath), "ready must not exist after exit 2");

    // The foreign staged file must still be staged (we didn't unstage it).
    const cached = gitDiffCached(repo);
    assert.ok(cached.includes("foreign-staged.txt"), `foreign file must remain staged, got: ${cached}`);
  });

  // -------------------------------------------------------------------------
  // Release-failure is not an arming failure.
  //
  // We simulate a restore failure by making the HOLD path un-restore-able.
  // The simplest approach: arm successfully, but the index release can only
  // fail if git restore --staged fails. We cannot easily force that in a
  // white-box way, so instead we test the observable contract: after a
  // successful arm, exit is 0 and the ready file is on disk, regardless of
  // whether stdout mentions a WARN. This tests the non-fatal path assertion.
  //
  // To truly test the warn path we patch the script: replace the restore
  // command with one that always exits 1, then verify exit 0 + WARN in stdout
  // + ready file on disk.
  // -------------------------------------------------------------------------
  test("release failure is not an arming failure: exit 0 + WARN + ready file on disk", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-release-fail";
    addHoldFile(repo, slug, validHoldContent());

    // Read and patch the arm script so that the `git restore --staged` call
    // inside Step 7 always fails (exit 1). We do this by replacing the
    // `Invoke-Git @("restore", "--staged", $HOLD_REL, $READY_REL)` line
    // with a command that writes nothing and sets $LASTEXITCODE to 1.
    const scriptContent = readFileSync(ARM_SCRIPT, "utf8");

    // Patch REPO_ROOT and LINT_SCRIPT as the normal runner does.
    let patched = scriptContent;
    patched = patched.replace(
      /\$REPO_ROOT\s*=\s*"C:\\ProjectOperations2"/,
      `$REPO_ROOT   = "${repo}"`
    );
    patched = patched.replace(
      /\$LINT_SCRIPT\s*=\s*"[^"]*lint-prompt\.mjs"/,
      `$LINT_SCRIPT = "${LINT_SCRIPT}"`
    );
    if (patched === scriptContent) {
      throw new Error("arm-prompt.test release-fail: REPO_ROOT/LINT_SCRIPT patch did not apply");
    }

    // Replace the restore call in Step 7 with a failing stub.
    // The exact line is: `    Invoke-Git @("restore", "--staged", $HOLD_REL, $READY_REL)`
    // After our patch it still contains that exact text, so we can replace it.
    const restoreLine = `    Invoke-Git @("restore", "--staged", $HOLD_REL, $READY_REL)`;
    const stubLine    = `    $global:LASTEXITCODE = 1  # STUB: simulate restore --staged failure`;
    if (!patched.includes(restoreLine)) {
      throw new Error("arm-prompt.test release-fail: restore line not found in patched script — update the stub");
    }
    patched = patched.replace(restoreLine, stubLine);

    const tmpFile = join(os.tmpdir(), `arm-release-fail-${Date.now()}.ps1`);
    writeFileSync(tmpFile, patched, "utf8");

    let res;
    try {
      // -Actor is mandatory on the script. This runner is separate from
      // runArmPromptSimple and has to supply it too, or PowerShell refuses the call
      // before the script's own Step 0 is ever reached - which is a parameter-binding
      // failure, not the release failure this test is about.
      const psArgs = ["-NoProfile", "-NonInteractive", "-File", tmpFile, "-Name", slug,
        "-Actor", "test-suite", "-LockTimeoutSeconds", "5"];
      const spawnResult = spawnSync(PWSH, psArgs, { encoding: "utf8", timeout: 30000 });
      res = { status: spawnResult.status == null ? -1 : spawnResult.status, stdout: spawnResult.stdout || "", stderr: spawnResult.stderr || "" };
    } finally {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
    }

    // Arming must still exit 0 even though the restore failed.
    assert.equal(res.status, 0,
      `release failure must not fail the arm: expected exit 0, got ${res.status}\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);

    // A WARN must appear in stdout naming the residual paths.
    assert.ok(
      res.stdout.includes("WARN") && res.stdout.includes("ARM_INDEX_RELEASED"),
      `stdout must contain WARN and ARM_INDEX_RELEASED when release fails\nstdout: ${res.stdout}`
    );

    // The ready file must still be on disk (arming stands).
    const readyPath = join(repo, "docs", "pr-prompts", `${slug}-ready.md`);
    assert.ok(existsSync(readyPath), "ready file must be on disk even when index release failed");
  });

  // -------------------------------------------------------------------------
  // ATTRIBUTION — -Actor names WHICH session armed the prompt.
  //
  // `by=`, `pid=` and `caller=` are identical for every Cowork chat and station
  // agent on this machine, so before this the log could say the machine armed
  // something but never which session. On 2026-09-04 three Station 00 sessions
  // were alive at once and one armed a prompt mid-run; the log could not say
  // which one. -Actor is the fact the script cannot derive for itself.
  // -------------------------------------------------------------------------

  test("refuses to arm with no -Actor, and touches nothing", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-actor-missing";
    addHoldFile(repo, slug, validHoldContent());

    const res = runArmPromptSimple(repo, slug, [], { omitActor: true });

    assert.notEqual(res.status, 0, "a mandatory parameter must not be satisfiable by omission");
    // The rename must not have happened.
    assert.ok(existsSync(join(repo, "docs", "pr-prompts", `${slug}-HOLD.md`)), "HOLD must survive");
    assert.ok(!existsSync(join(repo, "docs", "pr-prompts", `${slug}-ready.md`)), "must not arm");
    assert.equal(gitStatus(repo), "", "the tree must be untouched");
  });

  test("refuses an actor containing a space — it would shift every log field", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-actor-spaces";
    addHoldFile(repo, slug, validHoldContent());

    const res = runArmPromptSimple(repo, slug, [], { actor: "station 00" });

    assert.equal(res.status, 1);
    assert.match(res.stdout + res.stderr, /is not a usable name/);
    assert.ok(!existsSync(join(repo, "docs", "pr-prompts", `${slug}-ready.md`)), "must not arm");
  });

  test("refuses an empty actor", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-actor-empty";
    addHoldFile(repo, slug, validHoldContent());

    const res = runArmPromptSimple(repo, slug, [], { actor: "" });

    assert.notEqual(res.status, 0);
    assert.ok(!existsSync(join(repo, "docs", "pr-prompts", `${slug}-ready.md`)), "must not arm");
  });

  test("the audit line carries actor= and a non-empty host", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-actor-logged";
    addHoldFile(repo, slug, validHoldContent());

    const res = runArmPromptSimple(repo, slug, [], { actor: "station-00.a3f1" });
    assert.equal(res.status, 0, res.stdout + res.stderr);

    const logPath = join(repo, "docs", "pr-prompts", ".arming-log.txt");
    assert.ok(existsSync(logPath), ".arming-log.txt must exist after arming");
    const line = readFileSync(logPath, "utf8")
      .split("\n")
      .map((l) => l.trim()) // Add-Content writes CRLF; a trailing \r breaks the $ anchor below
      .filter((l) => l.includes("ARMED") && l.includes(slug))
      .pop();
    assert.ok(line, "an ARMED line for this slug must exist");
    assert.match(line, /\bactor=station-00\.a3f1\b/);
    // by= used to read "Marco@" with nothing after the @ when COMPUTERNAME was empty.
    assert.match(line, /\bby=[^\s]*@[^\s]+/, "the host half of by= must not be empty");
    // The actor must not have broken the field layout for anything downstream.
    assert.match(line, /^\S+  ARMED  \S+  escalates=\S+  actor=\S+  by=\S+  pid=\S+  caller=\S+$/);
  });

  test("-WhatIf names the actor in the plan and still arms nothing", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-actor-whatif";
    addHoldFile(repo, slug, validHoldContent());

    const res = runArmPromptSimple(repo, slug, [], { whatIf: true, actor: "station-06" });

    assert.equal(res.status, 0, res.stdout + res.stderr);
    assert.match(res.stdout, /actor=station-06/);
    assert.ok(!existsSync(join(repo, "docs", "pr-prompts", `${slug}-ready.md`)), "WhatIf must not arm");
    assert.equal(gitStatus(repo), "", "WhatIf must leave the tree clean");
  });

  // -------------------------------------------------------------------------
  // ARMGUARD — RULE 4 pre-flight refuses when another pr-*-ready.md is present.
  //
  // Fired for real on 2026-09-06: two paths, five minutes apart, each printed
  // "already armed = 1" and proceeded. A rule the tool can measure is one the
  // tool must enforce.
  // -------------------------------------------------------------------------

  test("refuses to arm when another pr-*-ready.md is already present at depth 1 (ALREADY_ARMED)", () => {
    const repo = makeTempRepo();
    const other = "pr-someone-else-s1";
    const slug  = "pr-test-already-armed";

    // Simulate another prompt already armed at depth 1.
    writeFileSync(join(repo, "docs", "pr-prompts", `${other}-ready.md`), "already armed\n", "utf8");
    addHoldFile(repo, slug, validHoldContent());

    const holdPath  = join(repo, "docs", "pr-prompts", `${slug}-HOLD.md`);
    const readyPath = join(repo, "docs", "pr-prompts", `${slug}-ready.md`);

    const res = runArmPromptSimple(repo, slug);

    assert.notEqual(res.status, 0, `expected non-zero exit when already armed, got 0\n${res.stdout}`);
    const out = res.stdout + res.stderr;
    assert.match(out, /ALREADY_ARMED/, `output must contain the ALREADY_ARMED token, got:\n${out}`);
    assert.match(out, new RegExp(`${other}-ready\\.md`), `output must name the offending file, got:\n${out}`);

    // The target must still be a HOLD file — no rename happened.
    assert.ok(existsSync(holdPath),  "HOLD file must still exist");
    assert.ok(!existsSync(readyPath), "ready file must not exist");
    assert.equal(gitDiffCached(repo), "", "index must be clean after refusal");

    // Refusal MUST NOT write an audit line (Step 0-style: no partial trail).
    const logPath = join(repo, "docs", "pr-prompts", ".arming-log.txt");
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, "utf8");
      assert.ok(!content.includes(`ARMED  ${slug}`),
        `refused arm must not appear in .arming-log.txt, got:\n${content}`);
    }
  });

  test("rev-<n>-ready.md alone does NOT count as an armed prompt — arms normally (DOCTRINE §9.5)", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-rev-not-a-prompt";

    // Only rev-*-ready.md present — these are auto-generated REVIEW JOBS, not prompts.
    // A recursive or naive `*-ready.md` count would refuse arming here forever.
    writeFileSync(join(repo, "docs", "pr-prompts", "rev-3-ready.md"), "review job\n", "utf8");
    writeFileSync(join(repo, "docs", "pr-prompts", "rev-17-ready.md"), "review job\n", "utf8");

    addHoldFile(repo, slug, validHoldContent());

    const holdPath  = join(repo, "docs", "pr-prompts", `${slug}-HOLD.md`);
    const readyPath = join(repo, "docs", "pr-prompts", `${slug}-ready.md`);

    const res = runArmPromptSimple(repo, slug);
    assert.equal(res.status, 0,
      `rev-*-ready.md must not block arming\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    assert.ok(!existsSync(holdPath),  "HOLD should have been renamed");
    assert.ok(existsSync(readyPath), "ready file should exist after arming");
  });

  test("a *-ready.md in processed/ does NOT count — arms normally (depth-1 guard)", () => {
    const repo = makeTempRepo();
    const slug = "pr-test-subdir-not-armed";

    // Populate a subdirectory the way the pipeline actually does. If the check
    // recursed, this would refuse every arm because processed/ fills up.
    mkdirSync(join(repo, "docs", "pr-prompts", "processed"), { recursive: true });
    writeFileSync(
      join(repo, "docs", "pr-prompts", "processed", "pr-old-done-ready.md"),
      "archived\n",
      "utf8"
    );

    addHoldFile(repo, slug, validHoldContent());

    const holdPath  = join(repo, "docs", "pr-prompts", `${slug}-HOLD.md`);
    const readyPath = join(repo, "docs", "pr-prompts", `${slug}-ready.md`);

    const res = runArmPromptSimple(repo, slug);
    assert.equal(res.status, 0,
      `a *-ready.md in a subdirectory must not block arming\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    assert.ok(!existsSync(holdPath),  "HOLD should have been renamed");
    assert.ok(existsSync(readyPath), "ready file should exist after arming");
  });

  test("-Force waives the ALREADY_ARMED refusal and the audit line names what it was forced past", () => {
    const repo = makeTempRepo();
    const other = "pr-someone-else-s1";
    const slug  = "pr-test-forced-arm";

    writeFileSync(join(repo, "docs", "pr-prompts", `${other}-ready.md`), "already armed\n", "utf8");
    addHoldFile(repo, slug, validHoldContent());

    const readyPath = join(repo, "docs", "pr-prompts", `${slug}-ready.md`);

    const res = runArmPromptSimple(repo, slug, [], { force: true });
    assert.equal(res.status, 0,
      `-Force must waive ALREADY_ARMED\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    assert.ok(existsSync(readyPath), "ready file must exist after forced arm");

    // The audit line must record the waiver AND the name that was overridden.
    // A silent waiver is the same blindness in a different place.
    const logPath = join(repo, "docs", "pr-prompts", ".arming-log.txt");
    assert.ok(existsSync(logPath), ".arming-log.txt must exist after forced arm");
    const line = readFileSync(logPath, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.includes("ARMED") && l.includes(slug))
      .pop();
    assert.ok(line, "an ARMED line for the forced arm must exist");
    assert.match(line, /\bforced=1\b/, `audit line must record forced=1, got:\n${line}`);
    // Capture the token rather than building a RegExp out of the slug: the
    // hand-rolled escape here escaped "-" and not a backslash, which CodeQL
    // correctly flags as incomplete. This asserts the same property, no regex
    // is constructed from the slug, and nothing is loosened.
    const forcedPast = /forced_past=(\S*)/.exec(line);
    assert.ok(forcedPast && forcedPast[1].includes(other),
      `audit line must name what was forced past, got:\n${line}`);
  });

  // -------------------------------------------------------------------------
  // ARMGUARD-S2 - refuse a name the watcher can never dequeue.
  //
  // scripts/pr-watcher/index.mjs gates its queue scan AND its armed census on
  // one constant, READY_PATTERN. arm-prompt.ps1 built "$Name-ready.md" and
  // never checked the result could match it, so on 2026-09-07T00:20:55Z
  // fix-1740-jest-cannot-parse-puppeteer-25-esm-ready.md was armed, counted as
  // armed by every census, and skipped by every queue scan for 62 minutes. Only
  // the watchdog saw it, as "WATCHDOG armed=1 runnable=0". Renaming it to
  // pr-fix-1740-...-ready.md made the watcher start it within one second.
  //
  // These five prove the guard on the real script. The source-level checks in
  // the describe below prove the pattern itself, on every platform.
  // -------------------------------------------------------------------------

  test("a pr-* name still arms normally - the reachability guard changes nothing about today's behaviour", () => {
    const repo = makeTempRepo();
    const slug = "pr-armguard-s2-reachable";
    addHoldFile(repo, slug, validHoldContent());

    const res = runArmPromptSimple(repo, slug);

    assert.equal(res.status, 0, `a pr-* name must still arm\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    assert.ok(existsSync(join(repo, "docs", "pr-prompts", `${slug}-ready.md`)), "ready file must exist");
    assert.ok(!/UNREACHABLE_NAME/.test(res.stdout + res.stderr),
      `a conforming name must not mention the guard at all, got:\n${res.stdout}${res.stderr}`);
  });

  test("a rev-<n> name still arms normally - rev- is the other half of READY_PATTERN", () => {
    // rev-*-ready.md are auto-generated REVIEW JOBS (DOCTRINE 9.5). They ARE
    // dequeueable, so the guard must admit them; Get-ArmedPrompts already
    // excludes them from the RULE 4 count by its `pr-*` glob.
    const repo = makeTempRepo();
    const slug = "rev-1234";
    addHoldFile(repo, slug, validHoldContent());

    const res = runArmPromptSimple(repo, slug);

    assert.equal(res.status, 0, `a rev-<n> name must still arm\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    assert.ok(existsSync(join(repo, "docs", "pr-prompts", `${slug}-ready.md`)), "ready file must exist");
    assert.ok(!/UNREACHABLE_NAME/.test(res.stdout + res.stderr),
      `rev- must not be refused, got:\n${res.stdout}${res.stderr}`);
  });

  test("REFUSES the fix-* name from the 2026-09-07 incident and leaves the queue byte-identical", () => {
    const repo = makeTempRepo();
    // The real slug, verbatim. This is the name that armed successfully and
    // could never be dequeued.
    const slug = "fix-1740-jest-cannot-parse-puppeteer-25-esm";
    addHoldFile(repo, slug, validHoldContent());

    const promptDir = join(repo, "docs", "pr-prompts");
    const holdPath  = join(promptDir, `${slug}-HOLD.md`);
    const readyPath = join(promptDir, `${slug}-ready.md`);

    // Snapshot the queue directory, contents included, so "byte-identical" is
    // asserted rather than assumed.
    const snapshot = () => fs.readdirSync(promptDir).sort()
      .map((n) => `${n}:${readFileSync(join(promptDir, n), "utf8")}`).join("|");
    const before = snapshot();
    const statusBefore = gitStatus(repo);

    const res = runArmPromptSimple(repo, slug);

    assert.notEqual(res.status, 0, `an unreachable name must exit non-zero, got 0\n${res.stdout}`);
    assert.equal(res.status, 6,
      `expected the UNREACHABLE_NAME exit code 6, got ${res.status}\n${res.stdout}${res.stderr}`);

    const out = res.stdout + res.stderr;
    assert.match(out, /UNREACHABLE_NAME/, `output must carry the UNREACHABLE_NAME token, got:\n${out}`);
    // It must name the offending name AND a conforming suggestion.
    assert.ok(out.includes(`${slug}-ready.md`), `output must name the offending file, got:\n${out}`);
    assert.ok(out.includes(`pr-${slug}-HOLD.md`), `output must suggest a conforming rename, got:\n${out}`);

    // Nothing renamed, nothing moved.
    assert.ok(existsSync(holdPath), "the -HOLD.md must still be on disk after the refusal");
    assert.ok(!existsSync(readyPath), "no ready file may be produced by a refusal");

    // Nothing logged: the refusal is ahead of the audit line, so the log must
    // not even have been created.
    assert.ok(!existsSync(join(promptDir, ".arming-log.txt")),
      "a refused arm must not create .arming-log.txt");

    // Nothing staged, and the queue directory is byte-identical.
    assert.equal(gitDiffCached(repo), "", "index must be clean after the refusal");
    assert.equal(gitStatus(repo), statusBefore, "working tree status must be unchanged");
    assert.equal(snapshot(), before, "docs/pr-prompts must be byte-identical after a refused arm");
  });

  test("-WhatIf refuses an unreachable name instead of printing a plan", () => {
    const repo = makeTempRepo();
    const slug = "fix-1740-jest-cannot-parse-puppeteer-25-esm";
    addHoldFile(repo, slug, validHoldContent());

    const res = runArmPromptSimple(repo, slug, [], { whatIf: true });

    assert.equal(res.status, 6,
      `-WhatIf must refuse with exit 6, got ${res.status}\n${res.stdout}${res.stderr}`);
    assert.match(res.stdout + res.stderr, /UNREACHABLE_NAME/);
    // A dry run that says "all checks pass" for a name that can never run is
    // exactly the false green this slice removes.
    assert.ok(!/all checks pass/.test(res.stdout),
      `-WhatIf must not report a passing plan for an unreachable name, got:\n${res.stdout}`);
  });

  test("the refusal is ahead of the lock: an unreachable name is refused even while another process holds it", async () => {
    // The behavioural proof that nothing is renamed, moved or logged on the
    // refusal path. If the guard sat after Acquire-Lock this run would block for
    // the full timeout and exit 1 with a lock-timeout message; it exits 6
    // immediately instead.
    const repo = makeTempRepo();
    const slug = "fix-1740-jest-cannot-parse-puppeteer-25-esm";
    addHoldFile(repo, slug, validHoldContent());

    const lockPath = join(repo, ".git", "po-arm.lock");
    const acquireLockScript = [
      `$stream = [System.IO.File]::Open('${lockPath}', [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::Read)`,
      `$stream.SetLength(0)`,
      `$bytes = [System.Text.Encoding]::ASCII.GetBytes('313131')`,
      `$stream.Write($bytes, 0, $bytes.Length)`,
      `$stream.Flush()`,
      `Write-Host 'LOCK_ACQUIRED'`,
      `Start-Sleep -Seconds 30`,
      `$stream.Close()`,
    ].join("; ");

    const lockHolder = spawn(PWSH, ["-NoProfile", "-NonInteractive", "-Command", acquireLockScript], {
      stdio: ["ignore", "pipe", "ignore"],
    });

    await new Promise((resolve) => {
      let buf = "";
      lockHolder.stdout.on("data", (chunk) => {
        buf += chunk.toString();
        if (buf.includes("LOCK_ACQUIRED")) resolve();
      });
      lockHolder.on("error", () => resolve());
      setTimeout(resolve, 5000);
    });

    try {
      const res = runArmPromptSimple(repo, slug, [], { lockTimeoutSeconds: 3 });
      const out = res.stdout + res.stderr;
      assert.equal(res.status, 6,
        `expected exit 6 (refused before the lock), got ${res.status}\n${out}`);
      assert.match(out, /UNREACHABLE_NAME/);
      assert.ok(!/Could not acquire lock/.test(out),
        `the guard must run before the lock is even attempted, got:\n${out}`);
      assert.ok(existsSync(join(repo, "docs", "pr-prompts", `${slug}-HOLD.md`)), "HOLD must survive");
    } finally {
      try { lockHolder.kill(); } catch (_) {}
    }
  });
});

// ---------------------------------------------------------------------------
// ARMGUARD-S2 - source-level checks. Deliberately NOT platform-gated.
//
// Every test above needs Windows + pwsh and SKIPs elsewhere, so the ubuntu
// `pipeline-tests` job proves nothing about arm-prompt.ps1. These read the two
// source files as text and run on every platform, which is what makes drift
// between the guard and the watcher catchable in ordinary CI. Nothing here is
// skipped, so the Windows job's `skipped == 0` assertion still holds.
// ---------------------------------------------------------------------------

const WATCHER_INDEX = join(REPO_ROOT, "scripts", "pr-watcher", "index.mjs");

function readSource(path) {
  // arm-prompt.ps1 carries a UTF-8 BOM; strip it so line-anchored regexes work.
  //
  // 2026-09-07: line endings are normalised to LF too. This job runs on
  // windows-latest, where git checks the tree out with CRLF, so a scan written
  // as indexOf("\n    exit 6\n") finds nothing -- the byte after the 6 is \r.
  // It cost a red CI run on PR #1759: every OTHER anchor in this file happened
  // to survive, because they use /m with \s*$, which tolerates a \r. That is
  // the dangerous shape of this bug -- it takes out one assertion and leaves
  // the rest green, so the failure reads like a real defect in the script.
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

/** The regex literal scripts/pr-watcher/index.mjs actually declares. */
function watcherReadyPattern() {
  const m = /^const READY_PATTERN = \/(.+)\/([a-z]*);\s*$/m.exec(readSource(WATCHER_INDEX));
  assert.ok(m, "could not find `const READY_PATTERN = /.../;` in scripts/pr-watcher/index.mjs");
  return { body: m[1], flags: m[2] };
}

/** The pattern arm-prompt.ps1's Step 0b guard enforces. */
function armReadyPattern() {
  const m = /^\$READY_PATTERN\s*=\s*'([^']*)'\s*$/m.exec(readSource(ARM_SCRIPT));
  assert.ok(m, "could not find a top-level `$READY_PATTERN = '...'` in scripts/pipeline/arm-prompt.ps1");
  return m[1];
}

describe("arm-prompt.ps1 reachability guard - source level", () => {

  // -------------------------------------------------------------------------
  // DRIFT. The guard hard-codes the watcher's pattern rather than reading
  // index.mjs at run time: the test harness rewrites $REPO_ROOT to a temp repo
  // that has no scripts/pr-watcher, so a run-time read would find nothing in
  // ANY test and would have to fail either open (the defect, restored) or
  // closed (every arm refused). A copy nobody checks is how this class of bug
  // returns - this is the check that makes the copy honest.
  // -------------------------------------------------------------------------
  test("DRIFT: the pattern arm-prompt.ps1 enforces is the pattern pr-watcher/index.mjs declares", () => {
    const watcher = watcherReadyPattern();
    const arm = armReadyPattern();

    assert.equal(
      arm,
      watcher.body,
      "arm-prompt.ps1 and scripts/pr-watcher/index.mjs no longer agree on READY_PATTERN.\n" +
      `  arm-prompt.ps1       : ${arm}\n` +
      `  pr-watcher/index.mjs : ${watcher.body}\n` +
      "  Arming would admit names the watcher will not dequeue, or refuse names it would.\n" +
      "  Update the $READY_PATTERN literal in arm-prompt.ps1 Step 0b to match."
    );

    // PowerShell's -match is case-insensitive by default, which is exactly /i.
    // Any other flag set means the two engines no longer behave the same and
    // the guard has to be re-derived rather than left to look right.
    assert.equal(
      watcher.flags,
      "i",
      `READY_PATTERN flags changed to "${watcher.flags}". PowerShell's -match supplies /i and ` +
      "nothing else; re-derive the guard in arm-prompt.ps1 Step 0b before shipping this."
    );
  });

  test("the enforced pattern accepts pr-/rev- names and refuses the fix-* name from the 2026-09-07 incident", () => {
    const { flags } = watcherReadyPattern();
    const re = new RegExp(armReadyPattern(), flags);

    // The pattern must be the RIGHT one, not merely the same one in two files.
    for (const name of [
      "pr-foo-ready.md",
      "rev-1234-ready.md",
      "pr-armguard-s2-refuse-a-name-the-watcher-can-never-dequeue-ready.md",
      "PR-Foo-ready.md", // the /i flag
    ]) {
      assert.ok(re.test(name), `${name} must be dequeueable`);
    }

    for (const name of [
      // The live instance: armed 00:20:55Z, unrunnable for 62 minutes.
      "fix-1740-jest-cannot-parse-puppeteer-25-esm-ready.md",
      "hotfix-x-ready.md",
      "prfoo-ready.md",
      "revfoo-ready.md",
      "pr-foo-HOLD.md",
      "docs-cleanup-ready.md",
    ]) {
      assert.ok(!re.test(name), `${name} must NOT be dequeueable`);
    }
  });

  test("the rename the refusal suggests is itself dequeueable", () => {
    // The message tells the caller to rename the HOLD to 'pr-<name>-HOLD.md'.
    // Advice that would itself be refused is worse than no advice.
    const { flags } = watcherReadyPattern();
    const re = new RegExp(armReadyPattern(), flags);
    for (const slug of ["fix-1740-jest-cannot-parse-puppeteer-25-esm", "hotfix-x", "x"]) {
      assert.ok(re.test(`pr-${slug}-ready.md`),
        `the suggested rename pr-${slug}-HOLD.md must produce a dequeueable ready name`);
    }
  });

  test("the refusal sits at top level, ahead of the -WhatIf plan and ahead of the lock", () => {
    const src = readSource(ARM_SCRIPT);

    const pattern = src.indexOf("\n$READY_PATTERN = '");
    const refusal = src.indexOf("\n    exit 6\n");
    const whatIf  = src.indexOf("\nif ($WhatIf) {");
    const lock    = src.indexOf("\n$lockStream = Acquire-Lock");

    assert.ok(pattern >= 0, "the guard's top-level $READY_PATTERN assignment is missing");
    assert.ok(refusal >= 0, "the guard's `exit 6` refusal is missing");
    assert.ok(whatIf  >= 0, "could not locate the top-level `if ($WhatIf) {` block");
    assert.ok(lock    >= 0, "could not locate the top-level `$lockStream = Acquire-Lock` call");

    // Top-level statement order IS execution order in PowerShell, so this is
    // what makes "nothing is renamed, moved or logged on the refusal path"
    // true: the refusal is reached before the -WhatIf plan and before the lock,
    // and therefore before the linter, the `git mv` and the audit line, every
    // one of which is only ever called from inside one of those two.
    assert.ok(pattern < refusal, "the pattern must be defined before the refusal uses it");
    assert.ok(refusal < whatIf,  "the refusal must come before the -WhatIf plan");
    assert.ok(whatIf  < lock,    "sanity: the -WhatIf block precedes the lock, as it always has");

    // The refusal must be a hard exit, never a warning: a warning in a headless
    // arm is read by nobody.
    const guardBlock = src.slice(pattern, whatIf);
    assert.match(guardBlock, /Write-Fail "UNREACHABLE_NAME:/,
      "the refusal must be emitted through Write-Fail with the UNREACHABLE_NAME token");
    assert.match(guardBlock, /\n    exit 6\n/,
      "the refusal must exit non-zero (6), not warn and continue");
  });
});
