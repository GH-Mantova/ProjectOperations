# Two open PRs fix the same verdict-guard defect — which one survives?

**Filed 2026-09-24T15:3xZ by Station 00 (scheduled), at `origin/main` `c0e15205`.**
**Subject PRs: #2166 and #2167 — both OPEN at filing.**

## Why this file exists at all

This question was raised as an **ESCALATED** finding (F6) by the 2026-09-24T14:14Z Station 00 run,
whose only home was that breadcrumb's `## FOR MARCO` section. A breadcrumb is archived once its
findings are dispositioned, and `status-sweep.ps1` section 5 cross-checks **`needs-marco/`**, not
`archive/` — so an escalation that never reaches this folder is invisible to the one instrument that
keeps escalations honest. That is the gap this file closes; the question below is unchanged.

## The question

Two open PRs change **the same three files** with **overlapping hunks in the same two functions**.
They will conflict with each other; whichever lands second will not merge clean. Only you can remove
their `do-not-merge` labels, so nothing moves until you choose.

| | **#2167** | **#2166** |
|---|---|---|
| title | `fix(pr-watcher): rescue bare paths under spaced top-level directories (SPACED_PATH_CANDIDATES_V1)` | `fix(pr-watcher): recover paths whose top-level dir contains a space` |
| head | `fix/verdict-guard-spaced-path-candidates` | `fix/verdict-guard-spaced-path-tokens` |
| created | 2026-09-24T13:53:01Z | 2026-09-24T13:43:13Z |
| files | `verdict-guard.mjs`, `index.mjs`, `verdict-guard.spec.mjs` | **the same three** |
| hunks | `stripSuffix`, `looksLikeCommand`, `extractPaths` ×2, `validateVerdict` ×2, `drain` ×2 | `extractPaths` ×2, `validateVerdict`, `drain` ×2 |
| `.arming-log.txt` | `2026-09-24T13:35:34Z ARMED pr-verdictguard-spaced-path-candidates escalates=true actor=station-00` | **no entry, ever** |
| prompt in `processed/` | the prompt **and** its `.log` | **neither** |
| watcher verdict (RULE 2 probe) | `{"ok":false,"marco":true,"reason":"escalates:true — held for Marco, labelled do-not-merge"}` | **0 hits — second lane** |
| CI, apart from the label | **green, e2e included** | green; e2e re-run was issued at exit 0 |

**[MEASURED] 2026-09-24T15:2xZ, this run, re-taken rather than quoted.** RULE 2 probe over
`C:\ProjectOperations2\docs\pr-prompts\processed\pr-*.log` (the live dev tree, never the clone decoy
— DOCTRINE §9.5), matched with `indexOf('PR #<n>')` plus an explicit next-character digit guard and
**no backslash escape crossing a shell layer** (§9.1 `NODE_E_REGEX_BACKSLASH_DOUBLES_THROUGH_POWERSHELL_V1`):

- corpus **952** `pr-*.log`, newest `2026-09-24T13:53:36Z` — younger than every open PR's `createdAt`,
  so a `NO LOG` here is a real absence and not a frozen corpus;
- POSITIVE control, `"marco":true` present in **710** files;
- **#2167 → 1 hit**, a real `marco:true` verdict quoted above; **#2166 → 0 hits**;
- NEGATIVE control, `PR #999731` → **0**.

So three independent instruments agree that **#2166 came from no prompt and no arm.** It may well be
your own supervised-lane work, which DOCTRINE §10.2.1 expressly permits and which leaves no queue
trace by construction. That is exactly why no station may close it.

## RULE 1 — the complete-and-additive option first

1. ✅ **Release #2167 (remove its `do-not-merge`); close #2166 as superseded.**
   Solves it immediately *and* for the future: the surviving fix is the one with a prompt, an arm and
   an audit trail, so `main`'s history explains itself to the next reader. Damages no data entry —
   #2166's diff survives on its branch and in the PR. **Both halves pass.**
   ⚠️ **Stated limit:** this is only right if #2167's superset genuinely covers #2166's case. No
   station has diffed the two line-by-line against a shared test corpus, and this file does not
   pretend one has.
2. ❌ **Release #2166; close #2167 as superseded.** *Fails the future half* — it lands a fix with no
   prompt, no arm and no queue trace, and leaves the prompt that produced #2167 spent in `processed/`
   describing work that never landed.
3. ❌ **Release both, in order.** *Fails the immediate half* — they rewrite the same two functions, so
   the second conflicts and needs a manual resolution before it can merge.

## What is already done, so you are not asked for it

Both PRs have been driven green apart from the label (title-scope red cleared and read back by the
14:14Z run), which is what the station doc prescribes for an escalating PR: *opened and driven green
but NOT auto-merged — left for Marco.* Nothing here is waiting on an agent.

## The wider blocker this sits inside

**[MEASURED] this run:** all five code PRs on the board (`#2148`, `#2158`, `#2164`, `#2166`, `#2167`)
carry `do-not-merge`, and CP-26 reads `[LABEL_PRESENT]` on each — quoted verbatim from column 3 of
the job log (§9.1's three-column rule):

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

That is **the design working, not a defect** — but it means the board cannot move at all until you
remove labels. The oldest of the five has been waiting since `2026-09-24T02:56Z`.

## Falsifying probe — run this before acting on this file

`gh pr view 2166 -R GH-Mantova/ProjectOperations --json state,labels` and the same for `2167`. If
either is already MERGED or CLOSED, this escalation is spent: move it to
`docs/pr-prompts/needs-marco/discharged/` with a `_DISCHARGE-NOTE-*.md` beside it naming what was
measured. **Never delete it.**
