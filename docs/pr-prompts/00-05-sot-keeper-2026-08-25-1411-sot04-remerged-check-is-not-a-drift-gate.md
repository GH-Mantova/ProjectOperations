# Station 05 — SoT Keeper | 2026-08-25 14:11Z–14:27Z

## GROUND

```
UTC            2026-08-25T14:11:15Z
origin/main    b968e4f1            (fetched with +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ b968e4f1     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/05-sot-keeper.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE — this run was READ-WRITE within station authority. **NOT BLIND**: Desktop Commander
reached the box on the first call (`powershell.exe`, PS process spawned, `gh 2.90.0` present).

## WHAT I MEASURED

**Preflight / sweep** — `scripts\pipeline\status-sweep.ps1`, exit 0, generated 14:11:53Z.
- `[MEASURED]` Verdict **SAFE TO ACT**; instrument positive controls both passed (gh saw merged
  #1318; node runs).
- `[MEASURED]` No `index.lock` in the dev tree; no `MERGE_HEAD`/`REBASE_HEAD`/`CHERRY_PICK_HEAD`/
  `rebase-merge`/`rebase-apply`/`sequencer`; **zero git processes**. Nothing to escalate under §7.
- `[MEASURED]` Dev-tree index carries ANOTHER CHAT's staged rename:
  `R100 pr-arm-lock-s1-serialize-arming-HOLD.md -> ...-ready.md`. I never committed from the dev
  tree; all writes happened in a disposable worktree (§9.2 shared-index trap avoided by
  construction, not by a pathspec).
- `[MEASURED]` Watcher LIVE pid 29024, wrapper alive; `processed/` newest entry
  `rev-1323-ready.md.log` @ **12:33:31Z** — throughput ~1.6 h old, consistent with the 100-min
  heartbeat age. **Idle, not wedged.** Automation health: nothing disabled, nothing dead.

**Rule Zero — CI conclusion, read PER-COMMIT (not `gh run list --branch`)**
- `[MEASURED]` `gh api repos/GH-Mantova/ProjectOperations/commits/b968e4f1/check-runs` → **12 checks,
  12 completed, 0 failure** (11 success, 1 skipped: `PR gates — diff checks`, correctly skipped on a
  push build). The data-model job is `Data model — generator sanity (schema.prisma parses cleanly)`
  :: **success**.
- `[MEASURED]` Local `--check` also OK/exit 0. Local PASS + CI PASS ⇒ **no ENVIRONMENT
  DISAGREEMENT** this run.

**Audit 1 — the instrument itself (§7 negative control)** — see FINDING 2.

**Audit 2 — catalog validity** `[MEASURED]` `JSON.parse(metadata-catalog.json)` → `CATALOG_VALID
keys=4`. The four-sweep unterminated-string defect is **not** present.

**Audit 3 — sot/04 header drift** `[MEASURED]` see FINDING 1.

**Audit 4 — roadmap drift** `[MEASURED]` see FINDING 3.

**Audit 5 — automation health** `[MEASURED]` above (watcher live, queue flowing). Per
STATION-CAPABILITIES §4C the on-disk `Scheduled\` folders are NOT the live schedule and I did not
report from them; the scheduled-tasks MCP is not this station's instrument.

**Audits 6 & 7 — coherence and registry** `[CANNOT MEASURE — NOT ATTEMPTED THIS RUN]`. Deliberately
deferred; see WHAT I DID NOT DO. I am not reporting them as clean.

**Encoding read-back on the file I wrote** `[MEASURED]` `sot/04-data-model.md`: `bytes=278791
BOM=false U+FFFD=0 double_encode_sig=0 CRLF=5168 lone_LF=0 (mixed=false)`. Written with node
(DOCTRINE §9.3), never PowerShell redirection.

## WHAT CHANGED

One doc-reconcile PR, opened from a **disposable worktree off `origin/main`**
(`C:\po-worktrees\sotk-04-header-20260825`, branch `docs/sot-04-header-reconcile-2026-08-25`).
The shared dev tree `C:\ProjectOperations2` was **not** committed from, and its working tree is
byte-identical to how I found it.

| File | Change | Verified by |
|---|---|---|
| `sot/04-data-model.md` | generated schema-map section re-merged; 3 header stat lines refreshed | S3 tail sha identical, read-back |
| `docs/pipeline/stations/05-sot-keeper.md` | two brief statements this run PROVED false, corrected | see FINDING 2 / FINDING 5 |
| `docs/data-model/sweeps/2026-08-25.md` | this run's timestamped sweep report (new) | — |
| `docs/pr-prompts/00-05-...` | this breadcrumb (new, **tracked** by the same PR) | — |

**One mutation I made and reverted, disclosed in full:** to run the §7 negative control I prepended
`DRIFT-CONTROL-LINE` to `C:\ProjectOperations2\docs\data-model\relationship-map.md`. Restoring it via
`git show HEAD:<path>` **FAILED** — that file is gitignored and has no HEAD blob (this is itself
FINDING 2's evidence). I restored from the byte-copy backup I had taken first. Read-back:
`first_line="# ProjectOperations - Data Model Relationship Map" lines=3653`, mtime preserved at
`2026-08-24T23:26:18.038Z`. The file is as I found it.

**Safeguards, all satisfied before anything was written:**

```
S2 determinism   generator run TWICE, all three outputs byte-identical
                 relationship-map.md sha=a938ae94a43f31a8 bytes=163617   (both runs)
                 metadata-catalog.json sha=c78229ae95e1332d bytes=678599 (both runs)
