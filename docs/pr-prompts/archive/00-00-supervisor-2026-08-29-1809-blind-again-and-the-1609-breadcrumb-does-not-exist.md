# Station 00 — Supervisor | 2026-08-29T18:09Z–2026-08-29T18:2xZ

## GROUND

```
UTC            2026-08-29T18:09:11Z
origin/main    77da3517            (GitHub REST list_commits — NO local git this run)
dev tree       [CANNOT MEASURE] no git. Mount content is consistent with a tree BEHIND main:
                                 84 depth-1 *-HOLD.md here vs 61 on main after #1392.
doc version    1                  (docs/pipeline/stations/00-supervisor.md @ origin/main, read via API)
bootstrap      1
```

Versions agree, so the read-only-on-mismatch rule did not fire. **This run is read-only anyway,
because it is blind.**

---

## WHAT I MEASURED

**[MEASURED] Desktop Commander is ABSENT. I could not start a shell on the Windows host.**
`ToolSearch` for `start_process` / `interact_with_process` returned no such tool on two attempts
~4 minutes apart; the MCP listing reported `plugin:desktop-commander:desktop-commander` as "still
connecting" on the first and it never arrived. **PREFLIGHT step 1 is FAILED.** Per the canonical
station-contract block this is a STOP, and I have not driven the board.

**[MEASURED] What I still have, and am labelling as PARTIAL — not as coverage.** The mount
`C:\ProjectOperations2` → `/sessions/<id>/mnt/ProjectOperations2/` is readable and writable, and the
GitHub REST MCP answers reads. That is the *filesystem* and the *remote*. It is **not** PowerShell:
no `status-sweep.ps1`, no `bring-up-to-speed.ps1`, no `restart-watcher-if-wedged.ps1`, no
`pipeline-lib.ps1`, no `git`. So: **no arm** (arming is a `git mv`), **no merge** (merging is
`Assert-SmokedOrEscalate` → `Merge-Pr`), **no watcher verdict**.

**[MEASURED] The board is EMPTY.** `list_pull_requests(state=open)` → `[]`. This is the REST array
itself, not a PowerShell `ConvertFrom-Json` count, so DOCTRINE §9.4's collapse does not apply to this
reading — the emptiness is real, not an instrument artefact.

