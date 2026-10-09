# Station 04 — Scanner | 2026-10-09T18:10:05Z–2026-10-09T18:16Z

## GROUND

```
UTC            2026-10-09T18:10:05Z
origin/main    661ecf89                (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 661ecf89          C:\ProjectOperations2
doc version    1                       (docs/pipeline/stations/04-scanner.md front matter, read from origin/main)
bootstrap      1                       (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not restricted to read-only by a version mismatch.
Read in full from `git show origin/main:<path>` in the dev tree: `docs/pipeline/stations/04-scanner.md`
(571 lines), `docs/pipeline/DOCTRINE.md` (508 lines), `docs/pipeline/STATION-CAPABILITIES.md`
(687 lines). No REFERENCE section was opened; no core line sent me to one.

SIGHTED. Desktop Commander loaded with ONE keyword `ToolSearch` for `desktop-commander`, then
`start_process` shell `powershell.exe` → PID 2080 on the Windows host, first call, no retry needed.

Git guard, run before any VM-side call —
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`:

- last line: `   PATH="/sessions/cool-magical-volta/.local/bin:$PATH" git <args>`
- headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
- **EXIT CODE 2** — read from the installer itself, not from a pipeline appended to it.

Exit 2 is the expected station outcome per the station contract's three-outcome table: a FINDING,
not a stop. The device-bridge git ban is REMEMBERED on this run, not mechanical. I ran no `git`
through the VM mount; every `git` in this report ran in the host shell.

Sweep this run: **instrument-honesty**, assigned by `node scripts/pipeline/next-sweep.mjs`
(rotation position 2 of 4; previous run 2026-10-09T14:12:46Z). Not chosen.

## WHAT I MEASURED

**Board and trunk.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, generated 18:10:37Z, section 0
positive controls both `[LIVE]` (`gh CAN reach GitHub (saw merged PR #2290)`, `node runs`):
OPEN PRs **0**, do-not-merge-labelled open PRs **0**, `main` CI on `661ecf89` **4 success / 0 failed
/ 0 running (trunk green)`. Watcher node RUNNING pid 8848, wrapper alive, heartbeat age 104 min
(stale + empty queue = idle, not wedged). The sweep's worktree census reached 33 non-main worktrees
and was still enumerating when I stopped consuming it — section 5 not reached, consistent with
`#2289`. Worktrees are Station 03's lane; I report only that the census is large and unread here.

**Queue census, depth 1.** [MEASURED] `*-ready.md` **0** · `*-HOLD.md` **13** · `00-*.md` breadcrumbs
**2** · `superseded/` 271 · `needs-marco/` 52 · `archive/` 823 · `processed/` 5220.
`brainstorm/`, `draft/` and `merged/` are ABSENT as directories. BOARD TRAP probe:
`git ls-tree --name-only origin/main docs/pr-prompts/ | Select-String '\-ready\.md$'` → **0** tracked
ready-files at depth 1. No board trap this run.

**Lock.** [MEASURED] `docs/qa/.qa-run.lock` absent at run start — no concurrent 04. Claimed with the
current epoch, released at the end of the run (see WHAT CHANGED).

### Section 9 traps — one probe each, with controls

Scripts: `C:\po-sup-fix-scripts\st04-instrument-honesty-2026-10-09{,-b,-c}.ps1` (`.ps1` run with
`-File`, per §9.1 — nothing containing `$` was passed as a `-Command` string).

