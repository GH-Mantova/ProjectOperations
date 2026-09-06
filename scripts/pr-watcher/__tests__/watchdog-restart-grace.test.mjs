// watchdog-restart-grace.test.mjs
//
// WATCHDOG_RESTART_GRACE_V1 -- structural tests for the 2026-09-06 fix in
// scripts/pr-watcher/supervise-watcher.ps1.
//
// WHAT WENT WRONG. The heartbeat watchdog judged a freshly launched node by the
// age of scripts/pr-watcher/heartbeat.log. That file only ticks MID-RUN
// (DOCTRINE 9.5), so a node that has just started has, by construction, not
// ticked it yet and the file still describes the PREVIOUS node's run. With a
// prompt armed and nothing in progress, every freshly launched node satisfied
// "heartbeat stale AND armed AND runnable>0" the instant it appeared. Station 00
// watched a node launched at 2026-09-06T09.28.41Z get killed at 09.29.07Z with
// ageMin=26 in the kill flag: 26 MINUTES of staleness attributed to a
// 26-SECOND-old process. The supervisor relaunched, the next node died the same
// way, the churn guard tripped at four kills, and the loop re-armed one prompt on
// every restart -- four duplicate PRs of one slice (#1703, #1704, #1707, #1708).
//
// WHY THESE TESTS ARE STRUCTURAL RATHER THAN BEHAVIOURAL. The rule itself
// (judged age = now - later of (heartbeat last write, node process start)) is
// PowerShell and is covered by Pester in supervise-watcher.tests.ps1. But
// `grep -rn "Invoke-Pester" .github/` returns nothing: NO CI JOB RUNS PESTER.
// So the semantic cases are real and worth having, and they are also invisible
// to CI. What CI can check -- and what these tests check -- is the WIRING, which
// is where this file has already failed once:
//
//   The kill decision lives inside a Start-Job scriptblock. Start-Job runs its
//   scriptblock in a FRESH runspace that does NOT inherit the outer scope's
//   function definitions. A pure helper defined at top level that the job never
//   reaches is a DECORATIVE GUARD -- and supervise-watcher.ps1 already carries
//   one of those (the in-progress\*.md check reads a directory no producer
//   writes; see pr-watchdog-dead-inprog-guard-HOLD.md). One is enough.
//
// So: these tests assert that the function exists exactly once, that it is
// reachable by the Pester harness, that it is carried into the job by a real
// mechanism (-InitializationScript built from the live function, not a
// hand-copied second body), that the job's kill arithmetic goes through it and
// through nothing else, and that the kill branch the 2026-08-11 hang depends on
// is still there.
//
// Pure ASCII -- no em-dashes / smart quotes / emoji.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PS1_PATH   = join(__dirname, '..', 'supervise-watcher.ps1');
const PESTER_PATH = join(__dirname, 'supervise-watcher.tests.ps1');

const ps1 = readFileSync(PS1_PATH, 'utf8');
const pester = readFileSync(PESTER_PATH, 'utf8');

const FN = 'Resolve-WatchdogJudgedAgeMinutes';
const MARKER = 'WATCHDOG_RESTART_GRACE_V1';

// The pre-fix expression, verbatim. If this string ever comes back the defect is
// back with it.
const PREFIX_INLINE_ARITHMETIC =
  '((Get-Date).ToUniversalTime() - (Get-Item $Heartbeat).LastWriteTimeUtc).TotalMinutes';

// ---------------------------------------------------------------------------
// Extract the heartbeat-watchdog job scriptblock: everything between the
// Start-Job that opens it and the -ArgumentList that closes it. Every assertion
// about "the job path" is made against THIS slice, not the whole file, so a
// top-level-only change cannot satisfy them.
// ---------------------------------------------------------------------------
function watchdogJobBody(text) {
  const startIdx = text.indexOf('Start-Job -Name pr-watcher-heartbeat-watchdog');
  assert.notEqual(startIdx, -1, 'could not find the heartbeat-watchdog Start-Job');
  const openIdx = text.indexOf('-ScriptBlock {', startIdx);
  assert.notEqual(openIdx, -1, 'could not find the watchdog -ScriptBlock');
  const closeIdx = text.indexOf('\n} -ArgumentList', openIdx);
  assert.notEqual(closeIdx, -1, 'could not find the watchdog job -ArgumentList terminator');
  return text.slice(openIdx, closeIdx);
}

const jobBody = watchdogJobBody(ps1);

// The top-level slice is everything OUTSIDE the job scriptblock.
const topLevel = ps1.replace(jobBody, '');

// A DEFINITION is the keyword at column 0. The -InitializationScript builder
// below quotes the same header text to re-wrap the body it reads off the live
// function; that quoted occurrence is the carry, not a second definition.
const DEFINITION_RE = new RegExp(`^function ${FN} \\{`, 'gm');

function countDefinitions(text) {
  return (text.match(DEFINITION_RE) || []).length;
}

