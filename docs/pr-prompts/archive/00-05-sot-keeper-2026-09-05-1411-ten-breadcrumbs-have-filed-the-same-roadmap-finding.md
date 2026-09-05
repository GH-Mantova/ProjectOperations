# Station 05 — SoT Keeper | 2026-09-05T14:11Z–2026-09-05T14:5xZ

## GROUND

```
UTC            2026-09-05T14:11:17Z
origin/main    2ba3a2b4            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 2ba3a2b4     C:\ProjectOperations2
doc version    1                   (station_doc_version, docs/pipeline/stations/05-sot-keeper.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — this run is read-write within its lane.

`[MEASURED]` **Sighted run.** `start_process` shell `powershell.exe` succeeded, PID 35572.

`[MEASURED]` **The three binding documents were read from `origin/main`'s content, not a stale
working copy** — verified by the sound form (DOCTRINE §9.2, never a piped hash):
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/05-sot-keeper.md` → **EMPTY output**, in the dev tree
`C:\ProjectOperations2`, at `HEAD == origin/main == 2ba3a2b4`. All three read in full.

`[MEASURED]` **No missed occurrence.** `node scripts/pipeline/check-breadcrumb.mjs --freshness
--station 05` → `05 last 2026-09-04T14:11:00Z 24.0h ago (cadence 24h) ok`, exit 0. The AGE is
exactly one cadence, not more, so nothing is owed. (Read as the station doc instructs: the AGE,
not the `ok`, which would not alarm until 48 h — escalation #23.)

## WHAT I MEASURED

### Preflight sweep — the verdict was DO NOT ACT and it was a self-measurement artefact

`[MEASURED]` `scripts/pipeline/status-sweep.ps1`, captured to a FILE (42,015 bytes,
`C:\po-sup-fix-scripts\05-sweep-2026-09-05T1411Z.txt`) because it returns early and hides its own
§7 verdict. Section 7 read:

```
[LIVE] DO NOT ACT: a board mutation is in progress (section 3 -- in-progress prompt / git lock / git process)
```

Section 3's three inputs were `in-progress prompts: 0` · `index.lock interactive/clone: False / False`
· **`git processes running: 2`**. Only the third can have fired it.

`[MEASURED]` Re-measured ~90 s later, per §7's `[LIVE]` rule (*"true when measured, not true now"*):
`Get-CimInstance Win32_Process -Filter "Name='git.exe'"` → **0 processes**; `Test-Path` on
`.git\index.lock` in both the dev tree and the watcher clone → **False / False**.

`[MEASURED]` **Re-ran `status-sweep.ps1` ITSELF immediately before the push** — the whole named
probe, never a hand-rolled subset of it — at **14:24:49Z**: `in-progress prompts: 0` ·
`index.lock False / False` · **`git processes running: 0`** · verdict **`CAUTION: 3 LIVE STATION
WORKTREE(s)`**, the first of which is **my own** (`C:/po-worktrees/sot05-20260905`); the other two,
`C:/po-wt/board-1408` and `C:/po-wt/lintfix-1408`, belong to the #1667/#1668 lane. CAUTION's own
instruction is *"if you must act, use an ISOLATED worktree and touch only NEW branches/PRs"* —
which is exactly this run: a disposable worktree, a new branch, a new PR, no existing PR or branch
touched. **The `DO NOT ACT` was transient and my first explanation for it was wrong — see FINDING 3,
which carries its own refutation.**

### Automation health — nothing to lead with

`[MEASURED]` Watcher resolved **by command line, never by image name** (§9.5):
`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` filtered on `pr-watcher[\\/]index\.mjs`
→ **pid 20000**, started 2026-09-04 19:37:14 (Brisbane). Auto-restart wrapper alive.
`Get-ScheduledTask` across all visible tasks → the only one matching this project is
**`PO Watcher Keepalive`, state=Ready, LastTaskResult=0**. (The four fixtures older revisions of
this brief named — `pr-shepherd`, `night-qa`, `watcher-triage`, `feature-queue-watch` — remain
absent; the 2026-08-27 correction still holds.)

`[MEASURED]` Newest under `docs/pr-prompts/processed/`: `rev-1665-ready.md.log` at
**2026-09-05T12:27Z**, inside the last two hours; 3,994 files. The board is moving. Nothing here
leads the report.

`[MEASURED]` Sweep §2 also reported, and I am passing on rather than acting on (Station 03's lane):
watcher clone `branch=main dirty=4`, and one orphaned worktree `C:/po-vg` @ `23c91ba9`
`[fix/no-rebase-while-checks-run]`, **dirty=1, age 1819 min** — `--force` would discard that file.

### Rule Zero — local PASS cross-checked against real CI conclusions

`[MEASURED]` Local: `node scripts/data-model/build-relationship-map.mjs --check` →
`OK: generator ran cleanly against schema.prisma (293 models, 68 enums, 488 edges)`, exit 0.

`[MEASURED]` CI, per-commit with the **full 40-char SHA** (§9.4 — a short SHA answers `[]`):
`gh api repos/GH-Mantova/ProjectOperations/commits/2ba3a2b4570c794e477e9951bca9cedd9cc28347/check-runs`
→ 14 check-runs, of which `Data model — generator sanity (schema.prisma parses cleanly)` = **success**;
0 failures on main.

`[MEASURED]` Same job on every open PR: **#1662 SUCCESS · #1665 SUCCESS · #1667 SUCCESS ·
#1668 SKIPPED** (docs-only). No `FAILURE` rows on any open PR.

**No ENVIRONMENT DISAGREEMENT this run.** Local and CI agree in every direction I checked.

### Audit 1 — schema parse sanity

`[MEASURED]` PASS, above. Recording again what the 2026-08-25 correction established, because it is
the thing most likely to be misread: **`--check` is not a drift gate.** It returns before writing
anything, and `relationship-map.{md,json}` are gitignored. A clean `--check` says nothing about
whether sot/04's generated section is current. Audit 3 is the only real drift probe — and this run
it found drift while `--check` was green, which is that correction demonstrated rather than restated.

### Audit 2 — catalog validity

`[MEASURED]` `node -e "JSON.parse(readFileSync('docs/data-model/metadata-catalog.json','utf8'))"` →
parses, 712,634 bytes on the CRLF dev tree, 4 top-level keys, exit 0. **Valid.**

### Audit 3 — sot/04 drift: FOUND, and fixed (see WHAT CHANGED)

`[MEASURED]` `apps/api/prisma/schema.prisma` last changed on `origin/main` at **`b7daed3e`,
2026-09-05T01:10:29Z**, `382 insertions / 354 deletions` — PR #1624,
`feat(tendering): a scope item can store its own labour rows and its own markup
(SCOPE_ITEM_LABOUR_STORE_V1)`. sot/04's header stamp read **`Last updated: 2026-09-01 14:15 UTC`**.
One schema commit landed inside that gap.

`[MEASURED]` The header **counts** were *not* the tell — they matched exactly
(`293 | 68 | 488 | 23`, fresh and committed). The tells were the **schema sha** and the body:

| | committed sot/04 | freshly generated |
|---|---|---|
| `Generated from … sha256` | `2882e34a59f6` | **`c54776fc0cc6`** |
| `ScopeOfWorksItem` fields | `79` | **`81`** |
| suggested measures | …`measurementQty, quantity`… | …`measurementQty, **markupOverride**, quantity`… |

Measured in a **disposable worktree off `origin/main`** (`C:\po-worktrees\sot05-20260905`, branch
`sot/reconcile-2026-09-05`, clean at checkout, `dirty=0`), by diffing sot/04's
`SOT04-GENERATED:BEGIN`/`:END` body line-set against the freshly generated
`docs/data-model/relationship-map.md`: **2 lines only in sot/04, 8 only in the fresh map** — of
which 6 are the artifact's own title/front-matter that the merge deliberately drops, leaving
**exactly 2 real differences**.

### Audit 4 — roadmap drift: FOUND, unchanged, and now eleven runs old (see FINDING 1)

### Audit 5 — automation health: covered above, nothing dead

### Audit 6 — model ↔ migration ↔ code coherence: CLEAN, after five false positives were killed

`[MEASURED]` 293 `model` blocks in `schema.prisma`, **0 with no `@@map`**. 236 migration
directories, 588,230 chars of SQL, 298 distinct `CREATE TABLE` names.
**Models with no `CREATE TABLE` anywhere in migrations: 0.**

`[MEASURED]` My first pass printed **5 "migration tables with no live model"**. All five were
instrument error, and I am recording that rather than the finding, because filing them would have
been five confident wrong claims (§7):

- `user_ai_providers`, `user_ai_preferences`, `subcontractor_contacts`, `leads` — each has a
  matching **`DROP TABLE`** in a later migration (1 hit each; **negative control**
  `DROP TABLE … zzzNoSuchTable` → **0**). They are retired tables, correctly retired. My probe only
  looked at `CREATE`, so it was structurally incapable of seeing the other half.
- `IF` — my own regex artefact on `CREATE TABLE IF NOT EXISTS scope_cards (`.

**Real orphans: 0.**

### Audit 7 — module registry: 32 of 81 API modules are not named in sot/01 (see FINDING 2)

`[MEASURED]` `apps/api/src/modules` holds **81** directories; **32** appear nowhere in
`sot/01-charter-and-architecture.md`: `access-requests, admin-imports, admin-settings, admin-users,
agreed-records, ai-settings, api-keys, authorization, bid-prioritisation, branding, cases,
client-quotes, comms-approvals, company-profile, correspondence, estimate-export, expenses,
geocoding, global-lists, handover-templates, handovers, list-bindings, notification-preferences,
pilot-feedback, public-holidays, schedule-of-rates, subcontractor-rates, surveys, tenants,
tender-clarifications, tender-clients, win-likelihood`.

### Not a finding — sot/02 is NOT corrupted

`[MEASURED]` My console rendered `§` and the state-legend emoji in sot/02 as `?` and `�`. That
is §7's lie #2 — the mojibake is in the reader, not the file. Verified with **node**, which decodes
UTF-8 correctly: `U+FFFD = 0`, double-encoding signature `U+00E2 U+20AC` = **0**, 19,594 chars.
**The file is clean.** Recording it because the last agent to trust `Get-Content` here nearly
"repaired" clean files into corruption.

### Not a finding — `docs/qa/sot-refs-baseline.json` measured in a CLEAN worktree

`[MEASURED]` Per the file's own TRAP 1, the count was taken off `origin/main` in the disposable
worktree, not on the dev box: `node scripts/pipeline/check-sot-refs.mjs` →
`total=272 dangling=0 exempt=19 baselined=2 excluded=2`, exit 0, **before** my change.

## WHAT CHANGED

Two dated units of work, both landing in **one** doc-reconcile PR off `origin/main`, both inside
`sot/` + `docs/` so CP-24 cannot fire (`pr-gates.mjs`: `sot/` + `docs/` is allowed; `sot/` mixed
with `scripts/`/`apps/` is the hard block).

### 1. sot/04 generated section re-merged — the allowlisted deterministic fix

Safeguards, all satisfied, all quoted:

- **S2 determinism** — generator run **twice**; the two `relationship-map.md` outputs are
  `3679/3679` lines and **identical=true** with the `Last updated` stamp filtered out.
- **S3 section-scoped** — sha256 of everything from `<!-- SOT04-GENERATED:END -->` onward (the
  curated MERGED SOURCES region): **`d5f505615d88a806…` before and after, identical.** The script
  aborts on mismatch; it did not abort.
- **S4 no content loss** — curated region **1581 lines before, 1581 after**.
- **S5 scope cap** — only `sot/` and `docs/` touched. **No PR prompt staged** (see WHAT I DID NOT DO).
- **S6 post-fix validation** — `build-relationship-map.mjs --check` re-run after the edit:
  `OK: generator ran cleanly against schema.prisma (293 models, 68 enums, 488 edges)`, exit 0.
- **S7 one-and-done** — no reconcile PR from a prior run is open. The 4 open PRs at 14:2xZ are
  #1662, #1665, #1667, #1668; none is a `sot/` reconcile.

**Byte-delta assertion (DOCTRINE §9.3).** The edit was built by **concatenation**, and the three
header substitutions used **function replacers** (`s.replace(RE, () => NEW)`), never a replacement
string — the trap that injected 7,734 bytes into the project-memory index on 2026-09-04.

```
bytes before/after = 289051/289067   delta = +16
```

**+16 is exactly `", markupOverride"` and nothing else** — every other edit is an equal-length
substitution (`79`→`81`, `2882e34a59f6`→`c54776fc0cc6`, `2026-09-01 14:15`→`2026-09-05 14:16`).
A read-back that only looks for what I wrote cannot see what I spilled; this one can.
Read-back: `identical=true`. `git diff --numstat` → **`4 4`**, no line-ending churn.

`[MEASURED]` `docs/data-model/metadata-catalog.json` **did not shrink** — the regen left it
content-identical: `git diff --numstat` on it is **EMPTY** (the visible ` M` is the LF→CRLF smudge,
and its byte difference, 712,634 vs 684,291, is exactly the line count, DOCTRINE §9.3). It is
therefore **not in the commit**. The brief's standing warning that a regen shrinks it did not fire
this run — recording that so the next run does not assume it must have.

### 2. sot-refs burn-down — one entry, 2 → 1

`docs/qa/sot-refs-baseline.json` entry `sot/06-active-specs.md:3943 →
modules/tendering/tender-client-notes.controller.ts` is retired, **with an inline
`sot-ref-allow` marker rather than a bare deletion**, and the prose corrected.

Why the marker and not a repoint: the target does not exist to repoint to.
`[MEASURED]` `eae1c0a8` — *"refactor(tendering): retire TenderClientNote code surface (slice 1 of 2)"*,
**#1165, 2026-08-18** — shows **`0 88`** on that controller, i.e. it was deleted outright.
`git grep "clients/:clientId/notes" origin/main -- apps/api/src apps/web/src` → **exit 1, zero hits**;
**positive control** `git grep -c "quote-proposals" origin/main -- apps/api/src` → **3 files**. The
instrument answers in both directions.

So this was never merely a dangling link: **sot/06's permission matrix was asserting three live
endpoints that have not existed for 18 days.** The heading now reads `🔴 RETIRED, routes no longer
exist`, carries the marker with that evidence, and a sentence under it states the rows are kept as
the historical permission record and that the `TenderClientNote` **model** is still in
`schema.prisma` because slice 2 of 2 has not landed. Nothing was deleted.

```
sot/06-active-specs.md      numstat 3 1   bytes 283085 -> 283844, delta +759 == asserted expected delta
docs/qa/sot-refs-baseline.json  numstat 1 2   entries 2 -> 1
```

**Verification, both gates:**

```
node scripts/pipeline/check-sot-refs.mjs
  total=272  dangling=0  exempt=20  baselined=1  excluded=2      exit 0
  (was: exempt=19  baselined=2)

node scripts/pipeline/check-sot-baseline-ratchet.mjs <base> <head>
  sot-refs ratchet: OK - 2 -> 1 baselined entries, no new (sot_file, missing_path) pair.
  Self-test: 4 cases passed.                                      exit 0
```

**No re-keying was required** (step 5 of the burn-down workflow). The sot/04 edit is `4 4` — zero
net lines — and the sot/06 insertion is at line 3944, **below** the only surviving baseline entry
(`sot/06-active-specs.md:2240`). I checked rather than assumed, because `check-sot-refs.mjs` matches
`line` exactly while the ratchet ignores it, and nothing warns you when they disagree.

## FINDINGS

### FINDING 1 — `sot/02` §2 has been false for 32 days and TEN Station 05 breadcrumbs have said so. The report-only rule is what keeps it alive.

`[MEASURED]` `sot/02-roadmap-and-status.md:61` is headed **`In-PR - open right now (2)`** and lists
**#894** and **#895**. `gh pr view`: **#894 MERGED 2026-08-04T04:41:46Z**, **#895 MERGED
2026-08-04T05:09:13Z** — both merged the same day, **32 days ago**. The live open set at 14:2xZ is
**#1662, #1665, #1667, #1668**. Not one number in that section is current.

`[MEASURED]` **This has been filed ten times.** `Select-String -Pattern '#894'` across
`docs/pr-prompts/archive/00-05-*.md` returns **10 distinct breadcrumbs** — 2026-08-24, 08-25, 08-26,
08-27, 08-29, 08-30, 08-31, 09-01, 09-03, 09-04. **Negative control** `zzzNoSuchNeedleZzz` over the
same corpus → **0**. Every one of the ten dispositioned it correctly: roadmap STATUS semantics are on
this station's explicit **NEVER auto-fix** list, so each run reported and stopped. Mine would be the
eleventh identical report.

**The finding is no longer the drift. The finding is the loop.** DOCTRINE §5.6 says two honest
attempts and then say so plainly rather than looping; this is ten. The report-only rule is doing
exactly what it was written to do — keeping an agent out of Marco's curated roadmap prose — and the
side effect is that the one station that can see the drift is forbidden to fix it, while the
stations that could fix it do not run the probe. Nothing in the chain closes, so the cost is paid
again every 24 hours, in perpetuity.

**RULE 1 options, complete-and-additive first.**

**(a) — COMPLETE and ADDITIVE. Recommended.** Narrow the never-auto-fix rule by *fact class*, not by
file: Station 05 may move a §2 entry whose PR is provably `MERGED` or `CLOSED` (by `gh pr view`,
quoted in the PR) down into a dated "recently merged" list, carrying its annotation verbatim —
**append-only, nothing deleted, no PR record lost**. Everything forward-looking (what belongs in
§2, what is next, what a status *means*) stays report-only and stays Marco's. Passes both halves:
the drift stops recurring because the mechanical half is now maintained, and no curated byte is
damaged because entries move rather than vanish. Costs one edit to
`docs/pipeline/stations/05-sot-keeper.md`, which is the layer an agent may change.

**(b)** Let 05 overwrite §2 with the live open-PR set each run. **Fails the second half** — it would
discard curated annotations like *"#895 do-not-merge; escalates (prod-data backfill) - Marco reviews"*,
which no machine list can regenerate. Not recommended.

**(c)** Leave the rule as it is and accept a permanently false §2. **Fails the first half**, and the
ten breadcrumbs are the evidence: this is what (c) already looks like after 12 days.

**DISPOSITION: ESCALATED.** Marco: which of (a)/(b)/(c)? I have not touched sot/02 — under the rule
as written today I may not, and I am not going to narrow a safety rule about your own roadmap on my
own authority.

### FINDING 2 — 32 of 81 API modules are absent from sot/01's module registry

`[MEASURED]` See Audit 7 for the list and the counts. The registry step is **report-only** by this
station's brief, and the gap is a judgement call about which modules are architecturally
registry-worthy versus incidental — not deterministic drift.

`[INFERRED]` The list is dominated by admin/settings surfaces (`admin-*`, `ai-settings`, `api-keys`,
`branding`, `tenants`) and by tendering sub-modules (`tender-clarifications`, `tender-clients`,
`bid-prioritisation`, `win-likelihood`), which reads like registry granularity never having been
decided rather than 32 separate omissions.

**DISPOSITION: DEFERRED.** Real, not urgent, and not mine to decide. It becomes urgent the moment
sot/01's registry is used to *gate* anything — a permission map, a nav generator, an ownership
matrix — because at that point a 40% blind spot stops being documentation debt and starts routing
decisions. Nothing does that today.

### FINDING 3 — a `DO NOT ACT` verdict was TRANSIENT, and my first explanation for it was wrong

Filed with its own refutation attached, because the refutation is the useful part.

`[MEASURED]` 14:11Z sweep, §3: `in-progress prompts: 0` · `index.lock interactive/clone: False / False`
· **`git processes running: 2`** → §7 **`DO NOT ACT`**. Only the third input can have fired it.

`[MEASURED]` ~90 s later, direct probe: `Get-CimInstance Win32_Process -Filter "Name='git.exe'"` →
**0**; both `index.lock` paths → **False**.

`[INFERRED, then REFUTED]` My first reading was *"the sweep counts its own git children"* — economical,
and it would have made the gate a permanent wolf-crier worth dispatching to 03. **The falsifying
probe was to re-run the same script, and I ran it: the 14:24:49Z pre-push sweep reports
`git processes running: 0` and returns `CAUTION`, not `DO NOT ACT`.** A self-counting sweep would
have said `2` both times. **So the self-count theory is dead, and I am not filing it.**

`[INFERRED]` What is left is the boring, correct answer: **two real git processes existed at 14:11Z
and were gone by 14:13Z.** The same sweep reported 5 headless claude-code sessions and a live
watcher, any of which shells git. The verdict was *true when printed* and false two minutes later —
which is not a defect in `status-sweep.ps1` at all, it is exactly the `[LIVE]` rule the station doc
already carries (*"a sweep reported `watcher RUNNING pid 42112` and the whole chain was gone 161
seconds later"*).

**DISPOSITION: ACTIONED.** Verified by re-running the named probe itself rather than a hand-rolled
subset of it, twice, with the second run refuting the first diagnosis. Nothing to hand to 03. The
value of recording it is the near-miss: I was one write away from dispatching a station to fix an
instrument that was working, which is §7's exact failure shape, and the only thing that caught it
was that the pre-mutation re-run is mandatory anyway.

### FINDING 4 — `C:/po-vg` holds one uncommitted file and `--force` would discard it

`[MEASURED]` Sweep §2: orphaned worktree `C:/po-vg` @ `23c91ba9` `[fix/no-rebase-while-checks-run]`,
**dirty=1, age 1819 min**. `git worktree remove` will refuse; `--force` would destroy the file.
Also `[MEASURED]`: watcher clone `branch=main dirty=4`, not clean-on-main.

**DISPOSITION: DISPATCHED → Station 03.** Both are machine state in 03's lane. Neither is mine to
clean, and the destructive option is a §5.4 hard stop regardless of lane. Recording it because it
has now been visible across multiple runs and `--force` is the obvious wrong move.

### FINDING 5 — no sweep report was written on 2026-09-03 or 2026-09-04

`[MEASURED]` `docs/data-model/sweeps/` (tracked — `git check-ignore` exit 1, same as the positive
control `CLAUDE.md`) holds `2026-09-01.md` as its newest file. The 09-03 and 09-04 Station 05 runs
both filed breadcrumbs but left no sweep report.

`[INFERRED]` The breadcrumb contract (canonical `station-contract v2`) and this brief's older
`=== OUTPUT ===` section prescribe **two** different artifacts for the same run, and where they
disagree the contract wins — so the two runs that skipped the sweep file were following the newer
rule. This is documentation drift inside my own station doc, not a missed run.

**DISPOSITION: DEFERRED.** I wrote today's sweep report anyway rather than resolve the conflict
mid-run. The clean fix is one edit to `docs/pipeline/stations/05-sot-keeper.md` making the
breadcrumb the single required artifact and the sweep file explicitly optional; it belongs in the
same PR as FINDING 1(a) if Marco takes that option, and I did not want to bundle an unasked doc
change into a reconcile PR.

## WHAT I DID NOT DO

- **I did not touch `sot/02`.** FINDING 1 is real and 32 days old and I still may not fix it —
  roadmap STATUS semantics are on the NEVER-auto-fix list. Escalated instead of quietly narrowing
  the rule on myself.
- **I did not burn down the second baseline entry**
  (`sot/06-active-specs.md:2240 → apps/api/src/modules/estimate-export/pdf/quote-pdf.builder.ts`).
  The workflow is one entry at a time, and this one is not mechanical: the sot/06 prose around it
  makes a **live technical claim** — *"5A.2 HTML→PDF migration: **not shipped**. Q5 status: OPEN"* —
  while `[MEASURED]` the last commit touching that builder is `4360f149 [5A.2] Quote PDF — HTML
  template + migration (#221)`, and `apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts`
  exists on `origin/main` today. Deciding whether 5A.2 shipped is a spec judgement, not a repoint.
  **Next run: start here, and bring it as a question, not an edit.**
- **I staged no prompt and armed nothing.** S1's old instruction to stage
  `docs/pr-prompts/pr-sot-reconcile-{date}-ready.md` is retired and dangerous — `.gitignore:75`
  ignores `*-ready.md`, and a loose `*-ready.md` **is** an armed prompt the watcher will run
  (DOCTRINE §5b). Station 05 never arms.
- **I merged nothing and removed no label.** This PR is opened, not merged. Two open PRs (#1667,
  #1668) are `BLOCKED`; that is not my lane to unblock.
- **I did not clear the watcher clone, prune `C:/po-vg`, or clear any lock.** 03's lane, and one of
  them is destructive.
- **I did not run `git checkout .` / `reset --hard` / `stash pop` / `git clean` anywhere**, and did
  not run `git` through any VM-side transport against the Windows `.git`.
- **I did not commit `docs/data-model/metadata-catalog.json`.** Its only difference is a line-ending
  smudge (`--numstat` EMPTY); committing it would have put a 684 KB whitespace-only churn into a
  reconcile PR.
