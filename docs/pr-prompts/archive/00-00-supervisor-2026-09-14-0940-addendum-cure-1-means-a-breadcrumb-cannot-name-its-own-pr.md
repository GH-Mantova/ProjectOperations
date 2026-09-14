# Station 00 — Supervisor | 2026-09-14T09:34Z–09:45Z

Tail of the 09:08Z run. Its main breadcrumb is
`00-00-supervisor-2026-09-14-0908-every-open-pr-is-parked-by-design-and-the-stays-armable-forever-defect-now-has-a-schema-cure.md`,
tracked on `main` as of `542812f1`. This file carries only what happened **after** it was committed,
plus one correction to it.

## GROUND

```
UTC            2026-09-14T09:34Z
origin/main    542812f1              (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 542812f1       C:\ProjectOperations2   (0 ahead, 0 behind)
doc version    1
bootstrap      1
```

## WHAT I MEASURED

- [MEASURED] **`#1924` merged and the change is on `main`.** `Assert-SmokedOrEscalate -PR 1924` →
  `True`, `Merge-Pr -PR 1924` → `True`, read back
  `state=MERGED mergedAt=2026-09-14T09:34:36Z mergeCommit=542812f11d9959b5e87670ad93165a2ecf3ed981`.
  Content confirmed on the ref, not just in the PR: the new `scope` subsection's heading matches
  **1** on `git show origin/main:docs/pr-prompts/PROMPT-SCHEMA.md`.
- [MEASURED] **Lane, before the merge, with controls.** `#1924` labels `[]`, `mergeStateStatus`
  `CLEAN`; `Select-String docs\pr-prompts\processed\pr-*.log -Pattern 'PR #1924\b'` → **0** ⇒ not
  watcher-opened ⇒ `[NO LANE VERDICT — hand-classified]`. Hand-classified by `classifyPolicyFiles`:
  all three files are under `docs/pr-prompts/`, which matches `^(tests|docs)/`, so it is the
  tests-docs class and not Marco's; and it is additionally a Station 00 docs-lane PR under
  `STATION-CAPABILITIES.md` §5 / DOCTRINE §10.1 step 3, which its body names.
- [MEASURED] **The safe-to-act gate was re-read immediately before the merge and it took three
  reads to become clean — both CAUTIONs were MY OWN activity.** `09:19Z`:
  `CAUTION: 1 LIVE STATION WORKTREE(s) … C:/po-wt/schema-retire` — the worktree this run created.
  `09:25:43Z`, after removing it: `CAUTION: … a PR was touched on GitHub in the last 2 min` — my own
  `#1924`. `09:31Z`, after waiting: **`SAFE TO ACT`**, and the merge went on that reading.
- [MEASURED] **The post-merge fast-forward's documented second half did NOT reproduce here.** The
  station doc records that after deleting an untracked breadcrumb and fast-forwarding, git leaves the
  path as a *deleted tracked file* and only `rev-list` reads clean. On this run the FF **created both
  breadcrumbs on disk** (`create mode 100644` ×2) and `Test-Path` → `True`, so no restore step was
  needed. All three prescribed read-backs: `git rev-list --left-right --count HEAD...origin/main` →
  **`0 0`**; `git diff --cached --name-status` → **EMPTY**; `git diff --numstat` → the single
  deliberate ` D` on `pr-ratescol-s0-column-api-hygiene-HOLD.md` and nothing else.
  Byte-identity was proved before the delete, as the cure requires: `git rev-parse origin/main:<path>`
  and `git hash-object <path>` both `47df5121`.

## WHAT CHANGED

- **`#1924` merged** — `PROMPT-SCHEMA.md` gained the self-retiring `scope` rule, and the 08:52Z
  addendum breadcrumb reached `main` after being untracked.
- The dev tree fast-forwarded to `542812f1`; the `C:\po-wt\schema-retire` worktree was removed and
  `git worktree prune` run. `git worktree list` is back to the dev tree plus the three pre-existing
  orphans dispatched to 03.
- This addendum. **Nothing else** — no arm, no label, no `/sot/`, no Azure.

## FINDINGS

### F1 — S4. Cure 1 makes it structurally impossible for a breadcrumb to name its own PR

The 09:08Z breadcrumb's F1 disposition ends *"the PR is named under WHAT CHANGED"*. **It is not, and
it could not have been.** The station doc's cure 1 says to write the breadcrumb **inside your own
run's PR worktree** — which is right, and is why no loose copy was left in the dev tree this run —
but it means the breadcrumb is authored **before the PR exists**, so its number is unavailable at
writing time. Amending afterwards would need a second commit and a force-push to the same branch.

This is small, and it is the same shape as everything else in this section: a rule that is correct
on its own composing with another rule to produce a claim that cannot be true. A reader following
that sentence goes looking for a PR number that was never there.

DISPOSITION: **ACTIONED**, by this addendum, which names it: **the 09:08Z breadcrumb's work landed as
`#1924`, merge commit `542812f1`.** 🔧 The general form, for every station and not just this one:
**a breadcrumb written under cure 1 should say "this run's PR" and let the addendum or the merge
commit supply the number — never assert that it names one.** ⚠️ Falsifying probe: grep the breadcrumb
corpus for a self-reference to a PR number and check it resolves; if a cure-1 breadcrumb ever
correctly names its own PR, this finding is wrong.

### F2 — S4. The post-merge FF trap is conditional, and this run is a counter-example worth keeping

Measured above: the FF **did** write both breadcrumbs back to disk, against a station-doc note that
says it does not and that the tree is left *"at `origin/main` and dirty at the same time"*. The note
is not being challenged on its own measurement — it was taken on a run that deleted files which the
FF then had no reason to recreate. What this run shows is that the outcome differs, so **the note's
prescribed fourth action (restore each deleted file from the new HEAD) must be driven by the
read-back, not performed unconditionally.**

Restoring unconditionally would have been harmless here, but the same instinct applied to
`.arming-log.txt` is exactly the append-only case that silently destroys another actor's arm rows.

DISPOSITION: **DEFERRED** — one counter-example is not enough to rewrite a measured note in a binding
document, and doing so from a single observation is the failure §9 records most often. 🔧 What is
safe to say now, and what this breadcrumb is for: **run the three read-backs first and restore only
what `git diff --numstat` actually shows as deleted.** ⚠️ What would make it urgent: a third run
reporting either outcome, at which point the discriminator is worth finding and the note worth
scoping.

## WHAT I DID NOT DO

- **Did not amend or force-push the 09:08Z breadcrumb.** It is tracked on `main`; rewriting a landed
  artifact to fix a sentence is worse than correcting it in the open, which is what this file does.
- **Did not edit the station doc's post-merge FF section.** F2 is one counter-example; see its
  disposition.
- **Did not merge `#1923` or `#1920`, and did not touch any label.** Both carry live watcher
  `marco:true` verdicts.
- **Did not arm anything, prune any worktree, or touch `/sot/`, Azure, or production data.**
