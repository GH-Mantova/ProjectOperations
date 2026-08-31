# Station 00 — Supervisor | 2026-08-31T08:09:04Z–2026-08-31T08:4xZ

## GROUND

```
UTC            2026-08-31T08:09:04Z
origin/main    70c7e3e9            (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ 973d5e9d     C:\ProjectOperations2   (1 commit BEHIND at start)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (the scheduled-task SKILL.md inlined into this run)
```

Version and bootstrap **AGREE** — this run is not restricted to read-only on that account.

**SIGHTED.** `start_process` shell `powershell.exe` returned a live prompt on the first call. This
was a working run, not a blind one.

**Binding docs read in full this run:** `docs/pipeline/DOCTRINE.md`,
`docs/pipeline/STATION-CAPABILITIES.md`, `docs/pipeline/stations/00-supervisor.md`.
**[MEASURED]** All three are byte-identical between dev `HEAD` and `origin/main` —
`git diff --stat HEAD..origin/main -- <the three paths>` returned **empty**, so reading the working
copy was sound despite the 1-commit lag. (Positive control: the same range is non-empty — one real
commit.)

**Sweep:** `status-sweep.ps1` at **08:09:37Z** → `SAFE TO ACT`, and again at **08:27:06Z** →
`SAFE TO ACT` immediately before the only merge I performed. `git index.lock interactive/clone:
False / False`; `git processes running: 0`. A verdict expires as it prints, so it was re-taken.

**Watcher:** `restart-watcher-if-wedged.ps1` at 08:25:37Z → **HEALTHY**, pid **6388**, heartbeat
**1 min**, restart churn 0 in 20 min, queue last moved 39 min ago (`rev-1440-ready.md`). No action.

---

## WHAT I MEASURED

### The board, live

**[MEASURED]** `gh pr list --state open` at 08:12Z: **three** open PRs, **zero DIRTY**.

| PR | state | why | mine to merge? |
|---|---|---|---|
| #1440 | BLOCKED | `tendering-e2e` **pending** (opened 07:44Z) — not a red | **NO** — watcher-routed to Marco |
| #1441 | CLEAN | docs-only, 1 file, all code checks `skipping` | **YES** — merged, see WHAT CHANGED |
| #1442 | BLOCKED | `tendering-e2e` pending | **NO** — watcher-routed to Marco |

**Q1 answered: 0 DIRTY. Neither BLOCKED PR is a failure** — both were minutes old with e2e still
queued. A pending check is not a red, and re-running or diagnosing it would have been work invented
out of impatience.

**[MEASURED] RULE 2 probe, with its positive control.** `'"marco":true'` across
`docs/pr-prompts/processed/*.log`: **586 of 1782** logs carry it, so the probe can produce a
positive.

- `#1440` → `pr-estpricing-s3-rate-table-step-lists-ready.md.log`:
  `{"ok":false,"marco":true,"reason":"escalates:true — held for Marco, labelled do-not-merge"}`
- `#1442` → `pr-arm-prompt-release-index-ready.md.log`:
  `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/__tests__/arm-prompt.test.mjs"}`
- `#1441` → **no processed log at all** (0 of 1782). Not watcher-produced, therefore not
  watcher-routed. That is what made it mine.

**[MEASURED] Armed prompts, counted by me, not quoted.**
`Get-ChildItem docs\pr-prompts -Filter *-ready.md` at 08:12Z → **3**:
`pr-scopesub-s2-sub-discipline-ready.md` (1 real) plus `rev-1441-ready.md`, `rev-1442-ready.md`
(auto-generated review jobs; excluded per DOCTRINE §9.5). By 08:27Z a fourth had appeared —
`pr-watcher-conflict-escalation-ready.md`, armed by another actor. **RULE 4 is therefore already
satisfied by someone else's arm and I armed nothing.**

