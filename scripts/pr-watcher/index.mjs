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
// Usage:
//   node scripts/pr-watcher/index.mjs
//
// Convention:
//   - Cowork writes drafts as docs/pr-prompts/pr-NN-{slug}.md
//   - You opt in by renaming to docs/pr-prompts/pr-NN-{slug}-ready.md
//   - The watcher fires, runs the prompt, then moves the file out

import { spawn } from "node:child_process";
import { existsSync, watch as fsWatch } from "node:fs";
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

const READY_PATTERN = /^pr-.*-ready\.md$/i;
const DEBOUNCE_MS = 800;

// Safety caps — tweak via env
const MAX_TURNS = Number(process.env.PR_WATCHER_MAX_TURNS ?? 120);
const CLAUDE_BIN = process.env.PR_WATCHER_CLAUDE_BIN ?? "claude";
const GH_BIN = process.env.PR_WATCHER_GH_BIN ?? "gh";

// Auto-merge polling
const AUTO_MERGE = process.env.PR_WATCHER_AUTO_MERGE !== "false"; // default ON
const MERGE_TIMEOUT_MS =
  Number(process.env.PR_WATCHER_MERGE_TIMEOUT_MIN ?? 90) * 60 * 1000;
const POLL_INTERVAL_MS =
  Number(process.env.PR_WATCHER_POLL_INTERVAL_SEC ?? 60) * 1000;

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

function enqueue(name) {
  const filePath = path.join(PROMPT_DIR, name);
  if (!existsSync(filePath)) return;
  if (seen.has(name)) return;
  seen.add(name);
  queue.push(filePath);
  log("queue", `${name} (depth: ${queue.length}${running ? ", busy" : ""})`);
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

async function drain() {
  if (running || queue.length === 0 || queuePaused) return;
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

    // Agent failed outright — move to failed/.
    // Pause downstream ONLY if auto-merge is on (sequential dependency mode).
    // In review-only mode (auto-merge off), prompts are independent → continue.
    if (code !== 0) {
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
      if (AUTO_MERGE) {
        await pauseQueue(`agent exited ${code} on ${name}`);
        running = false;
        return;
      }
      running = false;
      drain();
      return;
    }

    // Agent succeeded — try to extract PR number and wait for merge
    let mergeReport = "";
    if (AUTO_MERGE) {
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
      if (isReady(name)) enqueue(name);
    }
  } catch (err) {
    log("error", `initial scan: ${err.message}`);
  }
}

(async () => {
  await ensureDirs();
  log("watcher", `repo:        ${REPO_ROOT}`);
  log("watcher", `watching     ${PROMPT_DIR}`);
  log("watcher", `pattern:     pr-*-ready.md`);
  log("watcher", `claude:      ${CLAUDE_BIN}`);
  log("watcher", `gh:          ${GH_BIN}`);
  log("watcher", `max-turns:   ${MAX_TURNS}`);
  log("watcher", `auto-merge:  ${AUTO_MERGE ? "ON" : "OFF"}`);
  log("watcher", `merge-tmout: ${MERGE_TIMEOUT_MS / 60000} min`);
  log("watcher", `poll-every:  ${POLL_INTERVAL_MS / 1000} s`);

  await scanExisting();

  const watcher = fsWatch(PROMPT_DIR, { persistent: true }, (event, name) => {
    if (!name) return;
    debouncedEnqueue(name);
  });

  watcher.on("error", (err) => log("error", `fs.watch: ${err.message}`));

  process.on("SIGINT", () => {
    log("watcher", "shutting down (SIGINT)");
    watcher.close();
    process.exit(0);
  });
})();
