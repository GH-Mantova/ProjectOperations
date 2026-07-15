#!/usr/bin/env node
/**
 * BACKLOG GATE CHECKER — run by STATION 04-SCANNER every 4 hours.
 *
 * A HOLD is a PASSIVE note. Something has to come back and ASK "is it unblocked yet?" — and for
 * six days, nothing did. The Branding manager was gated on the quote-PDF fix; that fix merged on
 * 2026-07-08 and the item just sat there, invisible, while AdminCompanyPage.tsx shipped a comment
 * promising the tables it needed.
 *
 * This makes the blocker EXECUTABLE. Every backlog item carries a `gate` — a shell command that
 * EXITS 0 when the blocker is gone. We run them all against main. Anything that turns green is
 * reported, loudly, as READY TO STAGE.
 *
 * Same doctrine as the intake lint: if you cannot express the blocker as a command, you do not
 * understand it well enough to be blocked by it.
 *
 * DOCTRINE section 7 applies to THIS FILE TOO: a gate that cannot RUN must never be reported as
 * "not ready". A spawn failure is not a blocked item. It fails LOUD, as BROKEN.
 *
 * Exit 0 = nothing newly ready.  Exit 10 = at least one item is READY TO STAGE (not an error).
 */

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const RESET = "\x1b[0m", RED = "\x1b[31m", GREEN = "\x1b[32m", YELLOW = "\x1b[33m", DIM = "\x1b[2m", BOLD = "\x1b[1m";

const repoRoot = process.env.BACKLOG_REPO_ROOT || process.cwd();
const file = join(repoRoot, "docs", "pr-prompts", "BACKLOG.yaml");
if (!existsSync(file)) {
  console.error("no BACKLOG.yaml at " + file);
  process.exit(1);
}

/**
 * Deliberately dumb YAML reader — no dependency, no surprises. It understands exactly the shape
 * BACKLOG.yaml uses: a list of `- id:` blocks with flat scalar keys and `>` folded blocks.
 */
function parseItems(text) {
  const items = [];
  let cur = null;
  let folding = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || /^\s*#/.test(line)) continue;

    const start = line.match(/^\s*-\s+id:\s*(.+)$/);
    if (start) {
      if (cur) items.push(cur);
      cur = { id: start[1].trim() };
      folding = null;
      continue;
    }
    if (!cur) continue;

    const kv = line.match(/^\s{4,}([a-z_]+):\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      let val = kv[2].trim();
      if (val === ">" || val === "|") { folding = key; cur[key] = ""; continue; }
      folding = null;
      const q = val.slice(0, 1);
      if ((q === "'" || q === '"') && val.slice(-1) === q && val.length > 1) val = val.slice(1, -1);
      cur[key] = val;
      continue;
    }
    if (folding) cur[folding] = (cur[folding] + " " + line.trim()).trim();
  }
  if (cur) items.push(cur);
  return items;
}

function findBash() {
  if (process.platform !== "win32") return "/bin/bash";
  for (const c of ["C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files (x86)\\Git\\bin\\bash.exe"]) {
    if (existsSync(c)) return c;
  }
  return null;
}
const BASH = findBash();

function runGate(cmd) {
  if (!BASH) return { state: "BROKEN", detail: "no bash found (install Git for Windows)" };
  try {
    execSync(cmd, { cwd: repoRoot, stdio: ["ignore", "ignore", "pipe"], shell: BASH, timeout: 60000 });
    return { state: "READY" }; // exit 0 -> blocker gone
  } catch (err) {
    const status = typeof err.status === "number" ? err.status : -1;
    const stderr = String(err.stderr || "").trim();
    // A gate that could not RUN is BROKEN, not "still blocked". Never let a failed call
    // masquerade as a finding (DOCTRINE section 7 - four of six lies were exactly this).
    if (status === -1 || status === 127 || status === 126 ||
        /command not found|is not recognized|No such file/i.test(stderr)) {
      return { state: "BROKEN", detail: "gate exit " + status + ": " + stderr.slice(0, 120) };
    }
    return { state: "BLOCKED" }; // clean non-zero -> blocker still stands
  }
}