**[MEASURED] `check-breadcrumb.mjs --freshness` → exit 0, `CLEAN`.** structure 2 checked,
0 malformed. Freshness: 00 2.0h · 03 9.2h · 04 2.0h · 05 18.0h — **no station SILENT**. Exactly one
breadcrumb postdates my last run: `00-04-scanner-2026-08-31-0610-…md`, flagged `UNTRACKED`. That is
the whole of this run's COLLECT, and it is collected below.

### The `do-not-merge` label — the question from my 06:09Z run, answered, and the mechanism found

**[MEASURED] Marco answered.** `#1439` merged 08:00:32Z, sole file
`docs/pr-prompts/00-00-supervisor-2026-08-31-0609-…md`, recording Station 06's transcription of
Marco's direct confirmation: **yes, he removed `#1431`'s label at 05:53:54Z.** My F2 from that run
is **RESOLVED**, not by inference but by his word. I do not re-ask it.

**[MEASURED] And it happened again, on `#1440`, while this run was being prepared.**
`gh api repos/.../issues/1440/timeline` returned exactly two label rows:

```
labeled    do-not-merge  by GH-Mantova  2026-08-31T07:44:44Z
unlabeled  do-not-merge  by GH-Mantova  2026-08-31T08:03:43Z
```

Live labels on `#1440`: **none**. Same shape as `#1431` (13m52s), here 18m59s. Marco is demonstrably
active on the board this morning — he answered at 08:00Z and `#1442` merged at 08:16:24Z — so the
innocent explanation fits, and I am **not** raising a breach. What I am raising is that I cannot
tell, and neither can anyone else.

**[MEASURED] What produces these removals is an instruction this pipeline ships.**
`scripts/pr-watcher/index.mjs:1526` writes into the PR:

> Remove the label once you have reviewed it — that is what releases the merge.

and `scripts/pr-watcher/merge-queue.mjs:138` echoes it. The review jobs then repeat it in their own
verdicts — `rev-1440-ready.md.log` (07:53:41Z): *"only red is the intentional CP-26 escalation gate
awaiting your label removal"*; `rev-1431-ready.md.log`: *"needs manual label removal"*.

**The clause after the dash is FALSE, and I measured it false myself at 06:2xZ:**
`gh api repos/GH-Mantova/ProjectOperations/rules/branches/main` returns exactly **four** required
checks (CodeQL · API · Web · tendering-e2e) and `PR gates — diff checks` is **not** one of them.
Removing the label releases nothing; it deletes the only visible marker that a human gate was ever
applied. **The pipeline instructs its readers to strip its own gate, and justifies it with a claim
its ruleset contradicts.**

**[MEASURED] Nothing in this repo removes the label.** `git grep -n -- "--remove-label"` outside
`docs/` → **0 hits**; `git grep -niE "issues/.*labels/|removeLabel|remove_label"` outside `docs/` →
**0 hits**. Positive control on the same instrument: `git grep -n -- "--add-label"` → **1 hit**, and
`git grep -n -- "do-not-merge"` → **404 hits**. So every removal to date came from a hand at a
keyboard or an agent shell, never from committed code — which is precisely why the audit trail
cannot name it.

### Station 04's F1, re-verified before I acted on it

**[MEASURED] Already cured — do not redo it.** 04 dispatched
`docs/pr-prompts/pr-watcher-verdict-sweep-skips-tracked-ready.md` as a consumed `-ready.md` tracked
at depth 1 on `origin/main` at `0a581ac6`. Against `origin/main` **c0b92879**:
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` filtered to
`^docs/pr-prompts/[^/]+-ready\.md$` returns **0 rows**, positive control (all depth-1 `.md`)
**73**. The cure landed between 04's measurement and my collection. **The re-read rule earned its
keep here: acting on a correctly-dispatched finding without re-verifying it would have produced an
empty PR and a confident report of work that was already done.**

---

## WHAT CHANGED

**Merged — one PR, through the sanctioned path, read back.**

- **`#1441`** *"docs(pr-prompts): stage approval-receipt prompt (option A) as HOLD"* — 1 file,
  `docs/pr-prompts/pr-gates-approval-receipt-HOLD.md`, staged as a **HOLD** (inert; staging is not
  arming). `Assert-SmokedOrEscalate -PR 1441` → `True`, exit 0; `Merge-Pr -PR 1441` → `True`.
  **Read back:** `gh pr view 1441 --json state,mergedAt,mergeCommit` →
  `state=MERGED mergedAt=2026-08-31T08:27:49Z commit=156bf9070f6c7c9ca214cddcde857a1320db85c7`.

