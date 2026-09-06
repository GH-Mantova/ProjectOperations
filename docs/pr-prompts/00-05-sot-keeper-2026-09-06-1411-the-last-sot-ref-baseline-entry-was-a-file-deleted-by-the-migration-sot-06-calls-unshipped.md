# Station 05 — SoT Keeper | 2026-09-06T14:11Z–2026-09-06T14:4xZ

## GROUND

```
UTC            2026-09-06T14:11:25Z
origin/main    d1467428              (fetched, then rev-parse)
dev tree       main @ d1467428       C:\ProjectOperations2  (ff'd a65ab1d4 -> d1467428 this run)
doc version    1                     (docs/pipeline/stations/05-sot-keeper.md front matter)
bootstrap      1                     (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE — this run was read/write within lane, not read-only.

**Sighted run.** Desktop Commander reached the box on the first call (`start_process`,
`powershell.exe`, PID 26360). Not blind.

**No missed occurrence.** `node scripts/pipeline/check-breadcrumb.mjs --freshness --station 05`
→ `05 last 2026-09-05T14:11:00Z 24.0h ago (cadence 24h) ok`. Age is exactly ONE cadence, so no
day is owed and no catch-up unit of work was required. (Per the station doc I read the AGE, not
the `ok`.)

**Device-bridge git guard installed.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
last line, quoted verbatim:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
(preceded by `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths,
allows everything else (both controls passed)`). PASS.

**Sweep verdict.** `scripts/pipeline/status-sweep.ps1` (captured to a file, because it returns
early and hides its own §7 verdict when streamed) → §7 **SAFE TO ACT**, stamped
`SWEEP COMPLETE 2026-09-06 14:13:02Z`. Re-run immediately before the push; see WHAT CHANGED.

## WHAT I MEASURED

**Audit step 1 — schema parse sanity.** [MEASURED]
`node scripts/data-model/build-relationship-map.mjs --check` →
`OK: generator ran cleanly against schema.prisma (294 models, 68 enums, 491 edges).` exit 0.
Per the station doc's own 2026-08-25 correction this is a PARSE gate, not a drift gate — it is
NOT evidence that sot/04's generated section is current. The drift probe is step 3.

**Audit step 2 — catalog validity.** [MEASURED]
`node -e "JSON.parse(readFileSync('docs/data-model/metadata-catalog.json','utf8'))"` →
`CATALOG_OK bytes=715030 topKeys=4`, exit 0. **Valid.** (This file was invalid for four
consecutive sweeps in August; it is not invalid now.)

**Audit step 3 — sot/04 drift. DRIFT PRESENT.** [MEASURED] header-to-header:

| | sot/04-data-model.md header | freshly generated `relationship-map.md` header |
|---|---|---|
| Last updated | 2026-09-05 14:16 UTC | 2026-09-06 01:56 UTC |
| schema sha256 | `c54776fc0cc6` | `42120529c084` |
| Models | **293** | **294** |
| Enums | 68 | 68 |
| FK edges | **488** | **491** |
| Domains | 23 | 23 |

Δ = +1 model, +3 FK edges. The generated section of sot/04 was not re-merged after the last
schema change. See FINDING F4.

**Audit step 4 — roadmap drift. DRIFT PRESENT.** [MEASURED] sot/02 §2 read
`## 2. In-PR — open right now (2)` and named #895 and #894. `gh pr view` for both:
`{"mergedAt":"2026-08-04T04:41:46Z","number":894,"state":"MERGED"}` and
`{"mergedAt":"2026-08-04T05:09:13Z","number":895,"state":"MERGED"}`. Both merged on the same
day the snapshot was stamped; the table had been wrong for **33 days**, and the four PRs that
are actually open appeared nowhere in sot/. See F5.

**Audit step 5 — automation health.** [MEASURED] from the 14:13:02Z sweep, §2:
`watcher node: RUNNING pid 27236` · `auto-restart wrapper: alive (7)` · `heartbeat age: 37 min`
(ticks only mid-run; stale + empty queue is idle, not wedged) · **`watcher clone: branch=main
dirty=3 <-- NOT clean-on-main; the watcher may refuse to start`** · one non-main worktree,
`C:/po-vg 23c91ba9 [fix/no-rebase-while-checks-run]`, **dirty=1, age 3259 min, HOLDS
UNCOMMITTED WORK.** §3: 0 in-progress prompts, no `index.lock` in either tree, 0 git processes,
no PR touched in the last 2 min. Nothing is merging-blocked by a dead watcher. See F6.

