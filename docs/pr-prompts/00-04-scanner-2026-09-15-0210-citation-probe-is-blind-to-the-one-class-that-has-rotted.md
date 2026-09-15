# Station 04 — Scanner | 2026-09-15T02:10Z–2026-09-15T02:5xZ

## GROUND

```
UTC            2026-09-15T02:10:31Z
origin/main    25db3c36            (fetch --prune, then rev-parse)
dev tree       main @ 25db3c36     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md)
bootstrap      1                   (C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md)
```

Versions AGREE — this run was read/write within lane, not forced read-only.
Sweep this run: **instruction-drift** (rotation position 4 of 4; previous 2026-09-14T22:11:34Z).
Fresh negative-control needle, minted this run and SPENT by this file: `zzQq04Needle20260915T0211`.

## WHAT I MEASURED

**Transport.** SIGHTED. Desktop Commander `start_process` shell `powershell.exe` → PID 21552,
first command returned `2026-09-15T12:10:31.8548264+10:00`. [MEASURED]

**Device-bridge git guard — INSTALL FAILED, reported as the contract requires.** [MEASURED]
`bash $HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh` never reached the script.
Last line, verbatim: `source path /mnt/.virtiofs-root/shared/c/Users/.../outputs is under Plan9
share "c" which is not mounted … A Windows update released September 8 prevents Claude's workspace
from reaching your files.` The whole VM transport is down, so there is no VM-side `git` for the
guard to guard. Per PREFLIGHT this is a FINDING, not a STOP. Already on file as
`needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md` — re-confirmed, NOT re-raised.

**Binding documents read in full from a tree proved equal to `origin/main`.** [MEASURED]
`git diff --numstat origin/main -- <path>` returned EMPTY for all three of `04-scanner.md`,
`DOCTRINE.md`, `STATION-CAPABILITIES.md`, so the working copy is byte-equal to `origin/main` and
the `git show` requirement is satisfied by reading it. DOCTRINE 2505 lines, STATION-CAPABILITIES
514 lines, 04-scanner 515 lines — all read end to end.

