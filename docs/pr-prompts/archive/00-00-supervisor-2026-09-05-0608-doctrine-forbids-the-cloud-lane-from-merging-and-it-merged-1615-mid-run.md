# Station 00 — Supervisor | 2026-09-05 06:08Z–06:35Z

## GROUND

```
UTC            2026-09-05T06:08:20Z
origin/main    21f4820f            (fetched, then rev-parse; moved 87bb2e3f -> e92fac6c -> 21f4820f during this run)
dev tree       main @ 21f4820f     C:\ProjectOperations2   (fast-forwarded this run, 0 0)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task file)
```

Versions agree. SIGHTED run — Desktop Commander reached the box on the first call.
Three binding documents read in full this run; `git diff --numstat origin/main --` over all three
returned EMPTY, so the working copies are byte-equal to `origin/main` (PREFLIGHT step 2, the
non-piped form).

`status-sweep.ps1` at 06:09:10Z: **SAFE TO ACT** — 0 in-progress prompts, no `index.lock` in either
tree, 0 git processes, no PR touched in the last 2 minutes.

## WHAT I MEASURED

**[MEASURED] The board moved three times while this run was reading its own instructions.**
`origin/main` was `87bb2e3f` at 06:08:2xZ, `e92fac6c` by the fetch seconds later, and `21f4820f`
by 06:1xZ. `gh pr list --state open` returned **2** at 06:09:10Z (#1640, #1615) and **1** at
06:15Z (#1640 only) — **#1615 merged at 06:10:00Z**, one minute after the sweep read it
`BLOCKED, 13 pass / 0 fail / 1 pending`.


**[MEASURED] Watcher healthy.** `status-sweep.ps1` §2: node **RUNNING pid 20000**, auto-restart
wrapper alive (1), heartbeat age 36 min with an **empty queue** — idle, not wedged. The watcher is
also demonstrably working: the three newest `docs/pr-prompts/processed/*.log` are
`rev-1643-ready.md.log` (05:33:53Z), `rev-1642` (05:31:44Z), `rev-1641` (05:28:06Z) — auto-generated
review jobs for PRs it did not open.

**[MEASURED] The queue is empty and nothing has been armed for eight hours.**
`Get-ChildItem docs\pr-prompts -Filter *-ready.md` → **0**. `.arming-log.txt` newest row
`2026-09-04T22:03:13Z ARMED pr-crmui-account360-s1-tiles-and-next-action`. Every PR that merged
between 02:40Z and 06:10Z therefore reached `main` **without an arm**.

**[MEASURED] RULE 2 probe, pinned to the live tree and controlled.**
`C:\ProjectOperations2\docs\pr-prompts\processed` — `marco.:true` → **612**, negative control
`zzzNoSuchNeedleZzz` → **0**, newest log 2026-09-05T05:33:53Z (younger than the oldest open PR, so
this is the live directory and not the watcher-clone decoy).
Prompt-logs only, `rev-*` excluded, `Select-String -Path docs\pr-prompts\processed\pr-*.log`:
`PR #1640` → **0** · `PR #1615` → **0** · `PR #1639` → **0** · `PR #1642` → **0** · `PR #1643` → **0**;
negative control `PR #999999` → **0**. `[NO LANE VERDICT — hand-classified]` for all five.

**[MEASURED] #1640 — the only open PR — is Marco's.** `BEHIND`, unlabelled, created 05:07:12Z,
head `pr-cardfix-s3-plant-picker`. Files: `apps/web/src/components/TooltipSelect.tsx`,
`apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx`,
`apps/web/src/pages/tendering/__tests__/wbs-plant-picker-groups.test.tsx`. The first two are outside
all three `NESTED_TEST_PATHS` forms and there are 0 `migrations/` paths ⇒ `classifyPolicyFiles`
refuses ⇒ **MARCO'S. NOT MERGED.** The watcher's own review
(`C:\po-watcher\ProjectOperations\docs\pr-reviews\pr-1640-review.md`) returns `VERDICT: MERGE` —
which does not clear RULE 2 and did not change this decision.

**[MEASURED] Five CP-26 receipts now name their own author, and it is not Marco.**
`docs/decisions/merge-approvals/` holds **14** files (13 receipts + `README`). Five —
`1614.md` `1615.md` `1616.md` `1619.md` `1621.md` — carry the identical sentence:

> *"The text was written by the Station 00 cloud lane on his instruction; the approval is his, and
> it is independently checkable in the label timeline."*

`git log --oneline -1 -- docs/decisions/merge-approvals/<n>.md` shows each landed **in its own PR's
squash commit** — `322b09ca (#1614)`, `21f4820f (#1615)`, `06981b12 (#1616)`, `472ae67c (#1619)`,
`889683b9 (#1621)`. The 05:4xZ amendment to
`needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md` already records
the authorship and already refutes the "independently checkable" half (every label event reads actor
`GH-Mantova`, which is also how every agent authenticates). **Not re-raised here.**

**[MEASURED] What IS new: that amendment's own worked example resolved against it.** It states, at
05:4xZ, *"#1615 is still OPEN, still unlabelled, and named in that release batch. It was NOT
merged."* #1615 merged **24 minutes later, at 06:10:00Z**, carrying `merge-approvals/1615.md` inside
its own diff, while RULE 1 option (a) on that escalation is unanswered.

**[MEASURED] Freshness — every station reported.** `node scripts/pipeline/check-breadcrumb.mjs
--freshness` → `structure: 11 checked, 0 malformed`, `CLEAN`, exit 0.
`00` 1.0h · `03` 7.2h · `04` 4.0h · `05` 16.0h, all `ok`. Per escalation #23 `ok` is not an
all-clear, so crossed against the run record: 00's live cron is hourly and 05:08Z→06:08Z is one
occurrence, unbroken. One new breadcrumb since my last run:
`00-06-pr-master-2026-09-05-0515-two-lost-mockups-were-pdfs-not-artifacts-and-both-are-rebuilt.md`.

**[MEASURED] Machine hygiene, both read-only.** Watcher clone `C:\po-watcher\ProjectOperations`:
` M docs/data-model/metadata-catalog.json`, `?? docs/pr-reviews/pr-1640-review.md`,
`?? scripts/pr-watcher/.conflict-notified-prs.json`. Orphaned worktree `C:\po-vg`
(`fix/no-rebase-while-checks-run`, 1336 min old) holds one uncommitted file,
`scripts/pipeline/check-pipeline-heartbeat.mjs` — real work, not a stray.

**[CANNOT MEASURE]** whether #1615 was merged through `Assert-SmokedOrEscalate` → `Merge-Pr` or by
hand. `mergedBy` reads `GH-Mantova` for every merge on this board, agent and human alike.

## WHAT CHANGED

- Fast-forwarded the dev tree `87bb2e3f` → `21f4820f`. Read back:
  `git rev-list --left-right --count HEAD...origin/main` → `0	0`, `git diff --numstat` → EMPTY,
  `git diff --cached --name-status` → EMPTY. No untracked breadcrumb blocked it this run, because
  the previous run's copy went out inside its own PR (cure 1) — the first run since that rule was
  written to pay nothing for the fast-forward.
- Created disposable worktree `C:\po-worktrees\board-0608` off `origin/main` and wrote this
  breadcrumb **inside it**, per the REPORT CONTRACT's preferred home. Torn down after the PR opens.
- Appended one amendment to
  `needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md`.
- **No board mutation. Nothing armed, nothing merged, no label touched.**

## FINDINGS

### F1 — DOCTRINE §10.2 forbids exactly what the receipts say is happening, and no exception is recorded on `main`

§10.2 *"A cloud session is a CODE-WRITING lane. It cannot drive the board"* lists what such a lane
**may not** do: *"arm or disarm a prompt, **merge anything**, mutate `docs/pr-prompts/`, touch
`/sot/`, or **act as a second supervisor**."* Five committed receipts state that a **Station 00
cloud lane** wrote them on Marco's instruction and drove those PRs to merge. Both cannot be right.

The practical cost is not the merges — Marco may direct whatever lane he likes. It is that **the
document a headless run obeys and the practice Marco is running disagree, and the headless run is
the one that will be wrong.** Tonight that produced a measurable waste: four consecutive scheduled
00 runs (00:08Z, 01:08Z, 03:08Z, 05:08Z) each re-derived "an unattributable actor is releasing PRs"
from first principles, one of them as a suspected attack, because §10 gave them no lane that could
legitimately be doing it. This run makes five.

I cannot fix it. Recording a ruling I have not heard is guessing Marco's intent (DOCTRINE §5.5).

**RULE 1 options — complete-and-additive first:**

**(a)** Add a named, bounded exception to §10.2: *"Station 00 may also run as an interactive or
cloud lane under Marco's direct supervision; such a lane merges only PRs he has released in chat,
and every merge it makes leaves a `merge-approvals/<N>.md` receipt naming the lane."* Then add that
lane to the `STATION-CAPABILITIES.md` §5 matrix so §10.1 step 3 can classify it, which is where a
lane is supposed to be declared. **Complete:** every future headless run reads a doctrine that
matches reality and stops re-deriving this. **Additive:** removes no gate — the `do-not-merge`
label, CP-26 and a real watcher `marco:true` verdict all still bind, and §10.1 step 3 already
requires a lane to be *recorded* before it can be classified by the matrix. **Both halves pass.**
*(§10.1's own proviso applies: a new lane outside `tests|docs` needs a CI gate proving its boundary
— for this lane that gate is the receipt check in option (a) of the CP-26 escalation, which is why
these two decisions belong together.)*

**(b)** Hold the line: the cloud lane stops merging and hands every release to the scheduled 00.
**Fails the immediate half** — it stops work Marco is actively getting done, and it makes the board
wait up to an hour on a station that is forbidden from clearing RULE 2 anyway.

**(c)** Leave the contradiction. **Fails the future half** — every scheduled run keeps paying to
re-discover it, and one of them will eventually resolve it the dangerous way and merge something.

**DISPOSITION: ESCALATED** — `needs-marco/`, appended to the existing CP-26 file rather than filed
separately, because (a) here and (a) there are one decision.

### F2 — the CP-26 escalation's own worked example merged while the escalation was open

`#1615` was the evidence in the 05:4xZ amendment for *"an agent-authored clearance is not RULE 2
cleared"*. It merged at 06:10:00Z with its receipt inside its own diff. Nothing was violated that
the escalation had not already named — this is the same open question, now with the outcome it
predicted. **DISPOSITION: ESCALATED** (folded into F1's amendment; not re-raised as new — cf.
`#1635`, which already carries the authorship finding).

### F3 — Station 06's finding 3: two admin routes carry no permission guard

From `00-06-pr-master-2026-09-05-0515-…`: `/admin/schedule-of-rates` (`App.tsx:613`) and
`/workers/job-roles` (`App.tsx:377`) are bare `<Route>` elements while their neighbours at 528, 541,
549, 558 and 570 are wrapped in `<RequirePermissions>`. Any signed-in user can open both today.
06 correctly refused to invent a permission and blocked `pr-settings-home-s1` on it. This is an
authorization question ⇒ Marco's by hard stop 3, and it is **not** in `needs-marco/` — it exists only
inside 06's breadcrumb, which is a report, not the escalation channel.
**DISPOSITION: ESCALATED** — filed to `needs-marco/` this run so it survives outside the breadcrumb.

### F4 — 06's findings 1, 2 and 4 are complete; 5 and 6 are genuinely parked

1, 2 and 4 (the two "lost artifacts" were PDF filenames; both rebuilds are faithful; the old
settings mock-up's stale counts) are **ACTIONED** by 06 and verified landed: its staged prompt
`pr-artifactregister-s2-name-what-is-missing-HOLD.md` is on `main` as of `#1643`, `-HOLD`, unarmed.
5 (`erp-theme-system-mockup` still unlocated) and 6 (`CRM drop reasons` keeps a GUESS description)
are **DEFERRED** as 06 filed them — 6 becomes urgent the moment `pr-settings-home-s1` is armed,
which F3 already blocks. **DISPOSITION: ACTIONED** (collected and dispositioned; nothing outstanding
for another station).

### F5 — machine hygiene, both untouched and both 03's

The watcher clone is not clean on `main` (` M docs/data-model/metadata-catalog.json` plus two
untracked files), which the sweep flags as *"the watcher may refuse to start"* — it has not, and the
watcher is running, so this is drift and not an outage. `C:\po-vg` is an orphaned worktree 22.3 h old
holding one uncommitted file, `scripts/pipeline/check-pipeline-heartbeat.mjs`; `git worktree remove`
will refuse and `--force` would discard real work.
**DISPOSITION: DISPATCHED to 03-machine-minder** — preserve `check-pipeline-heartbeat.mjs` (commit it
somewhere or copy it out) *before* pruning `C:\po-vg`, and reconcile the clone's
`metadata-catalog.json` drift. Neither is mine to repair (LL-38) and neither is urgent.

## WHAT I DID NOT DO

- **I did not merge #1640**, and I did not update its BEHIND branch. Hand-classified Marco's under
  §10.1 step 2 (two `apps/web/src` paths outside all three `NESTED_TEST_PATHS` forms). The watcher's
  `VERDICT: MERGE` does not clear RULE 2, and a green review has never been a release.
- **I did not arm anything**, including `pr-artifactregister-s2-name-what-is-missing-HOLD.md`, which
  is docs-only and lints ADMIT. Two reasons, either sufficient: arming is a board mutation and
  BOARD DRIVING condition 3 was violated inside this run — #1615 merged 110 seconds after my
  safe-to-act verdict printed, so the "single actor" precondition was false while I held a verdict
  saying it was true; and the standing rule is to ask before arming at all when Marco is demonstrably
  awake and driving the same board.
- I did not touch the `do-not-merge` label on anything, and I authored no `merge-approvals/` receipt.
- I did not clear `needs-marco/agent-authored-rule-2-clearance-2026-09-04.md` despite six `[STALE]`
  lines in sweep §5 saying its referenced PRs are merged. The escalation is about whether an
  agent-authored clearance binds at all; the PRs closing does not answer that.
- I did not re-raise the receipt-authorship finding as new. It is `#1635` and the 05:4xZ amendment;
  this run added the outcome, not the finding.
- I did not repair the watcher clone or prune `C:\po-vg` (F5, dispatched to 03), and I ran no `git`
  write in either.
- I did not run `git checkout .`, `checkout -- <dir>`, `reset --hard`, `stash pop` or `git clean`
  anywhere.
