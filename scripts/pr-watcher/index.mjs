#!/usr/bin/env node
// PR-prompt watcher daemon — zero external dependencies.
//
// Watches docs/pr-prompts/*-ready.md and feeds each one to a headless Claude
// Code session. Single-threaded queue. On completion, moves the prompt to
// processed/ (success) or failed/ (non-zero exit) with a sibling .log file.
//
// NEW (unattended mode): after the agent opens a PR, the watcher polls GitHub
// until the PR is merged (auto-merge via `gh pr merge --auto`) or times out.
// On CI failure or timeout, the watcher pauses ALL remaining queued prompts
// by moving them to paused/ so they don't run on a broken state.
//
// NEW (auto-review mode): polls GitHub for newly-opened PRs and writes a
// review prompt file for each. The queue's existing serialization runs the
// review like any other prompt — reviews never race with authoring jobs.
//
// NEW (v2 — all opt-in via env, defaults preserve v1 behaviour):
//   - Dependency gating via prompt front-matter (requires-merged /
//     requires-file-on-main) — unmet deps defer the prompt, re-checked
//     on the periodic rescan.
//   - Auto-update-branch (PR_WATCHER_AUTO_UPDATE) for BEHIND PRs.
//   - Policy auto-merge (PR_WATCHER_AUTO_MERGE_POLICY=tests-docs|all|off).
//   - Failure quarantine with .report.md + one transient-signature retry.
//   - Heartbeat log while an agent runs (heartbeat.log, 60s cadence).
//   - Deterministic queue order: rev-* first, then lexicographic.
//   - Dry-run mode (PR_WATCHER_DRY_RUN) — decisions logged, nothing executed.
//
// Usage:
//   node scripts/pr-watcher/index.mjs
//
// Convention:
//   - Cowork writes drafts as docs/pr-prompts/pr-NN-{slug}.md
//   - You opt in by renaming to docs/pr-prompts/pr-NN-{slug}-ready.md
//   - The watcher fires, runs the prompt, then moves the file out

import { execFileSync, spawn } from "node:child_process";
import { existsSync, unlinkSync, watch as fsWatch } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rmdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Isolation: the watcher can run against a dedicated clone (its own .git)
// so automation never churns the interactive working tree's HEAD/index.
// Unset -> unchanged (repo root two levels up from this script).
const REPO_ROOT = process.env.PR_WATCHER_REPO_ROOT
  ? path.resolve(process.env.PR_WATCHER_REPO_ROOT)
  : path.resolve(__dirname, "..", "..");
// Orphaned-worktree sweep runs ONLY in isolated-clone mode. When
// PR_WATCHER_REPO_ROOT is unset, REPO_ROOT is the interactive tree, which may
// hold the user's own legitimate feature-branch worktrees — never sweep those.
const WORKTREE_SWEEP = !!process.env.PR_WATCHER_REPO_ROOT;
// The prompt QUEUE can live outside the git clone: scheduled agents
// (pr-shepherd / watcher-triage / night-qa) and Marco only see the interactive
// tree, so a queue nested inside PR_WATCHER_REPO_ROOT strands staged prompts.
// PR_WATCHER_PROMPT_DIR moves the queue anywhere; git/build stay on REPO_ROOT.
export function resolvePromptDir(env, repoRoot) {
  return env.PR_WATCHER_PROMPT_DIR
    ? path.resolve(env.PR_WATCHER_PROMPT_DIR)
    : path.join(repoRoot, "docs", "pr-prompts");
}
const PROMPT_DIR = resolvePromptDir(process.env, REPO_ROOT);
const PROCESSED_DIR = path.join(PROMPT_DIR, "processed");
const FAILED_DIR = path.join(PROMPT_DIR, "failed");
const BLOCKED_DIR = path.join(PROMPT_DIR, "blocked");
const PAUSED_DIR = path.join(PROMPT_DIR, "paused");
const NO_PR_DIR = path.join(PROMPT_DIR, "no-pr-opened");

const READY_PATTERN = /^(pr|rev)-.*-ready\.md$/i;
const DEBOUNCE_MS = 800;

// Periodic rescan interval. fs.watch can silently drop events on Windows
// (especially over network shares or after long idle periods), so we walk
// the directory every N minutes as a belt-and-braces fallback. Rescan-
// sourced enqueues are tagged in the log so they're distinguishable from
// fs.watch events.
const RESCAN_INTERVAL_MS = 5 * 60 * 1000;

// Safety caps — tweak via env
const MAX_TURNS = Number(process.env.PR_WATCHER_MAX_TURNS ?? 120);
const CLAUDE_BIN = process.env.PR_WATCHER_CLAUDE_BIN ?? "claude";
const GH_BIN = process.env.PR_WATCHER_GH_BIN ?? "gh";

// Auto-merge policy — opt-in only. The review-gated workflow runs with this
// OFF. Values:
//   off        — never auto-merge (default)
//   all        — auto-merge every PR the agent opens (legacy blanket mode)
//   tests-docs — auto-merge ONLY tests/** + docs/**-touching PRs with green
//                checks and a MERGE verdict file; everything else waits for Marco
// Back-compat: PR_WATCHER_AUTO_MERGE=true (old blanket flag) maps to "all"
// when no explicit policy is set.
const AUTO_MERGE_POLICY = (() => {
  const raw = (process.env.PR_WATCHER_AUTO_MERGE_POLICY ?? "").trim().toLowerCase();
  if (raw === "all" || raw === "tests-docs" || raw === "off") return raw;
  if (raw) {
    console.log(`[startup] [WARN] unknown PR_WATCHER_AUTO_MERGE_POLICY "${raw}" — using "off"`);
    return "off";
  }
  return process.env.PR_WATCHER_AUTO_MERGE === "true" ? "all" : "off";
})();
const AUTO_MERGE = AUTO_MERGE_POLICY !== "off";
const MERGE_TIMEOUT_MS =
  Number(process.env.PR_WATCHER_MERGE_TIMEOUT_MIN ?? 90) * 60 * 1000;
// Per-run wall-clock ceiling. --max-turns caps TURNS only; a child that
// hangs without consuming turns (stalled MCP call, wedged tool) sits until
// the next watcher restart reaps it. This backstops that: on trip, kill the
// spawned tree, quarantine the prompt to blocked/, and continue draining
// the queue (per-prompt quarantine — this does NOT global-pause). Set 0 to
// disable. Default is deliberately generous (LL-25: silence ≠ hang).
const RUN_TIMEOUT_MS =
  Number(process.env.PR_WATCHER_RUN_TIMEOUT_MIN ?? 75) * 60 * 1000;
const POLL_INTERVAL_MS =
  Number(process.env.PR_WATCHER_POLL_INTERVAL_SEC ?? 60) * 1000;

// Auto-review: poll GitHub for newly-opened PRs and enqueue a review
// prompt for each. The poller only WRITES prompt files — execution goes
// through the normal queue, so reviews serialize with authoring jobs.
const AUTO_REVIEW = process.env.PR_WATCHER_AUTO_REVIEW === "true"; // default OFF
const REVIEW_POLL_INTERVAL_MS =
  Number(process.env.PR_WATCHER_REVIEW_POLL_SEC ?? 90) * 1000;
const REVIEW_MIN_AGE_MS =
  Number(process.env.PR_WATCHER_REVIEW_MIN_AGE_MIN ?? 2) * 60 * 1000;
const REVIEWED_STATE_FILE = path.join(__dirname, ".reviewed-prs.json");

// Auto-update-branch: each poll, bring the watcher account's open PRs that
// are BEHIND main up to date via `gh pr update-branch`. Conflicting PRs are
// skipped (update-branch can't resolve conflicts). Opt-in.
const AUTO_UPDATE = process.env.PR_WATCHER_AUTO_UPDATE === "true"; // default OFF
const UPDATE_POLL_INTERVAL_MS =
  Number(process.env.PR_WATCHER_UPDATE_POLL_SEC ?? 120) * 1000;

// Dry-run: log every decision (queue, deps, policy, update-branch, merge)
// but never spawn claude and never run a MUTATING gh/git command. Read-only
// gh calls (pr list/view/checks) still run so decisions reflect live state.
// Prompt files are never consumed in dry-run.
const DRY_RUN = process.env.PR_WATCHER_DRY_RUN === "true"; // default OFF