// STRICT-STRUCTURE GUARD (2026-07-15). The parser above is deliberately lenient: `/^\s*-\s+id:/`
// matches a `- id:` at ANY indent, so a 4-space `- id:` (as swms/mail-send had) parsed "fine" here
// while a real yaml.safe_load died at that line. Lenient-green + strict-broken is exactly the trap
// that let a malformed BACKLOG sit on main. Refuse to report gate readings from a malformed file
// (DOCTRINE section 7: do not trust an instrument you have not proven can read the input).
function assertUniformItemIndent(text) {
  const marks = [];
  text.split(/\r?\n/).forEach((l, i) => {
    const m = l.match(/^([ \t]*)-\s+id:/);
    if (m) marks.push({ line: i + 1, indent: m[1].length, tab: /\t/.test(m[1]) });
  });
  const bad = marks.filter((m) => m.indent !== 2 || m.tab);
  if (bad.length) {
    console.error(RED + BOLD + "STRICT-STRUCTURE GUARD FAILED - BACKLOG.yaml is malformed." + RESET);
    console.error(RED + "  Every '- id:' must be indented EXACTLY 2 spaces (no tabs). A lenient reader hides this;" + RESET);
    console.error(RED + "  a strict yaml.safe_load fails on it. Fix the indent, then re-run." + RESET);
    for (const b of bad) console.error(RED + "    line " + b.line + ": '- id:' has " + (b.tab ? "a TAB / " : "") + b.indent + "-space indent, expected 2" + RESET);
    process.exit(2);
  }
}

const backlogText = readFileSync(file, "utf8");
assertUniformItemIndent(backlogText);
const items = parseItems(backlogText)
  .sort((a, b) => Number(a.order || 999) - Number(b.order || 999));

const ready = [], blocked = [], marco = [], broken = [];

for (const it of items) {
  const r = runGate(String(it.gate || "false"));
  if (r.state === "BROKEN") { broken.push({ it, r }); continue; }
  if (r.state === "BLOCKED") { blocked.push(it); continue; }
  (String(it.needs_marco) === "true" ? marco : ready).push(it);
}

console.log(BOLD + "=== BACKLOG — " + items.length + " item(s) not yet in the queue" + RESET + "\n");

if (ready.length) {
  console.log(GREEN + BOLD + ">>> READY TO STAGE — the blocker is GONE. Stage these." + RESET);
  for (const it of ready) {
    console.log(GREEN + "  [" + it.priority + "] " + it.id + RESET);
    console.log("        " + it.title);
    console.log(DIM + "        gate passed: " + it.gate_means + RESET);
  }
  console.log("");
}

if (marco.length) {
  console.log(YELLOW + BOLD + ">>> UNBLOCKED, BUT NEEDS MARCO — do NOT auto-stage. Ask him." + RESET);
  for (const it of marco) {
    console.log(YELLOW + "  [" + it.priority + "] " + it.id + RESET);
    console.log("        " + it.title);
    if (it.marco_question) console.log(DIM + "        ASK: " + it.marco_question + RESET);
  }
  console.log("");
}

if (blocked.length) {
  console.log(DIM + ">>> still blocked (gate not yet satisfied)" + RESET);
  for (const it of blocked) console.log(DIM + "  [" + it.priority + "] " + it.id + " - " + it.gate_means + RESET);
  console.log("");
}

if (broken.length) {
  console.log(RED + BOLD + ">>> BROKEN GATES — the CHECK failed, which is NOT the same as 'blocked'." + RESET);
  console.log(RED + "    Fix the gate command. Do not read this as 'not ready'." + RESET);
  for (const b of broken) console.log(RED + "  " + b.it.id + " - " + b.r.detail + RESET);
  console.log("");
}

console.log(DIM + "ready=" + ready.length + "  needs-marco=" + marco.length +
            "  blocked=" + blocked.length + "  broken=" + broken.length + RESET);

if (broken.length) process.exit(1);
process.exit(ready.length > 0 ? 10 : 0);
