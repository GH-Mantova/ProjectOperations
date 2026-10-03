/**
 * Tests for UPDATE_AT_MERGE_TIME_V1 in scripts/pipeline/pipeline-lib.ps1.
 *
 * Runs with: node --test scripts/pipeline/__tests__/merge-pr-update-first.test.mjs
 *
 * The real Merge-Pr talks to GitHub via `gh`. These tests dot-source pipeline-lib.ps1
 * from a temporary driver script, OVERRIDE `Invoke-PipelineGh` with a fake that records
 * every call and returns scripted JSON per command signature, then invoke Merge-Pr /
 * Update-PrBranch and assert on the recorded calls plus the returned state. No real
 * GitHub traffic, no network, no clone -- the driver script never leaves the temp dir.
 *
 * Platform: tests are gated on pwsh (PowerShell 7) or powershell.exe being discoverable.
 * On Linux CI this suite SKIPS; the pipeline-tests-windows job runs it.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const PIPELINE_LIB = join(REPO_ROOT, "scripts", "pipeline", "pipeline-lib.ps1");
const START_WATCHER = join(REPO_ROOT, "scripts", "pr-watcher", "start-watcher.ps1");

function findPwsh() {
  for (const candidate of ["pwsh", "powershell.exe"]) {
    const res = spawnSync(candidate, ["-Command", "1"], { encoding: "utf8", timeout: 5000 });
    if (res && res.status === 0) return candidate;
  }
  return null;
}

const PWSH = findPwsh();

/**
 * Run a pwsh driver that dot-sources pipeline-lib.ps1, patches Invoke-PipelineGh with
 * a response map (and Get-ChecksFor with a checks array for the BLOCKED path), invokes
 * the body, and emits a JSON transcript { calls, result | error }.
 *
 * responseMap keys are the gh argv joined by `|`. For example:
 *   "pr|view|1234|--json|mergeStateStatus,headRefOid,state": { exit: 0, out: '{"mergeStateStatus":"CLEAN", ... }' }
 * checks is an array of { name, state } objects returned to the BLOCKED/UNSTABLE paths.
 */
