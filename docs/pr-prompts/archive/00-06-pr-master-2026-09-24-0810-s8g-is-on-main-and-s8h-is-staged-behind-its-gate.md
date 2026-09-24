# Station 06 to Station 00 - S8g is on main, S8h is staged behind it, and the gate that still holds is the right one

**From** Station 06 - PR Master, 2026-09-24T08:10Z, at `origin/main` `6ba06122`.
**To** Station 00 (interactive lane 00i and the scheduled lane both).
**Why you** the board split Marco set: 06 stages and arms its own prompts; 00 drives PRs to green
and merges. Marco asked 06 by name to tell 00i when the Geoapify pair was staged. This is that.

## GROUND

```
UTC            2026-09-24T08:10:00Z
origin/main    6ba06122
dev tree       C:\ProjectOperations2 at dc697304 (behind main; not fast-forwarded by this run)
actor          station-06.pr-master (supervised, Marco in chat)
staged by      throwaway worktrees off origin/main, removed after each push
```

This run staged two prompts and nothing else. No code, no `sot/`, no label, no merge, no arm.

## WHAT I MEASURED

**The Geoapify pair, and the state of each half.**

| slice | prompt | PR | state |
|---|---|---|---|
| S8g - API: road routing, modelled traffic index, trip arithmetic | `pr-scopecards-s8g-geoapify-travel-and-time-index-HOLD.md` | #2155 | **MERGED** 2026-09-24T08:02:07Z, prompt on main |
| S8h - web: travel strip, editable allowance, Find-tip fix | `pr-scopecards-s8h-traffic-index-ui-HOLD.md` | #2157 | **OPEN**, docs-only, yours to merge |

[MEASURED] `lint-prompt.mjs` over the S8h draft returns **REJECT [GATE_NOT_RELEASED]**, exit 1:
its `requires_on_main` names
`apps/api/src/modules/tendering/providers/geoapify-route.provider.ts :: GEOAPIFY_ROUTE_TRAVEL_V1`,
and that file is not on `origin/main`.

**This is the point worth carrying, because it is easy to read backwards.** S8g's *prompt* merging
does not release S8h. The gate is on the provider file S8g's *build* produces. So the order is
forced by measurement rather than by anyone remembering it: S8g must be armed, built and merged
before S8h can lint ADMIT. A `do-not-arm` marker on S8h would have added nothing that the file gate
is not already enforcing, so none was written.

[MEASURED] S8g still carries its own human gate - the Geoapify API key and plan are a fact only
Marco holds. It is not armable until he clears that, and clearing it is his act, not 06's and not
00's.

[MEASURED] both PRs are docs-only. #2157 touches exactly two paths: the prompt and
`Claude Design/proposed/s8h-traffic-index/s8h-traffic-index-mockup.html`, the mock-up Marco
approved in chat and the target of the prompt's `design_ref`. Neither PR is subject to CP-24 -
no `sot/` file is in either diff.

## WHAT CHANGED

- Staged `pr-scopecards-s8g-geoapify-travel-and-time-index-HOLD.md` (#2155, now merged).
- Staged `pr-scopecards-s8h-traffic-index-ui-HOLD.md` plus its mock-up (#2157, open).
- Both drafted in `C:\PR-Master\drafts\` and published through throwaway worktrees off
  `origin/main`, per NO-DRIFT. Nothing was written into the dev tree's `docs/pr-prompts`.
- Both worktrees removed after push; `git worktree list` shows only the dev tree and one
  pre-existing station worktree.
- This breadcrumb was written inside #2157's branch, so no loose copy blocks the next
  fast-forward.

## FINDINGS

**F1 - the Azure Maps prompt S8b is superseded and must not be armed.** S2.
`pr-scopecards-s8b-azure-maps-travel-HOLD.md` (#2102) proposed the same capability through Azure
Maps. Marco replaced that approach with Geoapify, which is already a registered ERP integration,
so S8b is dead by decision rather than by defect - its own gate still reads as a live question
about an Azure Maps account that nobody is going to open. Retiring it to `superseded/` is a board
act, not a drafting one. **DISPATCHED to Station 00**, to run once S8g's code is on main - not
before, so the shelf never sits with neither of the two on it.

**F2 - S8g changes what existing waste lines price at, and that is a behaviour change, not a
refactor.** S2. Today a final part-used day is charged as a full day of kilometres; after S8g fuel
follows the trips that actually happen. Day hire is untouched, so the movement is fuel-only and
downward, and it appears on any existing line the moment it is re-saved. This is in the prompt
body, but a merge decision made from the PR title alone would miss it. **ESCALATED to Marco** -
raised in chat in this run; it is a pricing question, not an engineering one.

**F3 - the S8h slice carries a live defect fix that is easy to lose in review.** S3. The waste tab
currently resolves a tip through Find tip and then discards the id (`_mapLocationId`), so the line
keeps a facility name and a straight-line distance and never the facility itself. S8h renames it
and patches `mapLocationId`, which is what makes route pricing reachable from the finder at all.
If S8h is ever split, this half must not be the part that gets dropped. **ACTIONED** - specified
in the prompt with its own test, and recorded here so the reason survives the prompt.

**DISPOSITION.** F1 DISPATCHED to Station 00 (conditional on S8g's code landing). F2 ESCALATED to
Marco. F3 ACTIONED in the S8h prompt.

## WHAT I DID NOT DO

- **Did not arm either prompt.** S8g waits on Marco's key-and-plan answer; S8h waits on S8g's code.
- **Did not remove or narrow any gate**, and did not write a `do-not-arm` marker onto S8h to
  simulate one - the file gate is real and sufficient.
- **Did not retire S8b.** It is still tracked and still gated; see F1 for when and by whom.
- **Did not touch `sot/`**, in any worktree.
- **Did not go near Azure, Entra or SharePoint** - including for S8b, whose gate names an Azure
  Maps account.
- **Did not merge, label, or drive any PR.** #2157 is open and unlabelled; it is yours.
- **Did not fast-forward the dev tree.** It is behind `origin/main` and was left that way; every
  measurement above was taken against `origin/main` or a fresh worktree, not the dev tree.
