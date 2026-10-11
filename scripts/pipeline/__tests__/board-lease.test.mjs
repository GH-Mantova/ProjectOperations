/**
 * Tests for BOARD_LEASE_V1 in scripts/pipeline/pipeline-lib.ps1 and scripts/pipeline/status-sweep.ps1.
 *
 * Runs with: node --test scripts/pipeline/__tests__/board-lease.test.mjs
 *
 * These tests dot-source pipeline-lib.ps1 from a tmp pwsh driver, point PO_BOARD_LEASE_PATH at
 * a per-test tmp file, and exercise the real Enter-/Exit-BoardLease / Get-BoardLease logic.
 * Section 5 drives status-sweep.ps1 against a tmp repo with the lease env override wired in.
 *
 * Platform: tests are gated on pwsh (PowerShell 7) or powershell.exe being discoverable.
 * On Linux CI this suite SKIPS; the pipeline-tests-windows job runs it for real.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const PIPELINE_LIB = join(REPO_ROOT, "scripts", "pipeline", "pipeline-lib.ps1");
const STATUS_SWEEP = join(REPO_ROOT, "scripts", "pipeline", "status-sweep.ps1");

function findPwsh() {
  // pwsh cold-start on Windows can exceed 10 s under contention (another test suite running
  // in parallel, antivirus scanning the module cache, etc). 5 s was too tight -- the sibling
  // test file ran its own pwsh warm-up at the same time and this probe timed out, so every
  // lease test skipped silently and the suite reported green with no live assertions.
  for (const candidate of ["pwsh", "powershell.exe"]) {
    const res = spawnSync(candidate, ["-NoProfile", "-Command", "1"], { encoding: "utf8", timeout: 30000 });
    if (res && res.status === 0) return candidate;
  }
  return null;
}

const PWSH = findPwsh();

/**
 * Run a pwsh driver that dot-sources pipeline-lib.ps1 with PO_BOARD_LEASE_PATH pointed at a
 * fresh tmp file. The body is a pwsh snippet whose result (or thrown error) is captured as
 * JSON. The transcript also carries whatever text the body wrote to the host.
 */
function runLease({ body, leasePath, extraSetup = "" }) {
  const tmp = mkdtempSync(join(os.tmpdir(), "board-lease-"));
  const transcriptPath = join(tmp, "transcript.json").replace(/\\/g, "/");
  const leaseAbs = (leasePath ?? join(tmp, "po-board-lease.json")).replace(/\\/g, "/");

  const driver = `
$ErrorActionPreference = 'Continue'
$env:PO_BOARD_LEASE_PATH = '${leaseAbs}'
. '${PIPELINE_LIB.replace(/\\/g, "/")}'

${extraSetup}

$outcome = @{ result = $null; error = $null; wrote = $null }
try {
    $value = ${body}
    $outcome.result = $value
} catch {
    $outcome.error = "$($_.Exception.Message)"
}
if (Test-Path -LiteralPath '${leaseAbs}') {
    $outcome.wrote = Get-Content -LiteralPath '${leaseAbs}' -Raw -Encoding UTF8
}
ConvertTo-Json $outcome -Depth 6 -Compress | Out-File -FilePath '${transcriptPath}' -Encoding utf8
`;
  const scriptPath = join(tmp, "run.ps1");
  writeFileSync(scriptPath, driver, "utf8");
  // Windows pwsh cold-start can exceed 30 s under contention (another chat, a running test
  // suite, antivirus). 30 s is too tight when node --test fans this out alongside the
  // merge-pr suite; use 120 s so every real driver run finishes.
  const run = spawnSync(PWSH, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath], {
    encoding: "utf8",
    timeout: 120000,
  });
  if (run.status !== 0 && !existsSync(transcriptPath)) {
    throw new Error(`pwsh driver failed: status=${run.status} stderr=${run.stderr} stdout=${run.stdout}`);
  }
  // PS 5.1 writes utf8 as utf8-BOM; trim it.
  const raw = readFileSync(transcriptPath, "utf8").replace(/^﻿/, "").replace(/^´╗┐/, "").trim();
  return {
    out: run.stdout || "",
    err: run.stderr || "",
    data: JSON.parse(raw),
    leasePath: leaseAbs,
    tmpDir: tmp,
  };
}

