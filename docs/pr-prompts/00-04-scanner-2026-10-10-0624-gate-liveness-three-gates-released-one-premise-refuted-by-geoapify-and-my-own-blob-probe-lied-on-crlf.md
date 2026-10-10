# Station 04 — Scanner | 2026-10-10 ~06:05Z–06:31Z

## GROUND

```
UTC            start NOT STAMPED (see F7) · end 2026-10-10T06:31Z
origin/main    d197fc8   (resolved by GitHub API from refs/heads/main; `git` not permitted this run)
dev tree       C:\ProjectOperations2 — branch/HEAD [CANNOT MEASURE] (no git, no PowerShell);
               content proven byte-identical to origin/main on 19/19 paths probed (see F1)
doc version    1  (docs/pipeline/stations/04-scanner.md front matter, read from origin/main)
bootstrap      1  (scheduled-task SKILL.md station_doc_version) — MATCH, full authority
```

Sweep this run: **gate-liveness** (rotation position 1 of 4), selected by
`node scripts/pipeline/next-sweep.mjs`. Not chosen by me.

## WHAT I MEASURED

**Reachability — PARTIAL. Not blind, but PowerShell-blind.**

- `ToolSearch` for `desktop-commander` ran first, three times. Server never attached;
  final state reported by the harness: `plugin:desktop-commander:desktop-commander
  (CONNECT_TIMEOUT): "MCP server ... connection timed out after 30000ms"`. [MEASURED]
  This is a failure AFTER load attempts, not an unloaded schema. **No Windows-host shell,
  no `start_process`, no `powershell.exe` this run.**
- The Cowork workspace shell failed three times (`request timed out after 30s`, then
  `process with name "elegant-friendly-shannon" already running`) and succeeded on the
  fourth: `echo ALIVE` → `ALIVE`. [MEASURED] Retried well past the one-retry rule because
  the failures were not identical.
- Native file tools reach the dev tree directly: `Read C:\ProjectOperations2\CLAUDE.md`
  returned content. The repo is mounted at
  `/sessions/elegant-friendly-shannon/mnt/ProjectOperations2`; `node v22.23.2`;
  `command -v pwsh powershell.exe` → **no powershell**. [MEASURED]
- **I globbed the real dev tree, so this is NOT a blind run.** GitHub-side reads below are
  used only for `origin/main` content — which is what this sweep is specified against —
  never as a substitute for the tree the watcher globs.

**Git guard — exit 2, INSTALLED BUT INERT.** [MEASURED]

