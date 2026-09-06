// watchdog-inprog-guard-removed.test.mjs
//
// The dead "a build is running" guard in scripts/pr-watcher/supervise-watcher.ps1,
// and the two log lines that advertised it.
//
// WHAT WAS WRONG. Inside the heartbeat-watchdog poll loop the job read
// docs/pr-prompts/in-progress\*.md and skipped the cycle if the count was
// non-zero ("a build is running: not hung"). NOTHING has ever written that
// directory: index.mjs retires prompts to processed/, failed/, no-pr-opened/,
// blocked/ and paused/ and to nothing else; the directory is absent from
// origin/main; queue-sync.ps1 only Test-Paths it. The count was permanently 0,
// the `continue` never ran, and the guard was decorative. Two log lines -- the
// startup "watchdog armed" line and the kill line -- nevertheless told the
// reader the watchdog had confirmed nothing was in flight before killing.
//
// WHY THE FIX IS DELETION, NOT REPAIR. The watchdog exists for the 2026-08-11
// hang: the node hung MID-RUN with its heartbeat frozen ~40 min while 16 prompts
// sat armed and nothing restarted it. A hung node is, by definition, a node that
// believes it is building -- so a guard that actually worked would have
// suppressed the restart that incident demanded. Runtime behaviour was correct
// by accident; only the claim was false.
//
// WHY THESE TESTS ARE NODE AND NOT PESTER. `grep -rn "Invoke-Pester" .github/`
// is empty: no CI job runs Pester anywhere in this repo. `node --test` is what
// CI executes for this directory, so the assertions that must not rot live here.
//
// These tests are also the tripwire against reinstatement: the guard coming
// back -- against in-progress\*.md or against any substitute signal -- turns
// them red.
//
// Pure ASCII -- no em-dashes / smart quotes / emoji.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PS1_PATH = join(__dirname, '..', 'supervise-watcher.ps1');
const ps1 = readFileSync(PS1_PATH, 'utf8');

// Same extraction as watchdog-restart-grace.test.mjs: assertions about "the job
// path" are made against the Start-Job scriptblock, not the whole file, so a
// top-level-only change cannot satisfy them.
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

// Lines that are executable PowerShell, i.e. not blank and not a comment.
const codeLines = (text) =>
  text.split('\n').filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));

// ---------------------------------------------------------------------------
// 1. The guard is gone. This mirrors the done_when grep leg so `node --test`
//    catches a regression even when nobody runs the grep by hand.
// ---------------------------------------------------------------------------
test('the $inProg variable is gone from supervise-watcher.ps1 entirely', () => {
  assert.ok(
    !ps1.includes('inProg'),
    'the dead build-in-flight guard is back: "inProg" appears in supervise-watcher.ps1',
  );
});

test('no executable line in the watchdog job reads the in-progress directory', () => {
  for (const line of codeLines(jobBody)) {
    assert.ok(
      !line.includes('in-progress'),
      `the watchdog job reads the in-progress directory again: ${line.trim()}`,
    );
  }
});

test('no executable line anywhere in the file reads the in-progress directory', () => {
  for (const line of codeLines(ps1)) {
    assert.ok(
      !line.includes('in-progress'),
      `supervise-watcher.ps1 reads the in-progress directory again: ${line.trim()}`,
    );
  }
});

// ---------------------------------------------------------------------------
// 2. The two log lines now describe the test the watchdog actually performs.
// ---------------------------------------------------------------------------
test('the startup "watchdog armed" line no longer claims an in-progress check', () => {
  const armedLine = ps1.split('\n').find((l) => l.includes('Heartbeat watchdog armed:'));
  assert.ok(armedLine, 'the startup "Heartbeat watchdog armed" log line is gone');
  assert.ok(
    !armedLine.includes('in-progress'),
    'the startup log line still advertises an in-progress check that is not performed',
  );
});

test('the startup line names the real test, grace included, with the literal token heartbeat-only', () => {
  const armedLine = ps1.split('\n').find((l) => l.includes('Heartbeat watchdog armed:'));
  assert.ok(
    armedLine.includes('heartbeat-only'),
    'the startup log line must name the heartbeat-only fallback so the test is greppable',
  );
  // WATCHDOG_RESTART_GRACE_V1 (#1712) is what the line must describe now: judged
  // age is the LATER of the two clocks, and heartbeat-only is the documented
  // fallback when CreationDate cannot be read. Naming the grace is not optional:
  // a line that said only "heartbeat" would be the same kind of lie in reverse.
  assert.ok(
    armedLine.includes('WATCHDOG_RESTART_GRACE_V1'),
    'the startup log line must still name the grace rule that actually decides the kill',
  );
  assert.ok(
    /node process start/.test(armedLine),
    'the startup log line must still say the node process start is one of the two clocks',
  );
  // The provenance the prompt required be kept.
  assert.ok(armedLine.includes('$wdHungMin'), 'the hung threshold is no longer named in the startup line');
  assert.ok(armedLine.includes('${wdPollSec}'), 'the poll interval is no longer named in the startup line');
  assert.ok(armedLine.includes('.queue-state.json'), 'the runnable-count provenance is no longer named');
});