// ---------------------------------------------------------------------------------------------
// pwsh available
// ---------------------------------------------------------------------------------------------

test("board-lease: pwsh available", () => {
  if (!PWSH) return;
  assert.ok(PWSH, "pwsh or powershell.exe not found");
});

// ---------------------------------------------------------------------------------------------
// 1. A acquires; B is refused and the message names A; A renews; A releases; B acquires.
// ---------------------------------------------------------------------------------------------
test("1. A acquires, B refused naming A, A renews, A releases, B acquires", { skip: !PWSH }, () => {
  const r = runLease({
    body: `[pscustomobject]@{
        aAcq1 = (Enter-BoardLease -Actor 'station-00.sched' -Reason 'arm:x')
        bRef  = (Enter-BoardLease -Actor 'station-00.chat'  -Reason 'arm:y')
        aAcq2 = (Enter-BoardLease -Actor 'station-00.sched' -Reason 'arm:x')
        aRel  = (Exit-BoardLease  -Actor 'station-00.sched')
        bAcq  = (Enter-BoardLease -Actor 'station-00.chat'  -Reason 'arm:y')
    }`,
  });
  assert.equal(r.data.error, null, `unexpected throw: ${r.data.error}`);
  assert.equal(r.data.result.aAcq1, true, "A's first acquire should succeed");
  assert.equal(r.data.result.bRef,  false, "B's acquire while A holds should be refused");
  assert.equal(r.data.result.aAcq2, true, "A should be able to renew its own lease");
  assert.equal(r.data.result.aRel,  true, "A should release its own lease");
  assert.equal(r.data.result.bAcq,  true, "After A releases, B should acquire");
  // The REFUSED message must name the holder.
  assert.match(r.out, /REFUSED:\s+station-00\.sched\s+holds the board/i,
    `expected the refusal line to name A; got:\n${r.out}`);
});

// ---------------------------------------------------------------------------------------------
// 2. An expired lease (back-dated expiresAt) lets B acquire.
// ---------------------------------------------------------------------------------------------
test("2. expired lease lets another actor acquire", { skip: !PWSH }, () => {
  const r = runLease({
    body: `[pscustomobject]@{ bAcq = (Enter-BoardLease -Actor 'station-00.chat' -Reason 'arm:y') }`,
    extraSetup: `
# Pre-seed an EXPIRED lease held by A.
$leaseBody = @{
    actor      = 'station-00.sched'
    reason     = 'arm:x'
    pid        = 12345
    acquiredAt = ([DateTime]::UtcNow.AddHours(-2)).ToString("yyyy-MM-ddTHH:mm:ssZ")
    expiresAt  = ([DateTime]::UtcNow.AddHours(-1)).ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json -Compress
$dir = Split-Path -Parent $env:PO_BOARD_LEASE_PATH
if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
Set-Content -LiteralPath $env:PO_BOARD_LEASE_PATH -Value $leaseBody -Encoding ASCII -NoNewline
`,
  });
  assert.equal(r.data.error, null, `unexpected throw: ${r.data.error}`);
  assert.equal(r.data.result.bAcq, true,
    "B should acquire when the previous lease has already expired");
});

