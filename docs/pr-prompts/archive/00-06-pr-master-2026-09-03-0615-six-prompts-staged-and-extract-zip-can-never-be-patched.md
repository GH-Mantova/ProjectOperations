# Station 06 — PR Master | 2026-09-03T05:20Z–2026-09-03T06:15Z

Run by the **cloud/chat lane** following the Station 06 pathway at Marco's instruction.
`[NO LANE VERDICT — hand-classified]` per DOCTRINE §10.1: docs-only, every path under
`docs/pr-prompts/`, so this PR is the tests-docs lane's. Staged under Phase 6 with Marco's explicit
approval, given in chat at ~06:10Z.

## GROUND

```
UTC            2026-09-03T05:20Z–06:15Z
origin/main    de811907  (at run start; #1523 merged 05:37Z mid-run)
dev tree       main, read-only from this lane
doc version    1
bootstrap      n/a — invoked from chat
sweep verdict  CAUTION (1 live station worktree, not mine) — acted in an isolated
               worktree off origin/main, new branch, new PR, new files only
```

## WHAT I MEASURED

**[MEASURED] `RATES_CANONICAL_SOURCE` is set in no environment, so production runs `legacy`.**
`grep -rn` across the repo returns exactly one assignment, `.env.example:209`, a template that is
never loaded. Absent from the live root `.env`, absent from `apps/api/.env`, absent from
`.github/workflows/deploy.yml` — which deploys with `azure/webapps-deploy@v3` and a publish profile
and sets **no app settings at all**, so the API's environment is whatever the App Service
Configuration blade holds. Marco read that blade on 2026-09-02: nothing there. `app.config.ts:16`
returns `ratetable` only on an exact match ⇒ unset resolves to `legacy`.

**[MEASURED] Two tracked plan documents assert the opposite, and one of them inverts the
dead-edit trap.** `docs/plans/rates-migration-plan.md:8` and
`docs/plans/settings-restructure-plan.md:445`. The first tells the reader the *legacy* screen is the
dead-edit surface; with the flag unset the legacy path is authoritative for all eight priced slugs, so
the **new** `RatesListsAdminPage` / `/settings/reference-data` is the dead one. The same document
still lists "a full real pricing cycle has run on `ratetable`" as an unmet 11c precondition, so it
contradicts itself. `docs/plans/rate-hub-sor-integration-plan.md:76` is **correct** and was left alone
— it describes the mechanism, not production.

**[MEASURED] There are TWO labour pricing paths and only one reads shift.**
*Path A*, `scope-of-works.service.ts:637-664`, reads `scopeItem.shift ?? "Day"` and calls
`resolveRate("labour", { role, shift })`; `rate-resolver.service.ts:932` selects `nightRate` /
`weekendRate` correctly. *Path B*, `buildRateMaps` + `computeScopeItemTotals` in
`scope-item-pricing.ts` (called from `scope-of-works.service.ts:334` and
`scope-redesign.service.ts:896`), never sees them: the adapter at `scope-of-works.service.ts:325-328`
filters `listRates("labour")` to `r.keys["shift"] === "day"` before building the maps, `buildRateMaps`
at `:97` accepts only `{ role, dayRate }`, and `computeScopeItemTotals` at `:181-182` never reads
`item.shift`. ⇒ an estimator sets Night, is quoted the **day** rate while estimating, and the figure
only changes if the tender is later converted through Path A. 600 vs 1000 for five of seven roles.
**The resolver is not the bug** — `listRates` already models shift as a key and already emits the
night rows at `:605`. Both defects are in the consumers.

**[MEASURED] The caveat that would have caught it had already expired.**
`scope-item-pricing.ts:14-15` reads *"Shift is currently always 'Day' (legacy field, not surfaced in
the canonical UI). nightRate/weekendRate ignored."* `#1511` surfaced the Shift dropdown on
2026-09-02. The premise died with that merge and the pricing was not updated.

**[MEASURED] `extract-zip` can never be patched, and a puppeteer bump deletes it.** The npm registry
lists `extract-zip` versions ending at **2.0.1** — that is the final release, and Dependabot's
`first_patched_version` for GHSA-jmr9-qjv8-65gv is empty. One route in:
`apps/api` → `puppeteer 23.11.1` → `@puppeteer/browsers 2.6.1` → `extract-zip ^2.0.1`. Every 2.x of
`@puppeteer/browsers` still depends on it (2.6.1, 2.7.0, 2.8.0, 2.10.0, 2.11.0, 2.12.0 all checked);
**3.2.1 dropped it** — its deps are `yargs` and `modern-tar` — and `puppeteer 25.9.0` resolves 3.2.1.
The other six alerts are two override bumps: `fast-uri` needs `>=4.1.3` (an override exists but pins
`>=4.1.2`, one patch too low) and `browserslist` needs `>=4.28.7` (no override at all).

**[MEASURED] Six of this run's prompts lint clean; the seventh verdict is the gate working.**
`node scripts/pipeline/lint-prompt.mjs` with `LINT_REPO_ROOT` pinned: five ADMIT, and
`pr-wbsshift-s1` `REJECT [GATE_NOT_RELEASED]`, which is the correct parked state for a chained
successor. Every scoped path was existence-checked before staging; `pr-wbsshift-s2`'s spec path was
wrong on first write — the real path carries an extra `scope/` segment.

## WHAT CHANGED

Seven files added under `docs/pr-prompts/`, all new, none overwriting anything: six `-HOLD.md`
prompts and this breadcrumb. **Nothing was armed, nothing was merged, no code was touched, `sot/` was
not touched, and the shared dev tree was not written to.** The work was done in a disposable worktree
off `origin/main` and torn down after the push.