test('the kill log line no longer claims "0 in-progress"', () => {
  const killLine = ps1.split('\n').find((l) => l.includes('-> node HUNG'));
  assert.ok(killLine, 'the watchdog kill log line is gone');
  assert.ok(
    !killLine.includes('in-progress'),
    'the kill log line still says the watchdog confirmed nothing was in flight; it confirms no such thing',
  );
  // The pid, both ages and both counts stay: the 09.29.07Z kill was diagnosed
  // from this line and its flag.
  for (const field of ['{0}', '{1}', '{2}', '{3}', '{4}', '{5}']) {
    assert.ok(killLine.includes(field), `the kill line dropped format slot ${field}`);
  }
  assert.ok(killLine.includes('$node[0].ProcessId'), 'the kill line no longer records the pid');
});

// ---------------------------------------------------------------------------
// 3. The note that stops someone reinstating the guard.
// ---------------------------------------------------------------------------
test('a comment at the poll site records that the absence of the guard is deliberate', () => {
  assert.ok(
    jobBody.includes('NO BUILD-IN-FLIGHT GUARD HERE, DELIBERATELY'),
    'the note explaining why there is no build-in-flight guard is gone; without it the guard gets reinstated as a "fix"',
  );
  const noteIdx = jobBody.indexOf('NO BUILD-IN-FLIGHT GUARD HERE, DELIBERATELY');
  const note = jobBody.slice(noteIdx, noteIdx + 1600);
  assert.ok(
    note.includes('2026-08-11'),
    'the note must cite the 2026-08-11 hang: that incident is the reason a working guard would be a regression',
  );
  assert.ok(
    /DO NOT REINSTATE/.test(note),
    'the note must say plainly that the guard is not to be reinstated against a real signal',
  );
});

// ---------------------------------------------------------------------------
// 4. Collateral damage. The guard sat three lines above WATCHDOG_RESTART_GRACE_V1
//    (#1712), which fixed a live kill loop. Removing a neighbour must not have
//    disturbed it, and must not have disturbed the kill branch either.
//    watchdog-restart-grace.test.mjs owns the full contract; these are the two
//    load-bearing lines nearest the deletion.
// ---------------------------------------------------------------------------
test('the grace call and the kill branch immediately below the deletion are intact', () => {
  assert.ok(
    /\$ageMin\s*=\s*Resolve-WatchdogJudgedAgeMinutes\b/.test(jobBody),
    'the grace rule is no longer what computes $ageMin -- WATCHDOG_RESTART_GRACE_V1 was disturbed',
  );
  assert.ok(
    jobBody.includes('if ($ageMin -gt $HungMin) {'),
    'the kill test is gone -- the 2026-08-11 hang would no longer be caught',
  );
});

// ---------------------------------------------------------------------------
// 5. The historical record at the top of the file is NOT rewritten. The comment
//    describing the 2026-08-18 outage says "(7 prompts armed, 0 in-progress)".
//    That is an accurate record of what was observed on the night, not a live
//    check. Tidying it to satisfy a grep would delete the lesson.
// ---------------------------------------------------------------------------
test('the 2026-08-18 incident note keeps its observed "0 in-progress" reading', () => {
  assert.ok(
    ps1.includes('(7 prompts armed, 0 in-progress)'),
    'the historical 2026-08-18 observation was rewritten to tidy a grep; that record is a lesson, not a claim about live code',
  );
});

// ---------------------------------------------------------------------------
// 6. House rule: PS 5.1 reads UTF-8-without-BOM as Windows-1252, so one stray
//    byte is a load-time parser error. Asserted here too because this slice
//    added a comment block by hand.
// ---------------------------------------------------------------------------
test('supervise-watcher.ps1 stays pure ASCII with no BOM', () => {
  const bad = [...ps1].filter((ch) => ch.codePointAt(0) > 127);
  assert.equal(bad.length, 0, `supervise-watcher.ps1 contains non-ASCII characters: ${JSON.stringify(bad.slice(0, 5))}`);
  assert.notEqual(ps1.charCodeAt(0), 0xfeff, 'supervise-watcher.ps1 has a BOM');
});
