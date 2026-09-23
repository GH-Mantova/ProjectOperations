# Station 00 — Supervisor | 2026-09-23T21:14:00Z–2026-09-23T21:32:00Z

Collect run. **Not blind.** The board is three PRs and every one of them is Marco's; the arming pool
is thirteen HOLDs and **none** of them is armable. Both halves measured, with controls. The previous
occurrence's F3 — the unretryable CodeQL red it handed forward — **cleared on its own**, so the
synthetic commit it declined to push was never needed.

## GROUND

```
UTC            2026-09-23T21:14:34Z
origin/main    1edd7454              (fetched, then rev-parse)
dev tree       main @ 1edd7454       C:\ProjectOperations2   (0 0; --numstat, --cached EMPTY)
doc version    1
bootstrap      1
```

Actor `station-00.sched-2114z`, scheduled, headless. Read in the **dev tree**, not the watcher clone.
`git diff --numstat origin/main --` against all three binding docs was **EMPTY**, so the working
copies of `00-supervisor.md`, `DOCTRINE.md` and `STATION-CAPABILITIES.md` are byte-identical to
`origin/main` and reading them locally is reading `origin/main` (PREFLIGHT step 2's sound form —
no piped hash).

## WHAT I MEASURED

| probe | result |
|---|---|
| `vm-git-guard.sh` last line + exit | [MEASURED] `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.` **exit 2** — the expected station outcome; the device-bridge git ban is REMEMBERED, not mechanical |
| reach to the Windows box | [MEASURED] `start_process` `powershell.exe` PID 5968, `cd C:\ProjectOperations2` answered. **Not a blind run** |
| `check-breadcrumb.mjs --freshness` | [MEASURED] `CLEAN`, exit **0**. 00 `0.3h`, 03 `21.8h`, 04 `3.1h`, 05 `6.9h` — all `ok`, none SILENT |
| `status-sweep.ps1` verdict | [MEASURED] `SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.` Section 5 emitted **zero `[STALE]` rows** |
| open board, per-PR (not from a list rollup) | [MEASURED] `#2135` OPEN/BLOCKED, `#2131` OPEN/**CLEAN**, `#2127` OPEN/**CLEAN**; **no labels on any of the three** |
| the sweep vs. that read, 3 minutes apart | [MEASURED] sweep at `21:14:58Z` had `#2131` and `#2127` **BLOCKED**; the per-PR read had both **CLEAN**. §7's *`[LIVE]` means true when measured* |
| `#2135` routing verdict | [MEASURED] `pr-devtree-sync-ff-only-guard-ready.md.log` :: `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: .claude/hooks/guard.mjs"}` |
| `#2127` routing verdict | [MEASURED] `pr-field-service-nul-separator-ready.md.log` :: `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/field/field.service.ts"}` |
| `#2131` routing verdict | [MEASURED] **EMPTY.** POSITIVE CONTROL: the same probe over the same corpus returns **761** verdict lines, so the probe is calibrated and the emptiness is real (§10.1) |
| `#2131` hand-classification | [MEASURED] files = `docs/pipeline/SCRIPT-REGISTRY.md`, `docs/pipeline/stations/00-supervisor.md`, **`scripts/pipeline/why-blocked.ps1`**. The third matches none of the three `NESTED_TEST_PATHS` forms ⇒ **Marco's** |
| `NESTED_TEST_PATHS` falsifying probe (§10.1) | [MEASURED] `git show origin/main:scripts/pr-watcher/index.mjs` still contains `const NESTED_TEST_PATHS = [` and `NESTED_TEST_PATHS.some(...)` — the three-form array stands, §10.1's paragraph is still correct |
| `#2135` full check list | [MEASURED] **14 pass / 0 fail / 1 pending**. `Analyze (actions)` **pass** (50 s, run `35920302608`), `CodeQL` **pass**. Only `tendering-e2e` pending |
| arming pool | [MEASURED] **13** `*-HOLD.md`; `lint-prompt.mjs` ⇒ **6 ADMIT**, 7 REJECT |
| every gate on all 6 ADMIT | [MEASURED] see the table in F2. **0 of 6 have a met gate.** POSITIVE CONTROL `origin/main:package.json` PRESENT; NEGATIVE CONTROL `origin/main:zzz/no/such/path.md` ABSENT |
| `docs/approvals/` on `origin/main` | [MEASURED] `git ls-tree -r` ⇒ **2 files total**: `README.md` and `watcher-identity-approved-by-marco.md`. One approval has ever been issued |
| title-scope vocabulary probe | [MEASURED] against `check-pr-title.mjs`'s own `checkTitle`/`vocabularyLayers` (vocab size **140**): `map-locations` **OK/vocabulary**, `api` OK, `pipeline` OK; `tipid` **REJECT**, `tip-id` **REJECT**; NEGATIVE CONTROL `zzzNoSuchScopeZzz` REJECT |
| dev-tree untracked leftovers | [MEASURED] `git status --porcelain` tracked-clean; untracked: `Claude Design/docs/index.html` and `docs/pr-reviews/pr-{2119,2131,2133,2134,2135}-review.md` |

## WHAT CHANGED

**Nothing on the board, nothing in the queue, and that is the correct outcome — not a quiet run.**
No PR merged (all three are Marco's, measured above). No prompt armed (none is armable, measured
below). No label added or removed. This breadcrumb and its board PR are the only mutations.

One housekeeping deletion: `tmp-outputs/probe-title-scope.mjs`, the throwaway I wrote to exercise
`checkTitle` against the real vocabulary. Read back absent. It was never tracked.

## FINDINGS

**F1 — `#2131` is CLEAN, unlabelled, and carries NO watcher verdict; hand-classification makes it
Marco's, and a run that skipped §10.1 would have merged it.** [MEASURED] above. This is §10.1's
exact shape: the `marco:true` probe returns **empty** for `#2131`, and empty is indistinguishable
from *"checked, and not Marco's"* — while the positive control proves the probe works (761 verdicts).
`#2131` was opened by `GH-Mantova` at `19:25:55Z` with no prompt log naming it, i.e. a second lane.
Applying `classifyPolicyFiles` by hand: two of its three files are under `docs/`, but
`scripts/pipeline/why-blocked.ps1` matches none of the three `NESTED_TEST_PATHS` forms, so the
function refuses at that path. §10.1 step 3's station-lane exception does **not** rescue it — 00's
lane is `docs/`, and this PR strays outside it, so it falls through to step 2 unchanged.
**`[NO LANE VERDICT — hand-classified: MARCO'S, on scripts/pipeline/why-blocked.ps1]`.**
**DISPOSITION: ACTIONED** — classified, recorded, and left unmerged. The merge that did not happen
is the deliverable.

**F2 — nothing in the queue is armable: 13 HOLDs, 6 ADMIT, and every one of the 6 fails a gate,
a denylist, or both.** [MEASURED]

| prompt | lint | gate | why not armable |
|---|---|---|---|
| `pr-fv2-ai-digests` | ADMIT | `requires_file_on_main: apps/api/src/modules/forms/ai-form-import.service.ts` | **ABSENT** on `origin/main` — predecessor never landed |
| `pr-fv2-output-channels` | ADMIT | `requires_file_on_main: apps/api/src/modules/forms/form-digests.service.ts` | **ABSENT** — this is what `ai-digests` would create, so it is chained behind an unmet gate |
| `pr-fv2-formrule-contract` | ADMIT | none | **NEVER-ARM** for this station by the station doc's own list |
| `pr-rates-s11c-drop-legacy-tables` | ADMIT | `requires_file_on_main: docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md` | **ABSENT**; and the slug is on `queue-sync.ps1`'s `$Forbidden` denylist verbatim — *"permanent destructive DROP of legacy rate tables. Discharge: Marco."* |
| `pr-tenant-mt4-s2-ownership-migration` | ADMIT | `requires_file_on_main: docs/approvals/tenant-mt4-s2-ownership-migration-approved-by-marco.md` | **ABSENT**; production data, Marco-armed by design |
| `pr-tipid-s3-retire-the-name-guard...` | ADMIT | **`requires_on_main:` x3** | `backfill-waste-map-location-ids.mjs` PRESENT, but `docs/audits/waste-map-location-backfill.md` **ABSENT** and `docs/data-model/rates-migration/STEP-11C-DONE.md` **ABSENT** |

⚠️ **A near-miss worth recording, because it is one grep away from arming a destructive slice.**
My first gate scan matched `requires_merged|requires_file_on_main` and reported `pr-tipid-s3` as
**ungated** — it gates on **`requires_on_main`**, a third spelling, as a YAML *list* rather than a
scalar. On that reading tipid-s3 looked like the one armable prompt on the board: ADMIT, premise
TRUE (guard present = 1, negative control 0), both predecessors merged (`#1685` S1, `#1775` S2),
design settled (`#1533`, *"D3 decided, option (d)"*). It is in fact held by two absent artefacts,
**both of which only the 11C drop can produce** — and 11C gates on an approval file that does not
exist. So tipid-s3 is transitively blocked on the same missing approval as `rates-s11c`.
🔧 **A gate scan must match all three forms — `requires_merged`, `requires_file_on_main`,
`requires_on_main` — and must follow the YAML list continuation.** DOCTRINE §9.5's *lint ADMIT is
necessary, not sufficient* is what made me re-read the file rather than trust the scan.
**DISPOSITION: ACTIONED** — verified, nothing armed, and the three-spelling rule recorded here.

**F3 — the unretryable CodeQL red on `#2135` cleared with no intervention, so the previous run's
decision to leave it was right and its named remedy was never needed.** [MEASURED] The 20:56Z
breadcrumb recorded `Analyze (actions)` red on run `35918799713`, which `gh run rerun --failed`
refused (*"This workflow run cannot be retried"*, exit 1), and named the only remaining triggers as
a new commit on `feat/devtree-reset-guard` or a `workflow_dispatch`. Neither was performed. This run
reads `Analyze (actions)` **pass** in **50 s** on run **`35920302608`** — a *different* run id — and
`CodeQL` pass. `#2135` is now 14 pass / 0 fail / 1 pending. [INFERRED] a fresh workflow run
superseded the stuck one; I did not measure what triggered it, and I am not claiming to have.
**DISPOSITION: ACTIONED** — the finding is closed, and the lesson is the one the previous run already
acted on: an unretryable flake on a PR that cannot merge this cycle anyway is worth waiting out, not
worth a synthetic commit that cancels in-flight jobs.

**F4 — four of the six ADMIT holds gate on a human-approval artefact, and the approvals channel has
produced exactly one file in its entire history.** [MEASURED] `docs/approvals/` on `origin/main`
holds **two** entries: `README.md`, and `watcher-identity-approved-by-marco.md`. Two holds name an
approval file directly (`rates-s11c`, `tenant-mt4-s2`); `tipid-s3` is blocked behind 11C and so
depends on the same one; `fv2-output-channels` is chained behind `fv2-ai-digests`. **The mechanism
works exactly as designed — a prompt cannot arm until Marco names a file — but nothing has come out
of it, so the designed-in gate is indistinguishable from an abandoned one.**

🔴 **And the release that was supposed to fix this cleared the layer that was not binding.**
`pr-tipid-s3` carries, in its own body: *"HUMAN LAYER RELEASED 2026-09-24 by Marco ('Release the
nine prompts', in chat), removed and recorded by `station-00.interactive-0004`"* — followed
immediately by its own correct caveat, *"The release clears ONE of the two layers. The three
`requires_on_main` gates below are"* still in force. So a release action was taken against nine
prompts, and this run measures **zero** additional armable prompts as a result. Whoever performed it
may reasonably believe nine prompts were unblocked.
**DISPOSITION: ESCALATED — appended to the EXISTING file, not a new one.**
`needs-marco/five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`
was filed today and is exactly this defect; what this run adds is the count from the other side
(**6 ADMIT, 0 armable, approvals dir = 2 files ever**) and the fact that the 09-24 prose release did
not move it. **The question for Marco, RULE 1 ordered:**

> **(a) complete + additive — write the two approval files you actually intend**
> (`docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md`,
> `docs/approvals/tenant-mt4-s2-ownership-migration-approved-by-marco.md`), which arms those two
> and, once 11C lands its `STEP-11C-DONE.md`, transitively releases `tipid-s3`. Solves it now and
> keeps the audit trail the gate exists to create. Both are destructive/production-data slices, so
> they stay yours to merge either way.
> **(b) additive but incomplete — approve only `tenant-mt4-s2`**, leaving the whole rates chain
> (11C -> tipid-s3) parked. Fails the *future* half of RULE 1: the same three prompts resurface.
> **(c) complete but damaging — retire the `requires_file_on_main` approval gates.** Fails the
> *without damaging* half outright: it is the only thing standing between an autonomous station and
> a permanent `DROP` of the legacy rate tables. **Not recommended, stated only for completeness.**

**F5 — six untracked files are sitting in the shared dev tree, and five of them are another actor's
review output.** [MEASURED] `Claude Design/docs/index.html` and
`docs/pr-reviews/pr-{2119,2131,2133,2134,2135}-review.md`. Tracked state is clean, so nothing is
blocked **today** — but the post-merge fast-forward cure in `00-supervisor.md` records that an
untracked file at a path a future PR lands is exactly what refuses `git merge --ff-only`, while
`--numstat` and `--cached` both read EMPTY. The `rev-*` review jobs that produced these are not my
lane and I did not author them. **DISPOSITION: DISPATCHED -> Station 03** (local trees and queue
files are its lane, and it already carries this run's clone-hygiene dispatch): decide whether
`docs/pr-reviews/*.md` should be swept into a PR or left untracked by design, and say which in your
breadcrumb so the next 00 stops re-finding them. Not urgent; it becomes urgent the moment a PR lands
one of those exact paths.

## WHAT I DID NOT DO

- **Did not merge `#2135`, `#2131` or `#2127`.** Two carry real watcher `marco:true` verdicts; the
  third hand-classifies to Marco (F1). RULE 2 binds absolutely, and §10.1 step 4 forbids recording
  "no verdict found" as "not routed to Marco".
- **Did not arm anything.** Six ADMIT prompts, zero with a met gate (F2). *Never arm a HOLD with an
  unmet gate* — and `rates-s11c` and `pr-fv2-formrule-contract` are never-arm for this station
  regardless of lint.
- **Did not edit `pr-tipid-s3` to add the missing `module:`.** The title-scope defect is real and I
  measured it in advance for this exact prompt (`tipid` REJECT, `map-locations` OK) — but the prompt
  cannot arm for a *different* reason, so editing it now would be a change I could not verify end to
  end this run. It stays on the existing F1 escalation from 20:56Z.
- **Did not clear any `needs-marco/` file.** Section 5 emitted **zero `[STALE]` rows** this run, so
  there was nothing to discharge; the eight named in the 09-23 06:09Z snapshot appear already cleared.
- **Did not touch the two orphaned worktrees** (`C:/po-wt/rel06` 88 min, `C:/po-wt/s9hex` 900 min,
  both `dirty=0`) **or the `dirty=1` watcher clone.** Station 03's lane, already dispatched in the
  20:36Z breadcrumb; re-dispatching it would be noise, not signal.
- **Did not restart the watcher.** `RUNNING pid 38776`, wrapper alive (1), heartbeat 12 min with an
  empty queue — that is idle, not wedged, and §3 forbids killing on quiet.
- **Did not touch `/sot/`, Azure, Entra or SharePoint**, wrote no production data, ran no `git`
  against the mount from the VM shell, and committed nothing to `main`.