| § | trap | reading | verdict |
|---|---|---|---|
| 9.2 | `ls-tree` without `-r` | `git ls-tree --name-only origin/main docs/pipeline/` → **13** entries, 3 of them trees (`discharges`, `dispatched`, `stations`); with `-r` → **33** | **REPRODUCES** |
| 9.2 | `git status` blind to gitignored | wrote `docs/qa/qa-run-st04-instr-2026-10-09.md`; `git check-ignore -v` → `.gitignore:119:docs/qa/qa-run-*.md`, exit 0; `git status --porcelain=v1` hits for it → **0**; POSITIVE CONTROL: the same status output carried **36** `??` lines, so status was not simply silent | **REPRODUCES** |
| 9.2 | piped `hash-object` unsound in powershell.exe | on `docs/pipeline/DOCTRINE.md`: piped `bdee0241…`, `git rev-parse origin/main:<path>` `5b71fe52…`, `git hash-object <path>` `5b71fe52…`, `git diff --numstat origin/main -- <path>` EMPTY | **REPRODUCES** — piped value differs from both sound forms, exit 0, nothing warns |
| 9.4 | LIST response's `merged` field unusable | `gh pr list --json number,merged` → exit **1**, `Unknown JSON field: "merged"` + the field list | **REPRODUCES, and loudly** — the safe shape |
| 9.4 | `gh run list --branch main` can be days stale | newest 4 runs all on headSha `661ecf89` = `origin/main`, created 16:30:2xZ; `newest_run_sha_matches_origin_main=True` | **NOT reproduced this occurrence.** The claim is "can be", so one agreement does not falsify it. Recorded, no finding. |
| 9.4 | escaped double quotes in `--jq` | see F1 | **NOT reproduced — see F1** |
| 9.1 | `$` expanded by the `-Command "…"` layer | see F2 | **NOT reproduced as worded — see F2** |
| 9.5 | `check-breadcrumb.mjs` shells out to `git`/`gh` | `Select-String -Pattern 'ls-tree\|ls-files\|gh pr list'` → **5** hits | **REPRODUCES** — the blind-run bullet stands |
| 9.5 | `rev-<n>-ready.md` are review jobs | **0** `rev-*-ready.md` present; nothing to classify | [CANNOT MEASURE] this run — empty corpus, not a clean result (§9.6) |
| 9.6 | fresh needle every run | `NEEDLE-ST04-20261009-INSTR-7Q2ZX` → **0** hits in `DOCTRINE.md` and **0** across `docs/pipeline/**`; POSITIVE CONTROL `AN EMPTY RESULT IS NOT AN EMPTY WORLD` → **1** hit in `DOCTRINE.md` | instrument sound — the zeroes above are real zeroes |

**§9.5 CADENCE map, re-measured not quoted.** [MEASURED] `git show
origin/main:scripts/pipeline/check-breadcrumb.mjs`, anchor `const CADENCE =` →
`{ '00': 1, '02': null, '03': 24, '04': 4, '05': 24 }`. Live crons from the scheduled-tasks MCP:
`00` `5 * * * *`, `03` `0 9 * * *`, `04` `0 */4 * * *`, `05` `10 0 * * *`. Every row matches its
live cron. `CADENCE_THIRD_LOCATION_LANDED_V1` still holds; nothing to re-surface.

**Enabled-task count, re-measured.** [MEASURED] scheduled-tasks MCP: **four** enabled —
`00-supervisor`, `03-machine-minder`, `04-scanner`, `05-sot-keeper` — and `weekly-security-audit`
`enabled: false`, `lastRunAt 2026-09-06T21:32:44Z`. The 2026-09-15 correction in
STATION-CAPABILITIES §1 and §5 is still current; its falsifying probe did not change polarity.

**`CODEX_LAYER_MAPPED_V1` falsifying probe, re-run.** [MEASURED] `git ls-files --error-unmatch
AGENTS.md` → exit **1** (untracked); `git check-ignore -v AGENTS.md` → exit **1** (not ignored);
`.codex/agents/*.toml` → **9** files. Polarity unchanged, so yesterday's row stands as written and
its two open questions stay with Marco. [MEASURED] `git show origin/main:scripts/pipeline/lint-station.mjs`
still carries `const AGENT_DIR_REL = '.claude/agents';` — the encoding sweep's corpus has not been
widened, which is the half of that escalation that is still open.

**This run's own bootstrap provenance — a measured negative.** [MEASURED] The scheduled-task header
named `…\260ee558\uploads\SKILL.md`, not the path STATION-CAPABILITIES §1 calls the governing layer.
They are the same bytes: uploads copy `len=7996 mtimeUtc=2026-10-06T05:59:29Z
sha256=69B0924F01E9F4FEA77940ECA4D6D293CC1FD2970D55887D9EB3F016AAEBC86E`, and
`C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md` (the `path` the MCP itself reports) is
**byte-identical** on all three. No layer drift between what §1 names and what this run was handed.
I am recording the negative because an unexplained second path in the header is exactly the shape a
future run would spend a sweep on.

