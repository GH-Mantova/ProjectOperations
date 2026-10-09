# Station 05 — SoT Keeper | 2026-10-09T14:22:54Z–2026-10-09T14:33Z

## GROUND

```
UTC            2026-10-09T14:22:54Z
origin/main    8ae32ead  (fetch+rev-parse at 14:23:12Z) -> d086529c (re-fetched 14:27Z, #2286 merged mid-run)
dev tree       main @ 8ae32ead  C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/05-sot-keeper.md front matter, read from origin/main)
bootstrap      1   (station_doc_version declared in the scheduled-task SKILL.md)
```

Version check: doc version 1 == bootstrap 1. **No mismatch — this run had full authority.**

Reads: `docs/pipeline/stations/05-sot-keeper.md`, `docs/pipeline/DOCTRINE.md` (core),
`docs/pipeline/STATION-CAPABILITIES.md`, all three via
`git show origin/main:<path>` in the **dev tree** `C:\ProjectOperations2` (not the watcher clone).
No REFERENCE section was opened: no §9 trap was acted on.

⚠️ **`origin/main` moved during this run.** 8ae32ead at the ground stamp, d086529c at 14:27Z
(#2286, `docs(board): collect …`). Every audit below was measured in a disposable worktree
detached at **d086529c**, which is the SHA every finding is true at.

## WHAT I MEASURED

**Reachability — SIGHTED, not blind.**
[MEASURED] One keyword `ToolSearch` for `desktop-commander` returned the toolkit; `start_process`
with shell `powershell.exe` succeeded on the first call (PID 26356, `git rev-parse --short HEAD`
-> `8ae32ead`). No `CONNECT_TIMEOUT`, so the retry rule did not fire. This was a sighted run.

**Device-bridge git guard — EXIT 2, INSTALLED BUT INERT.**
[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit code read
from the installer itself (no pipeline appended). Last line, verbatim:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/brave-blissful-johnson/.local/bin:$PATH" git <args>
```

Headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
**EXIT CODE 2.** Its own controls, as printed: `bash -lc 'command -v git'` ->
`/sessions/brave-blissful-johnson/.local/bin/git` (shim); `bash -c 'command -v git'` ->
`/usr/bin/git` (real git). This is the outcome the station contract records as **EXPECTED for a
station, a FINDING and not a STOP**. No `git` was run against any mount in this run; every `git`
call went through Desktop Commander to a Windows shell.

**Safe-to-act gate — `status-sweep.ps1`, 14:23:54Z.**
[MEASURED] Section 0 positive controls both passed (`gh` saw merged #2285; `node` runs), so the
report is trustworthy. Section 3: `git index.lock` interactive/clone **False/False**; git processes
touching our trees **0**; watcher build **none in flight** (newest heartbeat tick 53.6 min old —
idle with an empty queue, **not** wedged); **board lease held by `station-00.scheduled`**
(`reason=board collect 1414`, expires 2026-10-09T14:49:21Z). No PR touched on GitHub in the last
2 min. `C:\ProjectOperations2\.git\index.lock` **ABSENT** (direct `Test-Path`, independent of the
sweep). **I mutated nothing on the board and took no lease** — all work happened in a disposable
worktree.

**Missed-occurrence check.**
[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness --station 05` ->
`05  last 2026-10-08T22:38:00Z  15.8h ago  (cadence 24h + grace 3h)  ok`, `CLEAN`, exit 0.
Read as the station doc requires — the **AGE**, not the verdict: 15.8 h is under one cadence, so
**no day is owed and no catch-up work was done.**
[MEASURED] The 05 breadcrumb corpus (`docs/pr-prompts/**/00-05-*`, newest 12) is stamped
`…-1423-`/`…-1411-` dead on the cron through **2026-09-24**, then jumps to **2026-10-08-2238**.
The 2026-10-08 **on-cron** slot (≈14:2xZ) has **no breadcrumb**; the 22:38Z run is the recovery
run, and it did that day's substantive work (PR **#2265**, `docs(sot): re-merge sot/04 generated
section (297->299 models, 498->501 FK edges)`, MERGED 2026-10-08T23:28:57Z).
[CANNOT MEASURE] whether an occurrence fired at 2026-10-08T14:2xZ and died — the MCP exposes only
the latest `lastRunAt`, which now reads this run (`2026-10-09T14:22:42.168Z`). The 09-24 → 10-08
gap is already the subject of the open escalation
`needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`; I am not
re-opening it.

**Live schedule — read from the scheduled-tasks MCP, not from any document.**
[MEASURED] **Four** enabled tasks: `00-supervisor` `5 * * * *` (lastRun 14:13:56Z),
`04-scanner` `0 */4 * * *` (14:09:36Z), `05-sot-keeper` `10 0 * * *` (14:22:42Z — this run),
`03-machine-minder` `0 9 * * *` (2026-10-08T23:06:07Z, next 2026-10-09T23:02:45Z).
`weekly-security-audit` **`enabled: false`**, lastRun 2026-09-06T21:32:44Z — STATION-CAPABILITIES
§1's 2026-09-15 correction is **still current**. 00/04/05 fired within **13 minutes** of each
other again, which is the by-construction overlap §6 records; nothing new to add.

**AUDIT 1 — schema parse sanity.** [MEASURED] `node scripts/data-model/build-relationship-map.mjs
--check` -> `OK: generator ran cleanly against schema.prisma (299 models, 70 enums, 501 edges).`
exit **0**. Per the step's own 2026-08-25 correction this is **not** a drift gate and is not read
as one.

**AUDIT 1 / RULE ZERO cross-check.** [MEASURED] The matching CI job on the `main` head d086529c —
`Data model — generator sanity (schema.prisma parses cleanly)` — conclusion **success**
(`gh run view 37944272573 --json jobs`). Local PASS, CI PASS. **No ENVIRONMENT DISAGREEMENT.**
Same run: `Pipeline — watcher + linter tests` **success** (this is the job that executes
`check-sot-refs.mjs`, confirmed at `.github/workflows/ci.yml:310`), `Pipeline — arm-prompt tests
(Windows)` success, `Web` success, `raw-error-envelope gate` success; `PR gates — diff checks` and
`Approval receipt (CP-26)` **skipped** (push event, not a PR — expected). Open PRs at 14:27Z: **0**,
so there was no per-PR CI to cross-check.

**AUDIT 2 — catalog validity.** [MEASURED] `node -e "JSON.parse(...)"` on
`docs/data-model/metadata-catalog.json` -> `CATALOG_OK bytes=735739 topkeys=4`, exit **0**. Valid
JSON. (Not judged by byte count — DOCTRINE §9.3 and the station doc's 2026-09-21 CRLF correction.)

**AUDIT 3 — sot/04 drift, BOTH probes.** Worktree `C:\po-wt\st05-1424` detached at d086529c;
generator run there so the dev tree was never touched.
- Header counts: sot/04 `- Models: 299 | Enums: 70 | FK edges: 501 | Domains: 23`; freshly
  generated `relationship-map.md` the **identical** four numbers.
- The probe that actually answers (2026-09-14 correction) — **CONTENT** comparison of the generated
  section: sliced sot/04 between `<!-- SOT04-GENERATED:BEGIN -->` (idx 1108) and
  `<!-- SOT04-GENERATED:END -->` (idx 174073), sliced `relationship-map.md` from
  `## Table of Contents` (idx 437), normalised `\r\n`->`\n`, stripped the volatile
  `Last updated` stamp, compared the STRINGS (not their lengths):
  `SOT_GEN_CHARS 169180  MAP_GEN_CHARS 169180  **IDENTICAL true**`.
  Controls: POSITIVE — the slice compared against itself returns identical; NEGATIVE — appending a
  freshly minted needle (`NEEDLE-ST05-1424-9f3a`) makes them differ. **sot/04's generated section
  is current. No re-merge needed** — PR #2265 did it last night and it still holds at d086529c.

**AUDIT 4 — roadmap drift.** [MEASURED] `sot/02-roadmap-and-status.md:61` reads
`## 2. In-PR - open right now (0)`; live `gh pr list --state open` -> **0 PRs**. **In sync.**
Queue on disk: `*-ready.md` -> **`rev-2286-ready.md` only**, which DOCTRINE §9.5 records as an
auto-generated **review job**, not a prompt — it is not roadmap drift and it is not mine. 14
`*-HOLD.md` present, none claimed as Staged-but-merged by sot/02 §3.

**AUDIT 5 — automation health.** [MEASURED] watcher node **RUNNING pid 8848** (resolved by the
sweep's command-line filter, never by image name); auto-restart wrapper **alive (1)**; heartbeat
53.6 min (idle, empty queue). `docs/pr-prompts/processed/` newest mtimes: `rev-2286-ready.md.log`
**2026-10-09T14:29Z** (one minute old at reading) and `rev-2286-ready.md` 14:25Z — the watcher is
actively consuming. **Nothing is stalled; this does not lead the report.** Worktree census is
Station 03's lane: 34 non-main worktrees, one LIVE (`C:/po-wt/collect-1414`, Station 00, age 6 min
— **not** to be pruned), 2 registry-escapees. Reported, not touched.

**AUDIT 6 — model ↔ migration coherence.** [MEASURED] 299 `model` blocks in
`apps/api/prisma/schema.prisma`, resolved through `@@map()` to table names; 270 `migration.sql`
files, 669,356 bytes concatenated. **MODELS_WITHOUT_MIGRATION_REF = 0.** Controls: POSITIVE —
`HealthcheckSeedMarker` -> `healthcheck_seed_markers` found in the SQL; NEGATIVE — minted needle
`ZzNeedleSt05_1424_7b1e` absent. Clean.

**AUDIT 7 — module registry.** My first probe was BROKEN and I am saying so rather than reporting
its number. [MEASURED] It compared the 82 **directory slugs** under `apps/api/src/modules/`
against sot/01 and returned 25 "missing" — **with its own positive control reading ABSENT**
(`POSCTRL_SOT01_HAS_A_KNOWN_MODULE false`, because the slug I sampled was itself in the miss list).
DOCTRINE §7 guard 1: that is a broken instrument, not a finding. Recalibrated (52 slugs match
verbatim, 66 under a loose matcher, POSITIVE control `# 01 — Charter & Architecture` found,
NEGATIVE needle absent) it reads 16 — **and sot/01 §13's own declaration block already records
that a slug-keyed probe measures the wrong question**, that an earlier run reported THIRTY-SIX on
exactly this instrument, and *"Ten is the controlled reading; thirty-six is not. Do not re-open
it."* **So I did not re-derive the gap.** See F2 for what I did measure instead.

## WHAT CHANGED

**Nothing.** No `sot/` file was edited, no baseline entry deleted, no PR opened, no prompt armed,
no PR merged, no label touched, no board mutation, no lease taken. The only writes this run made
anywhere were: scratch `.ps1`/`.mjs` probes under `C:\po-sup-fix-scripts\`, a disposable worktree
`C:\po-wt\st05-1424` (detached at d086529c, generated artifacts inside it are gitignored), and
**this breadcrumb**.

**No reconcile PR was staged, and that is the correct outcome:** audit 3's content comparison says
sot/04 is already current, and S7 one-and-done is satisfied either way — the prior run's branch
`docs/sot-reconcile-2026-10-09` is **PR #2265, MERGED 2026-10-08T23:28:57Z**
(`gh pr list --head docs/sot-reconcile-2026-10-09 --state all`), so nothing was pending.

⚠️ **This breadcrumb is UNTRACKED in the dev tree at `C:\ProjectOperations2\docs\pr-prompts\`.**
It needs Station 00's next collect to commit it. Its filename matches no watcher glob, so it arms
nothing. I did not open a PR for it: 05's only sanctioned PR is a doc-reconcile PR, and there is
nothing to reconcile.

## FINDINGS

### F1 — `ci.yml` tells every reader the sot-refs baseline holds 23 entries. It holds **zero**. The baseline's own `_readme` forbids exactly this sentence.

[MEASURED] at d086529c: `docs/qa/sot-refs-baseline.json` -> **`"entries": []`**, `entries.length`
**0**. `node scripts/pipeline/check-sot-refs.mjs` -> `total=275 dangling=0 exempt=20 baselined=0
excluded=2`, exit **0**, closing line *"All sot/ references resolve. This is the boring, correct
outcome."* CI agrees: the job carrying that step was **success** on the `main` head.

[MEASURED] `.github/workflows/ci.yml:307`, verbatim:
`# Blocking since PR sot-refs-s1: the 23 pre-existing dangling references are` /
`# recorded in docs/qa/sot-refs-baseline.json.`

[MEASURED] The baseline file's own `_readme` says: *"DO NOT write a count of remaining entries into
this prose: entries.length is the count. Every sentence that has stated one here was stale within
days."* This is the **fourth** place the same count has rotted — the station doc records **26 ->
14** (fixed 2026-08-31) and `CLAUDE.md`'s `SOT reference baseline:` anchor carrying the same stale
number (fixed in #1408). Controls on the sweep that found it: POSITIVE — the same regex over
`sot/`, `CLAUDE.md` and `docs/pipeline/**` returned the two *correctly dated* historical
corrections at `05-sot-keeper.md:301` and `:329`; NEGATIVE — minted needle over
`.github/workflows/*.yml` returned 0 hits.

**Why it is worth a line and not a shrug.** The sentence is not merely stale, it is stale in the
direction that makes a reader think there is still debt to burn down — and "burn the baseline down"
is Station 05's *primary* daily obligation. A future 05 run that reads `ci.yml` and then finds
`entries: []` has a documented reason to suspect its own instrument rather than believe a true
negative, which is DOCTRINE §7 in reverse. RULE 1, complete-and-additive first: **delete the count
from the comment** and point at `entries.length` (solves it now and permanently, touches no
behaviour, no data). Alternative — write `0` in the comment — fails the *future* half: it rots again
the moment the number moves, which is the failure this very sentence is an instance of.

**Not mine to fix.** `.github/workflows/ci.yml` is outside Station 05's allowlist (which is the
generator artifacts plus the sot/04 generated section), and the brief is explicit that anything
outside it is reported, not attempted. It is also neither `sot/` nor `docs/`, so it cannot ride a
doc-reconcile PR under CP-24.

**DISPATCHED** — to **Station 00**: a one-line comment-only edit to `.github/workflows/ci.yml:307`,
removing the literal `23` and deferring to `entries.length`. No code path changes; no gate moves.

### F2 — sot/01 §13's "ten missing capabilities" declaration is **still accurate** at d086529c, and has now been open 19 days with no owner on a cadence.

[MEASURED] Section 13 sliced from `sot/01-charter-and-architecture.md` (line 731, 34,062 bytes),
with the declaration blockquote itself **excluded** from the corpus so the ten names it lists could
not self-match. All ten are still ABSENT from the registry body: **CRM, Expenses, Procurement,
Inventory, Surveys, Handover(s), Geocoding, Map location(s), Branding, Public holiday(s)** —
`TEN_NOW_PRESENT 0  STILL_ABSENT 10`. Controls: POSITIVE — the five names the declaration asserts
are present (`Tendering`, `Contracts`, `Quote`, `Rates admin`, `Projects`) all read PRESENT;
NEGATIVE — minted needle absent.

So the block is doing its job: it saved this run from re-deriving the gap, and its figure of ten has
**not** rotted in 19 days. Nothing in it needs correcting.

What has changed is only its age. Marco ruled on 2026-09-21 that the ten descriptions are to be
written by a **development chat**, properly — *not* machine-derived from route and controller names
by Station 05 — and the block says *"Delete this block in the same PR that adds the ten entries."*
The evidence that chat needs (per-module `@Controller` prefixes and route counts) is already
measured in `docs/pr-prompts/00-05-sot-keeper-2026-09-21-0045-…md` under **HANDOVER**. **No station
has a cadence that produces a development chat**, so the remedy has no owner, and §17 of sot/01
meanwhile requires §13 to reflect `main`.

**DEFERRED** — real, not now, and deliberately not fixable by me: filling it is the option Marco
declined. What would make it urgent: a new business-distinct module landing on `main` (making the
figure eleven and the declaration itself stale), or §13 being cited as authoritative in a merge or
design decision. Station 00 may wish to count this as evidence that the development-chat channel
needs a trigger.

### F3 — the device-bridge git ban is remembered, not mechanical, in this shell (guard exit 2).

[MEASURED] quoted in full under WHAT I MEASURED: exit **2**, `INSTALLED BUT INERT`, shim correct and
off `PATH` because a station's shell is non-interactive and non-login. This is the outcome the
contract names as expected, and DOCTRINE §9.2 records the remembered form as having failed seven
times. I kept it: zero `git` calls against any mount this run.

**DEFERRED** — the contract explicitly forbids widening the stop contract over this, and making the
shim reachable means changing how a station's shell is spawned, which is not in any station's lane.
What would make it urgent: a fresh 0-byte `index.lock` with no owning Windows process, i.e. the ban
actually being broken by someone.

### F4 — the 2026-10-08 on-cron 05 slot produced no breadcrumb; an off-cron 22:38Z run covered the day.

[MEASURED] 05 breadcrumbs run `…-1423-` / `…-1411-` dead on the cron through 2026-09-24, then jump
to `00-05-sot-keeper-2026-10-08-2238-…`; there is no breadcrumb at the 2026-10-08 ≈14:2xZ slot.
That day's substantive work was not lost — PR #2265 re-merged sot/04 and merged at 23:28:57Z — and
today's on-cron occurrence fired normally (`lastRunAt 2026-10-09T14:22:42.168Z`, jitter 757 s), so
the cron is working now. [CANNOT MEASURE] whether the 10-08 on-cron occurrence fired and died: the
MCP exposes only the latest `lastRunAt`.

**DEFERRED** — the 09-24 → 10-08 outage is already open with Marco as
`needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`, and
re-surfacing a filed item is a cost, not a contribution. Recorded here only so the single missing
on-cron slot is attributable rather than looking like a second, separate silence. What would make it
urgent: a second consecutive on-cron 05 slot with no breadcrumb.

## WHAT I DID NOT DO

- **No `sot/` edit, no reconcile PR.** Audit 3's content comparison says sot/04 is current; there
  was no deterministic drift inside the allowlist to fix. Safeguards S2–S6 were not exercised
  because no fix run was started; S7 was checked and clear (#2265 merged).
- **Did not re-derive the §13 module-registry gap**, and did not report my own slug-keyed number.
  sot/01 §13 records that instrument as broken and names the controlled reading; re-opening it is
  the error the block exists to prevent.
- **Did not fix `ci.yml:307` myself** (F1) — outside the allowlist, and `.github/` cannot ride a
  doc-reconcile PR under CP-24.
- **Did not touch the 34 worktrees, the 2 registry-escapees, or the orphaned branches holding
  unpushed commits.** Station 03's lane, report-only for me. One of them is Station 00 working live
  (`C:/po-wt/collect-1414`, 6 min old).
- **Did not arm, disarm, merge, label, or take the board lease.** Station 00 held an active lease
  (expiring 14:49:21Z) for the whole of this run. `rev-2286-ready.md` is a watcher-generated review
  job and was left alone.
- **Did not run `build-toc.mjs --check` against `sot/`** — no `sot/` file carries TOC markers, so it
  reports drift unconditionally.
- **Did not run `git` through the device bridge against any mounted `.git`**, and did not run
  `check-breadcrumb.mjs` from the mount (it shells `git` and `gh`); both ran in a Windows shell.
- **Did not touch Azure, Entra, SharePoint, or any production data.** Absolute hard stop, nothing
  this run came near it.
- **Did not write `breadcrumb-clean`** until the validator had actually been run — see the
  verification line appended by this run's final step.

---

**Breadcrumb verification (run last, in the dev tree, Windows shell).**
[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs` ->
`ADMIT 00-05-sot-keeper-2026-10-09-1422-sot-refs-baseline-is-empty-and-ci-still-tells-the-reader-it-holds-23.md`,
`structure: 4 checked, 0 malformed`, `CLEAN`, exit **0**. So **breadcrumb-clean** is earned by the
validator named in the contract, not asserted. The same run printed
`NOTE … is UNTRACKED — it reaches nobody until a board PR commits it`, which is the
Station 00 handoff recorded under WHAT CHANGED. `lint-prompt.mjs` was deliberately **not** run:
DOCTRINE records that it gates `docs/pr-prompts/` as *prompts* and returns no meaningful verdict on
a breadcrumb in either direction.

**Disposable worktree disposed.** `C:\po-wt\st05-1424` was removed at the end of the run so it does
not join the 34-worktree pile Station 03 already has to triage. It held no commits and nothing but
regenerated, measured-identical artifacts.
