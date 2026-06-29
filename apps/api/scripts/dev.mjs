#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const isWindows = process.platform === "win32";
const here = dirname(fileURLToPath(import.meta.url));
const nestCli = resolve(here, "..", "node_modules", "@nestjs", "cli", "bin", "nest.js");

const child = spawn(process.execPath, [nestCli, "start", "--watch"], {
  stdio: "inherit",
  windowsHide: false,
  detached: !isWindows,
});

let shuttingDown = false;

function killTreeWindows(rootPid) {
  const script = `function K($p){Get-CimInstance Win32_Process -Filter "ParentProcessId=$p" | ForEach-Object { K $_.ProcessId }; Stop-Process -Id $p -Force -ErrorAction SilentlyContinue}; K ${rootPid}`;
  spawnSync("powershell.exe", ["-NoProfile", "-Command", script], { stdio: "ignore" });
}

function killTree(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (isWindows) {
    killTreeWindows(process.pid);
  } else if (child.pid != null) {
    try {
      process.kill(-child.pid, signal);
    } catch {
      try { child.kill(signal); } catch { /* already gone */ }
    }
  }
}

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) {
  process.on(sig, () => killTree(sig === "SIGBREAK" ? "SIGTERM" : sig));
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error("[dev.mjs] failed to spawn nest:", err);
  process.exit(1);
});
