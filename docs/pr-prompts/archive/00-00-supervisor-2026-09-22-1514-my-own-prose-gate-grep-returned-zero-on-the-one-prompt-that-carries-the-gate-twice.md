# Station 00 — Supervisor | 2026-09-22T15:14Z–2026-09-22T15:36Z

## GROUND

```
UTC            2026-09-22T15:14:18Z   (lastRunAt, scheduled-tasks MCP)
origin/main    304e41b6  at preflight;  1cee14f7  after this run merged #2088
dev tree       main @ 304e41b6 -> fast-forwarded to 1cee14f7   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **MATCH** — no read-only downgrade. Desktop Commander connected on the
first call, so this is a **sighted** run.

**Which tree the binding documents were read in, and why the working copy was sound this run.**
PREFLIGHT step 2 requires reading from `git show origin/main:<path>`, never the working copy. The
sanctioned equivalence probe was run instead, in the **dev tree** (never the watcher clone), after an
explicit `git fetch origin +refs/heads/main:refs/remotes/origin/main`:

```
git rev-parse --short origin/main                     304e41b6
git rev-parse --short HEAD                            304e41b6
git diff --numstat origin/main -- <the three docs>    EMPTY
git rev-list --left-right --count HEAD...origin/main  0   0
```

`--numstat` EMPTY is the real answer (§9.1), and no piped `hash-object` comparison was taken. So the
working copy **is** `origin/main` for all three documents, and all three were read in full:
`00-supervisor.md` (1569 lines), `DOCTRINE.md` (2722), `STATION-CAPABILITIES.md` (571).

**Clock note.** The session header declares `2026-09-23`; the box reports `2026-09-22T15:14Z`. These
agree — the host is Brisbane, UTC+10, where 15:14Z is 01:14 on the 23rd. This report is stamped in
**UTC**. The same +10 offset is the subject of F2 below, where it silently broke a probe of my own.

## WHAT I MEASURED

**[MEASURED] vm-git-guard: INSTALLED BUT INERT, exit 2 — the expected station outcome.** Run first,
before any VM-side call, exit code read off the installer itself and not off an appended pipeline:

```
bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"; echo "EXIT CODE: $?"
```

Last line and exit code, verbatim:

```
   PATH="/sessions/zen-quirky-clarke/.local/bin:$PATH" git <args>
EXIT CODE: 2
```

Headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Its own controls reproduced the documented cause (`bash -lc` resolves the shim, `bash -c` resolves
`/usr/bin/git`). A FINDING, not a STOP, and **never** a licence: no VM-side `git` was run against any
mount this cycle.

**[MEASURED] Sweep taken and drained. `SAFE TO ACT`.** `status-sweep.ps1` exit 0, captured with `*>`
and decoded `utf16le` (155,774 B, BOM `FF FE` — §9.3's trap, and the capture is the prescribed cure
for the sweep hiding its own section 7). All ten sections read; no `[BROKEN]` in section 0; **no
`[STALE]` row anywhere in section 5**, so there was no dead escalation to discharge this run.

**[MEASURED] The board, at preflight and re-derived before acting.**

| | |
|---|---|
| open PRs | **1** — `#2088`, CLEAN, MERGEABLE, 10 pass / 0 fail, **0 labels** |
| **DIRTY PRs** | **0** — so no PR on this board has frozen CI, and nothing is conflict-blocked |
| armed (`*-ready.md`), counted myself | **0** |
| `-HOLD.md` at depth 1, counted myself | **16** |
| main CI on `304e41b6` | 4 success / 0 failed — **trunk green**, taken per-commit |
| watcher | `ALIVE pid 9744` (parent 17688), wrapper alive, restart churn 0 in 20 min |

**[MEASURED] The watcher clone's `dirty=5` is untracked-inclusive, and its tracked count is 1.** Both
forms run against the clone in the same minute, read-only git only — no checkout, merge, commit or
stash in `C:\po-watcher\ProjectOperations`:

```
git status --porcelain --untracked-files=no   ->  M docs/data-model/metadata-catalog.json      (1)
git status --short                            ->  the same, plus  ?? .codex/  ?? AGENTS.md
                                                  ?? docs/pr-reviews/pr-2088-review.md
                                                  ?? scripts/pr-watcher/.conflict-notified-prs.json
MERGE_HEAD / rebase-merge / rebase-apply      ->  False / False / False
git diff --diff-filter=U --name-only          ->  EMPTY
```