// Heartbeat — while an agent runs, append a line to heartbeat.log every
// 60s (LL-25: silence ≠ hang — give Marco evidence the agent is alive).
const HEARTBEAT_FILE = path.join(__dirname, "heartbeat.log");
const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const HEARTBEAT_MAX_LINES = 500;

// Transient-failure signatures — a failed run whose output matches one of
// these gets ONE automatic retry before quarantine. Override the defaults
// with PR_WATCHER_TRANSIENT_PATTERNS (comma-separated regex bodies, applied
// case-insensitive).
const TRANSIENT_PATTERNS = (() => {
  const raw = (process.env.PR_WATCHER_TRANSIENT_PATTERNS ?? "").trim();
  const sources = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : ["cache.{0,40}\\b400\\b", "ECONNRESET", "Workspace still starting", "runner.{0,5}lost"];
  const compiled = [];
  for (const src of sources) {
    try {
      compiled.push(new RegExp(src, "i"));
    } catch (err) {
      console.log(`[startup] [WARN] bad transient pattern "${src}" skipped: ${err.message}`);
    }
  }
  return compiled;
})();

// Pure trip decision for the per-run wall-clock watchdog. Exported so the
// rule is unit-testable in isolation. capMs <= 0 disables the ceiling.
export function isRunTimedOut(elapsedMs, capMs) {
  return capMs > 0 && elapsedMs >= capMs;
}

// Extract worktree paths from `git worktree list --porcelain`, excluding the
// main working tree. Pure + exported for unit testing.
export function parseWorktreePaths(porcelain, mainPath) {
  const main = path.resolve(mainPath);
  const out = [];
  for (const line of (porcelain ?? "").split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      const p = line.slice("worktree ".length).trim();
      if (p && path.resolve(p) !== main) out.push(p);
    }
  }
  return out;
}

// Reclaim every worktree except the watcher's own REPO_ROOT. Only ever called
// when no child is running (startup, or between jobs). Best-effort — never throws.
async function sweepOrphanWorktrees() {
  if (!WORKTREE_SWEEP) return;
  let listing;
  try {
    await runGit(["worktree", "prune"]);
    listing = await runGit(["worktree", "list", "--porcelain"]);
  } catch (err) {
    log("worktree", `sweep skipped: ${err.message}`);
    return;
  }
  const paths = parseWorktreePaths(listing, REPO_ROOT);
  for (const p of paths) {
    try {
      await runGit(["worktree", "remove", "--force", p]);
      log("worktree", `reclaimed orphan worktree ${p}`);
    } catch (err) {
      log("worktree", `could not remove ${p}: ${err.message}`);
    }
  }
  if (paths.length > 0) {
    try { await runGit(["worktree", "prune"]); } catch { /* best-effort */ }
  }
}

export function isTransientFailure(text) {
  if (!text) return false;
  const tail = text.length > 16384 ? text.slice(-16384) : text;
  return TRANSIENT_PATTERNS.some((re) => re.test(tail));
}

// One retry per prompt name, tracked in memory. A watcher restart resets
// counts — acceptable: the restart itself is the manual intervention.
const retryCounts = new Map();

// Lockfile — prevents two watcher instances from fighting over the queue.
const LOCK_FILE = path.join(__dirname, ".watcher.lock");

// Child-process sidecar — tracks PIDs of `claude` children the watcher
// SPAWNED ITSELF, so we can kill exactly those (and only those) on shutdown
// and never touch interactive Claude Code / Cowork sessions started outside
// the watcher. Single-threaded queue means this normally holds 0 or 1 PIDs;
// we use a list anyway to stay forward-compatible.
const CHILDREN_FILE = path.join(__dirname, ".watcher-children.json");

// Nightly cutoff (HH:MM, 24-hour, local). Past this, the watcher refuses to
// start a NEW prompt and exits cleanly. The in-flight prompt (if any)
// finishes normally. Unset = no cutoff. Example: "06:00" stops new prompts
// at 6 AM.
const STOP_AT = (process.env.PR_WATCHER_STOP_AT ?? "").trim() || null;

// Compute the absolute cutoff timestamp ONCE at startup so the cutoff
// doesn't shift if the watcher runs unusually long. The cutoff is the next
// occurrence of HH:MM after startup. A 6pm start with STOP_AT=06:00 sets
// the cutoff to 6am tomorrow.
const STOP_AT_TIMESTAMP = (() => {
  if (!STOP_AT) return null;
  const m = STOP_AT.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const cutoffH = Number(m[1]);
  const cutoffM = Number(m[2]);
  if (cutoffH > 23 || cutoffM > 59) return null;
  const now = new Date();
  const stop = new Date(now);
  stop.setHours(cutoffH, cutoffM, 0, 0);
  if (stop.getTime() <= now.getTime()) {
    stop.setDate(stop.getDate() + 1);
  }
  return stop.getTime();
})();

function isPastStopTime() {
  if (STOP_AT_TIMESTAMP === null) return false;
  return Date.now() >= STOP_AT_TIMESTAMP;
}

// Usage / rate-limit detection. When `claude --print` exits non-zero with
// any of these patterns in its output, the watcher treats it as a soft
// halt (keep the prompt queued, exit cleanly) instead of a real failure
// (move to failed/, cascade-flush the rest of the queue). Prevents a
// single usage cap from poisoning every queued prompt in seconds.
const USAGE_LIMIT_PATTERNS = [
  /usage\s*limit/i,
  /rate\s*limit/i,
  /rate[-\s]*limited/i,
  /too\s*many\s*requests/i,
  /credit\s*balance/i,
  /insufficient\s*credits/i,
  /monthly\s*usage/i,
  /hit your limit/i, // LL-28: "You've hit your limit" misfiled ~47 prompts as hard failures

  /max(?:imum)?\s*requests?/i,
  /quota\s*(?:exceeded|exhausted)/i,
  /\b429\b/,
];

function isUsageLimitError(text) {
  if (!text) return false;
  const tail = text.length > 16384 ? text.slice(-16384) : text;
  return USAGE_LIMIT_PATTERNS.some((re) => re.test(tail));
}

const queue = [];
const seen = new Set();
const debouncers = new Map();
let running = false;
let queuePaused = false;

function ts() {
  return new Date().toISOString();
}
function log(level, msg) {
  console.log(`[${ts()}] [${level}] ${msg}`);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureDirs() {
  await mkdir(PROCESSED_DIR, { recursive: true });
  await mkdir(FAILED_DIR, { recursive: true });
  await mkdir(BLOCKED_DIR, { recursive: true });
  await mkdir(PAUSED_DIR, { recursive: true });
  await mkdir(NO_PR_DIR, { recursive: true });
}

function isReady(name) {
  return READY_PATTERN.test(name);
}

function isReviewJob(name) {
  // rev-NNN-ready.md (new convention) or legacy pr-NNN-auto-review-ready.md
  return /^rev-/i.test(name) || /-auto-review-ready\.md$/i.test(name);
}

// Pull the PR number out of a review-job filename. Supports both the
// rev-NNN-ready.md convention and the legacy pr-NNN-auto-review-ready.md.
function reviewJobPrNumber(name) {
  const m =
    name.match(/^rev-(\d+)-ready\.md$/i) ??
    name.match(/^pr-(\d+)-auto-review-ready\.md$/i);
  return m ? Number(m[1]) : null;
}

// Mirror a finished review verdict into a PR comment so it's readable from
// the GitHub mobile app (the verdict file in docs/pr-reviews/ is local-only).
// Best-effort: any failure logs and returns — the verdict FILE remains the
// source of truth and the review job never fails over the mirror step.
//
// Gates safety: PR comments are NOT scanned by the gates — pr-gates.mjs
// reads only the PR body (`gh pr view --json body`). Verdict content can
// safely contain checklist text or GATE-ALLOW mentions without tripping
// CP-22/CP-09 on re-runs.
async function mirrorVerdictToPr(name) {
  const prNumber = reviewJobPrNumber(name);
  if (prNumber == null) {
    log("review", `verdict mirror skipped: no PR number in job name "${name}"`);
    return;
  }
  const verdictRel = `docs/pr-reviews/pr-${prNumber}-review.md`;
  const verdictPath = path.join(REPO_ROOT, "docs", "pr-reviews", `pr-${prNumber}-review.md`);
  let verdict;
  try {
    verdict = await readFile(verdictPath, "utf-8");
  } catch {
    log("review", `verdict mirror skipped: ${verdictRel} not found`);
    return;
  }
  // ASCII-only header — the comment passes through a shell-spawned gh on
  // Windows (spawn shell:true), where non-ASCII can mangle.
  const header = `[watcher verdict] mirrored from ${verdictRel}\n\n`;
  // --body-file with a temp file avoids quoting hell entirely.
  const tmpFile = path.join(__dirname, `.verdict-comment-${prNumber}.tmp.md`);
  try {
    await writeFile(tmpFile, header + verdict, "utf-8");
    await runGh(["pr", "comment", String(prNumber), "--body-file", tmpFile]);
    log("review", `verdict mirrored to PR #${prNumber} as a comment`);
  } catch (err) {
    log("review", `verdict mirror failed: ${err.message}`);
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      // best-effort cleanup
    }
  }
}

