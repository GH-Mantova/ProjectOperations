# Station 05 — SoT Keeper | 2026-09-04T14:11Z–2026-09-04T14:25Z

## GROUND

```
UTC            2026-09-04T14:11:04Z
origin/main    b31a242a            (fetched, then rev-parse)
dev tree       main @ 69ae2a4e     C:\ProjectOperations2   (3 behind origin/main, nothing staged)
doc version    1                   (docs/pipeline/stations/05-sot-keeper.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — this run was read-write, not read-only.

**NOT BLIND.** `start_process` shell `powershell.exe` succeeded (PID 19560) after loading the
Desktop Commander schemas via `ToolSearch`. Work was done in a disposable worktree
`C:\po-worktrees\sot05-20260904` off `origin/main`, torn down at end of run.

**Which tree I read in:** the DEV TREE `C:\ProjectOperations2`, never the watcher clone.
Binding docs were verified current with `git diff --numstat origin/main -- <path>` (EMPTY = not
different) rather than a piped hash, per the station contract's unsound-pipe warning.

**No missed occurrence owed.** `check-breadcrumb.mjs --freshness --station 05` → `05 last
2026-09-03T21:54:00Z, 16.3h ago, ok`. I read the AGE, not the verdict: 16.3h is inside ONE cadence
(24h), so no catch-up day was owed. (The `ok` alone would have proved nothing — escalation #23.)

## WHAT I MEASURED

| Claim | Evidence |
|---|---|
| Host reachable | [MEASURED] `start_process` powershell.exe → PID 19560, prompt returned |
| Binding docs current | [MEASURED] `git diff --numstat origin/main -- docs/pipeline/stations/05-sot-keeper.md docs/pipeline/DOCTRINE.md` → EMPTY |
| Schema parses | [MEASURED] `node scripts/data-model/build-relationship-map.mjs --check` → `OK: 293 models, 68 enums, 488 edges`, exit 0 |
| Catalog valid JSON | [MEASURED] `JSON.parse(metadata-catalog.json)` → OK, 712207 bytes. (It was INVALID for four consecutive sweeps historically; it is not now.) |
| **sot/04 NOT drifted** | [MEASURED] sot/04:16 reads `Models: 293 \| Enums: 68 \| FK edges: 488 \| Domains: 23`; generator says 293/68/488 and the TOC lists 23 domains. Stronger probe: sot/04:15 claims schema sha256 `2882e34a59f6`; LF-normalised sha of `schema.prisma` = `2882e34a59f6` (raw CRLF sha = `d7551bc83552`). Exact match ⇒ the generated section is current AND the generator normalises line endings, so the CRLF/CI hazard did not fire. |
| sot-refs before | [MEASURED] `check-sot-refs.mjs` → `total=274 dangling=0 exempt=19 baselined=4 excluded=2`, exit 0 |
| All 4 baseline targets absent from main | [MEASURED] `git cat-file -e origin/main:<path>` → exit 128 on all four. Controls: `CLAUDE.md` → exit 0; `zzz-no-such-file.md` → exit 128. Instrument answers in both directions. |
| The 3 targets were RETIRED, not renamed | [MEASURED] `git log --all --name-status -- <path>`: `tender-scope-drafting.service.ts` **D** in `fc53b24b` (2026-05-24, PR **#212** "[5A.1] Remove legacy 'Draft scope with Claude' path"); `quote-pdf.builder.ts` **D** in `4360f149` (2026-05-25, PR **#221** "[5A.2] Quote PDF — HTML template + migration"); `tender-client-notes.controller.ts` **D** in `eae1c0a8` (2026-08-18, PR **#1165** "retire TenderClientNote code surface (slice 1 of 2)"). |
| No replacement file exists | [MEASURED] `git ls-tree -r --name-only origin/main -- apps/api/src` matching `scope-draft` → 0 and `client-notes` → 0; `estimate-export/pdf/` holds only `tc-text.const.ts`. Control: `apps/api/src/modules/tendering/` → **76** files, so the query is not silently empty (§9.6). |
| Extraction rule (so the fix is not a guess) | [MEASURED] `check-sot-refs.mjs:152` `RAW_REF_REGEX = /`([^`]*)\/([^`]*\.(md\|mjs\|ts\|...))`/g` — a backticked token is a reference only if it contains `/` AND ends in a known extension. A bare filename in backticks is therefore NOT extracted. |
| Watcher ALIVE | [MEASURED] `Get-CimInstance Win32_Process` filtered on `pr-watcher[\\/]index\.mjs` → **1** match, pid **20000**, started 2026-09-04 09:37Z. Control: 25 `node.exe` total — counting by image name would have been wrong (§9.5). |
| Restarter healthy | [MEASURED] `Get-ScheduledTask` → `PO Watcher Keepalive` State=Ready, LastTaskResult=**0**, last run 2026-09-04T14:15Z. It is the ONLY project task present — the four fixtures older docs named do not exist. |
| Queue moving | [MEASURED] newest `docs/pr-prompts/processed/*.log` = `rev-1597-ready.md.log` @ 2026-09-04T13:20:37Z (~51 min before this run); 1897 logs total. |
| Board | [MEASURED] `gh pr list --state open --json ...` (assign-then-count, §9.4) → **4** open: #1598, #1594, #1593, #1589. None labelled. |
| Sweep verdict | [MEASURED] `status-sweep.ps1` @14:12:23Z → **CAUTION**: 2 live station worktrees (`C:/po-bc-ff`, `C:/po-vg`). I complied by using an ISOLATED worktree and a NEW branch only. |

## WHAT CHANGED

**One doc-reconcile PR. One unit of work (today's; no catch-up day was owed).**

1. `sot/06-active-specs.md` — 2 lines changed (`git diff --numstat` = `2 2`), lines 1512 and 1906.
   Both referenced `apps/api/src/modules/tendering/tender-scope-drafting.service.ts` and both
   instructed a future editor to update a `SYSTEM_PROMPT` const for the 4-code discipline
   migration. That file was deleted by PR #212 on 2026-05-24, so the instruction can never be
   carried out. Rewritten to record the retirement and name the PR and commit. The bare module
   name is retained in backticks for provenance; without a `/` it is no longer an extractable
   path reference.
2. `docs/qa/sot-refs-baseline.json` — the 2 entries for that path DELETED
   (`git diff --numstat` = `0 2`; surgical line removal, **not** re-serialised — my first attempt
   used `JSON.stringify` and reformatted every surviving entry, `12 4`. I reverted it and redid it,
   because a burn-down PR should not carry gratuitous churn).
3. This breadcrumb, at a TRACKED path inside this PR.

**Read back and verified after the change:**

- `node scripts/pipeline/check-sot-refs.mjs` → exit **0**, `total=272 dangling=0 exempt=19
  baselined=2 excluded=2`, and the BASELINED list prints **2** lines where it printed 4. The count
  went DOWN, never up.
- `node scripts/pipeline/check-sot-baseline-ratchet.mjs <origin/main copy> <head>` → exit **0**,
  `4 -> 2 baselined entries, no new (sot_file, missing_path) pair. Self-test: 4 cases passed.`
  (My first invocation passed no arguments and printed a usage error at exit 2 — that was a broken
  instrument, not a failing gate, and is recorded here rather than quoted as a result.)
- **No line numbers moved.** The edit is line-for-line, so the surviving baseline entries keyed at
  lines 2240 and 3943 did NOT need re-keying. This was asserted in the edit script, which aborts if
  the line count changes.

## FINDINGS

### F1 — sot-refs baseline burned down 4 → 2

Two entries retired by fixing the `sot/` prose they pointed at, per the burn-down workflow. Neither
was cleared with a `sot-ref-allow` marker: the marker is for a target that is *correct but
structurally absent by design* (gitignored), and a deliberately deleted source file is not that.
Using the marker here would have recorded a falsehood.

**DISPOSITION: ACTIONED** — verified by `check-sot-refs.mjs` exit 0 with 2 fewer BASELINED lines and
the ratchet's own 4-case self-test, both quoted above.

### F2 — `sot/02` tells Marco that PR #895 is open and awaiting his review. It merged a month ago.

`sot/02-roadmap-and-status.md:179` reads: *"**#895 API-key vault SLICE-3** — production-data backfill
+ `resolve()` vault-flip; open, do-not-merge, awaiting your review of the rendered diff."*
`sot/02:108` likewise says *"SLICE-3 open #895"*.

[MEASURED] `gh pr view 895 --json state,mergedAt` → **MERGED, 2026-08-04T05:09:13Z** — 31 days ago.
Same call on the neighbouring roadmap references: #894, #891, #883, #889, #892, #609, #779 are **all
MERGED** too. #895 is not among the 4 currently open PRs.

This matters more than ordinary staleness because the line is addressed *to Marco* and asks him for
an action he cannot take. It is the roadmap's own warning ("lags reality — verify live PRs") firing.

I did **not** auto-fix it: my station doc's allowlist names "roadmap STATUS semantics" as
REPORT-ONLY, and I am not the judge of my own scope (DOCTRINE §2). Options, RULE 1 applied:

- **(a) COMPLETE + ADDITIVE — correct both lines to record the merge, and add the merge date and PR
  state to each roadmap item that names a PR.** Fixes it now and makes the next drift visible,
  because a dated claim can be checked. Passes both halves of RULE 1; documentation only, so no
  data-entry risk. **Recommended.**
- (b) Correct only #895's two lines. Fails the *future* half — the next merged PR re-creates the
  same stale instruction.
- (c) Leave it. Fails both halves; Marco keeps reading a request for review of finished work.

**DISPOSITION: ESCALATED** — one word from Marco ("do (a)") lets the next 05 run land it in a
doc-reconcile PR. I am not guessing his intent about his own roadmap.

### F3 — the 2 surviving baseline entries need a spec judgement I could not make from measurement alone

- `sot/06:2240` sits under the heading **"#### 1.4 Quote PDF pipeline (current state)"** and asserts
  *"File: `.../pdf/quote-pdf.builder.ts` (1173 LOC) — Stack: **PDFKit**"*. PR #221 replaced that
  builder with an HTML template. So an entire "current state" section describes a pipeline that no
  longer exists. Correcting it means describing what #221 actually built — which I have **not**
  measured, and I will not write an architecture claim I cannot evidence.
- `sot/06:3943` is a permissions-table heading for a controller retired by #1165 *slice 1 of 2*.
  Whether the endpoints moved or were dropped depends on whether slice 2 shipped — unmeasured.

Both are one-at-a-time work for a future run, exactly as the burn-down workflow prescribes.

**DISPOSITION: DEFERRED** — becomes urgent if either the baseline stops shrinking for several runs,
or if someone acts on sot/06 §1.4 as though PDFKit were live. The next 05 run should measure what
#221 and #1165 replaced, then burn one down.

### F4 — automation health is NOMINAL; nothing is stalled

Watcher pid 20000 alive by command line, keepalive Ready with LastTaskResult 0, queue processed a
job 51 minutes ago. **Reported explicitly because a dead watcher is the one thing this station must
lead with — and a quiet board and a dead board look identical if nobody names which it was.**

**DISPOSITION: ACTIONED** — measured and reported; nothing to fix.

## WHAT I DID NOT DO

- **Merged nothing, armed nothing, staged no prompt.** 05 never arms and never merges. The 4 open
  PRs were read for roadmap cross-check only; I did not touch, label or rebase any of them.
- **Did not run the map generator to regenerate artifacts.** sot/04 was proved current by the schema
  sha256 match, so a regen would have been churn — and it would have dirtied the SHARED dev tree by
  rewriting tracked `metadata-catalog.json`.
- **Did not edit `sot/02`** (F2) — curated roadmap prose, outside my auto-fix allowlist.
- **Did not touch the 2 surviving baseline entries** (F3) — spec judgement, not deterministic drift.
  "If unsure whether something is deterministic, it is NOT."
- **Did not clear, investigate or remove the 2 live worktrees** flagged CAUTION by the sweep
  (`C:/po-bc-ff`, `C:/po-vg`). Worktree hygiene is Station 03's lane, and `po-vg` is already
  dispatched there.
- **Did not fast-forward the dev tree** (3 commits behind). Shared tree, other chats' index; the
  known `.gitattributes` FF hazard is 03's, not mine.
- **No Azure / Entra / SharePoint of any kind.** Absolute hard stop.
