# Station 00 — Supervisor | 2026-09-14T11:08Z–2026-09-14T11:4xZ

## GROUND

```
UTC            2026-09-14T11:08:39Z
origin/main    daec3f2b
dev tree       main @ daec3f2b  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run is read-write.

Read in the DEV TREE, after `git fetch origin --prune`. The tree opened **one commit behind** at
`7d0fb636` and was fast-forwarded to `daec3f2b` before any triage (DOCTRINE §9.5 — a stale dev tree
calls a spent prompt ADMIT). No piped-hash comparison was made anywhere in this run.

## WHAT I MEASURED

- [MEASURED] Device bridge reachable. Desktop Commander ids were found by **keyword** `ToolSearch`
  (`desktop-commander`), never assumed; `start_process powershell.exe` → pid 24748,
  `2026-09-14T21:08:39.6397792+10:00`. This run is SIGHTED, not blind.
- [CANNOT MEASURE] `vm-git-guard.sh` was not installed: the VM workspace mount is the known-down
  Plan9 transport (`the fault is the TRANSPORT, not the host`, shipped in `#1641`). No `git` was run
  through the bridge in either direction this run, so the hazard the guard covers was not present.
  A guard I could not install is never a licence to run `git` there.
- [MEASURED] The fast-forward was REFUSED on the first attempt, on the known untracked-breadcrumb
  cause: `error: The following untracked working tree files would be overwritten by merge:
  docs/pr-prompts/00-00-supervisor-2026-09-14-1008-...md`. The cure was taken as written — 
  `git hash-object` on the disk copy and `git rev-parse origin/main:<path>` both returned
  `e4d3d49af4876e44cab9a923caf4f927010f1fc2`, byte-identical, so the copy was removed and the
  fast-forward then took cleanly (`Updating 7d0fb636..daec3f2b`, 1 file, 186 insertions).
  Read back: `git rev-list --count HEAD..origin/main` → **0**.
- [MEASURED] `status-sweep.ps1` captured to a FILE (it returns early and hides its own §7):
  855 lines, exit 10. §0 instrument positive controls both `[LIVE]`. §7 verdict:
  `SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`
- [MEASURED] Board, 2 OPEN: `#1923` CLEAN, CI 15 pass / 0 fail, labels `[]`, head `d35331c4`;
  `#1920` BLOCKED, CI 13 pass / 2 fail, label `do-not-merge`, head `4eb30ad7`. `main` CI on
  `daec3f2b`: 4 success / 0 failed (trunk green). `armed (*-ready.md)`: **0**.
- [MEASURED] RULE 2 probe on the LIVE processed tree `C:\ProjectOperations2\docs\pr-prompts\processed`
  — **2216** logs, newest `2026-09-14T19:42:13+10:00` (i.e. `09:42Z` — this is the live tree, not the
  `2026-08-17` decoy). POS control `marco.:true` (regex, dot matches the quote) = **666**; NEG control
  on a needle minted this run, `zzKt9r3Bq8Xm`, = **0**. Both PRs matched by `PR #<n>` in the log BODY:
  - `#1923` → `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/rates/rate-tables.service.ts"}`
  - `#1920` → `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`
  **Both open PRs are MARCO'S. There is nothing on this board for me to merge.**
- [MEASURED] The 10:08Z run's open item is CLOSED: its `gh run rerun` on `#1920`'s `tendering-e2e`
  finished **`pass 13m42s`** (job `103941311431`). `#1920`'s remaining two reds are
  `Approval receipt (CP-26)` and `PR gates — diff checks`, which are the known single-cause coupling
  on a `do-not-merge` PR with no accepted receipt — the parked state itself, not a defect.
- [MEASURED] `check-breadcrumb.mjs --freshness` exit 2: structure **16 checked, 0 malformed**.
  `00` 1.1h ok · `03` **84.1h SILENT** · `04` 1.1h ok · `05` **93.0h SILENT**.
