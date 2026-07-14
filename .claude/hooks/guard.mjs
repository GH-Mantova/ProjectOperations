#!/usr/bin/env node
/**
 * PreToolUse GUARD - the FLOOR, not a cage.
 *
 * Marco set the scheduled agents to "skip all approvals" (2026-07-14). That was correct: a headless
 * agent that hits an approval prompt HANGS FOREVER (10 runs died waiting). But it removed the last
 * interactive backstop - and every safety rule we had was PROSE. Nothing physically stopped an agent
 * running `az`, or hand-rolling `gh pr merge 552` instead of calling Assert-Mergeable.
 *
 * DESIGN RULES, learned the hard way:
 *
 *   1. DENY-ONLY. NEVER `ask`. An ask-prompt in a headless run hangs the queue forever - that is
 *      exactly why the first version of this hook was thrown away before it ever ran.
 *   2. DENY NARROWLY. An earlier draft denied git inside C:\po-watcher - where the watcher's own
 *      agents WORK. It would have bricked the queue on the first run. Agents keep full git, full gh,
 *      full filesystem. We block only IRREVERSIBLE, SHARED-BLAST-RADIUS damage.
 *   3. FAIL OPEN ON OUR OWN BUGS. If this hook throws, it must ALLOW. A broken guard that blocks
 *      everything is an outage; a broken guard that allows is merely no worse than yesterday.
 *      (DOCTRINE section 7: a tool that cannot run must not silently produce a verdict.)
 *
 * Exit 0 = allow. Exit 2 = BLOCK (stderr is shown to the agent).
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

function block(reason) {
  console.error(reason);
  process.exit(2);
}

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  process.exit(0); // cannot read stdin -> fail open
}

let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0); // fail open
}

const command = String((payload && payload.tool_input && payload.tool_input.command) || "");
if (!command.trim()) process.exit(0);

// -----------------------------------------------------------------------------------------
// 1. AZURE / ENTRA / SHAREPOINT - absolute. Shared company infrastructure.
//    Reading config already committed to the repo is fine. MUTATING TENANT STATE is not.
// -----------------------------------------------------------------------------------------
const AZURE = [
  /(^|[;&|]|\s)az\s+(login|account|webapp|ad|group|resource|keyvault|role|staticwebapp|appservice)/i,
  /Connect-MgGraph/i,
  /\b(New|Set|Update|Remove|Revoke|Grant|Add)-Mg[A-Za-z]/i,
  /\b(New|Set|Update|Remove|Restart|Start|Stop)-Az[A-Za-z]/i,
  /Connect-AzAccount/i,
  /Connect-PnPOnline/i,
  /(^|[;&|]|\s)m365\s+/i,
  /graph\.microsoft\.com/i,
  /management\.azure\.com/i,
];
for (const rx of AZURE) {
  if (rx.test(command)) {
    block(
      "BLOCKED - AZURE / ENTRA / SHAREPOINT is an ABSOLUTE hard stop. No agent touches tenant state, ever.\n\n" +
        "These are shared company systems. A wrong move locks real staff out of real documents, and the\n" +
        "blast radius extends well beyond this repo.\n\n" +
        "What you MAY do: write the code, the migration, the runbook, and the exact step-by-step\n" +
        "instructions for Marco to run himself. Ship the PR. Then STOP and hand him the steps.\n" +
        "Escalating this is doing your job CORRECTLY - it is not a failure.\n\n" +
        "Blocked: " + command.slice(0, 180)
    );
  }
}

// -----------------------------------------------------------------------------------------
// 2. NEVER-MERGE - read from pipeline-lib so there is ONE source of truth.
//    Assert-Mergeable already guards this, but ONLY if the agent chooses to call it. This makes
//    hand-rolling `gh pr merge <n>` impossible for a listed PR.
// -----------------------------------------------------------------------------------------
let neverMerge = [];
try {
  // GUARD_LIB_PATH exists so the test can point at a fixture. Without it, the never-merge arm of
  // this hook could never be OBSERVED to fire (the real list is empty right now) - and a guard
  // never seen to fire is not a guard, it is a comment. DOCTRINE section 7.
  const libPath =
    process.env.GUARD_LIB_PATH ||
    join(HERE, "..", "..", "scripts", "pipeline", "pipeline-lib.ps1");
  const lib = readFileSync(libPath, "utf8");
  // Match the ASSIGNMENT only - not the commented-out examples above it.
  const m = lib.match(/^\s*\$script:NEVER_MERGE\s*=\s*@\(([^)]*)\)/m);
  if (m) neverMerge = m[1].split(",").map((s) => s.trim()).filter((s) => /^\d+$/.test(s));
} catch {
  // fail open on the LIST only - the Azure and force-push guards still stand.
}

if (neverMerge.length && /\bgh\s+pr\s+merge\b/i.test(command)) {
  for (const pr of neverMerge) {
    if (new RegExp("\\bgh\\s+pr\\s+merge\\b[^\\n]*\\b" + pr + "\\b", "i").test(command)) {
      block(
        "BLOCKED - PR #" + pr + " is on the NEVER-MERGE list.\n\n" +
          "The reason and its DISCHARGE CONDITION are recorded in scripts/pipeline/pipeline-lib.ps1.\n" +
          "Only Marco clears it.\n\n" +
          "Do NOT work around this with hand-rolled git. If you believe the condition is discharged,\n" +
          "say so and STOP. Escalating is doing your job correctly.\n\n" +
          "Blocked: " + command.slice(0, 180)
      );
    }
  }
}

// -----------------------------------------------------------------------------------------
// 3. IRREVERSIBLE GIT against main.
//    Force-pushing a FEATURE branch is legitimate and common (rebases) - explicitly ALLOWED.
// -----------------------------------------------------------------------------------------
const FORCE_MAIN = [
  /git\s+push[^\n]*(--force\b|--force-with-lease\b|\s-f\b)[^\n]*(\borigin\s+)?\bmain\b/i,
  /git\s+push[^\n]*\borigin\s+:main\b/i,
  /git\s+push[^\n]*--delete[^\n]*\bmain\b/i,
  /git\s+branch\s+-D\s+main\b/i,
];
for (const rx of FORCE_MAIN) {
  if (rx.test(command)) {
    block(
      "BLOCKED - irreversible operation against `main`.\n\n" +
        "Force-pushing or deleting `main` is not recoverable from here.\n" +
        "Force-pushing a FEATURE branch is fine and is NOT blocked - this guard is only about `main`.\n\n" +
        "Blocked: " + command.slice(0, 180)
    );
  }
}

process.exit(0); // allow
