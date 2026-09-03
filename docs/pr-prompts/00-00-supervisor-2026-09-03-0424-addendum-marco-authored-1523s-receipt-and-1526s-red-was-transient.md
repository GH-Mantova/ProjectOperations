# Station 00 — Supervisor (ADDENDUM to the 0410 run) | 2026-09-03T04:18Z–2026-09-03T04:26Z

## GROUND

```
UTC            2026-09-03T04:24:00Z
origin/main    bf862fb4                  (was 34cb51bd at the 0410 report's GROUND)
dev tree       main @ bf862fb4           C:\ProjectOperations2
doc version    1
bootstrap      1
```

Same run, same session, later measurement. This addendum closes three findings the 0410 breadcrumb
left open with predictions rather than results, and adds one new one.

## WHAT I MEASURED

- **[MEASURED] `#1526`'s red WAS transient — confirmed, not predicted.** After
  `gh run rerun 33712548462 --failed`, `gh pr list --state open --json statusCheckRollup` reads
  `#1526 CLEAN | ALL GREEN`. The `CP-G2` 5000 ms hook timeout did not reproduce. F4 of the 0410
  breadcrumb is now closed by measurement.
- **[MEASURED] `#1527` merged.** `gh pr view 1527` → `MERGED 2026-09-03T04:18:59Z`, merge commit
  `bf862fb4`. Merged through the sanctioned path (`Assert-SmokedOrEscalate` → `Merge-Pr -PR 1527`,
  both `True`), after hand-classifying it: 18 files, **zero** outside `^(tests|docs)/`, and no
  `[watcher] merge result for PR #1527` line exists because I opened it with `gh`, not the watcher.
  Per DOCTRINE §10.1 that absence is recorded as `[NO LANE VERDICT — hand-classified]`, never as
  "checked, and not Marco's".
- **[MEASURED] The eight prompts are now tracked and armable.** Dev tree fast-forwarded
  `34cb51bd → bf862fb4`; `Get-ChildItem docs\pr-prompts -Filter *-HOLD.md` counts **76**, the same
  number as before the reconcile, and `git status` no longer lists any of the eight as `??`.
- **[MEASURED] Marco authored `#1523`'s CP-26 approval receipt at ~04:14Z.**
  `git log -1 --format='author=%an committer=%cn subject=%s' dd8317eb` →
  `author=GH-Mantova committer=GitHub subject=Create 1523.md`; `git show --stat` → a single new file,
  `docs/decisions/merge-approvals/1523.md`, 8 insertions. `committer` is the github.com web editor —
  the human discriminator. This is exactly the receipt the 0326 breadcrumb said only Marco could
  author, and it is the answer to it.
- **[MEASURED] `#1523`'s e2e is red again on the receipt commit, with the IDENTICAL failure.**
  `gh run view 33713592727 --job 100518041063 --log` →
  `batch3-scope-items.spec.ts:256:7 › Batch 3 — Scope of Works items › plant pills: add a plant
  cluster, set qty/days, remove it (PRs #241, #72)`, `1 failed`, trailing
  `apiRequestContext.fetch: Target page, context or browser has been closed` at `:304:28`. `dd8317eb`
  adds **only** a markdown file, so nothing about the code under test changed between `17b0d7d5` and
  `dd8317eb`. The 0325 diagnosis stands unamended: slice 4 removed `ItemPlantCell`, and the test
  drives UI that moved. The trailing `fetch … closed` is teardown, not cause.

## WHAT CHANGED

1. **`#1527` merged to `main`** (`bf862fb4`), read back MERGED. It carried the eight untracked HOLDs,
   seven breadcrumbs, the `pr-1526` review and the `.arming-log.txt` line.
2. **Dev tree fast-forwarded to `bf862fb4`.** See F6 for the two-step this required.
3. **Nothing else.** `#1526` and `#1523` were not merged, no label was touched, nothing was armed.

## FINDINGS

### F6 — The fast-forward aborted on LINE ENDINGS, and the fix is a per-file verify, never a blanket clean

`git merge --ff-only origin/main` aborted twice with
`Your local changes to the following files would be overwritten by merge: docs/pr-prompts/.arming-log.txt`.
Both copies were **identical in content** — 37 lines each, same final line
(`2026-09-03T03:40:31Z ARMED pr-vmguard-s1-persist-and-repo-param`) — and differed only in CRLF vs LF,
exactly the trap the standing notes record as *"FF can fail on LINE ENDINGS too — verify by CONTENT,
not hash."* The first abort had a second cause: sixteen files that were untracked locally had become
tracked on `main` in `#1527`.

