# Station 04 — Scanner | 2026-09-09T06:12Z–2026-09-09T06:25Z

🔴 **THIS RUN WAS BLIND.** Desktop Commander never connected. No shell, no `git`, no `gh`, no `.ps1`
ran on the Windows host. Everything below was read through the Cowork mounts, and the named sweep
was covered only in the subset a mount can reach. Read the last section before treating any silence
here as coverage.

## GROUND

```
UTC            2026-09-09T06:12:17Z  (VM clock, `date -u`)
origin/main    2279d2d9  [MEASURED, FILE-READ]  .git/refs/remotes/origin/main, loose ref
dev tree       main @ 2279d2d9       C:\ProjectOperations2   (.git/HEAD -> refs/heads/main)
doc version    1   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1   (scheduled-task SKILL.md, `station_doc_version: 1`) — MATCH
```

⚠️ **The `origin/main` line is a ref FILE read, not `git rev-parse`.** It is only as fresh as the dev
tree's last fetch, and this run could not fetch. `FETCH_HEAD` line 1 agrees (`2279d2d9 … branch
'main' of https://github.com/GH-Mantova/ProjectOperations`). Whether GitHub's `main` is that commit
is `[CANNOT MEASURE]` on a blind run. **And see F2: the other ref file in the same directory answers
`66194af6`.**

## WHAT I MEASURED

