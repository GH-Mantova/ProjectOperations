# Station 04 — Scanner | 2026-09-06T22:10Z–2026-09-06T22:25Z

## GROUND

```
UTC            2026-09-06T22:10:20Z
origin/main    0c227eeb            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 0c227eeb     C:\ProjectOperations2   (rev-list --left-right --count = 0	0)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE — this run was not read-only on that account.

**Sweep this run: `instruction-drift`** (rotation position 4 of 4, from
`node scripts/pipeline/next-sweep.mjs`; previous run 2026-09-06T18:11:59Z).

## WHAT I MEASURED

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` → PID 34756, prompt returned.
**SIGHTED, not blind.**

**Device-bridge git guard.** [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
last line: `vm-git-guard installed at /sessions/friendly-intelligent-meitner/.local/bin/git - refuses
mounted paths, allows everything else (both controls passed)`. **PASS.**

**Binding documents read from `origin/main`, by the sound form.** [MEASURED]
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY output**, at `HEAD == origin/main`. Per the
PREFLIGHT block, empty numstat is the real answer: the working copy I read IS `origin/main`'s
content for all three. No piped-hash comparison was made (§9.1).

**Sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1` captured to a FILE (it returns early and
hides its own §7 verdict when streamed). §7 verdict: **`SAFE TO ACT`** — no board mutation in
progress, no recent remote activity, no live station worktrees. Board: **1 open PR, `#1713`, CLEAN,
CI 15 pass / 0 fail / 0 pending**; main CI on `0c227eeb` 4 success / 0 failed. `armed (*-ready.md): 0`.
needs-marco 29 · no-pr-opened 109 · failed 41 · blocked 123. Watcher node RUNNING pid 27236,
heartbeat age 46 min, clone `dirty=1`. One orphaned worktree `C:/po-vg` (1 uncommitted file, age
3738 min) — unchanged from the 21:20Z reading, still DEFERRED, still holds work.

⚠️ `status-sweep.ps1` was captured with `*>`, which is PS 5.1's UTF-16LE redirection (§9.3). The
file is readable but is **twice the byte size of its content** — do not hash or byte-compare it.

**A. Bootstrap ↔ station-doc version parity** — [MEASURED] by node over
`C:\Users\Marco\Claude\Scheduled\*\SKILL.md` and `docs/pipeline/stations/*.md`:

| bootstrap | bytes | mtime (UTC) | bootstrap ver | → station doc | doc ver | verdict |
|---|---|---|---|---|---|---|
| `00-supervisor` | 5905 | 2026-09-01T00:07:44Z | 1 | `00-supervisor.md` | 1 | MATCH |
| `02-board-driver` | 5902 | 2026-09-01T00:07:44Z | 1 | `02-board-driver.md` | 1 | MATCH |
| `03-machine-minder` | 5880 | 2026-09-01T00:07:44Z | 1 | `03-machine-minder.md` | 1 | MATCH |
| `04-scanner` | 5841 | 2026-09-01T00:07:44Z | 1 | `04-scanner.md` | 1 | MATCH |
| `05-sot-keeper` | 5816 | 2026-09-01T00:07:44Z | 1 | `05-sot-keeper.md` | 1 | MATCH |
| `weekly-security-audit` | 1982 | 2026-08-17T06:37:17Z | — | names no station doc | — | n/a |

`_retired-2026-08-18` holds no `SKILL.md`. **All five live bootstraps: BOM absent, zero `U+FFFD`,
zero `â€` double-encoding sequences.** All seven station docs declare `station_doc_version: 1`,
`contract_version: 1`.

**B. `lint-station.mjs`** — [MEASURED] `node scripts/pipeline/lint-station.mjs` → **exit 0**,
`ADMIT: all 8 docs clean`, plus `ADMIT .claude/agents/*.md (9 agent definitions, encoding clean)`.
Both canonical blocks (`station-contract v3`, `instruments v2`) hash-verified untouched. The only
`!` lines are the known Windows-path-outside-the-folder-map notes on `DOCTRINE.md` (3) and
`04-scanner.md` (1, the commented-out `C:\po-scan-` worktree recipe).

**C. Path resolution across the binding documents** — [MEASURED] by node over `DOCTRINE.md`,
`STATION-CAPABILITIES.md` and all seven station docs: **368 repo-relative citations checked, 295
resolved, 25 distinct unresolved.** POSITIVE control `docs/pipeline/DOCTRINE.md` → exists.
NEGATIVE control `docs/pipeline/zzQq04Needle20260906T2210.md` → absent.
**All 25 were hand-checked and NONE is a dangling path:**

- 21 are my regex over-capturing prose — trailing sentence periods (`sot/04-data-model.md.`),
  filename *stems* (`docs/pr-prompts/00-`, `docs/pr-reviews/pr-`, `rev-`), and slash-shorthand for
  document numbers (`sot/01`, `sot/02`, `sot/04`, `sot/05`, `sot/01/02/03/05/06`). Every underlying
  real path resolves: `.claude/agents/01-code-writer.md`,
  `apps/api/src/common/permissions/permission-registry.ts`, `scripts/data-model/build-relationship-map.mjs`,
  `docs/pr-prompts/TEMPLATE-sot-reconcile.md`, `sot/04-data-model.md`, `docs/data-model` — all
  `Test-Path` **True**.
- `apps/web/.env.local` and `docs/qa/.qa-run.lock` are **runtime files, legitimately absent** when
  no run holds them.
- `docs/qa/Master-QA-and-Consolidation-Program-Plan.md` is the file `04-scanner.md` itself already
  annotates as deleted in the 2026-08-17 cleanup — cited only to record that citing it was the bug.

Every script `04-scanner.md` names in its `🧰 YOUR SCRIPTS` section resolves: `check-backlog.mjs`,
`check-escalations.mjs`, `check-lessons.mjs`, `lint-prompt.mjs`, `triage-holds.ps1`,
`check-all-drift.ps1`, `check-sot-bytes.mjs`, `check-sot-encoding.ps1`, `gate-eval.mjs`,
`build-relationship-map.mjs`, `visual-smoke.mjs`, `docs/pipeline/SCRIPT-REGISTRY.md`. **Zero
instruction drift of the "names a path that no longer exists" class.**

**D. `.gitignore` citation re-measurement** — [MEASURED] `.gitignore` is 150 lines.
Lines **107–111** are the `Claude Design` negation block
(`!Claude Design/docs/`, `!Claude Design/assets/`, `Claude Design/assets/*`,
`!Claude Design/assets/routes.js`, `!Claude Design/proposed/`). The `# Overnight-QA scheduled task`
comment is at **113**; the five QA sinks are at **115–119**. Lines **76–83** are exactly the eight
`docs/pr-prompts/<state>/` folders `04-scanner.md` cites them for — **that citation is correct.**

**E. Two of my own probes lied, and I am reporting both rather than their answers.**

1. `Select-String -SimpleMatch -Pattern 'C:\\ProjectOperations2\\docs\\pipeline'` returned **0 for
   all five bootstraps**. A PowerShell **single-quoted** string does not process escapes, so `\\` is
   a literal *double* backslash and the needle can never match a Windows path. The same question in
   node (single backslash) returns **3 per file**. Exit 0 both ways, no warning, opposite answers.
2. `Select-String -Path 'docs\pipeline\stations\0*.md' -Pattern 'NEVER from the working copy'`
   returned **0**, because the phrase **wraps a line break** at `04-scanner.md:72–73`. A per-line
   matcher cannot see a sentence that spans lines.

Fresh needles this run — `zzQq04Needle20260906T2210`, `…T2214`, `…T2215`, `…T2216`, `…T2218` — all
returned 0 against their corpora. **They are spent the moment this file lands; mint new ones.**

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — [MEASURED] `node scripts/pipeline/next-sweep.mjs --advance
  --utc 2026-09-06T22:11:26Z` → `advanced: last_index=3 last_run_utc=2026-09-06T22:11:26Z`, exit 0.
  **LEFT DIRTY IN THE DEV TREE ON PURPOSE — Station 00 must commit it; 04 may not.**
- This breadcrumb, written to the dev tree at `docs/pr-prompts/`. **Untracked until a board PR
  sweeps it up.**
- Scratch only, outside the repo: `C:\po-sup-fix-scripts\sweep-04-20260906.txt`,
  `04-instruction-drift-20260906.mjs`, `04-drift-probe2.mjs`, `04-hist-probe.mjs`, `04-nm-control.mjs`.
- **Nothing armed. Nothing merged. Nothing staged. No label touched. No prompt renamed.**
  [MEASURED] `git diff --cached --name-status` before the advance → **EMPTY** (shared index clean).

## FINDINGS

### F1 — the bootstrap STEP-2 defect escalated on 2026-09-05 is UNCHANGED and still live, two days on

[MEASURED] All five live bootstraps still open STEP 2 with a fenced block naming the **working
copy**:

```
34| C:\ProjectOperations2\docs\pipeline\stations\04-scanner.md      <- your instructions
35| C:\ProjectOperations2\docs\pipeline\DOCTRINE.md                <- binding on every station
36| C:\ProjectOperations2\docs\pipeline\STATION-CAPABILITIES.md    <- who may call what, and when
```

Counts per bootstrap: `C:\ProjectOperations2\docs\pipeline` → **3**, `git show` → **0**,
`origin/main` → **1** (the `?plain=1` fallback only). Against them, every station doc's hash-gated
`station-contract v3` block says, at `04-scanner.md:72–73`: *"Read all three — this file included —
from `git show origin/main:<path>`, **NEVER from the working copy in `C:\ProjectOperations2`**."*
Station docs carry `git show` 4–9 times each and `vm-git-guard` twice each; **the bootstraps carry
neither, 0 and 0.**

**The order is the defect.** The corrective clause lives inside the document you have already read
from the forbidden source. This run was safe only because `git diff --numstat origin/main` came back
EMPTY — luck, not method.

Already filed by Station 04 at 2026-09-05T14:10Z
(`archive/00-04-scanner-2026-09-05-1410-every-bootstrap-tells-the-run-to-read-the-working-copy-its-own-station-doc-forbids.md`)
and collected by 00 at 14:45Z as **F3, disposition ESCALATED**, with 00 noting *"this run is itself
an instance"*. The insertion text is already written. Only Marco can paste it — the scheduled-task
layer is the one layer no agent may edit (`STATION-CAPABILITIES.md` §1).

**DISPOSITION: ESCALATED — already open, re-verified live today, no new question.** Nothing for 00
to do but keep it visible. See F2 for why it is not visible.

### F2 — that escalation's ONLY home is an archived breadcrumb, so no instrument can surface it

[MEASURED] over `docs/pr-prompts/needs-marco/` (29 `.md` files): `/working cop/i` → **1 file**, and
it is `arming-log-is-tracked-but-nothing-publishes-it-2026-09-04.md`, an unrelated item. POSITIVE
control `/gitignore:107-111/` → **1 file** (`gitignore-citations-in-the-five-bootstraps-2026-09-06.md`),
proving the instrument reads that directory's contents. NEGATIVE control → **0**.
A wider scan of 517 `.md` files across `docs/pr-prompts/`, `needs-marco/` and `archive/` finds the
bootstrap working-copy phrase in exactly **3** files: `queue-watch-state.md` and **two in
`archive/`** — 04's original breadcrumb and 00's collect. **Zero in `needs-marco/`.**

Its sibling finding from the same class — the `.gitignore:107-111` citation — *did* get a
`needs-marco/` file, so `status-sweep.ps1` §5 lists it every run and Marco has a queue item. The
STEP-2 finding got none. `status-sweep.ps1` §5 reads `needs-marco/`; it does not read `archive/`.
So a finding correctly dispositioned **ESCALATED** is invisible to the one instrument that surfaces
escalations, and its visibility now depends entirely on a future run happening to grep `archive/`.

This is the memory index's own recorded lesson — *"a disposition addressed to a FUTURE RUN outlives
its own fix and bills a later run to re-discover it"* — reached from the other side: here the
disposition was right and the **filing** was incomplete.

**DISPOSITION: DISPATCHED → Station 00.** Give F3-of-2026-09-05 a `needs-marco/` file the way the
`.gitignore` sibling has one, carrying the same paste-ready insertion text 04 already wrote. 00's
lane covers `docs/pr-prompts/`; `needs-marco/` is gitignored (`.gitignore:82`) so this is a
local-disk write, not a tracked-file change, and it arms nothing. **04 did not do it itself:** 04 is
read-only on the board and adding a file that `status-sweep.ps1` reports on is a change to what the
next run is told — outside this station's authority. ⚠️ **Generalise before closing:** any breadcrumb
finding dispositioned ESCALATED whose subject is outside the repo needs a `needs-marco/` file, or it
is not escalated to anyone.

### F3 — `status-sweep.ps1` §5 declares a LIVE escalation DEAD, twice, in tonight's own output

[MEASURED] tonight's §5 block:

```
[STALE] gitignore-citations-in-the-five-bootstraps-2026-09-06.md references #1573 which is MERGED
        -- escalation is DEAD, clear it. Do NOT report it as pending.
[STALE] gitignore-citations-in-the-five-bootstraps-2026-09-06.md references #1576 which is MERGED
        -- escalation is DEAD, clear it. Do NOT report it as pending.
```

`#1573` and `#1576` are the PRs that **CAUSED** the drift — the escalation names them as the
`+8`-line insertions that moved the sinks — not PRs that would fix it. §5 tests only *"is a
referenced PR merged"*, so a well-written escalation that cites its own root cause is
auto-classified dead by construction, and the classification arrives with an imperative.

[MEASURED] the escalation is **not** dead: all five bootstraps still read `.gitignore:107-111` at
line **87** (POSITIVE control: `gitignore` occurs once in each of the five and zero times in
`weekly-security-audit`; NEGATIVE control → 0), and 107–111 is still the `Claude Design` block.
A run that obeys §5 verbatim clears the only queue item Marco has for five wrong bootstraps.

Known class — `pr-sweep-stale-check-retires-live-escalations-HOLD` is already staged for exactly
this, and the standing note says it routes to Marco and must not be armed. This is a fresh,
dated, worked instance to attach to it. The fix is a `scripts/` change, outside 00's merge lane.

**DISPOSITION: DEFERRED.** Real, staged, not mine to run, and nothing broke tonight because no
station acted on the line. **What makes it urgent:** the moment any run actually clears
`gitignore-citations-in-the-five-bootstraps-2026-09-06.md` on §5's say-so — at which point five
wrong bootstraps have no record anywhere Marco reads.

### F4 — a single-quoted PowerShell path needle is a guaranteed zero, and it wears an absence's clothes

[MEASURED] this run, both directions, on the same question — *"do the bootstraps name the working
copy?"*:

| form | result | truth |
|---|---|---|
| `Select-String -SimpleMatch -Pattern 'C:\\ProjectOperations2\\docs\\pipeline'` | **0** on all five | wrong |
| node, `count(t, 'C:\ProjectOperations2\docs\pipeline')` | **3** on all five | right |

PowerShell single quotes do not process escapes, so `\\` is searched as two literal backslashes and
matches nothing on any Windows path. Both exit 0, neither warns, and §9.6 does not fire because the
query "worked". The trap is *specific to this pipeline's habit*: Windows paths are written `\\` in
JSON, in node source and in half the documents stations read, so copying a needle out of any of them
into a single-quoted PowerShell pattern silently inverts the answer. It sits beside §9.1's
`-Include` and `-SimpleMatch`+`[regex]::Escape()` bullets and is not covered by either — those are
about the *path argument* and about *escaping a regex*; this one is about the **quoting of the
literal itself**.

Had I stopped at that reading, F1 would have been filed backwards: *"the bootstraps were fixed"* —
retiring a live escalation, which is F3's failure mode arrived at by a different route.

**DISPOSITION: DISPATCHED → Station 00**, for a §9.1 bullet with the table above.
⚠️ **Cost 00 must weigh before starting:** §9.1 is inside the `instruments v2` canonical block, so
this needs `lint-station.mjs --write-canonical` and all seven station docs shipped in one PR — the
same constraint that pushed 04's 2026-09-05 F2 scoping line into §10.3 instead. If that cost is not
worth one bullet, the honest alternative is to state it in `STATION-CAPABILITIES.md` §3 — **except**
that file's own no-paraphrase rule forbids restating a §9 trap there. **That tension is 00's call,
not 04's**, and it is the reason this is dispatched rather than decided here.

## WHAT I DID NOT DO

- **Did not touch the five bootstraps.** `STATION-CAPABILITIES.md` §1: the scheduled-task layer is
  outside the repo, outside CI, versioned by nothing, and governs every station. Marco pastes.
- **Did not arm, disarm, rename, move or delete any prompt.** `armed` was 0 at 22:11Z and is 0 now.
- **Did not touch `#1713`** — 1 open PR, CLEAN, 15/15 green, carrying a `migrations/` path.
  `classifyPolicyFiles` refuses it on its own clause; it is Marco's and it is not 04's to move.
- **Did not commit `sweep-rotation.json`** — left dirty by contract; naming it here is the handoff.
- **Did not write to `docs/qa/qa-findings.md`** or any of the five gitignored sinks.
- **Did not run Part 0 or Part 2 of the old station brief** (static cross-layer audit, live-site
  visual patrol). The station doc's AUTHORITY section is explicit that the run takes **ONE** named
  sweep and covers it completely, and `next-sweep.mjs` named `instruction-drift`. A shallow pass
  over everything is the failure that rotation exists to prevent.
- **Did not touch `C:/po-vg`** — the orphaned worktree holds 1 uncommitted file; reported, not pruned.
- **Did not run `git` against the mount**, and did not clear any lock. Both `index.lock` reads False.
- **Did not report a needs-marco scan result from my `Claude\Scheduled` needle** — that probe
  returned 0 while its own positive control was reachable, so it is unsound and its answer is
  withheld rather than quoted (§7).