S3 section-scope curated tail (END marker -> EOF) sha256 6e0db192a89a8f3ce2aa4e77 BEFORE == AFTER
S4 no loss       curated lines 1507 -> 1507
S5 scope cap     only sot/ + docs/ touched (see table); no code, scripts or workflows
S6 post-fix      build-relationship-map.mjs --check -> OK, exit 0
S7 one-and-done  ZERO open PRs touch sot/; no reconcile prompt armed. Not "already pending".
                 preamble lines changed = 3 (asserted; the script ABORTS on any other number)
                 git diff --numstat: 124 added / 29 deleted on sot/04 (= +95 lines, matches)
```

## FINDINGS

### FINDING 1 — sot/04's generated schema map was 7 days and 8 models stale

`[MEASURED]` sot/04 header claimed `Last updated: 2026-08-18 14:22 UTC`, schema sha256
`465e02ef3351`, **Models 284 | Enums 66 | FK edges 466**. A fresh generator run against the live
`apps/api/prisma/schema.prisma` produces sha256 `49b774e989af`, **Models 292 | Enums 66 | FK edges
482**. Eight models and sixteen FK edges missing from the source of truth; `Directory` 10→12 and
`Jobs` 19→20 at the domain level. This is exactly the deterministic, regeneratable drift on the
station's auto-fix allowlist.

Re-merged section-scoped between `<!-- SOT04-GENERATED:BEGIN -->` / `<!-- SOT04-GENERATED:END -->`,
plus the three header stat lines that sit above the BEGIN marker (they are generated values, and
leaving them stale is the drift). Everything from the END marker onward — the whole MERGED SOURCES
curated region, 1507 lines — is byte-identical, proven by sha256 before and after **and** re-proven
by reading the written file back.

**DISPOSITION: ACTIONED** — PR opened (number in the chat report). Verified by the S2–S6 block above
and by a post-write read-back of the file.

### FINDING 2 — `--check` is NOT a drift gate, and this station's own brief said it was

`[MEASURED]` The station brief, audit step 1, reads: *"Non-zero = the committed map
(docs/data-model/relationship-map.*) is stale vs apps/api/prisma/schema.prisma."* **That is false in
three independent ways:**

1. **Negative control.** I prepended a garbage line to `docs/data-model/relationship-map.md` and re-ran
   `--check`. It printed `OK: generator ran cleanly against schema.prisma (292 models, 66 enums, 482
   edges).` and **exited 0**. An instrument that cannot fail on a file I deliberately corrupted is
   not a drift gate. (§7: prove your instrument can produce the opposite result.)
2. **There is no committed map to be stale.** `git check-ignore --no-index -v` →
   `.gitignore:127 docs/data-model/relationship-map.md` and `.gitignore:126 ...relationship-map.json`.
   `git show HEAD:docs/data-model/relationship-map.md` → *"exists on disk, but not in 'HEAD'"*.
3. **The source says so.** `scripts/data-model/build-relationship-map.mjs:18-21`: *"The --check mode
   does NOT compare against a committed output file (the generated JSON/MD are gitignored —
   committing them churned every open PR)."* `CHECK_MODE` `return`s at :561, **before** the three
   `writeFileSync` calls at :565-567. The CI job is even named *generator sanity*, not drift.

**Why this matters more than a wording nit:** a clean `--check` is the exact reading a Station 05 run
gets while sot/04 is 8 models stale — which is precisely what happened for the last 7 days. The brief
told the reader that reading meant "in sync". It is the same shape as the 2026-07-13 CRLF incident the
brief itself was written to prevent: a confident green from an instrument that was never measuring the
thing.

**DISPOSITION: ACTIONED** — audit step 1 rewritten in `docs/pipeline/stations/05-sot-keeper.md`
(same PR) to state what `--check` actually proves, carry the measured negative control, and point at
audit step 3 as the only real drift probe.

### FINDING 3 — sot/02 §2 "In-PR — open right now" has been wrong for 21 days

`[MEASURED]` sot/02 line 61 heading claims two open PRs: **#894** and **#895**. `gh pr view` →
`#894 MERGED 2026-08-04T04:41:46Z`, `#895 MERGED 2026-08-04T05:09:13Z`. Both merged the same day the
section was written; the live board carries seven entirely different PRs (#1316-#1323).

This is **curated roadmap prose** and roadmap STATUS semantics — explicitly on the NEVER-auto-fix list.
I did not touch it. A reconcile for it is **already written and staged**:
`docs/pr-prompts/pr-sot-02-reconcile-2026-08-19-HOLD.md`, sitting on HOLD, never armed.

**DISPOSITION: DISPATCHED** → **Station 00**. Arm `pr-sot-02-reconcile-2026-08-19-HOLD.md`
(`git mv` to `-ready.md`; arming is 00's lane, never 05's). Mitigating context, so 00 can rank it: the
section carries its own "live snapshot at reconcile time (2026-08-04) — `bring-up-to-speed.ps1`'s
`[LIVE]` lines beat this table the moment it drifts" caveat, so it is stale-by-design rather than
silently wrong. P3.

### FINDING 4 — a filed Station-05 action item has sat unpicked-up and is blocking twelve slices

`[MEASURED]` `docs/pr-prompts/pr-sot-04-bp0a-job-canonical-reconcile-HOLD.md` exists, is 128 lines,
is labelled **"STATION 05 (SoT-KEEPER) WORK"**, and its own body records that the shipped SLICE-0
plan already filed it as a *"05-sot-keeper action item"* which *"was never picked up"*.

Its premise: `grep -q "survives as the delivery spine" sot/04-data-model.md` — sot/04 §B-P0a (line
3699+) still declares **Project** the surviving spine, while `BACKLOG-DECISIONS.md` §1, the SLICE-0
plan, and Marco on **2026-08-20** all say **Job is canonical**. Two plans of record pointing opposite
ways, which the prompt identifies as why twelve unbuilt slices have sat untouched since July. The
status sweep independently corroborates: backlog item `model-merge-slices-rehomed` is *"READY once
the sot/04 direction reconcile has landed"*.

I did **not** do this work. Re-authoring a design-direction section is judgement, not deterministic
drift — the brief's NEVER-auto-fix list names *"curated prose in sot/01/02/03/05/06"* and the AUTHORITY
section says anything requiring judgement comes back as a finding. It also needs its own run: it is a
separate reconcile PR, and the station is capped at one per run. Note it carries `escalates: true`, so
its PR will be auto-labelled `do-not-merge` and land at Marco's gate regardless.

**DISPOSITION: DISPATCHED** → **Station 00**. Arm it for a dedicated Station 05 run. It touches
`sot/04-data-model.md` §B-P0a (curated region, line 3699+) and adds
`docs/audits/model-merge-direction-reconcile.md`. **It does not collide with FINDING 1's change** —
that one replaced only the generated region above the MERGED SOURCES seam, which I proved
byte-untouched from the END marker onward. A rebase after this PR lands is routine. **P1** — twelve
slices are waiting on it.

### FINDING 5 — the brief's delivery instruction (S1) would have made this station ARM a prompt

`[MEASURED]` Safeguard S1 read: *"NEVER push/merge. Deliver as ONE staged doc-reconcile PR PROMPT at
`docs/pr-prompts/pr-sot-reconcile-{YYYY-MM-DD}-ready.md`."* Obeying it literally is impossible and
unsafe:

- `.gitignore:75` ignores `docs/pr-prompts/*-ready.md`, so the file **cannot be committed** without
  `git add -f` — the "delivery" would have produced nothing a reviewer could see.
- A loose `*-ready.md` in the dev tree **IS an armed prompt.** The watcher globs the dev tree and runs
  it (DOCTRINE §5b: *"Arming a prompt IS the decision to run it"*). **Station 05 may never arm**
  (STATION-CAPABILITIES §5). S1 instructed this station to do the one thing its authority row forbids.
- "NEVER push" contradicts the same file's AUTHORITY section (*"you never arm and you never merge"* —
  silent on push) and STATION-CAPABILITIES §5, which grants 05 *"Create a PR — ✅ doc-reconcile only"*.