function debouncedEnqueue(name) {
  if (!isReady(name)) return;
  if (queuePaused) return; // ignore new files while paused
  if (debouncers.has(name)) clearTimeout(debouncers.get(name));
  const timer = setTimeout(() => {
    debouncers.delete(name);
    enqueue(name);
  }, DEBOUNCE_MS);
  debouncers.set(name, timer);
}

function enqueue(name, { source = "watch" } = {}) {
  const filePath = path.join(PROMPT_DIR, name);
  if (!existsSync(filePath)) return;
  if (seen.has(name)) return;
  seen.add(name);
  if (isReviewJob(name)) {
    // Verdicts unblock Marco's merges; insert after any review jobs already at
    // the front so the currently-running authoring job is never interrupted but
    // the next free slot goes to verdicts rather than more authoring work.
    let insertAt = 0;
    while (insertAt < queue.length && isReviewJob(path.basename(queue[insertAt]))) {
      insertAt++;
    }
    queue.splice(insertAt, 0, filePath);
  } else {
    // Authoring jobs run in lexicographic filename order (numbering =
    // ordering), always after any review jobs waiting at the front.
    let insertAt = 0;
    while (insertAt < queue.length && isReviewJob(path.basename(queue[insertAt]))) {
      insertAt++;
    }
    while (insertAt < queue.length && path.basename(queue[insertAt]) <= name) {
      insertAt++;
    }
    queue.splice(insertAt, 0, filePath);
  }
  const tail = `depth: ${queue.length}${running ? ", busy" : ""}, source: ${source}`;
  log("queue", `${name} (${tail})`);
  drain();
}

// Run `gh` and return parsed JSON or raw stdout. With allowNonZero, a
// non-zero exit still resolves stdout (gh pr checks exits 8 when any check
// is failing — exactly the case where we want its output for a report).
function runGh(args, { json = false, allowNonZero = false } = {}) {
  return new Promise((resolve, reject) => {
    const out = [];
    const err = [];
    const child = spawn(GH_BIN, args, {
      cwd: REPO_ROOT,
      shell: true,
    });
    child.stdout.on("data", (c) => out.push(c));
    child.stderr.on("data", (c) => err.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      const stdout = Buffer.concat(out).toString("utf-8");
      const stderr = Buffer.concat(err).toString("utf-8");
      if (code !== 0 && !allowNonZero) {
        const e = new Error(`gh ${args.join(" ")} exited ${code}: ${stderr.trim()}`);
        e.code = code;
        e.stderr = stderr;
        return reject(e);
      }
      if (json) {
        try {
          resolve(JSON.parse(stdout));
        } catch (parseErr) {
          reject(new Error(`gh JSON parse failed: ${parseErr.message}\nOutput: ${stdout}`));
        }
      } else {
        resolve(stdout);
      }
    });
  });
}

// Run `git` and resolve stdout, reject on non-zero exit.
function runGit(args) {
  return new Promise((resolve, reject) => {
    const out = [];
    const err = [];
    const child = spawn("git", args, { cwd: REPO_ROOT, shell: true });
    child.stdout.on("data", (c) => out.push(c));
    child.stderr.on("data", (c) => err.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(`git ${args.join(" ")} exited ${code}: ${Buffer.concat(err).toString("utf-8").trim()}`),
        );
      }
      resolve(Buffer.concat(out).toString("utf-8"));
    });
  });
}

// --- Dependency gating (front-matter) ---
//
// Prompts may declare dependencies as HTML comments at the very top:
//   <!-- watcher: requires-merged: 380, 379 -->
//   <!-- watcher: requires-file-on-main: tests/e2e/pr-acceptance/helpers.ts -->
// Parsing stops at the first line that isn't blank or a watcher comment, so
// the directives must come before any prompt content.
// Parses one trimmed line as a watcher directive using plain string ops
// (no regex — CodeQL js/polynomial-redos). Returns { key, value } or null.
function parseWatcherDirective(t) {
  if (!t.startsWith("<!--") || !t.endsWith("-->")) return null;
  const inner = t.slice(4, -3).trim();
  if (!inner.toLowerCase().startsWith("watcher:")) return null;
  const rest = inner.slice("watcher:".length);
  const colon = rest.indexOf(":");
  if (colon === -1) return null;
  const key = rest.slice(0, colon).trim().toLowerCase();
  if (key === "" || ![...key].every((c) => (c >= "a" && c <= "z") || c === "-")) return null;
  const value = rest.slice(colon + 1).trim();
  if (value === "") return null;
  return { key, value };
}

export function parseWatcherFrontMatter(body) {
  const deps = { requiresMerged: [], requiresFilesOnMain: [] };
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (t === "") continue;
    const directive = parseWatcherDirective(t);
    if (!directive) break;
    const { key, value } = directive;
    if (key === "requires-merged") {
      for (const part of value.split(",")) {
        const n = Number(part.trim());
        if (Number.isInteger(n) && n > 0) deps.requiresMerged.push(n);
      }
    } else if (key === "requires-file-on-main") {
      deps.requiresFilesOnMain.push(value.trim());
    }
    // Unknown watcher keys are ignored (forward-compat).
  }
  return deps;
}

// Returns a list of human-readable unmet-dependency reasons (empty = go).
// A gh/git error counts as unmet — fail closed, re-check next rescan.
async function unmetDependencies(deps) {
  const unmet = [];
  for (const n of deps.requiresMerged) {
    try {
      const data = await runGh(["pr", "view", String(n), "--json", "state"], { json: true });
      if (data.state !== "MERGED") unmet.push(`PR #${n} is ${data.state} (needs MERGED)`);
    } catch (err) {
      unmet.push(`PR #${n} state check failed: ${err.message}`);
    }
  }
  if (deps.requiresFilesOnMain.length > 0) {
    try {
      await runGit(["fetch", "origin", "main"]);
    } catch (err) {
      log("deps", `git fetch failed (${err.message}) — checking against last-fetched origin/main`);
    }
    for (const file of deps.requiresFilesOnMain) {
      try {
        await runGit(["cat-file", "-e", `origin/main:${file}`]);
      } catch {
        unmet.push(`file "${file}" not on origin/main`);
      }
    }
  }
  return unmet;
}

// --- Heartbeat ---

let heartbeatTimer = null;

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

async function appendHeartbeatLine(line) {
  try {
    let lines = [];
    try {
      lines = (await readFile(HEARTBEAT_FILE, "utf-8")).split(/\r?\n/).filter(Boolean);
    } catch {
      // no heartbeat file yet
    }
    lines.push(line);
    if (lines.length > HEARTBEAT_MAX_LINES) lines = lines.slice(-HEARTBEAT_MAX_LINES);
    await writeFile(HEARTBEAT_FILE, lines.join("\n") + "\n", "utf-8");
  } catch (err) {
    log("heartbeat", `write failed: ${err.message}`);
  }
}

