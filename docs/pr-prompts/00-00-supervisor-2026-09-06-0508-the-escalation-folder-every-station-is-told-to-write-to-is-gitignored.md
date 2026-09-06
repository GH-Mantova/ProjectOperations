# Station 00 — Supervisor | 2026-09-06T05:08Z–05:5xZ | SIGHTED — collected, drove the board's only red to green

## GROUND

```
UTC            2026-09-06T05:08:51Z  (start)
origin/main    3e16855c   (#1689, 04:36Z)   fetched, then rev-parse
dev tree       main @ 3e16855c   C:\ProjectOperations2   (opened at 306e4a14, behind 4; fast-forwarded)
doc version    1   docs/pipeline/stations/00-supervisor.md front matter
bootstrap      1   the scheduled-task file's station_doc_version
transport      SIGHTED — Desktop Commander start_process, powershell.exe, first call, PID 17292
```

Doc version and bootstrap **AGREE** — this run was not restricted.

**The three binding documents were read in full, from the dev tree AFTER the fast-forward, and the
tree was proved equal to `origin/main` for all three** — [MEASURED]
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
→ **EMPTY**, and the same query across the four commits the fast-forward brought in
(`git diff --numstat 306e4a14 3e16855c -- <the three>`) → also EMPTY, i.e. none of the three moved
this hour. No piped hash was used anywhere (PREFLIGHT step 2 / §9.1).

## WHAT I MEASURED

- **[MEASURED] Dev tree opened BEHIND by 4 and was fast-forwarded before anything else.**
  `## main...origin/main [behind 4]`; `git diff --numstat` and `git diff --cached --name-status`
  both EMPTY beforehand, so the fast-forward needed neither FF cure. After:
  `3e16855c`, `## main...origin/main`, both diffs EMPTY. The four were `#1685 #1680 #1667 #1689`.
  **This discharges the blind run's F4**, which deferred exactly this to "the next sighted run,
  before it lints anything". Nothing was linted or armed before the fast-forward.

- **[MEASURED] `status-sweep.ps1`, captured through `cmd /c` redirection so the §9.3 UTF-16LE trap
  cannot eat it** (45,651 bytes, 264 lines, read back in full). Verdict §7:
  **`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`**
  Section 0 controls both `[LIVE]` PASS. Section 3: 0 in-progress prompts, no `index.lock` in either
  tree, 0 git processes, no PR touched in 2 min.

- **[MEASURED] The board is ONE open PR and it was the only red.** `#1690`
  `pr-scopesub-s5-sub-tab-ui`, BLOCKED, 14 pass / 1 fail. Trunk green: main CI on `3e16855c`
  4 success / 0 failed.

- **[MEASURED] The red was NOT transient, and the 3-second duration is what makes it look
  transient.** `CodeQL | completed | failure | started 04:46:03Z done 04:46:06Z |
  "1 new alert including 1 high severity security vulnerability"`. Station rule 5 says re-run a
  3-second failure before diagnosing; the job log says otherwise, and the log wins (LIMITS 6). The
  alert, read from the code-scanning API rather than the PR page:

  ```
  #26 [high] js/incomplete-multi-character-sanitization
      apps/web/src/pages/tendering/scope-cards/__tests__/sub-tab.test.tsx:231
      "This string may still contain <script, which may cause an HTML element injection vulnerability."
  ```

  Line 231 was `const text = coveredHtml.replace(/<[^>]*>/g, "").trim();` — a **single-pass** tag
  strip used to recover a rendered cell's text content. One pass is genuinely incomplete: removing a
  match can splice its neighbours into a fresh tag.

- **[MEASURED] Watcher healthy.** `watcher node: RUNNING pid 20000`, auto-restart wrapper alive (1),
  heartbeat 45 min (ticks only mid-run; empty queue ⇒ idle, not wedged). Armed `*-ready.md`: **0**.
  `.arming-log.txt` tail unchanged since `2026-09-06T01:52:59Z ARMED pr-tipid-s1-...` — **no arm has
  happened since 01:52Z and none happened this run.**

- **[MEASURED] COLLECT — `check-breadcrumb.mjs --freshness` exit 0, `CLEAN`, every station `ok`**
  (00 1.1 h · 03 6.2 h · 04 3.0 h · 05 15.0 h). Cross-checked against the standing caveats rather
  than quoted alone: `'00': 2` in the script's `CADENCE` map against a live cron of `5 * * * *` is
  open escalation #23's territory and is **not re-raised**. Queue root held exactly two breadcrumbs,
  both Station 00's; 03/04/05's were already archived by earlier runs, so nothing was uncollected but
  the blind 04:08Z run's own file.