- [MEASURED] Live schedule, from the scheduled-tasks MCP only: `00` `5 * * * *` enabled,
  lastRun `11:08:24Z` (this run) · `03` `0 9 * * *` enabled, lastRun `2026-09-10T23:01:10Z`,
  nextRun `2026-09-14T23:00:45Z` · `04` `0 */4 * * *` enabled, lastRun `10:10:03Z`,
  nextRun `14:09:31Z` · `05` `10 0 * * *` enabled, lastRun `2026-09-10T14:10:55Z`,
  nextRun `2026-09-14T14:10:37Z` · `weekly-security-audit` `30 7 * * 1` **enabled=false**,
  lastRun `2026-09-06T21:32:44Z`.
- [MEASURED] `05-sot-keeper` bootstrap line 63 still cites `pr-gates.mjs:327`; mtime unchanged at
  `2026-09-01T00:07:44Z`. Line **327** of `scripts/pr-gates/pr-gates.mjs` on `origin/main daec3f2b`
  is a bare `{`; the real anchor is `const sotRe = /^sot\//;`. NEG control: the needle `zzKt9r3Bq8Xm`
  returns 0 occurrences in the same bootstrap, so the search is not matching everything. Measured
  independently of Station 04's 10:10Z run, which reported the same.
- [MEASURED] Sweep §5 printed **no `[STALE]` rows**. Every row reads either
  `cites #N (MERGED) as evidence -- not its premise` or `section 5 CANNOT decide`, so there is
  nothing dischargeable on the tag alone. I discharged nothing.
- [MEASURED] Backlog gate, from the sweep's own §6: `ready=1  needs-marco=2  blocked=4  broken=0`.
  The single `ready` item is `rates-11c-blocked-consumers`, gated on a parity proof having RUN clean,
  which it has not.

## WHAT CHANGED

- **Dev tree fast-forwarded** `7d0fb636` → `daec3f2b`, via the prescribed untracked-breadcrumb cure
  with the byte-identity proof quoted above. Read back `0` commits behind.
- **`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`** — appended a dated
  ADDENDUM adding a **sixth** paste to ITEM 1 (`05-sot-keeper\SKILL.md` line 63,
  `pr-gates.mjs:327` → the `sotRe` anchor), with the independent measurement and the NEG control.
  This is Station 04's F1 dispatch, discharged into the file 00 owns.
- **`needs-marco/weekly-security-audit-is-off-and-the-task-store-reverts-verified-writes-2026-09-14.md`**
  — NEW. Station 04's F2(a) needed a file or it was escalated to nobody: its subject is the desktop
  task store, outside the repo.
- **This board PR** carries Station 04's 10:10Z breadcrumb and `docs/pipeline/sweep-rotation.json`
  (`last_index=3`), which 04 is instructed to leave dirty and may not commit itself.
- Nothing else. No arm, no merge, no label change, no discharge, no `/sot/` edit, no schedule write.

## FINDINGS

### F1 — Both open PRs are still Marco's, and the one that is fully green is the one only he can land

`#1923` is CLEAN with 15/15 checks green and no labels; `#1920` is `escalates:true` + `do-not-merge`.
The RULE 2 probe returns `marco:true` for both, on the live processed tree, with POS 666 / NEG 0.
Neither greenness nor an empty label set clears RULE 2. I stood off both.

**DISPOSITION: ACTIONED** — verified by probe with controls, and acted on by standing off.

### F2 — The 10:08Z rerun was right: the third red was transient, and it cleared

