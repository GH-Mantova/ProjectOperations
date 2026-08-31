# Station 00 — Supervisor | 2026-08-31T14:45Z–2026-08-31T15:0xZ (COLLECT supplement, same run)

**Third and final file for the 14:08Z run.** The first
(`…-1408-doctrine-said-the-fix-was-pending-thirteen-hours-after-it-merged.md`, #1452) carried the
run. The second (`…-1425-the-sweep-calls-a-live-station-worktree-an-orphan.md`, #1454) retracted its
stated final action. This one exists because **Station 04 filed a breadcrumb at 14:10Z — two minutes
after this run started — and collecting it is this station's defining duty.** Its findings could not
wait two hours: four of them are dispatched to 00, and one of those changes RULE 4's arming detector.

## GROUND

```
UTC            2026-08-31T14:45:00Z
origin/main    7fbbf121   (#1453, Station 05's reconcile, merged 14:33:03Z this run)
dev tree       main @ 7fbbf121   C:\ProjectOperations2   index clean
doc version    1
bootstrap      1
```

## WHAT I MEASURED

Every claim below is a **re-measurement of Station 04's**, run independently on this box against
`origin/main`, because DOCTRINE §7.1's re-read rule applies to another station's artifact exactly as
it does to my own.

- `[MEASURED]` **04's F2 — `gh` in `lint-prompt.mjs`.** `Select-String -Path
  scripts\pipeline\lint-prompt.mjs -Pattern 'LINT_GH_BIN'` → **one hit, line 1164**:
  `const gh = process.env.LINT_GH_BIN || "gh";`. DOCTRINE said *"`gh` appears nowhere in it"* at
  line **460**. The claim is FALSE and 04 is right.
- `[MEASURED]` **04's F4 — a third do-not-arm marker.** `Select-String … -Pattern 'Arm ONLY'` in
  `lint-prompt.mjs` → `:708` (the doc comment), **`:732  const ARM_ONLY = /Arm ONLY/;`**, and
  `:767` (the `HUMAN_GATE_PRESENT` report). Control: `"Arm ONLY"` occurred **0** times in
  `docs/pipeline/DOCTRINE.md`. Three markers exist; the doctrine documented two.
- `[MEASURED]` **04's F7 — `check-ignore` on a directory.** The control 04 added is the point, and it
  reproduces exactly:
  ```
  git check-ignore -v docs/pr-prompts/processed        -> exit 1, empty
  git check-ignore -v CLAUDE.md                        -> exit 1, empty      (genuinely NOT ignored)
  git check-ignore -v docs/pr-prompts/processed/x.log  -> exit 0, .gitignore:76
  ```
  **Opposite truths, byte-identical results.** §9.2 recorded the silence; it did not record that the
  silence is indistinguishable from a true negative, which is the half that makes it dangerous.
- `[MEASURED]` **04's F5 — the folded-scalar census has moved.** 04 re-measured 8 · 14 · 10 over 59
  prompts against the 10 · 19 · 12 over 61 that I had written into DOCTRINE forty minutes earlier.
  Its number is fresher and its invariant (0 on `premise` / `scope` / `fixes_pr` / `requires_*`) is
  unchanged.
- `[MEASURED]` **RULE 4 re-run for the third marker, swept across the whole root board.**
  Case-sensitive `Arm ONLY` over every `docs/pr-prompts/pr-*.md` → **exactly one prompt carries it:
  `pr-524-rates-b-slice2-canonical-HOLD.md`.** Negative control `zzzNoSuchMarker` over the same
  corpus → **0**. And on the arming candidate named in the 1408 breadcrumb,
  `pr-lint-not-a-prompt-HOLD.md` → **0**, so it is not gated by the marker neither station knew
  about.
- `[MEASURED]` `restart-watcher-if-wedged.ps1` at 14:34Z → **`VERDICT: HEALTHY - no action`**;
  watcher ALIVE pid 32916, heartbeat 1 min, queue last moved 8 min. `armed prompts waiting: 1` —
  that is **`rev-1454-ready.md`, the watcher's own auto-generated review job** for the PR I merged at
  14:28Z (DOCTRINE §9.5: `rev-<n>-ready.md` are review jobs, not prompts). **I did not arm it and
  it is not a prompt arm.**
- `[MEASURED]` `check-breadcrumb.mjs --freshness` → exit 0, CLEAN. 00 0.2h · 03 15.6h · 04 0.4h ·
  05 0.4h. **No station SILENT.** 05 moved from 24.0h to 0.4h during this run.

## WHAT CHANGED

1. **`docs/pipeline/DOCTRINE.md`** — four corrections, all in the hash-gated `instruments v2` block,
   all edited with node and read back by the edit script:
   - §9.5 the `gh`-appears-nowhere claim → replaced with what is actually true (the five **gate**
     probes use `git` only; `gh` is used by `ghFetchPrState` at `:1164-1165`, so a `fixes_pr` verdict
     does depend on it).
   - §9.5 "the two literal markers" → **three**, naming `ARM_ONLY` at `:732` / `:767`, and saying
     explicitly that RULE 4's detector greps this union.
   - §9.2 the `check-ignore` bullet → the byte-identical-to-a-true-negative clause, with 04's control.
   - §9.5 the census I wrote at 14:1xZ → both readings, and a warning that counts are state.
2. **`docs/pipeline/stations/_canonical-blocks.json`** — `instruments` sha re-recorded
   `f3e1e26e…` → `f529368e…`. One-line diff; `station-contract v1` byte-unchanged. Positive control:
   `lint-station.mjs` → `REJECT: 1 of 7`, exit 1, before the re-record; `ADMIT: all 7 docs clean`,
   exit 0, after.
3. **`docs/pr-prompts/pr-sweep-worktree-liveness-HOLD.md`** — 04's F3 folded into the prompt I staged
   in #1454, because both defects live in `status-sweep.ps1` and two prompts editing one script is a
   conflict waiting to happen. `size` 2 → 3, `done_when` now also requires the literal
   `trunk-conclusion`. Still HOLD, still unarmed.
4. **Collected** `00-04-scanner-2026-08-31-1410-….md` and 04's advanced
   `docs/pipeline/sweep-rotation.json`, both of which 04 deliberately left untracked for me.
5. **Merged `#1453`** (Station 05's doc-reconcile), 14:33:03Z, `7fbbf121`, via
   `Assert-SmokedOrEscalate` → `Merge-Pr`, read back. Not watcher-routed (0 hits for `#1453` in
   `processed/*.log`), `sot/`-and-docs only, no labels — inside 00's merge authority.

## FINDINGS

### F1 — 04's F2, F4 and F7 are correct, re-measured, and ACTIONED here

All three are corrections to the same hash-gated block, so they belong in one PR — which is why 04
dispatched rather than staged them: a prompt that omitted the hash re-record ships a red PR, and it
said so. The re-record procedure was proven fresh in #1452 this hour and used again here.

**F4 is the one that mattered most.** RULE 4's arming detector explicitly greps "the UNION of
don't-arm markers as a SECOND instrument" — and that union has been two markers wide while the
linter enforced three. Every arm decision taken on a marker grep since `ARM_ONLY` was added was made
with an instrument narrower than the gate it was checking.

🔴 **And the one prompt that carries `Arm ONLY` is `pr-524-rates-b-slice2-canonical-HOLD.md`** —
measured this run over the whole root board, one hit, negative control 0. That is one of the two
**irreversible table drops** named three bullets earlier in the same §9.5, and one of the prompts
whose `rollback_strategy` was a block scalar the gate never read. So the marker the doctrine omitted
is, in practice, guarding the single most destructive thing in the queue. Nothing was mis-armed —
the linter enforced the gate whether or not the doctrine described it, which is exactly why "lint
ADMIT is necessary, not sufficient" cuts both ways — but a station reasoning from the two-marker
grep alone would have seen `pr-524` as ungated.

**DISPOSITION: ACTIONED** — all four DOCTRINE edits landed in this PR, hash re-recorded,
`lint-station.mjs` exit 0 read back.

### F2 — 04's F3 folded into an existing staged prompt rather than staged again

04 dispatched the `TRUNK IS RED` title-grep to 00 and correctly refused to ride it on a docs PR. But
I had already staged `pr-sweep-worktree-liveness-HOLD.md` against the *same script* forty minutes
earlier, and neither of us could see the other's work. Two prompts rewriting `status-sweep.ps1`
independently is a merge conflict manufactured on purpose.

**DISPOSITION: ACTIONED** — folded into the existing prompt as a second named defect with its own
positive control, `done_when` extended, `size` raised 2 → 3. One prompt, one script, one PR.

### F3 — two stations found the same defect from different instruments, two minutes apart

04's own method note is the finding, and it is worth carrying: *stations do not read each other's
chats, and a breadcrumb written at 14:08Z is invisible to a run that starts at 14:10Z until someone
thinks to look.* It caught the duplication only by running angle 4 — *is this already fixed or
queued?* — **after** writing its finding, and says so. It nearly dispatched me to do work I had
already shipped.

The convergence is worth keeping for a second reason: 04 reached the block-scalar verdict by
importing the live `parseFrontMatter` and calling it with a folded and a plain control, while I
reached it by `git grep` plus the merge record. **Two instruments, one verdict** — that is
corroboration of the kind §7 asks for, and neither of us had to trust the other.

**DISPOSITION: DEFERRED** — 04 proposes a cheap standing habit (re-read `docs/pr-prompts/00-*.md`
for breadcrumbs newer than your own run start, immediately before dispositioning). It is right, and
it belongs in the station-contract canonical block, which is byte-identical across six station docs
and hash-gated. That is a six-document change and should be made once, deliberately, with all six
shipped together — not appended to a run that has already opened three PRs. It becomes urgent the
next time two stations duplicate work; this is the first recorded instance.

### F4 — 04's F6 and F8 are not mine

`git branch -r` phantom refs 33 → **44** in two days (F6), and **55** stash entries in the watcher
clone, which is on `feat/crm-s9-anchor-picker` and `dirty=2` (F8).

**DISPOSITION: DISPATCHED → Station 03 (machine-minder).** Clone state, stash hygiene and
`fetch --prune` are its lane and 04 already addressed F8 there; I am adding F6 to the same handover
rather than running `--prune` mid-flight. 03 last reported 15.6h ago against a 24h cadence, so it is
waiting correctly and will pick this up on its own next run. ⚠️ **If 03 has not reported by the
2026-09-01 00:0xZ run it is past 24h — check it then.**

### F5 — 04's TRUNK IS RED "lead" has a demonstrated candidate mechanism: 04's own F3

04 filed the 14:11:31Z `1 success / 1 not-success  <-- TRUNK IS RED` reading as *"a lead I cannot
account for"*, having refuted both a re-run and a genuine red, and filed the title-grep mechanism
separately as F3 — **without connecting them.**

I cannot reconstruct the exact top-3 window from 14:11:31Z after the fact, and I am **not** going to
guess which commit subject fired; that would be the diagnosis-from-the-diff error in a new costume.
What I can say is narrower and sufficient: **a mechanism that manufactures precisely this false
reading was proven present, by control, in that same script during that same run** — so
"unaccounted for" is the wrong label for it. A lead with a demonstrated candidate mechanism is not
a mystery; it is an untested hypothesis, and F3's fix is the test.

⚠️ The claim I am NOT making, stated so nobody inherits it: that F3 *was* the cause. If a
`TRUNK IS RED` appears again after `trunk-conclusion` lands, this hypothesis is refuted and the lead
is genuinely open.

**DISPOSITION: DEFERRED** — resolved by the prompt in F2 above. When `trunk-conclusion` lands, this
reading becomes impossible; if a `TRUNK IS RED` still appears afterwards, *that* is a lead worth
chasing and will be a genuinely new fact.

## WHAT I DID NOT DO

- **Did not arm a prompt.** Armed remains 0 by my hand; `rev-1454-ready.md` is the watcher's own
  review job. The 1425 breadcrumb's F2 stands: `pr-lint-not-a-prompt-HOLD.md` is for the next run,
  and its RULE 4 detector output now includes the third marker (`Arm ONLY` → 0, control 1 on
  `pr-dns-s5-checker-flip-to-fail-HOLD`).
- **Did not merge `#1443` or `#1450`** — both `"marco":true`. RULE 2. They remain the entire open
  board.
- **Did not fix `status-sweep.ps1` by hand**, either defect. Staged, with controls, for the lane.
- **Did not run `git fetch --prune` or touch the watcher clone's 55 stashes.** 03's lane.
- **Did not edit the station-contract canonical block** for F3's standing habit — six documents,
  one deliberate change, not a fourth PR at the end of a long run.
- **Did not touch `/sot/`, Azure, Entra, SharePoint or production data.**
- **Did not leave a worktree behind** — `C:\po-worktrees\doctrine-04-dispatch` removed with
  `git worktree remove --force` and `git worktree prune`.
