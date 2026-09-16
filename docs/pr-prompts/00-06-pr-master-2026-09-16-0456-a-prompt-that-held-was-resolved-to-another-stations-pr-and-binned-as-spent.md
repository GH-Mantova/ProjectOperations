# Station 00 → Station 06 — PR Master | escalation | 2026-09-16T04:56Z (found 05:40Z, recovered 05:52Z)

## GROUND

```
UTC            2026-09-16T05:52:00Z
origin/main    d1634821
dev tree       C:\ProjectOperations2        main @ d1634821
watcher clone  C:\po-watcher\ProjectOperations   main @ d506ebf1  ← AT THE TIME OF THE RUN
actor          station-00.interactive-0003 (supervised interactive lane)
prompt         docs/pr-prompts/pr-ratescol-s4-import-creates-columns-*.md
```

This was a SIGHTED run. Every line below is quoted from the prompt's own `.log` or from `git` in the
named tree.

## WHAT HAPPENED

An armed prompt correctly HELD, and the watcher then binned it as *spent* against a **different
station's PR**. The arm was silently lost: no PR, no HOLD, no error, no operator-visible signal. It
was found only because I was reconciling the queue by hand.

Timeline, all 2026-09-16:

| time (UTC) | event |
|---|---|
| 04:52:15 | `arm-prompt.ps1 -Name pr-ratescol-s4-import-creates-columns` — lint `PROMOTE` against **`origin/main`** |
| 04:56:20 | writer run starts, reads **the watcher clone's `main`** |
| 04:58:17 | writer refuses: `requires_on_main: … :: structureAdding` reads **0** |
| 04:58:1x | watcher resolves the prompt to **PR #1979** (ratescol-**S3**'s PR) and moves it to `processed/` **with no action** |

## DEFECT 1 — the run read a stale `main` and refused on false data

The writer's refusal, verbatim from the prompt log:

> `requires_on_main: apps/web/src/components/rates/FilterableRateGrid.tsx :: structureAdding` →
> **NOT satisfied** … **Why:** S3 (PR #1979) is still unmerged … `main` tip is `d506ebf1`, and
> neither the S3 merge commit (`d1634821`, on a branch) nor `structureAdding` reaches it …
> **Action:** HOLD. Re-fire after PR #1979 lands on main.

Every sentence of that is wrong, and the log itself contains the proof:

- `d1634821` is **not** "on a branch". It is `origin/main` — it is what `origin/main` pointed at
  during the run, and it still is.
- The run measured `main`, the watcher clone's **local branch**, which was 1 merge behind and had
  not been fast-forwarded since 2026-09-15.
- Measured just now, before recovery: `structureAdding` on the clone's `main` = **0**; on
  `origin/main` = **23**. After fast-forwarding the clone: **15 occurrences in that one file**.

So a gate that was released was reported unreleased, and the refusal *looked* correct — it named a
real file, a real symbol and a real commit. That is the dangerous shape: a wrong answer wearing the
evidence of a right one.

**Root cause:** `requires_on_main` resolves against a ref named `main`. In a clone whose local `main`
is only advanced by an explicit pull, `main` is not main. Nothing in the run fetched or compared.

**Ask (06):** make `requires_on_main` resolve against `origin/main` **after an explicit fetch**, and
refuse to evaluate the gate at all if `git merge-base --is-ancestor main origin/main` shows the local
branch behind — a stale tree must abort the run, not answer it.

## DEFECT 2 — a prompt that HELD was binned as spent, against another station's PR

Immediately after the (false) HOLD, verbatim:

> `[merge] pr-ratescol-s4-import-creates-columns-ready.md: PR #1979 spent (PR pre-dates this run
> (created 2026-09-16T00:58:18.000Z, run started 2026-09-16T04:56:20.909Z) — the prompt was already
> consumed by an earlier run) — moving prompt to processed/ with no action`

Two separate errors compounded:

1. **Wrong PR.** #1979 is **ratescol-S3**'s PR. S4 never had a PR. The resolver matched on branch or
   slug prefix and landed on its predecessor.
2. **Wrong terminal state.** The run's own outcome was **HOLD** — an explicit "re-fire later".
   `processed/` means *consumed*. A HOLD must return to `-HOLD`, never to `processed/`.

The spent-detection heuristic ("the PR pre-dates the run, so an earlier run must have consumed the
prompt") is sound only when the resolved PR actually belongs to the prompt. Here it was applied to an
unrelated PR and used to discard a live arm.

**Ask (06):** (a) the HOLD path must be terminal-state-aware — a run that ends in HOLD restores the
`-HOLD` name and never touches `processed/`; (b) spent-detection must require an *exact* prompt↔PR
binding (the PR's own prompt identifier), not a slug-prefix match; (c) when the two disagree, log and
**leave the prompt alone** rather than choosing a bin.

## BLAST RADIUS

Anything downstream of a HOLD is exposed. In this case a chain step vanished between S3 landing and
S4 building, with no alarm anywhere. The queue's own invariant — *every armed prompt ends as a PR, a
HOLD, or a logged failure* — was violated silently, which is the one failure mode the queue cannot
detect itself.

## RECOVERY PERFORMED BY THIS LANE (lossless)

- The HOLD was still **tracked on `origin/main`**; only the working tree had lost it. Restored with
  `git checkout -- <single named file>` — no `checkout .`, no `reset`.
- The consumed `-ready` copy and its `.log` were **moved** (never deleted, per Marco's standing rule)
  to `C:\PR-Master\scripts\station-00\held-not-built\`.
- The watcher clone was fast-forwarded to `d1634821`. Before the fast-forward, the one tracked
  modification (`docs/data-model/metadata-catalog.json`) was **proven** to be a pure line-ending
  difference — byte-identical after newline normalisation, 693855 = 693855 — and backed up to
  `C:\PR-Master\scripts\station-00\clone-ff-backups\` before that one named file was restored.
- Re-lint: `PROMOTE` / `GATE_RELEASED` — "`structureAdding` is now on `origin/main`".
- Re-armed 2026-09-16T05:52Z by `station-00.interactive-0003`.

## WHAT I DID NOT DO

I did not change any watcher code. Both fixes are Station 06's to make, and the second one changes
queue semantics.
