# Station 00 — Supervisor | 2026-09-10T17:08:14Z–2026-09-10T17:5xZ

Sighted run — Desktop Commander reached the box on the first call, before any conclusion was drawn.
Collect cycle. No merge of anyone else's work, one board PR, one binding-document gap closed, one
breadcrumb collected and archived.

Fresh negative-control needles minted for this run: `zzQq00Needle20260910T1715`, `...T1719`,
`...T1726`, `...T1731`. They are now written down and are spent.

## GROUND

```
UTC            2026-09-10T17:08:14Z
origin/main    4b205fca            (git fetch origin --prune, then rev-parse)
dev tree       main @ 4b205fca     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not restricted to read-only on that account.

All three binding documents were read in full and proved current against `origin/main` rather than
merely off disk: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` returned **EMPTY** for
all three, which is the real answer per DOCTRINE section 9.3. No piped hash was taken and none is
compared. Every `git` call ran in the dev tree or in this run's own worktree, never the watcher clone.

## WHAT I MEASURED

**Preflight guard — [CANNOT MEASURE], fourth consecutive station run.**
`scripts/pipeline/vm-git-guard.sh` could not be installed: the Linux workspace transport is absent
again. Verbatim: `bash failed on resume, create, and re-resume … source path … is under Plan9 share
"c" which is not mounted; create: RPC error -1: ensure user: user adoring-keen-volta already exists
unexpectedly`. Station 04 recorded this at 14:10Z, Station 00 at 15:08Z and again at 16:08Z; this is
the fourth, under a fourth session id. **No `git` ran against any mount this run — there was no mount
to run one against.** Per the station contract a failed install is a finding, not a stop.

**Preflight step 4 — the sweep.** `status-sweep.ps1` captured to a file, exit 0, 135,414 bytes. It is
UTF-16LE per DOCTRINE section 9.3's `*>` bullet and was decoded `utf16le` in node before being read.
Section 0 controls both `[LIVE]` (`gh CAN reach GitHub`, `node runs`). Section 7 verbatim:
`[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station
worktrees.` Re-measured immediately before the worktree was created: `index.lock` dev **False** /
clone **False**, `git.exe` processes **0**, `git diff --cached --name-status` **EMPTY**,
`origin/main` still `4b205fca`.

**Machinery — two agreeing instruments, no relaunch.** Sweep section 2:
`[LIVE] watcher node: RUNNING pid 18228` · `auto-restart wrapper: alive (1)` · heartbeat 39 min ·
`armed: 0`. `restart-watcher-if-wedged.ps1` (report-only, no `-Fix`) verbatim:
`armed prompts waiting: 0` · `watcher process: ALIVE (pid 18228)` · `restart churn: 0 cycle(s) in
20 min` · `VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not
wedged.` Because the wrapper probe answered **1**, the `wrapper=0` question the station doc calls a
QUESTION-not-a-verdict never arose and no parent chain had to be walked. Trunk green on `4b205fca`
(4 success / 0 failed). No restart was needed and none was performed.

**COLLECT corpus.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`,
`structure: 1 checked, 0 malformed`. Crossed against `lastRunAt` from the scheduled-tasks MCP, as the
collect step requires, because the breadcrumb is one instrument and cannot name a cause:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| `00` | 2026-09-10T17:08:14Z (this run) | 16:08Z | aligned |
| `03` | 2026-09-09T23:01:42Z | 2026-09-09T23:01Z | aligned; next fire 23:00Z today |
| `04` | 2026-09-10T14:09:49Z | 14:10Z | aligned |
| `05` | 2026-09-10T14:10:55Z | 14:11Z | aligned |
| `weekly-security-audit` | 2026-09-06T21:32:44Z | n/a — not a station | next 2026-09-13, healthy |

No station is SILENT and none needed a transcript read. ⚠️ **The `ok` on `00` is weaker than it looks
and I am not quoting it as an all-clear:** `check-breadcrumb.mjs`'s `CADENCE` map still reads
`'00': 2` against a live cron of `5 * * * *`, so `00` is not called SILENT until three consecutive
hourly runs have been missed. Crossed against the board instead — `#1854` (1408), `#1856` (1508) and
`#1857` (1608) merged an hour apart — so the occurrences either side of this one fired and reported.