The cure that is safe here and the cure that is forbidden look almost the same, so state both.
**Forbidden:** `git checkout .`, `reset --hard`, `stash pop`, `git clean` — the BOARD TRAP, which
resurrects dead prompts. **What I did instead:** a throwaway node script compared each of the sixteen
paths against `git show origin/main:<path>` with line endings normalised and deleted **only** on an
exact content match (`removed=16 kept=0`, every line printed `IDENTICAL -> removed`), then a
**single-file** `git checkout -- docs/pr-prompts/.arming-log.txt` whose content I had verified
byte-for-byte first. Nothing was discarded that `main` did not already carry. The script was deleted
after use.

**DISPOSITION: ACTIONED** — dev tree is at `bf862fb4`, `git status` clean of this run's work, HOLD
count back to 76.

### F7 — `#1523` now has Marco's approval and still cannot merge, and the receipt is the proof the gate works

Marco authored `docs/decisions/merge-approvals/1523.md` himself at ~04:14Z. That satisfies CP-26. It
does **not** clear RULE 2 — `#1523`'s live watcher verdict is
`{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`, and
RULE 2 is cleared only by Marco in chat, for that batch only. It is also academic today, because the
PR is **red**: the plant-pill e2e regression is unchanged by the receipt commit.

So the board's single blocker is now stated precisely: **`#1523` is approved and broken.** The only
thing standing between it and `main` is a real test failure in `tests/e2e/pr-acceptance/batch3-scope-items.spec.ts`,
which is a `tests/`-only change on an existing feature branch — the cheapest possible fix lane, and the
one already dispatched.

**DISPOSITION: DISPATCHED** → Station 01, re-affirming the 0325 dispatch with the added evidence that
the failure survived a no-op commit. Scope is `tests/e2e/pr-acceptance/batch3-scope-items.spec.ts` on
`feat/scope-wbs-plant-columns`, and the instruction is unchanged: point the assertions at where slice 4
moved the plant UI. **Relaxing the assertions produces a test that lies** and is not an acceptable fix.

### F8 — `#1526` is green, clean, and waiting on Marco alone

`gh pr list` reads `#1526 CLEAN | ALL GREEN`. Its watcher verdict is
`{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/clear-stale-index-lock.ps1"}`,
which is correct — it edits `scripts/`. There is no work left on it and no defect in it.

**DISPOSITION: ESCALATED** — Marco. The question is one line: **`#1526` (vm-git-guard persists onto
PATH; `clear-stale-index-lock.ps1` gains a repo parameter) is green and clean — merge it?** It is the
predecessor gate for `pr-vmguard-s2`, which cannot be armed until `#1526` is on `origin/main`, so the
vm-guard chain is stopped on this one answer.

## WHAT I DID NOT DO

- **Did not merge `#1523` or `#1526`.** Both carry a live `marco:true`; a CP-26 receipt is not a RULE 2
  clearance and neither is green.
- **Did not touch `#1523`'s branch or its test file.** It is 01's, and a second actor on an in-flight
  branch is the collision LL-38 records.
- **Did not arm.** `pr-vmguard-s2` is gated on `#1526` reaching `origin/main`; the six newly-tracked
  06 prompts all touch `scripts/` and would each open another Marco-gated PR onto a board that already
  has two. First arm when `#1526` or `#1523` lands should be `pr-visualreview-s1`.
- **Did not archive the dispositioned breadcrumbs** into `docs/pr-prompts/archive/`. They are this
  cycle's and are still being read; the archive pass is the next run's, and `--freshness` matches by
  basename so archiving never makes a station read SILENT either way.
- **Did not commit** the other stations' in-flight working files (`metadata-catalog.json`,
  `sweep-rotation.json`, `pr-cardui-s8-waste-section-HOLD.md` — known dirty MID-EDIT by 06 —
  `pr-rates-s11c-drop-legacy-tables-HOLD.md`, `queue-watch-state.md`, `.queue-sync-ledger.txt`).
- **Did not touch `/sot/`, Azure/Entra/SharePoint, or production data.**