// ---------------------------------------------------------------------------------------------
// 3. B cannot release A's lease.
// ---------------------------------------------------------------------------------------------
test("3. actor B cannot release actor A's lease", { skip: !PWSH }, () => {
  const r = runLease({
    body: `[pscustomobject]@{
        aAcq = (Enter-BoardLease -Actor 'station-00.sched' -Reason 'arm:x')
        bRel = (Exit-BoardLease  -Actor 'station-00.chat')
    }`,
  });
  assert.equal(r.data.error, null, `unexpected throw: ${r.data.error}`);
  assert.equal(r.data.result.aAcq, true);
  assert.equal(r.data.result.bRel, false,
    "Exit-BoardLease must return false when the caller does not hold the lease");
  // The lease file still exists; the release was refused.
  assert.ok(r.data.wrote && r.data.wrote.length > 0,
    "A's lease file should still exist after B's refused release");
  assert.match(r.out, /refusing to release lease held by station-00\.sched \(caller is station-00\.chat\)/i,
    `expected the refuse-to-release message naming both actors; got:\n${r.out}`);
});

// ---------------------------------------------------------------------------------------------
// 4. A corrupt lease file blocks until its file time is 30 minutes old, and warns once.
// ---------------------------------------------------------------------------------------------
test("4. corrupt lease blocks until file time + 30 min; warns once", { skip: !PWSH }, () => {
  const r = runLease({
    body: `[pscustomobject]@{
        bAcq1 = (Enter-BoardLease -Actor 'station-00.chat' -Reason 'arm:y')
        bAcq2 = (Enter-BoardLease -Actor 'station-00.chat' -Reason 'arm:y')
    }`,
    extraSetup: `
# Write a garbage lease file. File time is 'now' so the synthetic expiry (file+30min) blocks.
$dir = Split-Path -Parent $env:PO_BOARD_LEASE_PATH
if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
Set-Content -LiteralPath $env:PO_BOARD_LEASE_PATH -Value 'this is not JSON {{' -Encoding ASCII -NoNewline
# Capture stderr via Error stream so we can count the "unreadable or malformed" warning.
`,
  });
  assert.equal(r.data.error, null, `unexpected throw: ${r.data.error}`);
  assert.equal(r.data.result.bAcq1, false,
    "A corrupt lease must be treated as HELD until file time + 30 min, never as free");
  assert.equal(r.data.result.bAcq2, false,
    "Still blocked on second attempt within the file-time window");
  // "unknown" is the synthetic holder; the refusal message should name it.
  const combined = (r.out || "") + (r.err || "");
  assert.match(combined, /unreadable or malformed/i,
    `expected a one-shot Write-Warning on the corrupt lease; got:\nSTDOUT:${r.out}\nSTDERR:${r.err}`);
  const warnCount = (combined.match(/unreadable or malformed/gi) || []).length;
  assert.equal(warnCount, 1,
    `expected EXACTLY one warning across the two calls, got ${warnCount}:\nSTDOUT:${r.out}\nSTDERR:${r.err}`);
});

// ---------------------------------------------------------------------------------------------
// 5. status-sweep.ps1 source checks.
//
// The sweep makes slow live CIM/git/gh calls that run for 1-3 minutes on this host; wiring an
// end-to-end run of it per test would blow past any reasonable test budget. The behavioural
// side (lease write / read / expire / corrupt) is covered by tests 1-4 against the authoritative
// pipeline-lib.ps1 implementation that section 3 of the sweep MIRRORS by design. These source
// checks pin the CONTRACT that section 3 reads the lease, that section 7 CAUTIONs on it, and
// that the "NOT a block signal" wording for the build was replaced by the new wording the spec
// requires. If a future edit removes any of these without replacing them, the test fails.
// ---------------------------------------------------------------------------------------------

// The terminator is [,)] and NOT ')' alone: the assertion's stated intent is that -Actor is
// declared, typed [string], and defaults to $env:PO_ACTOR -- it was never that $Actor is the
// ONLY parameter. Pinning the closing paren made the param block unextendable, so adding
// -SkipSection5 (SECTION_5_SKIP_V1) failed a test whose subject it does not touch. Every
// element of the original contract is still asserted here; only the incidental
// "nothing else may be declared" clause is gone. A NEGATIVE control lives directly below.
test("5. status-sweep.ps1 declares [CmdletBinding()] and -Actor param (BOARD_LEASE_V1)", () => {
  const src = readFileSync(STATUS_SWEEP, "utf8");
  assert.match(src, /\[CmdletBinding\(\)\]\s*param\s*\(\s*\[string\]\$Actor\s*=\s*\$env:PO_ACTOR\s*[,)]/,
    "status-sweep.ps1 must accept -Actor with $env:PO_ACTOR default");
});