**Station 00 cadence — a lead I retracted by cross-instrument check, not a finding.** [MEASURED] MCP
read at ~18:12Z: `00-supervisor` `lastRunAt 2026-10-09T17:13:58.604Z`, `nextRunAt
2026-10-09T19:13:52.000Z`, cron `5 * * * *`, jitter 532 s. Those two cannot both be right — at
18:12Z the next occurrence of `5 * * * *` + 532 s is **18:13:52**, not 19:13:52, so the reading
presents as a skipped 18:13 occurrence. [MEASURED] Cross-checked against a different instrument
before writing anything: `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0,
`00  last 2026-10-09T17:14:00Z  1.0h ago  (cadence 1h + grace 0.5h)  ok`, and 00's 17:14 breadcrumb
is on disk at depth 1 (`00-00-supervisor-2026-10-09-1714-status-sweep-is-in-the-instrument-lane-and-the-dispatch-that-sent-it-to-a-cadenceless-station-was-wrong.md`,
UNTRACKED). So 00 is not missing runs; the board simply shows nothing merged after 16:30Z because
00's last two breadcrumbs are untracked. The `nextRunAt` inconsistency is the same instrument defect
`#2287` already recorded, so it is folded into F3 rather than re-filed.

**Breadcrumb validator.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` →
`structure: 2 checked, 0 malformed, 0 skipped`, `CLEAN`, exit 0. Re-run after writing this file; see
WHAT CHANGED for the reading on this breadcrumb specifically.

## WHAT CHANGED

Nothing on the board. Nothing merged, nothing armed, nothing labelled, no PR opened, no prompt
written, moved, renamed or deleted. I am read-only on the board and stayed there.

Four writes, all of them permitted and all read back:

1. `docs/pipeline/sweep-rotation.json` — `node scripts/pipeline/next-sweep.mjs --advance --utc
   2026-10-09T18:10:05Z`, exit 0, read back `advanced: last_index=1
   last_run_utc=2026-10-09T18:10:05Z`. **LEFT DIRTY IN THE DEV TREE ON PURPOSE — Station 00 must
   commit this file, because 04 may not commit to the shared tree.** Named here as the contract
   requires. If it is not committed, the next run repeats instrument-honesty and the rotation stops.
2. `docs/qa/.qa-run.lock` — claimed at run start, **deleted before finishing** (read back: absent).
   One of the five gitignored state entries, so permitted.
3. `docs/qa/qa-run-st04-instr-2026-10-09.md` — the §9.2 probe file. Matches the gitignored
   `docs/qa/qa-run-*.md` pattern (`.gitignore:119`), confirmed with `git check-ignore -v` before it
   was written about. It IS the measurement; left in place, invisible to `git status` by
   construction.
4. **This breadcrumb**, at the tracked path `docs/pr-prompts/00-04-scanner-2026-10-09-1810-…md` in
   the dev tree. **UNTRACKED until a board PR commits it — it reaches nobody until Station 00 sweeps
   it up.** Not in a worktree, not in the session's `outputs` folder.

`git diff --cached --name-status` was EMPTY before and after — nothing of another chat's was staged,
and I staged nothing.

## FINDINGS

### F1 — DOCTRINE §9.4 and STATION-CAPABILITIES §3 both describe an escaped-double-quote `--jq` failure that does not happen on this box, and the capabilities doc states it as a positive behavioural claim

STATION-CAPABILITIES §3 (GitHub) says, of escaped double quotes in `--jq`: *"Escaped double quotes
fail **LOUDLY** (`unknown arguments`), never silently."* DOCTRINE §9.4 carries the matching
precaution: *"Keep escaped double quotes out of `-q '<jq>'` / `--jq` when calling `gh` from PS 5.1."*

[MEASURED] 2026-10-09T18:1xZ, through a `-Command` layer — the documented path, with the escaping
actually surviving into `gh`'s argv (`inner_sent=gh pr view 1369 … --jq \".labels[].name\"`):
**exit 0**, output `do-not-merge`. The CORRECT answer, neither loud failure nor silent wrong reading.
POSITIVE CONTROL, the single-quoted form through the same layer: exit 0, `do-not-merge`.
POSITIVE CONTROL on the reading itself (script A, from a `.ps1`): `#1369` → `do-not-merge`, which it
genuinely carries; `#1640` → empty, which is genuinely correct. So the instrument is sound and the
label gate reads true in every form I tried.

Why this is worth a line rather than a shrug: §9.4's bullet is a *precaution* and costs nothing if
over-cautious — it stays. The capabilities sentence is a *positive claim about observable behaviour*,
and it is now false. Its whole purpose was to replace an earlier, dangerous bullet that taught
readers to distrust a correct `do-not-merge` reading; a reader who tests the replacement and finds
it also wrong has no reason left to trust either, and `do-not-merge` is the gate that stops an agent
merging Marco's work. The sweep's own brief is the governing rule here: *"A trap that has been fixed
upstream and still reads as live is itself drift."*

