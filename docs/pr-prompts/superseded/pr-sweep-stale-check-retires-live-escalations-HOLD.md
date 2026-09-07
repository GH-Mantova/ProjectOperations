---
premise: grep -q 'eq "MERGED" -or' scripts/pipeline/status-sweep.ps1
premise_means: status-sweep.ps1 section 5 still collapses MERGED and CLOSED into one verdict, and still treats every PR number anywhere in an escalation body as that escalation's subject.
scope:
  - scripts/pipeline/status-sweep.ps1
done_when: pwsh -NoProfile -File scripts/pipeline/status-sweep.ps1 > /dev/null && ! grep -q 'eq "MERGED" -or' scripts/pipeline/status-sweep.ps1
size: 1
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# status-sweep section 5 tells the reader to clear 26 of the 29 open escalations, every run

## The defect

`scripts/pipeline/status-sweep.ps1` section 5 ("STALE-CLAIM CROSS-CHECK") scrapes every
`#NNNN` / `pull/NNNN` out of each `needs-marco/*.md`, re-queries it with `gh`, and emits

```powershell
if ($st.state -eq "MERGED" -or $st.state -eq "CLOSED") {
  Line "STALE" ($f.Name + " references #" + $n + " which is " + $st.state + " -- escalation is DEAD, clear it. Do NOT report it as pending.")
}
```

Two independent errors sit on that one line, and **both push in the same direction: retire a live
escalation.**

**(a) CLOSED is collapsed into MERGED.** A PR that closed *unmerged* is not evidence that anything
shipped. For one whole class of escalation it is the **premise**: `pr-1612-closed-unmerged-branch-holds-
the-only-copy-2026-09-05.md` exists *because* #1612 closed unmerged and its branch is the only copy of
the work. Section 5 reads that PR's CLOSED state and prints `escalation is DEAD, clear it` — the
instrument retires the escalation exactly when its premise is satisfied.

**(b) Any PR number in the body is read as the escalation's subject.** A `#NNNN` cited as *evidence*
is byte-identical, to this regex, to one cited as the subject. `label-removal-is-the-release-path-and-
leaves-no-signature-2026-09-05.md` cites thirty merged PRs as its measured evidence and therefore
generates thirty separate `escalation is DEAD, clear it` instructions about itself.

Nothing warns and nothing is empty, so DOCTRINE section 9.6 never fires: the regex did exactly what it
was asked. This is section 7's shape — a confident, coherent, wrong verdict about the one queue that
holds work only Marco can discharge.

## Evidence [MEASURED] 2026-09-06T18:1x-18:3xZ @ origin/main 414cac0d

Run: `& scripts\pipeline\status-sweep.ps1 *>&1 | Set-Content <file>` (captured, because the script
returns early and hides its own section 7 verdict).

```
[STALE] lines emitted by section 5                              -> 126
distinct escalation files told to "clear it"                    -> 26
needs-marco/*.md at depth 1                                     -> 29
```

**26 of 29.** The project memory index carries 23 of those as OPEN items, so the sweep contradicts the
escalation register on almost every row it prints, every run.

Worked instance for (a) — the escalation whose premise the sweep denies:

```
sweep §5 printed:
  [STALE] pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md references #1612
          which is CLOSED -- escalation is DEAD, clear it. Do NOT report it as pending.

but, live, the branch it is about is still there and still not on main:
  git ls-remote --heads origin feat/crm-account360-v2-s1
    -> 4638600aaed79448d582fda485fc7d440ac9c1f9  refs/heads/feat/crm-account360-v2-s1
  git merge-base --is-ancestor 4638600a origin/main   -> exit 1   (NOT on main)
  gh pr list --head feat/crm-account360-v2-s1 --state all
    -> #1612  CLOSED  mergedAt=(empty)
```

POSITIVE control that the ancestry probe can answer YES, so `exit 1` is a real negative and not a
broken instrument:

```
git merge-base --is-ancestor 414cac0d origin/main   -> exit 0   (on main, as expected)
```

NEGATIVE control on the premise needle (a needle minted this run, per DOCTRINE section 9.6):

```
Select-String -SimpleMatch 'eq "MERGED" -or'          scripts/pipeline/status-sweep.ps1 -> 1
Select-String -SimpleMatch 'zzQq04Needle20260906T1815' scripts/pipeline/status-sweep.ps1 -> 0
```

Worked instance for (b): `label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md`
produced 30 `[STALE]` lines in the same capture, one per merged PR it cites as evidence.

## The work

Both halves are one small, additive change at the section 5 verdict. **Keep every true STALE line —
do not weaken the check; split it.**

1. **Ask `gh` for `mergedAt`, not just `state`.** `gh pr view <n> --json state,isDraft,mergedAt`.
   Per DOCTRINE section 9.4, `merged` is unreliable on a *list* response; `mergedAt` is correct on
   both endpoints and `pr view` is the per-PR form. Assign, then read — never `@(ConvertFrom-Json ...).Count`.

2. **Three verdicts where there were two:**
   - `mergedAt` populated -> `[STALE] ... which is MERGED -- ...` (unchanged; this is the true case).
   - `state -eq "CLOSED"` and `mergedAt` empty -> **not** STALE. Emit
     `[FILE] <file> references #<n> which CLOSED UNMERGED -- this may be the escalation's PREMISE, read the file before clearing it.`
   - OPEN -> unchanged.

3. **Separate the subject from the evidence.** Treat a PR ref as the escalation's *subject* only when
   the number appears in the **filename** (e.g. `pr-1612-...`) or on the file's **first heading line**.
   Every other ref is context: emit it as
   `[FILE] <file> cites #<n> (<state>) as evidence -- not its premise; does not clear the escalation.`
   Keep the count, drop the instruction — the instruction is the harmful half.

Leave sections 1-4, 6 and 7 alone. Do not touch the `Line` helper.

## Acceptance readback (this, not a green build)

Re-run the sweep and assert, in the capture:

- `pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md` no longer appears on any
  `[STALE]` line;
- the total `[STALE]` count has fallen and every survivor names a PR with a populated `mergedAt`
  that is also named in its own filename or first heading;
- section 7 still prints its verdict (the script's early-return path is unchanged).

Quote the before/after `[STALE]` counts in the PR body. Before, measured this run: **126 lines / 26
files**. That number is STATE — re-measure it, do not copy it forward.

## Lane note

`scope` is `scripts/pipeline/**`, outside `^(tests|docs)/`, so `classifyPolicyFiles` routes the
resulting PR to **Marco** and the watcher will not auto-merge it. That is correct and expected — do
not widen the lane to get it merged.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**Marco's lane means: open the PR and LEAVE IT UNMERGED.** It does not mean "wait for approval
before starting". There is no human in this run. **Finishing the work and then asking for
permission is indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop before
pushing.
