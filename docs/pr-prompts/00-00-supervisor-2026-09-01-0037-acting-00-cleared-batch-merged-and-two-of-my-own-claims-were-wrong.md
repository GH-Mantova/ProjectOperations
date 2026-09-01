# Station 00 (ACTING, by Marco's instruction) | 2026-09-01T00:37Z-01:20Z

Marco stopped the scheduled Station 00 at ~00:45Z and directed this chat to act as 00 until he says
otherwise. This is a chat-driven 00 run, SIGHTED (Desktop Commander live throughout).

## GROUND

- START `origin/main` **e57fd6d4** -> END **0cb31825**. Dev tree FF'd, now **0 ahead / 0 behind**.
- Watcher node **32916** alive, wrapper alive. Clone at **3985d74f** (untouched by me).
- ARMED 0 at close. Worktrees: dev tree only; all four of my disposable worktrees torn down.
- RULE-2 probe control: **595 of 1807** `processed/*.log` carry `"marco":true` => CALIBRATED.

## WHAT I MEASURED

- Every open PR's routing, re-asserted at merge time (`merge-cleared.ps1` refuses anything outside
  the cleared list and refuses a `do-not-merge` label).
- `strict_required_status_checks_policy = true` on `main`, required contexts: CodeQL, API, Web,
  tendering-e2e. This is WHY the batch had to be sequential: every merge put the rest BEHIND and
  forced a full re-run.
- #1464's red, from the job log: `crm.service.drop-reason.spec.ts:146` expects `deleteDropReason`
  to throw `ConflictException`; it resolves to `undefined`. **3754 of 3761 pass.** #1464 edits
  `crm.service.ts` but does NOT touch that spec.
- Live labels + label timeline via the issues timeline API.

## WHAT CHANGED

- **MERGED, under an explicit chat clearance from Marco naming exactly three PRs, in his order:**
  **#1463** (`299c5c12`, 00:40:53Z) -> **#1466** (`08ab869b`, 00:58:10Z) -> **#1457**
  (`0cb31825`, 01:15:36Z). Each read back with `gh pr view --json state,mergedAt,mergeCommit`;
  never trusted the `True`.
- **Dev tree fast-forwarded** `b22057e4` -> `0cb31825` (`--ff-only`, is-ancestor verified first,
  no RD in the index). This discharges the FF dispatch the 22:11Z run left for the next sighted 00.
- Five scheduled-station bootstraps corrected earlier in the session (both refuted claims removed,
  backups written) after Marco authorised it.

## FINDINGS

### F1 - I told Marco a wrong cause for #1457's auto-merge lapsing. The 00:09Z run had disabled it.
I measured `autoMerge=ON (SQUASH)` at 00:0xZ and `null` at 00:37Z, and told Marco the watcher's
branch pushes were the likely cause. **That was wrong.** #1467's breadcrumb (F1, 00:14:30Z) shows
Station 00 ran `gh pr merge 1457 --disable-auto` deliberately, because a `marco:true` PR carrying
unattended native auto-merge is a state the ACTIVE DRIVE MANDATE says must not exist. The correct
sequence then followed: auto-merge (wrong mechanism, unattended) removed -> Marco cleared it in
chat (right mechanism, attended) -> merged under that clearance.
🔧 **METHOD: a state change I did not cause is not a state change I may explain. Read the other
actor's report before assigning a cause.**
**DISPOSITION: ACTIONED** - corrected to Marco in chat, and filed here.

### F2 - I described #1443 and #1464 as carrying `do-not-merge`. Live, neither does.
I took the label from the watcher VERDICT STRING (`"...labelled do-not-merge"`), which records what
was true when the verdict was written, not a live read. Timeline API: #1443 labeled 08-31T08:22:23Z,
**unlabeled 09:35:36Z**; #1464 labeled 08-31T23:32:57Z, **unlabeled 09-01T00:02:59Z**, both by
`GH-Mantova`. **My refusal to merge them still stands and is unchanged** - both carry
`marco:true` + `escalates:true`, and RULE 2 is explicitly NOT overridden by an absent label. But the
reason I gave Marco was partly wrong.
🔧 **METHOD: a verdict string is a SNAPSHOT of a label, never the label. Read labels live.**
**DISPOSITION: ACTIONED** - corrected to Marco in chat.

### F3 - #1464's red is a real regression, and the fix is a product question
Not a flake: one failing test out of 3761, in the module the PR edits, and the PR does not touch the
failing spec. Whether "delete only when entry empty" is meant to REPLACE the opportunity-reference
conflict guard or sit ALONGSIDE it is a behaviour decision.
**DISPOSITION: ESCALATED to Marco.** Not fixed: it is another chat's live slice and the call is his.

### F4 - #1466's fix verified in situ, on the exact case it was written for
After the FF, the dev tree's own sweep printed:
`main CI on 0cb31825: 0 success / 0 failed / 4 running <-- [CANNOT MEASURE] nothing has concluded on
this commit; NOT a green trunk`. The pre-#1466 code printed `(trunk green)` for precisely this state.
**DISPOSITION: ACTIONED** - read back, nothing further needed.

### F5 - #1463 is merged but INERT, and I am barred from the cure
`origin/main` carries `syncMainQuietly` x3. The running clone at `3985d74f` carries **0**.
Guard-blocks went **11 -> 12** during this run, so the starvation loop is still consuming reviews.
The cure is a clone FF + watcher restart; 00 is barred absolutely and 03 is report-only.
**DISPOSITION: ESCALATED** - unchanged, still nobody's.

## WHAT I DID NOT DO

- **Did not merge #1443, #1464 or #1468.** The clearance named three PRs and is now SPENT.
  #1468 carries a live `do-not-merge` label.
- **Did not touch the watcher clone**, did not restart the watcher, did not FF the clone.
- **Did not fix #1464's failing test** or push to any branch I do not own.
- **Did not remove or add any label**, and did not enable or disable auto-merge on anything.
- Did not touch `/sot/`, Azure, `needs-marco/`, or the `.claude/agents` body mojibake (a bulk
  de-mojibake was measured UNSAFE: the reverse transform fails on all six files).