`tendering-e2e` was ONE webkit `locator.waitFor` timeout on a diff touching no web code while `main`
was green — the mandate's own definition of transient. The rerun the previous run issued now reads
`pass 13m42s`. **No `fixes_pr` is needed**, and the contingency that run wrote down ("if the re-run
fails again on a clean diff, treat it as a MAIN-side regression") is hereby closed, not inherited.

**DISPOSITION: ACTIONED** — read back live from `gh pr checks 1920`.

### F3 — A sixth rotten line citation, in the layer that governs a scheduled run, and ITEM 1's own query cannot see it

Station 04 dispatched this to me because the escalation it belongs to is mine. Re-measured
independently: `05-sot-keeper\SKILL.md:63` cites `pr-gates.mjs:327` for CP-24, and line 327 is a bare
`{`. The repo-side `docs/pipeline/stations/05-sot-keeper.md` already carries the anchor form, so the
2026-09-06 anchor conversion **stopped at the repo boundary** — and the layer that actually governs a
scheduled run kept the number.

Why it is worse than the `.gitignore` half it joins: a station that checks the citation finds a brace,
and the available conclusion is *"CP-24 is not where this says it is"* — about the one gate that stops
`sot/` work being mixed with code.

It also upgrades that escalation's ITEM 2 from *"this class has recurred twice"* to *"recurred twice
and has a live instance the ITEM 1 value-query is blind to"* — the 09-06 scan searched the class
`\.gitignore:\d+`, and this member is a different file entirely. Only a CI check that validates every
`<file>:<N>` citation against the token its sentence claims enumerates the class rather than its known
members.

**DISPOSITION: ESCALATED** — appended to
`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` as a dated addendum, with the
exact replacement text and RULE 1 already argued in that file (option 2, an agent writing the
bootstrap directly, fails the "without damaging" half — that layer is outside the repo, outside CI,
and versioned by nothing). ⚠️ `needs-marco/` is gitignored, so this sentence is the only copy of the
discharge that reaches anybody.

### F4 — `weekly-security-audit` has been off for eight days and I cannot tell whether Marco did it

At `2026-09-14T02:04Z` a Station 00 run set `enabled:true` on `03`, `04`, `05` **and**
`weekly-security-audit` and read the result back. Eight hours later three had held and
`weekly-security-audit` alone was `false` again; the `model` field on all five had also reverted from
`claude-fable-5-1` to `claude-opus-5`.

🔴 **The durable check for `scheduled-tasks.json` is a re-read AFTER AN APP RESTART, never the
write-time read-back.** The desktop app rewrites that file from memory, so a verified write can be
reverted with no error, no log and no named actor. What makes this dangerous rather than merely
annoying is that the revert was **selective**: a run that checks the survivors concludes the store is
durable and stops checking. ⚠️ Consequence: the **Fable 5.1 migration is NOT done**, whatever the
02:04Z run recorded — re-doing it on disk will revert again; the cloud-trigger half done via the API
is the half that held.

I did not re-enable it. Two explanations are live — Marco's own decision, or the revert — and
overriding his decision silently, in the unversioned layer, is the half of RULE 1 that option fails.

**DISPOSITION: ESCALATED** — `needs-marco/weekly-security-audit-is-off-and-the-task-store-reverts-verified-writes-2026-09-14.md`,
one question with three options and the complete-and-additive one first.

### F5 — 03 and 05 still read SILENT, and the boundary that makes it real has not been crossed yet

Both are `enabled`; `05`'s `nextRunAt` is `2026-09-14T14:10:37Z` and `03`'s is `23:00:45Z`, neither
of which had arrived when this run measured at `11:1xZ`. Their missed occurrences fall inside the
69-hour scheduler hole the 10:08Z run measured and dispositioned. `04` has already self-recovered
through the same hole, which is the positive control for "they come back on their own".

🔴 **Do not report 03 or 05 as stopped stations, and do not restart or re-arm anything on their
behalf.** `--freshness` will keep printing SILENT until each fires.

**DISPOSITION: DEFERRED** — self-clearing at the next occurrence. It becomes real, and the next run's
to file, if `05` still shows `lastRunAt 2026-09-10` after `2026-09-14T14:11Z`, or `03` after
`2026-09-14T23:01Z`. **The 12:0xZ and 13:0xZ runs cross neither boundary; the 15:0xZ run crosses 05's.**

### F6 — I deliberately armed nothing, for the fourth consecutive run

`armed = 0` and the backlog gate reads `ready=1 needs-marco=2 blocked=4`. The single `ready` item
(`rates-11c-blocked-consumers`) is explicitly gated on a parity proof that has not run clean. Every
other gate-satisfied HOLD lands outside `tests/` or `docs/`, so every arm becomes another PR only
Marco can merge — and the board already holds two of those, one of them green and waiting since
this morning. **Arming here lengthens the queue without shortening it.**

**DISPOSITION: DEFERRED** — arming resumes when the `tests-docs` lane has an eligible prompt, or when
Marco drains the two open PRs. This is a decision, not an omission, and it is the same decision the
10:08Z run recorded; it is repeated here only because a future run reading one breadcrumb in
isolation would otherwise read `armed = 0` as an oversight.

## WHAT I DID NOT DO

- **Did not merge anything.** Both open PRs are `marco:true` under RULE 2, with controls. `#1923`
  being green, CLEAN and unlabelled does not clear it, and neither would Marco removing
  `do-not-merge`.
- **Did not arm.** See F6.
- **Did not discharge any `needs-marco/` file.** Sweep §5 printed no `[STALE]` rows; every row was an
  explicit `CANNOT decide`, and discharging on those is exactly the mistake that section warns about.
- **Did not re-enable `weekly-security-audit`** or write anything into `scheduled-tasks.json`. See F4.
- **Did not edit any bootstrap under `C:\Users\Marco\Claude\Scheduled\`.** That layer is Marco's;
  `STATION-CAPABILITIES.md` §1 says prefer the repo doc and report the drift. F3 is a report.
- **Did not stage the tracked deletion of `docs/pr-prompts/pr-ratescol-s0-column-api-hygiene-HOLD.md`.**
  It is the live stays-armable-forever instance, built into open `#1923`; retiring it belongs to that
  PR, and Station 00 has already recorded it four times today. A pathspec commit was used so the
  deletion could not be swept in by accident.
- **Did not touch 03/04/05's work**, restart the watcher (RUNNING pid 30976, wrapper alive, heartbeat
  89 min against an EMPTY queue = idle, not wedged — never restart on that shape), or prune the three
  orphaned worktrees, in particular `C:/PR-Master/worktrees/po-vg`, which still holds 1 uncommitted
  file at 14597 min, is 03's, and is already escalated.
