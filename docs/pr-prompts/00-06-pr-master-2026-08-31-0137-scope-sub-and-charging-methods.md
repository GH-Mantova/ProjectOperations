# Station 06 — PR Master | 2026-08-31 00:10Z–01:37Z

## GROUND

```
UTC            2026-08-31T02:15Z
origin/main    c1244317   (rev-parse, no fetch — see the note below)
dev tree       main @ c1244317   C:\ProjectOperations2
doc version    1  (station_doc_version, docs/pipeline/stations/06-pr-master.md:3)
bootstrap      [CANNOT MEASURE] — no scheduled-task file was read this run
```

**These two SHAs were filled in at 02:15Z, after the run.** For most of this run they read
`[CANNOT MEASURE]`, because I was applying §9.2 as a blanket ban on git. It is not: it forbids git
**through the device bridge** (`device_bash`, the Linux VM), because a cut-short VM-side call
leaves an `index.lock` with no Windows process to attribute it to. Desktop Commander spawns a
native Windows process and cannot produce that signature. Every git call in this run was read-only
(`rev-parse`, `status`, `diff --cached`) and none was a fetch, so `origin/main` here is the local
remote-tracking ref and may lag the true remote tip.

This run was driven interactively by Marco from a Cowork session, not fired by the scheduler. Two
consequences, stated up front rather than buried:

1. **PREFLIGHT step 2 was satisfied imperfectly.** `06-pr-master.md`, `DOCTRINE.md` and
   `PROMPT-SCHEMA.md` were read **from the working copy**, not from `git show origin/main:<path>`,
   because §9.2 forbids running git through the bridge. That tree may be behind `main`, and a
   `station_doc_version` match is explicitly not a freshness proof. Every rule I applied below is
   therefore "as recorded in the dev tree at 01:30Z", and Station 00 should re-check it if any of
   these three documents moved in the last few days.
2. **PREFLIGHT step 4 (`status-sweep.ps1`) was not run.** Nothing in this run mutates the board,
   the queue, or any lock — it writes seven files and this breadcrumb, and arms nothing.

## WHAT I MEASURED

**[MEASURED]** Premise and cluster-gate truth for all seven prompts, via a node script reading the
dev tree directly (`C:\Windows\Temp\po-check-premises.mjs`, moved out of the repo after use):

```
PASS  est-s1  premise: TENDER_RATE_SNAPSHOT_APPLIED absent   [contains=false, wanted=false]
PASS  est-s2  premise: CUTTING_RATE_CORRECTIONS_V1 absent    [contains=false, wanted=false]
PASS  est-s2  gate needle not yet on main (no dead gate)     [contains=false, wanted=false]
PASS  est-s3  premise: chargeSteps absent                    [contains=false, wanted=false]
PASS  est-s3  gate needle not yet on main                    [contains=false, wanted=false]
PASS  est-s4  premise: ChargeStepsEditor absent              [contains=false, wanted=false]
PASS  est-s4  gate needle not yet on main                    [contains=false, wanted=false]
PASS  sub-s1  premise: duplicated DISCIPLINES tuple PRESENT  [contains=true,  wanted=true ]
PASS  sub-s2  premise: SUB not in disciplines tuple          [contains=false, wanted=false]
PASS  sub-s2  gate file/needle not yet on main               [file MISSING,   wanted=false]
PASS  sub-s3  premise: isProvisional absent from summary     [contains=false, wanted=false]
PASS  sub-s3  gate needle not yet on main                    [contains=false, wanted=false]

ALL PASS
```

**[INFERRED]** Those results are a **proxy for `origin/main`, not a measurement of it.** The real
lint probes `git show origin/main:<path>`. If the dev tree is behind, a premise could still be
stale and a gate could still be dead. This is the single largest gap in this run.

**[MEASURED]** Static conformance to `PROMPT-SCHEMA.md` for all seven, using a re-implementation of
`lint-prompt.mjs`'s own `parseFrontMatter` (copied line-for-line from the real one so the quote-
stripping behaviour matches): required fields, `size <= 10`, front matter at line 1, no block
scalars, `gate_allow` against `migrations/` in scope, `rollback_strategy` present for migration
scope, Gate A (`backfill: false` or a named spec), `DESTRUCTIVE_MUST_ESCALATE`, `UNKNOWN_KEY`,
`REQUIRES_*` value shapes, all five cluster codes, the four required body sections.
**7 of 7 clean.**

