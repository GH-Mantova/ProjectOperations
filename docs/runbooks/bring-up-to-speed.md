# Bring up to speed / Full status report -- the ONE command

**Trigger phrases (any of these means: run the sweep, then report ONLY from it):**
"bring yourself up to speed", "bring me up to speed", "full status report", "status report",
"where are we", "catch up on the repo".

## What to run

```
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\pipeline\bring-up-to-speed.ps1
```

(For a live-state-only check without the knowledge manifest, run `scripts\pipeline\status-sweep.ps1`.)

Bash equivalent, from the workspace mount:
```
pwsh -NoProfile -File /sessions/.../mnt/ProjectOperations2/scripts/pipeline/bring-up-to-speed.ps1
```

## Why this exists

Status reports kept going wrong the SAME way: a stale local file (a station report, a
`needs-marco` escalation, a supervisor state snapshot) was repeated as current, when GitHub or a
running process said otherwise. On 2026-07-15 a report claimed "PR #571 is a held draft awaiting
Marco" -- GitHub showed #571 had MERGED 14 hours earlier. The fix is to stop relying on memory or
judgement to pick the trustworthy source, and instead run one deterministic sweep that:

- tags every fact `[LIVE]` (GitHub / a running process -- authoritative) vs `[FILE]` (a snapshot),
- runs a **positive control** on each instrument first (a tool that cannot report a known-true
  answer is BROKEN, and "broken" is never silently reported as "nothing there"),
- **cross-checks every local claim against GitHub** and flags stale ones `[STALE]` -- the exact step
  that was being skipped.

## The contract for the chat (this is the important part)

1. **Run `bring-up-to-speed.ps1`.** Do not hand-gather state; the script is the source.
2. **Report ONLY from `[LIVE]` lines.** Never repeat a `[STALE]` line as current. Treat `[FILE]`
   lines as unverified snapshots -- say so if you must mention them.
3. **Do the READ-CHECKLIST (section E)** before you state anything about direction or history:
   read `sot/README.md` and follow its routing; read the SoT masters your role needs; read the
   `### READ THESE FIRST` chat memories FULLY (not just the injected one-liners).
4. **If section 7 says DO NOT ACT** (a station is mid-run), summarise and wait -- do not stage,
   arm, or merge.
5. **Never merge PRs.** The supervisor drives the board. This tool reports; it does not act.

## What the script checks

| Section | Source | Answers |
|---|---|---|
| 0 Positive controls | live | is gh reachable? is node up? (else the report is untrustworthy) |
| 1 GitHub | **authoritative** | open PRs (incl. drafts), most-recent merges |
| 2 Watcher | running process | node alive? auto-restart wrapper alive? heartbeat age |
| 3 Station mid-run | running process | is a headless station driving the board right now? (safe-to-act gate) |
| 4 Queue | disk | armed prompts, in-progress, needs-marco, no-pr-opened, failed, blocked |
| 5 Stale cross-check | live vs file | every `needs-marco/*.md` PR ref re-queried against GitHub; stale ones flagged |
| 6 Backlog gates | live | `check-backlog.mjs` -- what is ready to stage vs needs-Marco |
| B Repo identity | git | HEAD, how far behind origin/main (local reads may be stale), dirty count |
| C SoT masters | git | the 7 source-of-truth files + each one's last commit |
| D History | git | last 30 commits on origin/main |
| E Read-checklist | -- | what the chat must read before reporting |

Extra sections added to close known blind spots:

| Section | Closes | What it adds |
|---|---|---|
| 1 (CI per open PR) | #2 | each open PR's check rollup: N pass / N fail / N pending |
| 4B failures/silent-exits | #3 | newest 6 files in `failed/` + `no-pr-opened/` WITH a reason snippet (e.g. "Reached max turns", "tendering-e2e fail", a standing-authority stall) |
| 3 recent-remote | #5 | flags any PR touched on GitHub in the last 2 min -> a station may be doing gh-only work with no local lock. Adds a CAUTION verdict tier. |
| C2 SoT content | #1 | prints `sot/README.md` IN FULL + every master's section headers (not just a file list) |
| C3 scheduled stations | #4 | lists the station definitions on disk; checklist item 4 tells the chat to call the scheduled-tasks MCP for live enabled/next-run |
| E checklist item 7 | #6 | mandates writing any chat-only decision into BACKLOG/sot/memory before the session ends |

## Deliberately OUT of scope -- blind spot #7 (prod / DB / Azure / deploy health)

The sweep does not check production health, the live database, Azure/Entra, or deploy status. This
is intentional, not an oversight:

- **Azure/Entra is Marco's hard stop** -- nothing automated touches it without his supervision, so a
  sweep that any chat runs unattended must not reach into it.
- **There is no queryable prod telemetry today** (Microsoft.Insights was only just registered), so
  there is nothing reliable for a script to read; prod incidents are diagnosed by hand off the live
  Log Stream.
- **The sweep is meant to be safe to run in any chat at any time.** Reaching into prod/DB would make
  it stateful and risky. Prod health is a separate, supervised action -- not part of "bring me up to
  speed."

If prod/DB status is ever wanted in the sweep, it should be a separate opt-in flag
(`-IncludeProd`) that Marco runs deliberately, never the default.

Read-only. Opens no PR, arms no prompt, deletes nothing, touches no branch. Safe to run any time,
in any chat.