## FINDINGS

**F1 — Two plan documents state that production prices from `RateTable`. It runs `legacy`.**
The claim is measurably false and `rates-migration-plan.md:8` builds an inverted dead-edit
consequence on top of it, pointing readers at the wrong admin surface. Two independent audits
sequenced work off it. **DISPATCHED → the queue** as `pr-plandocs-s1-prod-runs-legacy-not-ratetable`,
lint ADMIT (size 2), docs-only.

**F2 — 11c is barred for a second, independent reason.**
`pr-rates-s11c-drop-legacy-tables-HOLD.md:40` requires "a full real pricing cycle has run on
`RATES_CANONICAL_SOURCE=ratetable`". Production has never run `ratetable` for one minute, so that
precondition has never been met — this is separate from, and additional to, the map-locations
decision (D3). **DEFERRED** — it becomes urgent only if anyone proposes arming 11c; both bars must
clear first, and either alone is sufficient to stop it.

**F3 — The live scope-card pricing path ignores shift, so a night line is quoted at the day rate.**
Up to 40% under-quote, reaching the client-facing number, and the two API paths disagree with each
other. **DISPATCHED → the queue** as a two-slice chain:
`pr-wbsshift-s2-api-pricing-reads-shift` (ADMIT, size 4, `escalates: true`, **cluster_order 1**) and
`pr-wbsshift-s1-web-rate-follows-shift` (size 2, **cluster_order 2**, gated on
`scope-item-pricing.ts :: labourRateForShift`). The order is load-bearing: today the label and the
price are both the day rate — wrong but consistent — and correcting the display first would show a
night rate over a day-rate price, which is worse than the current state.

**F4 — `extract-zip` (Dependabot #88) has no patch and never will; the fix is to delete the
dependency.** **DISPATCHED → the queue** as `pr-deps-s2-puppeteer-major-drops-extract-zip` (size 4,
`escalates: true`), kept separate from `pr-deps-s1-fasturi-browserslist-overrides` (ADMIT, size 2) so
a PDF-rendering regression cannot ride along with a routine security bump.
🔴 **The named risk in it: `deploy.yml:116` calls a path *inside* puppeteer**
(`node node_modules/puppeteer/lib/esm/puppeteer/node/cli.js`). A major bump can move that file, and
the failure surfaces as PDF rendering breaking in production, not as a red build.

**F5 — 29 of 32 published artifacts have no pointer from the tracked tree.**
A repo-wide sweep finds three referenced ids — `1c1d373e` (16 files), `a6a66f6e` (2), `453e590b` (1).
Two of the unreferenced briefs had already completed audits that were later re-done from scratch.
**DISPATCHED → the queue** as `pr-artifactregister-s1-track-the-brief-index` (ADMIT, size 1). It is
the (a) half; the (b) half, `design_ref` front-matter, is already staged as
`pr-visualreview-s3-design-ref-frontmatter-HOLD.md`. Neither alone closes it.

**F6 — The Work Breakdown artifact carried three understated and two already-closed claims.**
Re-measured: Dependabot **7** highs not one; the watcher clone's `needs-marco` holds **~180** stranded
escalations not seven, including `pr-1512` and `pr-1519` which post-date the original list, so the
channel is still filling; `paused/` holds **nine** `-ready.md` not ten and **does not** contain the
11c drop; `pr-cardui-s2` is **not** on main (retired by `#1506`); and the Station 00 cron and
blindness items were the stale side of a contradiction with the artifact's own Decisions tab.
**ACTIONED** — the artifact was republished to the same URL as v2.2 with every correction folded in,
and the corrections are in project memory at
`project_artifact_workbreakdown_verification_2026_09_03_0520.md`.

**F7 — `pr-vmguard-s2` is no longer gate-blocked.**
Linted as a control this run and it now reports `PROMOTE / GATE_RELEASED` —
`scripts/pipeline/vm-git-guard.sh :: ensure_on_path` landed in `#1526` at 04:56Z. The standing note
that it must not be armed is stale as of this morning. **DISPATCHED → Station 00**: re-measure it
rather than skipping it on the old note. A `PROMOTE` is not an armability verdict — check `ls-tree`
and read the body first.

## WHAT I DID NOT DO

- **Did not arm anything.** All six prompts are `-HOLD`. Arming is Station 00's, one at a time.
- **Did not merge anything**, and did not touch `#1523`, `#1529` or any open PR.
- **Did not write code.** Every finding above became a prompt, not a commit.
- **Did not touch `/sot/`**, the dev tree, the watcher clone, `.gitignore`, or any queue subfolder.
- **Did not materialise the prompts into the dev tree.** They are `-HOLD`, so no watcher glob matches
  them and materialisation is unnecessary; the dev tree picks them up on its next fast-forward. An
  untracked copy placed there now would only risk blocking that fast-forward.
- **Did not touch `docs/plans/rate-hub-sor-integration-plan.md`** — its line 76 is correct.
- **Did not propose pricing by the estimator's chosen labour Type.** `labourTypeId` is local browser
  state that reaches no API; pricing by `DEFAULT_ROLE_BY_DISCIPLINE` is the current design, not a
  defect. Measured before it was written down.
- **Did not dismiss or suppress Dependabot #88**, and did not add an `extract-zip` override — there
  is no safe version to point at.
- **Did not answer D3.** It is Marco's, it is the one-way door, and the new evidence is that the
  Discipline Cards mock-up reproduces the string join rather than solving it, so option (a) changes
  the design of record too.