**[MEASURED]** The STANDING AUTHORITY block is byte-identical across all seven — extracted
programmatically from `pr-scopesub-s1` and appended to the rest, then verified:
`md5 = a280ae6d38a35b5d893838efe72ae426` for all seven.

**[MEASURED]** ERP facts each prompt asserts, re-read this run rather than trusted from earlier:

| Claim | Evidence |
|---|---|
| The provisional mechanism is one hardcoded discipline | `estimate-excel.builder.ts:104-105` — `for (const disc of DISCIPLINE_ORDER) {` / `if (disc === "Other") continue;` |
| Other prints below the total in its own orange block | `estimate-excel.builder.ts:129-155` — `// Provisional / Other row — shown as its own block below the main total.` |
| `summary()` buckets have no per-line notion | `scope-redesign.service.ts:866-881` — `perDiscipline[itemDiscipline]`, `bucket.subtotal += totals.lineTotal` |
| The export payload hardcodes four discipline keys twice | `estimate-export.service.ts:333` (`summaryTyped`) and `:384` (the `summary:` literal) |
| `ScopeOfWorksItem` has no provisional flag, only an amount | `schema.prisma:3643-3645` — `provisionalAmount Decimal? @map("provisional_amount")`, commented "discipline=Prv only" |
| `isProvisional` is an existing naming precedent, not an invention | `schema.prisma:2710` — `isProvisional Boolean @default(false) @map("is_provisional")` on `EstimateItem` |

**[MEASURED] 02:10Z — the real linter has now been run, and my earlier `[CANNOT MEASURE]` on this
line was over-cautious.** §9.2 forbids git through the **device bridge** (`device_bash`, the Linux
VM) because a cut-short VM-side call leaves an `index.lock` with no Windows process behind it.
Desktop Commander spawns a native Windows process, so that signature cannot arise. Preflight first:
no `index.lock` in either tree, no `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` /
`rebase-merge` / `rebase-apply` / `sequencer`. `lint-prompt.mjs` only renames a file when passed
`--dequeue` (`:1561`), so a plain invocation is read-only.

```
pr-estpricing-s1-tender-rate-snapshot-HOLD.md       exit 0  ADMIT (size 5)
pr-estpricing-s2-cutting-rate-corrections-HOLD.md   exit 1  GATE_NOT_RELEASED
pr-estpricing-s3-rate-table-step-lists-HOLD.md      exit 1  GATE_NOT_RELEASED
pr-estpricing-s4-charge-steps-editor-HOLD.md        exit 1  GATE_NOT_RELEASED
pr-scopesub-s1-one-discipline-list-HOLD.md          exit 0  ADMIT (size 6)
pr-scopesub-s2-sub-discipline-HOLD.md               exit 1  GATE_NOT_RELEASED
pr-scopesub-s3-priced-or-provisional-HOLD.md        exit 1  GATE_NOT_RELEASED
pr-rates-value-column-units-HOLD.md                 exit 0  ADMIT (size 3)
pr-rates-column-edit-ui-HOLD.md                     exit 1  GATE_NOT_RELEASED
```

**Exit 1 here is the correct verdict, not a defect.** `GATE_NOT_RELEASED` is what a parked HOLD
returns while its predecessor's needle is absent from `origin/main`; the linter says so explicitly
— *"A bare ADMIT would be indistinguishable from a prompt whose gate IS satisfied."* The control is
`pr-rates-column-edit-ui-HOLD.md`, a prompt written weeks ago by someone else, which returns exactly
the same code. **Anyone re-running this must not read exit 1 on a gated HOLD as a failure**, and an
instruction to expect exit 0 across the set (which an earlier draft of this breadcrumb gave) is
wrong.

What matters is what did NOT appear: no exit 3 anywhere, so every premise still holds against the
real repo — which independently confirms the dev-tree proxy measurements above; and no
`CLUSTER_DEAD_GATE`, `SIZE_TOO_LARGE`, `MISSING_FIELD`, `BACKFILL_TEST_REQUIRED`,
`DESTRUCTIVE_MUST_ESCALATE` or `UNKNOWN_KEY` on any file. Each gate rejection names the exact needle
it is waiting on, which is the proof the chains are wired to real artifacts.

