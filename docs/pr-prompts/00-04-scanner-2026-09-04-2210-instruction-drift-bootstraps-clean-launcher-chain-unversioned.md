# Station 04 — Scanner | 2026-09-04T22:09:50Z–2026-09-04T22:26Z

## GROUND

```
UTC            2026-09-04T22:09:50Z
origin/main    3200cb25            (fetched, then rev-parse)
dev tree       main @ d7a6f055     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

Version and bootstrap AGREE — this run was not read-only-gated.

The dev tree is **behind** `origin/main` (`d7a6f055` vs `3200cb25`). I did not fast-forward it
(04 is read-only on the board). Instead I proved the three binding documents I read are current:
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY** — not different. Everything below that
reads repo content was read via `git show origin/main:<path>`, in the dev tree, per PREFLIGHT.

**Sweep this run: `instruction-drift`** (`node scripts/pipeline/next-sweep.mjs` → rotation position
4 of 4; previous run 2026-09-04T18:09:55Z).

## WHAT I MEASURED

**[MEASURED] Host reachable.** `start_process` shell `powershell.exe` → `ALIVE`,
`2026-09-04T22:09:50.5945954Z`. Not blind.

**[MEASURED] Bootstrap ↔ station-doc parity — CLEAN, all five.** node over
`C:\Users\Marco\Claude\Scheduled\*\SKILL.md`:

| bootstrap | bytes | mtime (UTC) | boot ver | doc ver | match | mojibake `â€` | U+FFFD |
|---|---|---|---|---|---|---|---|
| 00-supervisor | 5905 | 2026-09-01T00:07:44.732Z | 1 | 1 | ✅ | 0 | 0 |
| 02-board-driver | 5902 | 2026-09-01T00:07:44.735Z | 1 | 1 | ✅ | 0 | 0 |
| 03-machine-minder | 5880 | 2026-09-01T00:07:44.737Z | 1 | 1 | ✅ | 0 | 0 |
| 04-scanner | 5841 | 2026-09-01T00:07:44.740Z | 1 | 1 | ✅ | 0 | 0 |
| 05-sot-keeper | 5816 | 2026-09-01T00:07:44.742Z | 1 | 1 | ✅ | 0 | 0 |

`weekly-security-audit` carries no `station_doc_version` and points at no station doc (not a
pipeline station). `_retired-2026-08-18` has no `SKILL.md`.

⚠️ **State correction for whoever quotes it next:** the bootstraps were rewritten in ONE batch at
**2026-09-01T00:07:44Z**, not `2026-08-24T22:54:22Z`. The 08-24 figure is recorded in
`STATION-CAPABILITIES.md` §1 and in the project-memory index; it is now one rewrite stale. That
paragraph is the one warning that a stale instruction reads exactly like a current one.

**[MEASURED] No cross-copy drift.** Line-set diff of each bootstrap against 04's: the ONLY
differences are the eight per-station lines (title, cadence, station-doc path, blob URL, lane
sentence, station-specific hint, breadcrumb prefix). The shared body — preflight, hard stops, report
contract — is identical across all five. **This is the failure the sweep exists for, and it is
currently absent:** "five pasted copies drifted for weeks" is no longer true of this layer.

**[MEASURED] `lint-station.mjs` → `ADMIT: all 8 docs clean`, exit 0.** All seven station docs `v1`,
`.claude/agents/*.md` 9 definitions encoding-clean. Its `NOTE` that "contract is v2; these declare
station_doc_version 1" is expected — the contract block version and the doc version are different
counters.

**[MEASURED] Path resolution across DOCTRINE + all 9 station docs: 0 unresolved references.**
149 distinct repo-relative path refs extracted from `origin/main` copies, checked against
`git ls-files` (3057 tracked; POS control `scripts/pr-watcher/index.mjs` → true, NEG control
`zzz/no/such/file.md` → false). Final unresolved set after excluding paths the docs name *because*
they are gitignored: **3**, and all three are documented as intentionally absent by the doc naming
them — `docs/data-model/relationship-map.json` / `.md` (generator output, gitignored at
`.gitignore:127-128`, stated at `05-sot-keeper.md:327`) and `apps/api/scripts/xero-import-report.md`
(named at `05-sot-keeper.md:261-262` in a list of "all gitignored, all absent from origin/main").

🔴 **[MEASURED] My own instrument lied first, and this is the §7 note for the next run.** The first
pass reported **12** unresolved refs. Six were a defect in my extractor: the extension alternation
read `…|js|ts|…` with `js` BEFORE `json` and `ts` before `tsx`, so JavaScript's leftmost-alternative
matching truncated every `.json` to `.js` and `.tsx` to `.ts` — manufacturing six missing files
(`metadata-catalog.js`, `sweep-rotation.js`, `_canonical-blocks.js`, `sot-refs-baseline.js`,
`relationship-map.js`, `SettingsShell.ts`) that all exist. Exit 0, no warning, six confident coherent
wrong findings. **Order a regex alternation longest-first and anchor it with `(?![A-Za-z0-9])`.**

**[MEASURED] Claim in 03's bootstrap — "The real launcher is `watcher-launcher-singlelane.ps1`" —
is TRUE. I nearly filed it as a defect.** `git ls-files` has 0 hits for `singlelane` (POS control
`watcher-launcher.ps1` → 1 hit), which reads as "the bootstrap names a file that does not exist".
It does exist, off-repo, and it is live. `Get-CimInstance Win32_Process`, matching on command line
and never on image name:

```
pid=35328 ppid=28504  powershell -File C:\po-watcher\watcher-launcher-singlelane.ps1
pid=36224 ppid=35328  powershell -File C:\po-watcher\ProjectOperations\scripts\pr-watcher\start-watcher.ps1
pid=20000 ppid=36224  node --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs
```

POS control: 24 `node.exe` seen. NEG control `zzzNoSuchTokenZzz` → 0. The 2026-08-25 instruction-drift
run's FINDING 2 (03's doc naming the wrong launcher) is **fixed** on main — `03-machine-minder.md:196`
and `:312` now both say singlelane, and `00-supervisor.md:404/:1070` agree.

**[MEASURED] Board state at 22:10:33Z** (`status-sweep.ps1`, instrument controls both `[LIVE]` PASS):
OPEN PRs **0** · armed **1** (`pr-crmui-account360-s1-tiles-and-next-action-ready.md`) · watcher node
RUNNING pid 20000 · heartbeat 0 min · in-progress prompts 0 · index.lock false/false · git processes 0.
Verdict **CAUTION**: 1 live station worktree (`C:/po-vg`). I mutated no board state, so the caution
did not bind me.

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved or deleted. No PR opened,
merged or labelled. No `sot/` file touched. No git command that changes a branch or an index.

Two writes, both permitted:

1. `docs/pr-prompts/00-04-scanner-2026-09-04-2210-instruction-drift-bootstraps-clean-launcher-chain-unversioned.md`
   — this breadcrumb, at a tracked path in the dev tree. **Untracked until a board PR commits it —
   Station 00 sweeps it up.**
2. `docs/pipeline/sweep-rotation.json` — advanced via
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-04T22:09:50Z`. **LEFT DIRTY
   DELIBERATELY. Station 00 must commit it; 04 may not commit to `main`.** If it is not committed,
   the next 04 run repeats `instruction-drift` and the rotation stops turning.

Scratch scripts were written to `C:\po-sup-fix-scripts\` (04-drift-bootstraps.mjs, 04-drift-diff.mjs,
04-drift-claims.mjs, 04-paths.mjs, 04-paths2.mjs, 04-hist.mjs, 04-bridge.mjs, 04-final.mjs,
04-launcher.ps1, 04-proc.ps1) — outside the repo, nothing tracked.

## FINDINGS

### F1 — 🔴 S2 · THE LIVE WATCHER'S TOP TWO LINKS ARE NOT IN THE REPO, AND THE CONCERN HAS NO FILE-BACKED STOP

The chain that keeps the entire board alive is three deep. **The bottom link is versioned. The top
two are not.**

- `C:\po-watcher\watcher-launcher-singlelane.ps1` — 2367 B, mtime `2026-08-18T02:41:02Z`, **pid 35328,
  running now.** `git ls-files` hits for `singlelane`: **0** (POS control `watcher-launcher.ps1` → 1).
- `C:\po-watcher\ensure-watcher.ps1` — 5266 B, mtime `2026-08-24T00:01:25Z`. Absent from
  `C:\ProjectOperations2\scripts\pr-watcher\` (`existsSync` → false).
- `scripts/pr-watcher/index.mjs` — tracked. This is the only link CI can gate.

**Why this is S2 and not hygiene:** `03-machine-minder.md:312` instructs the relaunch step with
*"source of truth: `ensure-watcher.ps1:10`"* — a **line-number citation into a file that is not in
the repository.** No PR can review it, no CI can gate it, `lint-station.mjs` cannot see it, and
DOCTRINE §9.5's "anchor by symbol, never by line number" cannot be enforced on it because there is
no blob to anchor against. A station following that instruction is reading a number into a file that
any process on that box may have rewritten, with nothing that would tell it.

🔴 **And the standing concern about this is carried in the project-memory index ONLY.**
[MEASURED] across the 16 open `docs/pr-prompts/needs-marco/*.md`:
`Select-String -Pattern 'ensure-watcher'` → **0**; `'singlelane'` → **0**;
POSITIVE CONTROL `'watcher'` → **7 files**; NEGATIVE CONTROL `'zzzNoSuchZzz'` → **0**.
The instrument works and the answer is a true zero.

DOCTRINE §5b is explicit that **`needs-marco/` is the only real stop** — an item that exists only in
a memory index is invisible to every actor that lacks project memory, and STATION-CAPABILITIES §2
records that a device task **may have no project-memory tool (Station 03 currently does not)**. So the
one station whose lane is the watcher machines is structurally unable to read the one place this is
written down.

**RULE 1 options for Marco.** These are files on a shared machine that the whole board depends on,
so this is his call, not a station's.

- **(a) COMPLETE + ADDITIVE — move both files into `scripts/pr-watcher/`, repoint the scheduled task
  and `ensure-watcher.ps1:10` at the repo copies, and leave the `C:\po-watcher\` copies in place
  until the first successful supervised restart proves the new path.** Solves it immediately (the
  files become reviewable, greppable, CI-gatable, and `lint-station.mjs`-visible) and permanently
  (any future edit arrives as a PR). Damages no existing or future data entry: nothing reads or
  writes ERP data, and keeping the old copies until proven means a failed cutover cannot leave the
  board with no watcher. **Passes both halves of RULE 1.**
- **(b) Commit copies into the repo for review but keep the task pointing at `C:\po-watcher\`.**
  Fails *complete-for-the-future*: two copies immediately begin to diverge, and the repo copy — the
  one every station and every grep would find — is the one that is NOT running. That is the decoy
  shape §9.5 already records for the `processed/` probe, rebuilt on purpose.
- **(c) Leave it; file a `needs-marco/` note so the concern at least has a file-backed stop.**
  Fails *complete-immediately*: the launcher stays unreviewable. It is strictly better than today,
  because today the concern is invisible to Station 03 entirely — so if (a) is not approved this
  run, (c) is the floor, not nothing.

**DISPOSITION: ESCALATED** — to Marco via Station 00. Question: *may Station 03 move
`watcher-launcher-singlelane.ps1` and `ensure-watcher.ps1` into `scripts/pr-watcher/` and repoint the
scheduled task (option a)?* It touches how the watcher starts, which is machine state on a shared
box, so no station may do it unasked. **Whatever the answer, a `needs-marco/` file should exist for
this** — its absence is half the finding.

### F2 — 🟠 S3 · DOCTRINE §9.2 FORBIDS USING A TRANSPORT THAT STATION-CAPABILITIES §3 RECORDS AS NON-EXISTENT — AND THE CORRECTION IS IN THE FILE READ SECOND

[MEASURED], `origin/main`, with NEG control `zzzNoSuchBridgeZzz` → 0 across the corpus:

- `DOCTRINE.md:390` — "🔴 **Never run `git` through the device bridge against the Windows `.git`.**"
- **All five bootstraps, identically, at line 73** — the same bullet, in the HARD STOPS block.
- `STATION-CAPABILITIES.md:127-133` — "### No second transport … MEASURED 2026-09-04T06:1xZ from
  inside a live scheduled Cowork session, **none of the tools that bridge exposed is offered** …
  **A fallback that does not exist is not a fallback**."

These are not flatly contradictory — the bridge existed when it caused the three `index.lock`
freezes §9.2 records, and does not exist now. The defect is what a station **infers**: a live hard
stop phrased as *"never do X through the device bridge"* presupposes a device bridge is available to
do X through. STATION-CAPABILITIES §3 says that inference is exactly how "a station presenting
no-coverage as coverage" happens — and the bootstraps prescribe reading DOCTRINE **first** and
STATION-CAPABILITIES **second**, so the presupposition is read first and the refutation last.

⚠️ This is the mirror of the failure §3 of that file already documents about §9.1 restatements
("because the bootstraps prescribe reading this file after DOCTRINE, the weaker version was the one
read last"). There the correction was in DOCTRINE and the stale paraphrase read last; **here the
correction is the thing read last.** Same ordering, opposite polarity, same outcome.

Fix is one clause: §9.2's bullet should say the bridge **no longer exists in this environment**, keep
the trap as history, and point at §3. It sits inside the hash-gated `instruments v2` canonical block,
so it needs `lint-station.mjs --write-canonical` and ships to all seven docs together — which is why
04 must not touch it.

**DISPOSITION: DISPATCHED** — to **Station 00**, as an ordinary docs PR (docs-only, no `sot/`, no
`scripts/`; CP-24 not engaged). Hand-over: edit `DOCTRINE.md:390`, re-record the canonical hash,
and note that the same line 73 in all five bootstraps will then be stale until Marco repastes them
(F3 is the same hand-off — fold them).

### F3 — 🟠 S3 · THE ONLY LINE-NUMBER CITATION IN THE WHOLE BOOTSTRAP LAYER IS `pr-gates.mjs:327`, AND IT POINTS AT A BARE `{`

[MEASURED] across all five bootstraps, one hit, with a passing NEG control:

```
05-sot-keeper:63  ->  pr-gates.mjs:327
```

`05-sot-keeper`'s bootstrap reads: *"CP-24 is a hard block: a PR mixing `sot/` with `scripts/` or
`apps/` fails (`pr-gates.mjs:327`)."* Against `origin/main:scripts/pr-gates/pr-gates.mjs` (581 lines):

```
:320  // CP-24 - sot purity: a code PR must never touch /sot/. SoT edits land via a
:327  {                          <- the cited line
:328    const sotRe = /^sot\//;
:333  report("PASS", "CP-24", "sot-purity", "no sot/ files changed");
```

NEG control `zzzNoSuchGateZzz` → 0 hits. So the citation is **inside** the CP-24 block but lands on
an anonymous opening brace: a reader who follows it sees `{` and must scan upward to learn they are
in the right place. The **substance is correct** — CP-24 is real and is a hard block.

This matters because DOCTRINE §9.5 now makes it binding: *"ANCHOR BY SYMBOL, NEVER BY LINE NUMBER…
A line number into a file outside this document is invalidated by any edit above it."* §9.5 records
16 of 17 such citations rotting ~90 lines at once from **one** insertion. This citation was written
**2026-09-01**; §9.5's rule landed **2026-09-04** (#1604/#1605 era). **The bootstrap layer has not
been repasted since the rule that governs it was written** — that is the drift, and it is the layer
STATION-CAPABILITIES §1 calls "the one" that actually governs a scheduled run.

Replacement text, so the hand-off needs no thinking: *"CP-24 is a hard block: a PR mixing `sot/` with
`scripts/` or `apps/` fails (`pr-gates.mjs`, the `CP-24 - sot purity` block — anchor on that comment,
not a line number)."*

**DISPOSITION: DISPATCHED** — to **Station 00**, to hand to Marco. 04's own station doc records that
the bootstrap layer is not a station's to edit ("the bootstrap lives at
`C:\Users\Marco\Claude\Scheduled\` — not mine to fix"); only Marco repastes it. Fold into the same
hand-off as F2, since both are "the bootstraps need one repaste".

### F4 — 🟢 NO DEFECT · THE BOOTSTRAP LAYER IS CLEAN, AND THAT IS WORTH RECORDING

Recorded as a finding rather than buried, because the *absence* of drift in a layer whose whole
history is drift is itself the sweep's result, and a future run should not re-derive it from scratch:
5/5 bootstraps version-matched to their station docs, byte-identical outside their per-station lines,
zero encoding damage, `lint-station.mjs` exit 0 on all 8 docs + 9 agent definitions, and 0 of 149
path references unresolved. The two blemishes found (F2, F3) are single clauses, not drift of
substance.

**DISPOSITION: ACTIONED** — verified this run, nothing to fix. Verification: the four commands and
their controls are quoted verbatim under WHAT I MEASURED and are re-runnable at `3200cb25`.

## WHAT I DID NOT DO

- **Did not fast-forward the dev tree** (behind `main` by several commits). 04 is read-only on the
  board; instead I proved the three documents I actually read were byte-identical to `origin/main`
  via `--numstat`, which is the narrow claim I needed.
- **Did not arm, disarm, stage or lint any prompt.** `armed: 1`
  (`pr-crmui-account360-s1-tiles-and-next-action-ready.md`) was read and left exactly as found. No
  `-HOLD` staged this run — the sweep produced no work item that wanted one, and the two staged-prompt
  slots go unused rather than manufactured.
- **Did not run Part 0 / Part 1 / Part 2** (static cross-layer audit, GitHub reconciliation, live-site
  visual patrol). The station doc's AUTHORITY block says take ONE named sweep and cover it
  completely; `next-sweep.mjs` named `instruction-drift`. A shallow pass over everything is the
  failure that rule exists to prevent.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** Deliberate and required — it is left dirty
  for Station 00, because the dev tree is on `main` and nobody commits to `main` directly.
- **Did not prune the 3 orphaned worktrees, the 2 registry escapees, or the dirty watcher clone
  (`dirty=2`)** that `status-sweep.ps1` §2 reported. Machine repair is Station 03's lane on 00's
  dispatch, and `C:/po-vg` is flagged as a LIVE station worktree — the verdict was CAUTION.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.** Nothing in this sweep approached them.
- **Did not clear the `[STALE]` escalation lines** in §5 of the sweep. Not 04's to discharge, and the
  memory index warns that `agent-authored-rule-2-clearance-2026-09-04.md` is tagged `[STALE]`
  precisely because it *cites* those merged PRs as its subject rather than depending on them.