function runDriver({ body, responseMap = {}, checks = [] }) {
  const tmp = mkdtempSync(join(os.tmpdir(), "merge-pr-"));
  const transcript = join(tmp, "transcript.json").replace(/\\/g, "/");
  const responseJson = JSON.stringify(responseMap).replace(/'/g, "''");
  const checksJson = JSON.stringify(checks).replace(/'/g, "''");

  const driver = `
$ErrorActionPreference = 'Continue'
. '${PIPELINE_LIB.replace(/\\/g, "/")}'

$script:__RESPONSES = '${responseJson}' | ConvertFrom-Json
$script:__CHECKS    = @('${checksJson}' | ConvertFrom-Json)
$script:__CALLS     = @()

function Invoke-PipelineGh {
  param([Parameter(ValueFromRemainingArguments = $true)] [string[]]$GhArgs)
  $script:__CALLS += ,@($GhArgs)
  $key = ($GhArgs -join '|')
  $prop = $script:__RESPONSES.PSObject.Properties[$key]
  if ($null -eq $prop) {
    return [pscustomobject]@{ ExitCode = 1; StdOut = "UNEXPECTED CALL: $key" }
  }
  $resp = $prop.Value
  return [pscustomobject]@{ ExitCode = [int]$resp.exit; StdOut = [string]$resp.out }
}

function Get-ChecksFor { param([int]$PR) return $script:__CHECKS }

$outcome = @{ calls = $null; result = $null; error = $null }
try {
  $value = ${body}
  $outcome.result = $value
} catch {
  $outcome.error = "$($_.Exception.Message)"
}
$outcome.calls = $script:__CALLS
ConvertTo-Json $outcome -Depth 6 -Compress | Out-File -FilePath '${transcript}' -Encoding utf8
`;

  const script = join(tmp, "run.ps1");
  writeFileSync(script, driver, "utf8");
  const run = spawnSync(PWSH, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script], {
    encoding: "utf8",
    timeout: 30000,
  });
  if (run.status !== 0 && !run.stdout) {
    throw new Error(`pwsh driver failed: status=${run.status} stderr=${run.stderr}`);
  }
  const raw = readFileSync(transcript, "utf8").replace(/^´╗┐/, "").trim();
  return JSON.parse(raw);
}

function callsOf(transcript) {
  return (transcript.calls || []).map((row) => (row || []).join(" "));
}

test("Merge-Pr: pwsh available", () => {
  if (!PWSH) return;                       // SKIP on non-Windows / no pwsh
  assert.ok(PWSH, "pwsh or powershell.exe not found");
});

test("Merge-Pr CLEAN: one `pr merge` without --auto, read-back MERGED, State=MERGED", { skip: !PWSH }, () => {
  const t = runDriver({
    body: "Merge-Pr -PR 42",
    responseMap: {
      "pr|view|42|--json|mergeStateStatus,headRefOid,state": {
        exit: 0,
        out: JSON.stringify({ mergeStateStatus: "CLEAN", headRefOid: "aaaaaaa", state: "OPEN" }),
      },
      "pr|merge|42|--squash|--delete-branch": { exit: 0, out: "" },
      "pr|view|42|--json|state|-q|.state": { exit: 0, out: "MERGED" },
    },
  });
  assert.equal(t.error, null, `unexpected throw: ${t.error}`);
  assert.equal(t.result.State, "MERGED");
  assert.equal(t.result.PR, 42);
  const calls = callsOf(t);
  // Exactly one merge call, no --auto, no update-branch.
  const mergeCalls = calls.filter((c) => c.startsWith("pr merge "));
  assert.equal(mergeCalls.length, 1, `expected one merge call, got: ${JSON.stringify(mergeCalls)}`);
  assert.ok(!mergeCalls[0].includes("--auto"), `CLEAN must not pass --auto: ${mergeCalls[0]}`);
  assert.ok(!calls.some((c) => c.startsWith("pr update-branch ")), `CLEAN must not call update-branch; calls=${JSON.stringify(calls)}`);
});

test("Merge-Pr BEHIND: update-branch, then --auto --match-head-commit <new sha>, State=QUEUED, no MERGED read-back", { skip: !PWSH }, () => {
  const t = runDriver({
    body: "Merge-Pr -PR 77",
    responseMap: {
      "pr|view|77|--json|mergeStateStatus,headRefOid,state": {
        exit: 0,
        out: JSON.stringify({ mergeStateStatus: "BEHIND", headRefOid: "oldsha0", state: "OPEN" }),
      },
      "pr|update-branch|77": { exit: 0, out: "" },
      "pr|view|77|--json|headRefOid|-q|.headRefOid": { exit: 0, out: "newsha1" },
      "pr|merge|77|--squash|--auto|--delete-branch|--match-head-commit|newsha1": { exit: 0, out: "" },
    },
  });
  assert.equal(t.error, null, `unexpected throw: ${t.error}`);
  assert.equal(t.result.State, "QUEUED");
  assert.equal(t.result.PR, 77);
  const calls = callsOf(t);
  assert.ok(calls.some((c) => c === "pr update-branch 77"), `expected update-branch 77; calls=${JSON.stringify(calls)}`);
  assert.ok(
    calls.some((c) => c === "pr merge 77 --squash --auto --delete-branch --match-head-commit newsha1"),
    `expected --auto merge pinned to newsha1; calls=${JSON.stringify(calls)}`,
  );
  // BEHIND path must NOT read-back state (that is the CLEAN-path confirmation).
  assert.ok(
    !calls.some((c) => c === "pr view 77 --json state -q .state"),
    `BEHIND path must not read-back state=MERGED; calls=${JSON.stringify(calls)}`,
  );
});

test("Merge-Pr DIRTY: throws, no merge call", { skip: !PWSH }, () => {
  const t = runDriver({
    body: "Merge-Pr -PR 13",
    responseMap: {
      "pr|view|13|--json|mergeStateStatus,headRefOid,state": {
        exit: 0,
        out: JSON.stringify({ mergeStateStatus: "DIRTY", headRefOid: "bbbbbbb", state: "OPEN" }),
      },
    },
  });
  assert.ok(t.error, "expected a throw on DIRTY");
  assert.match(t.error, /DIRTY/, `expected error to say DIRTY; got: ${t.error}`);
  assert.match(t.error, /human rebase/i, `expected guidance to a human; got: ${t.error}`);
  const calls = callsOf(t);
  assert.ok(!calls.some((c) => c.startsWith("pr merge ")), `DIRTY must not call pr merge; calls=${JSON.stringify(calls)}`);
  assert.ok(!calls.some((c) => c.startsWith("pr update-branch ")), `DIRTY must not call update-branch; calls=${JSON.stringify(calls)}`);
});

test("Merge-Pr BLOCKED with a failing check: throws naming the check", { skip: !PWSH }, () => {
  const t = runDriver({
    body: "Merge-Pr -PR 99",
    responseMap: {
      "pr|view|99|--json|mergeStateStatus,headRefOid,state": {
        exit: 0,
        out: JSON.stringify({ mergeStateStatus: "BLOCKED", headRefOid: "ccccccc", state: "OPEN" }),
      },
    },
    checks: [
      { name: "tendering-e2e", state: "SUCCESS" },
      { name: "api-lint", state: "FAILURE" },
    ],
  });
  assert.ok(t.error, "expected a throw on BLOCKED");
  assert.match(t.error, /BLOCKED/, `expected error to say BLOCKED; got: ${t.error}`);
  assert.match(t.error, /api-lint/, `expected the failing check to be named; got: ${t.error}`);
  const calls = callsOf(t);
  assert.ok(!calls.some((c) => c.startsWith("pr merge ")), `BLOCKED must not call pr merge; calls=${JSON.stringify(calls)}`);
});

test("Merge-Pr CLEAN negative control: update-branch is never called", { skip: !PWSH }, () => {
  const t = runDriver({
    body: "Merge-Pr -PR 1001",
    responseMap: {
      "pr|view|1001|--json|mergeStateStatus,headRefOid,state": {
        exit: 0,
        out: JSON.stringify({ mergeStateStatus: "CLEAN", headRefOid: "ddddddd", state: "OPEN" }),
      },
      "pr|merge|1001|--squash|--delete-branch": { exit: 0, out: "" },
      "pr|view|1001|--json|state|-q|.state": { exit: 0, out: "MERGED" },
    },
  });
  assert.equal(t.error, null, `unexpected throw: ${t.error}`);
  const calls = callsOf(t);
  assert.ok(
    !calls.some((c) => c.startsWith("pr update-branch ")),
    `CLEAN must never call update-branch; calls=${JSON.stringify(calls)}`,
  );
});

test("start-watcher.ps1: PR_WATCHER_AUTO_UPDATE default is \"false\" (UPDATE_AT_MERGE_TIME_V1)", () => {
  const source = readFileSync(START_WATCHER, "utf8");
  const match = source.match(
    /if\s*\(-not\s+\$env:PR_WATCHER_AUTO_UPDATE\)\s*\{\s*\$env:PR_WATCHER_AUTO_UPDATE\s*=\s*"([^"]+)"\s*\}/,
  );
  assert.ok(match, "could not find the PR_WATCHER_AUTO_UPDATE default guard in start-watcher.ps1");
  assert.equal(match[1], "false", `expected default "false", got "${match[1]}"`);
});