- **[MEASURED] RULE 2 / lane classification for `#1690`, with all four controls.**
  Live probe directory pinned to `C:\ProjectOperations2\docs\pr-prompts\processed` — **1,978** logs,
  newest `rev-1689-ready.md.log` at `03:48:53Z`, which is the AGE discriminator against the
  2026-08-17 decoy in the watcher clone. `marco.:true` POSITIVE → **615**; prompt-log probe
  (`pr-*.log`, `rev-*` excluded, §9.5): `PR #1690` → **0**, POSITIVE control `PR #1685` → **2**,
  NEGATIVE control `PR #999999` → **0**.
  The discriminator for which absence: `watcher-launch.log` holds **no `opened PR #1690` line** (the
  most recent such line is `#1685` at `02:01:30Z`), but it does hold
  `[update] PR #1690 branch updated (was BEHIND)` at `04:45:31Z`. **`#1690` is SECOND LANE.**
  Hand-classified per `classifyPolicyFiles`' three forms: of its five files, four are
  `apps/web/src/pages/tendering/**` and match none of `^(tests|docs)/`, `(^|/)__tests__/`,
  `\.(test|spec)\.[cm]?[jt]sx?$` ⇒ **`[NO LANE VERDICT — hand-classified] MARCO'S. NOT MINE TO
  MERGE.**

- **[MEASURED] The blind run's F1 re-measured on the live repo before being appended anywhere.**
  `git log origin/main -8 --format='%h|%s|%(trailers:key=Co-authored-by,valueonly,separator=;)'`,
  NEGATIVE control `ZzQqNoSuchTrailer0906` → **0 characters**. Confirmed and extended: **five**
  distinct actor strings across eight commits where `mergedBy` gives one. The extension matters —
  `#1667` reads `GH-Mantova <marco@initialservices.net>` while `#1680` reads
  `Marco <marco@initialservices.net>`: same human, two strings, same week. The full table is in the
  escalation thread; see F2.

## WHAT CHANGED

1. **Dev tree fast-forwarded** `306e4a14` → `3e16855c`. Read back: `0 0` on
   `git rev-list --left-right --count HEAD...origin/main`, `git diff --numstat` EMPTY,
   `git diff --cached --name-status` EMPTY.
2. **`#1690` driven from RED to green on its only failure.** One commit, `b1710653`, on
   `pr-scopesub-s5-sub-tab-ui`, one file, `11 insertions(+), 1 deletion(-)`, made in a **disposable
   worktree** off the PR head (`C:\po-wt\fix1690`, torn down; `git worktree list` read back). Pushed
   through the sanctioned primitive `Invoke-GitPush`, which read the remote SHA back and proved it
   ours. **Read back: CodeQL `pass`, `Analyze (javascript-typescript)` `pass`.**
3. **The escalation thread `label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md`
   gained an ADDENDUM** carrying the re-measured trailer table and its three limits. Written to the
   **dev tree**, not to this PR — see F1 for why that is not a choice.
4. **DOCTRINE §9.4 gained one bullet** — the blind run's F2, `merged: false` on every list-response
   entry. 19 lines added, 0 removed, byte delta asserted (`expected 1728 == actual 1728`).
5. **Two breadcrumbs archived**, this run's own written straight into this PR's worktree (cure 1 —
   no loose copy in the dev tree, so no post-merge fast-forward blocker).

**Not changed:** no arm, no disarm, no label, no `sot/` edit, no merge of anything that is not this
station's own lane, no watcher restart, nothing in `C:\po-watcher`, nothing in `C:\po-vg`.

## FINDINGS

### F1 — `docs/pr-prompts/needs-marco/` is GITIGNORED. The channel every station is told to escalate through never leaves this one machine, and a blind run stood down because it believed the opposite. **S2.**

[MEASURED] in the dev tree at `3e16855c`, with a positive control:

```
git check-ignore -v -- docs/pr-prompts/needs-marco/label-removal-...-2026-09-05.md
  -> .gitignore:82:docs/pr-prompts/needs-marco/    <exit 0>
git ls-files --error-unmatch -- <same path>
  -> "Did you forget to 'git add'?"                <exit 1>
git ls-files --error-unmatch -- CLAUDE.md          (POSITIVE control)
  -> CLAUDE.md                                     <exit 0>
```

The controls matter here specifically, because §9.2 records that `git check-ignore -v` on a
**directory** is silent-and-exit-1 in a way byte-identical to a true negative. Both queries above are
on a **FILE**, which is the form that answers.

**Two consequences, and the second is the one that costs.**