**NOT corrupt** — on `main`, no abandoned merge, no rebase, no unmerged paths. `pr-2088-review.md` is
the `rev-` lane writing a verdict into the clone **by design** (§9.5's three-homes rule), which is
why this warning recurs on every reviewed PR.

**[MEASURED] `#2088`'s lane, settled with both controls before the merge.** §10.1 step 1, prompt logs
only, `rev-*` excluded:

| probe | result |
|---|---|
| `Select-String docs\pr-prompts\processed\pr-*.log -Pattern 'PR #2088\b'` | **0** |
| POSITIVE control `PR #2040` | **1**, carrying a real `{"ok":false,"marco":true,...}` verdict |
| NEGATIVE control, a freshly minted needle | **0** |
| corpus freshness — newest log `rev-2088-ready.md.log` | `2026-09-22T14:47Z`, **younger** than #2088's `createdAt` `14:38Z` |

Zero hits with the freshness precondition satisfied ⇒ **not watcher-opened** ⇒ second lane, so no
watcher `marco:true` verdict exists to bind. Classified under step 3 by the
`STATION-CAPABILITIES.md` §5 matrix: **Station 05 doc-reconcile**, `sot/04-data-model.md` + its own
breadcrumb, CP-24 green, and the PR body names its lane explicitly as step 3 requires.

**[MEASURED] Precedent for that classification, rather than a fresh judgement.** The 2026-09-21T15:09Z
Station 00 run merged `#2052` — the byte-identical class (05 `sot/` generated-section re-merge, 0
labels, second lane) — and recorded it as *"the one PR on this board that is not Marco's"*. Nine hits
across two breadcrumbs. `sot/` reconciles land routinely: `git log -15 origin/main -- sot/` shows
#2052, #2027, #2019, #2007, #1987, #1975, #1932 …

**[MEASURED] Freshness × `lastRunAt`, crossed as the contract requires.** `check-breadcrumb.mjs
--freshness` → `CLEAN`, exit 0, `structure: 3 checked, 0 malformed`. No station SILENT. Every enabled
station's newest breadcrumb aligns with its `lastRunAt` from the MCP:

| station | `lastRunAt` (MCP) | newest breadcrumb | reading |
|---|---|---|---|
| 00 | `2026-09-22T15:14:18Z` | 14:14Z | this run |
| 03 | `2026-09-21T23:02:53Z` | 09-21 23:04Z | aligned; next `23:02Z` tonight |
| 04 | `2026-09-22T14:09:57Z` | 14:11Z | aligned — and **BLIND**, see F4 |
| 05 | `2026-09-22T14:23:04Z` | 14:23Z | aligned |

Enabled tasks: **four** (`weekly-security-audit` is `enabled: false`) — the live count
`STATION-CAPABILITIES.md` §1 records, re-measured rather than quoted.

**[MEASURED] All four depth-1 breadcrumbs were ALREADY TRACKED on `origin/main` before this run
wrote anything.** Asked of the **tracked set**, matched by basename, never of the dev tree's
`git status` (§9.5's duplicated-root-copy trap):

```
tracked=1  00-00-supervisor-2026-09-22-1325-...md
tracked=1  00-00-supervisor-2026-09-22-1414-...md
tracked=1  00-04-scanner-2026-09-22-1411-BLIND-...md
tracked=1  00-05-sot-keeper-2026-09-22-1423-...md
```

`#2087` swept the first three at 14:26Z and `#2088` carried the fourth. **So no second copy was
committed**, which is the whole point of asking the tracked set first.

## WHAT CHANGED

1. **`#2088` MERGED** — `Assert-SmokedOrEscalate` → `Merge-Pr`, never a hand merge, never
   `gh pr merge` raw. Read back rather than assumed: `state=MERGED`,
   `mergedAt=2026-09-22T15:23:28Z`, merge commit `1cee14f7c536f9cb8a28d6bf600cacc19fa6a44f`;
   `origin/main` moved `304e41b6 -> 1cee14f7`; `FK edges: 497` present on the trunk; 05's breadcrumb
   tracked on `main`.

2. **Dev tree fast-forwarded `304e41b6 -> 1cee14f7`**, with all four read-backs, not the prescribed
   three — the fourth is the only one that catches a dirty tree:

   ```
   git rev-list --left-right --count HEAD...origin/main   ->  0   0
   git diff --numstat                                     ->  EMPTY
   git diff --cached --name-status                        ->  EMPTY
   git status --porcelain --untracked-files=no            ->  EMPTY
   ```

   Content proof, because `0 0` can be true of a tree that never received the content:
   `FK edges: 497` is in the working copy and 05's breadcrumb is on disk.

3. **One append to a gitignored escalation** — `needs-marco/station-00-blindness-desktop-commander-
   connect-timeout-2026-09-01.md`, recording the counter-example in F3. Proved untracked first
   (`git ls-files --error-unmatch` exit **1**, against a POSITIVE control on a tracked file in the
   same folder → exit **0**), then written with node `appendFileSync`, never `Set-Content`, never
   `String.replace` with a replacement string. Byte delta asserted:
   `9314 -> 12464`, `ACTUAL_DELTA=3150 == EXPECTED_DELTA=3150`, original tail intact.

4. **This breadcrumb**, written **inside this run's own PR worktree** (`C:\po-worktrees\
   00-collect-20260922-1514`, branch `docs/00-collect-2026-09-22-1514` off `origin/main`) — cure 1 of
   the post-merge fast-forward rule, so no loose untracked copy is ever left in the dev tree.

**Nothing else.** No prompt armed, disarmed, renamed, moved or retired. No label added or removed. No
watcher restart. No `git` write in the watcher clone. No VM-side `git` against any mount.

## FINDINGS

### F1 — My prose-gate grep returned ZERO on the one prompt that carries the gate TWICE, and both of its controls PASSED (S2)

**This is the check standing between this station and arming a three-migration backfill across five
modules' money paths, and this run's first attempt at it failed silently.**

`triage-holds.ps1` reported exactly one candidate: `pr-scopecards-s7-one-cutting-total-HOLD.md`,
lint **ADMIT**, exit 0. DOCTRINE §9.5 is explicit that ADMIT is necessary and not sufficient, and
that a **prose** human gate matches none of the linter's three literal markers, so the body must be
read. I ran a twelve-needle search for prose gate language:

```
'do not arm|do-not-arm|arm only|before arming|Marco must|ask Marco|
 STOP AND|STATUS: HOLD|not be armed|hold until|awaiting Marco|needs Marco'
```

| probe | result | truth |
|---|---|---|
| the twelve needles, over the prompt | **0** | **wrong** |
| NEGATIVE control, a freshly minted needle | 0 | correct |
| POSITIVE control, the same needles over `pr-siteid-notnull-backfill-HOLD.md` | **1** | correct |
| `'Arming is Marco\|Marco merges'` over the same prompt | **2** | the truth |

The gate is stated twice, in as many words:

```
230: paths. Marco merges, not automation.
237: `CUTTING_ONE_SURFACE_V1` (S6) is on `main` - it is, as of `eb3086fa`. Arming is Marco's.
```

🔴 **Nothing was empty and nothing warned, so §9.6 could not fire — the query worked perfectly and
answered a question about a VOCABULARY.** A prose gate has no fixed vocabulary; that is the entire
reason it is invisible to the linter, and a needle list is the same instrument as the linter with a
longer word list. The available conclusion from a clean 0 was *"ADMIT with no prose gate — arm it"*,
against a prompt carrying `escalates: true`, `gate_allow: migrations`, `backfill: true` and three
migration files, one of them a NOT NULL on `estimate_cutting_lines`.

🔴 **And the POSITIVE control is what makes it dangerous rather than merely wrong.** It passed —
because it was run **over a different file**, one that happens to use the literal words. A control on
a different corpus can only prove the *cmdlet* works; it can never detect that the *needle list* is
too narrow for the file actually under test. Both controls were sound and both were irrelevant.

🔧 **The cure, and it is not a longer needle list.** For a HOLD whose lint verdict is ADMIT, **read
the prompt's STATUS and guardrail sections** — the answer was one line of prose in each. Where a grep
is used at all, its positive control must be **the same file**, not a sibling: assert that a phrase
you have already read in that file is found. **A vocabulary-bounded probe cannot be controlled from
outside its own vocabulary.**

⚠️ **The 14:14Z run reached the right answer and this run's first probe contradicted it.** Its
breadcrumb title says the only armable prompt carries a prose gate to Marco; it was correct, my
re-measure was not, and Q4 exists to re-verify notes rather than to overturn them on a weaker
instrument. **Re-verification that uses a worse instrument than the original is not verification.**

⚠️ **Falsifying probe: the four-row table above.** Re-run both needle sets over that prompt. If the
twelve-needle form ever returns non-zero, this finding is wrong and must be re-measured.

**DISPOSITION: ACTIONED** — the prompt was **NOT armed**, the board's only ADMIT was left on HOLD,
and the cure is recorded here rather than in a needle list that would rot the same way.

### F2 — The safe-to-act gate I hand-rolled was wrong by the host's +10h offset, and it failed toward FALSE ALARM (S3)

The board-driving conditions require confirming nothing else is mid-mutation immediately before
acting, so I re-derived the gate by hand. It printed **`PRs touched in last 2 min = 15`** against a
`--limit 15` query — every row, which is the uniform-answer signature.

[MEASURED], with the diagnosis proved rather than inferred:

| PR | `updatedAt` | cast `.Kind` | BROKEN `nowUtc - cast` | SOUND `nowUtc - cast.ToUniversalTime()` |
|---|---|---|---|---|
| #2088 | `2026-09-22T15:23:30Z` | **Local** | **−599.5 min** | **0.5 min** |
| #2087 | `2026-09-22T14:31:07Z` | Local | −547.1 | 52.9 |
| #2086 | `2026-09-22T13:33:33Z` | Local | −489.5 | 110.5 |

`BROKEN_FORM_COUNT=5  SOUND_FORM_COUNT=1  TRUTH_ROWS=5`, `HOST_UTC_OFFSET_HOURS=10`. In PowerShell
`[datetime]"…Z"` yields `Kind=Local`, so subtracting it from a `Kind=Utc` `Get-Date().ToUniversalTime()`
is off by exactly the host offset and every row lands ~600 minutes "in the future" — negative, and
therefore `< 2`. The single sound hit was `#2088`, which I had merged 30 seconds earlier: a true
positive the broken form buried in fourteen false ones.

🟢 **The shipped instrument is NOT affected, and that is the finding's point.** `status-sweep.ps1`
uses the sound form — `([datetime]$u.updatedAt).ToUniversalTime()` — and its `[LIVE]` line *"no PR
touched on GitHub in the last 2 min"* was correct at 15:16Z. **This is DOCTRINE §1's "do not
hand-roll a board operation" demonstrated on the gate that decides whether hand-rolling is safe.**

⚠️ **Direction matters and this one is benign-but-costly.** The error says *"the board is busy"*, so
it fails toward standing down, not toward an unsafe mutation. A run that believed it would merge
nothing, report a quiet board, and look exactly like a healthy idle cycle. I proceeded on the sweep's
sound line plus three independent signals (`index.lock` both False, **0** `git.exe` processes, **0**
armed) — not on the broken one.

⚠️ **Falsifying probe: the table above.** If `[datetime]"…Z"` ever returns `Kind=Utc` on this host,
this finding does not apply to that build.

**DISPOSITION: ACTIONED** — diagnosed, controlled, and the mutation was gated on the sanctioned
instrument instead. No repo change is needed, because no shipped script carries the broken form.

### F3 — The blindness escalation's stated falsifier has been met: Desktop Commander was FINE while `Prisma-Local` FAILED (S2)

`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` argues that the
two local stdio servers always fall together, and therefore that *"option (A) … remains the RULE 1
option, and it is one fix rather than two."* It names its own falsifier: *"a run that is blind while
`Prisma-Local` connects, or one where `Prisma-Local` fails while Desktop Commander is fine.
**Neither has been seen.**"*

**One has now been seen — this run, the second of the two.** [MEASURED] from the session's own MCP
connection report and from the shell itself:

| server | this run | earlier samples in that file |
|---|---|---|
| `desktop-commander` | **CONNECTED first call** — carried a full mutating run: sweep, merge, fast-forward, ~14 shells | `CONNECT_TIMEOUT … after 30000ms` |
| `prisma:Prisma-Local` | **`CONNECTION_CLOSED: "Connection closed"`** | `CONNECTION_CLOSED: "Connection closed"` |

The `Prisma-Local` string is **byte-identical** to the 2026-09-21 sample, so it is the same failure;
only Desktop Commander's outcome is opposite.

⚠️ **This does not retire the escalation and does not retire its option (1).** Raising the connect
timeout is argued from the *error string* — a 30s handshake timeout — which is independent evidence
and untouched here. What changes is the **scope** of the ask: a `Prisma-Local` fix can no longer be
assumed to fix Desktop Commander, and the two should be costed separately. ⚠️ **The first falsifier
is still unseen** (blind while `Prisma-Local` connects). ⚠️ **One counter-example refutes "always";
it does not establish independence.**

**DISPOSITION: ESCALATED** — appended to that escalation file with the byte delta asserted, and
restated here because **the file is gitignored and an append there reaches nobody on its own.**

### F4 — Station 04's 14:11Z slot was BLIND, not quiet, and one cycle of sweep coverage is simply missing

04's breadcrumb is a textbook blind report: Desktop Commander `CONNECT_TIMEOUT after 30000ms` after
two honest keyword `ToolSearch` loads and a 25s wait, so it stopped at PREFLIGHT step 1 and took no
sweep. Its two handovers to me:

1. **"commit this breadcrumb, since 04 may not"** — **already discharged before I arrived.** Asked of
   the tracked set: `00-04-scanner-2026-09-22-1411-BLIND-…md` is tracked on `origin/main`, swept by
   `#2087` at 14:26Z. I committed **no** second copy, which is the §9.5 trap this check exists for.
2. **"note that the slot was blind, not quiet"** — **this paragraph is that note.** The
   `gate-liveness / instrument-honesty / repo-hygiene / instruction-drift` sweep due at
   `2026-09-22T14:11Z` **did not happen**. `sweep-rotation.json` was correctly NOT advanced, so the
   next 04 run will take that sweep — but it has no way to know the slot was lost rather than served,
   and any reader asking why a sweep's findings look stale should read this row first. Next 04
   occurrence: `2026-09-22T18:09Z`.

04's own F1 is ESCALATED and its F2 (inert guard) DEFERRED; I reproduced F2 exactly this run (exit 2,
same headline) and **concur with both dispositions**.

**DISPOSITION: ACTIONED** — handover (1) verified already done and deliberately not repeated;
handover (2) discharged here.

### F5 — Station 05's four hand-overs collected; the one addressed to me did NOT reproduce

05's breadcrumb landed on `main` inside `#2088`. Its findings, dispositioned:

| 05's finding | its disposition | mine |
|---|---|---|
| **F2** 24 of 81 API module directories unnamed in `sot/01` | DEFERRED (curated prose) | **DEFERRED** — concur; `sot/` is 05's lane and only 05 may edit it |
| **F3** `PO Watcher Keepalive` last ran `SCHED_S_TASK_TERMINATED` while the watcher is alive | DISPATCHED → 03 | **DISPATCHED** — stands; 03 owns the watcher process and machines, next occurrence `2026-09-22T23:02Z`. Not mine to pre-empt (LL-38) |
| **F4** `sot/02` claims 5 In-PR items against a live board of 0 | DEFERRED (curated status semantics) | **DEFERRED** — concur |
| **F5** an untracked dev-tree file at a path `#2087` landed blocks the next `--ff-only` while `--numstat` reads clean | DISPATCHED → **00** | **ACTIONED** — see below |

**F5 did not reproduce, and was re-verified before acting rather than after.** The three untracked
files in the dev tree are `Claude Design/docs/index.html`, `docs/pr-prompts/.queue-sync-ledger.txt`
and `docs/pr-prompts/queue-watch-state.md`; `git cat-file -e origin/main:<path>` returns **absent for
all three**, so none sits at a path the fast-forward must create and none can block it. The
fast-forward then ran clean on the first attempt with all four read-backs passing (WHAT CHANGED §2).
05's finding was true of its own moment and the merge of `#2087` is what spent it — a claim that
outlived its SHA by about an hour, which is the re-read rule working as intended.

**DISPOSITION: ACTIONED** — fast-forward performed and proved; no blocker present.

### F6 — The sweep's `watcher clone: dirty=5 <-- the watcher may refuse to start` is a false warning, again

Re-derived both ways in the same minute: tracked-dirty **1**, untracked-inclusive **5**. The four
untracked entries include `docs/pr-reviews/pr-2088-review.md`, which the `rev-` lane writes into the
clone **by design**, so this warning recurs on every reviewed PR. Both conjuncts of the sentence are
false: `start-watcher.ps1` counts only tracked files, and a tracked-dirty clone **auto-stashes**
rather than refusing.

Already on file in DOCTRINE §9.5 with 13 verbatim quotations of that line in `archive/`, and the
13:25Z run DEFERRED the one-line scoping fix to `status-sweep.ps1`.

**DISPOSITION: DEFERRED** — real, already documented, and the fix is a `scripts/` change, which is
outside this station's recorded merge lane. It becomes urgent if a run ever acts on the warning —
dispatching clone hygiene to 03 on it is the recorded mis-route.

## WHAT I DID NOT DO

- **Did not arm `pr-scopecards-s7-one-cutting-total-HOLD.md`**, the board's only ADMIT. It carries a
  prose gate assigning the arming decision to Marco in two places, plus `escalates: true`,
  `gate_allow: migrations`, `backfill: true` and three migrations across five modules' money paths.
  F1 is the record of how nearly a clean-looking grep talked me past it.
- **Did not arm anything else.** 15 of 16 HOLDs are correctly gated — 11 `[HUMAN_GATE_PRESENT]`,
  4 `[FILE_GATE_NOT_RELEASED]` — and `triage-holds.ps1` reports `spent=0 of 16` with its SPENT
  fixture control passing, so that zero means *none*, not *cannot say*. There is nothing to retire.
- **Did not restart, kill or `-Fix` the watcher.** The sanctioned probe returned
  `VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.`
  Never restart on idle is the rule that once nearly killed a working queue.
- **Did not run `rescue-watcher-repo.ps1`.** The clone is on `main` with no `MERGE_HEAD`, no rebase
  and no unmerged paths — "parked and harmless", not `*** CORRUPT`.
- **Did not run any `git` write in the watcher clone**, and did not touch `.codex/`, `AGENTS.md` or
  `.conflict-notified-prs.json` there. They belong to a lane I did not identify, and deleting another
  actor's untracked work is not recoverable.
- **Did not run VM-side `git` against any mount.** The guard reported INERT (exit 2), and an inert
  guard is the reason to be careful, never the licence to proceed.
- **Did not do 03's, 04's or 05's work.** 05's F3 keepalive finding is 03's; 04's lost sweep slot is
  04's to retake at 18:09Z. Naming them here is the whole hand-over (LL-38).
- **Did not archive the four dispositioned breadcrumbs.** `check-breadcrumb.mjs` reports
  `structure: 3 checked` against 16 prompts, so the queue root is legible by eye and archiving would
  add the untracked-root-copy hazard for no benefit. **DEFERRED** — worth doing when the root
  breadcrumb count approaches the prompt count. Concurs with the 14:14Z run.
- **Did not treat the sweep's `[LIVE]` lines as correct merely because they are live.** The two I
  acted on were re-derived from their own sources: the clone's `dirty=` (F6) and the safe-to-act gate
  (F2, where my own re-derivation was the broken one).
- **Did not touch Azure, Entra or SharePoint**, and wrote no production data. Absolute, and not
  reasoned past.

⚠️ **Three negative-control needles are SPENT by this file** — `zzQq00Needle20260922T1520`, `…T1526`
and `…T1531`. A needle is spent the moment it lands in a tracked file. Mint a fresh one.

## FOR MARCO

**One thing needs you, and it is the same one as last run:** `pr-scopecards-s7-one-cutting-total-HOLD.md`
is gate-cleared and lint-ADMITs, and its own body says *"Arming is Marco's."* It is the only prompt on
a 16-deep queue that could move, so **the board is empty by design, not by fault** — it stays empty
until you arm it. The board is otherwise clean: 0 open PRs, 0 dirty, trunk green, watcher alive and
idle.

**New, and it narrows an ask already in your queue:** the blindness escalation's "one fix, not two"
argument rested on Desktop Commander and `Prisma-Local` always failing together. This run is the
counter-example it named — Desktop Commander fine, `Prisma-Local` down. Raising the Desktop Commander
connect timeout is still the complete-and-additive option on its own evidence, but it should no
longer be costed as also fixing `Prisma-Local` (F3).