**Exactly one breadcrumb to collect**, my own predecessor's 1608 run. Asked of the TRACKED SET rather
than the dev tree, per the archiving rule: `git ls-files` returns it at exit 0, so it has already
reached `main` and is not an unreported finding. All six of its findings (F1–F6) carry a disposition,
so it is fully collected and is archived in this run's PR. Its carried-forward claims were re-verified
against the live system rather than repeated: `#1823` still OPEN and CLEAN; the three untracked
non-ignored dev-tree files still exactly three; the VM transport still absent.

**Q1 — five open PRs, and ZERO are DIRTY.** `gh pr list -R GH-Mantova/ProjectOperations --state open
--json number,title,mergeStateStatus,isDraft,labels,createdAt` (exit 0, 1,321 chars, assign-then-count
→ 5). All five `CLEAN`, all `draft=False`, all `labels: []`, all **15 pass / 0 fail / 0 pending**.
**No PR has frozen CI and the board is not conflict-blocked.**

**Q2 — no conflict exists, so nothing is being escalated as one.** Zero DIRTY.

**Q3 — armed prompts counted by hand, not quoted from a note.**
`@(Get-ChildItem docs\pr-prompts -Filter '*-ready.md').Count` → **0**, and the name list is empty.
`0` at the start of the run and `0` at the end.

**RULE 2 lane, re-measured this run**, against the LIVE tree
`C:\ProjectOperations2\docs\pr-prompts\processed` and never the watcher clone, written without a
quote character (`-Pattern 'marco.:true'`), with `rev-*` logs excluded from the per-PR match:

| control | result |
|---|---|
| logs in the probe directory | 2,119 |
| newest log | `2026-09-10T14:38:19Z` — younger than every open PR's `createdAt` |
| POSITIVE `marco.:true` | **629** |
| NEGATIVE `zzQq00Needle20260910T1715` | **0** |
| NEGATIVE `PR #999999` over `pr-*.log` | **0** |

| PR | files | prompt-log hits | verdict | lane |
|---|---|---|---|---|
| `#1850` | `scripts/pipeline/triage-holds.ps1` | 2 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/triage-holds.ps1"}` | **MARCO'S — RULE 2 binds** |
| `#1845` | `scripts/pipeline/status-sweep.ps1` | 2 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/status-sweep.ps1"}` | **MARCO'S — RULE 2 binds** |
| `#1832` | `scripts/pipeline/vm-git-guard.sh` | 2 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh"}` | **MARCO'S — RULE 2 binds** |
| `#1823` | 5 × `apps/api/**` + its receipt | 2 | `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` | **MARCO'S — RULE 2 binds** |
| `#1852` | `scripts/pipeline/status-sweep.ps1` | **0 — NO LOG** | — | `[NO LANE VERDICT — hand-classified]` **MARCO'S** |

⚠️ **All five carry `labels: []`, and that clears nothing.** `#1823`'s label was removed by Marco on
2026-09-09. **Removing `do-not-merge` does not clear RULE 2** — a live watcher `marco:true` verdict is
cleared only by Marco in chat, for that batch, and no such instruction reached this run.

**`#1852`'s `NO LOG` was resolved, not assumed.** The daily clone log was located by NAME SHAPE then
mtime, never constructed from a date: `…\scripts\pr-watcher\logs\2026-09-10.log`, mtime
`2026-09-10T17:14:51Z` — seconds old, and younger than `#1852`'s `createdAt` of `13:21:20Z`, so the
freshness precondition is satisfied — 79,850 B, POSITIVE control `[merge]` → **8**, NEGATIVE
`zzQq00Needle20260910T1731` → **0**. Its four `opened PR #` lines name `#1827`, `#1832`, `#1845`,
`#1850` and **not `#1852`**, which is `[CANNOT MEASURE]` on that instrument and never on its own a
second-lane verdict. Hand-classified by `classifyPolicyFiles`: one file,
`scripts/pipeline/status-sweep.ps1`, outside all three `NESTED_TEST_PATHS` forms and not a
`migrations/` path ⇒ **Marco's**.