**(i) It cost the blind 04:08Z run its F1 disposition.** That run wrote, verbatim: *"I did not append
to the escalation file, and the distinction is deliberate: `needs-marco/*.md` is tracked, a blind run
cannot commit, and leaving a tracked file modified in the shared dev tree is an FF blocker for every
other station."* Every clause of that reasoning is sound **and its premise is false.** The file is
untracked, appending to it is an ordinary file write, it creates no FF blocker for anybody, and a
blind run — which STATION-CAPABILITIES §3 now confirms can *write* through the mount — could have
done it. A correct chain of reasoning from a wrong premise, arriving at "defer to the next run":
that is §7's shape applied to a policy question rather than a measurement.

**(ii) Escalations are invisible to every reader except this box.** A clone has none of them. CI has
none of them. **The supervised cloud lane has none of them** — DOCTRINE §10.2's last bullet says a
cloud session sees only what is committed, and this is 28 files of open questions addressed to Marco
that are not committed. `status-sweep.ps1` §5 reads them, `check-breadcrumb.mjs` does not, and
STATION-CAPABILITIES §7's channel table — which does flag `docs/qa/qa-findings.md` as gitignored in
red — **does not list `needs-marco/` at all.** The station doc's own ESCALATE section names the
folder as the escalation channel without a word about it.

**ESCALATED — a documentation-vs-design question that is Marco's, not a station's.** The two are
different fixes and only he can pick:

- **(a) COMPLETE AND ADDITIVE — track `needs-marco/`.** Remove `.gitignore:82`, commit the 28 open
  files, and let escalations reach a clone, CI and the cloud lane the way breadcrumbs already do
  (`#1300` did exactly this for `docs/pr-prompts/00-*.md`). Solves it **immediately** — the current
  28 become readable by every reader tomorrow — and **permanently**: a new lane cannot fail to see an
  escalation it can `git log`. Damages no data entry: it adds files to the repo and removes no path,
  no gate and no existing workflow, and `status-sweep.ps1` §5 keeps reading them from the same place.
  The cost is real and should be said plainly: escalation text becomes public repo history, and some
  of it quotes chat.
- **(b) Leave the folder ignored and fix only the map** — add a `needs-marco/` row to
  STATION-CAPABILITIES §7's channel table and a warning to the station docs' ESCALATE sections.
  Fails the **complete** half: it makes the blindness *documented* rather than *absent*, so the cloud
  lane still cannot read a single escalation, and the next actor to reason from the wrong premise is
  merely better warned. Passes the no-damage half.
- **(c) Track a committed INDEX of escalations** — one line per open item, tracked — with the bodies
  left ignored. Fails the complete half more narrowly: a reader learns an escalation exists but not
  what it says, and half the failures on record came from acting on a title.

I have **not** changed `.gitignore`. It is a repo-wide policy change with a privacy dimension, which
is squarely his (§5.5), and (b) is not something to land as a consolation while (a) is unanswered.

### F2 — the blind run's F1 is CONFIRMED and EXTENDED, and it does not close `#1635`. **S3 — ACTIONED.**

Re-measured on the live repo (see WHAT I MEASURED) and appended as an ADDENDUM to
`needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md`, which is the
`#1635` thread — six references to it, more than any other file. The addendum carries the eight-row
table, the negative control, and three limits stated before anyone can build on it: the trailer
attributes **who wrote the work, not who pressed merge**; its vocabulary is **uncontrolled** (the new
`GH-Mantova` vs `Marco` split); and it is **author-written, therefore forgeable by construction**, so
it is corroboration and never a gate. RULE 1 reading is unchanged and still Marco's: a signed receipt
verified by `approval-receipt-check.mjs` is the complete-and-additive answer.

**ACTIONED.** Verified by reading the file back: `addendum_present=true`,
`prior_addendum_intact=true`, `head_intact=true`, 377 → 434 lines. ⚠️ Per F1 it reaches nobody but
this box, which is why F1 is filed first.

### F3 — the blind run's F2 landed. **S3 — ACTIONED.**

`merged: false` on every entry of a `list_pull_requests` response, `merged_at` correct in the same
payload. Added as a DOCTRINE §9.4 bullet in the established form — the lie, the truth, the
measurement, the cure — with the two payloads as the control pair and its own falsifying probe
named. Byte delta asserted, `19	0` in `--numstat`, no line-ending rewrite. **ACTIONED**, shipped in
this run's board PR.

### F4 — the board's only red was a real HIGH-severity alert wearing a 3-second failure's clothes. **S2 — ACTIONED.**

Measured above. The fix repeats the substitution to a fixed point, which is the remediation the rule
itself asks for:

