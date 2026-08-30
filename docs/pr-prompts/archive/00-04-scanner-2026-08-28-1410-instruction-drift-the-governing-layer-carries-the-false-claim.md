# Station 04 — Scanner | 2026-08-28T14:10:28Z–2026-08-28T14:35Z

## GROUND

```
UTC            2026-08-28T14:10:28Z
origin/main    82ba8538              (git fetch origin +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 82ba8538       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                     (<!-- station_doc_version: 1 -->)
```

Versions AGREE — this run was **not** read-only-degraded. Desktop Commander reached the box on the
first call (`start_process`, `powershell.exe`, PID 23292): this is a **SIGHTED** run, not a quiet
blind one.

**Sweep this run: `instruction-drift`** — `node scripts/pipeline/next-sweep.mjs` returned
`SWEEP: instruction-drift (rotation position 4 of 4; previous run: 2026-08-28T10:10:29Z)`.
Rotation advanced to `last_index=3 last_run_utc=2026-08-28T14:10:58Z` and read back from disk.

⚠️ `origin/main` has **not moved in four hours** — `82ba8538` is the same SHA Station 04 measured at
10:10Z. Last commit: `82ba8538 2026-08-28 20:06:06 +1000 docs(board): sweep up five files that
existed only on one disk (#1376)`. One PR open (#1377, RED), 0 armed.

---

## WHAT I MEASURED

**[MEASURED] Version parity — CLEAN, 5 of 5, and the governing layer is byte-proven.**
Every scheduled bootstrap declares `station_doc_version=1`; every repo station doc declares
`station_doc_version=1, contract_version=1`. All five `SKILL.md` files carry mtime
`2026-08-24T22:54:22Z` (one clean-up, not five drifting edits). `Get-FileHash -Algorithm SHA256`
on `C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md` and on the Cowork `…\uploads\SKILL.md`
named in this run's `<scheduled-task file=…>` attribute both returned
`2F34D1E53EF51951F823AC39889750947AC8BD2033EC53E30DBB4756A80D4816` — **identical bytes**. The
inlined copy is faithful; there is no third drifting layer.

**[MEASURED] `lint-station.mjs` — ADMIT, exit 0, all 7 docs.** One standing warning, unchanged since
2026-08-27: `04-scanner.md ! names a Windows path outside the known folder map: C:\po-scan-`.

**[MEASURED] Path resolution — 109 distinct repo-relative paths extracted from `DOCTRINE.md`,
`STATION-CAPABILITIES.md`, the 6 station docs and the 5 bootstraps; 27 failed to resolve, of which
23 are extractor noise (template stems such as `docs/pr-prompts/00-`, shorthand such as `sot/05`) or
documented by-design absences.** Controls: `existsSync(docs/pipeline/DOCTRINE.md)=true`,
`existsSync(docs/pipeline/NO-SUCH-FILE.md)=false`. The genuine residue is exactly the F1–F4 set the
2026-08-27T22:10Z run already dispatched — see F2 below.

**[MEASURED] `git check-ignore` on `docs/qa/`.**

```
git check-ignore -v docs/qa/               -> (no output, non-zero) = NOT IGNORED
git check-ignore -v docs/qa/anything.md    -> (no output, non-zero) = NOT IGNORED
git check-ignore -v docs/qa/qa-findings.md -> .gitignore:107:docs/qa/qa-findings.md
git check-ignore -v docs/qa/qa-checklist.md-> .gitignore:106:docs/qa/qa-checklist.md
NEG CONTROL: git check-ignore -v node_modules/x -> .gitignore:1:node_modules
git ls-files docs/qa                       -> 6 tracked files
```

`.gitignore:104-110` is a **six-line list of individual files**, not a folder rule. The instrument
answers in both directions, so neither the positive nor the negative reading is a blind grep.

**[MEASURED] Suspected mojibake in two HOLD prompt bodies was the CONSOLE, not the file.**
PowerShell rendered `DEFECT 1 \ufffd?"` in both station-doc HOLDs. Decoded strictly with python3:
`U+FFFD count = 0`, `â€ sequence count = 0`, sample decodes as `DEFECT 1 — `. **DOCTRINE §9.3
trap #2 is still exactly as documented, and it caught me mid-run.** No corruption finding was filed.

**[MEASURED] Breadcrumb landing backlog has drained.** 92 breadcrumbs on disk, **4 untracked** on
`origin/main` (all written today); the 2026-08-27T22:10Z instruction-drift breadcrumb **is now
tracked**. The 38-deep backlog reported on 2026-08-27T22:22Z is gone — #1374's routing-vs-mention
fix worked. Control: tracked-set size 516.

**[INFERRED] 06-pr-master.md still has no scheduled bootstrap directory.** Present as a repo doc
(v1), absent from `C:\Users\Marco\Claude\Scheduled` (folders: 00, 02, 03, 04, 05,
`weekly-security-audit`, `_retired-2026-08-18`). **Already ESCALATED 2026-08-26T16:09Z — not
re-raised**, recorded only so its absence from FINDINGS is not read as a fix.

---

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced to `last_index=3`,
  `last_run_utc=2026-08-28T14:10:58Z`, `last_station=04-scanner`. Read back from disk after writing.
- This breadcrumb, written at a **tracked** path.
- Four scratch scripts under `C:\po-sup-fix-scripts\` (sanctioned scratch, outside the repo).
- **No board mutation. Nothing armed, disarmed, renamed, moved or deleted. No PR touched. No commit,
  no push. No prompt staged** (see WHAT I DID NOT DO — the cure is already staged twice over).

---

## FINDINGS

### F1 — The layer that GOVERNS a scheduled run carries a false claim; the layer an agent can fix carries the correct one. S2.

All five scheduled bootstraps say, at line 84, byte-identically:

> Never `docs/qa/` - gitignored at `.gitignore:107`, and it swallowed a real finding for nine days.

`[MEASURED]` **`.gitignore:107` ignores exactly one file — `docs/qa/qa-findings.md`.** The folder is
not ignored and carries **6 tracked files on `origin/main`**, including
**`docs/qa/sot-refs-baseline.json`**, which `CLAUDE.md` declares a live CI baseline that "may only
SHRINK" and that Station 05 is burning down. The warning's *substance* is right — writing a finding
into `qa-findings.md` does lose it — but its *stated reason* is wrong in the direction that
misleads: a station that believes the folder is gitignored also believes the sot-refs baseline is
untracked and its silence meaningless. That is DOCTRINE §9.6 ("an empty result is not an empty
world") arriving pre-installed in the instruction set.

The repo station docs are, by contrast, **almost entirely correct** — they name
`qa-findings.md` at `:107` and `qa-checklist.md` at `:106`, both true. Exactly one repo line
overstates: `docs/pipeline/stations/04-scanner.md:205`, "`docs/qa/` state files (all gitignored)".

**Why this is the finding and not a nit:** STATION-CAPABILITIES §1 establishes that the scheduled
`SKILL.md` is the layer that governs a scheduled run and that **an agent cannot edit it**. So the
error sits where no station can reach it, while the correct text sits where every station can. Two
HOLD prompts already stage the repo-side cure and both lint **ADMIT exit 0** at `82ba8538`:

- `pr-station-contract-breadcrumb-validator-and-qa-claim-HOLD.md` (size 8) — edits the
  `station-contract v1` canonical block in all six station docs plus `_canonical-blocks.json`,
  explicitly to "stop asserting `docs/qa/` is untracked".
- `pr-station-docs-wrong-wrapper-and-false-gitignore-claim-HOLD.md` (size 2) — `done_when` includes
  `! grep -q "state files (all gitignored)" docs/pipeline/stations/04-scanner.md`, i.e. it kills
  `:205` exactly.

**Neither can touch the five bootstraps.** Landing both leaves the pipeline in the worst available
state: the reviewable layer correct, the governing layer still wrong, and the disagreement now
invisible because the repo no longer contains the false sentence to compare against.

**ESCALATED — Marco, one question, and it is a paste not a decision.**
When 00 arms those two HOLDs, line 84 of all five files under `C:\Users\Marco\Claude\Scheduled\*\SKILL.md`
needs the same one-line correction. Replacement text, ready to paste verbatim:

> `Never write findings to `docs/qa/qa-findings.md` or `docs/qa/qa-checklist.md` - both are gitignored (`.gitignore:106-107`) and one swallowed a real finding for nine days. The `docs/qa/` FOLDER is tracked; `docs/qa/sot-refs-baseline.json` is a live CI baseline.`

RULE 1 order:

1. **Correct all five bootstraps by hand when the HOLDs land** (complete + additive — both layers
   end up true, nothing is lost, and the next `instruction-drift` sweep has nothing to find here).
2. *(fails the "future" half)* Land the HOLDs only. Immediately correct, but re-opens the same drift
   the next time anyone reads a bootstrap, and removes the evidence that would catch it.
3. *(fails both halves)* Change the bootstraps to stop naming `docs/qa/` at all. Loses the real
   warning that earned its place over nine days.

### F2 — Every finding dispatched to Station 00 by the last instruction-drift sweep is still unfixed 16 hours and ~7 supervisor runs later. S2 — this is a channel finding, not a content one.

`[MEASURED]` at `origin/main:82ba8538`, `git show`:

| Dispatched 2026-08-27T22:10Z | State now |
| --- | --- |
| F1 `03-machine-minder.md` names `triage-state.md` in 5 places; `00-supervisor.md:352` says the file does not exist | **5 occurrences STILL PRESENT** |
| F2 `04-scanner.md:159` rebuilds from `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` | **STILL PRESENT** (file absent on disk AND absent from `origin/main`) |
| F4 `02-board-driver.md:235` branches on a `docs/design` PR | **STILL PRESENT** (`docs/design` absent on disk and on main) |
| F5 `lint-station.mjs` warns forever on `C:\po-scan-` inside a SUPERSEDED comment block | **STILL PRESENT** (4 occurrences) |

The *reporting* channel is working — that breadcrumb is now tracked on `origin/main`, so 00 has had
it. What is not happening is the three-line docs PR it asked for. This is the second consecutive
instruction-drift sweep to measure the same four defects; a third would be pure cost.

`triage-state.md` is the one with teeth: 03's "has this root cause already burned a fix attempt?"
check reads a file that has never existed and answers "no" forever, and its usage-limit parking note
is written for a reader 00 has documented as absent.

**DISPATCHED** — Station 00. One docs-only PR, four one-line edits, all four with exact before/after
text already written out in
`docs/pr-prompts/00-04-scanner-2026-08-27-2210-instruction-drift-triage-state-contradiction.md`
(F1, F2, F4, F5). Transcription, not re-diagnosis. **If 00 cannot land it this cycle, say so in a
breadcrumb** — a silently-deferred dispatch is indistinguishable from a lost one, which is the
failure this whole channel exists to prevent.

### F3 — `next-sweep.mjs` reports a file that exists as "missing", and exits 1. S3.

`[MEASURED]`, matched pair, same machine, same minute:

```
cwd=C:\po-sup-fix-scripts : node C:\ProjectOperations2\scripts\pipeline\next-sweep.mjs
  -> REJECT  docs/pipeline/sweep-rotation.json is missing — the rotation has
             no state, so "rotate" cannot mean anything          (exit 1)
cwd=C:\ProjectOperations2 : node scripts\pipeline\next-sweep.mjs
  -> SWEEP: instruction-drift  (rotation position 4 of 4)        (exit 0)
```

`next-sweep.mjs:19` hardcodes `const FILE = 'docs/pipeline/sweep-rotation.json'` — a **cwd-relative**
path — and `:26` turns a failed `existsSync` into a claim about the world: *"the rotation has no
state"*. The file was present and valid both times. The script's own header comment says "Run from
the repo root", but `04-scanner.md` orders `node scripts/pipeline/next-sweep.mjs` with no cwd
instruction, and the message a station actually sees invites exactly one wrong conclusion: that the
rotation state has been deleted. A station that believed it would either re-run a sweep out of turn
or stop rotating.

This is the §7 shape in miniature — a failed lookup wearing a finding's clothes — in the one script
whose entire purpose is to stop coverage from narrowing silently.

Fix, RULE 1 order:

1. **Resolve the path from the module's own location**, not from `cwd`:
   `const FILE = fileURLToPath(new URL('../../docs/pipeline/sweep-rotation.json', import.meta.url));`
   Complete and additive — the script works from any cwd, no caller changes, no state touched.
2. *(fails the "future" half)* Change only the message to "run me from the repo root". Honest, but
   the next caller still gets an exit 1 it did not earn.

**DEFERRED** — real, small, and not urgent: every station that has hit it so far `cd`s first. It
becomes urgent the moment `next-sweep.mjs` is called from a wrapper or a scheduled action rather
than typed by an agent that happened to be in the repo root. Fold it into the F2 docs PR only if
00 is comfortable touching a `.mjs` in the same shipment; otherwise it wants its own one-line prompt.

### F4 — DOCTRINE §9.1 and §9.3 both re-confirmed live this run, unprompted. No drift.

`[MEASURED]` §9.1 "streamed output PAUSES on lines starting with `#`" fired on the HOLD-lint script
(`🔄 Process 7844 is waiting for input (detected: "#")`); reading on with explicit offsets returned
all 101 lines and exit 0. §9.3 "`Get-Content` reports FALSE MOJIBAKE" fired on two prompt bodies and
was disproved by decoding the bytes (see WHAT I MEASURED).

**DEFERRED** — nothing to fix. Recorded so the next `instrument-honesty` run can spend its budget on
the §9 traps that have *not* been re-confirmed recently, rather than these two.

---

## WHAT I DID NOT DO

- **Did not stage a `-HOLD` prompt.** My lane permits one, and I deliberately did not use it: the
  repo-side cure for F1 is **already staged twice**, both ADMIT exit 0, and the queue carries 82
  HOLDs at depth 1. An 83rd covering ground two existing prompts already cover is noise, and it
  would compete with them for the arming slot. What F1 needs is arming plus a Marco paste, not a
  third author.
- **Did not edit `00-supervisor.md`, `02-board-driver.md`, `03-machine-minder.md`, my own
  `04-scanner.md`, or `next-sweep.mjs`.** All are one-line fixes I could write; landing them means a
  branch and a push in the shared dev tree where the watcher runs — outside my lane.
- **Did not touch `C:\Users\Marco\Claude\Scheduled\*`.** Read-only. F1's correction is Marco's paste.
- **Did not commit or push.** This breadcrumb and the advanced `sweep-rotation.json` are left on disk
  for Station 00 to sweep up — 04 does not open PRs.
- **Did not quote `status-sweep.ps1`'s trunk colour or verdict into any claim.** I ran it (exit 10)
  and used it only to locate things I then measured directly.
- **Did not re-raise** 06's missing scheduled bootstrap (ESCALATED 2026-08-26T16:09Z), the 21 HOLDs
  linting exit 3 (Station 04, 2026-08-28T10:10Z), the diverged watcher clone (dispatched to 03,
  2026-08-28T06:23Z) or the `lint-prompt.mjs` block-scalar collapse (Station 04, 2026-08-28T10:10Z).
  All open, none new.
- **Did not touch any `/sot/` file, any PR, or anything Azure / Entra / SharePoint.**

---

## LATE ADDENDUM — measured 14:24–14:27Z, after FINDINGS were written. Read this first.

**The board moved under me mid-run.** `[MEASURED]` `origin/main` is now **`1791c91a`** —
`docs(board): sweep up three breadcrumbs, the sweep rotation and 04's block-scalar HOLD (#1378)`.
The GROUND stamp above remains true as of 14:10:28Z; everything in FINDINGS was measured at
`82ba8538` and F2's four defects are docs Station 00 has not touched, so they stand. Dev tree HEAD is
still `82ba8538`, i.e. now one commit behind.

**A1 — 🔴 `pr-station-contract-breadcrumb-validator-and-qa-claim` WAS ARMED DURING THIS RUN, WITHOUT
THE PASTE F1 ASKS FOR. ESCALATED, and it is the reason to read F1 now rather than next cycle.**
`[MEASURED]` 14:24:33Z: `git diff --cached --name-status` carries
`R100 …-qa-claim-HOLD.md → …-qa-claim-ready.md`; on disk the HOLD is **gone** and the `-ready.md`
**exists**; `*-ready.md` at depth 1 = **1** (was 0 at 14:11Z), `*-HOLD.md` = **81** (was 82).
⚠️ Its mtime reads `2026-08-28T08:12:35Z` — that is the **source file's** mtime preserved by the
rename, not the arm time. The arm happened inside the last ~13 minutes.

This is the size-8 prompt that rewrites the `station-contract v1` canonical block in all six station
docs to stop asserting `docs/qa/` is untracked. **Arming it is correct work.** What F1 establishes is
that landing it *alone* leaves line 84 of the five `C:\Users\Marco\Claude\Scheduled\*\SKILL.md`
bootstraps still saying "Never `docs/qa/` - gitignored at `.gitignore:107`" — and removes from the
repo the sentence a future `instruction-drift` sweep would have compared against. **Marco: the
one-line replacement text is in F1 above; it needs pasting into all five files when this PR merges.**
I did not touch the arm, the rename or the files — 04 is read-only on the board.

**A2 — 🔴 #1378 committed `sweep-rotation.json` at the OLD value, so the rotation did not turn.**
`[MEASURED]` `git show origin/main:docs/pipeline/sweep-rotation.json` → `"last_index": 2`,
`"last_run_utc": "2026-08-28T10:10:29Z"`. Local working copy → `"last_index": 3`,
`"last_run_utc": "2026-08-28T14:10:58Z"`, still ` M`. `git ls-tree -r origin/main -- docs/pr-prompts`
does **not** contain this breadcrumb. So `#1378` swept the *previous* run's rotation state and left
mine behind. **On `origin/main` the rotation still points at `instruction-drift`, and the next
Station 04 run will repeat this sweep for a third consecutive time** unless this breadcrumb and
`docs/pipeline/sweep-rotation.json` are committed **together**. That is precisely the failure mode
the file's own `_why` warns about, now observed rather than predicted.
⚠️ A `git reset --hard` in the dev tree would also discard the pending advance. **DISPATCHED —
Station 00: commit both files in one PR, and check `git diff --cached --name-status` first, because
an arming `R100` is sitting in the shared index right now (§9.2).**

**A3 — board, re-measured 14:27Z (decays).** OPEN = **2**: **#1377** (`do-not-merge`, routed to
Marco, one red gate — RULE 2 binds) and **#1379** `docs(sot): burn three refs off the sot-refs
baseline + record the local-vs-CI divergence`, **no labels**, branch `docs/sot-refs-burndown-2026-08-28`
(Station 05's burndown; not mine to judge). ARMED = 1 (A1).

---

**This breadcrumb is UNTRACKED until a board PR commits it. Station 00: sweep it up.**
`docs/pipeline/sweep-rotation.json` is modified and must be committed **with** it, or the next
Station 04 run repeats `instruction-drift` and the rotation silently stops. Three other breadcrumbs
were also uncommitted at 14:10Z (00's 1009, 1210 and 1409 runs) plus Station 04's own 1010 run —
and 04's 10:10Z run additionally left `pr-lint-frontmatter-block-scalar-collapse-HOLD.md`
uncommitted, which cannot be armed until someone commits it.
