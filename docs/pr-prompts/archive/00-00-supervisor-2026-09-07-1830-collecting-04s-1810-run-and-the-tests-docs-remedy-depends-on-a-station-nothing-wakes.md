# Station 00 — Supervisor | 2026-09-07T18:26Z–2026-09-07T18:50Z (addendum to the 1808 run)

## GROUND

```
UTC            2026-09-07T18:26:01Z
origin/main    8b38bd9d            (after #1786 merged 18:25:08Z; fetched, then rev-parse)
dev tree       main @ 8b38bd9d      C:\ProjectOperations2   (0 0; one expected dirty file, below)
doc version    1
bootstrap      1
```

This is the **same run** as `…-1808-…`, continued. Station 04 fired at `18:10:11Z`, 99 seconds after
me, and finished at `18:20:54Z` — while my board PR was in flight. It left a breadcrumb and a dirty
`sweep-rotation.json` in the dev tree, both addressed to me. Collecting them an hour later would
have been the obvious thing and the wrong one, so this addendum collects them now.

## WHAT I MEASURED

- **[MEASURED] `#1786` MERGED.** `gh pr view 1786 --json state,mergedAt,mergeCommit` →
  `STATE=MERGED MERGED_AT=2026-09-07T18:25:08Z COMMIT=8b38bd9d…`. Merged through the sanctioned path
  only: `Assert-SmokedOrEscalate -PR 1786` → `True`, then `Merge-Pr -PR 1786` → `True`. Never a raw
  `gh pr merge`, never a hand merge. Pre-merge state read from GitHub, not from opinion:
  `mergeStateStatus=CLEAN`, `PASS=10 FAIL=0 PENDING=0` of 15 (five SKIPPED — a docs-only diff).
- **[MEASURED] The dev-tree fast-forward, all three read-backs.** The untracked 17:08 breadcrumb
  blocked it, exactly as the station doc predicts. Cure applied in order: blob equality proved first
  — `git rev-parse origin/main:<path>` and `git hash-object <path>` **both `f224ae2c`**, no piped
  hash (§9.1) — then `Remove-Item`, then `git merge --ff-only origin/main` (exit 0). The merge
  **re-created** the file (`Test-Path` → `True`), so no restore step was needed here.
  `git rev-list --left-right --count HEAD...origin/main` → `0 0`;
  `git diff --cached --name-status` → EMPTY.
- **[MEASURED] `git diff --numstat` was NOT empty afterwards, and the cause was 04, not the merge.**
  `2 2 docs/pipeline/sweep-rotation.json`, mtime `18:19:29Z` — inside 04's run window, and my board
  PR touched only `docs/pr-prompts/`. The dev tree was clean at `18:09:50Z`. This is the documented
  hand-off (04 advances the rotation, may not commit it, 00 lands it), arriving mid-run rather than
  between runs.
- **[MEASURED] Station 06 is alive but has no cadence, and its dispatch queue is now two deep.**
  `git ls-files docs/pr-prompts | Select-String '00-06-'` → **32** breadcrumbs (POSITIVE control
  `00-04-` → 83; NEGATIVE control `00-09-` → **0**). Newest is
  `00-06-pr-master-2026-09-06-2345-…` — **18.4 h ago**. The scheduled-tasks MCP lists five enabled
  tasks and **06 is not one of them**; `C:\Users\Marco\Claude\Scheduled\` holds no `06-*` folder at
  all. So 06 runs only when a human starts it.
- **[MEASURED] The 00×04 collision corrected in `#1786` happened at the same slot exactly 24 hours
  ago, and I found the evidence by accident.** Writing this PR's body to
  `C:\po-sup-fix-scripts\pr-body-1830.md` was refused because that file already existed — mtime
  `2026-09-06T18:28:07Z`, 2,923 B, opening line *"Second board PR of the 2026-09-06T18:08Z Station 00
  run. **Station 04 fired 99 seconds after that run started** and wrote its breadcrumb after the
  COLLECT window had closed."* Same two stations, same 99-second gap, same 18:1xZ slot, one day
  apart — and 18:1xZ is 04:1x Brisbane, nowhere near midnight. That is an **independent second
  instance** of the correction landed in `STATION-CAPABILITIES.md` §6 in `#1786`, taken before this
  run existed and therefore not contaminated by it. ⚠️ It is *not* a live second actor: the file is a
  day old, and §3 of the sweep read `index.lock False / False`, `git processes running: 0`,
  `no PR touched on GitHub in the last 2 min` at `18:20:24Z`. I checked that before assuming.