function startHeartbeat(name, getLastLine, onRunTimeout) {
  stopHeartbeat();
  const startedMs = Date.now();
  let tripped = false;
  heartbeatTimer = setInterval(async () => {
    const elapsedMs = Date.now() - startedMs;
    const elapsedSec = Math.round(elapsedMs / 1000);
    const snippet = (getLastLine() ?? "").slice(0, 160);
    await appendHeartbeatLine(`[${ts()}] ${name} elapsed=${elapsedSec}s last: ${snippet}`);
    if (!tripped && isRunTimedOut(elapsedMs, RUN_TIMEOUT_MS)) {
      tripped = true;
      const capMin = RUN_TIMEOUT_MS / 60000;
      const msg = `[run-timeout] ${name} exceeded ${capMin} min (elapsed=${elapsedSec}s) — killing child + quarantining`;
      log("run-timeout", `${name} exceeded ${capMin} min (elapsed=${elapsedSec}s) — killing child + quarantining`);
      await appendHeartbeatLine(`[${ts()}] ${msg}`);
      if (onRunTimeout) {
        try {
          onRunTimeout();
        } catch (err) {
          log("run-timeout", `handler error: ${err.message}`);
        }
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
}

// --- Policy auto-merge helpers ---

// tests-docs policy: the diff must touch ONLY tests/** and/or docs/**, and
// must not contain migration files.
export function classifyPolicyFiles(files) {
  const paths = (files ?? []).map((f) => (typeof f === "string" ? f : f.path));
  if (paths.length === 0) return { ok: false, reason: "empty diff" };
  const migration = paths.find((p) => /(^|\/)migrations\//.test(p));
  if (migration) return { ok: false, reason: `migration file: ${migration}` };
  const outside = paths.find((p) => !/^(tests|docs)\//.test(p));
  if (outside) return { ok: false, reason: `outside tests/ or docs/: ${outside}` };
  return { ok: true };
}

// The reviewer writes docs/pr-reviews/pr-{N}-review.md with the verdict on
// the first line: "VERDICT: MERGE" (or FIX / BLOCK). Only MERGE approves.
async function verdictApproves(prNumber) {
  const verdictPath = path.join(REPO_ROOT, "docs", "pr-reviews", `pr-${prNumber}-review.md`);
  try {
    const content = await readFile(verdictPath, "utf-8");
    return /^VERDICT:\s*MERGE\b/m.test(content);
  } catch {
    return false;
  }
}

// --- Failure quarantine ---

// Write docs/pr-prompts/failed/{name}.report.md: last 50 lines of agent
// output, PR number (if one opened), and `gh pr checks` output.
async function writeQuarantineReport(name, agentOutput, prNumber) {
  const tailLines = agentOutput.split(/\r?\n/).filter((l) => l.trim()).slice(-50);
  let checksSection = "(no PR number detected — no checks to report)";
  if (prNumber != null) {
    try {
      const out = await runGh(["pr", "checks", String(prNumber)], { allowNonZero: true });
      checksSection = out.trim() || "(gh pr checks returned no output)";
    } catch (err) {
      checksSection = `gh pr checks failed: ${err.message}`;
    }
  }
  const report = [
    `# Quarantine report — ${name}`,
    "",
    `Written: ${ts()}`,
    `PR: ${prNumber != null ? `#${prNumber}` : "(none detected in agent output)"}`,
    `Retries used: ${retryCounts.get(name) ?? 0}`,
    "",
    "## Check status (`gh pr checks`)",
    "",
    "```",
    checksSection,
    "```",
    "",
    "## Last 50 lines of agent output",
    "",
    "```",
    ...tailLines,
    "```",
    "",
  ].join("\n");
  try {
    await writeFile(path.join(FAILED_DIR, `${name}.report.md`), report, "utf-8");
    log("quarantine", `report written: failed/${name}.report.md`);
  } catch (err) {
    log("error", `quarantine report write failed: ${err.message}`);
  }
}

// ONE automatic retry when the failure looks transient. Returns true when
// the prompt was re-queued (file stays in docs/pr-prompts/).
function maybeRetryTransient(name, matchText) {
  const count = retryCounts.get(name) ?? 0;
  if (count >= 1) return false;
  if (!isTransientFailure(matchText)) return false;
  retryCounts.set(name, count + 1);
  log("retry", `${name}: transient failure signature matched — retrying once (attempt 2)`);
  seen.delete(name);
  enqueue(name, { source: "transient-retry" });
  return true;
}

// Extract a PR number from the agent's combined stdout/stderr output.
function extractPrNumber(text) {
  const urlMatch = text.match(/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/);
  if (urlMatch) return Number(urlMatch[1]);
  const hashMatch = text.match(/(?:PR|pr|pull request)\s*#(\d+)/);
  if (hashMatch) return Number(hashMatch[1]);
  return null;
}

// Enable auto-merge, then poll until merged or failure.
async function waitForMerge(prNumber, promptName) {
  try {
    log("merge", `enabling auto-merge on PR #${prNumber}`);
    await runGh(["pr", "merge", String(prNumber), "--auto", "--squash", "--delete-branch"]);
  } catch (err) {
    log("merge", `auto-merge enable failed for PR #${prNumber}: ${err.message}`);
    // Continue anyway — the PR may merge if the user/CI handles it.
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < MERGE_TIMEOUT_MS) {
    let data;
    try {
      data = await runGh(
        ["pr", "view", String(prNumber), "--json", "state,statusCheckRollup,mergedAt"],
        { json: true },
      );
    } catch (err) {
      log("merge", `gh pr view failed: ${err.message} — retrying in ${POLL_INTERVAL_MS / 1000}s`);
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (data.state === "MERGED") {
      log("merge", `PR #${prNumber} merged at ${data.mergedAt}`);
      return { ok: true };
    }
    if (data.state === "CLOSED") {
      return { ok: false, reason: "closed-without-merge" };
    }

    const checks = data.statusCheckRollup ?? [];
    const failed = checks.find(
      (c) => c.conclusion === "FAILURE" || c.conclusion === "CANCELLED" || c.conclusion === "TIMED_OUT",
    );
    if (failed) {
      return {
        ok: false,
        reason: `ci-${failed.conclusion.toLowerCase()}`,
        check: failed.name ?? "(unknown)",
      };
    }

    await sleep(POLL_INTERVAL_MS);
  }

  return { ok: false, reason: "timeout" };
}

// tests-docs policy merge loop. Returns:
//   { ok: true }                          — merged
//   { ok: false, marco: true, reason }    — doesn't qualify / timed out → Marco
//   { ok: false, ci: true, reason, check }— CI red → quarantine path
//   { ok: false, reason }                 — closed without merge
async function waitForPolicyMerge(prNumber) {
  // Static gate first: a diff outside tests/** + docs/** (or containing
  // migrations) never qualifies — hand to Marco immediately, no waiting.
  let filesData;
  try {
    filesData = await runGh(["pr", "view", String(prNumber), "--json", "files"], { json: true });
  } catch (err) {
    return { ok: false, marco: true, reason: `files query failed: ${err.message}` };
  }
  const cls = classifyPolicyFiles(filesData.files ?? []);
  if (!cls.ok) {
    return { ok: false, marco: true, reason: cls.reason };
  }

  const startedAt = Date.now();
  let mergeEnabled = false;
  while (Date.now() - startedAt < MERGE_TIMEOUT_MS) {
    let data;
    try {
      data = await runGh(
        ["pr", "view", String(prNumber), "--json", "state,statusCheckRollup,mergedAt"],
        { json: true },
      );
    } catch (err) {
      log("merge", `gh pr view failed: ${err.message} — retrying in ${POLL_INTERVAL_MS / 1000}s`);
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    if (data.state === "MERGED") {
      log("merge", `PR #${prNumber} merged at ${data.mergedAt} (policy: tests-docs)`);
      return { ok: true };
    }
    if (data.state === "CLOSED") {
      return { ok: false, reason: "closed-without-merge" };
    }

    const checks = data.statusCheckRollup ?? [];
    const failed = checks.find(
      (c) => c.conclusion === "FAILURE" || c.conclusion === "CANCELLED" || c.conclusion === "TIMED_OUT",
    );
    if (failed) {
      return {
        ok: false,
        ci: true,
        reason: `ci-${failed.conclusion.toLowerCase()}`,
        check: failed.name ?? "(unknown)",
      };
    }

    const allGreen =
      checks.length > 0 &&
      checks.every((c) => ["SUCCESS", "NEUTRAL", "SKIPPED"].includes(c.conclusion));

    if (!mergeEnabled && allGreen && (await verdictApproves(prNumber))) {
      if (DRY_RUN) {
        log("dry-run", `PR #${prNumber}: all tests-docs conditions met — would enable auto-merge`);
        return { ok: false, marco: true, reason: "dry-run: auto-merge not executed" };
      }
      try {
        log("merge", `PR #${prNumber}: tests-docs policy satisfied — enabling auto-merge`);
        await runGh(["pr", "merge", String(prNumber), "--auto", "--squash", "--delete-branch"]);
        mergeEnabled = true;
      } catch (err) {
        log("merge", `auto-merge enable failed for PR #${prNumber}: ${err.message}`);
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }

  return {
    ok: false,
    marco: true,
    reason: mergeEnabled
      ? "timeout after auto-merge enabled"
      : "timeout waiting for green checks + MERGE verdict",
  };
}

// Move all queued + on-disk -ready.md files into paused/.
async function pauseQueue(reason) {
  queuePaused = true;
  log("PAUSE", `queue paused: ${reason}`);

  // Move in-memory queue
  const drainable = queue.splice(0);
  for (const filePath of drainable) {
    const name = path.basename(filePath);
    try {
      await rename(filePath, path.join(PAUSED_DIR, name));
      log("PAUSE", `moved ${name} → paused/`);
    } catch (err) {
      log("PAUSE", `could not move ${name}: ${err.message}`);
    }
    seen.delete(name);
  }

  // Also move any -ready.md files still on disk at the top level
  try {
    const entries = await readdir(PROMPT_DIR);
    for (const name of entries) {
      if (isReady(name)) {
        await rename(path.join(PROMPT_DIR, name), path.join(PAUSED_DIR, name));
        log("PAUSE", `moved ${name} → paused/ (disk scan)`);
      }
    }
  } catch (err) {
    log("PAUSE", `disk scan failed: ${err.message}`);
  }

  // Write a SUMMARY in paused/
  const summary = `Queue paused at ${ts()}\nReason: ${reason}\n\nAll remaining -ready.md files were moved here. After you've fixed the upstream issue (re-run the failed prompt, roll back main, etc.), move the prompts back to docs/pr-prompts/ to resume.\n`;
  await writeFile(path.join(PAUSED_DIR, "PAUSED_SUMMARY.md"), summary);
}

// Pull main locally so the next prompt sees the merged commit.
async function syncMain() {
  try {
    log("sync", "git fetch + git checkout main + git pull");
    await runGh(["repo", "view", "--json", "name"], { json: true }); // sanity — confirm gh works
    // Use plain git via spawn (gh doesn't pull)
    await new Promise((resolve, reject) => {
      const child = spawn("git", ["fetch", "origin"], { cwd: REPO_ROOT, shell: true });
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`git fetch ${code}`))));
    });
    await new Promise((resolve, reject) => {
      const child = spawn("git", ["checkout", "main"], { cwd: REPO_ROOT, shell: true });
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`git checkout main ${code}`))));
    });
    await new Promise((resolve, reject) => {
      const child = spawn("git", ["pull"], { cwd: REPO_ROOT, shell: true });
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`git pull ${code}`))));
    });
    log("sync", "main is up to date");
  } catch (err) {
    log("sync", `failed: ${err.message}`);
    throw err;
  }
}