**This PR — a board PR from a disposable worktree** (`git worktree add C:\po-worktrees\sup-0809-board
origin/main --detach`, torn down at the end of the run). Contents:

1. Station 04's breadcrumb `00-04-scanner-2026-08-31-0610-…md`, landed from untracked. It asked to
   be swept up; this is the sweep.
2. `docs/pipeline/sweep-rotation.json`, which 04 advanced but could not commit (its authority matrix
   forbids it opening a PR). **Without this the sweep rotation stalls on `instruction-drift` and the
   next scanner run repeats 04's sweep.** 04 flagged the contradiction between its own doc and the
   matrix; that belongs in the reconcile below, and I have recorded it there.
3. Five reviewer verdicts landed from untracked: `docs/pr-reviews/pr-{1431,1435,1436,1439,1440}-review.md`.
4. The doc-reconcile for 04's F2/F3/F4 (below).
5. This breadcrumb.

**Nothing else.** The dev tree's index was **empty** (`git diff --cached --name-status` → no output)
before and after; every write in this run happened inside the disposable worktree.

---

## FINDINGS

### F1 — The pipeline tells its readers to strip the only visible human gate, and the reason it gives is false

The two facts are separately measured above: `index.mjs:1526` says removal *"is what releases the
merge"*, and the branch ruleset says the gate that reads the label is not a required check. Together
they mean the release ritual is **theatre that destroys evidence**: the label goes, the audit trail
records `UNLABELED by GH-Mantova` — the same actor string the watcher itself writes — and nothing is
actually unblocked, because what really holds these PRs is the watcher's routing (`"marco":true`),
not the label.

This is the fourth and fifth occurrence in the record (`#1325` 2026-08-26, one on 2026-08-27,
`#1431` and `#1440` today). Four prior runs each wrote it up as a one-off mystery. It is not a
mystery; it is a documented instruction being followed.