## WHAT CHANGED

1. `docs/pr-prompts/00-04-scanner-2026-09-07-1810-….md` — 04's breadcrumb, committed. It was
   untracked and reached nobody.
2. `docs/pipeline/sweep-rotation.json` — 04's advance (`last_index 3 → 0`,
   `last_run_utc 2026-09-07T18:11:45Z`), committed, byte-exact from the dev tree. If it is not
   landed the rotation stops turning and 04 repeats gate-liveness next run instead of moving on.
3. This breadcrumb.
4. `docs/pr-prompts/needs-marco/station-06-has-no-cadence-and-owns-the-only-remedy-2026-09-07.md` —
   written on disk. That folder is gitignored, so it is named here as well; a finding that lives
   only in a gitignored path has not been reported.

**Still merged nothing beyond `#1786` — my own docs PR. No prompt armed. No label touched.**

## FINDINGS

Station 04's `18:10Z` breadcrumb carried five findings. Each gets a disposition here, which is the
only channel that closes.

### C1 — 04's F1: three ADMIT prompts duplicate PRs that are open right now

`pr-brandtheme-s2-hex-ratchet-HOLD` (`#1774`), `pr-tr-s1-reminder-policy-HOLD` (`#1767`),
`pr-tipid-s2-write-the-ids-backfill-and-admin-HOLD` (`#1775`). 04 confirmed each on the prompt's own
executable premise against the open PR's diff, not on a file-overlap count — the corrected §10.6
rule, applied correctly, with three false positives caught and discarded the same way.

**DISPOSITION: DEFERRED.** Correctly not armable, and correctly **not retirable either**: their
premises are still TRUE because their PRs are open, so `superseded/` would be wrong today. Nothing
for me to do until those PRs settle, and all three are Marco's to settle. **What makes it urgent:**
the moment any of the three merges, its prompt becomes SPENT and should be retired to `superseded/`
in that run's board PR; if one is closed **unmerged** the prompt is live again and must not be
retired. `tr-s1` and `tipid-s2` are refused independently anyway (migration gate; `escalates: true`),
so the one that actually needed saying is **`pr-brandtheme-s2-hex-ratchet` — no other guard, and it
sits where an arming decision looks first.** It is added to the standing do-not-arm-right-now list
for the next run, with `#1774` named as the reason.

### C2 — 04's F2: the three false positives reproduce §10.6's precision failure exactly

**DISPOSITION: ACTIONED** — accepted as reported, and no document change is needed. §10.6 already
predicts a one-file scope's precision being zero by construction and already prescribes the premise
as the discriminator; 04 used it and it worked. Recording a rule *working* is worth as much as
recording one failing, and this is the second measured instance.

### C3 — 04's F3: the `fv2` forms chain is parked on an authoring gap, not on board state

Three prompts, zero reachable. The head (`pr-fv2-ai-import-HOLD`) is REJECTed
`[UI_PROMPT_NEEDS_DESIGN_REF]` and no board state can ever supply a design reference, so the two
downstream `[FILE_GATE_NOT_RELEASED]` verdicts read as ordinary waiting while being permanent.

**DISPOSITION: DISPATCHED → Station 06**, unchanged from 04's routing — staging and prompt
authorship are 06's lane and 04 is right that it may not rewrite a prompt it is critiquing. **But see
C4: this dispatch has no scheduled consumer**, which is why C4 exists rather than being folded in
here. 06 either adds the design ref or takes the interface question to Marco under §10.4.

### C4 — the remedy for the board's throughput constraint is dispatched to a station nothing wakes

This is mine, not 04's, and it is the reason this addendum is worth a PR.

The board's standing constraint is that every PR outside `tests/` or `docs/` stops at Marco. The one
lane that moves without him is `tests-docs`, and it has **no eligible supply**: 45 HOLD, 17 ADMIT,
zero of them all-tests-or-docs. The fix is to *author* one, which is Station 06's lane, so my 17:08
run dispatched exactly that to 06. 04's C3 has now dispatched a second thing to 06 in the same hour.

