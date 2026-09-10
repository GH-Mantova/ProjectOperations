# Station 00 — Supervisor | ADDENDUM to the 2026-09-09T23:08Z run | 2026-09-09T23:33Z–23:4xZ

## GROUND

```
UTC            2026-09-09T23:33Z      (addendum written after #1829 merged at 23:29:54Z)
origin/main    eb5aa0eb               (fetched, then rev-parse — no pipe)
dev tree       main @ eb5aa0eb        C:\ProjectOperations2   (0 ahead, 0 behind after the cure below)
doc version    1
bootstrap      1
```

Same run, same station, later measurement. The parent report is
`00-00-supervisor-2026-09-09-2308-forty-two-missed-hourly-runs-and-eleven-uncollected-breadcrumbs-the-collect-restarts-here.md`
and everything in it stands.

## WHAT I MEASURED

**The post-merge fast-forward refused on a cause the station doc does not list.** `00-supervisor.md`
records two causes for the refused post-merge fast-forward: an **untracked breadcrumb** at a path the
merge must create, and a **modified tracked file** another station is told to leave dirty
(`docs/pipeline/sweep-rotation.json`). Both were present tonight and both cures were applied — eleven
breadcrumbs proved byte-identical (`git rev-parse origin/main:<path>` against `git hash-object <path>`,
never a piped hash) and deleted, `.arming-log.txt` and `sweep-rotation.json` restored to HEAD with
`git show HEAD:<path>` piped to a node write, never `git checkout -- <path>`.

The fast-forward then refused anyway:

```
error: The following untracked working tree files would be overwritten by merge:
	docs/pr-prompts/pr-vmgitguard-selftest-and-recursion-HOLD.md
Please move or remove them before you merge.
Aborting
```

[MEASURED] `git rev-parse origin/main:docs/pr-prompts/pr-vmgitguard-selftest-and-recursion-HOLD.md`
→ `ba7a92bb…` and `git hash-object` on the disk copy → `ba7a92bb…` — **identical**. The file is a
`-HOLD.md` **prompt**, not a breadcrumb: Station 04 staged it untracked in the dev tree at
`2026-09-08T10:11Z` (its F3/F4), and a **different lane** tracked it on `main` tonight as `#1826`'s
entire diff. So the dev tree held an untracked file at a path an incoming commit creates, exactly as
in cause one — but nothing this station wrote, and nothing any station was told to leave dirty.

After deleting the proven-identical copy, the fast-forward completed
(`Updating f482d1a5..eb5aa0eb`, 21 files) and the file was restored from the **new** HEAD, per the
fourth action the cure already prescribes for the breadcrumb case. All three read-backs:
`git rev-list --left-right --count HEAD...origin/main` → **`0 0`**, `git diff --cached --name-status`
→ **EMPTY**, `git diff --numstat` → three entries, none of them mine (below).

**The three surviving `--numstat` entries are another actor's live work, not residue.** `0 155`
`pr-brandtheme-s5-density-tokens-and-control-HOLD.md` and `0 171`
`pr-ea-gate-report-self-filter-HOLD.md` are prompts consumed by builds whose PRs (`#1827`, `#1823`)
are still OPEN; `52 0` `pr-ea-s2-dashboard-preset-HOLD.md` is an edit carried by the open `#1824`.
None was touched.

**The collect is verified from the instrument CI uses, not asserted.** [MEASURED]
`node scripts/pipeline/check-pipeline-heartbeat.mjs --hours 6` →
`[heartbeat] ALIVE: alive — newest breadcrumb is station 00 at 2026-09-09T23:08:00Z (0.4h ago)`,
**exit 0**, against the five consecutive failures of the same job on `f482d1a5` quoted in the parent
report. `check-breadcrumb.mjs --freshness` → `CLEAN`, all four stations `ok`,
`structure: 21 checked, 0 malformed`.

## WHAT CHANGED

This file. Nothing else: no arm, no merge, no label, no `/sot/`, no watcher action.

## FINDINGS

### F1 — The refused post-merge fast-forward has a THIRD cause, and it arrives from a lane that has never read the cure

`00-supervisor.md` enumerates two causes and warns, correctly, that *"the cure for the untracked case
does not touch"* the second. Tonight produced a third: **an untracked file another lane's PR tracks on
`main` while it is still sitting untracked in the shared dev tree.** Its symptom is byte-identical to
cause one — the same `error: The following untracked working tree files would be overwritten by merge`
— and its cure is the same three steps. What is different is who creates it and who can predict it.

Cause one is self-inflicted: the run that wrote the breadcrumb is the run that trips on it, and cure 1
("write it inside your own PR worktree") removes it entirely. Cause two is a documented hand-off
between two stations. **This one is neither.** Station 04 staged the prompt untracked at 09-08T10:11Z
and dispatched it to 00; the collect never ran; a second lane picked the file up and landed it as
`#1826` twenty-six hours later. No station's own discipline could have prevented the collision,
because the two actors involved never saw each other.

⚠️ The dangerous reading is the one the existing text invites: a run that applies cure one, sees the
fast-forward still refuse, and follows the doc's own advice to *"rule the smudge out"* goes looking at
`.gitattributes` and line endings — the paragraph immediately above tells it to. **Read the error text;
it names the file**, and then ask whether that file is tracked on `origin/main`. If it is, and
`git rev-parse origin/main:<path>` equals `git hash-object <path>`, it is this cause and the cure is
identical to cause one.

🔧 **Generalised, and this is the form worth landing in the canonical block eventually:** the blocker
is never a *kind of file*, it is the predicate *"the dev tree holds an untracked path that the incoming
commit creates"*. Enumerating the kinds — breadcrumb, then hand-off file, now another lane's prompt —
will keep going wrong, because the next kind will not be in the list either.

⚠️ **Falsifying probe:** re-run the cure on a dev tree holding an untracked file that a PR opened by
some other actor has just landed. If the fast-forward succeeds without deleting it, this finding is
wrong.

**ACTIONED** — the fast-forward completed, the dev tree reads `0 0` and a clean index, and the file was
restored from the new HEAD. The doc change itself is **DEFERRED**: the two-cause text lives in
`docs/pipeline/stations/00-supervisor.md`, outside the hash-gated canonical block, so it is a cheap
single-file edit — but it belongs with the four other DOCTRINE section 9 edits this run deferred, in
one follow-up PR, rather than as a third merge inside one hour while another lane is driving the board.

## WHAT I DID NOT DO

- Did not edit `docs/pipeline/stations/00-supervisor.md` in this PR — see the disposition above.
- Did not touch `pr-brandtheme-s5-…-HOLD.md`, `pr-ea-gate-report-self-filter-HOLD.md` or
  `pr-ea-s2-dashboard-preset-HOLD.md`, all three of which read dirty in the dev tree and all three of
  which belong to open PRs opened by another lane.
- Did not merge, arm, label, or touch `/sot/` — Station 05's session was still writing files while
  this was written, and its worktree advanced to `60d96dec` during the run.