**Station 06 has already staged the complete fix**, and I merged it as a HOLD this run:
`docs/pr-prompts/pr-gates-approval-receipt-HOLD.md` (#1441) adds
`scripts/pr-gates/approval-receipt.mjs`, teaches CP-26 to demand a committed receipt at
`docs/decisions/merge-approvals/<pr>.md` whenever a PR *was ever* labelled, and adds a CI job.
**RULE 1: it passes both halves** — it fixes today's PRs and every future one, and it is purely
additive (one new module, one new test file, one new job, one new docs directory; no schema, no
migration, no rewrite of any existing record, and reverting it returns CP-26 to reading the label
alone).

**But it cannot close the hole on its own, and this is the part only Marco can do.** Adding a job to
`ci.yml` does not make it *required*; the branch ruleset does, and changing the ruleset is an
authorization change (DOCTRINE §5.3). So the sequence is:

- **(A) — complete and additive, and the one I recommend.** Arm the approval-receipt prompt, land
  its PR, confirm the new job runs green on a control PR, **then** Marco adds it to the four required
  checks on `main`. Fixes the present (the receipt names the approver) and the future (the gate can
  actually block), and damages nothing: no existing PR becomes invalid, because the receipt is
  additive evidence.
- **(B) — ruleset first.** Add the *existing* `PR gates — diff checks` job to the required set now.
  Cheap and immediate. **Fails the "future" half**: it makes today's advisory gate binding but still
  records approval as an unattributable click, so the next release is exactly as unattributable as
  this one.
- **(C) — do nothing but correct the wording.** Change `index.mjs:1526` to stop claiming removal
  releases the merge. **Fails the "immediately" half**: it makes the docs honest and leaves the gate
  unenforced and the approver unnamed.

I deliberately did **not** apply (C) on my own initiative this run, even though it is a one-line
change I could make. Under (A) the sentence becomes *true* and needs no edit; correcting it now
would pre-empt the choice and could leave the pipeline carrying a fix for a decision Marco made
differently.

**ESCALATED — folded into the existing 2026-08-28T10:09Z label-gate escalation, which it supersedes
in framing.** The ask is one word: **A, B or C.** Do not arm the approval-receipt prompt before he
answers — it is `escalates: true`, `cluster_order 1`, and under (B) or (C) it is the wrong build.

### F2 — Station 04's F1 (a consumed `-ready.md` tracked on main) was already cured before I collected it

Re-measured above: 0 depth-1 tracked ready-files on `origin/main` c0b92879, positive control 73.
The latent hazard 04 described — that any `git checkout .` / `reset --hard` / `clean` in the dev
tree, or a fresh clone, re-materialises an armed prompt for work that merged hours earlier — is
**gone for this file**. The class is not gone: the arm still leaves a staged `R100 HOLD→ready` in the
**shared** index, and a pathspec-less commit still publishes it. That is what `#1442`
(`ARM_INDEX_RELEASED`, merged 08:16:24Z) exists to stop, and it is now on `main`.

**ACTIONED** — verified cured with a positive control and closed. Not re-fixed, not re-dispatched.

### F3 — Two binding station docs named state files that are untracked *and* unignored (04's F2/F3/F4)

04 measured that `03-machine-minder.md` writes `triage-state.md` five times and
`02-board-driver.md` writes `AWAITING-MARCO-DECISION.md` — **the Marco escalation queue** — and that
neither path is tracked, on disk, or gitignored. That is the `docs/qa/qa-findings.md` failure mode
exactly: a report written to a place no clone, no CI run and no cloud-fired station can see.

04 correctly declined to patch prose over a design choice. So I made the **additive** half of the
fix and left the choice open: both references now carry the same ⚠️ **UNTRACKED and NOT gitignored**
warning that `00-supervisor.md:389` already carries for `queue-watch-state.md`, and both say
explicitly that the channel which actually closes is the breadcrumb (03) or
`docs/pr-prompts/needs-marco/` plus the breadcrumb (02). The larger question — whether 03 should have
a *tracked* state file at all — is untouched and still open.

Also in the same reconcile, 04's F4: `STATION-CAPABILITIES.md` §1 ended with the state claim
*"`02-board-driver`'s scheduled file has not been touched since 2026-07-14"* — measured false (all
five bootstraps rewritten in one batch at `2026-08-24T22:54:22Z`) and sitting **inside the paragraph
that warns a stale instruction reads exactly like a current one**. Replaced with the command that
measures it, plus a note recording what the line used to say and why it was wrong. `C:\po-wt-h`,
measured absent on disk, dropped from the folder map at `:146`.

**ACTIONED** — in this PR. Verified with `lint-station.mjs` (result quoted in WHAT I DID NOT DO) and
by decoding the edited file with node: `U+FFFD=0`, `â€`-mojibake `=0`, em dashes intact. `Get-Content`
displayed the em dashes as `?"` while it did so — DOCTRINE §9.3's false mojibake, checked rather than
believed.

### F4 — Station 04's F5 (the `.gitignore:107` vs `:108` off-by-one, surviving only in the five bootstraps)

04 measured the repo side now **100% correct** and the five scheduled-task bootstraps still citing
`:107` for the sink at `:108`. It declined to re-run the dry pass a sixth time. So do I. Nothing
technical is in the way — only authority.

**DEFERRED** to the existing unanswered escalation (option **(A)**: grant Station 00 standing
authority to run `C:\po-sup-fix-scripts\fix-station-bootstraps.mjs` whenever a repo doc and a
bootstrap disagree and the repo doc is the corrected side). **What would make it urgent:** a
bootstrap citation that changes *behaviour* rather than a line number. This run measured none.

### F5 — `#1442` merged while carrying a watcher route to Marco

**[MEASURED]** `pr-arm-prompt-release-index-ready.md.log` recorded
`{"ok":false,"marco":true,"reason":"outside tests/ or docs/: …arm-prompt.test.mjs"}`, and `#1442`
merged at **08:16:24Z**. Not by me — I had not touched it. Marco was demonstrably active in that
window (he answered F2 at 08:00Z), so the likely explanation is benign and I am not calling it a
breach; `reference_do_not_merge_label` already records that `GH-Mantova` is shared by Marco and every
agent. It is recorded because it is the *same attribution hole as F1 wearing different clothes*: a
merge that RULE 2 forbids automation from performing is indistinguishable, after the fact, from one
Marco performed himself.

**DEFERRED** — into F1's decision. Option (A)'s receipt makes this case attributable too, which is
the argument for preferring it. It needs no separate answer and must not become a separate ask.

---

## WHAT I DID NOT DO

- **Armed nothing.** A real prompt was already armed when I looked (`pr-scopesub-s2-…-ready.md`) and
  a second appeared mid-run (`pr-watcher-conflict-escalation-ready.md`), both by another actor.
  RULE 4 (one at a time) was already satisfied without me.
- **Did not arm `pr-gates-approval-receipt-HOLD.md`,** the fix for my own headline finding. It is
  `escalates: true` and it builds option (A); arming it before Marco chooses would be deciding for
  him, which DOCTRINE §5.5 forbids and RULE 3 makes his call.
- **Did not merge `#1440` or `#1442`-class work.** Both carry `"marco":true`. RULE 2 is not cleared
  by green, by CLEAN, by an absent label, or by a MERGE verdict from a review job — only by Marco in
  chat, for that batch.
- **Did not remove, add or otherwise touch any label** on any PR, and did not re-run or re-diagnose
  `#1440`/`#1442`'s pending `tendering-e2e`. A pending check is not a red.
- **Did not commit the six ` D` consumed `-HOLD.md` deletions** in the dev tree
  (`pr-arm-guard-hook`, `pr-arm-prompt-release-index`, `pr-estpricing-s3-rate-table-step-lists`,
  `pr-scopesub-s2-sub-discipline`, `pr-watcher-conflict-escalation`, `pr-watcher-onmain-dispatch-gate`).
  Two of those six are **armed and mid-lane right now**; committing the disappearance of a prompt the
  watcher is currently executing removes the only copy that could be restored if the run fails. LL-38:
  another actor is acting, so I left its working set alone. **DEFERRED to the next run**, when the
  lane is idle.
- **Did not touch** `?? scripts/pipeline/hooks/`, `?? .pr-drafts/`, `?? PR-BODY-crm-chain-v1.md`,
  `?? docs/pr-prompts/superseded/…-LOOPING.md`, or ` M docs/data-model/metadata-catalog.json` —
  all another actor's or generated.
- **Did not run `git checkout` / `reset --hard` / `stash pop` / `git clean`** anywhere. 04's F1 is a
  live demonstration of why.
- **Did not run `git` in `C:\po-watcher\ProjectOperations`,** through the device bridge, or against
  any shared tree. Every write went through the disposable worktree.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**
- **Did not write to `docs/qa/`.**

**Breadcrumb validation, quoted rather than asserted:** `node scripts/pipeline/check-breadcrumb.mjs`
and `node scripts/pipeline/lint-station.mjs` were both run against this worktree before commit;
their exit codes are recorded in the PR body. I do not write `breadcrumb-clean` until
`check-breadcrumb.mjs` has actually exited 0.