// ---------------------------------------------------------------------------
// 1. The premise marker. This mirrors the done_when grep leg so a regression is
//    caught by `node --test` even when nobody runs the grep by hand.
// ---------------------------------------------------------------------------
test('supervise-watcher.ps1 carries the WATCHDOG_RESTART_GRACE_V1 marker', () => {
  assert.ok(ps1.includes(MARKER), `${MARKER} is missing from supervise-watcher.ps1`);
});

// ---------------------------------------------------------------------------
// 2. One definition of the rule, and it is a top-level pure function.
// ---------------------------------------------------------------------------
test('the grace rule is defined exactly once -- no hand-copied second body to drift', () => {
  assert.equal(
    countDefinitions(ps1), 1,
    `expected exactly one definition of ${FN}; a duplicate body inside the job would be free to drift from the tested one`,
  );
});

test('the function is defined at top level, not inside the job scriptblock', () => {
  assert.equal(countDefinitions(topLevel), 1, `${FN} must be defined once at top level`);
  assert.equal(countDefinitions(jobBody), 0, `${FN} must not be re-defined inside the job scriptblock`);
});

test('the function is reachable by the Pester harness (defined before the DOTSOURCE_ONLY return)', () => {
  const fnIdx = ps1.search(new RegExp(`^function ${FN} \\{`, 'm'));
  const hookIdx = ps1.indexOf("if ($env:PR_WATCHER_SUPERVISOR_DOTSOURCE_ONLY -eq '1') { return }");
  assert.notEqual(hookIdx, -1, 'the DOTSOURCE_ONLY test hook has moved or gone');
  assert.ok(
    fnIdx !== -1 && fnIdx < hookIdx,
    `${FN} must be defined ABOVE the DOTSOURCE_ONLY return, or the Pester suite dot-sources a file that never defines it`,
  );
});

test('the function is pure: no file, process or environment reads in its body', () => {
  const fnIdx = ps1.search(new RegExp(`^function ${FN} \\{`, 'm'));
  const rest = ps1.slice(fnIdx);
  // The body ends at the first line that is a lone closing brace.
  const endIdx = rest.indexOf('\n}\n');
  assert.notEqual(endIdx, -1, 'could not find the end of the function body');
  const body = rest.slice(0, endIdx);
  for (const forbidden of ['Get-Date', 'Get-Item', 'Test-Path', 'Get-CimInstance', '$env:', 'Write-Host', 'Write-Output', 'Add-Content']) {
    assert.ok(
      !body.includes(forbidden),
      `${FN} must stay pure (doctrine 7.6: the caller owns all I/O); found "${forbidden}" in its body`,
    );
  }
});

// ---------------------------------------------------------------------------
// 3. THE CARRY. Start-Job does not inherit outer-scope functions. This is the
//    assertion that separates a real fix from a decorative one.
// ---------------------------------------------------------------------------
test('the watchdog job is started with an -InitializationScript', () => {
  const startJobLine = ps1
    .split('\n')
    .find((l) => l.includes('Start-Job -Name pr-watcher-heartbeat-watchdog'));
  assert.ok(startJobLine, 'the heartbeat-watchdog Start-Job line is gone');
  assert.ok(
    /-InitializationScript\s+\$wdGraceInit\b/.test(startJobLine),
    'the watchdog Start-Job must pass -InitializationScript $wdGraceInit; without it the job runspace has no grace function and the kill call throws into the poll catch every cycle',
  );
});