**[MEASURED] `origin/main` has not moved in 1h37m.** HEAD = `77da3517` (#1394, 2026-08-29T16:32:42Z),
the merge the 16:09Z run landed. Before it `d8dde581` (#1393, 16:12:12Z). Nothing since.

**[MEASURED] WATCHER: CANNOT VERIFY — no PowerShell access this run.** Per the station doc's RULE 1,
cannot-verify is never "down". I am not escalating it and not restarting anything.

**[MEASURED] Nothing is armed, and nothing has been armed for ~21 hours.**
`ls docs/pr-prompts/*-ready.md` → 0. `docs/pr-prompts/.arming-log.txt` last line:
`2026-08-28T21:03:38Z ARMED pr-crm-s3-account-on-client-create escalates=true`. Consistent with the
standing OAuth block being correctly held, not with a stall.

**[CANNOT MEASURE] The OAuth token.** `find` across every mounted root at depth 4 found no
`.credentials.json` — the token lives outside the mount, exactly as the 14:09Z run recorded. The last
direct reading was the 16:09Z run's ninth: `expiresAt` 2026-08-28T16:13:35.984Z, mtime unmoved for
24h. **A block I cannot verify as cleared stays ON.** ARM NOTHING.

**[MEASURED] Sweep rotation is at index 1 (`instrument-honesty`), last advanced by 04 at 14:22Z**, so
Station 04's next sweep is index 2, `repo-hygiene`. 04's 4-hourly cadence puts it due at ~18:10Z —
i.e. right now. Not my action; recorded so the next 00 does not read its silence as SILENT.

**[MEASURED] No station breadcrumb has appeared since 04's 14:10Z run.** Newest file anywhere under
the mount (`find … -newermt`, excluding `.git`/`node_modules`) is
`00-04-scanner-2026-08-29-1410-instrument-honesty-…md`, plus 00's own 14:09Z breadcrumb, plus
`sot/03`, `sot/06`, `docs/qa/sot-refs-baseline.json` and `sweep-rotation.json` — all of which are
#1393/#1394's content landing. Nothing new to collect.

**[MEASURED] Dev-tree census (for drift, not for decisions):** 84 depth-1 `*-HOLD.md`, 37 entries in
`superseded/`. Main carries 61 and 236/247-by-command respectively. The dev tree has not been
fast-forwarded since #1386 (`1501d09c`).

---

## WHAT CHANGED

**One file: this breadcrumb.** Written directly to the dev tree at
`C:\ProjectOperations2\docs\pr-prompts\`, untracked, matching no watcher glob.

No PR merged. No PR opened. No label touched. No prompt armed or disarmed. No `git` run anywhere. No
process started or killed. No `/sot/` edit.

---

## FINDINGS

### F1 — Station 00's own 2026-08-29T16:09Z breadcrumb does not exist anywhere I can reach

The 16:09Z run was sighted and did real work: it merged #1393 and #1394, landed 04's five DOCTRINE §9
mechanism fixes, and **dispatched a fix to Station 06** (the `check-sot-refs.mjs` `exempt=` bucket, so
the 23-entry baseline can honestly reach 15 instead of stalling at a floor of 8). Its breadcrumb
should be at `docs/pr-prompts/00-00-supervisor-2026-08-29-1609-*.md`.

Three independent places checked, all negative:

1. **Not on `origin/main`.** #1394 was pushed at 16:32:42Z, before that run ended; main has not moved
   since. It is arithmetically impossible for the 1609 breadcrumb to be in it.
2. **Not in the dev tree.** `find ProjectOperations2 -newermt '2026-08-29 20:00'` (local, = 10:00Z)
   returns three breadcrumbs, none newer than 14:09Z.
3. **Not in a surviving worktree.** `po-worktrees/` holds six checkouts — `fix-followup-notes`,
   `po-scan-1787002207`, `scan-1787220682`, `sot-d-register`, `sot-readme-fetch`, `sotk-03-ledger` —
   none from that run. `po-watcher-worktrees/` is **empty**.

**The mechanism.** Two standing rules collide. "Board writes go in a DISPOSABLE WORKTREE off
`origin/main`, torn down with `git worktree remove --force`." And "the breadcrumb is untracked until
the next board PR commits it." A breadcrumb written into the disposable worktree *after* that run's
own PR is pushed has no next board PR to catch it — the teardown deletes it. This is the
`docs/qa/qa-findings.md` failure in a new shape: not a gitignored sink, a *destroyed* one. The
contract's own words apply: **a report nobody can find is a report that does not exist.**

What survives is only this station's memory index, which is not a repo artefact and is not read by
any other station. The Station 06 dispatch is therefore currently carried by nothing durable — which
is exactly how 04's DOCTRINE §9.5 dispatch had to be raised three times.

**DISPATCHED** — to Station 06 (PR Master), two items, in this order:

1. **Stage (do NOT arm) a prompt amending the canonical `station-contract v1` block** so the
   breadcrumb rule names *where*: the breadcrumb is written to the **dev tree**
   `C:\ProjectOperations2\docs\pr-prompts\` (persistent, swept by the next board PR) **or** committed
   inside the same run's own PR — **never left in a disposable worktree**, whose teardown destroys
   it. Canonical-block edit ⇒ all six station docs, `lint-station.mjs --write-canonical`, negative
   control first, and **do not bump `station_doc_version`** (the bootstraps declare 1; a bump forces
   every station read-only).
2. **Re-stage the 16:09Z dispatch that may have died with its breadcrumb:** the
   `check-sot-refs.mjs` `exempt=` bucket fix — 8 of the 23 baselined `sot/` refs point at
   gitignored-by-design targets and can never be retired, so moving them into an `exempt=` bucket
   leaves a baseline of 15 that can honestly burn down to zero. Deleting any of the 8 instead blocks
   CI on every PR (Station 05, 14:12Z).

**RULE 1 check on item 1.** Naming the dev tree as the breadcrumb's home solves it completely
(no future run can lose a report the same way) and additively (no existing breadcrumb, prompt or gate
is touched; the file is untracked either way). The alternative — "just remember to commit it in the
same PR" — fails the *future* half: it is a habit, not a mechanism, and habits are what this pipeline
keeps re-learning.

### F2 — Blindness alternated between two consecutive 2-hourly runs

14:09Z blind · 16:09Z sighted · 18:09Z blind. Same station, same bootstrap, same host, ~2h apart.

This is not a new question — the cause of Desktop Commander blindness is already an open, unanswered
escalation, and re-asking it would be a status update rather than a question. But it is **new
evidence that narrows it**: alternation across adjacent runs refutes any explanation that is a
property of the *configuration* (the scheduled task, the bootstrap, the station, cloud-vs-local
firing — the diagnostic `origin/main` already records as REFUTED). It points at something
**per-run and transient**: MCP server start-up losing a race, or the desktop bridge being down at the
moment the run fires. Both are testable by whoever answers the open escalation; neither needs Marco to
*decide* anything.

**DEFERRED** — folded into the existing open escalation as evidence. What would make it urgent: a
blind run that coincides with a live board (open PRs, or an armed prompt mid-flight), where blindness
costs a merge rather than costing nothing.

### F3 — Nothing to arm, nothing to merge, and that is correct

Open PRs = 0. Armed = 0. `origin/main` static since 16:32Z. The OAuth block bars arming and I cannot
re-measure the token to lift it. So both halves of my lane — ARM and MERGE — are empty on the merits,
not merely blocked by my blindness. **A sighted run at this moment would have done the same nothing.**
That is worth stating plainly, because a blind run and a healthy quiet run produce identical
"no news", and this is the rare case where I can show they coincide.

**DEFERRED** — no action available or warranted. What would make it urgent: the OAuth token being
refreshed (which unblocks the next-arm order), or any PR appearing on the board.

### F4 — My own untracked litter is still in the queue root

`docs/pr-prompts/.00-write-probe.txt`, 179 bytes, written by the 14:09Z blind run as a
write-permission probe and self-documenting as inert. The sandbox cannot remove it — `rm` returns
`Operation not permitted` — so it survives every blind run and will keep doing so.

**DISPATCHED** — to the next sighted Station 00 or 03: one `Remove-Item`. A dotfile matches no
watcher glob and no lint, so it is cosmetic, but it is litter I made and it should not outlive me.

---

## WHAT I DID NOT DO

- **I did not present the GitHub and mount reads as coverage.** They are labelled PARTIAL above. The
  watcher, the queue's live behaviour, the OAuth token and the dev tree's git state were all
  unreachable and are marked `[CANNOT MEASURE]`.
- **I did not arm anything.** The OAuth block stands and I could not measure the token to lift it;
  and arming requires a `git mv` I have no git for. The next-arm order is untouched.
- **I did not merge anything.** Nothing was open, and I have no `pipeline-lib.ps1` regardless.
- **I did not touch the watcher.** No verdict was obtainable; cannot-verify is not down.
- **I did not run `check-breadcrumb.mjs --freshness`.** It needs `node` and `git` on the box. The last
  clean reading is the 16:09Z run's: 102 checked, 0 malformed, no station SILENT. Two hours old, and
  only 04 has come due since.
- **I did not create a `-HOLD.md` for F1.** Authoring prompts is Station 06's lane, and an untracked
  HOLD in the queue root is invisible to lint and CI — one sat unnoticed for 10 hours on 2026-08-29.
  The dispatch is recorded here instead.
- **I did not stop at PREFLIGHT step 1 in silence.** The instruction is to stop *driving the board*
  and report blindness as loudly as a defect. I have driven nothing. F1 was found while establishing
  what I could and could not see, and suppressing it would have been the same swallowing failure it
  describes.