**No PR is inside a merge window.** Newest `policy=tests-docs, waiting` in the daily log is `#1850` at
`12:02:16Z`; its 90-minute `MERGE_TIMEOUT_MS` window closed about `13:32Z`, five hours ago. There was
no waiter that had to go first before this run's own board PR.

**Nothing is mergeable by this station.** Five of five open PRs are Marco's.

**Nothing is armable that does not land on Marco — re-measured on a third corpus.**
`triage-holds.ps1` (read-only, `--dequeue` never passed) reports `spent=0 of 40 · gates-satisfied=9 ·
still-gated=31 · unreadable=0`, with both its own controls PASS. Each of the nine ADMIT prompts was
parsed with the CRLF-explicit `scope:` regex — the one section 9.3 records, after the `\s*\n` form
silently returned null on all eleven prompts of the 08:5xZ run — and classified against
`classifyPolicyFiles`:

| ADMIT prompt | scope entries | first entry outside tests/docs |
|---|---|---|
| `pr-brandtheme-s3-full-palette-columns` | 8 (+migration) | `apps/api/prisma/schema.prisma` |
| `pr-brandtheme-s6-live-preview-contrast-and-override` | 6 | `apps/web/src/lib/contrast.ts` |
| `pr-company-manage-s1-permission-and-grant` | 4 (+migration) | `apps/api/src/common/permissions/permission-registry.ts` |
| `pr-e2e-container-s2-swap-required-job` | 2 | `.github/workflows/playwright.yml` |
| `pr-fv2-maintenance-usage-intervals` | 5 (+migration) | `apps/api/prisma/schema.prisma` |
| `pr-qpdf-1-estimate-preview-mark` | 6 | `apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts` |
| `pr-qpdf-3-quoteref-collision-409` | 3 | `apps/api/src/modules/client-quotes/client-quotes.service.ts` |
| `pr-qpdf-4-freeze-issued-terms` | 6 | `apps/api/src/modules/client-quotes/quote-pdf.service.ts` |
| `pr-rateparity-s1-harness` | 4 | `apps/api/src/modules/rates/charge-step-parity.service.ts` |

**TESTS-DOCS ELIGIBLE = 0 of 9.** Parser controls run separately from the classifier, per section
9.3: POSITIVE — a file known to carry a `scope:` list parses to **6** entries; NEGATIVE — a key known
to be absent (`zzQq00Needle20260910T1719`) parses to **0**. The 1408 run measured `0 of 15` and the
08:5xZ run `0 of 11`; **this is the same answer on a third corpus definition**, which is what makes it
a property of the queue rather than of one probe.

## WHAT CHANGED

1. **One board PR opened** from the isolated worktree `C:\po-wt\bc-00-1708`, created off
   `origin/main` `4b205fca`, carrying: the DOCTRINE section 10.6 correction of F1, the archiving of my
   predecessor's fully-collected 1608 breadcrumb, and this report. `docs/` only.
2. **Nothing else.** No PR of Marco's merged. **No prompt armed, disarmed, renamed, moved or
   deleted** — `armed` was 0 before and after. No label added or removed. No watcher restart. No
   worktree pruned, no stash dropped, no branch deleted, no `git clean`, no `git checkout .`, no
   `reset --hard`, no `stash pop`. The dev tree's shared index was **EMPTY** before and after, so no
   other chat's staged work was swept into a commit.

## FINDINGS

### F1 — section 10.6's duplicate-confirm step has no instrument on 90% of the queue, and its absence fails in the arming direction