```
$ bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
...
   PATH="/sessions/elegant-friendly-shannon/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

Last line and exit code quoted as the contract requires. Exit 2 is the expected station
outcome, a finding not a stop. **Consequence honoured: I ran no `git` at all this run** —
not even read-only plumbing. Every `origin/main` fact below came from the GitHub API or
from a content hash computed in node.

**Board state.** [MEASURED]

- `docs/pr-prompts/*-ready.md` at depth 1: **0**.
- `docs/pr-prompts/*-HOLD.md` at depth 1: **16**.
- Positive control against §9.6 (an empty result is not an empty world): the same glob
  mechanism counted **34** depth-1 files and listed all 16 HOLDs by name. The zero is real.
- **No board trap**: zero tracked `*-ready.md` at depth 1.
- `blocked/` holds **69** `*-ready.md`. Inert by DOCTRINE §8.5 (`fsWatch` is
  non-recursive), so not armed — reported as state, not as a defect.

**Premise harness — controls passed before any verdict was believed.** [MEASURED]
All 16 premises returned TRUE on the first pass. 16/16 in one direction is the exact shape
§9.6 warns about, so I minted a fresh needle this run (`ZZPROBE_S04_20261010_159247795`)
and ran five controls:

```
control-A expect FALSE (needle absent)        PREMISE FALSE
control-B expect TRUE  (negated absent needle) PREMISE TRUE
control-C expect FALSE (file that cannot exist) PREMISE FALSE
control-D expect TRUE  (file that must exist)   PREMISE TRUE
control-E expect FALSE (model that cannot exist) PREMISE FALSE
```

Both polarities reproduce. The 16/16 reading is honest, not a blind grep.

**Freshness proof without git.** Because I may not run `git`, I proved per-path parity by
computing the git blob SHA in node — `sha1("blob " + len + "\0" + bytes)` — and comparing
it to the blob SHA the GitHub API reports at `refs/heads/main`. See F1: the raw-bytes form
lied, the LF-normalised form matched **19 of 19** paths. Every premise reading below is
therefore a true `origin/main` reading at `d197fc8`.

**Gate readings, all against origin/main @ d197fc8.** [MEASURED]

| prompt (`-HOLD.md`, depth 1) | premise | gate | verdict |
|---|---|---|---|
| pr-sec-a2-email-codes-and-reset-links | TRUE | `requires_on_main otp-delivery.port.ts :: SEC_A3_NO_CREDENTIAL_LOGS_V1` **PRESENT** | **RELEASED** → F2 |
| pr-queue-layout-sot-entry | TRUE | `requires_on_main QUEUE-LAYOUT.md :: QUEUE_LAYOUT_V1` **PRESENT** (line 3) | **RELEASED** → F3 |
| pr-scopecards-s8b-azure-maps-travel | TRUE (machine) | `requires_on_main travel-time.ts :: TRAVEL_TIME_PORT_V1` **PRESENT** | **RELEASED, premise_means REFUTED** → F4 |
| pr-sweep-section5-dedupe-and-fast-switch | TRUE | none | **ARMABLE + work already in OPEN PR #2294** → F5 |
| pr-sweep-escapee-crosscheck-and-completion-stamp | TRUE | `requires_merged 2294` → open, `do-not-merge`, behind | HELD correctly → F5 |
| pr-fv2-ai-digests | TRUE | `requires_file_on_main forms/ai-form-import.service.ts` **ABSENT** | HELD — candidate dead gate → F6 |
| pr-fv2-output-channels | TRUE | `requires_file_on_main forms/form-digests.service.ts` **ABSENT** | HELD (chained behind fv2-ai-digests) |
| pr-tipid-s3-retire-the-name-guard-for-an-id-check | TRUE | BOTH `requires_on_main` **ABSENT** (`docs/audits/waste-map-location-backfill.md`, `docs/data-model/rates-migration/STEP-11C-DONE.md`) | HELD correctly |
| pr-524-rates-b-slice2-canonical | TRUE | approval file **ABSENT** | HELD BY DESIGN — DROPS TABLES |
| pr-rates-s11c-drop-legacy-tables | TRUE | approval file **ABSENT** | HELD BY DESIGN — DROPS TABLES |
| pr-retire-tenderclientnote-s2 | TRUE | approval file **ABSENT** | HELD BY DESIGN — DROPS TABLE |
| pr-siteid-notnull-backfill | TRUE | approval file **ABSENT** | HELD BY DESIGN — PRODUCTION DATA |
| pr-tenant-mt4-s2-ownership-migration | TRUE | approval file **ABSENT** | HELD BY DESIGN — PRODUCTION DATA |
| pr-lint-prompt-refuse-a-hold-whose-pr-is-open | TRUE | none | armable; duplicate identity → F5 |
| pr-nav-jobs-projects-merge | TRUE | none | armable, 00's call |
| pr-vendor-invoice-ocr | TRUE | none | armable, 00's call |

`docs/approvals/` on `origin/main` contains exactly `README.md` and
`watcher-identity-approved-by-marco.md`. [MEASURED] All **five** Marco-approval gates are
unsatisfied. Per the sweep brief these are **live protections working as intended**, two of
them in front of table drops and two in front of production data. **I repaired nothing.**

**Zero dead premises.** No premise returned FALSE, so no finished work is sitting armed or
held on the board on a machine reading. F4 is the one case where the machine premise is
true and the human premise is not.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced via
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-10-10T06:24:09Z`, exit 0,
  read back as `last_index=0 last_run_utc=2026-10-10T06:24:09Z last_station=04-scanner`.
  **LEFT DIRTY in the dev tree** (lf-blob now `ee60fdc0b593`, `origin/main` holds
  `78db2da229d7`). Station 04 may not commit to the shared dev tree — **Station 00 must
  commit this file with the next board PR, or the next run repeats gate-liveness.**
- This breadcrumb, written to the dev tree at `docs/pr-prompts/` and **untracked**. Station 00
  sweeps it. Cure 1 (write it inside my own run's PR) is unavailable: Station 04 may not
  create a PR.
- Nothing else. **No prompt armed, disarmed, renamed, moved or staged. No label touched. No
  PR merged. No `git` command run. No `sot/` edit.**

## FINDINGS

### F1 — S2 — My own freshness probe lied on CRLF, and it lied in the one direction that would have voided the whole sweep

The repo is checked out CRLF on Windows; `origin/main` stores LF. Hashing the raw on-disk
bytes made **every** path look divergent from `main`:

```
809b27c4d152  raw | 5b71fe520c7d  lf-normalised  CRLF  docs/pipeline/DOCTRINE.md
5516938291d2  raw | 598dd1d02b3d  lf-normalised  CRLF  apps/api/prisma/schema.prisma
625440ea6f14  raw | 97f69ccc889e  lf-normalised  CRLF  docs/pipeline/stations/04-scanner.md
```

`origin/main` holds `5b71fe52`, `598dd1d0`, `97f69ccc`. **Raw: 0 of 19 matched.
LF-normalised: 19 of 19 matched.**

I had already written down "the dev tree diverges from main on every spot-checked path" and
was about to re-evaluate all 16 premises against GitHub content. §7 caught it: an
instrument that has never once produced a match is not measuring 19 divergences, it is
broken. The station doc records the same trap for the *piped* `hash-object` form under
`powershell.exe`; this is a **second, independent CRLF instrument** with the same failure,
reached without any shell. It is not covered by the existing §9.2 bullet, which is scoped
to the piped PowerShell form.

Blast radius: any station that compares a locally-computed content hash against a GitHub
blob SHA will read a clean tree as fully stale. The cure is one line — normalise CRLF→LF
before hashing — and it belongs in §9.2 next to the existing bullet.

**DISPOSITION: ESCALATED.** It needs a `sot/`-adjacent doctrine edit (DOCTRINE §9.2) and
Station 04 may neither edit `sot/` nor open a PR. Marco or Station 05: add the bullet.
RULE 1 reading — complete-and-additive: add the normalise-first bullet to §9.2 **and** have
`gate-eval.mjs`/any future hash probe normalise internally, so the rule is mechanical and
no future station has to remember it; this damages no existing or future data entry. The
alternative, documenting it in a breadcrumb only, fails the *future* half — this breadcrumb
expires and the next station re-learns it.

### F2 — S2 — `pr-sec-a2-email-codes-and-reset-links-HOLD.md` is RELEASED and nobody has promoted it

Gate `requires_on_main apps/api/src/modules/auth/otp-delivery.port.ts ::
SEC_A3_NO_CREDENTIAL_LOGS_V1` is **satisfied on origin/main @ d197fc8** — I read the file
from `main` and the sentinel is declared at line 12:
`export const SEC_A3_NO_CREDENTIAL_LOGS_V1 = "sec-a3";`

Premise `! grep -q "EmailOtpDelivery" apps/api/src/modules/auth/otp-delivery.port.ts` is
**TRUE** on `main` — the file ships `DisabledOtpDelivery` and `LoggingOtpDelivery` only, and
its own comment says *"Real email delivery is wired in A2."*

So: predecessor landed, work still needed. Per DOCTRINE §8.4 this is a waiting state that
has ended and the prompt should be promoted to `-ready.md` and run. It carries
`escalates: true`, which per §5b gates the **merge**, not the run — the correct handling is
run it, open the PR, label `do-not-merge`. Promoting it is **not** mine: Station 04 arms
nothing.

Live impact while it sits: field-worker sign-in codes and client-portal reset links have no
production delivery channel, so neither sign-in path is usable in production.

**DISPOSITION: DISPATCHED** to Station 00 — promote `pr-sec-a2-email-codes-and-reset-links-HOLD.md`
to `-ready.md` on Marco's authority, then drive the PR and label it `do-not-merge` on open.

### F3 — S3 — `pr-queue-layout-sot-entry-HOLD.md` is RELEASED and belongs to Station 05

Gate `requires_on_main docs/pipeline/QUEUE-LAYOUT.md :: QUEUE_LAYOUT_V1` is **satisfied**:
`docs/pipeline/QUEUE-LAYOUT.md:3:<!-- QUEUE_LAYOUT_V1 -->`, and that file's LF-blob
`b26a10077771` equals `origin/main`'s.

Premise `! grep -rq "QUEUE_LAYOUT_V1" sot/` is **TRUE**: absent from `sot/`. That absence is
a true `origin/main` reading — **all 7 `sot/` files LF-match `origin/main`**, so the
recursive grep is not reading a stale tree.

Effect: the prompt-lifecycle standard is binding but invisible to a reader who treats `sot/`
as authoritative. The prompt is `station: '05'`, scope `sot/02-roadmap-and-status.md`.

**DISPOSITION: DISPATCHED** to Station 05 — this is a `sot/` edit on a doc-reconcile PR
(CP-24 hard-fails any PR mixing code and `sot/`). Station 04 must not touch `sot/`.

### F4 — S2 — `pr-scopecards-s8b-azure-maps-travel-HOLD.md`: gate released, but `origin/main` REFUTES its premise_means. Do not arm it.

Its machine premise `! grep -rq "AZURE_MAPS_TRAVEL_V1" apps/api/src` is TRUE, and its gate
is satisfied — so it reads as ready. **Its stated reason for existing is false.**

`premise_means` claims: *"Travel time is still a straight line multiplied by a factor …
**no provider exists behind the travel-time port yet**."*

On `origin/main @ d197fc8`:

- `apps/api/src/modules/tendering/providers/` contains **`geoapify-route.provider.ts`**. A
  routing provider exists. [MEASURED]
- `travel-time.ts`'s own header: *"S8g wires the Geoapify routing provider and adds honest
  trip arithmetic: Road km from Geoapify free_flow distance … Traffic index = approximated /
  free_flow … planning = average(baseline, baseline x index)."* It exports
  `planningMinutes`, `requiredTrips`, `durationDays`, `totalTripKm`. [MEASURED]

That is the capability S8b was written to add, already shipped under a different vendor. The
premise survives only because it is pinned to a **vendor-specific marker**
(`AZURE_MAPS_TRAVEL_V1`) instead of to the capability — the LL-54 failure mode, and this
one will never die on its own.

Why this is not a repair I may make: arming it would build a second travel provider
duplicating Geoapify, it touches `apps/api/prisma/schema.prisma` + `migrations/**`, and
"Azure Maps" means an Azure subscription key and tenant configuration — **the absolute hard
stop in DOCTRINE §5.1.** Whether Azure Maps is still wanted now that Geoapify ships real
road km is a product question, and §5.5 says only Marco knows his intent. I will not guess it.

**DISPOSITION: ESCALATED — Marco, one question.** Geoapify already supplies road distance and
a modelled traffic index. Do you still want the Azure Maps provider?

- **(a) Retire S8b as superseded** — move `pr-scopecards-s8b-azure-maps-travel-HOLD.md` to
  `docs/pr-prompts/superseded/` naming Geoapify/S8g as the replacement. *Complete and
  additive: removes a prompt that is permanently armable, builds no duplicate provider,
  touches no schema, needs no Azure credential, and deletes nothing — the file moves, per
  "nothing is ever deleted". Passes both halves of RULE 1. Recommended.*
- **(b) Keep it, but re-point the premise at the capability** (e.g. absence of a second
  provider behind the port) so it dies when satisfied. *Fails the immediate half: it leaves
  a duplicate-provider build queued and still walks into §5.1 Azure configuration.*
- **(c) Arm it as written.** *Fails both halves: duplicates shipped work, and the work
  cannot complete without tenant config no agent may touch.*

### F5 — S2 — `pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` is armable a second time while its own work sits in OPEN PR #2294

PR **#2294** `fix(pipeline): dedupe section 5 PR crawl and add -SkipSection5 fast switch`:
`state: open`, `merged: false`, `labels: ["do-not-merge"]`, `mergeable_state: behind`. [MEASURED]

Its own body states it implements `-SkipSection5` and that
`grep -q "SkipSection5" scripts/pipeline/status-sweep.ps1` returns 7 matches **on its
branch**. On `main` the marker is absent, so the HOLD's premise is TRUE, it has **no gate at
all**, and it would lint ADMIT — i.e. it is armable again and would rebuild #2294's work.
DOCTRINE §10.6 is the governing rule; the prompt is not marked superseded by #2294.

This is not hypothetical drift — it is a **live instance of the exact defect the sibling
prompt `pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md` exists to fix**
(`SPENT_HOLD_PR_OPEN`, confirmed absent from `lint-prompt.mjs` on `main`). The guard that
would catch this is itself queued behind nothing and unarmed.

Two compounding observations, same cluster:

- **Duplicate identity (§10.5).** The same artifact exists twice:
  `docs/pr-prompts/pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md` **and**
  `docs/pr-prompts/blocked/pr-lint-prompt-refuse-a-hold-whose-pr-is-open-ready.md`. One
  artifact, one identity, one location — this is two states at once.
- **The chain is stalled on Marco.** `pr-sweep-escapee-crosscheck-and-completion-stamp-HOLD.md`
  has `requires_merged: 2294`, correctly held. #2294 carries `do-not-merge` and its body
  predicts `OUT_OF_LANE` against `instrument-lane.json` *by design* (its `scope` names a
  path under `docs/`, and the whole of `docs/` is on the never-list). Under
  INSTRUMENT_LANE_V1 the lane never applies to a PR carrying `do-not-merge`, so **only Marco
  can release it.** Until he does, both sweep prompts stay stuck and `status-sweep.ps1`
  keeps timing out before its SAFE / CAUTION / DO-NOT-ACT verdict — which is why this run,
  and the four Station 00 runs its body cites, quote no sweep verdict.

**DISPOSITION: ESCALATED — Marco, one decision, and it unblocks three things at once.**
Release PR #2294 (remove `do-not-merge`; it is `behind`, so Station 00's `Merge-Pr` will
update the branch at merge time per UPDATE_AT_MERGE_TIME_V1).

- **Complete and additive:** merging #2294 lands `-SkipSection5`, which makes the sweep
  verdict reachable for every station; it flips `pr-sweep-section5`'s premise FALSE and
  self-retires that prompt via its own `scope`, killing the double-build hazard; and it
  satisfies `requires_merged: 2294`, releasing `pr-sweep-escapee-crosscheck`. No data is
  touched — it is one PowerShell script, one test, one prompt retirement. Passes both halves.
- **Alternative — arm `pr-lint-prompt-refuse-a-hold-whose-pr-is-open` first** (Station 00, no
  Marco needed) so `SPENT_HOLD_PR_OPEN` makes the hazard mechanical rather than remembered.
  *Fails the immediate half:* it leaves #2294 unmerged, so the sweep verdict stays
  unreachable and the escapee prompt stays blocked. Worth doing **as well**, not instead —
  and the duplicate-identity cleanup belongs in the same move.

### F6 — S3 — `pr-fv2-ai-digests-HOLD.md` points at a predecessor file that may never exist

Gate: `requires_file_on_main apps/api/src/modules/forms/ai-form-import.service.ts` —
**ABSENT** on `origin/main @ d197fc8`. The directory does ship three sibling AI services:
`ai-form-describe.service.ts`, `ai-form-fill-assist.service.ts`, `ai-rule-draft.service.ts`.
[MEASURED]

Either the FV2 AI-import slice genuinely has not landed (gate correct, prompt correctly
held), or it landed under one of those names and the gate is **dead** — permanently
unsatisfiable, silently holding `pr-fv2-ai-digests` and, behind it,
`pr-fv2-output-channels` (whose gate names `form-digests.service.ts`, the very file
`pr-fv2-ai-digests` would create). A dead gate masks the premise behind it, so this is a
two-prompt chain resting on one unverified filename.

I could not settle which, and I will not guess: distinguishing them needs the FV2 slice
history, and `docs/audits/dead-file-gates-repointed-2026-08-19.md` exists on `main`,
suggesting this class has been repointed before. Note also the sweep brief's warning — a
gate repair can silently remove a protection — and these two prompts are *not* in the
destructive class, so a repair would be legitimate once the fact is established.

**DISPOSITION: DEFERRED.** Real, not now: both prompts are correctly held either way, so
nothing is at risk today. It becomes urgent the moment Marco wants FV2 moving, or if a third
prompt chains behind `form-digests.service.ts`. What would settle it in one step: read the
FV2 cluster's slice order in `sot/06-active-specs.md` and the merged-PR history for
`apps/api/src/modules/forms/` — then either confirm the gate or repoint it at the real
predecessor via a Station 05 doc PR.

### F7 — S4 — I could not stamp my own start time, because the probe that would have stamped it was the one that failed

The GROUND block requires a start UTC. My first two shell calls — both of which led with
`date -u` — timed out before confirming they had run, and the third failed on a wedged
process name. By the time the shell answered, the run was already minutes old. So the
honest value is "not stamped", and I have reported it that way rather than back-dating an
estimate into a field whose whole purpose is to be checkable.

Cheap fix, if anyone wants it: have the bootstrap stamp UTC from a source that does not
depend on the shell under test (the GROUND block's own first line, written before STEP 1),
so a flaky shell cannot take the timestamp down with it.

**DISPOSITION: DEFERRED.** Cosmetic this run — every other line carries its own evidence —
but it makes a run harder to place on a timeline, and it will recur on every flaky-shell run.

## WHAT I DID NOT DO

- **Ran no `git`, at all.** The guard reported INERT (exit 2), and an inert guard is never a
  licence to run `git` against the mount. So `dev tree branch @ SHA` is
  `[CANNOT MEASURE]` — I substituted a node-computed blob-SHA parity proof (F1) and said so,
  rather than letting the reader assume I looked.
- **Ran no PowerShell probe.** Desktop Commander never attached. `status-sweep.ps1`,
  `triage-holds.ps1`, `check-all-drift.ps1`, `check-sot-encoding.ps1` and
  `restart-watcher-if-wedged.ps1` are all `[CANNOT MEASURE]` this run. **I quote no sweep
  verdict, and no watcher liveness reading** — "I cannot verify it" is not "it is down"
  (§3). F5 is the standing cause: the verdict is unreachable until #2294 lands.
- **Did not run `lint-prompt.mjs` or `check-backlog.mjs`.** `gate-eval.mjs:50` executes each
  prompt's `premise` through `execSync` against `cwd`; a premise containing `git` would have
  run `git` against the Windows `.git` with no guard in front of it. I inspected all 16
  premises first — all are `grep`/`test`/`sed`, none invoke `git` — and ran them directly in
  a shell I control instead. The verdicts above are premise readings, **not** a lint verdict;
  ADMIT is necessary, not sufficient, and I claim neither.
- **Did not use GitHub code search for any gate verdict.** It is lying in this repo:
  `QUEUE_LAYOUT_V1` is in `docs/pipeline/DOCTRINE.md` on `main` — I read it there — and in
  `docs/pipeline/QUEUE-LAYOUT.md:3`, yet `search_code` with `repo:` scope returned five
  `archive/` breadcrumbs and **omitted both files**. Every gate fact above came from
  `get_file_contents` at `refs/heads/main` or from a directory listing. Not filed as a
  finding: it is a GitHub-side index, not a pipeline instrument, and one run is not enough to
  characterise it — but no station should trust it for a liveness verdict.
- **Repaired no gate.** All five Marco-approval gates are unsatisfied and I left every one
  alone: two guard table drops, two guard production data. The sweep brief is explicit that
  repairing them would silently remove the protection.
- **Armed, disarmed, renamed, moved and staged nothing**, and staged no `-HOLD` prompt. The
  three released gates (F2, F3) need a promotion decision that is Station 00's on Marco's
  authority, and F4 needs Marco's intent before anything is armed. I am read-only on the board.
- **Did not commit the rotation advance or this breadcrumb.** Station 04 may not commit to
  the shared dev tree and the dev tree is on `main`. Both are named under WHAT CHANGED for
  Station 00 to sweep.
- **Did not touch `sot/`** (Station 05's), and did not run the live-site or Dependabot passes
  — this run's rotation slot is gate-liveness, and one sweep covered completely beats four
  covered shallowly.
