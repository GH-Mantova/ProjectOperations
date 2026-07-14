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

Read-only. Opens no PR, arms no prompt, deletes nothing, touches no branch. Safe to run any time,
in any chat.