⚠️ **Falsifying probe:** `gh pr view 1369 --repo GH-Mantova/ProjectOperations --json labels --jq
\".labels[].name\"` through a `-Command` layer. If it ever prints `unknown arguments`, the sentence
is right again and this finding must be re-measured. Note the asymmetry before acting: my single
non-reproduction does not prove it never fails — `gh` version, PS version and the escaping depth all
differ between callers, and I measured one combination (PS `5.1.26100.9444`).

**DISPOSITION: DISPATCHED** — to **Station 00**, for a docs-only PR narrowing the
STATION-CAPABILITIES §3 sentence from *"fail LOUDLY, never silently"* to the measured reading
(*not reproduced 2026-10-09 at PS 5.1.26100.9444; the raw `--json` + `ConvertFrom-Json` cure is kept
as a precaution, not as a cure for an observed failure*), with this breadcrumb and the falsifying
probe cited. DOCTRINE §9.4's bullet needs no change, which keeps the fix out of the hash-gated
canonical block. I am 04: I report it, I do not edit it.

### F2 — DOCTRINE §9.1's `$`-expansion trap attributes the expansion to the wrong layer, and the wrong layer is the one a reader can test

§9.1 reads: *"`$` is EXPANDED by the `-Command "…"` layer before PowerShell parses it — anything
containing `$` goes in a `.ps1` file run with `-File`."*

[MEASURED] 2026-10-09T18:1xZ: `powershell.exe -NoLogo -NoProfile -Command 'Write-Host
$PSVersionTable.PSVersion.ToString()'`, the `$`-bearing string passed as one argv element, printed
**`5.1.26100.9444`** — the `$` intact, evaluated by the inner PowerShell, not pre-expanded.

The trap is real; §9.1's own cited reproduction (STATION-CAPABILITIES §3, 2026-08-30: Station 04 saw
`$PSVersionTable.PSVersion.ToString()` come back as `System.Collections.Hashtable.PSVersion.ToString()`)
happened in **Desktop Commander's command-string construction**, not in `-Command` as a PowerShell
feature. As worded, §9.1 names a layer that demonstrably does not expand, so the obvious test
exonerates it and a reader concludes the trap is dead — then passes a `$`-bearing string through the
tool layer that really does expand it and gets *a valid command carrying a value they never wrote,
exit 0*, which §9.1 itself calls the worse failure.

🔧 **The cure is unaffected and I followed it all run**: anything containing `$` goes in a `.ps1` run
with `-File`. Only the attribution is wrong, and the fix is a few words — *"by the tool's
command-string layer before PowerShell parses it"*.

⚠️ **Acting on this is not free: §9.1 sits inside the hash-gated `CANONICAL-BLOCK: instruments v2`,
so the edit requires re-recording the block hash and `lint-station.mjs` fails any PR that does not.**
That is a deliberate cost of the block, and it is why this is DEFERRED rather than DISPATCHED: it is
a wording precision defect with a correct cure attached, not a live hazard, and it should ride with
the next change that opens that block rather than force one open by itself.

**DISPOSITION: DEFERRED** — real, not now. **What would make it urgent:** any run reporting a
confident wrong reading from a `$`-bearing probe, or a second station recording §9.1 as
non-reproducing (two independent non-reproductions of a canonical-block line is a different problem
from one). Re-measure with both layers before editing: the argv form above AND the same string sent
as a `-Command` string by the tool.

### F3 — the Scheduled tree now holds 20 superseded `SKILL.md` decoys, and the prescribed bootstrap-currency probe is corpus-ambiguous against them

STATION-CAPABILITIES §1 records [MEASURED 2026-09-07] that *"`C:\Users\Marco\Claude\Scheduled\`
holds **11** `SKILL.md` files"*, and §3 prescribes the falsifying probe *"`Select-String -Pattern
BOOTSTRAP_CORE_REFERENCE_V1` over every `SKILL.md` behind an enabled task… If it ever returns 0, the
retired clause is right again."*

[MEASURED] 2026-10-09T18:1xZ, recursive over that root: **26** `SKILL.md` files, not 11. The split:

- **6 live** at depth 1 — the 5 station bootstraps, all `mtimeUtc=2026-10-06T05:59:29Z`, each with
  `BOOTSTRAP_CORE_REFERENCE_V1` **hits=1**; plus `weekly-security-audit` (`2026-08-17`, hits=0, and
  it is `enabled: false`, so correctly outside the corpus).
- **15 in dated backups** — `_backup-2026-10-02\`, `_backup-2026-10-03\`, `_backup-2026-10-06\`,
  five stations each, every one `BOOTSTRAP_CORE_REFERENCE_V1` **hits=0**.
- **5 in `_retired-2026-08-18\`** — the pre-station tasks, hits=0.

So the probe run as literally written — *over every `SKILL.md`* — now returns **20 zero-hit files**
and **5 hits**, and a reader who reports the zeroes confirms a clause §3 explicitly retired on
2026-10-07. The rule saves a careful reader (*behind an **ENABLED** task in the MCP* scopes it to 5,
and the MCP hands you each task's `path` directly, which is the unambiguous selector); the stale
count invites the careless one, and this is the **third** time this paragraph's count has rotted —
the same failure §1 opens by warning about. [MEASURED] The scoped probe is clean: the MCP's four
enabled `path` values → 4 files, `BOOTSTRAP_CORE_REFERENCE_V1` hits=1 each.

**The backups are not a defect and must not be inflated into one.** Three dated folders and a dated
`_retired-` folder are an orderly history of Marco's own layer, they sit outside the repo, and
nothing suggests they should be deleted. The defect is entirely in the probe's corpus definition.

⚠️ **Falsifying probe:** the enabled-task count from the MCP against the number of `SKILL.md` files a
recursive sweep of that root opens. Today: **4** against **26**.

**DISPOSITION: DISPATCHED** — to **Station 00**, for a docs-only PR to STATION-CAPABILITIES that
(a) replaces the `11` with the rule rather than a new number — *enumerate the MCP's enabled tasks and
use the `path` each one reports; never walk the Scheduled root, which holds dated backups* — and
(b) adds the measured count as the dated evidence for why. Explicitly **not** a new count to rot:
§1's own standing instruction is *instructions live here, state does not*, and a fourth count would
be the fourth rotting.

## WHAT I DID NOT DO

- **Armed nothing, merged nothing, mutated no board state, opened no PR, staged no prompt.** 04 is
  read-only on the board. All three findings are docs-layer and two are dispatched to 00 rather than
  fixed here; the authority matrix gives 04 *Create a PR: NO*.
- **Did not edit STATION-CAPABILITIES or DOCTRINE myself**, although F1 and F3 both land there and I
  am sighted and able. Reporting is where 04's job ends; and F2 in particular would mean opening a
  hash-gated canonical block, which is not a thing to do in passing.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** Left dirty and named above, per the station
  doc's correction of the line that used to ask 04 to commit it.
- **Did not run Part 0 (static cross-layer audit), Part 1 (GitHub reconciliation) or Part 2
  (live-site visual patrol).** The station doc's AUTHORITY section is explicit that the run takes
  ONE named sweep and covers it completely, and `next-sweep.mjs` named instrument-honesty. A shallow
  pass over everything is the failure that section exists to prevent.
- **Did not finish consuming `status-sweep.ps1`.** It reached 33 non-main worktrees and was still
  classifying; section 5 was never reached, matching `#2289`'s record that section 5 cannot finish
  inside a run. I therefore quote **no** section-5 fact and issue **no** verdict about worktrees or
  about any `needs-marco` file's currency. Worktree pruning is Station 03's lane regardless.
- **Did not touch the 33 worktrees, the watcher, any lock, or any `.git` through the VM mount.**
  The git guard reported INERT (exit 2), which is a reason for more care, never a licence.
- **Did not re-enumerate the §9.5 `rev-*-ready.md` claim as verified.** The corpus is empty, so I
  recorded [CANNOT MEASURE] rather than let an empty result read as a clean one (§9.6).
- **Did not act on the `00-supervisor` `nextRunAt` inconsistency beyond recording it.** Two honest
  instruments disagreed, `--freshness` says `CLEAN`, and `#2287` already owns that defect. Looping on
  it would be the thing §5.6 forbids.
- **Azure / Entra / SharePoint: not touched, not read-modify-write, no `az`, no `Connect-MgGraph`.**
  Nothing this run came near them.