// NEGATIVE control for the relaxation above (DOCTRINE 9.6: a negative control you wrote down is
// a positive). If the terminator were widened to the point of matching anything, this would
// pass too -- it must not.
test("5. the -Actor param regex still rejects a param block that drops the PO_ACTOR default", () => {
  const re = /\[CmdletBinding\(\)\]\s*param\s*\(\s*\[string\]\$Actor\s*=\s*\$env:PO_ACTOR\s*[,)]/;
  assert.ok(re.test('[CmdletBinding()]\nparam(\n    [string]$Actor = $env:PO_ACTOR,\n    [switch]$SkipSection5\n)'),
    "the relaxed regex must still match the real, extended param block");
  assert.ok(re.test('[CmdletBinding()]\nparam(\n    [string]$Actor = $env:PO_ACTOR\n)'),
    "the relaxed regex must still match the original single-param block");
  assert.ok(!re.test('[CmdletBinding()]\nparam(\n    [string]$Actor\n)'),
    "a param block with no $env:PO_ACTOR default must still FAIL");
  assert.ok(!re.test('param(\n    [string]$Actor = $env:PO_ACTOR\n)'),
    "a param block with no [CmdletBinding()] must still FAIL");
});

test("5. status-sweep.ps1 reads the lease file (section 3) and prints 'board lease:' every run", () => {
  const src = readFileSync(STATUS_SWEEP, "utf8");
  assert.match(src, /\$LeasePath\s*=\s*Join-Path\s+\$Repo\s+["'`]?\.git\\po-board-lease\.json["'`]?/i,
    "status-sweep.ps1 must resolve the lease path under the dev tree's .git");
  assert.match(src, /Line\s+["']LIVE["']\s+\(\s*["']board lease:\s*["']\s*\+\s*\$leaseHoldLine\s*\)/,
    "status-sweep.ps1 must emit a 'board lease:' LIVE line in section 3");
});

test("5. status-sweep.ps1 build line now says 'blocks arming and merging (section 7)'", () => {
  const src = readFileSync(STATUS_SWEEP, "utf8");
  assert.ok(
    src.includes("blocks arming and merging (section 7)"),
    "status-sweep.ps1 must tag the build-in-flight line as a blocker",
  );
  assert.ok(
    !src.includes("NOT a block signal"),
    "status-sweep.ps1 must NOT still describe the build as 'NOT a block signal' -- section 7 now gates on it",
  );
});

test("5. status-sweep.ps1 verdict (section 7) adds the lease CAUTION and the build CAUTION", () => {
  const src = readFileSync(STATUS_SWEEP, "utf8");
  // Lease CAUTION includes the holder actor, the reason, the age, and the expiry minutes.
  assert.match(src, /CAUTION:\s*["']\s*\+\s*\$leaseObj\.actor\s*\+\s*["']\s*holds the board/,
    "section 7 must CAUTION naming the lease holder");
  assert.match(src, /Stand down;?\s*COLLECT only/i,
    "section 7 must direct the caller to COLLECT only");
  // Build CAUTION.
  assert.match(src, /CAUTION:\s*a watcher build is in flight/i,
    "section 7 must CAUTION on an in-flight watcher build");
});

test("5. status-sweep.ps1 treats a live lease as someone else's when caller is unknown (fail-safe)", () => {
  const src = readFileSync(STATUS_SWEEP, "utf8");
  // The code path that sets $leaseBlocksCaller = $true when $Actor is empty OR != holder.
  assert.match(src, /IsNullOrWhiteSpace\(\$Actor\)\s*-or\s*\$leaseObj\.actor\s*-ne\s*\$Actor/,
    "with no -Actor passed, every live lease must be treated as someone else's (fail into CAUTION, not SAFE)");
});