[MEASURED] this run at `4b205fca`. DOCTRINE section 10.6's 2026-09-07 correction ends *"Confirm on
the prompt's own MARKER STRING, not on the head branch"*, and its worked example is
`PLANT_FUEL_COLUMN_V1`. Over every `-HOLD.md` at depth 1 of `docs/pr-prompts` — 40 files — **only 4
carry a `_V<n>` marker at all.** For the other **36 of 40** the prescribed confirmation cannot be run
in either direction, and the section names no fallback. A reader who follows it literally reaches no
verdict on a CANDIDATE the tool has just flagged, and the available next move is to arm it — the one
outcome that section exists to prevent.

**It fired on this board the same run, so this is not hypothetical.** `triage-holds.ps1` flagged
`pr-company-manage-s1-permission-and-grant-HOLD.md` as a POSSIBLE DUPLICATE of open `#1823`, overlap
**1 of 4**, on the single shared scope entry
`apps/api/src/common/permissions/permission-registry.ts`. Marker tokens in the prompt: **none** — a
deliberately wide `[A-Z][A-Z0-9]{2,}(_[A-Z0-9]+)+` sweep returns only front-matter key names
(`done_when`, `gate_allow`, `premise_means`, `rollback_strategy`, `seed_only`, `cluster_order`) and a
migration name. Marker tokens in `#1823`'s title and body: **none**. **POSITIVE control that the
marker instrument itself works:** the identical sweep over `pr-rateparity-s1-harness-HOLD.md` returns
`RATE_PARITY_HARNESS_V1` and `RATE_LINE_FIELDS_V1`. The instrument is sound; the corpus does not carry
what it reads.

⚠️ **The overlap file is the aggravating class, not an accident.** A permission registry, a schema, a
barrel, a workflow file — a shared REGISTRY many unrelated prompts must touch — collides with almost
any PR in its area, so the single-entry case section 10.6(b) already calls *"precision zero by
construction"* is not rare on this queue; it is where the flags come from.

🔧 **The fallback that always exists is the `premise`, evaluated at the PR's HEAD rather than at
`main`.** Every prompt carries an executable premise by `docs/pr-prompts/PROMPT-SCHEMA.md`; section
10.6's own headline — *"the premise dies on MERGE, not on OPEN"* — is a statement about `main`, and it
is precisely why the premise is still readable at an open PR's head. [MEASURED] on the flagged pair
via `gh api repos/GH-Mantova/ProjectOperations/contents/<path>?ref=fe98c6be` (exit 0, 20,954 bytes
decoded):

| probe at `#1823` head | count | reading |
|---|---|---|
| `company.manage` — the prompt's own premise needle | **0** | premise still TRUE ⇒ NOT this PR's work |
| `reporting.team` — POSITIVE control, `#1823`'s own subject | **1** | the probe can return a hit |
| `zzQq00Needle20260910T1726` — NEGATIVE control | **0** | the probe is not matching everything |

**Verdict on the flag: NOT a duplicate**, settled by an instrument that exists on 40 of 40 prompts
instead of 4.

