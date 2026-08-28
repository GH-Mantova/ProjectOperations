# Station 05 — SoT Keeper | 2026-08-26 14:11Z–14:26Z

## GROUND

```
UTC            2026-08-26T14:11:52Z
origin/main    44b5f3af   (cfc74982 at first fetch; #1340 landed mid-run, re-fetched)
dev tree       main @ 7ad50697   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/05-sot-keeper.md front matter)
bootstrap      1   (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE — full authority, not read-only.

## WHAT I MEASURED

**Reachability** — `start_process` powershell.exe returned `2026-08-26T14:11:52.4359789Z`. **NOT
blind.** [MEASURED]

**status-sweep.ps1** — both instrument positive controls LIVE (gh saw merged #1340; node runs).
1 open PR at sweep time (#1337, CI 13 pass / 0 fail). Watcher node RUNNING pid 29024, wrapper alive,
heartbeat 17 min. `index.lock` False/False, 0 git processes. Armed at depth 1: **0**. [MEASURED]
🔴 Its trunk-colour line (`main branch CI (last 3 runs): 0 success / 0 not-success (trunk green)`)
is the known coin-flip and is **NOT** quoted as a fact here — see the per-commit read below instead.

**Audit 1 — schema parse sanity.** `node scripts/data-model/build-relationship-map.mjs --check` →
`OK: generator ran cleanly against schema.prisma (292 models, 66 enums, 482 edges)`, exit 0.
[MEASURED] Per the 2026-08-25 correction this is a **parse gate, not a drift gate**; it is reported
here only as the CI-matching job, never as evidence sot/04 is current.

**Audit 2 — catalog validity.** `JSON.parse(metadata-catalog.json)` → `CATALOG_OK bytes=678752`,
exit 0. [MEASURED] The historic unterminated-string defect is **GONE**; no HIGH finding this run.

**Audit 3 — sot/04 drift (the REAL probe).** [MEASURED]
- sot/04 header: `Last updated 2026-08-25 14:16 UTC`, schema `sha256 49b774e989af`,
  `Models: 292 | Enums: 66 | FK edges: 482 | Domains: 23`.
- fresh `relationship-map.md` header: `2026-08-26 12:49 UTC`, schema `sha256 b26240cf69d9`, same counts.
- Current dev-tree `schema.prisma` LF-normalised sha256 = `b26240cf69d9` (raw/CRLF = `d77585daef9d`).
- Line-level compare of sot/04's `SOT04-GENERATED` body vs the artifact body: 3642 lines each,
  **exactly 1 line differing** — `- Table: \`tenders\` | Domain: Tendering | Fields: 70` -> `71`.

🔴 **The counts matched while the section was stale.** Model/enum/FK/domain counts are a coarse probe;
the schema sha is the fine one. A future run must not read "counts match" as "sot/04 is current".

**Audit 4 — roadmap drift.** [MEASURED] `sot/02` §2 is headed `🔧 In-PR — open right now (2)` with a
snapshot date of **2026-08-04**, listing **#894** and **#895**. `gh pr view` says both are **MERGED**.
Actual open PRs right now: **#1337** and **#1341** (this run's). Highest PR number referenced anywhere
in sot/02 is **#905**; the board is at **#1341**.

**Audit 5 — automation health.** [MEASURED]
- `Get-ScheduledTask` matching `pr-shepherd|night-qa|watcher-triage|feature-queue-watch|PO Watcher|ProjectOps`
  returns exactly **one** task: `PO Watcher Keepalive`, State **Ready**. The four tasks this station
  doc names in audit step 5 **do not exist on this box**.
- `docs/pr-prompts/processed/` freshest mtimes: `rev-1340-ready.md.log` 2026-08-26 23:56 local
  (= **13:56Z**, 15 min before this run), `pr-queue-bin-guard-orphaned-discharge-ready.md.log` 23:51
  local. **The watcher is actively processing.** Nothing is stalled.
- Armed `*-ready.md` at depth 1: **0**.

**Audit 6 — model / migration / code coherence.** [MEASURED] 292 models parsed; 228 migration dirs;
297 `CREATE TABLE` names; 38 `DROP TABLE`.
- Models with **no** backing `CREATE TABLE`: **0**.
- Migration tables with no live model and never dropped: 1, and it is the literal token `IF` — an
  artefact of my own regex against `CREATE TABLE IF NOT EXISTS`, **not a finding**.
- Positive control: `Tender` -> table `tenders`, `hasCreate=true`. ✅

**Audit 7 — module registry.** [MEASURED] `apps/api/src/modules` holds **81** directories. **31** of
them are not mentioned **anywhere** in `sot/01-charter-and-architecture.md` (§13 is the Module
Registry): `access-requests, admin-imports, admin-settings, admin-users, agreed-records, ai-settings,
api-keys, bid-prioritisation, branding, cases, client-quotes, comms-approvals, company-profile,
correspondence, estimate-export, expenses, geocoding, global-lists, handover-templates, handovers,
list-bindings, notification-preferences, pilot-feedback, public-holidays, schedule-of-rates,
subcontractor-rates, surveys, tenants, tender-clarifications, tender-clients, win-likelihood`.
Positive control: sot/01 does contain `tendering`. ✅

