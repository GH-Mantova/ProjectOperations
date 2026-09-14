# Station 05 — SoT Keeper | 2026-09-14T14:11Z–2026-09-14T14:35Z

## GROUND

```
UTC            2026-09-14T14:11:39Z
origin/main    ed3e5e42              (fetched, then rev-parse)
dev tree       main @ ed3e5e42       C:\ProjectOperations2   (HEAD == origin/main)
doc version    1                     (docs/pipeline/stations/05-sot-keeper.md front matter)
bootstrap      1                     (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE, so this run was not read-only.

SIGHTED run. Desktop Commander loaded via `ToolSearch` and `start_process` shell `powershell.exe`
returned PID 33540 on the first call. All three binding documents were read from
`C:\ProjectOperations2` and PROVED current against `origin/main` by
`git diff --numstat origin/main -- <path>` returning EMPTY for all three (DOCTRINE §9.3's sound
form; no piped hash was taken, per §9.1).

CATCH-UP: this station owed **three** daily occurrences. `check-breadcrumb.mjs --freshness
--station 05` read `last 2026-09-10T14:11:00Z  96.0h ago (cadence 24h)  SILENT`, so 2026-09-11,
2026-09-12 and 2026-09-13 are missing. The cause is NOT this station — see finding 3 — and Station
00 has already collected it (PR #1931, "05 fired at its first slot after the 69-hour hole"). Today's
work and the burn-down owed for the missed days are both in WHAT CHANGED below, as separate units.

## WHAT I MEASURED

**Preflight sweep.** `powershell -NoProfile -File .\scripts\pipeline\status-sweep.ps1` captured to a
file and decoded `utf16le` in node (the `*>` UTF-16LE trap, DOCTRINE §9.3). Section 0 controls both
`[LIVE]`; section 7 verdict `[LIVE] SAFE TO ACT`. Re-read immediately before the only mutation this
run makes, which is a PR opened from a disposable worktree, never a board mutation. [MEASURED]

**The device-bridge git guard could NOT be installed.** `bash "$HOME/mnt/.../vm-git-guard.sh"` was
unreachable: the Linux workspace refused to start with
`failed to mount ... uploads is under Plan9 share "c" which is not mounted ... A Windows update
released September 8 prevents Claude's workspace from reaching your files.` — quoted verbatim, last
line of the attempt. Per the PREFLIGHT contract a failed install is a FINDING, not a STOP, and it is
**not** a licence to run `git` against a mount. No VM-side call of any kind was made this run; every
`git` invocation ran on the Windows host through Desktop Commander. [MEASURED]

**Audit step 1 — schema parse sanity.** `node scripts/data-model/build-relationship-map.mjs --check`
→ `OK: generator ran cleanly against schema.prisma (296 models, 69 enums, 493 edges)`, exit 0.
Per this station's own correction, that is a PARSE check and not a drift gate. [MEASURED]

**Audit step 2 — catalog validity.** `node -e "JSON.parse(readFileSync('docs/data-model/metadata-catalog.json'))"`
→ `CATALOG-JSON-VALID`, exit 0. Valid. [MEASURED]

**Audit step 3 — sot/04 drift.** The prescribed header-count comparison PASSED: sot/04 read
`Models: 296 | Enums: 69 | FK edges: 493 | Domains: 23` and a freshly generated
`relationship-map.md` read the same four numbers. **A content comparison of the generated section
then FAILED** — see finding 1. The two probes disagreed, and only the second one was right.
[MEASURED]

**Safeguard S2 — determinism.** Generator run twice; `relationship-map.md` byte-identical modulo the
`- Last updated:` line (`MD_DETERMINISTIC=true lenA=167042 lenB=167042`), `.json` byte-identical
modulo `generatedAt` (`JSON_DETERMINISTIC=true`). [MEASURED]

**The regeneration DID touch tracked `metadata-catalog.json`, and it was a line-ending smudge, not a
shrink.** `git status --porcelain -- docs/data-model` went from EMPTY to ` M metadata-catalog.json`,
while `git diff --numstat` over the same path returned EMPTY — DOCTRINE §9.2's rule that EMPTY
numstat is the real answer. The generator writes LF; the tree is CRLF. Restored from `HEAD` with
node and re-normalised to CRLF; `git status --porcelain -- docs/data-model` now returns EMPTY. The
dev tree was left exactly as found. [MEASURED]

