# Station 00 — Supervisor | 2026-09-08T04:0xZ–2026-09-08T04:1xZ

**ADDENDUM to the 0308 run** (`00-00-supervisor-2026-09-08-0308-…`, landed in `#1807`). Same station,
same run, later measurement. The 0308 breadcrumb had already merged when these were found, so they
are recorded here rather than edited into it.

## GROUND

```
UTC            2026-09-08T04:0xZ
origin/main    8166d5f8            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 8166d5f8     C:\ProjectOperations2   (rev-list --left-right --count = 0	0)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

SIGHTED throughout. `status-sweep.ps1` section 7 read `SAFE TO ACT` immediately before this branch
was cut (0 git processes, no `index.lock` in either tree, no PR touched in 2 min).

## WHAT I MEASURED

**The post-merge fast-forward cure ran, and both documented causes fired in sequence.**

[MEASURED] exactly as `00-supervisor.md` predicts. **Cause one, untracked copies:** 55 status lines
under `docs/pr-prompts` + `docs/pr-reviews`, of which **50** were byte-identical to their
`origin/main` blob (`git hash-object <path>` against `git rev-parse origin/main:<path>`, no pipe) and
**5** were absent from `main` and correctly preserved — `.queue-sync-ledger.txt`,
`queue-watch-state.md`, `pr-watcher-verdict-home-resolver-LOOPING.md`,
`superseded/pr-doctrine-s9-four-false-traps-LOOPING.md`, and one `archive/` subdirectory. **0
differed.** NEGATIVE control, a minted path → `null`; POSITIVE control, `CLAUDE.md` → resolved.

**Cause two, the tracked file another station leaves dirty:** with all 50 deleted, the FF still
refused, and the error named `docs/pipeline/sweep-rotation.json` — Station 04's rotation advance,
which 04 may not commit itself. `git diff --numstat` read **EMPTY** at that moment, so every
instrument that looks for a modification reported nothing wrong. Restored to **HEAD** (not to
`origin/main`) with `git show HEAD:<path>` piped to a node write, then `git add --renormalize` +
`git update-index --refresh`; `--cached` came back EMPTY, so the renormalize staged nothing and no
`git restore --staged` was needed. The FF then succeeded, `0029fcdf..8166d5f8`. All 50 files were
restored from the **new** HEAD; `0 absent from HEAD`.

No `git checkout -- <path>`, no `git clean`, no `reset --hard`, no `stash pop` at any point
(DOCTRINE section 9.2).

**Final tree state, all read-backs:**

```
genuinely untracked (^\?\? )            5   <- the preserved not-on-main files
modified (^ M )                         0
git diff --numstat                      0 rows
git diff --cached --name-status         0 rows
git rev-list --left-right --count       0	0
```

## WHAT CHANGED

This breadcrumb, and nothing else. **No arm, no merge, no label, no unlabel, no source-of-truth edit,
no branch deleted, no worktree removed, no stash dropped, no watcher restart.** `.arming-log.txt` is
unchanged — nothing was armed this run or in the 0308 run.

## FINDINGS

### F8 — a PowerShell `-like '?? *'` filter counts EVERY porcelain status line, because `?` is a WILDCARD

🔴 **The probe reads "untracked" and answers "any status code at all", at exit 0, with nothing empty
and nothing warning.** This is section 7's shape: a correct reading of the wrong quantity.

[MEASURED] 2026-09-08T04:0xZ at `8166d5f8`, immediately after the fast-forward above. The final
read-back `git status --porcelain -- docs/pr-prompts docs/pr-reviews | Where-Object { $_ -like '?? *' }`
returned **55** against a predicted 5 — which reads as *"the cure restored 50 files and left every one
of them untracked"*, i.e. that the cure had failed and the next run's fast-forward was already blocked.

**Both controls, and they disagree in the direction that matters:**

| expression | result |
|---|---|
| `' M x' -like '?? *'` | **True** — a MODIFIED line matched the "untracked" pattern |
| `' M x' -match '^\?\? '` | **False** — anchored regex with the `?` escaped |

PowerShell's `-like` is wildcard matching, in which `?` means *any single character*. So `'?? *'` is
*"any two characters, then a space"* — which every porcelain line satisfies, because the format is two
status columns and a space. **The filter has no discriminating power whatsoever and its output is
always the whole list.**

Re-run with the sound probe (`-match '^\?\? '`, anchored, `?` escaped): **5 genuinely untracked, 50
` M`, total 55.** The 5 are exactly the not-on-main files the cure was designed to preserve, so the
cure had worked perfectly and the instrument said it had not.

⚠️ **The same filter had already been used earlier in this run and happened to be right**, which is
the dangerous half: `git status --porcelain -- docs/pr-reviews | ? { $_ -like '?? *' }` → **48**, used
to build the list of review verdicts to rescue. That answer was correct **by luck** — at that moment no
file under `docs/pr-reviews` carried any status other than `??`, so a filter that passes everything and
a filter that selects `??` return the same rows. Had one review file been modified rather than
untracked, it would have been silently swept into the board PR as though it were new.

🔧 **Never express a porcelain status-code filter with `-like`. Use `-match` with an anchored,
regex-escaped pattern** (`'^\?\? '`, `'^ M '`, `'^R '`), **or compare `$_.Substring(0,2)` to the literal
two characters.** Control any status filter against a line you know carries a *different* code — a
filter that cannot reject anything is indistinguishable from one that selects everything.

⚠️ **Falsifying probe: the two-row control table above.** Re-run both expressions against `' M x'`. If
`-like '?? *'` ever returns False, this finding is wrong.

This belongs in **DOCTRINE section 9.1** beside the automatic-variable and single-quoted-backslash
bullets — it is the same family: a PowerShell literal that is silently reinterpreted as a pattern.
That is a canonical-block edit (`instruments v2`), which must be shipped with its hash re-recorded via
`lint-station.mjs --write-canonical`, so it is a prompt rather than a collect-run edit.

**DISPOSITION: DEFERRED**, with the successor named — a `docs/`-only prompt adding the bullet to
section 9.1 and re-recording the canonical hash. 🔧 **It is also the first `tests-docs`-eligible prompt
this board has had**: its scope is `docs/pipeline/DOCTRINE.md` plus the canonical-block JSON, both
under `docs/`, so unlike all 39 current HOLDs it can enter the auto-merge lane. The 0208 run's F3
measured 0 of 39 eligible and said the situation *"becomes urgent the moment a docs-or-tests-only HOLD
appears, and it should be armed that same run"* — this is that prompt, and staging it is the next run's
first move.

### F9 — the tree was left provably clean, and the EOL smudge was settled rather than left to block a later fast-forward

Restoring 50 files from a blob writes **LF**, while `.gitattributes` `text=auto` means a real checkout
writes **CRLF**. So immediately after the cure the tree held 50 files reading ` M` in `git status`
while `git diff --numstat` read EMPTY and `git hash-object` matched the HEAD blob exactly — content
identical, working bytes not what a checkout would produce. Left alone that is 50 latent fast-forward
blockers, each of which would fire the moment any future PR touches one of those paths.

Settled by rewriting all 50 with CRLF in node and **re-verifying per file** that the clean filter still
yields the HEAD blob: `rewrote 50 files as CRLF; per-file hash mismatches: 0`. The read-back block
under WHAT I MEASURED is the result.

**DISPOSITION: ACTIONED** — verified by that block.

### F10 — the board moved twice more during this run; the 0308 breadcrumb's board figures are a snapshot, not current

[MEASURED] `#1804` **MERGED** (its `.github/workflows/ci.yml` change arrived in this run's own
fast-forward), and a fifth second-lane PR **`#1806`** — *"feat(pipeline): exempt a web prompt that
changes no screen from the design_ref gate"* — opened after the 0308 breadcrumb was written. Open board
at the close of this run: `#1802 #1803 #1805 #1806`, all BEHIND.