**Audit step 6 — sot-refs.** [MEASURED] before the edit:
`total=272 dangling=0 exempt=20 baselined=1 excluded=2`, exit 0 —
one entry left, `sot/06-active-specs.md:2240 -> apps/api/src/modules/estimate-export/pdf/quote-pdf.builder.ts`.
Safety probe mandated by the station doc, with both controls:
`git cat-file -e origin/main:apps/api/src/modules/estimate-export/pdf/quote-pdf.builder.ts` → **exit 128**;
POSITIVE control `origin/main:CLAUDE.md` → exit 0; NEGATIVE control
`origin/main:apps/api/src/modules/zzQq05Needle20260906.ts` → exit 128. The target is genuinely
absent from `main`, so the entry could not be burned down by deletion alone.

**What that file actually is.** [MEASURED] `git log --all --oneline --diff-filter=D` over the
old path returns exactly one commit: `4360f149` — **"[5A.2] Quote PDF — HTML template +
migration (#221)"**, 2026-05-25. [MEASURED] the live replacement, by reading the source:
`apps/api/src/modules/client-quotes/quote-pdf.service.ts` (152 lines) imports `buildQuoteHtml`,
`headerTemplate`, `footerTemplate` from `pdf-rendering/builders/quote-html.builder.ts` and
`PdfRendererService` from `pdf-rendering/pdf-renderer.service.ts`, whose header reads
`import type { Browser, LaunchOptions } from "puppeteer"` with `headless: true`. Its line 40 is
`await this.exportSvc.fetchTenderForExport(tenderId)`. **So the live quote-PDF path is
HTML → headless Chrome — the exact thing sot/06 said had been avoided "intentionally for
stability" — and the 5A.2 migration sot/06 records as "not shipped" is the commit that deleted
the file sot/06 cited.** See F1.

**After the edit.** [MEASURED] in the worktree:
`total=276 dangling=0 exempt=20 baselined=0 excluded=2`, exit 0, and
`check-sot-baseline-ratchet.mjs <base> <head>` →
`sot-refs ratchet: OK - 1 -> 0 baselined entries, no new (sot_file, missing_path) pair.
Self-test: 4 cases passed.` exit 0. **The burn-down list is now empty.**

**Audit step 7 — registry.** [CANNOT MEASURE this run] — see WHAT I DID NOT DO.

## WHAT CHANGED

One doc-reconcile PR, opened by this station from a disposable worktree
(`C:\po-worktrees\sot-05-20260906`) off `origin/main` d1467428, branch
`docs/sot-05-reconcile-2026-09-06`. CP-24 clean: it touches `sot/` and `docs/` only, no
`scripts/`, no `apps/`.

`git diff --numstat` — three files, 45 insertions / 15 deletions, no line-ending mass rewrite:

```
1   3   docs/qa/sot-refs-baseline.json
17  8   sot/02-roadmap-and-status.md
27  4   sot/06-active-specs.md
```

1. **`sot/06-active-specs.md` §1.4 "Quote PDF pipeline (current state)"** — the five stale
   bullets are replaced by the measured current state, above a `RECONCILED 2026-09-06` note
   carrying the evidence. **The original wording is preserved verbatim** in a "Superseded
   snapshot" block, with its paths deliberately un-backticked so the provenance survives
   without re-creating the dangling reference (`check-sot-refs.mjs` extracts only
   backtick-delimited path-shaped strings — `RAW_REF_REGEX`). Nothing curated was deleted.
2. **`docs/qa/sot-refs-baseline.json`** — the last entry deleted; `entries: []`.
3. **`sot/02-roadmap-and-status.md` §2** — the live-snapshot table refreshed to the four
   genuinely open PRs, re-stamped `2026-09-06T14:20Z @ d1467428`, with a short note saying why
   it moved. **Only the snapshot was refreshed. No roadmap STATUS semantics were touched** —
   §1, §3 and §4 are untouched, per the station doc's never-auto-fix list.

Every edit was made in node by index-slice concatenation (never a `String.replace` replacement
string — DOCTRINE §9.3) with a **byte-delta assertion** on each: 283844→285658, 19883→20725,
4127→3956, each equal to its predicted value, each with `old_gone=true new_present=true`.

Read-backs after the edit: `check-sot-refs.mjs` exit 0 at `baselined=0`; the ratchet exit 0;
`JSON.parse` of the baseline → `entries=0`.

**Nothing else was mutated.** No arm, no merge, no label, no `main` commit, no watcher touch.

## FINDINGS

**F1 — sot/06 §1.4 asserted, on `main`, that a migration was unshipped, three and a half months
after it shipped; and the dangling path it cited was deleted by that same migration.**
The file `apps/api/src/modules/estimate-export/pdf/quote-pdf.builder.ts` was removed by
`4360f149` "[5A.2] Quote PDF — HTML template + migration (#221)" on 2026-05-25; §1.4 recorded
"5A.2 HTML→PDF migration: **not shipped**. Q5 status: OPEN" and described a PDFKit stack that no
longer exists. Anyone planning PR D1 from this section was reading a pre-migration codebase.
→ **ACTIONED.** §1.4 rewritten to measured current state with the superseded text retained.
Verified by `check-sot-refs.mjs` exit 0, `dangling=0`, `baselined=0`.
⚠️ **The residue is a spec judgement I did not make: whether Q5 may now be closed, and whether
PR D1's premise ("rewire *this* to honour per-quote arrangement") still names the right file.**
That is Marco's or Station 06's, not a doc-reconcile's. → carried in F2.

**F2 — Q5 / PR D1 need a spec decision now that §1.4 is accurate.** The doc no longer misleads,
but it now says plainly that the thing D1 was scoped against was replaced in May. Options, RULE 1
order: **(a) complete + additive** — Station 06 re-scopes D1 against `quote-pdf.service.ts` +
`quote-html.builder.ts` and closes Q5 in the same pass, so the spec and the code agree and no
future slice is written against a dead file; **(b)** close Q5 only, leave D1's wording — cheaper,
fails the "future" half, because D1's premise still names a file that does not exist;
**(c)** leave both — fails both halves. → **ESCALATED** to Marco (design/product, §5.5). Not
decided here.

**F3 — INSTRUMENT, and it nearly cost this run the correct classification: in this SHALLOW clone,
`git log -- <path>` from HEAD returns 0 for a file that has 13 commits under `git log --all`.**
[MEASURED] `Test-Path .git\shallow` → **True**; `git rev-list --count HEAD` → 900;
`git log --oneline -- <old builder path>` → **0**; `git log --all --oneline -- <same path>` →
**13**; POSITIVE control `git log --oneline -- CLAUDE.md` → 5. Why this matters: the
`sot-refs-baseline.json` `_readme` records the PROVENANCE test as *"the target has ZERO commits
in origin/main history ⇒ it is a document of the predecessor workspace ⇒ clear it with an inline
`sot-ref-allow` marker"*. Run in the HEAD-only form, that test returns 0 for a file that was
deleted by a merged PR in **this** repo — so the entry would have been permanently exempted
instead of repointed, and `main` would have kept the false "not shipped" claim forever. The
readme's own historical measurements used `--all`; the trap is that the obvious shorter form
answers, plausibly, and wrongly. Two opposite truths, one reading — DOCTRINE §9.6 exactly.
→ **DISPATCHED → Station 00.** It belongs in DOCTRINE §9.2, which is inside the hash-gated
`instruments v2` canonical block; editing that needs a re-recorded hash and is not 05's lane.
Suggested wording: *"In a shallow clone `git log -- <path>` is not a history probe. Use
`git log --all -- <path>`, and control it against a file you know was deleted."*

**F4 — sot/04's generated section is one schema revision behind (293/488 vs 294/491).**
This is the allowlisted, deterministic auto-fix, and I did not take it. Reason: the
one-reconcile-PR-per-run cap was spent on the burn-down, and **two of the four open PRs (#1709
`TenderClient.bidStatus — the schema and API foundation`, #1713 rates) change the schema**, so a
re-merge landed today re-drifts within hours, while the burn-down is permanent. → **DEFERRED.**
**What makes it urgent:** the drift exceeding a handful of models/edges, a domain count change
(still 23 on both sides — no domain moved), or the board going quiet with no schema PR open.
Next 05 run should take it if #1709/#1713 have landed.

**F5 — sot/02 §2 "open right now" was 33 days stale and named two PRs that merged the day it was
written.** → **ACTIONED** (snapshot refreshed, semantics untouched). The structural half is the
finding: a table stamped with its own reconcile date is still read as current by a reader who
does not check the date, and this one survived four weeks of daily 05 runs because "roadmap
STATUS semantics" is on the never-auto-fix list and the whole section was being read as covered
by it. The refreshable part is a **live snapshot**, not a semantic. Recorded in the doc itself so
the next run does not re-argue it.

**F6 — machine health items outside my lane.** `watcher clone: branch=main dirty=3` (the sweep's
own comment: "NOT clean-on-main; the watcher may refuse to start") and an orphaned worktree
`C:/po-vg` at `23c91ba9 [fix/no-rebase-while-checks-run]`, **dirty=1, 54 h old, holding
uncommitted work** — `git worktree remove` will refuse it and `--force` would discard it.
→ **DISPATCHED → Station 03** (machines are 03's, report-only for everyone else). Do NOT prune
`C:/po-vg` blind; list it first (`git -C C:/po-vg status --porcelain`) and preserve or commit.

**F7 — my own instrument lied mid-run, and I am recording it because the near-miss is the
lesson.** I converted the sweep with `iconv ... > /tmp/sweep.txt`; the write was refused
(`Permission denied`) but the **subsequent `wc -l` and `tail` succeeded against a pre-existing
`/tmp/sweep.txt` left by an earlier session**, so I read a 2026-09-05T08:09:27Z sweep while
believing I was reading the 14:13:02Z one — including its §7 verdict. The failure was loud and I
still read past it, because the next command answered. Re-measured against the correct capture:
both runs said `SAFE TO ACT`, so nothing downstream was wrong, but that is luck, not method.
→ **ACTIONED** (every sweep claim in this breadcrumb is re-read from
`/sessions/<id>/sweep.txt`, whose header and footer both stamp `2026-09-06 14:13:02Z`).
The general rule, already in DOCTRINE §7: a failed write followed by a successful read is a
read of *something else*. Never write scratch to a shared `/tmp` name.

## WHAT I DID NOT DO

- **Did not re-merge sot/04's generated section** (F4) — deliberate, one reconcile PR per run,
  and two schema PRs are in flight.
- **Did not run audit steps 6 and 7 in full** — model↔migration↔code coherence across 294
  models, and the sot/01 module-registry cross-check. Both are multi-hundred-file sweeps that do
  not fit inside this run's budget alongside the burn-down, and neither is time-critical: they
  report only, and nothing on the board is waiting on them. Marked `[CANNOT MEASURE this run]`
  rather than inferred. Next 05 run should take step 6 first — it is the one that can surface a
  real defect.
- **Did not touch the `settings-restructure-sot-nav-reconcile` backlog item**, which is named
  "STATION 05 SoT-KEEPER ONLY". Its gate is not satisfied: the sweep at 14:13:02Z — *after*
  #1716 merged at 13:13Z — still lists it under "still blocked (gate not yet satisfied)", i.e.
  SLICE 14 / `MapLocationsPage` is not on `main`. → **DEFERRED**, gate unchanged.
- **Did not arm, merge, label, rebase, or push to `main`.** 05 never arms and never merges.
- **Did not clear any `[STALE]` escalation** the sweep §5 flagged (14 dead refs across
  `agent-authored-rule-2-clearance-2026-09-04.md`, `hourly-board-pr-rebases-...`, etc.). Those
  live in gitignored `needs-marco/` and clearing them is 00's collect, not 05's.
- **Did not use the `sot-ref-allow` marker** to clear the last baseline entry, although it would
  have made CI green in one line. The marker's recorded meaning is "target is correct but
  structurally absent from `main` by design (gitignored)". This target was **deleted**, and the
  citation around it was **false**. A marker there would have bought a green check by
  permanently exempting a wrong statement — the RULE 1 "future" half — and would have set the
  precedent that any deleted-file citation gets a marker.
- **Did not touch Azure / Entra / SharePoint.** Absolute.

---

**This breadcrumb ships inside its own PR**, which is the tracked home the contract prefers, so
Station 00 does not need to sweep it out of the dev tree.