// --- Lockfile helpers ---

// Read the command line for a PID. Returns "" if it cannot be determined
// (assume the worst → caller treats as "matches" to fail safe).
function readProcessCommandLine(pid) {
  try {
    if (process.platform === "win32") {
      const out = execFileSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
        ],
        { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
      );
      return out.trim();
    }
    const out = execFileSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim();
  } catch {
    return "";
  }
}

function isWatcherNodeProcess(pid) {
  const cmd = readProcessCommandLine(pid);
  if (!cmd) return true; // fail safe — assume it IS a watcher
  // Match `node ... pr-watcher/index.mjs` or `node ... pr-watcher\index.mjs`.
  return /node/i.test(cmd) && /pr-watcher[\\/]index\.mjs/i.test(cmd);
}

async function acquireLock() {
  if (existsSync(LOCK_FILE)) {
    let pid = null;
    try {
      const content = await readFile(LOCK_FILE, "utf-8");
      pid = Number(content.trim());
    } catch {
      // unreadable lockfile — treat as stale
    }
    if (pid && !Number.isNaN(pid)) {
      let alive = false;
      try {
        process.kill(pid, 0);
        alive = true;
      } catch {
        // ESRCH = process does not exist (stale lockfile)
      }
      if (alive) {
        if (isWatcherNodeProcess(pid)) {
          log("WARN", `another watcher instance is running (PID ${pid}, node + pr-watcher/index.mjs). Exiting cleanly to avoid queue conflicts.`);
          process.exit(0);
        }
        log("watcher", `lockfile PID ${pid} is alive but is NOT a watcher process — overwriting`);
      } else {
        log("watcher", `stale lockfile (PID ${pid} not found) — overwriting`);
      }
    }
  }
  await writeFile(LOCK_FILE, String(process.pid), "utf-8");
}

function releaseLock() {
  try {
    unlinkSync(LOCK_FILE);
  } catch {
    // best-effort
  }
}

// --- Child-process reaper ---
//
// SAFETY (LL-33): the watcher only ever kills PIDs it spawned ITSELF and
// recorded in CHILDREN_FILE. It never enumerates `claude` processes by name
// and never calls taskkill /IM claude.exe — Marco's interactive Claude Code
// and Cowork sessions must never be killed by the watcher.

async function readTrackedChildren() {
  try {
    const raw = await readFile(CHILDREN_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data.pids)) {
      return data.pids.filter((n) => typeof n === "number" && n > 0);
    }
  } catch {
    // missing / unreadable / unparsable → empty list
  }
  return [];
}

async function writeTrackedChildren(pids) {
  try {
    await writeFile(CHILDREN_FILE, JSON.stringify({ pids }, null, 2), "utf-8");
  } catch (err) {
    log("reaper", `could not write children file: ${err.message}`);
  }
}

async function recordChildPid(pid) {
  const pids = await readTrackedChildren();
  if (!pids.includes(pid)) pids.push(pid);
  await writeTrackedChildren(pids);
}

async function removeChildPid(pid) {
  const pids = (await readTrackedChildren()).filter((p) => p !== pid);
  await writeTrackedChildren(pids);
}

// Kill ONE specific PID and its whole process tree. Safe: only call with a
// PID we recorded as one of OUR spawned children.
function killProcessTree(pid) {
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: ["ignore", "ignore", "ignore"],
      });
    } else {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        process.kill(pid, "SIGTERM");
      }
    }
  } catch {
    // already gone / not ours anymore — best-effort
  }
}

// On startup, kill the SPECIFIC PIDs the previous watcher run left behind.
// Only PIDs in CHILDREN_FILE — never enumerate claude.exe by name.
async function reapPreviousChildren() {
  const pids = await readTrackedChildren();
  if (pids.length === 0) return;
  log("reaper", `previous watcher run left ${pids.length} tracked child PID(s): ${pids.join(", ")}`);
  for (const pid of pids) {
    let alive = false;
    try {
      process.kill(pid, 0);
      alive = true;
    } catch {
      // dead already
    }
    if (alive) {
      log("reaper", `killing leftover child PID ${pid} (+ process tree)`);
      killProcessTree(pid);
    } else {
      log("reaper", `tracked PID ${pid} already gone`);
    }
  }
  await writeTrackedChildren([]);
}

// Reference to the currently-running spawned child (or null). Updated by the
// drain loop and read by shutdown handlers.
let currentChild = null;

function killCurrentChildTree() {
  if (currentChild && currentChild.pid) {
    log("reaper", `terminating current child PID ${currentChild.pid} (+ tree) before exit`);
    killProcessTree(currentChild.pid);
  }
}

// --- Reviewed-set helpers (auto-review) ---

async function loadReviewedSet() {
  const set = new Set();
  try {
    const raw = await readFile(REVIEWED_STATE_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data.reviewed)) {
      for (const n of data.reviewed) {
        if (typeof n === "number") set.add(n);
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      log("review", `warning: could not load reviewed-set (${err.message}) — starting empty`);
    }
  }
  return set;
}

async function saveReviewedSet(set) {
  const tmp = REVIEWED_STATE_FILE + ".tmp";
  const data = JSON.stringify({ reviewed: [...set].sort((a, b) => a - b) }, null, 2);
  try {
    await writeFile(tmp, data, "utf-8");
    await rename(tmp, REVIEWED_STATE_FILE);
  } catch (err) {
    // Retry once — Windows can intermittently throw EPERM on same-volume rename
    log("review", `state save failed (${err.message}), retrying...`);
    try {
      await writeFile(tmp, data, "utf-8");
      await rename(tmp, REVIEWED_STATE_FILE);
    } catch (err2) {
      log("review", `state save failed again (${err2.message}) — continuing (worst case: duplicate review next tick)`);
    }
  }
}