**`status-sweep.ps1`** captured to a file (it returns early and hides its own section 7 otherwise).
[MEASURED] The capture was **145,284 bytes opening `FF FE`** — the `*>` UTF-16LE trap, decoded
`utf16le` in node exactly as DOCTRINE §9.3 prescribes. Section 0 controls both pass. Section 7:
`SAFE TO ACT`. Board: 3 open (#1949, #1948, #1947), armed 2, watcher RUNNING pid 18940.

**Live task list, from the scheduled-tasks MCP and never from a folder listing.** [MEASURED]
**FOUR** enabled tasks — `00-supervisor` `5 * * * *`, `04-scanner` `0 */4 * * *`,
`05-sot-keeper` `10 0 * * *`, `03-machine-minder` `0 9 * * *` — plus `weekly-security-audit`
`30 7 * * 1` **enabled: FALSE**, `lastRunAt 2026-09-06T21:32:44Z`. `Scheduled\` holds **11**
`SKILL.md` files on disk.

**Version integrity — clean, all five station bootstraps.** [MEASURED]
Each declares `station_doc_version: 1`; each points at exactly one station doc; each of those
resolves and declares `1`. `MATCH=true` on 5 of 5. All five bootstrap mtimes are
`2026-09-01T00:07:44Z`. The 04-scanner bootstrap served to this run is content-identical to the
copy on disk.

**`lint-station.mjs` → exit 0.** [MEASURED] `ADMIT: all 8 docs clean`, plus
`ADMIT .claude/agents/*.md (9 agent definitions, encoding clean)`. Canonical blocks intact.

**Path resolution across the ten binding documents.** [MEASURED] 223 unique repo-relative refs,
**12 dangling, 0 unexplained**: `docs/qa/.qa-run.lock` ×7 (a runtime lock, absent between runs by
construction), `apps/web/.env.local` (local env, gitignored), `docs/pr-prompts/00-00-...md` (a
prose template, not a path), `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` (deleted in the
2026-08-17 cleanup — 04's own station doc already records it as absent), and
`docs/pr-reviews/pr-1850-review.md` / `pr-1852-review.md` (DOCTRINE cites these as the two
**clone-side** untracked files the sweep counted, so their absence from the dev tree is the point).
POSITIVE control `docs/pipeline/DOCTRINE.md` → exists; NEGATIVE control, the minted needle as a
filename → does not exist.

**Every `<file>:<NNN>` citation resolved by hand.** [MEASURED]
`start-watcher.ps1:160` → `PR_WATCHER_AUTO_MERGE_POLICY = "tests-docs"`, anchor found at line 160,
`MATCH=true` (POSITIVE control — the instrument resolves a correct citation correctly).
`pr-gates.mjs:327` → a bare `{`. `.gitignore:76-83` → the eight `docs/pr-prompts/` sink rules,
correct. `.gitignore:75` → `docs/pr-prompts/*-ready.md`, correct. `.gitignore:28` → `.claude/`,
correct. `.gitignore:107-111` → `!Claude Design/docs/`, `!Claude Design/assets/`,
`Claude Design/assets/*`, `!Claude Design/assets/routes.js`, `!Claude Design/proposed/` — **wrong**;
the five QA sinks are at **115–119**, under the `# Overnight-QA scheduled task` anchor at **113**.

**Two-regex comparison of the citation probe.** [MEASURED, corpus = 5 bootstraps + 4 binding docs]

| corpus member | extension-keyed | dotfile-tolerant | missed by the extension-keyed form |
|---|---|---|---|
| `BOOT:00-supervisor` | 0 | 1 | `.gitignore:107-111` |
| `BOOT:02-board-driver` | 0 | 1 | `.gitignore:107-111` |
| `BOOT:03-machine-minder` | 0 | 1 | `.gitignore:107-111` |
| `BOOT:04-scanner` | 0 | 1 | `.gitignore:107-111` |
| `BOOT:05-sot-keeper` | 1 | 2 | `.gitignore:107-111` |
| `DOCTRINE.md` | 5 | 7 | `.gitignore:76`, `.gitignore:75` |
| `STATION-CAPABILITIES.md` | **0** | 1 | `.gitignore:28` |
| `stations/04-scanner.md` | **0** | 1 | `.gitignore:76-83` |
| `stations/05-sot-keeper.md` | **0** | 2 | `.gitignore:76-83`, `.gitignore:75` |
| **TOTAL** | **6** | **17** | **11** |

Controls: NEGATIVE, the freshly minted needle across four of those files → **0**; POSITIVE,
`.gitignore:<N>` present → **4 of 4**. A first attempt at the negative control was badly
constructed — it fed the needle a synthetic `:1` suffix and of course matched. It is reported here
as unusable rather than quoted as a result; the re-run above is the one that counts.

## WHAT CHANGED

`docs/pipeline/sweep-rotation.json` — advanced to `last_index=3
last_run_utc=2026-09-15T02:10:31Z`, read back ` M docs/pipeline/sweep-rotation.json`.
**LEFT DIRTY IN THE DEV TREE ON PURPOSE. Station 00 commits it — 04 may not.**
`git diff --cached --name-status` was EMPTY before and after, so nothing of another chat's is
staged and no pathspec commit was needed.

Nothing else. No board mutation, no arm, no merge, no label, no prompt staged, no `/sot/` touch.

## FINDINGS

### F1 — The citation-anchor probe DOCTRINE §9.5 prescribes is structurally blind to the one citation class that has actually rotted, and its per-document prediction reads SATISFIED while being false. S3.

`CITATION_PROBE_BLIND_TO_DOTFILES_V1`

§9.5's falsifying probe is *"extract every `<file>:<NNN>` form from the ten binding documents and
resolve each"*, and its 2026-09-11 correction states the prediction **per document**: `03`→0,
`05`→0, `CLAUDE.md`→0, `STATION-CAPABILITIES`→0, `DOCTRINE`→its `start-watcher.ps1:160` uses only.
Implemented the natural way — keyed on a file extension — that prediction is **satisfied exactly**,
and I confirmed it: 6 citations, all in DOCTRINE, all quotations of retired ones plus the legitimate
survivor.

**It is false.** `.gitignore` has no extension, so an extension-keyed form cannot see it. The
dotfile-tolerant form finds **11 more**, four of them inside the binding documents the prediction
covers: `STATION-CAPABILITIES.md` carries `.gitignore:28`, `stations/05-sot-keeper.md` carries
`.gitignore:76-83` and `.gitignore:75`, `stations/04-scanner.md` carries `.gitignore:76-83`.

**Nothing is broken today** — I resolved all four and all four are correct. That is precisely why
this is worth writing down: they are live raw line-number citations of the exact class that has
already rotted **twice** (2026-08-30 off by one, 2026-09-06 off by eight), sitting in the documents
every station is told it can trust, and the prescribed probe reports zero of them. The rule that
was meant to remove this class from the binding docs was applied only to the citations the probe
could see.

**The compounding half.** `needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`
ITEM 2 asks Marco for a CI check in `lint-station.mjs` that validates every `<file>:<N>` citation
against the token its sentence claims. Built with an extension-keyed regex — the obvious
implementation, and the one this run wrote first — **that check is born blind to `.gitignore:<N>`,
which is the entire class that motivated it.** That escalation's own ITEM 2 already records the
cousin of this failure: *"the value query cannot enumerate the class."* This is the same mistake one
level up, in the class query itself.

**RULE 1, both halves.** The complete-and-additive fix is to state the probe's regex explicitly and
dotfile-tolerantly in §9.5 and in ITEM 2 — it removes the blind spot permanently, it changes no
behaviour and touches no data, and it costs one sentence in each place. The alternative, converting
the four in-doc `.gitignore:<N>` citations to anchors without fixing the probe, is complete for
today and **fails the future half**: the next insertion re-rots them and the probe still cannot see
it. Renumbering alone fails both halves, and 04 has said so before: *"renumbering is a fix with a
half-life."*

**Falsifying probe:** the two-regex table above. Re-run both forms over the same nine files; if the
extension-keyed form ever returns 17, this finding is wrong and must be re-measured.

**DISPATCHED → Station 00.** Both targets are 00's lane: a `docs/pipeline/` wording change to §9.5,
and an addendum to the `needs-marco/` file it owns, pinning ITEM 2's regex before the check is
built. This is not 04's to write — §9.5 sits inside the hash-gated `instruments v2` canonical block.

### F2 — The five bootstraps still cite `.gitignore:107-111`, and 05's still cites `pr-gates.mjs:327`. Unactioned since 2026-09-06. RE-CONFIRMED, NOT RE-RAISED.

[MEASURED] All five bootstrap mtimes are still `2026-09-01T00:07:44Z` — no paste has happened.
`.gitignore:107-111` resolves to five `Claude Design/` rules, two of them **negations**; the real
sinks are at 115–119. `pr-gates.mjs:327` resolves to a bare `{`; the real anchor is
`const sotRe = /^sot\//;` at 328.

This is exactly `needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` ITEM 1 and
its 2026-09-14 addendum, both already written, both already asked, both waiting on six text pastes
into a layer outside the repo that only Marco should edit. The repo-side copies are already fixed.
I am recording the re-measurement so the age of the ask is visible, and deliberately not opening a
second file for it.

**DEFERRED** — it becomes urgent the moment a station reads one of those citations to decide where
to write a finding, which is the failure that cost nine days once. Nothing this run can do moves it.

### F3 — `STATION-CAPABILITIES.md` tells every reader that `weekly-security-audit` is a live enabled task. It has been disabled since at least 2026-09-14. S3.

`CAPABILITIES_ASSERTS_A_DISABLED_TASK_IS_LIVE_V1`

§1 carries a red headline: *"THERE ARE FIVE ENABLED TASKS AND THE FIFTH IS NOT A STATION"*,
[MEASURED] 2026-09-07, naming `weekly-security-audit` with its cron and `lastRun`. §5 repeats it —
*"a reader counting rows in this matrix would otherwise conclude the live task list is four"* — and
gives it an authority row.

[MEASURED] 2026-09-15T02:1xZ from the scheduled-tasks MCP: `enabled: **false**`, and
`lastRunAt 2026-09-06T21:32:44Z`, i.e. it has not run since the day before that paragraph was
written. **The live enabled count is four, which is the number §5 explicitly tells the reader is
wrong.**

The section's own rule saves a careful reader — *"express every bootstrap sweep's corpus as every
`SKILL.md` behind an ENABLED task … never as the five"*, and *"read the live cron from the MCP,
never from here"*. This run followed it and got four. But the surrounding prose now argues **against**
its own rule with a dated measurement, and §1's whole thesis is that a stale instruction reads
exactly like a current one. The cost is not hypothetical in shape: a sweep that trusts the count
covers a bootstrap behind no live task and reports a corpus that includes a job nobody is running.

`needs-marco/weekly-security-audit-is-off-and-the-task-store-reverts-verified-writes-2026-09-14.md`
asks Marco whether he turned it off. [MEASURED] that file mentions `STATION-CAPABILITIES` **0**
times and `five enabled` **0** times — so the document-drift half is claimed by nobody, which is why
it is filed here rather than folded silently into that escalation.

**Falsifying probe:** read `enabled` for `weekly-security-audit` from the scheduled-tasks MCP. If it
is ever `true`, this finding is wrong and §1 is simply current again.

**DISPATCHED → Station 00.** A `docs/pipeline/` edit, 00's lane. The ask is one clause in §1 and one
in §5 marking the row **disabled as of 2026-09-06, pending Marco's answer**, cross-referencing the
existing escalation — not deleting the row, because the row's purpose is to stop the matrix being
miscounted and that purpose survives the task being off.

### F4 — Version integrity and canonical-block integrity are CLEAN across all five bootstraps and all eight documents. No action.

[MEASURED] 5 of 5 bootstraps declare `station_doc_version: 1` and resolve to a station doc declaring
`1`. `lint-station.mjs` exit 0, `ADMIT: all 8 docs clean`, 9 agent definitions encoding clean. The
bootstrap this run was served is content-identical to the one on disk, so there is no serve-vs-disk
drift this run. 223 unique path references across the ten binding documents, 12 dangling and every
one of the 12 explained above.

This is the sweep's headline result and it is a null one. Recording it explicitly because a quiet
instruction-drift sweep and a *skipped* instruction-drift sweep produce the same silence, and the
station doc is emphatic that the two must be told apart.

**ACTIONED** — verified by the commands and controls quoted above; nothing required changing.

## WHAT I DID NOT DO

- **Did not touch the board.** No arm, no merge, no label, no rebase, no PR. 04 is read-only and the
  sweep verdict was `SAFE TO ACT`, which is permission I did not need and did not use.
- **Did not commit `sweep-rotation.json`.** It is left dirty by design and named under WHAT CHANGED
  above. 00 commits it; 04 committing to the shared dev tree on `main` is the one thing the
  authority matrix forbids outright.
- **Did not edit the five bootstraps**, though I measured them wrong. They are outside the repo,
  outside CI and versioned by nothing; `STATION-CAPABILITIES.md` §1 rules that the repo doc is
  preferred and the drift reported. F2 is already Marco's, twice asked.
- **Did not edit §9.5 myself.** It is inside the `instruments v2` canonical block, hash-gated by
  `lint-station.mjs`; an edit there is a doc PR and 04 does not open PRs.
- **Did not stage a prompt.** The two live findings are wording changes to binding documents and an
  addendum to an existing `needs-marco/` file — 00's lane, not a build. Staging a prompt to edit a
  canonical block would put a hash re-record inside the watcher's build path.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site visual patrol).** The station doc
  is explicit that one named sweep is covered completely rather than a shallow pass over everything,
  and instruction-drift was what `next-sweep.mjs` returned.
- **Did not re-open** the VM-mount outage, the `.gitignore:107-111` pastes, or the
  `weekly-security-audit` off-switch as new escalations. All three have live `needs-marco/` files;
  F2 and the transport note are re-measurements against them.
- **Left alone:** `/sot/`, Azure/Entra/SharePoint, the three orphaned worktrees the sweep flagged
  (including `C:/PR-Master/worktrees/po-vg`, 1 uncommitted file, 15498 min old — 03's), the watcher
  clone, and the 56 `needs-marco/` files section 5 tagged `[FILE]`.

---

**This breadcrumb is UNTRACKED until a board PR commits it. Station 00: sweep it up, along with
`docs/pipeline/sweep-rotation.json`.**