test('the -InitializationScript body is read off the LIVE function, not retyped', () => {
  assert.ok(
    new RegExp(`Get-Command\\s+${FN}\\s+-CommandType\\s+Function\\s+-ErrorAction\\s+Stop`).test(topLevel),
    'the init script must look the function up with -ErrorAction Stop so a rename fails the supervisor at start-up instead of shipping a watchdog with no grace',
  );
  assert.ok(
    /\$wdGraceInit\s*=\s*\[scriptblock\]::Create\(/.test(topLevel),
    '$wdGraceInit must be built with [scriptblock]::Create',
  );
  assert.ok(
    /\$wdGraceFnInfo\.ScriptBlock\.ToString\(\)/.test(topLevel),
    'the init script text must come from the live function body (FunctionInfo.ScriptBlock.ToString()), so there is a single source for the rule',
  );
  const initIdx = topLevel.indexOf('$wdGraceInit   = [scriptblock]::Create(');
  const fnIdx = topLevel.search(new RegExp(`^function ${FN} \\{`, 'm'));
  assert.ok(initIdx > fnIdx, 'the init script must be built AFTER the function is defined');
});

test('the job proves the carry before it polls, and refuses to kill if it failed', () => {
  const checkIdx = jobBody.indexOf(`Get-Command ${FN} -CommandType Function`);
  assert.notEqual(checkIdx, -1, 'the job must verify the carried function is present in its own runspace');
  const loopIdx = jobBody.indexOf('while ($true)');
  assert.notEqual(loopIdx, -1, 'the watchdog poll loop is gone');
  assert.ok(checkIdx < loopIdx, 'the carry check must run BEFORE the poll loop, not inside it');
  const guard = jobBody.slice(checkIdx, loopIdx);
  assert.ok(guard.includes('FATAL'), 'a failed carry must be logged as FATAL, not swallowed');
  assert.ok(/\breturn\b/.test(guard), 'a failed carry must stop the job: a watchdog that cannot compute its grace must not kill');
});

// ---------------------------------------------------------------------------
// 4. The job's kill arithmetic goes through the function AND THROUGH NOTHING
//    ELSE. This is the "decorative guard" test.
// ---------------------------------------------------------------------------
test('the job computes $ageMin by calling the carried function', () => {
  assert.ok(
    new RegExp(`\\$ageMin\\s*=\\s*${FN}\\b`).test(jobBody),
    `the job must assign $ageMin from ${FN}; a pure function the job never calls is the same defect in a new costume`,
  );
});

test('every $ageMin assignment in the job goes through the function', () => {
  const assignments = jobBody.match(/\$ageMin\s*=\s*[^\n]*/g) || [];
  assert.ok(assignments.length > 0, 'the job no longer assigns $ageMin at all');
  for (const a of assignments) {
    assert.ok(a.includes(FN), `an $ageMin assignment bypasses the grace rule: ${a.trim()}`);
  }
});

test('the pre-fix inline heartbeat arithmetic is gone from the whole file', () => {
  assert.ok(
    !ps1.includes(PREFIX_INLINE_ARITHMETIC),
    'the pre-fix expression that judged a new node by the old node\'s heartbeat is back in the file',
  );
});

test('the node start time comes from the CIM objects already fetched, not a new producer file', () => {
  assert.ok(
    /\$p\.CreationDate/.test(jobBody),
    'the job must read CreationDate off the Win32_Process instances it already has; a marker file or a log line would add a producer that can go missing, which is exactly how the in-progress guard died',
  );
  assert.ok(
    /\.ToUniversalTime\(\)/.test(jobBody.slice(jobBody.indexOf('$p.CreationDate'))),
    'Win32_Process CreationDate is LOCAL time and must be converted to UTC before it is compared with LastWriteTimeUtc',
  );
});

// ---------------------------------------------------------------------------
// 5. ROW 1 MUST STILL KILL. The watchdog exists for the 2026-08-11 hang: a node
//    hung mid-run with a frozen heartbeat while 16 prompts sat armed and nothing
//    restarted it. A change that lets a genuinely hung node survive is worse
//    than the bug being fixed.
// ---------------------------------------------------------------------------
test('the kill branch survives: a stale judged age still kills the node', () => {
  assert.ok(
    jobBody.includes('if ($ageMin -gt $HungMin) {'),
    'the kill test is gone -- the 2026-08-11 hang would no longer be caught',
  );
  const killIdx = jobBody.indexOf('if ($ageMin -gt $HungMin) {');
  const after = jobBody.slice(killIdx);
  assert.ok(after.includes('Stop-Process'), 'the kill branch no longer stops the node');
  assert.ok(
    after.indexOf('Set-Content -Path $KillFlag') < after.indexOf('Stop-Process'),
    'SENTINEL FIRST, THEN KILL: the 2026-08-18 ambiguous-exit deadlock depends on this order',
  );
});

test('the kill flag records both clocks so a kill can be audited after the fact', () => {
  const killIdx = jobBody.indexOf('if ($ageMin -gt $HungMin) {');
  const flagLine = jobBody.slice(killIdx).split('\n').find((l) => l.includes('Set-Content -Path $KillFlag'));
  assert.ok(flagLine, 'the kill flag write is gone');
  for (const field of ['ageMin=', 'hbAgeMin=', 'nodeAgeMin=']) {
    assert.ok(flagLine.includes(field), `the kill flag must record ${field} -- the 09.29.07Z kill was diagnosed from this file`);
  }
});

// ---------------------------------------------------------------------------
// 6. The Pester suite really does cover the acceptance table. These cases are
//    NOT executed by CI (no Invoke-Pester anywhere in .github/), so all this can
//    check is that they exist and name the rows.
// ---------------------------------------------------------------------------
test('the Pester suite covers the grace rule and names all three acceptance rows', () => {
  assert.ok(pester.includes(FN), `the Pester suite must exercise ${FN}`);
  assert.ok(pester.includes(MARKER), `the Pester suite should name ${MARKER} so the coverage is greppable`);
  for (const row of ['row 1:', 'row 2:', 'row 3:']) {
    assert.ok(pester.includes(row), `the Pester suite is missing acceptance table ${row}`);
  }
  assert.ok(/no heartbeat file/i.test(pester), 'the Pester suite is missing the missing-heartbeat case');
});

// ---------------------------------------------------------------------------
// 7. House rule: PowerShell 5.1 reads UTF-8-without-BOM as Windows-1252, so a
//    single non-ASCII byte turns this file into a parser error at load. The
//    script's own header says so.
// ---------------------------------------------------------------------------
test('supervise-watcher.ps1 and its Pester suite stay pure ASCII', () => {
  for (const [name, text] of [['supervise-watcher.ps1', ps1], ['supervise-watcher.tests.ps1', pester]]) {
    const bad = [...text].filter((ch) => ch.codePointAt(0) > 127);
    assert.equal(bad.length, 0, `${name} contains non-ASCII characters: ${JSON.stringify(bad.slice(0, 5))}`);
  }
});
