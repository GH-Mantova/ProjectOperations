#!/usr/bin/env node
// PR-prompt watcher daemon — zero external dependencies.
//
// Watches docs/pr-prompts/*-ready.md and feeds each one to a headless Claude
// Code session. Single-threaded queue. On completion, moves the prompt to
// processed/ (success) or failed/ (non-zero exit) with a sibling .log file.
//
// Usage:
//   node scripts/pr-watcher/index.mjs
//
// Convention:
//   - Cowork (or you) writes drafts as docs/pr-prompts/pr-NN-{slug}.md
//   - You opt in by renaming to docs/pr-prompts/pr-NN-{slug}-ready.md
//   - The watcher fires, runs the prompt, then moves the file out

import { spawn } from "node:child_process";
import { existsSync, watch as fsWatch } from "node:fs";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const PROMPT_DIR = path.join(REPO_ROOT, "docs", "pr-prompts");
const PROCESSED_DIR = path.join(PROMPT_DIR, "processed");
const FAILED_DIR = path.join(PROMPT_DIR, "failed");

const READY_PATTERN = /^pr-.*-ready\.md$/i;
const DEBOUNCE_MS = 800;

// Safety caps — tweak via env
const MAX_TURNS = Number(process.env.PR_WATCHER_MAX_TURNS ?? 120);
const CLAUDE_BIN = process.env.PR_WATCHER_CLAUDE_BIN ?? "claude";

const queue = [];
const seen = new Set(); // names currently queued or running
const debouncers = new Map(); // name -> timer
let running = false;

function ts() {
  return new Date().toISOString();
}
function log(level, msg) {
  console.log(`[${ts()}] [${level}] ${msg}`);
}

async function ensureDirs() {
  await mkdir(PROCESSED_DIR, { recursive: true });
  await mkdir(FAILED_DIR, { recursive: true });
}

function isReady(name) {
  return READY_PATTERN.test(name);
}

function debouncedEnqueue(name) {
  if (!isReady(name)) return;
  if (debouncers.has(name)) clearTimeout(debouncers.get(name));
  const timer = setTimeout(() => {
    debouncers.delete(name);
    enqueue(name);
  }, DEBOUNCE_MS);
  debouncers.set(name, timer);
}

function enqueue(name) {
  const filePath = path.join(PROMPT_DIR, name);
  if (!existsSync(filePath)) return; // file was deleted before debounce fired
  if (seen.has(name)) return;
  seen.add(name);
  queue.push(filePath);
  log("queue", `${name} (depth: ${queue.length}${running ? ", busy" : ""})`);
  drain();
}

async function drain() {
  if (running || queue.length === 0) return;
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

  // Prompt via stdin (avoids Windows arg-length limits).
  // --print is the non-interactive headless mode that exits when done.
  // --dangerously-skip-permissions is required for unattended runs —
  // otherwise the CLI waits forever for tool-call approvals.
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
      shell: true, // needed on Windows to find claude.cmd
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
    const header = [
      `# ${name}`,
      `Started: ${startedAt}`,
      `Ended:   ${endedAt}`,
      `Exit:    ${code}`,
      "",
      "---",
      "",
    ].join("\n");
    const logBody = header + Buffer.concat(chunks).toString("utf-8");

    const destDir = code === 0 ? PROCESSED_DIR : FAILED_DIR;
    const dest = path.join(destDir, name);
    const logDest = path.join(destDir, `${name}.log`);

    try {
      await rename(filePath, dest);
      await writeFile(logDest, logBody);
      if (code === 0) log("ok", `${name} → processed/`);
      else log("FAIL", `${name} → failed/ (exit ${code})`);
    } catch (err) {
      log("error", `could not move ${name}: ${err.message}`);
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
  // Pick up any -ready files that already exist when the watcher starts.
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
  log("watcher", `repo:    ${REPO_ROOT}`);
  log("watcher", `watching ${PROMPT_DIR}`);
  log("watcher", `pattern: pr-*-ready.md`);
  log("watcher", `claude:  ${CLAUDE_BIN}`);
  log("watcher", `max-turns: ${MAX_TURNS}`);

  await scanExisting();

  const watcher = fsWatch(PROMPT_DIR, { persistent: true }, (event, name) => {
    if (!name) return; // rare null filename
    debouncedEnqueue(name);
  });

  watcher.on("error", (err) => log("error", `fs.watch: ${err.message}`));

  process.on("SIGINT", () => {
    log("watcher", "shutting down (SIGINT)");
    watcher.close();
    process.exit(0);
  });
})();
