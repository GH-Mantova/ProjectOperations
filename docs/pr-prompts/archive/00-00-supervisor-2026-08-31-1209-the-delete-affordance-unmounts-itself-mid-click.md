# Station 00 — Supervisor | 2026-08-31T12:09Z–2026-08-31T12:55Z

## GROUND

```
UTC            2026-08-31T12:10:24Z
origin/main    3985d74f            (fetch first, then rev-parse)
dev tree       main @ 3985d74f      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run acted.
SIGHTED: `start_process` (powershell.exe) succeeded on the first call. This was **not** a blind run.

## WHAT I MEASURED

- `[MEASURED]` `git rev-parse --short origin/main` → `3985d74f`; dev tree `main @ 3985d74f`,
  `git rev-list --left-right --count origin/main...HEAD` → `0 0`. Index EMPTY
  (`git diff --cached --name-status` → nothing). `git worktree list` → the dev tree only.
- `[MEASURED]` `git status --short` → **9 entries**, of which exactly one is a tracked change:
  ` D docs/pr-prompts/pr-crm-s9-new-thread-anchored-HOLD.md` — a CONSUMED prompt (it produced
  #1450). The other 8 are the standing untracked set. **The ` D` backlog is 1, not 0.**
- `[MEASURED]` `status-sweep.ps1` → **§7 VERDICT: SAFE TO ACT — no board mutation in progress, no
  recent remote activity.** Sweep completed 12:15:49Z.
- `[MEASURED]` `restart-watcher-if-wedged.ps1` (no `-Fix`) → `armed prompts waiting: 0` ·
  `watcher process: ALIVE (pid 32916)` · `restart churn: 0 cycle(s) in 20 min` ·
  `VERDICT: OK - nothing armed and the watcher is alive.` Same pid as the 10:09Z run.
- `[MEASURED]` `Get-ChildItem docs\pr-prompts -Filter *-ready.md` → **count 0**. ARMED = 0.
- `[MEASURED]` `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`.
  `structure: 4 checked, 0 malformed`. Freshness: 00 2.2h · 03 13.4h · 04 2.2h · 05 22.2h —
  **no station SILENT**. 05 is at 22.2h against a 24h cadence: due, not late.
- `[MEASURED]` `git log --oneline 021af454..origin/main` → exactly one commit:
  `3985d74f feat(crm-s8): register V2 … (#1447)`. #1447 merged since the 10:09Z run; **not by me.**
- `[MEASURED]` Open PRs (`gh pr list --state open --json …`, 2 rows):
  `#1450 CLEAN unlabelled` (crm-s9 AnchorPicker) and `#1443 BLOCKED unlabelled` (SUB discipline).
- `[MEASURED]` **RULE 2 probe, with both controls.** Corpus `docs/pr-prompts/processed/*.log`:
  positive control `'"marco":true'` → **591 files**; negative control `'zzz-not-present-needle-zzz'`
  → **0**. Then per-PR:
  - `#1450` → `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/crm/AccountDetailPage.tsx"}`
  - `#1443` → `{"ok":false,"marco":true,"reason":"escalates:true - PR already carries \`do-not-merge\` - no duplicate apply"}`
  **BOTH open PRs are Marco's. I merged neither.**
- `[MEASURED]` `#1443` head before I touched it: `8d2a2154`, `updatedAt 2026-08-31T10:57:41Z`. Its
  last three commits are all `GH-Mantova` merge-from-main (10:27:39Z / 10:35:42Z / 10:57:39Z) —
  **no `PR Supervisor` commit newer than this run's start**, so the concurrency trigger the 10:09Z
  run left for me was satisfied and the PR was mine to fix.
- `[MEASURED]` `#1443` checks: **only `tendering-e2e` fails** (12m15s). All 12 others pass,
  including `PR gates — diff checks`. `#1450` is **13/13 green** and `CLEAN`.

### The #1443 red, root-caused from the job log and the Playwright artifact — never from the diff

- `[MEASURED]` `gh run view 33384751545 --job 99464791262 --log` → **1 failed**:
  `batch8-misc.spec.ts:127:7 › card creation discipline picker gates Create until a discipline is
  chosen (PR #248)`, `Error: locator.click: Test timeout of 60000ms exceeded` at `:161`
  (`page.getByLabel("Delete card Asbestos removal").click()`). The call log is the finding:

  ```
  - locator resolved to <button … aria-label="Delete card Asbestos removal">×</button>
  - attempting click action
    - element is visible, enabled and stable
    - scrolling into view if needed
  103 × element was detached from the DOM, retrying
    - element is not stable
  ```

  **103 detachments in 60 s ≈ one every 0.6 s. The element being clicked destroys itself.**
- `[MEASURED]` `gh run download 33384751545 -n playwright-report` → the page snapshot and
  `test-failed-1.png`. The card tab strip at the moment of failure is
  `DEM1(4) · CIV1(3) · ASB1(4) · Other1(5) · SUB1(0)` on row one and **`ASB2 Asbestos removal (0) ×`
  wrapped onto row two** with `+ Add card`. **The fifth discipline pushed the strip onto two rows.**
- `[MEASURED]` `apps/web/src/pages/tendering/scope-cards/ScopeCardTab.tsx:112` (a file **#1443 does
  not touch**): the delete button is *conditionally mounted* —
  `{hovered && !editing && card.itemCount === 0 ? (<button …>×</button>) : null}`.
- `[INFERRED]` **The cause.** Mounting the `×` on hover changes the tab's width the instant the
  pointer arrives. On a wrapped strip that width change reflows the row, moves the tab out from
  under the pointer, fires `mouseleave`, and unmounts the button *while Playwright is mid-click*;
  the tab then shrinks back under the pointer and the cycle repeats. `scrolling into view if
  needed` supplies the same effect by a second route — the viewport moves under a pointer that has
  not moved. Either route, the mechanism is one thing: **a hover-mounted affordance cannot survive
  a layout change caused by its own mounting.**
- `[MEASURED]` **This is not the known flake and it is not a main regression.** `#1450` — a
  different code PR on the same base — ran the identical `tendering-e2e` suite at 11:12Z and
  **passed**. The failure is specific to the branch that adds the fifth discipline.
- `[MEASURED]` The defect is nevertheless **latent on `main`**: `ScopeCardTab.tsx` is unchanged by
  #1443. Any tender with enough cards to wrap the strip flickers today. #1443 did not create the
  bug; it crossed the threshold that makes it reachable.
- `[MEASURED]` Blast radius of the cure: `Select-String "Delete card"` over `apps/web/src` and
  `tests/` → **2 call sites, both in `batch8-misc.spec.ts` (:136 self-heal, :161 cleanup)**, and
  **no unit test** asserts the button is absent when unhovered.

## WHAT CHANGED

1. **Pushed one commit to `#1443`'s branch.** `7235c280` on
   `worktree-agent-a5238d83533bcf1fd`, `8d2a2154..7235c280`, `PUSH_EXIT=0`, written in a
   **disposable worktree** (`C:\po-worktrees\sup-1443-fix`) taken off the branch, never in the dev
   tree and never in `C:\po-watcher`. Before pushing, the script re-read
   `origin/worktree-agent-a5238d83533bcf1fd` and **would have aborted if it had moved off
   `8d2a2154`** — the LL-38 guard, executed rather than asserted.
   Read back: `gh pr view 1443 --json headRefOid` → **`7235c2809f19d48e0ea2de1f0183cc8d372ff9d9`**.
   The change, one file, 16+/2−: the `×` is now MOUNTED whenever the card is empty and only its
   `visibility` toggles on hover. The tab's width becomes independent of hover, so no reflow can
   detach the element being clicked. `visibility: hidden` still reserves layout, and a hidden
   element is not clickable — the test hovers first, so the affordance behaves exactly as before
   for a user and for Playwright.
2. **Nothing merged.** Both open PRs are watcher-routed to Marco (measured above).
3. **Nothing armed.** ARMED was 0 and stayed 0.
4. This board PR: the breadcrumb, the four dispositioned breadcrumbs archived, and the consumed
   `pr-crm-s9-new-thread-anchored-HOLD.md` deleted from `main`.

## FINDINGS

**F1 — `#1443` is red on a real UI defect, and the defect is on `main`.**
The `×` on an empty scope-card tab is mounted on hover, so hovering changes the tab's width; once
the strip wraps, that width change reflows the tab out from under the pointer and unmounts the
button mid-click. Root-caused from the job log and the Playwright artifact (§3: never from the
diff), with `#1450`'s green run on the same base as the control that rules out a main-wide
regression or the known flake.
**DISPOSITION: ACTIONED** — fixed in place on `#1443`'s branch (`7235c280`, head read back). RULE 1:
this is the complete-and-additive option — it cures the PR *and* the latent `main` defect in one
move, changes no data and no data entry, and holds for every future card at any wrap boundary.
The alternative (a separate `fixes_pr` against `main`) fails the *immediate* half: it would leave
`#1443` red and, being an `apps/web` diff, would itself be watcher-routed to Marco — two human
merges instead of one, for the same cure. **VERIFIED — the exit code decided, not my reading of it.**
`[MEASURED]` at 13:45:57Z, `gh pr checks 1443` → `tendering-e2e  pass  12m58s`
(run `33395847652`, job `99500101709`) on `7235c280`. The suite that had failed twice on this branch
is green, and `#1450`'s earlier green on the same base remains the control that says this was never
a main-wide regression. **#1443 is now green on every check and is Marco's to merge — not mine
(RULE 2, `"marco":true`, measured above).**

**F2 — `#1450` is green, CLEAN, unlabelled — and still not mine.**
13/13 checks pass, `mergeStateStatus: CLEAN`, zero labels. The watcher routed it to Marco anyway:
`"outside tests/ or docs/: apps/web/src/pages/crm/AccountDetailPage.tsx"`.
**DISPOSITION: DEFERRED** — RULE 2 holds. It becomes urgent only when Marco clears it in chat for
that batch. **Do not re-derive this from the labels: it wears none.**

**F3 — COLLECT: there was nothing new to collect, and I proved that rather than assuming it.**
The queue root holds exactly four breadcrumbs, all written before 10:35Z and all already
dispositioned: 00's `0809` and `1009`, and 04's `0610` (dispositioned in #1444) and `1011`
(dispositioned in #1449). `--freshness` exits 0 with no station SILENT, so "nothing new" here is a
quiet pipeline, **not a silent one** — the two readings are indistinguishable without that probe,
which is why it is run before the conclusion is written.
**DISPOSITION: ACTIONED** — all four `git mv`'d to `docs/pr-prompts/archive/` in this PR. Safe for
freshness: `check-breadcrumb.mjs` builds `trackedSet` with `git ls-tree -r` and matches by
**basename**, so an archived breadcrumb still counts (DOCTRINE §9.5).

**F4 — the label removal did NOT recur this window. The count stays at six.**
`[MEASURED]` timeline label events, with a positive and a negative control:
`#1443` → `labeled 08:22:23Z` / `unlabeled 09:35:36Z`, both `GH-Mantova` — **the same two events
the 10:09Z run recorded, no new ones**. `#1450` → **no label events at all**, and that is correct
rather than a seventh occurrence: its routing reason is `outside tests/ or docs/`, not
`escalates:true`, so the watcher never applies `do-not-merge` to it. `#1447` (merged this window) →
also no label events, also routed `outside tests/ or docs/`, merged unlabelled by a hand that is
almost certainly Marco's.
**DISPOSITION: ESCALATED — unchanged, still one word, still Marco's.** The cause is landed and
published (#1444); the vehicle is built and merged INERT (`pr-gates-approval-receipt-HOLD.md`,
#1441); option **(C) — fix the wording only — is dead**, killed by the sixth occurrence happening
60 minutes *after* the cause was published. What remains:
**(A)** arm `pr-gates-approval-receipt-HOLD.md`, land it, prove the `label-gate` job green, then
Marco adds it to the required checks — **complete and additive; the ruleset half is his, DOCTRINE
§5.3, and must come SECOND**; or **(B)** ruleset-only, which fails the *future* half.
**I did not arm it. Arming it decides for him.** One quiet window is not evidence the problem is
gone — it is one window.

**F5 — a caution about my own instrument this run, offered as a LEAD, not a finding.**
`Select-String -SimpleMatch '"marco"' -Path <one file>` returned nothing against a file that
`Select-String -SimpleMatch 'merge result'` then showed *does* contain `"marco":true`, while the
same quoted needle over the whole corpus returned 591 hits. Separately, several
`read_process_output` calls returned with headers missing and content pending — the early-return
behaviour DOCTRINE §9.1 already records. I could not isolate the first one to a mechanism, so it
stays a lead. **The operative habit either way: every negative I acted on this run was re-taken
with a differently-shaped query and a positive control before I believed it.**
**DISPOSITION: DEFERRED** — it becomes urgent the first time a per-file quoted-needle negative is
quoted as evidence. Whoever isolates it should add it to §9.1 with its control.

**F6 — one consumed prompt was still tracked on `main`.**
`pr-crm-s9-new-thread-anchored-HOLD.md` shows ` D` in the dev tree (the watcher consumed it; it
produced `#1450`) but was still tracked on `origin/main` — `git ls-files` returns it, positive
control `docs/pipeline/DOCTRINE.md` also returns. Left there it is a ghost on the board 00 arms
from. Deleting it from `HEAD` is not deleting it from history: `git show <sha>:<path>` still
returns it, and the 10:09Z run refuted the "only restorable copy" premise with that control.
**DISPOSITION: ACTIONED** — removed in this PR.

## WHAT I DID NOT DO

- **Merged nothing.** Both open PRs carry `"marco":true` from the watcher (measured, with
  controls). `#1450` being green, CLEAN and *unlabelled* is exactly the shape RULE 2 exists to
  survive — the absence of a label is not a release.
- **Armed nothing.** ARMED was 0 and I left it at 0. This was a choice, not an oversight:
  `pr-gates-approval-receipt-HOLD.md` is the one item whose arming would pre-empt Marco's A/B
  answer, and the NEXT-ARM list's other items were not worth opening a second front while a
  13-minute e2e was in flight on a PR I had just pushed to. The next 00 may arm one, one at a
  time, once `#1443` has settled.
- **Did not remove any `do-not-merge` label** and did not re-apply one.
- **Did not touch `/sot/`**, Azure/Entra/SharePoint, production data, or the watcher process
  (`OK - nothing armed and the watcher is alive` — an idle watcher with 0 armed is correct, not
  wedged, so there was nothing to restart).
- **Did not run `git` in `C:\po-watcher\ProjectOperations`,** and did not touch the dev tree's
  index: both writes this run happened in disposable worktrees off a fetched ref.
- **Did not merge `#1443`,** although I made it green. It is `escalates: true` and watcher-routed;
  driving it green is my lane, merging it is not.
- **Did not re-measure the estpricing HOLD premises, the sot-refs baseline, or the watcher clone's
  dirty count.** All three were measured within the last two hours by 00 or 04 and none is a
  standing state I should be re-deriving.

---

**METHOD, keep forever: when an element destroys itself under the pointer, the bug is not in the
test's timing — it is that the affordance's own arrival changes the layout it lives in.** The
call log said `element was detached from the DOM` 103 times and `element is not stable`; both are
statements about the *page*, not about Playwright. The four runs' worth of temptation here is to
call it a flake and re-run. The thing that broke it open was a screenshot showing the tab strip on
**two rows** — a fact no amount of reading the diff could have produced, because the file that
carries the bug is not in the diff.