**RULE ZERO — local PASS vs real CI.** [MEASURED] `gh api repos/.../commits/44b5f3af/check-runs`:
`Data model — generator sanity (schema.prisma parses cleanly)` = **success**. Local `--check` = OK.
**NO ENVIRONMENT DISAGREEMENT this run.** (Four other jobs on that commit had a null conclusion —
still running for the just-merged #1340 — which is *pending*, not fail.)

**Clone state.** [MEASURED, from the sweep] watcher clone `C:\po-watcher\ProjectOperations` is on
branch `feat/orphaned-discharge-guard`, dirty=37 — not clean-on-main. Also 4 orphaned worktrees.

## WHAT CHANGED

**One mutation: PR #1341 opened.** `docs(sot-04): re-merge generated schema map after #1321
(Tender 70 -> 71 fields)`, branch `docs/sot-04-reconcile-2026-08-26`, built in a **disposable
worktree** `C:\po-worktrees\sotk-reconcile-20260826` off `origin/main@44b5f3af`.
Read-back: `gh pr view 1341` → `state=OPEN`, `files=sot/04-data-model.md` (one file), `labels=` count 0,
body first line renders the em dash correctly (no double-encoding, no BOM). Diff is **+3 / -3**.

Safeguards, each measured:
- **S1** disposable worktree, PR opened by me. Never armed, never merged. ✅
- **S2** generator run twice — `relationship-map.md` identical modulo the `Last updated` stamp
  (`md_identical_modulo_stamp=true`); `metadata-catalog.json` identical between runs. ✅
- **S3** curated tail from `<!-- SOT04-GENERATED:END -->` onward sha256 `2d36fe00ab862b49`
  **identical before and after**; exactly **2** lines changed above `BEGIN`, both generated stamps. ✅
- **S4** 5243 lines before, 5243 after; curated tail 1581 lines unchanged. **No content loss.** ✅
- **S5** `sot/04-data-model.md` **only**, staged with an explicit pathspec. ✅
- **S6** post-fix `--check` exit 0. ✅
- **S7** no prior reconcile PR or branch pending (`git ls-remote --heads origin | grep reconcile` empty). ✅

CP-24: `sot/`-only, no `scripts/` or `apps/`. Clean.

🔧 **The `metadata-catalog.json` "shrink" is a lie and I can prove it.** Pre-gen 706871 bytes on disk,
post-gen 678752 — but `git diff --numstat` is **EMPTY**. It is CRLF->LF only, **not** content loss.
It was **not staged**. Future runs: check `--numstat` before believing the byte count.

## FINDINGS

### F1 — sot/04's generated section was stale; the count probe read clean
`#1321` added a field to `Tender` (70 -> 71). sot/04 carried the pre-#1321 body and a 2026-08-25 sha.
**ACTIONED** — PR #1341, +3/-3, all seven safeguards measured and passing. **It is now MERGED to
`main@c63c5504` (14:19:04Z) — not by me;** see WHAT I DID NOT DO for the attribution and the policy
question that raises. **Read-back on `origin/main` [MEASURED]:**
`- Table: \`tenders\` | Domain: Tendering | Fields: 71` and
`- Generated from: \`apps/api/prisma/schema.prisma\` (sha256 \`b26240cf69d9\`)`. CI on the merge commit:
`Data model — generator sanity` **success**. The drift is closed on `main`, verified on `main`.

### F2 — `sot/02` §2 asserts two MERGED PRs are "open right now"
Snapshot dated 2026-08-04, lists #894 and #895; both are **MERGED**. Real open set at 14:26Z: **#1337
only** (#1341 opened and merged inside this run).
Roadmap STATUS semantics are curated and on this station's **NEVER auto-fix** list, so I did not touch
it. **DISPATCHED to Station 00** — it needs either a curated reconcile (06 stages, 05 lands the sot/
edit) or the §2 table replaced with a pointer to `bring-up-to-speed.ps1`, which the section already
admits beats it. RULE 1 note: the pointer option is the complete-and-additive one — it removes the
whole class of drift permanently and destroys no curated content; a one-off refresh fixes today only.

### F3 — audit step 5 tells every future run to check four tasks that do not exist
This station doc's audit step 5 names `pr-shepherd`, `night-qa`, `watcher-triage`,
`feature-queue-watch` and says "a disabled shepherd or dead watcher means NOTHING is merging — lead
the report with it if so." **None of the four exists on the box**; the only live task is
`PO Watcher Keepalive` (Ready). A future run that reads "absent" as "disabled" will lead its report
with a false alarm about a board that is in fact processing (freshest `processed/` log 15 min old).
**DISPATCHED to Station 00** — the fix is a one-paragraph edit to
`docs/pipeline/stations/05-sot-keeper.md` audit step 5, replacing the four dead task names with
`PO Watcher Keepalive` + the `processed/` mtime probe. Not shipped this run: CP-24 forbids nothing
here, but S5 caps my scope to `sot/` and `docs/data-model/`, and widening a verified PR to make a
second unrelated point is how a clean reconcile gets rejected.

### F4 — four sweep reports were written and never committed; three days have no sweep at all
`docs/data-model/sweeps/` holds `2026-08-18/19/20/21.md` as **untracked** (`git ls-files` returns only
`2026-08-25.md`). By this station's own report contract — *"if your finding lives only in a
gitignored/untracked path, you have not reported it"* — those four runs are unreported. And there is
**no sweep file at all for 08-22, 08-23, 08-24**.
**DISPATCHED to Station 00** — 4 untracked sweep files to sweep into a board PR, and a question worth
one line of its next run: did 05 not fire on 22–24, or did it fire blind? I cannot tell from here.

### F5 — 31 of 81 API modules are absent from sot/01's module registry
Listed under Audit 7. Curated prose, **never auto-fix**. This is a real SoT gap: §13 claims to be the
registry of "all live modules" and is missing 38% of them.
**DEFERRED** — it becomes urgent the moment anyone uses §13 to answer "what modules are live?", which
the file's own quick-navigation invites. It needs a human pass (each entry carries status and known
issues, which no generator can synthesise). Not a one-run job.

### F6 — watcher clone is not clean-on-main
`C:\po-watcher\ProjectOperations` on `feat/orphaned-discharge-guard`, dirty=37; 4 orphaned worktrees.
Not my lane and **not currently blocking** — the watcher processed `rev-1340` 15 min before this run.
**DISPATCHED to Station 03** (via 00) — clone drift and worktree pruning are 03's, report-only.

## WHAT I DID NOT DO

- **Did not merge #1341 — and it merged anyway, 3 minutes after I opened it.** [MEASURED]
  `mergedAt=2026-08-26T14:19:04Z mergedBy=GH-Mantova mergeCommit=c63c5504`. I ran **no** merge command
  of any kind; every command I issued is quoted in this file. The mechanism is almost certainly the
  watcher's `tests-docs` auto-merge policy (STATION-CAPABILITIES §5 — *"the watcher auto-merges docs
  PRs itself"*), and `rev-1341-ready.md` appeared at 14:18Z, one minute before. But **all actors merge
  as `GH-Mantova`**, so attribution is not provable from here: I record it as **unattributable, not
  mine, and not an alarm.**
  ⚠️ Consequence for Station 00: **a `sot/` governance doc reached `main` without Marco reading the
  rendered diff.** That is the intended review step for this station's output and it did not happen.
  The change is 3 lines and provably generator-derived, so the risk this time is ~nil — but the
  *policy* question is real and is 00's to put to Marco: should `sot/`-only PRs be excluded from the
  `tests-docs` auto-merge policy, or is generator-derived `sot/` drift explicitly fine to auto-land?
- **Did not arm anything.** I created no prompt and ran no `git mv`. ⚠️ **Depth-1 armed went 0 -> 1
  during this run and it is NOT an arming**: the single file is `rev-1341-ready.md`, mtime 14:18Z —
  the watcher's **auto-generated review job for my own PR #1341**. DOCTRINE §9.5: `rev-<n>-ready.md`
  are review jobs, have no front matter by design, and are excluded from prompt audits. Do not report
  this as an armed prompt.
- **Did not touch the dev tree's git index.** It carried a staged
  `R100 pr-rates-consumers-s3-persona-export-HOLD.md -> -ready.md` from a concurrent chat when I
  arrived at 14:11Z; by 14:19Z the index was **empty** — that chat committed or reset it. Neither
  event was mine: every commit I made was in the separate worktree, staged with an explicit pathspec.
  I state this as **unattributable**, not as a defect. (DOCTRINE §9.2: the dev-tree index is shared.)
- **Did not stage `metadata-catalog.json`** — its delta is CRLF-only (numstat empty).
- **Did not touch `sot/02` or `sot/01`** — both findings are curated prose, off the allowlist.
- **Did not run `build-toc.mjs --check` against `sot/`** — no sot/ file carries TOC markers; it cries
  wolf unconditionally.
- **Did not clear the two `[STALE]` cross-check rows** the sweep surfaced
  (`HANDOVER-2026-08-14-...` referencing merged #1134/#1135; `pr-subbie-rate-cards-scope-pricing-HOLD`
  referencing merged #212/#213). Not `sot/`, not my lane — 00's to disposition.

---
*Stamped 2026-08-26T14:31Z, true at `origin/main@c63c5504` (was `44b5f3af` at run start; my own
#1341 is the delta) / dev tree `7ad50697`. This breadcrumb is UNTRACKED until a board PR commits it —
Station 00, sweep it up, along with `docs/data-model/sweeps/2026-08-26.md` and the four untracked
sweep files named in F4.*