Per the station doc's own precedence rule (*"Where it disagrees with the contract above, or with
DOCTRINE, the contract and DOCTRINE win — and fixing the disagreement here is the right move"*), I
followed the contract: worktree, PR, no arming, no merging.

**DISPOSITION: ACTIONED** — S1 rewritten in the same PR, with each of the three reasons and its
citation.

### FINDING 6 — `metadata-catalog.json` is permanently stat-dirty after any generator run (and it is NOT an aborted-run leftover)

`[MEASURED]` The dev tree showed ` M docs/data-model/metadata-catalog.json` with mtime
`2026-08-24T23:26:18Z` — which looks exactly like a regen abandoned uncommitted ~15 h ago, and the
station brief warns that regenerating *"shrinks tracked metadata-catalog.json; that has aborted a
slice before."* **That reading is REFUTED.** The generator writes LF; the repo checks out CRLF, so
every run leaves the tracked catalog *stat*-dirty with an **empty content diff**:

```
git diff --numstat -- docs/data-model/metadata-catalog.json   -> (no rows)
warning: in the working copy of '...', LF will be replaced by CRLF the next time Git touches it
```

`[MEASURED] POSITIVE CONTROL` — the same `git diff --numstat` in the same shell printed
`124  29  sot/04-data-model.md`. The instrument is working; the empty result is a real "no content
change", not a broken query (§9.6). Reproduced identically in a clean worktree straight off
`origin/main`, so it is a standing repo property, not dev-tree damage. I therefore did **not** commit
the catalog — committing it would churn every open PR for zero content, which is the same mistake that
got the map gitignored in the first place.