// On first enable, seed the reviewed-set with all recent PRs so we never
// auto-review historical work. Only PRs that appear AFTER this point get
// a review prompt written for them.
async function seedReviewedSet(set) {
  log("review", "seeding reviewed-set with recent PRs (open + merged, limit 50)...");
  try {
    const prs = await runGh(
      ["pr", "list", "--state", "all", "--limit", "50", "--json", "number"],
      { json: true },
    );
    for (const pr of prs) {
      set.add(pr.number);
    }
    log("review", `reviewed-set seeded with ${set.size} PR(s) — only new PRs will be auto-reviewed`);
  } catch (err) {
    log("review", `warning: seed failed (${err.message}) — continuing without seed (may review historical PRs)`);
  }
  await saveReviewedSet(set);
  return set;
}

// Render the review prompt template, replacing {{PR_NUMBER}} and {{PR_TITLE}}.
function renderTemplate(template, prNumber, prTitle) {
  return template
    .replaceAll("{{PR_NUMBER}}", String(prNumber))
    .replaceAll("{{PR_TITLE}}", prTitle);
}

let reviewTemplate = null;
const REVIEW_TEMPLATE_FILE = path.join(__dirname, "review-prompt-template.md");

async function loadReviewTemplate() {
  try {
    reviewTemplate = await readFile(REVIEW_TEMPLATE_FILE, "utf-8");
    return true;
  } catch (err) {
    log("review", `warning: could not load review template (${err.message}) — auto-review disabled`);
    return false;
  }
}

// Poll GitHub for newly-opened PRs and write a review prompt for each.
// This function only WRITES files — the normal queue drain handles execution.
let reviewedSet = null;

async function pollForNewPrs() {
  if (queuePaused) return;
  let prs;
  try {
    prs = await runGh(
      ["pr", "list", "--state", "open", "--json", "number,title,isDraft,createdAt,baseRefName"],
      { json: true },
    );
  } catch (err) {
    log("review", `poll failed: ${err.message} — will retry next tick`);
    return;
  }

  const now = Date.now();
  for (const pr of prs) {
    if (pr.isDraft) continue;
    if (pr.baseRefName !== "main") continue;
    if (reviewedSet.has(pr.number)) continue;
    const age = now - new Date(pr.createdAt).getTime();
    if (age < REVIEW_MIN_AGE_MS) continue; // grace period — authoring agent may still be finishing

    const promptName = `rev-${pr.number}-ready.md`;
    if (DRY_RUN) {
      log("dry-run", `would write review prompt ${promptName} for PR #${pr.number} ("${pr.title}")`);
      continue;
    }
    const promptPath = path.join(PROMPT_DIR, promptName);
    const body = renderTemplate(reviewTemplate, pr.number, pr.title);
    try {
      await writeFile(promptPath, body, "utf-8");
    } catch (err) {
      log("review", `could not write prompt for PR #${pr.number}: ${err.message}`);
      continue;
    }
    reviewedSet.add(pr.number);
    await saveReviewedSet(reviewedSet);
    log("review", `enqueued review for PR #${pr.number} ("${pr.title}") → ${promptName}`);
  }
}

// Auto-update-branch: bring our own open PRs that fell BEHIND main up to
// date. Conflicting PRs (mergeStateStatus DIRTY) are skipped — update-branch
// can't resolve conflicts; those need a human rebase.
async function pollForBehindPrs() {
  if (queuePaused) return;
  let prs;
  try {
    prs = await runGh(
      ["pr", "list", "--author", "@me", "--state", "open", "--json", "number,title,mergeStateStatus"],
      { json: true },
    );
  } catch (err) {
    log("update", `poll failed: ${err.message} — will retry next tick`);
    return;
  }
  for (const pr of prs) {
    if (pr.mergeStateStatus === "DIRTY") {
      log("update", `PR #${pr.number} has conflicts — skipping update-branch`);
      continue;
    }
    if (pr.mergeStateStatus !== "BEHIND") continue;
    if (DRY_RUN) {
      log("dry-run", `PR #${pr.number} is BEHIND — would run gh pr update-branch ${pr.number}`);
      continue;
    }
    try {
      await runGh(["pr", "update-branch", String(pr.number)]);
      log("update", `PR #${pr.number} branch updated (was BEHIND)`);
    } catch (err) {
      log("update", `update-branch failed for PR #${pr.number}: ${err.message}`);
    }
  }
}