**Transport.** `ToolSearch` for `desktop-commander` was run twice, keyword form, per the PREFLIGHT
rule that a validation error is not blindness. The server never came up: the second call returned
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): connection timed out after 30000ms`.
`[MEASURED]` — this is a load-then-fail, not an unloaded schema. `vm-git-guard.sh` was **not** run:
it is invoked with `bash` against the mount and its own purpose is to refuse `git` there; with no
Desktop Commander there was no second transport to guard, and running an installer that persists
itself onto `PATH` is a mutation this run could not verify. `[CANNOT MEASURE]` on its last line.

**Mounts.** Eleven repo folders plus `outputs` and `uploads` under `/sessions/<id>/mnt/`
`[MEASURED]`, matching `BLIND_RUN_OTHER_MOUNTS_V1` in STATION-CAPABILITIES §3. `po-watcher` and
`po-watcher/ProjectOperations` are both readable, which is what made the two-homes and clone-ref
readings below possible.

**Sweep named by the rotation.** `node scripts/pipeline/next-sweep.mjs` (pure `node:fs`, no git —
read from source before running) printed `SWEEP: instrument-honesty`, rotation position 2 of 4,
previous run `2026-09-09T02:05:00Z` at index 0. `[MEASURED]`

**The honest partition of that sweep.** DOCTRINE §9 splits cleanly into claims a mount can falsify
and claims that need the box. §9.1 (the shell), §9.2 (git), §9.4 (GitHub) and every `ls-tree` /
`gh run list` / `--jq` / `Measure-Object` / `Select-String` probe are `[CANNOT MEASURE]` here — the
lying command cannot be run. What follows is the whole of the remainder.

*§9.5 — `lint-prompt.mjs` anchors, dev-tree working copy, NEG needle `zzScanNeedle20260909T0612Z`
= 0 in the same file:*

| anchor | hits |
|---|---|
| `function readFromOriginMain` | 1 |
| `LINT_GH_BIN` | 2 |
| `DO_NOT_ARM_COMMENT =` | 1 |
| `DO_NOT_ARM_CAPS =` | 1 |
| `ARM_ONLY =` | 1 |
| `export function checkHumanGate` | 1 |
| `stripCodeContext(bodyText)` | 1 |
| `foldBlockScalar` | 2 |
| `HUMAN_GATE_PRESENT: line` | 3 |

The three marker definitions read verbatim
`const DO_NOT_ARM_COMMENT = /<!--\s*watcher:\s*do-not-arm\s*-->/i` ·
`const DO_NOT_ARM_CAPS = /DO NOT ARM/` · `const ARM_ONLY = /Arm ONLY/i`, so the 2026-09-06
correction holds exactly: **two of three are case-INSENSITIVE and only `DO NOT ARM` is
case-sensitive.** The fail-SAFE branch is present (`return null; // git broken - skip check, fail
SAFE`). Every §9.5 claim in this group **still reproduces**. `[MEASURED]`

*§9.5 — `check-breadcrumb.mjs`:* `ls-tree -r` = 1 · `p.lastIndexOf('/')` = 1 · `readdirSync(DIR)` = 1
· the token `basename` = **0**, exactly as the bullet asserts. Section ordering is by
`text.indexOf` (three sites). **Still trapped.** `[MEASURED]`

*§9.5 — the STOP-WATCHER bullet, the one four earlier runs mis-measured:* fully reproduced from the
`po-watcher` mount. `C:\po-watcher\STOP-WATCHER-LANE2` present, **1090 bytes** (unchanged since the
2026-09-05 reading); `C:\po-watcher\STOP-WATCHER` **absent**; NEG control
`C:\po-watcher\zzScanNeedle20260909T0612Z*` → 0 files. Launcher hit counts identical to the doc:
`ensure-watcher.ps1` 3 · `watcher-launcher.ps1` 4 · `watcher-launcher-singlelane.ps1` 4 ·
`watcher-launcher-lane2.ps1` 3. Repo-side control (the probe that manufactures the false negative):
0 hits under `ProjectOperations2/scripts`. **Still trapped, path half still load-bearing.**
`[MEASURED]`

*§9.5 — RULE 2's probe has two homes:* dev tree `docs\pr-prompts\processed` = **2090** logs
(865 `pr-*`, 1225 `rev-*`), `marco.:true` → **625**, NEG needle → 0, newest CONTENT timestamp
**2026-09-09T00:12:02** (taken from log content, never from a mount `stat`, per §3's host-offset
rule). Clone `C:\po-watcher\ProjectOperations\docs\pr-prompts\processed` = **21** logs,
`marco.:true` → **10** (POS control PASSES), NEG → 0, newest CONTENT timestamp
**2026-08-17T14:28:06** — now **23 days** stale. **The decoy still passes the mandated control and
still answers "no verdict" for everything since 17 August.** Log age remains the only
discriminator. `[MEASURED]` ⚠️ Counts are state; re-measure, never quote.

*§9.3 — the node `$` replacement trap:* reproduced. `"…MID OLD TAIL".replace("OLD","X$\`Y")` returned
`"HEADER-1234567890 MID XHEADER-1234567890 MID Y TAIL"` — the entire prefix injected. The function
replacer form is clean. **Still trapped.** `[MEASURED]`

*§9.3 — `String.length` counts UTF-16 code units:* on `DOCTRINE.md`, Buffer **136688** bytes vs
decoded string `.length` **135204** — under-reported by **1484**, silently, exit 0. The file is
CRLF throughout (1751 CRLF = 1751 LF), which is the other half of the stacked error the bullet
describes. **Still trapped.** `[MEASURED]`

*§9.6 — "a negative control you wrote down is a positive":* against DOCTRINE.md itself,
`zzzNoSuchNeedleZzz` → 1, `zzzNoSuchTokenZzz` → 2, `zzQqNeedle04b20260906` → 1; this run's freshly
minted `zzScanNeedle20260909T0612Z` → 0. All three previously published needles are burned exactly
as the rule predicts. **Still trapped.** `[MEASURED]`

**Bonus — Part 0 (a), authorization parity** (pure grep, no host needed, so it survives a blind
run). Backend short-circuits confirmed at `apps/api/src/common/auth/permissions.guard.ts:37` and
`apps/api/src/modules/personas/persona-permission.guard.ts:26` (note the second path — F5). Ten
bare `permissions?.includes(` / `permissions.includes(` call sites outside `__tests__`; one is the
sanctioned helper `auth/permissions.ts:5`, and **all nine remaining sites carry an adjacent
`isSuperUser` test.** POSITIVE CONTROL as required: 9 correctly super-aware bare sites + 1 helper.
**Zero new offenders.** Six files contain `<Navigate>`; four mention no super-user helper
(`CrmRedirects.tsx`, `LoginPage.tsx`, `NotFoundPage.tsx`, `portal/PortalProtectedRoute.tsx`) and
each was read: all four are auth-state or plain redirects, **none is a permission-conditional
guard**, so none is the S2 lockout shape. `[MEASURED]`

**Arming log.** Working copy `docs/pr-prompts/.arming-log.txt` = **72** lines, newest row
`2026-09-08T23:43:55Z ARMED pr-ea-gate-report-self-filter escalates=true
actor=station-00.cloud-lane-2345`. §9.5's falsifying probe for that bullet is a *two-sided* line
count against `origin/main`, and the `origin/main` side needs `git`. **`[CANNOT MEASURE]` — one
side of a two-sided probe is not the probe.**

## WHAT CHANGED

**Nothing on the board, and nothing in any tracked file.** No arm, no stage, no rename, no delete,
no label, no merge, no push, no PR. The only write this run made anywhere is this breadcrumb, which
is **untracked** in the dev tree at `docs/pr-prompts/` and needs Station 00 to sweep it into a board
PR. `docs/pipeline/sweep-rotation.json` was **NOT advanced** — see F3.

## FINDINGS

### F1 — This run was blind, and that is the loudest thing in this report

Desktop Commander returned `CONNECT_TIMEOUT` after a successful keyword load, twice. Under the
station contract that is blindness and the run stops before acting; under STATION-CAPABILITIES §3
it still COLLECTS through the mounts, which is what it did. This run therefore claims **no**
liveness, smoke, safe-to-act or merge verdict, and made no board mutation. The analysis behind this
condition — that the fault is the TRANSPORT, not the host — already landed on main in `#1641`, so
this is recorded, not re-raised.

**DEFERRED** — nothing new to add to `#1641`. It becomes urgent again if a blind run is ever seen
to act on the board, or if the blind rate rises far enough that the sweep rotation stops turning
(see F3).

### F2 — `packed-refs` is a stale shadow of EVERY ref, in BOTH trees, and DOCTRINE §9 does not mention it once

A blind run cannot call `git rev-parse`, so the only way it can read a SHA is to read a ref file.
There are two such files for the same refname, they disagree, and **nothing warns** — both are
well-formed 40-hex SHAs, both "exit 0" in the sense that a file read succeeds. `[MEASURED]`
2026-09-09T06:18Z:

| tree | refname | loose ref file | `packed-refs` |
|---|---|---|---|
| `C:\ProjectOperations2` | `refs/remotes/origin/main` | `2279d2d9` | **`66194af6`** |
| `C:\ProjectOperations2` | `refs/heads/main` | `2279d2d9` | **`4ea28d6d`** |
| `C:\po-watcher\ProjectOperations` | `refs/remotes/origin/main` | `f482d1a5` | **`1ddf3fb4`** |
| `C:\po-watcher\ProjectOperations` | `refs/heads/main` | `533604dc` | **`1ddf3fb4`** |

Git's own rule is loose-wins, so every loose value above is the answer and every packed value is a
corpse — but a reader who reaches for `packed-refs` (the obvious single file, and the *only* file
present once a ref has been packed) gets the corpse with no signal that it is one. This is §9.6's
exact shape: not an empty result read as an empty world, but a **well-formed answer to a question
the instrument was not measuring**. It is also self-evidently reachable — the dev tree's packed
value `66194af6` is the same one that has been sitting there for days.

Coverage check, with the negative control that this is not a search failure: `packed-refs` occurs
**0** times in `docs/pipeline/DOCTRINE.md`, **0** times anywhere under `docs/pipeline/stations/`,
and **0** times in `STATION-CAPABILITIES.md`. The trap is undocumented in all three of the binding
documents, and it lands hardest on precisely the runs that have no alternative — blind ones, which
STATION-CAPABILITIES §3 now explicitly tells to read `.git/refs/heads/main` from the mount.

The same table incidentally re-measures the per-tree `origin/main` trap the PREFLIGHT block warns
about: dev tree `2279d2d9` vs clone `f482d1a5`, and the clone's own `HEAD` (`533604dc`) is at
neither. How far apart they are is `[CANNOT MEASURE]` without `git`.

Proposed fix, RULE 1 ordered. **(a) complete and additive — FIRST:** add a §9.2 bullet stating that
`.git/packed-refs` may shadow any refname, that loose wins, and that a ref read from a file must be
taken from `.git/refs/...` with `packed-refs` used **only** when no loose file exists — with this
four-row table as its falsifying probe. Additive (one bullet, docs-only), and it closes the case
permanently for every future blind run. **(b)** amend only STATION-CAPABILITIES §3's blind-run
paragraph. Fails the "future" half — the trap is a git property, so it will be rediscovered from
DOCTRINE, which is the document stations are told to trust. **(c)** leave it and rely on runs
choosing the loose file. Fails both halves: this run reached for `packed-refs` unprompted, which is
how the defect was found.

**DISPATCHED** → Station 00. Docs-only, single-file, `docs/pipeline/DOCTRINE.md` §9.2 — which is
the starved `tests-docs` lane, so it can land without touching Marco's queue. Not staged as a
prompt by this run: staging requires a lint-clean verdict, `lint-prompt.mjs`'s five gate probes
shell `git show origin/main:`, and this run may not run `git` against the mount. Per the CLEAN-TREE
MANDATE: **NO-OP: could not stage verifiably — no clean tree.**

### F3 — The rotation cannot record "attempted but blind", so a blind Station 04 must either lie or stall

`next-sweep.mjs` names `instrument-honesty`, and roughly half that sweep — §9.1, §9.2, §9.4, and
every PowerShell-instrument bullet in §9.3 and §9.5 — is unrunnable without Desktop Commander. The
rotation offers two moves and both are wrong: `--advance` records a sweep as covered when half of
it was never attempted, and not advancing means the next run repeats it, which is the exact failure
`sweep-rotation.json`'s own `_why` block exists to prevent. This run chose **not** to advance, on
the ground that a false "covered" is more expensive than a repeat, and is naming the file here as
the contract requires.

If blindness really runs near 40% of scheduled runs, the rotation turns at roughly half its
intended rate and `instruction-drift` — the sweep that exists because five pasted bootstraps
drifted for weeks — is the one that starves.

Proposed fix, RULE 1 ordered. **(a) complete and additive — FIRST:** give the rotation a third
verb, `--attempted --blind --utc <ts>`, that records the attempt and its coverage without moving
`last_index`, plus a `last_blind_utc` field. Nothing existing changes behaviour; the next run sees
both that the sweep is still owed and that it was not simply skipped, and Station 00 gets a
measurable blind-rate series for free. **(b)** let a blind run advance past a host-only sweep to
the next mount-readable one. Fails the "without damaging" half — coverage of the skipped sweep is
lost silently, which is the original defect. **(c)** status quo. Fails the "future" half: every
blind run re-argues this from scratch, as this one did.

**DISPATCHED** → Station 00. `docs/pipeline/sweep-rotation.json` is left DIRTY-FREE (unmodified) in
the dev tree; 00 owns both the commit and this design call.

### F4 — DOCTRINE §9.5 carries a raw state figure, "(now 1824 lines)", and it has drifted by ~620

The bullet that opens §9.5 — *anchor by symbol, never by line number* — parenthesises
`origin/main:scripts/pipeline/lint-prompt.mjs` as "(now 1824 lines)". The dev-tree working copy
measured **2444** lines this run `[MEASURED]`; the `origin/main` side is `[CANNOT MEASURE]` here,
so the delta is indicative, not exact. The point does not depend on the exact number: §9.3's
`Measure-Object` bullet records Station 04 nearly filing *"the file shrank 118 lines, §9.5 has
drifted"* off a comparison against this very figure. A bare count inside a hash-gated canonical
block is protected from being edited and not at all from going stale, which is the failure mode
that same section warns about two bullets later.

Fix: replace the parenthetical with the sentence the document already uses elsewhere — that counts
are state, re-measure and never quote — or drop it. Additive, docs-only, one line.

**DISPATCHED** → Station 00, to ride with F2 (same file, same section, one PR).

### F5 — The Station 04 brief names a guard path that does not resolve

Part 0 (a) instructs the run to read `apps/api/src/common/auth/permissions.guard.ts` **and**
`apps/api/src/common/auth/persona-permission.guard.ts`. The first exists; the second does not. The
file is at `apps/api/src/modules/personas/persona-permission.guard.ts` and does carry the
short-circuit at line 26 `[MEASURED]`; negative control, a minted-needle filename search under
`apps/api/src` → 0. The consequence is small but one-directional: the obvious probe returns "No
such file", and a run that treats that as an absent guard concludes the persona layer has no
super-user short-circuit — a confident, coherent, wrong finding about an authorization guard.

Fix: repoint the path in `docs/pipeline/stations/04-scanner.md`, Part 0 (a). One string.

**DISPATCHED** → Station 00. Station 04 is read-only on the board and may not open the PR that
would fix its own brief.

## WHAT I DID NOT DO

- **No `git`, ever**, against any mounted `.git` — DOCTRINE §9.2. Every SHA above is a file read and
  is labelled as one.
- **No `.ps1`**: no `status-sweep.ps1`, no `bring-up-to-speed.ps1`, no `triage-holds.ps1`, no
  `smoke-pr.ps1`, no `arm-prompt.ps1`. Therefore **no liveness, smoke, safe-to-act or merge verdict
  is claimed anywhere in this report**, and nothing here may be read as one.
- **`check-breadcrumb.mjs` was NOT run**, so this report does **not** claim breadcrumb-clean. Its
  CLI shells `git ls-tree -r origin/main` against the mount. Structure was instead checked against
  the validator's own exported rules — filename matched against the exported `NAME_RE`, the five
  sections present and in order, a disposition on every finding, and the exported
  `checkGitignoredSink` clean. Station 00 should run the real validator when it sweeps this up.
- **The rotation was not advanced** (F3). `instrument-honesty` remains owed for its host-only half.
- **No prompt staged, no prompt armed, disarmed, renamed or deleted.** No `-HOLD` was touched.
- **No live site pass** (Part 2) and **no GitHub reconciliation** (Part 1): Claude in Chrome and the
  `github-projectops` connector were both unavailable this session — the latter failed to connect
  with an authorization-header error — and substituting GitHub-side reads for host coverage is
  exactly what the contract forbids.
- **No worktree minted**, per AUTHORITY. **No `vm-git-guard.sh` install**, per the reasoning above.
- **Nothing under `/sot/`** was read for editing or written; that is Station 05's lane.
- **Open PRs were not enumerated and no PR was assessed**, so this run makes no RULE 2 statement
  about any PR. The two-homes measurement above is instrument verification of the probe, not a
  verdict about anything on the board.