**06 has no schedule.** [MEASURED above] it is absent from the scheduled-tasks MCP and has no folder
under `Scheduled\`; its 32 breadcrumbs prove it runs, and its newest is 18.4 h old. So the latency on
a dispatch to 06 is unbounded and currently at least 18 hours — and the thing waiting behind it is
the only mechanism that lets this board move without Marco.

This is the shape the station doc already records for Station 02: *"Dispatches naming 02 went to a
station with no schedule and no consumer — measured 2026-09-01, when the #1483 e2e work was
dispatched at 18:09Z and 20:09Z and was still undone eight hours later."* Same failure, different
station number, and 02's was only found because someone counted the dispatches.

**DISPOSITION: ESCALATED.** A question for Marco, with options, RULE 1 order — complete-and-additive
first, and what each alternative fails:

- **(a) Give 06 a real cron, like 03/04/05.** Solves it immediately (the two queued dispatches get
  consumed on the next tick) and in future (every later dispatch does too). Damages nothing: 06's
  authority row is stage `-HOLD` only — it never arms, never merges, never touches `/sot/` — so a
  scheduled 06 cannot mutate the board, and a `-HOLD.md` appearing on disk starts no work.
  **Passes both halves of RULE 1.** The cron lives in the scheduled-tasks layer and is Marco's to
  set; a daily slot well away from `:05` and `:00` would also avoid the collision in the 1808
  breadcrumb's F1.
- **(b) 00 authors the tests-docs prompt itself.** Fixes today, fails the future half: it folds a
  third station into 00 after 02, and it puts the same actor in charge of authoring a prompt and
  then arming it — no independent read of the prompt before it runs, which is the check 06 exists to
  be.
- **(c) Leave it; Marco starts 06 by hand when he notices.** Fails the future half outright. The
  latency stays unbounded, and the specific thing waiting is the board's only agent-movable lane, so
  "nothing merged again this hour" keeps being the honest report.

### C5 — 04's F4: every gate on the board is alive

45 HOLD premises evaluated, 0 spent, 0 spent-behind-a-reject; 4 `requires_merged` all merged; 7
`requires_file_on_main` correctly closed; 21 `requires_on_main` entries all consistent with their
holders' verdicts. Both of `triage-holds.ps1`'s mandated controls passed, so `spent=0` means *none*
rather than *"this instrument cannot say"*.

**DISPOSITION: ACTIONED** — a clean bill, measured rather than quiet, and it is also the independent
confirmation the 1808 run's F4 was reasoning toward from an unchanged SHA. Rotation advance landed
in this PR so the sweep moves on rather than repeating.

### C6 — 04's F5: a gate symbol that reads like an error string can be a real marker

`requires_on_main: … :: NO MATCH` looked like a failed grep pasted where a marker belongs; 04
measured it against the diff of `#1775`, the PR that creates the file, and found it four times as a
deliberate report token. The gate is live.

**DISPOSITION: DEFERRED**, and I agree with 04's reasoning for deferring rather than overriding it.
One instance is too thin to justify editing DOCTRINE §9.5, which sits inside the hash-gated
`instruments v2` canonical block. **What makes it urgent:** a second instance, or any run measured
proposing to retire a gate on how its symbol *reads*. At that point it is one bullet beside the
anchor-by-symbol rule, and — worth noting for whoever writes it — a §9 edit is DOCTRINE-only and
costs one document, not seven.

## WHAT I DID NOT DO

- **Did not arm `pr-brandtheme-s2-hex-ratchet`**, or anything else. Armed is still 0.
- **Did not retire the three duplicate prompts.** Their premises are still true; retiring a live
  prompt on the strength of an open PR would be wrong in the direction that loses work.
- **Did not author the tests-docs prompt myself** — that is option (b) in C4 and I have put it to
  Marco rather than taking it, because choosing it unilaterally is the half of RULE 1 it fails.
- **Did not edit `pr-fv2-ai-import-HOLD`** to add a design reference. §10.4: a design question found
  in a prompt is settled before arming, by Marco, not invented inside the slice.
- **Did not run 04's sweep again**, or second-guess its rotation. Reading 04's breadcrumb and
  dispositioning it is collecting; re-deriving its measurements would be doing 04's job (LL-38).
- **Did not touch `C:\po-vg`** (now ~4,940 min, one uncommitted file) or the watcher clone's five
  dirty files. Both are 03's, whose next occurrence is `2026-09-07T23:00:45Z`.
- **Did not touch Azure, Entra or SharePoint. Did not touch `/sot/`. Did not author an approval
  receipt** — a scheduled run never may.

---

**Untracked when written; committed by the PR that carries it.** The only file this run leaves dirty
in the dev tree is nothing — `sweep-rotation.json` is landed here, so the next fast-forward has no
modified tracked file to trip on.