**Audit step 4 — roadmap.** sot/02 cites 116 distinct PR numbers and **none** of them is one of the
three PRs open right now (#1931, #1923, #1920). Its `## 2. In-PR — open right now (5)` heading
describes a board that no longer exists. See finding 5. [MEASURED]

**Audit step 5 — automation health.** Watcher LIVE by command line, not by image name:
`Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where CommandLine -match 'pr-watcher[\\/]index\.mjs'`
→ **PID 30976**, CreationDate `14/09/2026 7:55:05 AM` local Brisbane = `2026-09-13T21:55:05Z`, one
match out of **24** live `node.exe`. Sweep concurs: `auto-restart wrapper: alive (1)`, `heartbeat
age: 50 min`, and the board is quiet so an idle heartbeat is idle, not wedged. Newest
`docs/pr-prompts/processed/` mtime `2026-09-14T13:23:17Z` (`rev-1930-ready.md.log`), 4522 files.
The live task list was read from the scheduled-tasks MCP and NOT from `Scheduled\` folders:
`00` `5 * * * *` lastRun `14:08:26Z` · `04` `0 */4 * * *` lastRun `14:10:05Z` · `05` `10 0 * * *`
lastRun `14:11:11Z` · **`03` `0 9 * * *` lastRun `2026-09-10T23:01:10Z`** · `weekly-security-audit`
`30 7 * * 1` **disabled**. [MEASURED]

**Audit step 6 — model / migration / code coherence.** 296 models; models with no backing migration
table: **0**. Tables created by a migration with no live model and never dropped: **0**. Clean.
[MEASURED]

**Audit step 7 — module registry.** `apps/api/src/modules` holds **81** directories; **28** are not
named anywhere in `sot/01-charter-and-architecture.md`. See finding 6. [MEASURED]

**RULE ZERO — local PASS cross-checked against real CI conclusions.** `gh run list -R <owner>/<repo>
--commit ed3e5e42...` (full 40-char SHA, `-R` present, exit code tested — DOCTRINE §9.4) →
`CI` · `Deploy` · `CodeQL` · `Tendering Browser Smoke` **all `success`**; `Claude Code /
issue_comment` `skipped`. Per open PR, the job named `Data model — generator sanity (schema.prisma
parses cleanly)`: **#1923 SUCCESS** · **#1920 SUCCESS** · **#1931 SKIPPED** (docs-only diff, path
filter). **No ENVIRONMENT DISAGREEMENT this run**: everything that passed locally also passed in CI,
and nothing passed locally while failing in CI. #1920 carries 2 unrelated failures and is not this
station's lane. [MEASURED]

**The sot-refs burn-down is FINISHED.** `node scripts/pipeline/check-sot-refs.mjs` →
`total=275  dangling=0  exempt=20  baselined=0  excluded=2`, exit 0, and
`docs/qa/sot-refs-baseline.json` `entries.length` = **0**. This station's stated primary housekeeping
obligation has nothing left to burn down; the ratchet now only has to stop new entries appearing.
⚠️ That is STATE — re-measure it, never quote it. [MEASURED]

**Safeguard S7 — no reconcile already pending.** `gh pr list --state open` returns three PRs, none
touching `sot/`; `git ls-remote --heads origin | Select-String 'sot'` returns **0** rows. [MEASURED]

## WHAT CHANGED

**Unit 1 — today (2026-09-14): the sot/04 generated section was re-merged.** In a disposable
worktree `C:\po-wt\sot04-20260914` off `origin/main` at `ed3e5e42`, branch
`docs/sot04-regen-remerge-2026-09-14`. Nothing was committed in the dev tree and nothing was merged.

Safeguards, each read back:

- **S1** — disposable worktree off `origin/main`; no commit on `main`; no prompt staged; never armed,
  never merged.
- **S2** — determinism proved above.
- **S3** — section-scoped. sha256 of the curated region from `<!-- SOT04-GENERATED:END -->` to EOF:
  `dad62580c6866207` **before**, `dad62580c6866207` **after**, `dad62580c6866207` on read-back from
  disk. `MERGED SOURCES` still present.
- **S4** — curated line count `1599` before, `1599` after. No loss.
- **S5** — scope cap held: `git status --porcelain` in the worktree lists `sot/04-data-model.md` and
  `docs/pipeline/stations/05-sot-keeper.md` and nothing else. The generated artifacts under
  `docs/data-model/` are gitignored and are not in the diff; tracked `metadata-catalog.json` is
  byte-unchanged.
- **S6** — post-fix `--check` re-run inside the worktree → `OK ... (296 models, 69 enums, 493 edges)`,
  exit 0; `check-sot-refs.mjs` inside the worktree → `dangling=0 baselined=0`, exit 0.
- **S7** — no reconcile pending, proved above.
- **Byte delta asserted** (DOCTRINE §9.3, and the edit was built by CONCATENATION — no replacement
  string, so no `$` substitution): `actual=142  predicted=142  MATCH=true`; file `290965` → `291108`
  bytes. `git diff --numstat` on the committed result: **6 insertions / 5 deletions**, one file.

**Unit 2 — the three owed days (2026-09-11 / 12 / 13).** The burn-down those runs would have done is
**empty by construction**: `sot-refs-baseline.json` already held zero entries, so there was no queue
to work through and nothing was lost by the missed occurrences except the audit itself. The audit is
what unit 1 ran, and it found the drift those three runs would have found. The correct catch-up here
is therefore one re-merge, not three, and this paragraph exists so a later reader can tell that the
catch-up was considered rather than skipped.

**Unit 3 — this station's own doc was corrected.** `docs/pipeline/stations/05-sot-keeper.md` gains
one paragraph under audit step 3 recording that the header-count probe is blind to field-level drift,
and naming the content comparison that is not. `lint-station.mjs` → `ADMIT: all 8 docs clean`, exit
0; both canonical-block markers intact and unedited. Shipped in the same PR because `sot/` + `docs/`
is exactly what CP-24 permits, and because an instruction that stays uncorrected bills the next run
to rediscover this.

## FINDINGS

**F1 — sot/04's generated section was stale by three schema fields, and every prescribed probe said
it was current.** [MEASURED] at `ed3e5e42`. sot/04's generated body recorded
`AssetMaintenancePlan ... Fields: 14` where the schema now has **19**, `BrandColorScheme ... Fields:
7` where the schema now has **20**, and omitted a `Suggested dimensions:` line for the latter. The
recorded generator stamp was `sha256 83ad3df361bd` against the live `a5ba7c95a076` — five days and at
least two field-adding migrations behind. The four header counts were IDENTICAL on both sides
because no model, enum, FK edge or domain changed, and `--check` exited 0 because the schema parses.
**DISPOSITION: ACTIONED.** Re-merged in this PR, section-scoped, with S2–S7 read back above and a
committed diff of 6 insertions / 5 deletions.

**F2 — the probe this station is told to use cannot detect the class of drift it exists to detect.**
This is F1's cause, not a restatement of it: audit step 3, and step 1's correction calling it "the
only real drift probe", both describe a comparison of four counts that move only on model-level
changes. Field-level regen drift is invisible to it, to `--check`, and to CI's `Data model —
generator sanity` job, all three of which were green while sot/04 was wrong. Nothing was empty and
nothing warned, so DOCTRINE §9.6 never fires — every instrument correctly answered a question about
counts and none was asked about content. **DISPOSITION: ACTIONED.** The station doc now carries the
content-comparison probe, with the CRLF/LF length trap and the line-offset trap stated (a naive
index diff reported 1072 differing lines where `git diff` reported 11), and a falsifying probe.

**F3 — Station 03 is the only station that did NOT come back from the scheduler hole, and it is 87
hours dark.** [MEASURED] from the scheduled-tasks MCP at `2026-09-14T14:1xZ`: `03-machine-minder`
is `enabled: true`, cron `0 9 * * *` (daily), `lastRunAt 2026-09-10T23:01:10Z`, `nextRunAt
2026-09-14T23:00:45Z` — three missed occurrences. In the same read, `00` (`14:08:26Z`), `04`
(`14:10:05Z`) and `05` (`14:11:11Z`) have all fired today, so whatever cost this station its three
days has released for three stations and not for the fourth. This matters beyond bookkeeping: 03 is
the ONLY station permitted to fast-forward the watcher clone or clear a stale lock, so a dark 03 is a
machine with no minder, and it cannot report its own absence. **DISPOSITION: DISPATCHED → Station
00.** 00 already holds the 69-hour-hole finding (#1931); what is new and belongs on top of it is that
03 alone has not recovered and needs its next occurrence watched rather than assumed. I did not touch
the schedule: the scheduled-tasks layer is not in this repo and is Marco's.

**F4 — the device-bridge git guard could not be installed, for the fifth-plus consecutive station
run, and the cause is outside the repo.** The Linux workspace will not mount: `source path ... is
under Plan9 share "c" which is not mounted`, attributed by the tool itself to a Windows update of
2026-09-08. The PREFLIGHT contract's instruction to run `vm-git-guard.sh` therefore cannot be
honoured by any station until that is fixed. The practical risk the guard exists to remove is
**zero this run** — a transport that cannot mount also cannot leave an `index.lock` — but the
instruction now fails on every run and a failure that is expected stops being read.
**DISPOSITION: DISPATCHED → Station 00**, pointing at the OPEN escalation already on file,
`docs/pr-prompts/needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`. Deliberately
NOT re-escalated as new: it is the same defect, four days older, with one more affected station.

**F5 — sot/02's In-PR and Staged sections describe a board that has not existed for weeks.**
[MEASURED]: the heading reads `## 2. In-PR — open right now (5)`; the board holds three PRs and
sot/02 cites **none** of them among its 116 PR references. Its Staged subsections (3a/3b/3c) are
dated 2026-07-15. This is curated roadmap prose and STATUS semantics, which this station's own
allowlist says is NEVER auto-edited — deciding what "In-PR" should now say requires knowing which
staged work is still wanted. **DISPOSITION: DEFERRED.** What makes it urgent: anyone answering
"what's next on the pipeline?" from sot/02, which is the question its own section 1 tells them to
answer from it. The fix is a curated pass, and the right shape is one reconcile PR that replaces
section 2 with a pointer to the live board rather than a snapshot of it — a list of open PRs written
into a document is a state claim that cannot stay true.

**F6 — sot/01's module registry omits 28 of 81 API modules.** [MEASURED]: `access-requests,
admin-imports, admin-settings, admin-users, agreed-records, ai-settings, api-keys,
bid-prioritisation, branding, client-quotes, comms-approvals, company-profile, correspondence,
estimate-export, geocoding, global-lists, handover-templates, handovers, list-bindings,
notification-preferences, pilot-feedback, public-holidays, subcontractor-rates, surveys, tenants,
tender-clarifications, tender-clients, win-likelihood`. Audit step 7 is explicitly report-only, and
placing a module in the registry is an ownership judgement, not a rename. ⚠️ The count is STATE —
re-measure it. **DISPOSITION: DEFERRED.** What makes it urgent: the registry is what tells a reader
which module owns a surface, so an absent module is a surface with no recorded owner. Worth one
reconcile PR of its own, after F5, and worth doing with Marco naming the owners rather than a station
inferring them from directory names.

## WHAT I DID NOT DO

- **Did not arm and did not merge.** This station may do neither, and the board carried nothing for
  it to want: `armed (*-ready.md): 0`.
- **Did not touch `scripts/` or `apps/`.** CP-24 hard-blocks a PR mixing `sot/` with either, so the
  PR was split before it was opened, not after CI said so. There was nothing to split: the only
  changes are `sot/` and `docs/`.
- **Did not auto-fix anything requiring judgement** — F5 and F6 are both curated prose and are
  reported, not edited. Nor `schema.prisma`, migrations, seeds, application code, the permission
  registry, or the catalog's business meaning.
- **Did not delete or add a `sot-refs-baseline.json` entry.** There are none to delete and adding one
  is forbidden.
- **Did not run any `git` command against a mount, and made no VM-side call at all** — the workspace
  would not start, and the correct response to that is to say so, not to route around it.
- **Did not clear, prune or investigate the three orphaned worktrees the sweep reports**
  (`C:/po-fix1891`, `C:/PR-Master/worktrees/po-vg` which holds 1 uncommitted file, and
  `C:/PR-Master/worktrees/pr1823`). That is Station 03's lane, and one of them holds work that
  `--force` would discard.
- **Did not act on the two `dirty=2` files in the watcher clone.** DOCTRINE §9.5 records that flag as
  untracked-inclusive and the files as review verdicts the `rev-<N>` job writes there by design;
  re-routing it as clone hygiene is the mis-routed dispatch that bullet exists to stop.
- **Did not change any cron.** F3's remedy lives in the scheduled-tasks layer, which is not in this
  repo and is Marco's.
- **Azure / Entra / SharePoint: not touched, not read-modify-write, not once.**

---

This breadcrumb ships INSIDE its own run's PR, so it needs nobody to sweep it up. Station 00
collects; my job ends here.
