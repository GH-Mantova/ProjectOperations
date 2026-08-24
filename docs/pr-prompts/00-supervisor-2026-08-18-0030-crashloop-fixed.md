# 00-supervisor — 2026-08-17T14:30Z (2026-08-18 00:30 Brisbane)

**FIXED: the exit -1 crash loop. Root-caused, repaired, read back, and PR'd (#1162).**

## Root cause — the full chain

1. `watcher-launcher.ps1` opens a PowerShell transcript on `watcher-launch.log` with `-Append` and
   **no rotation**. It reached **42 MB** and its stream broke at **22:25:11** — exactly the last
   successful write to `supervisor.log`.
2. A poisoned transcript poisons **every** output stream in that host: `Add-Content` / `Write-Host`
   throw `ArgumentException: Stream was not readable` (`supervise-watcher.ps1:86`).
3. The node child **inherits that stdout** and dies **exit -1 on its first log write** — every cycle
   the last line before death is the same: `[review] verdict-archive: moved pr-1007-review.md`.
   Started from a clean host the same node is perfectly healthy (proved: pid 3688).
4. `supervise-watcher.ps1`'s dispatcher was `if ($code -eq 2) / elseif ($code -eq 1) / else`. The
   final `else` was a **catch-all**, so `-1` was reported as *"Watcher exited cleanly (exit 0).
   Treating as a deliberate stop"* — logged **0.14 s after** *"Watcher exited with code -1"*.
5. **The crash-loop guard lives only in the `-eq 1` branch, so it never ran.** `$maxSameFail` never
   counted; `Write-Escalation` was never called; nothing reached `needs-marco/`.
6. Wrapper exits → launcher restarts it 10 s later → ~4 crashes/min for ~2 hours. Each restart's
   preflight autostashed the verdict-archive deletion → **1096+ stashes**.

## Repaired (every step read back)

- `STOP-WATCHER` to halt the churn — verified wrappers=0, nodes=0.
- Rotated the 42 MB transcript aside as `watcher-launch.log.rotated-20260818-001941`. Nothing deleted.
- Relaunched **DETACHED** via `Win32_Process.Create` (rc=0, launcher pid **69136**).
- The #727 **ADOPT** branch fired correctly and adopted node pid **3688** rather than dying.
- Final verification: wrappers=1, nodes=1, new launch log 3.4 KB, **0 restart lines**, watcher
  actively draining (correctly NO-OP'd `pr-crm-leads-s6` as already shipped in #1152).
- **No git write performed in `C:\po-watcher\ProjectOperations`.**

## PR #1162 — auto-merge armed (squash)

- `watcher-launcher.ps1`: rotate the transcript at 20 MB, keep the 5 most recent rotations.
- `supervise-watcher.ps1`: `elseif ($code -eq 1)` → **`elseif ($code -ne 0)`**, so every non-zero
  code (incl. `-1`, `134`) routes through the crash-loop guard and escalates.
- `Sup-Log`: both writes wrapped in `try/catch` — logging must never take the supervisor down.
- ADOPT path unchanged: `else` now means *exactly* 0, which is what SINGLE-INSTANCE returns.
- Built in a disposable worktree off `origin/main`; torn down.

## Board — nothing to merge

All four open PRs (#1160, #1158, #1156, #1151) carry **`do-not-merge`**, and their single red check
is **CP-26 enforcing that very label** — correct and expected, and it cannot go green while the
label is on. These are Marco's to release. Trunk is green (3/3).

## Still broken — NOT fixed here

`restart-watcher-if-wedged.ps1` reported **HEALTHY** for the entire two-hour outage. It takes a
**single-instant PID sample**, and in a 17-second restart cycle a wrapper or node is almost always
present at the sampled moment. It is structurally blind to a crash loop. Detecting restart *churn*
(counting `[launcher] restarting` lines in a rolling window) needs its own design and threshold, so
it was deliberately not bundled into #1162. **This is the instrument that lied (DOCTRINE §7) and it
is still lying.**