async function drain() {
  if (running || queue.length === 0 || queuePaused) return;

  // Nightly cutoff — refuse to start a new prompt past STOP_AT. The
  // in-flight prompt (if any, called from inside an existing session) is
  // unaffected; this is purely a gate before pulling the next one.
  if (isPastStopTime()) {
    log("STOP_AT", `past cutoff ${STOP_AT}, ${queue.length} prompt(s) left in queue`);
    log("STOP_AT", "queued prompts stay in docs/pr-prompts/ — next run will pick them up");
    process.exit(0);
  }

  running = true;
  await sweepOrphanWorktrees();
  const filePath = queue.shift();
  const name = path.basename(filePath);

  let promptBody;
  try {
    promptBody = await readFile(filePath, "utf-8");
  } catch (err) {
    log("error", `could not read ${name}: ${err.message}`);
    seen.delete(name);
    running = false;
    drain();
    return;
  }

  // Dependency gating: unmet front-matter dependencies defer the prompt.
  // The file is NOT consumed — it leaves `seen` so the periodic rescan
  // re-checks it on the next walk.
  const deps = parseWatcherFrontMatter(promptBody);
  if (deps.requiresMerged.length > 0 || deps.requiresFilesOnMain.length > 0) {
    const unmet = await unmetDependencies(deps);
    if (unmet.length > 0) {
      log("deps", `${name} deferred: ${unmet.join("; ")} — re-check next rescan`);
      seen.delete(name);
      running = false;
      drain();
      return;
    }
    log("deps", `${name}: all dependencies met (merged: [${deps.requiresMerged.join(", ")}], files: ${deps.requiresFilesOnMain.length})`);
  }

  if (DRY_RUN) {
    log("dry-run", `${name}: would run ${CLAUDE_BIN} --print --max-turns ${MAX_TURNS} (${promptBody.length} bytes); file NOT consumed`);
    // Keep `name` in `seen` so dry-run doesn't re-log the same prompt forever.
    running = false;
    drain();
    return;
  }

  log("start", `${name} (max-turns=${MAX_TURNS})`);
  const startedAt = ts();
  const chunks = [];
  let lastLine = "";

  const child = spawn(
    CLAUDE_BIN,
    [
      "--print",
      "--max-turns",
      String(MAX_TURNS),
      "--dangerously-skip-permissions",
      "--verbose",
    ],
    {
      cwd: REPO_ROOT,
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  currentChild = child;
  if (child.pid) {
    await recordChildPid(child.pid);
  }

  child.stdin.write(promptBody);
  child.stdin.end();

  const trackLastLine = (c) => {
    const lines = c.toString("utf-8").split(/\r?\n/).filter((l) => l.trim());
    if (lines.length > 0) lastLine = lines[lines.length - 1];
  };

  child.stdout.on("data", (c) => {
    process.stdout.write(c);
    chunks.push(c);
    trackLastLine(c);
  });
  child.stderr.on("data", (c) => {
    process.stderr.write(c);
    chunks.push(c);
    trackLastLine(c);
  });

  let runTimedOut = false;
  startHeartbeat(name, () => lastLine, () => {
    runTimedOut = true;
    // Reuse the existing safe kill path — never taskkill /IM (LL-33).
    killCurrentChildTree();
  });

  child.on("close", async (code) => {
    stopHeartbeat();
    if (child.pid) await removeChildPid(child.pid);
    if (currentChild === child) currentChild = null;
    const endedAt = ts();
    const agentOutput = Buffer.concat(chunks).toString("utf-8");
    const header = [
      `# ${name}`,
      `Started: ${startedAt}`,
      `Ended:   ${endedAt}`,
      `Exit:    ${code}`,
      "",
      "---",
      "",
    ].join("\n");
    let logBody = header + agentOutput;

    // Per-run wall-clock watchdog fired. Quarantine THIS prompt only and
    // keep draining the queue — a single hung run must not freeze the tail
    // (decoupled from pauseQueue, which is reserved for CI-red cascades).
    if (runTimedOut) {
      const capMin = RUN_TIMEOUT_MS / 60000;
      const dest = path.join(BLOCKED_DIR, name);
      const logDest = path.join(BLOCKED_DIR, `${name}.log`);
      const noteDest = path.join(BLOCKED_DIR, `${name}.run-timeout.md`);
      const note = [
        `# Run-timeout — ${name}`,
        ``,
        `Started: ${startedAt}`,
        `Killed:  ${endedAt}`,
        `Cap:     ${capMin} min (PR_WATCHER_RUN_TIMEOUT_MIN=${capMin})`,
        `Exit:    ${code}`,
        ``,
        `The watcher's per-run wall-clock watchdog fired: the spawned child`,
        `had not exited after ${capMin} minutes. The watcher killed the child`,
        `tree via killCurrentChildTree() and parked the prompt so the queue`,
        `keeps draining. Investigate before re-queuing.`,
        ``,
      ].join("\n");
      try {
        await rename(filePath, dest);
        await writeFile(logDest, logBody);
        await writeFile(noteDest, note, "utf-8");
        log("BLOCKED", `${name} → blocked/ (run-timeout after ${capMin} min)`);
      } catch (err) {
        log("error", `run-timeout move failed: ${err.message}`);
      }
      seen.delete(name);
      running = false;
      drain();
      return;
    }

    // Review job failures must not freeze the authoring pipeline.
    const reviewJob = isReviewJob(name);

    // Agent failed. Two failure shapes:
    //   (a) Usage / rate limit — transient, will recover. Keep prompt
    //       queued, write a soft-halt log next to it, exit watcher cleanly.
    //       On next start (after the limit resets), it gets picked up again.
    //   (b) Real failure — move to failed/ with the log. If auto-merge mode
    //       and NOT a review job, pause downstream; otherwise continue.
    if (code !== 0) {
      if (isUsageLimitError(agentOutput)) {
        // (a) Soft halt — usage/rate limit detected
        const softLogDest = path.join(PROMPT_DIR, `${name}.usage-limit.log`);
        try {
          await writeFile(softLogDest, logBody);
        } catch (err) {
          log("error", `could not write soft-halt log: ${err.message}`);
        }
        log("USAGE_LIMIT", `${name} hit a usage/rate limit (exit ${code})`);
        log("USAGE_LIMIT", `prompt left in docs/pr-prompts/ — restart watcher after limit resets`);
        log("USAGE_LIMIT", `soft-halt log: ${path.relative(REPO_ROOT, softLogDest)}`);
        seen.delete(name);
        running = false;
        // Exit code 2 = "soft halt, retry later" (distinct from 1 = real fail)
        process.exit(2);
      }

      // Transient failure? One automatic retry — prompt stays in place.
      if (maybeRetryTransient(name, agentOutput)) {
        running = false;
        drain();
        return;
      }

      // (b) Real failure — quarantine: move to failed/ with .log + report,
      // then either pause or continue
      const dest = path.join(FAILED_DIR, name);
      const logDest = path.join(FAILED_DIR, `${name}.log`);
      try {
        await rename(filePath, dest);
        await writeFile(logDest, logBody);
        log("FAIL", `${name} → failed/ (exit ${code})`);
      } catch (err) {
        log("error", `move failed: ${err.message}`);
      }
      await writeQuarantineReport(name, agentOutput, extractPrNumber(agentOutput));
      seen.delete(name);
      // Review job failures do not pause the authoring pipeline.
      if (AUTO_MERGE && !reviewJob) {
        await pauseQueue(`agent exited ${code} on ${name}`);
        running = false;
        return;
      }
      running = false;
      drain();
      return;
    }

    // Agent succeeded — review jobs mirror their verdict file into a PR
    // comment (remote-ops: readable from the GitHub mobile app). Restarting
    // the watcher mid-job can rarely re-run a review and post a duplicate
    // comment — accepted, simpler than tracking mirrored PRs in state.
    if (reviewJob) {
      await mirrorVerdictToPr(name);
    }

    // For review jobs skip the entire AUTO_MERGE block.
    // A review job's output mentions the PR it reviewed; running auto-merge
    // on that number would violate the manual-review gate.
    let mergeReport = "";
    if (AUTO_MERGE && !reviewJob) {
      const prNumber = extractPrNumber(agentOutput);
      if (prNumber == null) {
        // Agent exited 0 but never opened a PR. Treating this as success has
        // caused fully-specified prompts to silently vanish into processed/.
        // Route to no-pr-opened/ so a human can triage: legitimately no PR
        // needed vs. silent failure is a judgment call, not a heuristic.
        const reason =
          "WATCHER: agent exited 0 but no PR number was found in its output — " +
          "filed to no-pr-opened/ for manual review, NOT treated as success.";
        const dest = path.join(NO_PR_DIR, name);
        const logDest = path.join(NO_PR_DIR, `${name}.log`);
        try {
          await rename(filePath, dest);
          await writeFile(logDest, `${reason}\n\n${logBody}`);
          log("NO-PR", `${name} → no-pr-opened/ (agent exited 0 but no PR number found)`);
        } catch (err) {
          log("error", `move no-pr: ${err.message}`);
        }
        seen.delete(name);
        running = false;
        drain();
        return;
      } else {
        log("merge", `${name}: opened PR #${prNumber}, policy=${AUTO_MERGE_POLICY}, waiting…`);
        const result =
          AUTO_MERGE_POLICY === "tests-docs"
            ? await waitForPolicyMerge(prNumber)
            : await waitForMerge(prNumber, name);
        mergeReport = `\n\n---\n[watcher] merge result for PR #${prNumber}: ${JSON.stringify(result)}\n`;

        if (!result.ok && result.marco) {
          // tests-docs: PR doesn't qualify for auto-merge — leave it open for
          // Marco, file the prompt as processed (the agent's work succeeded).
          log("merge", `${name}: PR #${prNumber} stays for Marco (${result.reason})`);
        } else if (!result.ok && (result.ci || result.reason?.startsWith("ci-"))) {
          // CI landed red — failure quarantine (one transient retry first).
          let checksOut = "";
          try {
            checksOut = await runGh(["pr", "checks", String(prNumber)], { allowNonZero: true });
          } catch (err) {
            checksOut = err.message;
          }
          if (maybeRetryTransient(name, `${result.reason} ${result.check ?? ""}\n${checksOut}`)) {
            running = false;
            drain();
            return;
          }
          const dest = path.join(FAILED_DIR, name);
          const logDest = path.join(FAILED_DIR, `${name}.log`);
          try {
            await rename(filePath, dest);
            await writeFile(logDest, logBody + mergeReport);
            log("FAIL", `${name} → failed/ (PR #${prNumber} CI red: ${result.reason} on ${result.check ?? "?"})`);
          } catch (err) {
            log("error", `move failed: ${err.message}`);
          }
          await writeQuarantineReport(name, agentOutput, prNumber);
          seen.delete(name);
          await pauseQueue(`PR #${prNumber} CI red: ${result.reason}`);
          running = false;
          return;
        } else if (!result.ok) {
          // Timeout / closed-without-merge — move to blocked/ + pause downstream
          const dest = path.join(BLOCKED_DIR, name);
          const logDest = path.join(BLOCKED_DIR, `${name}.log`);
          try {
            await rename(filePath, dest);
            await writeFile(logDest, logBody + mergeReport);
            log("BLOCKED", `${name} → blocked/ (PR #${prNumber}: ${result.reason})`);
          } catch (err) {
            log("error", `move blocked: ${err.message}`);
          }
          seen.delete(name);
          await pauseQueue(`PR #${prNumber} blocked: ${result.reason}`);
          running = false;
          return;
        } else {
          // Merged — sync local main before next prompt
          try {
            await syncMain();
          } catch (err) {
            log("sync", `WARNING: main sync failed: ${err.message} — next prompt may run on stale base`);
          }
        }
      }
    }

    // Success path — move to processed/
    logBody = logBody + mergeReport;
    const dest = path.join(PROCESSED_DIR, name);
    const logDest = path.join(PROCESSED_DIR, `${name}.log`);
    try {
      await rename(filePath, dest);
      await writeFile(logDest, logBody);
      log("ok", `${name} → processed/`);
    } catch (err) {
      log("error", `move ok: ${err.message}`);
    }

    seen.delete(name);
    running = false;
    drain();
  });

  child.on("error", async (err) => {
    stopHeartbeat();
    if (child.pid) await removeChildPid(child.pid);
    if (currentChild === child) currentChild = null;
    log("error", `spawn failed: ${err.message}`);
    seen.delete(name);
    running = false;
    drain();
  });
}

async function scanExisting() {
  try {
    const entries = await readdir(PROMPT_DIR);
    for (const name of entries) {
      if (isReady(name)) enqueue(name, { source: "startup-scan" });
    }
  } catch (err) {
    log("error", `initial scan: ${err.message}`);
  }
}

// Periodic rescan — fallback for fs.watch events lost by the OS. Walks
// the watched directory and queues any -ready.md file not already seen.
// The `seen` Set covers both queued and in-flight prompts, so the dedupe
// in `enqueue` makes this safely idempotent.
async function rescan() {
  if (queuePaused) return;
  try {
    const entries = await readdir(PROMPT_DIR);
    for (const name of entries) {
      if (isReady(name) && !seen.has(name)) {
        enqueue(name, { source: "rescan" });
      }
    }
  } catch (err) {
    log("error", `rescan: ${err.message}`);
  }
}

// Informational scan for stray claude.exe processes. We do NOT auto-kill —
// Marco runs interactive Claude Code / Cowork sessions whose PIDs are
// indistinguishable from a leaked watcher child by image name alone. The
// only PIDs the watcher ever terminates are the ones it spawned itself and
// recorded in CHILDREN_FILE (reapPreviousChildren / killCurrentChildTree).
// This warning is purely informational: surface the count so Marco can
// decide whether to clean them up by hand.
// Sweep stray empty folders at repo root whose name is a literal Windows
// absolute path with collapsed backslashes — e.g. "C:ProjectOperations2docspr-reviews".
// These appear when an agent runs `mkdir C:\ProjectOperations2\docs\...` in bash
// (backslashes are escape chars, so the path collapses to one literal name).
// SAFETY: only matches names starting with "C:ProjectOperations2" AND only
// removes them when empty. Legitimate paths never start with "C:".
async function sweepMalformedLiteralPathDirs() {
  // Match the malformed-path family. The leading "C:" can survive as a
  // literal colon, get stripped entirely, or get encoded by Windows as a
  // Private Use Area codepoint (0xF03A) since ":" is reserved in NTFS
  // filenames. Allow any single non-alphanumeric char (or none) between
  // "C" and "ProjectOperations2".
  const MALFORMED = /^C[^A-Za-z0-9]?ProjectOperations2/;
  try {
    const entries = await readdir(REPO_ROOT);
    for (const name of entries) {
      if (!MALFORMED.test(name)) continue;
      const full = path.join(REPO_ROOT, name);
      try {
        const s = await stat(full);
        if (!s.isDirectory()) continue;
        const inner = await readdir(full);
        if (inner.length !== 0) {
          log("watcher", `sweep: skipping non-empty malformed dir "${name}" (${inner.length} entries)`);
          continue;
        }
        await rmdir(full);
        log("watcher", `sweep: removed empty malformed literal-path dir "${name}"`);
      } catch (err) {
        log("watcher", `sweep: could not inspect "${name}": ${err.message}`);
      }
    }
  } catch (err) {
    log("watcher", `sweep skipped: ${err.message}`);
  }
}

function warnOnOrphanClaudeProcesses() {
  if (process.platform !== "win32") return;
  try {
    const out = execFileSync(
      "tasklist",
      ["/FI", "IMAGENAME eq claude.exe", "/FO", "CSV", "/NH"],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const pids = [];
    for (const line of out.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const m = trimmed.match(/^"claude\.exe","(\d+)"/i);
      if (m) pids.push(Number(m[1]));
    }
    if (pids.length > 0) {
      log(
        "WARN",
        `found ${pids.length} claude.exe process(es) running (PIDs: ${pids.join(", ")}). These may be interactive sessions — NOT auto-killed. Inspect manually if you suspect leaks.`,
      );
    }
  } catch (err) {
    log("watcher", `orphan check skipped: ${err.message}`);
  }
}

async function main() {
  await acquireLock();
  await ensureDirs();
  log("watcher", `repo:        ${REPO_ROOT}`);
  log("watcher", `prompt-dir:  ${PROMPT_DIR}`);
  log("watcher", `watching     ${PROMPT_DIR}`);
  log("watcher", `pattern:     (pr|rev)-*-ready.md`);
  log("watcher", `claude:      ${CLAUDE_BIN}`);
  log("watcher", `gh:          ${GH_BIN}`);
  log("watcher", `max-turns:   ${MAX_TURNS}`);
  log("watcher", `merge-pol:   ${AUTO_MERGE_POLICY}`);
  log("watcher", `merge-tmout: ${MERGE_TIMEOUT_MS / 60000} min`);
  log("watcher", `run-tmout:   ${RUN_TIMEOUT_MS > 0 ? `${RUN_TIMEOUT_MS / 60000} min` : "OFF"}`);
  log("watcher", `poll-every:  ${POLL_INTERVAL_MS / 1000} s`);
  log("watcher", `rescan:      ${RESCAN_INTERVAL_MS / 60000} min`);
  log("watcher", `auto-review: ${AUTO_REVIEW ? "ON" : "OFF"}`);
  log("watcher", `auto-update: ${AUTO_UPDATE ? `ON (every ${UPDATE_POLL_INTERVAL_MS / 1000} s)` : "OFF"}`);
  log("watcher", `transient:   ${TRANSIENT_PATTERNS.length} retry signature(s)`);
  if (DRY_RUN) {
    log("watcher", `dry-run:     ON — no claude runs, no mutating gh calls, no file moves`);
  }
  if (STOP_AT_TIMESTAMP !== null) {
    const cutoffIso = new Date(STOP_AT_TIMESTAMP).toISOString();
    const minsFromNow = Math.round((STOP_AT_TIMESTAMP - Date.now()) / 60000);
    log("watcher", `stop-at:     ${STOP_AT} → ${cutoffIso} (~${minsFromNow} min from now)`);
  } else {
    log("watcher", `stop-at:     (none — runs until queue empty or SIGINT)`);
  }

  warnOnOrphanClaudeProcesses();
  await sweepMalformedLiteralPathDirs();
  await reapPreviousChildren();
  await sweepOrphanWorktrees();

  await scanExisting();

  const watcher = fsWatch(PROMPT_DIR, { persistent: true }, (event, name) => {
    if (!name) return;
    debouncedEnqueue(name);
  });

  watcher.on("error", (err) => log("error", `fs.watch: ${err.message}`));

  const rescanTimer = setInterval(rescan, RESCAN_INTERVAL_MS);

  // Auto-review: load template, seed reviewed-set, start poll loop
  let reviewPollTimer = null;
  if (AUTO_REVIEW) {
    const templateOk = await loadReviewTemplate();
    if (templateOk) {
      reviewedSet = await loadReviewedSet();
      reviewedSet = await seedReviewedSet(reviewedSet);
      reviewPollTimer = setInterval(pollForNewPrs, REVIEW_POLL_INTERVAL_MS);
      log("review", `poll-every:  ${REVIEW_POLL_INTERVAL_MS / 1000} s, min-age: ${REVIEW_MIN_AGE_MS / 60000} min`);
    }
  }

  // Auto-update-branch poll loop
  let updatePollTimer = null;
  if (AUTO_UPDATE) {
    updatePollTimer = setInterval(pollForBehindPrs, UPDATE_POLL_INTERVAL_MS);
    pollForBehindPrs(); // immediate first pass
  }

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log("watcher", `shutting down (${signal})`);
    clearInterval(rescanTimer);
    if (reviewPollTimer) clearInterval(reviewPollTimer);
    if (updatePollTimer) clearInterval(updatePollTimer);
    stopHeartbeat();
    try {
      watcher.close();
    } catch {
      // best-effort
    }
    killCurrentChildTree();
    releaseLock();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("exit", () => {
    // Last-ditch: only runs on a clean event-loop drain. We've usually
    // already gone through `shutdown(...)`, but if something called
    // process.exit() directly we still want to kill our tracked child.
    if (!shuttingDown) {
      killCurrentChildTree();
      releaseLock();
    }
  });
}

// Only start the daemon when executed directly. Importing this module (the
// unit-style logic tests do `await import(...)`) must NOT start a watcher.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
