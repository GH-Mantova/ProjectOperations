# Station 00 — Supervisor (supervised interactive lane `station-00.interactive-0004`) | 2026-09-21T00:08Z–04:40Z

Lane: DOCTRINE §10.2.1 — Marco present and directing turn by turn in chat. Session
https://claude.ai/code/session_01M2BoeL5NEFRzZyQNeaFTn7. This breadcrumb exists so the scheduled 00
can see what this lane did; §10.2 says a chat is invisible to every other run.

## GROUND

```
UTC            2026-09-21T04:31:33Z (this block; session began 00:08:07Z)
origin/main    89dd907e            (fetched, then rev-parse, in the dev tree)
dev tree       main @ 29abf8d4      C:\ProjectOperations2   (2 behind: #2026, #2027)
doc version    station_doc_version: 1   (read via git show origin/main: in the dev tree)
bootstrap      n/a — interactive lane, no scheduled-task file
```

## WHAT I MEASURED

- [MEASURED] `bring-up-to-speed.ps1` at 00:08:07Z: section 0 positive controls PASS, verdict
  `SAFE TO ACT`. The heartbeat workflow's own log (run 35543629918) read *"SILENT: NO station has
  reported for 76.0h"*. Marco then said in chat the pause was deliberate (token availability) and
  that the stations were restarted.
- [MEASURED] #2017 lane probe (§10.1 step 1): `processed/pr-crmvis-s6-bulk-link-ready.md.log`
  carries `merge result for PR #2017: {"ok":false,"marco":true,...}`. The same log carries its own
  `PR opened and left unmerged: …/pull/2017`, so it is a routing, not a scrape. POSITIVE
  `marco.:true` over the corpus → 688, NEGATIVE `#999996` → 0. Live label read: `do-not-merge`.
- [MEASURED] #2027 lane: no watcher verdict names it (`[NO LANE VERDICT — hand-classified]`), so
  §10.1 step 3 applies: a Station 05 doc-reconcile, bounded by CP-24. The lane read the diff on head
  `93d83a03`: `sot/01` +30/-0 (additive block) and one breadcrumb +178.
- [MEASURED] `triage-holds.ps1` at 29abf8d4: GIT and SPENT controls PASS, 28 HOLD, 3 gates-satisfied
  (`pr-crmvis-s6-bulk-link` = #2017's own prompt; `pr-queue-layout-sot-entry` = 05's;
  `pr-sotinpr-freshness-gate`), 25 still gated, spent=0.
- [MEASURED] trunk `a111a591`: every non-heartbeat check SUCCESS, including tendering-e2e and
  Build and deploy.
- [MEASURED] `pr-ea-s2-dashboard-preset` successors: #1823 (EA-GATE) MERGED 09-11, #1920 (EA-2a)
  MERGED 09-14, #1950 (EA-2b) MERGED 09-15, all via `gh pr view <n>`. The prompt is spent. The
  triage missed it because its `do-not-arm` marker REJECTs before the premise runs.
- [MEASURED] `vm-git-guard.sh`: the installer did not return inside 60 s (call timed out). Afterwards
  `command -v git` in a fresh `bash -c` → `/usr/bin/git`, while `~/.local/bin/git` exists. So the
  guard is installed but NOT ON PATH for the shells every VM call uses. No `index.lock` was left
  (Windows `dir /a .git\index.lock` → File Not Found). The installer's last line: [CANNOT MEASURE],
  because the call was cut off.

## WHAT CHANGED

1. **Armed `pr-sotinpr-freshness-gate` (CP-27)** at 04:19:50Z via `arm-prompt.ps1 -Actor
   station-00.interactive-0004`. `-WhatIf` ran first. Read back: `-ready.md` present, `-HOLD.md`
   absent, audit line in `.arming-log.txt`. Watcher `[start]` at 04:19:51.195Z, one second later.
   It escalates:false, but it touches `scripts/`, so its PR routes to Marco.
2. **#2027 merged** 04:24:39Z → `89dd907e`, released by Marco in chat (*"Yes — merge it"*). The
   receipt `docs/decisions/merge-approvals/2027.md` was pushed onto the PR head first (`7f0b4639`;
   local == remote via `ls-remote`). Then `Assert-SmokedOrEscalate -MustContain 'RULED BY MARCO,
   2026-09-21'` passed and `Merge-Pr` read back MERGED. The head was re-checked unchanged and
   unlabelled immediately before the merge.
3. **#2005 branch updated** (`gh pr update-branch`) `d92fb4d2` → `9042ed15`, after another chat had
   reopened it on Marco's instruction. `do-not-merge` is still on, and this lane did not touch it.
   `git merge-tree --write-tree origin/main <head>` beforehand gave a clean tree.
4. **Discharged** `needs-marco/pr-2005-closed-unmerged-one-second-after-a-board-merge-2026-09-17.md`
   → `needs-marco/discharged/`, with `_DISCHARGE-NOTE-2026-09-21-pr-2005.md` beside it. Its question
   was answered by the reopen. It was moved, not deleted. The folder is gitignored, so this line is
   the report of it.
5. **Retired** `pr-ea-s2-dashboard-preset-HOLD.md` → `docs/pr-prompts/superseded/` in this PR
   (R100 rename). All three successors are merged.
6. Worktrees created and torn down: `C:\po-wt\00i-0004-2027` (removed). This PR's
   `C:\po-wt\00i-0004-board` is removed after merge.

## FINDINGS

### F1 — Marco ruled the board split, 2026-09-21, in chat