This is recorded so the next run does not read 0308's *"four open PRs"* as current. It is also the fifth
and sixth data point for that breadcrumb's F1: the second lane opened **six** PRs in roughly one hour,
consuming none of their prompts. `pr-ci-gate-dead-queue-dir-reads-HOLD.md` is now a **SPENT** prompt
rather than a duplicate-of-open, since `#1804` merged — a future run should confirm that with
`lint-prompt.mjs` exit **3** rather than assuming it.

**DISPOSITION: DEFERRED** — re-measure, never quote. The board is state.

## WHAT I DID NOT DO

- **Did not edit DOCTRINE section 9.1** with F8, though that is where it belongs. It sits inside the
  hash-gated `instruments v2` canonical block; editing it without re-recording the hash fails
  `lint-station.mjs`, and doing that inside a collect run is more than a collect run should carry.
  Named as the successor prompt instead.
- **Did not arm the successor prompt, or write it.** Writing a prompt is Station 06's lane, and the
  arming decision belongs to a run that has re-taken the board — which, as the 0308 run's F2 records,
  must happen at the moment of the `git mv` and not before.
- **Did not re-run the section 10.6 cross-check against the new board.** `#1806` arrived after it; the
  next run must re-take it rather than inherit either run's table.
- **Did not remove `C:\po-vg`** — dispatched to Station 03 in the 0308 breadcrumb, with Station 04's
  hash pair as the evidence that it destroys nothing.
- **Did not touch source-of-truth, Azure, Entra or SharePoint**, and ran no `git` in the watcher clone.

**Needles minted and spent:** `zzQq00N20260908T0410`. Now written into a tracked file and unusable
again.

---

**Validator.** `node scripts/pipeline/check-breadcrumb.mjs` — quoted in the PR.
