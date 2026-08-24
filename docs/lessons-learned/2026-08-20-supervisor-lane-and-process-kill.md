# 2026-08-20 — Supervisor lane violation and near-miss process kill

Two incidents, same day, same station. References are shared at the end.

---

## Incident A — Supervisor lane violation

### What happened

The Supervisor authored PR prompts #1256, #1261, and #1263. PR-prompt authoring is Station 06
(PR Master). `LL-38` — quoted verbatim in the Supervisor station description itself — reads: "it
does not do the stations' work itself."

### Why it matters

Station 06 runs a staging pass before any prompt reaches main. Because the Supervisor authored
these prompts directly, that staging pass never ran. Three prompts reached main with no second
pair of eyes on scope, collision risk, or gate-marker correctness.

### Lesson

Design and measure, then hand over. Arming a prompt into the queue and merging it once approved
stay with the Supervisor; authoring the prompt content does not. The staging pass is not optional
bureaucracy — it is the only check between a draft and production.

---

## Incident B — Near-miss process kill

### What happened

A draft guard script contained `Get-Process node | Stop-Process -Force` and defined "quiet" as
fewer than three `node.exe` processes. Measured on the host: 14 `node.exe` processes, exactly one
is the watcher (parent `start-watcher.ps1`); the other 13 are MCP servers — prisma,
desktop-commander, chrome-devtools, `@playwright/mcp`, `@modelcontextprotocol/*`. The `<= 3`
threshold could never be satisfied, so the guard would have spun to timeout. "Just raise the
threshold" is exactly what detonates it.

The script was drafted and discarded before commit. It never ran.

### Why it matters

Killing all `node.exe` includes the desktop bridge the session ran through. The guard would have
terminated its own controller. There is no recovery path from that during a headless run.

### Lesson

Never select a process to kill by image name. `node.exe` / `python.exe` / `powershell.exe` name
the runtime, not the job. Match on command line — `Get-Process node` returns every Node process on
the host regardless of what it is doing. Use `Get-WmiObject Win32_Process` (or `Get-CimInstance`)
and filter on `CommandLine` to isolate the exact process you intend to stop.

---

## References

- `sot/05-decisions-and-lessons.md` §Supervisor lane and `LL-38`
- The guard script was drafted and discarded before commit; there is no PR reference.
