/**
 * gate-eval.mjs - THE ONE executable-gate evaluator.
 *
 * Four registers in this repo ask the same question in four different ways:
 *
 *   prompt front-matter `premise`     - is this work still needed?
 *   BACKLOG.yaml        `gate`        - is the blocker gone?
 *   ESCALATIONS.yaml    `resolved_when` - has this actually been fixed, or just talked about?
 *   LESSONS.yaml        `regressed_when` - has a lesson we already paid for come back?
 *
 * All four are "run a shell command against the repo and read the exit code". They were three
 * separate implementations; the fourth would have been a fourth. This is the shared primitive.
 *
 * THE RULE THAT MATTERS (DOCTRINE section 7 - "your instrument lies"):
 * a gate that could not RUN must NEVER be reported as a finding. A spawn failure, a missing
 * shell, a command-not-found - those mean the INSTRUMENT is broken, not that the answer is "no".
 * Four of six recorded false findings were exactly this mistake. BROKEN is a third state, and it
 * is never silently folded into the negative one.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

export function findBash() {
  if (process.platform !== "win32") return "/bin/bash";
  for (const c of ["C:\\Program Files\\Git\\bin\\bash.exe", "C:\\Program Files (x86)\\Git\\bin\\bash.exe"]) {
    if (existsSync(c)) return c;
  }
  return null;
}

const BASH = findBash();

/**
 * Run one gate command.
 * Returns { ok, state, status, detail } where state is one of:
 *   "PASS"   - exit 0
 *   "FAIL"   - clean non-zero (the command RAN and answered "no")
 *   "BROKEN" - could not run; the reading is worthless, escalate the tool not the finding
 *
 * Callers map PASS/FAIL onto their own vocabulary - and they must, because the polarity differs:
 * a BACKLOG gate PASS means "unblocked, go", while a LESSONS regressed_when PASS means
 * "the regression is BACK, alarm". Same primitive, opposite meaning. Never assume PASS = good.
 */
export function runGate(cmd, cwd) {
  if (!BASH) return { ok: false, state: "BROKEN", status: -1, detail: "no bash found (install Git for Windows)" };
  if (typeof cmd !== "string" || cmd.trim() === "") {
    return { ok: false, state: "BROKEN", status: -1, detail: "empty gate command" };
  }
  try {
    execSync(cmd, { cwd, stdio: ["ignore", "ignore", "pipe"], shell: BASH, timeout: 60000 });
    return { ok: true, state: "PASS", status: 0, detail: "" };
  } catch (err) {
    const status = typeof err.status === "number" ? err.status : -1;
    const stderr = String(err.stderr || "").trim();
    if (
      status === -1 || status === 127 || status === 126 || status === 2 ||
      /command not found|is not recognized|No such file|cannot access/i.test(stderr)
    ) {
      return { ok: false, state: "BROKEN", status, detail: "gate exit " + status + ": " + stderr.slice(0, 160) };
    }
    return { ok: false, state: "FAIL", status, detail: stderr.slice(0, 160) };
  }
}

/**
 * Prove the evaluator can produce BOTH answers before trusting either.
 * "before believing a NEGATIVE, prove your instrument can produce a POSITIVE."
 * Any register checker should call this first and refuse to report if it fails.
 */
export function selfTest(cwd) {
  const pass = runGate("exit 0", cwd);
  const fail = runGate("exit 1", cwd);
  if (pass.state !== "PASS" || fail.state !== "FAIL") {
    return { ok: false, detail: "positive control=" + pass.state + " negative control=" + fail.state };
  }
  return { ok: true, detail: "positive+negative controls both behaved" };
}

/**
 * Lenient register parser, shared with check-backlog.mjs. Deliberately forgiving about indent so
 * a slightly-off file still yields readings - but see assertUniformItemIndent: lenient-parse plus
 * strict-load is the trap that let a malformed BACKLOG.yaml sit on main looking healthy. Always
 * run the indent guard alongside this.
 */
export function parseItems(text) {
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

/** Refuse to report readings from a file whose `- id:` items are not uniformly 2-space indented. */
export function assertUniformItemIndent(text) {
  const marks = [];
  text.split(/\r?\n/).forEach((l, i) => {
    const m = l.match(/^([ \t]*)-\s+id:/);
    if (m) marks.push({ line: i + 1, indent: m[1].length, tab: /\t/.test(m[1]) });
  });
  const bad = marks.filter((m) => m.indent !== 2 || m.tab);
  if (bad.length) {
    return {
      ok: false,
      detail: "malformed item indent at line(s) " + bad.map((b) => b.line).join(", ") +
        " (expected exactly 2 spaces before `- id:`)"
    };
  }
  return { ok: true, count: marks.length };
}
