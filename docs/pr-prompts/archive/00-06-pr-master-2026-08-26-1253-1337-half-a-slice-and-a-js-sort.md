# Station 06 — PR Master — 2026-08-26 12:53Z — #1337 is half a slice; not merged, not mine to merge

## GROUND

Station 06 (PR Master), unattended. Previous breadcrumb:
`00-06-pr-master-2026-08-26-1226-linter-merged-and-a-lost-escalation.md`.

Board at 12:47Z: **#1337 open (BLOCKED)**, `pr-dns-s1-tfm-series-ready.md` still armed and unconsumed
(armed 12:26Z, ~26 min — the watcher is occupied), and a file `rev-1337-ready.md` in the queue that I
did not create.

## WHAT I MEASURED

### `rev-1337-ready.md` — not an arming

Watcher-generated review task (12:45:44Z) dispatching the `pr-fix-reviewer` agent at #1337. Its
rule 3: *"Do NOT merge, close, or comment on the PR… The verdict file is the only output.
**Marco merges.**"* So #1337 is watcher-routed to Marco — RULE 2 applies, and I do not merge it.
Second instance tonight of the queue gaining a `-ready` file that is not my arming (see F7).

### #1337 — head `6982d454`, +379 / −15, 2 files

This is the rates-consumers slice 3 I filed to `needs-marco/` at 12:26Z as blocked on Marco's A/B/C
decision. The PR opened at **12:42:41Z — 16 minutes after I filed it.**

It took none of A, B or C. It took a fourth path: a **documented partial migration**. It routes only
`estimatePlantRate` through `listRates("plant")` and leaves the other two on direct prisma, with
reasons in a code comment — `estimateWasteRate` because `listRates("waste")` drops `wasteGroup` +
`loadRate` (Marco's blocker, restated accurately), `estimateMaterialDensity` because
`listMaterialDensities()` injects `isActive:"desc"` as a leading sort key and breaks the row order.

**Credit where due: it did not touch the resolver and did not drop a single export column or persona
field.** It declined to make Marco's call for him. The comment reasoning is correct.

**But it does not satisfy its own `done_when`**, which requires ZERO matches of
`prisma\.(estimate[A-Za-z]+Rate|cuttingOtherRate)\.` across BOTH named files. Measured on the PR head:

| File | Violating matches |
|---|---|
| `rates-export.service.ts` | **1** — `prisma.estimateWasteRate.` |
| `lookup-rate.handler.ts` | **16** — 8 distinct models |

`lookup-rate.handler.ts` is **untouched**. The persona half of the slice — half the PR's own title —
is absent from the diff. RULE 1 (complete + additive) fails on "complete", and by a wide margin.

### A second defect, independent of completeness

The original plant query was a **database** sort: `orderBy: [{category:"asc"},{item:"asc"}]`. The PR
replaces it with an **in-memory JS** sort on `.toLowerCase()` string comparison. Postgres collation
and JS lexicographic ordering of lowercased strings are not equivalent (case, punctuation,
non-ASCII). The sort key reads `r.info.Category` with `?? ""` fallback, so any row missing that key
sorts to the top of the sheet.

The PR can therefore **reorder rows in the very export whose byte-identical contract it cites as its
reason for restraint elsewhere.** Worth fixing under any of A/B/C.

Also noted: `listRates()` is legacy-first by default (`tryListLegacy` runs before `tryListRateTable`),
so the routed path may still resolve to the legacy table — the migration's benefit here is partly
nominal.

## WHAT CHANGED

- **`needs-marco/rates-consumers-slice3-blocker-2026-08-26.md` UPDATED** with an "UPDATE 12:52Z"
  section, so Marco does not read a stale escalation. His A/B/C decision is restated as still open;
  #1337 narrows the question rather than settling it.
- Nothing merged. Nothing armed. `pr-dns-s1-tfm-series` remains armed and unconsumed.

## FINDINGS

**F8 — #1337 is half a slice and must not merge.**
Fails `done_when` 1 + 16 violations against a required zero; the persona handler is untouched.
*Disposition: **ESCALATED** — not merged. Routed to Marco via `rev-1337-ready.md` in any case. Findings written into
the `needs-marco/` file where Marco will see them, since the pr-fix-reviewer may or may not catch the
JS-sort defect and I did not want it to depend on that.*

**F9 — DB sort replaced by JS sort in an export claiming a byte-identical contract.**
*Disposition: **DEFERRED** — recorded in the escalation. Not fixed — fixing it would mean editing a PR that is
routed to Marco and blocked on his unanswered design decision.*

## WHAT I DID NOT DO

- **Did not merge #1337.** Watcher-routed to Marco (RULE 2), and defective on the merits.
- **Did not comment on #1337.** `rev-1337-ready.md` rule 3 reserves PR comments for the watcher
  mirroring the reviewer's verdict. Staying out of that lane.
- **Did not touch the #1337 branch**, and did not fix the JS-sort defect.
- **Did not decide A/B/C.** Still Marco's, still unanswered.
- **Did not arm anything this tick.** RULE 4: `pr-dns-s1-tfm-series` is still in flight.
- **Did not run `git` through the device bridge.** All measurement via the GitHub API.
- **Did not commit anything.**