- **Did not run Marco's own board PRs through any smoke or vision review.** Nothing here touches
  `apps/web/**` in a PR I may act on.
- **Did not edit `/sot/`, touch Azure/Entra/SharePoint, write production data, or commit on `main`.**

---

## ADDENDUM 2026-09-14T11:2xZ â€” same run, later measurement: `needs-marco/` is gitignored as a FOLDER but SIX of its files are TRACKED

### Correcting this report

F3 above says *"`needs-marco/` is gitignored, so this sentence is the only copy of the discharge that
reaches anybody."* **That is TRUE of the new file in F4 and FALSE of the file F3 appended to.**
I measured it only after the board PR was already open, so the correction lands as a second commit on
the same branch rather than a rewrite of the paragraph.

### What is actually true

- [MEASURED] `git check-ignore -v` on the F4 file â†’
  `.gitignore:82:docs/pr-prompts/needs-marco/` â€” ignored, as expected.
- [MEASURED] `git ls-files --error-unmatch docs/pr-prompts/needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`
  â†’ **exits 0 and echoes the path. The file is TRACKED.**
- [MEASURED] `git ls-files docs/pr-prompts/needs-marco` â†’ **6** tracked files in a directory the
  `.gitignore` covers wholesale. They were force-added at some point in the past; the ignore rule has
  no effect on an already-tracked path.
