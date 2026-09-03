# Station 06 — PR Master | 2026-09-03T03:38Z–03:50Z

Run by the **cloud/chat lane** following the Station 06 pathway at Marco's instruction.
`[NO LANE VERDICT — hand-classified]` per DOCTRINE §10.1. Brief: regenerate the six `Claude Design`
spec documents (Marco, 2026-09-03 — specs only, not the 65 mock-ups). **Fifth and last of the
five slices approved as item 2.**

## GROUND

```
UTC            2026-09-03T03:38Z
origin/main    f5c01415
dev tree       main @ 52f985e8   C:\ProjectOperations2
doc version    1
bootstrap      n/a — invoked from chat
```

## WHAT I MEASURED

**[MEASURED] 🔴 The brief as stated cannot be delivered through the pipeline.**
`git ls-tree -r --name-only origin/main -- "Claude Design"` returns **exactly one file**:
`Claude Design/assets/routes.js`. `git check-ignore -v` confirms the rest is excluded by a bare
`Claude Design/` rule in `.gitignore`:

```
Claude Design/docs/00-design-system.md   IGNORED
Claude Design/mockups/jobs.html          IGNORED
Claude Design/README.md                  IGNORED
Claude Design/assets/routes.js           not ignored   (tracked before the rule existed)
```

A prompt that rewrote the seven specs would produce **an empty diff** — nothing to review, nothing
to merge, no record it happened, and the same rot a month later. **Un-ignoring the written half is
the precondition for every regeneration slice**, not an optional tidy-up.

**[MEASURED] DOCTRINE does name it as a lane.** `docs/pipeline/DOCTRINE.md`:
*"Claude Design can author interface work the same way."* And `04-scanner.md:198` treats
`routes.js` as ground truth. So this is a sanctioned authoring lane whose written output is
invisible to git, to CI, to GitHub and to any agent that greps the tracked tree. That is the whole
reason all seven documents are still dated 26 June.

**[MEASURED] The size of the regeneration, so it can stop being a feeling.**
154 KB across seven documents, **54 `##` sections** — `01-commercial` 9 · `02-operations` 9 ·
`03-assets-maintenance-forms` 9 · `04-workforce-directory-platform` 11 ·
`05-dashboards-admin-account` 13 · `06-field-portal-auth` 3 — against **67 `route:` entries** in
`routes.js`. **At least 13 screens were never documented even in June.** Nobody has established
which of the 54 sections actually moved, so "regenerate the six specs" currently has no scope, no
order and no acceptance test.

**[MEASURED] Nothing queued.** No prompt in `docs/pr-prompts/` proposes this; the only matches for
`Claude Design` are my own breadcrumb and `pr-visualreview-s3` (which cites `Claude Design/` as a
`design_ref` target).

## WHAT CHANGED

Two prompts placed at the queue root as `-HOLD` (nothing armed; `armed: 0`, `HOLD: 77`):

| File | Lint |
|---|---|
| `pr-claudedesign-s1-track-the-written-half-HOLD.md` | **ADMIT (size 10)** |
| `pr-claudedesign-s2-spec-regeneration-plan-HOLD.md` | **REJECT [FILE_GATE_NOT_RELEASED]** — correct |

Cluster `claude-design`, orders 1 and 2. S2 gates on
`requires_file_on_main: Claude Design/docs/01-commercial.md` — verified **absent** from
`origin/main`, so the gate is live and not a dead one. It releases itself the moment S1 lands,
because S1 is what puts that file on main.

Nothing else. No arming, no code, no `Claude Design/` edit, no `sot/`.

## FINDINGS

**F1 — The design lane's written output is unreviewable by construction.**
**DISPOSITION: DISPATCHED** — Station 00, as `pr-claudedesign-s1`. It un-ignores `docs/` and
`README.md` only; the 65 mock-ups, the 194 KB `styles.css` copy and the other assets stay ignored.
The seven docs are committed **byte-for-byte as they are** plus one staleness banner each, so the
regeneration slices have a real diff to be reviewed against. It also creates
`Claude Design/proposed/README.md` — the lifecycle home that `design_ref` (VS-S3) points at.

⚠️ **The prompt carries a gitignore trap in full**, because the obvious edit silently does nothing:
git cannot re-include a file whose parent directory is excluded, so `!Claude Design/docs/` under a
`Claude Design/` rule has no effect. The rule must become `Claude Design/*` with explicit
negations, and `routes.js` must be proven still tracked afterwards with `git ls-files
--error-unmatch`. The prompt's Verify section requires `git ls-files "Claude Design" | wc -l` to
return **10** — a materially larger number means the pattern was made too permissive and 65 HTML
files are about to be committed.

**F2 — Size 10 is over the station's default ceiling of 6, and the prompt says why.**
Seven of the ten files take one inserted banner each and are otherwise unchanged; the real change
is `.gitignore`. Splitting the banners out would leave main in a state where the docs are visible
but silently dated, which is worse than either end state.

**F3 — Regeneration itself is a SLICE PLAN, not a PR.**
54 documented sections against 67 routes, rewritten against today's UI, is not one change set and
cannot be honestly sized until someone diffs the described screens against the real components.
**DISPOSITION: DISPATCHED** — `pr-claudedesign-s2` produces
`docs/plans/claude-design-spec-regeneration-plan.md`: a per-route drift table
(NONE / MOVED / GONE / UNDOCUMENTED / UNVERIFIABLE, with §7.1 provenance discipline), counts by
class, and one chained slice per document that actually drifted — **most-drifted first, and no
slice at all for a document whose rows are all NONE.** Its Verify requires the table to carry one
row per `route:` entry and states both counts, because a table shorter than the route list has
silently dropped screens.

**F4 — `Claude Design/current/` is deliberately NOT created here.**
Generated screenshots belong to the visual-review chain (`pr-visualreview-s2`), and an empty folder
committed now would only rot. The two chains meet later, once S2 has proven the PNGs survive.
**DISPOSITION: DEFERRED.**

## WHAT I DID NOT DO

- **Did not arm anything.** The `git mv` to `-ready` is Station 00's.
- **Did not regenerate a single spec.** Doing so before F1 lands would have written 154 KB into a
  diff nobody could see — the exact failure mode being fixed.
- **Did not un-ignore the mock-ups or the assets.** Marco decided specs only.
- **Did not touch `routes.js`.** Station 04 depends on it at its current path.
- **Did not touch `sot/`.**

## ITEM 2 IS COMPLETE

Eight prompts across five approved pieces of work, all `-HOLD`, none armed:
`vmguard` s1–s2 · `visualreview` s1–s3 · `hygiene` s1 · `claudedesign` s1–s2.
Five breadcrumbs from this lane await Station 00. Board: 77 HOLD, 0 armed, no `index.lock`.