Transcribed, because a chat ruling is invisible to later runs (§10.2). His words: *"you as station
00 (interactive) and the scheduled station 00 (hourly agent) will be responsible for driving to
green and merging. 05 sot keeper is responsible for its own prs. station 06 will stage/arm its own
prs, potentially opening/merging slice-0s, everything else should be on you and schedule 00."* He
also stated that he merged #2026 himself. That partly answers
`needs-marco/two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md`:
two 00s ARE sanctioned. The gate defect in F2 is what still makes that unsafe.

**DISPOSITION: ACTIONED** — transcribed here. Discharging the escalation is left to the scheduled 00
collect, because only the "who" half is answered.

### F2 — the safe-to-act gate read SAFE 37 seconds after another 00 committed

[MEASURED] 00:20:54Z. `index.lock` was False in both trees and there were 0 git processes, while the
scheduled 00 had committed `78f67463` at 00:20:17Z in `C:\po-wt\00-board-20260921` and pushed it,
and Station 05 had `sot/02` dirty in `C:\po-worktrees\s05-reconcile-20260921`. `git worktree list`
showed both; the gate reads neither. This is a fresh measured instance of the escalation named in F1.

**DISPOSITION: ESCALATED** — appended as evidence to the existing escalation rather than filed
twice. The question to Marco is unchanged: should the gate count live station worktrees (created
< N min ago, or dirty) as a mutation signal?

### F3 — `vm-git-guard.sh` is installed but not on PATH for `bash -c`

See WHAT I MEASURED. The preflight says it *"persists itself onto PATH"*, but a fresh `bash -c`
resolves `/usr/bin/git`. So the guard protects nothing that the device-bridge calls actually run.
This lane stopped running git in the VM and used the Windows shell only.

**DISPOSITION: DISPATCHED** — to Station 04 (instrument-honesty sweep): reproduce `command -v git`
in a fresh `device_bash` after install, and stage a fix prompt (it is `scripts/`, so Marco's
merge). It becomes urgent the next time a 0-byte `.git\index.lock` appears.

### F4 — the triage cannot see a spent prompt behind a `do-not-arm` marker

`pr-ea-s2-dashboard-preset` was spent for six days (EA-2b merged 09-15) and sat in STILL GATED,
because `HUMAN_GATE_PRESENT` fires before the premise and the SPENT-BEHIND-REJECT probe did not flag
it. It was retired here.

**DISPOSITION: DEFERRED** — one occurrence. It becomes urgent if a second spent-behind-marker prompt
is found. The probe to extend is `triage-holds.ps1`'s SPENT-BEHIND-REJECT bucket, which should also
check a prompt's named successors.

### F5 — four HOLDs need design or drafting work, not a gate

Per F1, 06 stages its own work, so these go to 06:

| prompt | what it lacks |
|---|---|
| `pr-ops-m2b-tipping-tab-reminder` | **The gate is satisfied**: `model TipRecommendationLog` is on main (positive control `model Tender` = 1). The two prose markers (`do-not-arm`, `DO NOT ARM YET` / `ARM ONLY`) name that exact condition and are stale. Stripping them in a scratch copy then REJECTs on `UI_PROMPT_NEEDS_DESIGN_REF`, so it also needs a `design_ref`. |
| `pr-company-manage-s2-retire-adminonly` | `UI_PROMPT_NEEDS_DESIGN_REF` (scope touches `SettingsShell.tsx`, `App.tsx`) |
| `pr-unified-api-key-vault-slice4c-retire-old-screens` | `UI_PROMPT_NEEDS_DESIGN_REF` (`apps/web/src/**`). Its `requires_merged: 1111` is MERGED. |
| `pr-permission-role-reconciler` | The body requires *"Marco (or a PR-Master pass) has signed off on the design"* before arming. |

**DISPOSITION: DISPATCHED** — to Station 06, relayed by Marco in chat, since 06 has no file-backed
inbox (`needs-marco/dispatched-findings-have-no-file-backed-home-2026-09-10.md`).

### F6 — what only Marco can release

**DISPOSITION: ESCALATED** — one list, not new files:

- **#2017** — green except the CP-26 pair. Remove `do-not-merge` and it merges and releases
  crmvis s7 → s8.
- **#2005** — CI re-running on `9042ed15`. When green, remove `do-not-merge` and it merges and
  releases scopecards s4a → s4b → s5 → s6.
- **The CP-27 PR** (building now) will route to Marco (`scripts/`).
- Human-gated HOLDs: `pr-vendor-invoice-ocr` (enter the doc-AI key),
  `pr-devtree-sync-ff-only-guard` (answer the 08-28 escalation), `pr-dns-s5-checker-flip-to-fail`
  (read one clean warn-only run), `pr-e2e-container-s2-swap-required-job` (confirm the trial ran).
  Approval-file / irreversible: `524`, `rates-s11c`, `siteid-notnull-backfill`, `tenant-mt4-s2`,
  `retire-tenderclientnote-s2`, `fv2-formrule-contract`, `tipid-s3`. `fv2-ai-digests` and
  `fv2-output-channels` wait on the open cluster escalation. `nav-jobs-projects-merge` waits on
  B-P0a.

## WHAT I DID NOT DO

- **Did not touch any `do-not-merge` label** (#2005, #2017). §10.2.1: only Marco removes it.
- **Did not merge #2017 or #2005.** Both have genuine watcher `marco:true` verdicts.
- **Did not arm** `pr-queue-layout-sot-entry` (05's, per F1) or `pr-crmvis-s6-bulk-link` (it is
  #2017's own prompt; arming it builds a duplicate).
- **Did not publish the 33 `docs/pr-reviews/` files.** Marco assigned that to 06. It landed as #2026
  before this lane acted.
- **Did not edit any stale `do-not-arm` marker** (F5). Removing a human marker is 06's or Marco's
  reviewable act, not this lane's.
- **Did not run git in the VM** after F3. No `/sot/` edit. No Azure/Entra/SharePoint.
