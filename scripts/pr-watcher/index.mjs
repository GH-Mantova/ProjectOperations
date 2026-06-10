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
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PROMPT_DIR = path.join(REPO_ROOT, "docs", "pr-prompts");
const PROCESSED_DIR = path.join(PROMPT_DIR, "processed");
const FAILED_DIR = path.join(PROMPT_DIR, "failed");
const BLOCKED_DIR = path.join(PROMPT_DIR, "blocked");
const PAUSED_DIR = path.join(PROMPT_DIR, "paused");

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

// Auto-merge polling — opt-in only. The review-gated workflow runs with this
// OFF. Enable with PR_WATCHER_AUTO_MERGE=true for unattended chain runs only.
const AUTO_MERGE = process.env.PR_WATCHER_AUTO_MERGE === "true"; // default OFF
const MERGE_TIMEOUT_MS =
  Number(process.env.PR_WATCHER_MERGE_TIMEOUT_MIN ?? 90) * 60 * 1000;
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

// Lockfile — prevents two watcher instances from fighting over the queue.
const LOCK_FILE = path.join(__dirname, ".watcher.lock");

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
}

function isReady(name) {
  return READY_PATTERN.test(name);
}

function isReviewJob(name) {
  // rev-NNN-ready.md (new convention) or legacy pr-NNN-auto-review-ready.md
  return /^rev-/i.test(name) || /-auto-review-ready\.md$/i.test(name);
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
    queue.push(filePath);
  }
  const tail = `depth: ${queue.length}${running ? ", busy" : ""}, source: ${source}`;
  log("queue", `${name} (${tail})`);
  drain();
}

// Run `gh` and return parsed JSON or raw stdout.
function runGh(args, { json = false } = {}) {
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
      if (code !== 0) {
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
        log("WARN", `another watcher instance appears to be running (PID ${pid}). Exiting to avoid queue conflicts.`);
        process.exit(0);
      }
      log("watcher", `stale lockfile (PID ${pid} not found) — overwriting`);
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

  log("start", `${name} (max-turns=${MAX_TURNS})`);
  const startedAt = ts();
  const chunks = [];

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

  child.stdin.write(promptBody);
  child.stdin.end();

  child.stdout.on("data", (c) => {
    process.stdout.write(c);
    chunks.push(c);
  });
  child.stderr.on("data", (c) => {
    process.stderr.write(c);
    chunks.push(c);
  });

  child.on("close", async (code) => {
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

      // (b) Real failure — move to failed/ and either pause or continue
      const dest = path.join(FAILED_DIR, name);
      const logDest = path.join(FAILED_DIR, `${name}.log`);
      try {
        await rename(filePath, dest);
        await writeFile(logDest, logBody);
        log("FAIL", `${name} → failed/ (exit ${code})`);
      } catch (err) {
        log("error", `move failed: ${err.message}`);
      }
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

    // Agent succeeded — for review jobs skip the entire AUTO_MERGE block.
    // A review job's output mentions the PR it reviewed; running auto-merge
    // on that number would violate the manual-review gate.
    let mergeReport = "";
    if (AUTO_MERGE && !reviewJob) {
      const prNumber = extractPrNumber(agentOutput);
      if (prNumber == null) {
        mergeReport = `\n\n---\n[watcher] no PR number found in agent output — skipping auto-merge\n`;
        log("merge", `${name}: no PR number in output, skipping auto-merge`);
      } else {
        log("merge", `${name}: opened PR #${prNumber}, waiting for merge…`);
        const result = await waitForMerge(prNumber, name);
        mergeReport = `\n\n---\n[watcher] merge result for PR #${prNumber}: ${JSON.stringify(result)}\n`;
        if (!result.ok) {
          // Move to blocked/ + pause downstream
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
        }
        // Merged — sync local main before next prompt
        try {
          await syncMain();
        } catch (err) {
          log("sync", `WARNING: main sync failed: ${err.message} — next prompt may run on stale base`);
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

  child.on("error", (err) => {
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

// Warn about claude.exe processes that survived a previous watcher run.
// Windows only — `tasklist` isn't on Linux/macOS. We don't auto-kill: the
// user may have intentionally-launched claude sessions that aren't ours.
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
      // CSV row: "claude.exe","12345","Console","1","45,000 K"
      const m = trimmed.match(/^"claude\.exe","(\d+)"/i);
      if (m) pids.push(Number(m[1]));
    }
    if (pids.length > 0) {
      log(
        "WARN",
        `Found ${pids.length} orphan claude.exe processes from previous watcher runs. PIDs: ${pids.join(", ")}. Run \`Get-Process claude | Stop-Process -Force\` to clean up.`,
      );
    }
  } catch (err) {
    // Most likely: tasklist returned no matches (it exits 0 with empty
    // output) or isn't on PATH. Either way, not fatal.
    log("watcher", `orphan check skipped: ${err.message}`);
  }
}

(async () => {
  await acquireLock();
  await ensureDirs();
  log("watcher", `repo:        ${REPO_ROOT}`);
  log("watcher", `watching     ${PROMPT_DIR}`);
  log("watcher", `pattern:     (pr|rev)-*-ready.md`);
  log("watcher", `claude:      ${CLAUDE_BIN}`);
  log("watcher", `gh:          ${GH_BIN}`);
  log("watcher", `max-turns:   ${MAX_TURNS}`);
  log("watcher", `auto-merge:  ${AUTO_MERGE ? "ON" : "OFF"}`);
  log("watcher", `merge-tmout: ${MERGE_TIMEOUT_MS / 60000} min`);
  log("watcher", `poll-every:  ${POLL_INTERVAL_MS / 1000} s`);
  log("watcher", `rescan:      ${RESCAN_INTERVAL_MS / 60000} min`);
  log("watcher", `auto-review: ${AUTO_REVIEW ? "ON" : "OFF"}`);
  if (STOP_AT_TIMESTAMP !== null) {
    const cutoffIso = new Date(STOP_AT_TIMESTAMP).toISOString();
    const minsFromNow = Math.round((STOP_AT_TIMESTAMP - Date.now()) / 60000);
    log("watcher", `stop-at:     ${STOP_AT} → ${cutoffIso} (~${minsFromNow} min from now)`);
  } else {
    log("watcher", `stop-at:     (none — runs until queue empty or SIGINT)`);
  }

  warnOnOrphanClaudeProcesses();

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

  process.on("SIGINT", () => {
    log("watcher", "shutting down (SIGINT)");
    clearInterval(rescanTimer);
    if (reviewPollTimer) clearInterval(reviewPollTimer);
    watcher.close();
    releaseLock();
    process.exit(0);
  });
})();