**DISPOSITION: DEFERRED** — cosmetic today. It becomes urgent if a station ever runs `git add -A` or
`git commit -a` in the dev tree, which would sweep a zero-value 678 KB churn into an unrelated PR. The
durable fix is a `.gitattributes` entry pinning `docs/data-model/*.json` to LF; that is a repo-config
change outside this station's allowlist. Hand to Station 06 if it recurs.

## WHAT I DID NOT DO

- **Audit 6 (model ↔ migration ↔ code coherence) and Audit 7 (sot/01 registry drift).** Not run.
  Reporting them unmeasured as "clean" is the exact failure mode the brief's RULE ZERO exists to
  prevent, so they are tagged `[CANNOT MEASURE — NOT ATTEMPTED]` above and carried to the next run.
  Nothing in this run's evidence suggests either is on fire.
- **Did not touch sot/02, sot/01, or sot/04 §B-P0a.** All curated prose and design direction —
  NEVER-auto-fix. Findings 3 and 4 instead.
- **Did not arm, merge, label, or unlabel anything.** Seven PRs are open; five carry `do-not-merge`
  or are watcher-routed. Not my lane, and RULE 2 binds regardless.
- **Did not commit from the shared dev tree**, which is carrying another chat's staged
  `pr-arm-lock-s1` rename. All work happened in a disposable worktree.
- **Did not commit `docs/data-model/metadata-catalog.json`** — see FINDING 6.
- **Did not touch Azure / Entra / SharePoint.** Absolute hard stop; nothing this run went near it.

---

*Breadcrumb is TRACKED by the PR that carries it, so Station 00 does not need to sweep it up
separately. All claims true at `b968e4f1`; re-verify before acting on any of them.*