**DISPOSITION: ACTIONED** — landed in this run's board PR as a correction inside DOCTRINE section
10.6, docs-only and inside this station's lane. Section 10.6 sits **outside** the `instruments v2`
canonical block (which ends at `END-CANONICAL-BLOCK: instruments v2`), so this costs one document and
needs no hash re-record. RULE 1 decided the shape: the premise-at-head test is complete (it removes
the blind spot permanently) and additive (it cannot mis-arm anything, since a premise that is still
true is the definition of work not yet done, and it adds no tooling — the needle is already in the
prompt's front matter); the marker test is kept FIRST where a marker exists, because naming the work
is stronger evidence than inferring it from a file's contents. Byte delta asserted
(`153,884 → 157,812`, addition 3,928, `DELTA===EXPECTED` **PASS**); built by pure concatenation onto
the end of the file, never a `String.replace` replacement string, with `Buffer.compare` proving the
153,884-byte prefix **byte-identical** after the write; encoding re-checked (U+FFFD **0**; the
`â€`-family count is **2 before and 2 after**, both being section 9.3 quoting that signature as
documentation — section 9.6's closing rule, not damage). **Falsifying probe** is written into the
correction: the marker sweep over the depth-1 `-HOLD.md` corpus.

### F2 — the rebuild churn measured at 16:08Z reproduced within the hour, on schedule

[MEASURED] this run. My predecessor measured `#1852` at **5 commits, 4 of them `Merge branch 'main'
into …`**, against 4 PRs merged to `main` since it was created — an EXACT one-for-one. One hour and
one merge later (`#1857` at 16:28Z), `#1852` reads **6 commits, 5 of them rebuilds**, still exact.
The mechanism `pollForBehindPrs` is already an open escalation with its options; what this adds is a
second independent sample of the *rate*, taken an hour apart on the same PR, which is stronger than
one snapshot because it removes the possibility that the 16:08Z reading was a coincidence of sampling.

The self-implicating half is unchanged and worth restating rather than softening: **this station's own
hourly collect PR is the main thing writing to a board where every PR waits on a human.** This run's
PR will make it 6 of 7.

**DISPOSITION: DEFERRED**, not re-escalated. The question is already with Marco with its options, and
re-escalating hourly is exactly the noise the 1508 run correctly refused to make. This is evidence for
option **(a)** — *skip PRs `classifyPolicyFiles` refuses* — which is the complete-and-additive one:
it removes the waste permanently and cannot damage data entry, since a PR no automation may merge
gains nothing from being kept current. ⚠️ **These are counts, i.e. state — re-measure, never quote.**
It becomes urgent if the rebuild loop ever pushes a PR red, or if a `fixes_pr` for a main regression is
ever among the PRs being rebuilt.

### F3 — `#1823` is still fully prepared and still gated on the one thing only Marco can clear

[MEASURED] this run: `state=OPEN`, `mergeStateStatus=CLEAN`, CI **15 pass / 0 fail / 0 pending**,
`labels: []`, and its CP-26 receipt present in its own diff. It has now sat **41.2 hours** since it
opened. The one thing holding it is the live watcher verdict
`{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`.
**RULE 2 is not overridden by green, by CLEAN, by the label having been removed, or by a receipt** —
and the receipt does not clear it, because nothing in the pipeline verifies a receipt. I did not merge
it and no station may.

⚠️ **Carried forward unchanged because it is the one operational risk on this board and it is marked
[CANNOT MEASURE] by its own author:** the receipt records that keying team visibility off
`tenders.allocate` means every role holding that code sees colleagues' individual numbers in the
estimating and win-rate reports, and WHICH roles hold it could not be measured from that lane. That is
one look at the Admin role list, and it belongs to Marco before anyone relies on the reports.

**DISPOSITION: DEFERRED.** Not escalated, because it is already written where Marco will read it — in
the receipt inside the PR's own diff — and duplicating it into `needs-marco/` would split one question
across two homes. It becomes urgent the moment the PR is merged or deployed with the role list
unchecked.

### F4 — the Linux workspace transport has now been absent for four consecutive station runs

[MEASURED] this run, verbatim under the measurements above. With Station 04 at 14:10Z and Station 00
at 15:08Z and 16:08Z, that is four runs across four session ids and roughly three hours. This is **not
blindness** and must not be reported as it: Desktop Commander was present and healthy throughout all
four, and `STATION-CAPABILITIES.md` section 3 already says that transport is never a fallback.

The narrow consequence is unchanged: `vm-git-guard.sh` stays uninstalled, so the first run that *does*
get a mount inherits an unguarded bridge. ⚠️ And the luck is unchanged too — the guard exists to stop
`git` running against a mount, and on all four runs there was no mount to run one against.

**DISPOSITION: DEFERRED**, unchanged, re-recorded because the count has moved, which is the only new
fact. It is not actionable from a run with no VM side. It becomes urgent the moment a station with a
working mount runs; that run installs the guard and quotes the installer's last line, pass or fail.
⚠️ `#1832`, which repairs this very script's self-test, is one of the five PRs waiting on Marco.

### F5 — the three untracked non-ignored dev-tree files are unchanged, and so is the reason not to commit them

[MEASURED] `git status --porcelain` in the dev tree returns exactly three, the same three the 1608 run
found: `docs/pr-prompts/.queue-sync-ledger.txt`, `docs/pr-prompts/queue-watch-state.md` and
`Claude Design/docs/index.html`. Re-verifying rather than repeating was the point of the check: the
set has not grown in an hour, so this is a stable condition and not a leak.

**DISPOSITION: DEFERRED**, folded into the 1608 run's F6 and the 1508 run's F3, which reached the same
conclusion for the same reason. The first two are STATE, not instructions — `queue-watch-state.md` is
the snapshot the sweep itself tags `[FILE]` and warns is not current — so the complete-and-additive
fix is one `.gitignore` entry covering all of them, not a commit that would make state permanent.
`.gitignore` is outside this station's lane on this board, and every arm available today lands on
Marco (see the eligibility table above). ⚠️ It becomes urgent if any of these ever appears in
`git ls-tree -r origin/main`; that probe is one line.

## WHAT I DID NOT DO

- **Merged nothing of Marco's.** All five open PRs are his: four carry a live watcher `marco:true`
  verdict and `#1852` hand-classifies to him on its single `scripts/pipeline/` path. RULE 2 is not
  overridden by green, by CLEAN, by an empty label list, by a CP-26 receipt, or by my own reading of a
  routing reason. `#1823`'s label was removed by Marco; **that is not a RULE 2 clearance** and I did
  not treat it as one.
- **Armed nothing.** `armed` was 0 throughout. The eligibility table above is the reason stated as a
  measurement rather than a preference: 0 of 9 gate-satisfied HOLDs can enter the `tests-docs` lane, so
  every arm available today lands on Marco, and adding to a five-deep queue he has not cleared makes it
  longer rather than shorter — at a cost F2 now measures in rebuild commits, not just in waiting.
- **Did not act on the duplicate flag beyond confirming it.** `pr-company-manage-s1-permission-and-
  grant-HOLD.md` was confirmed NOT a duplicate of `#1823` and was left exactly where it is. Confirming
  a flag is not the same as arming what it cleared, and the eligibility bar above still refuses it.
- **Did not author a merge-approvals receipt.** A scheduled run never may. Marco's 2026-09-07 ruling
  covers the supervised cloud lane only, and this run is the scheduled one.
- **Did not remove or add any label**, and did not enable auto-merge on anything but this run's own
  docs-only board PR.
- **Did not prune `C:\po-vg` or `C:\po-worktrees\pr1823`, drop a stash, or delete a branch.** Both
  worktrees and the clone's stash loop are Station 03's and are already dispatched by the 1508 and
  1608 runs; branch deletion is irreversible and is already escalated. The 1608 run's correction stands
  and is re-stated here because it changes what one of them is: `C:\po-worktrees\pr1823`'s HEAD
  `9664f95a` **is the commit that authored `#1823`'s merge-approval receipt**, so 03 should know it is
  deleting the tree an audit artefact was written in. **Re-measure both SHAs immediately before
  acting** — `#1823` is live.
- **Did not touch the watcher clone beyond reads** — the daily log was **copied** before
  `Select-String`, because the live file is held open by the watcher, and nothing in `C:\po-watcher`
  was written.
- **Did not restart the watcher.** ALIVE pid 18228 with a live wrapper and an empty queue; two
  instruments agreed and a stale heartbeat with 0 armed is idle, not wedged.
- **Did not run `git` through the device bridge** — there was no bridge, and a guard I could not
  install is never a licence to use one.
- **Did not commit `queue-watch-state.md`, `.queue-sync-ledger.txt` or `Claude Design/docs/index.html`**
  (F5), and did not edit `.gitignore`.
- **Left `docs/qa/`, `/sot/`, Azure, Entra and SharePoint alone.** No file under `sot/` was read for
  edit or written this run.