```js
let stripped = coveredHtml;
for (let previous = null; previous !== stripped; ) {
  previous = stripped;
  stripped = stripped.replace(/<[^>]*>/g, "");
}
const text = stripped.trim();
```

**This is an unblock and not a mask (§8.2).** The assertion is untouched — the text between the tags
is still required to be non-empty and to be `$0.00`. No test was weakened, skipped or quarantined; no
suppression comment was added; the alert is gone because the code no longer has the defect the rule
names.

🔴 **What is worth carrying forward is the DURATION.** `CodeQL | failure | 3s` is exactly the shape
station rule 5 tells you to re-run as a flake, and re-running it would have re-produced the same
failure and cost the window. The CodeQL *check-run* is a 3-second aggregator; the analysis is
`Analyze (javascript-typescript)`, which took **1 m 33 s**. **A CodeQL duration is not evidence about
anything**, and the alert list — `/code-scanning/alerts?ref=refs/pull/<n>/head` — is the instrument
that answers. **ACTIONED** on this PR; the general point is recorded here rather than in DOCTRINE,
because one instance is a lead and §9 wants a measured trap, not a hunch.

### F5 — `#1690` is SECOND LANE and it is MARCO'S. Driven green, deliberately NOT merged. **S3 — ESCALATED to Marco by leaving it.**

Classification and controls above. Per §10.1 step 4 this is recorded as
**`[NO LANE VERDICT — hand-classified]`** and never as "not routed to Marco". The §10.1 step 3
station-lane exception does **not** apply: `apps/web/src/pages/tendering/**` is not any station's
recorded lane in STATION-CAPABILITIES §5.

Its branch is named `pr-scopesub-s5-sub-tab-ui` — a queue-prompt slug — while no prompt of that name
was ever armed (`.arming-log.txt` has no such row) and no `opened PR #1690` exists. That is the
already-recorded trap that **a branch name is not a lane**, reproducing; not re-raised.

### F6 — `C:\po-vg` still holds one uncommitted file, 45 hours old, and its worktree is still registered. **S3 — DEFERRED.**

[MEASURED] by the sweep: `C:/po-vg  23c91ba9 [fix/no-rebase-while-checks-run]  dirty=1  age=2717 min`,
classified `orphaned worktree ... HOLDS UNCOMMITTED WORK`. The "never pushed" half of this was
**REFUTED** on 2026-09-06T03:3xZ — the branch's content is on `main` as `b42dcc36` (`#1577`) — and
that refutation is not re-litigated here. What survives is one dirty file in a registered worktree
that nothing owns.

**DEFERRED.** It is inert: no station reads it, the guard it carried is running, and `git worktree
remove` will refuse while it is dirty, so it cannot be lost by accident. What would make it urgent:
anything that needs the worktree registry clean, or a second run proposing `--force`. **It is not
mine to prune** — `git status --short` in it first, then a decision, and that is Station 03's lane
(machines, worktrees, clone hygiene). **DISPATCHED → 03** for classification of the single file, with
the standing instruction that `--force` discards it.

## WHAT I DID NOT DO

- **Did not merge `#1690`** — hand-classified Marco's (F5). Driven green and left. Its remaining
  checks (`API`, `tendering-e2e`, `Web`) were still running when this was written; the read-back on
  the one I changed, CodeQL, is `pass`.
- **Did not arm anything.** Armed count was 0 at the start and 0 at the end. No `triage-holds.ps1`
  run and no arming decision was computed, so the FF-before-lint rule was satisfied vacuously as well
  as literally.
- **Did not change `.gitignore`** (F1 option (a)) — Marco's call, and landing (b) instead while (a)
  is unanswered would close the question with the weaker fix.
- **Did not re-raise** escalation #23's `'00': 2` cadence row, the CP-26 label-release path, the
  hourly poller cadence, the three-homes verdict defect, `pr-watcher-verdict-home-resolver-HOLD.md`
  (STAGED, NOT ARMED — ask Marco first), or `#1635` as a new escalation. All are live; F2 was
  appended to the existing thread.
- **Did not touch** `C:\po-watcher` with any write, `sot/`, Azure / Entra / SharePoint, production
  data, or the 28 open `needs-marco/` files other than the one addendum.
- **Did not restart the watcher.** `restart-watcher-if-wedged.ps1` was not run because the sweep
  already reported node RUNNING pid 20000 with the wrapper alive and 0 armed prompts — an idle
  watcher with an empty queue is CORRECT, not wedged, and there was no WEDGED/DOWN verdict to act on.
- **Did not run a smoke.** `#1690` is not mine to merge, so `Assert-SmokedOrEscalate` was never
  reached for it; this run's own board PR is docs-only.