**[MEASURED]** `node scripts\pipeline\check-breadcrumb.mjs --station 06` → **exit 0, CLEAN**
(`structure: 1 checked, 0 malformed, 0 skipped`). It also emits
`NOTE ... is UNTRACKED — it reaches nobody until a board PR commits it`, which is F7 restated by the
tooling itself.

## WHAT CHANGED

Seven prompt files written to `C:\ProjectOperations2\docs\pr-prompts\`, all `-HOLD`, all armed by
nobody. No `*-ready.md`. No board mutation. No queue mutation. Nothing dispatched.

**Cluster A — `estimating-pricing`** (fixes money that is currently wrong):

| # | File | size | gate_allow | Chains on |
|---|---|---|---|---|
| 1 | `pr-estpricing-s1-tender-rate-snapshot-HOLD.md` | 5 | none | — |
| 2 | `pr-estpricing-s2-cutting-rate-corrections-HOLD.md` | 4 | none | `rate-resolver.service.ts :: TENDER_RATE_SNAPSHOT_APPLIED` |
| 3 | `pr-estpricing-s3-rate-table-step-lists-HOLD.md` | 7 | migrations | `scope-redesign.service.ts :: CUTTING_RATE_CORRECTIONS_V1` |
| 4 | `pr-estpricing-s4-charge-steps-editor-HOLD.md` | 6 | none | `schema.prisma :: chargeSteps` |

**Cluster B — `scope-subcontracted`** (the approved mock-up, shipped):

| # | File | size | gate_allow | Chains on |
|---|---|---|---|---|
| 1 | `pr-scopesub-s1-one-discipline-list-HOLD.md` | 6 | none | — |
| 2 | `pr-scopesub-s2-sub-discipline-HOLD.md` | 6 | none | `disciplines-single-source.spec.ts :: disciplines-single-source` |
| 3 | `pr-scopesub-s3-priced-or-provisional-HOLD.md` | 8 | migrations | `disciplines.ts :: "SUB"` |

Every one is `escalates: true`. Every one changes money or how money is presented, and the merge
gate is cheap — PROMPT-SCHEMA's own guidance on false positives says set it anyway.

Both migration slices declare `backfill: false` honestly: each adds one column and writes no data.
`pr-scopesub-s3` additionally names `summary-section-markup.spec.ts` in scope, because changing the
shape of `summary()`'s buckets breaks that spec's assertions — the failure mode that sank #595.

**One edit to a prompt I did not author** (Marco's call, 31 Aug, in chat):
`pr-rates-column-edit-ui-HOLD.md` — `escalates: false` → `escalates: true`, plus the standard
merge-gate line in Guardrails with a note saying who raised it and why. It was the only prompt
across both clusters and the hygiene chain that would auto-merge on green, and it rewrites the
Columns card on a screen estimators use and can reorder VALUE columns — which changes what a priced
lookup returns. Nothing else in that file changed. **Unlike the seven new files, this one is
already tracked, so it lands as a modification, not an addition — it needs to be in the same
docs-only commit or it silently does not take effect.** File is CRLF throughout, as it was before
the edit; verified no BOM and that the lint's own `/^---\r?\n/` still matches.

Also written: `C:\Windows\Temp\po-check-premises.mjs` (the premise prober, moved out of the repo
after use so it cannot show up as untracked in the dev tree) and this breadcrumb.

## FINDINGS

**F1 — The seven prompts are written and validated as far as this environment permits, but they
are NOT queue entries.**
PROMPT-SCHEMA opens with the rule in a red box: *"A prompt that exists only as an untracked file in
a working tree is NOT staged"*, and `git clean` has wiped the queue this way before.

**RESOLVED 02:20Z, and my stated reason for escalating it was wrong.** I wrote *"GitHub MCP writes
403 from this sandbox"* — carried over from PROMPT-SCHEMA's general note about Cowork, never
tested. It is not true here: `get_me` returns `GH-Mantova` with write access, and the docs PR named
below was opened through the API. An untested claim used to justify handing work back to a human is
the same class of error as an untested claim used to justify doing it.

**ACTIONED** — the nine paths are committed to a branch and a docs-only PR is open (only `docs/**`,
so CP-24 is satisfied). Pushed through the GitHub API rather than the local index, deliberately:
`git diff --cached --name-status` at 02:15Z showed
`R100 docs/pr-prompts/pr-crm-s4-no-history-proposal-HOLD.md -> ...-ready.md` **already staged by
another chat**, plus three staged deletions. A plain `git add` + `git commit` from here would have
carried someone else's arming into this docs PR — the §9.2 shared-index collision, caught by
looking rather than by a guard. Nothing in the local index or working tree was modified.
Marco still merges the PR; that has not changed.

**F2 — RESOLVED 02:10Z. `lint-prompt.mjs` has now been run on all seven plus both hygiene slices,
and `check-breadcrumb.mjs` on this file.** Results and the reading of them are under WHAT I
MEASURED. Three ungated heads ADMIT (est#1, sub#1, hyg#1); six gated HOLDs return
`GATE_NOT_RELEASED`, which is correct; nothing returned exit 3, so no premise is stale.
Breadcrumb is CLEAN by its own validator, quoted there.
**ACTIONED** — no longer Marco's to run. Kept below for reference; re-run after each merge to see a
gate open:

```
node scripts\pipeline\lint-prompt.mjs docs\pr-prompts\pr-estpricing-s1-tender-rate-snapshot-HOLD.md
node scripts\pipeline\lint-prompt.mjs docs\pr-prompts\pr-estpricing-s2-cutting-rate-corrections-HOLD.md
node scripts\pipeline\lint-prompt.mjs docs\pr-prompts\pr-estpricing-s3-rate-table-step-lists-HOLD.md
node scripts\pipeline\lint-prompt.mjs docs\pr-prompts\pr-estpricing-s4-charge-steps-editor-HOLD.md
node scripts\pipeline\lint-prompt.mjs docs\pr-prompts\pr-scopesub-s1-one-discipline-list-HOLD.md
node scripts\pipeline\lint-prompt.mjs docs\pr-prompts\pr-scopesub-s2-sub-discipline-HOLD.md
node scripts\pipeline\lint-prompt.mjs docs\pr-prompts\pr-scopesub-s3-priced-or-provisional-HOLD.md
```

Expect exit 0 only from the ungated heads. Exit 1 with `GATE_NOT_RELEASED` on a parked slice is the
system working. Exit 3 would mean the premise is already satisfied on `main` — that slice needs
re-authoring, not arming — and none returned it.

**F3 — Four verified pricing bugs are live on `main` and every one of them under- or over-charges a
real tender.** Core-hole depth divides by 10 with no rounding and no minimum
(`scope-redesign.service.ts:185-280`); Tracksaw and Flush-cut fall back to the smallest depth row so
every cut bills $18.00/m regardless of depth; core holes accept a method multiplier they should not
have; and Demosaw wall rows are loaded x1.1 on top of a rate that is already 1.71x the floor rate
($53.46 against $48.60).
**DISPATCHED** — to the queue as `pr-estpricing-s2-cutting-rate-corrections-HOLD.md`, gated behind
s1 so the tender rate snapshot lands first and the corrections cannot silently reprice a tender that
was already quoted.

**F4 — `RATES_CANONICAL_SOURCE` defaults to `legacy`, and nothing in this repo can tell me what the
App Service actually has.** `rate-resolver.service.ts` switches `tryLegacy` against `tryRateTable`
on it. If production is already on `rate-table`, slice s1's snapshot behaviour lands on a different
code path than the one I reasoned about. Reading or changing an Azure App Setting is a DOCTRINE §5
hard stop — it is not a PR and I will not attempt it.
**REVISED 01:58Z after F5b.** The prompt edit that closes this is now made and is correct for
either setting, so the reading no longer gates arming s1 — it gates how you VERIFY s1 once it
lands, and it tells you which of the two `resolveRate` branches production actually executes today.
**ESCALATED** — Marco reads `RATES_CANONICAL_SOURCE` on the App Service. Unset or `legacy` means
production prices through `tryLegacy` first and the snapshot precedence in s1 point 2 is the whole
ballgame. `ratetable` means the cutover is live, and two follow-ons change status: the arm gate on
`pr-524-rates-b-slice2-canonical-HOLD` ("a full live pricing cycle with zero
`ratetable-miss-fell-back-to-legacy` events") becomes checkable, and `pr-rates-s11c-drop-legacy-tables`
moves from theoretical to real. Neither is armed and neither should be without that log evidence.

**F5 — CORRECTED 01:58Z. My first statement of this finding was wrong and is retracted here rather
than edited away.** I wrote: *"`pr-rates-value-column-units-HOLD` … overlaps cluster A's rate-table
work … Two prompts editing `RateColumn` semantics in flight at once is how a cluster deadlocks."*
Re-reading all three slices of `rates-column-hygiene` refutes both halves. `pr-rates-value-column-units`
sets `unit` on three seeded rows; it changes no `RateColumn` semantics. `pr-estpricing-s3` adds a
column to `RateTable` and does not touch `RateColumn` at all. Their only shared scope entry is
`apps/api/prisma/migrations/**`, which is timestamp-foldered and does not collide.

The real overlap is elsewhere and is one file. `apps/web/src/pages/admin/RatesListsAdminPage.tsx`
is in the scope of BOTH `pr-estpricing-s4-charge-steps-editor` (mounts a new card) and
`pr-rates-column-edit-ui` (hygiene #2, rewrites the Columns card and introduces
`handleUpdateColumn`) — and hygiene #3 gates on that needle in that file. Nothing else is shared:
hygiene #2 explicitly forbids touching `rate-tables.service.ts`, `rate-validation.service.ts` and
the controller, which is exactly the server surface est-s4 extends.

The dependency runs the other way from a conflict, too. `assertStructure` blocks every column add
and edit on `plant`, `fuel` and `enclosure` until hygiene #1 lands, so an admin cannot add a column
for a step list to reference on those three tables. Hygiene #1 is a **prerequisite for est-s4 being
usable**, not a competitor to it. And the chain lengths order themselves: hygiene #1 and #2 are one
and two PRs deep, est-s4 is four, so on current gates they land first without anyone intervening.
**DEFERRED** — no action needed to prevent a deadlock, because there is no deadlock. It becomes
urgent only if est-s4's gate is ever loosened or hygiene #2 is held: then the two race for
`RatesListsAdminPage.tsx` and whichever merges second rebases by hand. Revisit at that point.

**F5b — `pr-estpricing-s1` had the defect it exists to prevent, and it is fixed.** The prompt said
to resolve from the snapshot "instead of the live tables" without saying where in `resolveRate` that
check belongs. `resolveRate` (`rate-resolver.service.ts:79-103`) forks on `getCanonicalSource()`,
and with the default `legacy` it tries `tryLegacy` first, reaching `tryRateTable` only for slugs
legacy does not know. `enumerateRateSet` (`:159-163`) builds the snapshot from
`prisma.rateTable.findMany({ where: { isReference: false } })` — RateTable only, whichever way the
switch is set. An agent wiring the snapshot inside the `ratetable` branch would therefore ship a
locked tender that still prices from live legacy rates: the display-only defect the slice exists to
remove, intact and better hidden.
**ACTIONED** — added a numbered requirement to `pr-estpricing-s1` that the snapshot check sits
above the switch rather than inside a branch, with a spec case run with `RATES_CANONICAL_SOURCE`
unset. Verified by re-reading `resolveRate` and `enumerateRateSet` at the lines quoted.

**F7 — ADDED 02:05Z. The seven prompts are sitting untracked in a dirty dev tree, and a watcher
restart would silently stash them out of the queue.** `start-watcher.ps1` runs
`git stash push --include-untracked` whenever the tracked tree is dirty at startup. The watcher's
own source names this as a thing that "has SILENTLY MOVED staged prompts out of the queue"
(`scripts/pr-watcher/index.mjs:211-219`, the comment above `parseUntrackedReadyPrompts`). Today's
log shows the watcher restarting three times in half an hour last night — 20:55:08, 20:58:28 and
21:25:04 — so this is not a hypothetical. The tree is dirty right now: seven new untracked files
plus one modified tracked file (`pr-rates-column-edit-ui-HOLD.md`).
**ESCALATED** — commit the nine paths before anything else, and before arming anything. This
outranks F1: F1 is about the prompts not being visible to the stations, F7 is about them being
moved out from under you by a routine restart.

**F8 — ADDED 02:05Z. Live queue state, measured, and it is healthy.**
[MEASURED] `logs/2026-08-31.log` line `[watcher] prompt-dir:  C:\ProjectOperations2\docs\pr-prompts`
— the watcher process runs out of `C:\po-watcher\ProjectOperations` but watches the DEV tree, so
the seven files are in the directory that is actually read. (The watcher tree has its own stale
`docs/pr-prompts/` holding two armed files from July and August and an older copy of
`pr-rates-column-edit-ui-HOLD.md` still at `escalates: false`; nothing reads it, but do not
hand-copy prompts out of there.)
[MEASURED] Heartbeat at `C:\po-watcher\...\heartbeat.log` is 1 minute old and reads
`pr-crm-s4-no-history-proposal-ready.md elapsed=660s` — the watcher is alive and mid-job.
[MEASURED] `[queue] pr-crm-s4-no-history-proposal-ready.md (depth: 1, source: watch)` then
`[start]` — the queue drains **serially**, one agent at a time; multi-lane routing is default-off.
[MEASURED] Auto-merge policy is `tests-docs`, and the escalation hold demonstrably works:
`[merge] PR #1409: escalates:true — NOT enabling auto-merge; labelling do-not-merge`, same for
#1412.
**ACTIONED** — no change needed; recorded because "the watcher is fine" is a claim that expires,
and the next station to read this should re-measure rather than trust the line.

**F6 — `estimate-excel.builder.ts:105` skipping `Other` is deliberate, not a bug.** I nearly filed
it as one. Provisional sums print below the total by design, in their own orange block. This matters
because it made "does subcontracted work sit inside the tender price?" a genuine product question
rather than a defect, and Marco answered it on 31 Aug: *"it is a mix... User should be able to move
it to priced or to provisional on a case by case basis"*.
**ACTIONED** — that ruling is what `pr-scopesub-s3` implements, and the prompt quotes it verbatim so
the agent cannot re-litigate it. Verified by re-reading `:104-158` this run and quoting the code in
the prompt body.

## WHAT I DID NOT DO

- **Did not arm anything.** All seven are `-HOLD`. PROMPT-SCHEMA is unambiguous that a loose armed
  `*-ready.md` will be executed whatever its front matter says, and that arming a prompt *is* the
  decision to run it. That decision is Marco's, and it is not made by a file rename I performed
  while he was reading something else.
- **Did not run `status-sweep.ps1`.** It is PREFLIGHT step 4 and I skipped it. In its place I
  measured the specific things this run could affect: `index.lock` in both trees, the five
  mid-flight git state files, and the watcher heartbeat. That is narrower than the sweep and should
  not be quoted as one.
- **Did not write anything to the local git index, HEAD, or working tree.** Every git call was
  read-only (`rev-parse`, `status`, `diff --cached`); no `add`, `commit`, `checkout`, `fetch`,
  `stash` or `clean`. The commit went through the GitHub API instead — see F1 for why that mattered
  in practice.
- **Did not touch the three staged deletions or the staged CRM arming** found in the shared index
  at 02:15Z (`pr-crm-s4-review-and-link-preview-HOLD.md`, `pr-crm-s5-accounts-crud-wiring-HOLD.md`,
  `pr-lint-frontmatter-block-scalar-collapse-HOLD.md` deleted; `pr-crm-s4-no-history-proposal`
  renamed to `-ready`). They belong to another chat or to `queue-sync`. They are recorded here only
  so that whoever reads this knows the index was dirty and why nothing was committed from it.
- **Did not arm, rename, or move any prompt file** — mine or anyone else's.
- **Did not touch `/sot/`, the board, the queue folders, or `RATES_CANONICAL_SOURCE`.**
- **Did not write the SUB linked-item or multi-quote UI into a prompt.** It is in the approved
  mock-up and it is real work, but `pr-scopesub-s2` is already size 6 and the UI is a separate
  shape. It belongs in a slice 4 that nobody has written yet.
- **Did not adjudicate `provisionalAmount`'s "discipline=Prv only" comment**, which names a
  discipline code (`Prv`) that no longer appears in `IS_DISCIPLINE_CODES`. It is stale documentation
  on a legacy path, it is not load-bearing for anything in these seven, and widening scope to chase
  it would have pushed `pr-scopesub-s3` over size 10.