- [MEASURED] Consequence I created and then caught: appending the F3 addendum produced
  `git diff --numstat` â†’ `62 0` â€” a **tracked modification left dirty in the shared dev tree**, which
  is exactly the class of thing this station doc spends two long sections on (`sweep-rotation.json`,
  the untracked breadcrumb) because it blocks the next fast-forward and gets re-diagnosed from first
  principles every time.

### Why it is worth a finding rather than a footnote

`needs-marco/` is treated everywhere â€” in this station doc, in the bootstraps, in my own report one
screen above â€” as a uniformly gitignored escalation queue. It is not. **Whether an escalation reaches
a clone, CI or a cloud-fired station depends on whether its particular file happens to have been
force-added**, and nothing announces which. Both available errors are live:

- Write to a **tracked** one and you leave a dirty tracked file behind, unreported, as I did.
- Write to an **ignored** one and believe it travelled, when only the breadcrumb sentence does.

The cheap discriminator, before writing into any `needs-marco/` file: `git ls-files --error-unmatch
<path>`. Exit 0 â‡’ tracked â‡’ it belongs in your board PR. Non-zero â‡’ ignored â‡’ your breadcrumb is the
only copy that travels.

ðŸ”§ **Falsifying probe for a future run:** `git ls-files docs/pr-prompts/needs-marco | wc -l` against
the directory's own file count. If the tracked count is 0 or equals the total, this note is wrong and
the class really is uniform.

**DISPOSITION: ACTIONED** â€” the tracked addendum is committed onto this run's own board PR branch in
the same commit that carries this correction, so the dev tree is left clean of it. The general
non-uniformity is recorded here rather than escalated: it needs no decision from Marco, and the
discriminator above is a one-command habit any station can adopt.


---

## ADDENDUM 2 â€” 2026-09-14T11:3xZ: native auto-merge deleted the branch out from under a second push, and the push SUCCEEDED anyway

Worth one paragraph because it silently discards work and every instrument says it went fine.

Sequence, [MEASURED]: `#1927` was opened at `11:17Z` and `gh pr merge 1927 --auto --squash
--delete-branch` was enabled and read back. While the addendum above was being prepared, the checks
went green, auto-merge squashed `#1927` at head `3ebd54cf`, and `--delete-branch` removed
`docs/st00-collect-2026-09-14-1108` from origin. The addendum commit `02b89dc1` was then pushed to
that branch name â€” and **git reported `* [new branch]` and exit 0.** A push that re-creates a deleted
branch looks identical to a push that updates a live one, except for two words in the output nobody
reads. The commit was on origin, attached to no PR, and on no route to `main`.

ðŸ”´ **`--delete-branch` on auto-merge turns any later push to that branch into a silent orphan.** The
read-back that catches it is not the push's exit code but `gh pr view <n> --json state,headRefOid`:
here it returned `MERGED` at `3ebd54cf`, i.e. one commit behind what had just been pushed.

âš ï¸ **And the obvious recovery does not work either.** A 3-dot diff of the re-created branch against
the new `origin/main` reported all four files as pure additions (`250 0`, `224 0`, `62 0`) even though
three of them were already on `main` byte-for-byte â€” because a **squash** merge leaves no common
ancestor, so the branch's own history is not recognised. Opening a PR from it would have re-added
files that already exist. The cure is a **fresh branch off the new `origin/main`** carrying only the
delta, which is what this PR is.

ðŸ”§ **Rule for a future run: do not enable auto-merge until the run has finished writing.** Either
hold `--auto` to the end of the run, or drop `--delete-branch` so a late push still lands somewhere
recoverable. The first is better â€” it is complete and additive, and it removes the race rather than
softening its consequence.

**DISPOSITION: ACTIONED** â€” the lost commit was re-authored onto a fresh branch off `origin/main`
`5066f4ec` and is in this PR. âš ï¸ The orphaned re-created branch
`docs/st00-collect-2026-09-14-1108` is **left on origin deliberately**: branch deletion is on this
station's irreversible list, and an unreferenced branch costs nothing. It can be removed by hand.

