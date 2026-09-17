# Station 00 — Supervisor | 2026-09-17T12:07Z–2026-09-17T12:30Z

## GROUND

```
UTC            2026-09-17T12:09:21Z
origin/main    2b452b31            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 2b452b31     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE**. Full authority for the lane; this run was not read-only.

**This run was SIGHTED.** `start_process` shell `powershell.exe` answered on the first call after a
keyword `ToolSearch` for `desktop-commander`, and one shell (PID 28708) carried the whole run.
Naming that explicitly because a blind run and a healthy quiet run produce identical silence.

## WHAT I MEASURED

**Device-bridge git guard, installer's last line quoted as the contract requires.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → exit 0:

```
vm-git-guard installed at /sessions/<session>/.local/bin/git - refuses mounted paths and mounted cwd,
allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

PASS. Every `git` below ran through Desktop Commander on the Windows host, never the VM.

**Binding-document freshness, by the sound form only.** [MEASURED] in the **dev tree**,
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, and `git rev-list --left-right --count
HEAD...origin/main` → `0 0`. No piped hash was taken (PREFLIGHT §2). The working copy is therefore
byte-identical to `origin/main` for all three, which is what makes the reads below sound.

✅ **Scope of the read, stated honestly: all three were read IN FULL this run.**
`00-supervisor.md` 1350 lines, `DOCTRINE.md` **2589 lines** (§1–§10.6, including the whole of §9.5
and §10.2–§10.6), `STATION-CAPABILITIES.md` 545 lines. The 11:25Z run declared it could not carry
the full DOCTRINE read and filed that honestly; this run could, so the condition in
`needs-marco/binding-read-contract-exceeds-what-a-run-can-carry-2026-09-14.md` is **intermittent,
not absolute** — recorded as F5 below rather than left as an implied contradiction.

**Preflight sweep, captured to a file and decoded `utf16le` with node** (§9.3 — `*>` writes UTF-16LE
and `readFileSync(p,"utf8")` reads a structureless 380-line blob otherwise). [MEASURED] 145,628
bytes, 423 lines. Section 0 controls **both PASS** (`gh` reached GitHub, saw merged `#2003`; node
runs). Section 7: `[LIVE] SAFE TO ACT`.

**Section 5 `[STALE]` escalation rows: ZERO**, confirming the 11:25Z reading. [MEASURED] the whole
of section 5 was read (lines 148–405 of the capture); every row is `[FILE] … cites #N (MERGED) as
evidence — not its premise` or `(no PR ref … read it as a SNAPSHOT)`. The eleven PR-scoped `[STALE]`
rows my station doc records from 2026-09-10 remain discharged. **Nothing to clear here this run.**

**COLLECT instrument.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 0,
`structure: 2 checked, 0 malformed`, `CLEAN`, every station `ok`.

**The freshness table crossed against `lastRunAt` from the scheduled-tasks MCP**, which the
breadcrumb instrument cannot do on its own:

| station | newest breadcrumb | `lastRunAt` (MCP) | live cron | reading |
|---|---|---|---|---|
| 00 | 2026-09-17T11:25Z | **2026-09-17T12:07:52Z** (this run) | `5 * * * *` | aligned |
| 03 | 2026-09-16T23:02Z | 2026-09-16T23:01:15Z | `0 9 * * *` | aligned, 13.2 h, cadence 24 h |
| 04 | 2026-09-17T10:11Z | 2026-09-17T10:10:30Z | `0 */4 * * *` | aligned, 2.0 h |
| 05 | 2026-09-16T14:11Z | 2026-09-16T14:11:02Z | `10 0 * * *` | aligned, 22.0 h; `nextRunAt` 2026-09-17T14:10Z |

All four enabled tasks are healthy and every `lastRunAt` has a matching breadcrumb — the one shape
in my station doc's table that needs no further probe. `weekly-security-audit` reads
**`enabled: false`**, `lastRunAt 2026-09-06T21:32:44Z`, so the live enabled count is **FOUR**,
exactly as `STATION-CAPABILITIES.md`'s 2026-09-15 correction records. No station is SILENT, so the
session-directory probe (the third instrument) was not needed this run.

⚠️ **`--freshness` still reads `00 … (cadence 2h)` against a live hourly cron**, i.e.
`check-breadcrumb.mjs`'s `const CADENCE` map still holds `'00': 2`. That is the already-filed
`scripts/` defect, unchanged; quoted here only so the `ok` above is not read as stronger than it is.

**Watcher.** [MEASURED] from the sweep's live process read: node **RUNNING pid 30248**, auto-restart
wrapper **alive (2)**, heartbeat **141 min** with an **EMPTY queue** (`armed: 0`). Per my station
doc that is idle-and-correct, not wedged — the heartbeat ticks only mid-run. **I did not restart,
kill or touch it.** With `0` armed, `restart-watcher-if-wedged.ps1` reports `OK — nothing armed` by
design, so it carries no information on an empty queue.

**The watcher clone's health, by the sound instrument (§9.5).** [MEASURED]
`git -C C:\po-watcher\ProjectOperations status --porcelain --untracked-files=no` → **EMPTY**. The
sweep's `dirty=3` is untracked-inclusive: `?? docs/pr-reviews/pr-1998-review.md`,
`?? docs/pr-reviews/pr-2002-review.md` — review verdicts the `rev-<N>` job writes there **by
design** — and `?? scripts/pr-watcher/.conflict-notified-prs.json`, watcher state. **Not dispatched
to Station 03**; archived runs have mis-routed that line thirteen times and this run did not add a
fourteenth.

**Q1 — every open PR, per-PR, never from a list rollup, `-R` on every call, `$LASTEXITCODE` tested
before parsing (§9.4).** [MEASURED]:

| PR | state | mergeState | isDraft | labels | created |
|---|---|---|---|---|---|
| `#2002` `feat(rates): transport capacity column order` | OPEN | BLOCKED | false | **`do-not-merge`** | 2026-09-17T09:41:45Z |
| `#1998` `feat(crm): S5 — Follow-ups … CRM_PARITY_FOLLOWUPS_V1` | OPEN | BLOCKED | false | **`do-not-merge`** | 2026-09-17T09:05:20Z |

Both label descriptions read `escalates:true - Marco merges this, not automation (DOCTRINE 5b)`.
**DIRTY count: ZERO.** Neither PR is conflicted; both are BLOCKED by the label, which is a different
thing and does not freeze CI.

**RULE 2 lane probe — the PROMPT logs alone, `processed\pr-*.log`, `rev-*` excluded (§10.1 step 1).**
[MEASURED] `#2002` → **2** hits, `#1998` → **2** hits ⇒ both **watcher-opened**. NEGATIVE control
`PR #999995` → **0**. POSITIVE freshness control: newest `processed\*.log` is `2026-09-17 09:49:14Z`,
younger than both PRs' `createdAt`, which is the control that separates the live probe directory from
the watcher clone's seventeen-day-stale decoy.

**The arming candidate, confirmed three ways before it was armed.** [MEASURED]
`triage-holds.ps1` → `spent=0 of 28`, `gates-satisfied=2`, `still-gated=26`, both instrument controls
PASS (`GIT control: PASS`, `SPENT control: PASS — lint-prompt.mjs emitted exit 3 on the fixture`).

1. **Duplicate flag cleared on the MARKER, not the head branch.** The tool flagged
   `pr-scopecards-s3-line-markup-all-types-HOLD.md` as a POSSIBLE DUPLICATE of `#2002`, overlap
   **1 of 21**, on the single directory entry `apps/api/prisma/migrations/**` — the shape §10.6
   measures as *"precision zero by construction"*. `gh pr view 2002 --json title,body` →
   `SCOPE_LINE_MARKUP_ALL_TYPES_V1` **0 hits**, POSITIVE control `transport` **1**, minted NEGATIVE
   control `zzQq00Needle20260917T1215` **0** (now spent). **Not a duplicate.**
2. **Prose human gate: absent.** Union grep over the prompt body — `watcher:\s*do-not-arm`
   case-insensitive · `DO NOT ARM` `-CaseSensitive` · `Arm ONLY` case-insensitive · a wide
   `ask Marco|Marco must|wait for Marco|STOP AND REPORT|do not arm` — returned **0/0/0/0**.
   POSITIVE control on a prompt that IS gated (`pr-dns-s5-checker-flip-to-fail-HOLD.md`) → **1**, so
   the grep works.
3. **Lint, read as the CODE and not the exit code alone.**
   `node scripts/pipeline/lint-prompt.mjs <path>` → **exit 0**,
   `PROMOTE … GATE_RELEASED requires_on_main: "apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
   :: SCOPE_QUOTE_DESTINATION_UI_V1" is now on origin/main`. That gate was released by **`#1995`,
   merged 2026-09-17T09:04Z this morning**.

**Single-actor gate, re-measured immediately before the arm** (§7 — `[LIVE]` expires the moment it
prints). [MEASURED] second full sweep, `SWEEP COMPLETE 2026-09-17 12:15:46Z`:
`git index.lock interactive/clone: False / False` · `git processes touching our trees (scoped): 0` ·
`no PR touched on GitHub in the last 2 min` · `armed (*-ready.md): 0` · section 7
`[LIVE] SAFE TO ACT`. The arm followed at `12:19:06Z`.

**The orphan-worktree escalation, re-verified rather than carried forward.** [MEASURED]

| probe | result |
|---|---|
| `git worktree list` (dev tree) | `C:/ProjectOperations2 2b452b31 [main]` · `C:/PR-Master/worktrees/po-vg 23c91ba9` — **two entries** |
| `Test-Path C:\po-fix1891` | **False** |
| `Test-Path C:\PR-Master\worktrees\pr1823` | **False** |
| `gh pr view 1823 … --json number,state,mergedAt` | `MERGED 2026-09-11T02:57:48Z`, exit 0 |
| `gh pr view 1891 … --json number,state,mergedAt` | `MERGED 2026-09-14T02:05:09Z`, exit 0 |
| NEGATIVE control `gh pr view 999997 … --json number,state` | exit **1**, GraphQL could-not-resolve |
| POSITIVE control, `git -C …\po-vg rev-list --count origin/main..HEAD` | **1** |
| `git -C …\po-vg status --porcelain` | `?? scripts/pipeline/check-pipeline-heartbeat.mjs` |

The positive control is what makes the two `False` rows a measurement: the commit-count probe **can**
return a number, so the two named worktrees are genuinely absent rather than unmeasurable.

**Marco is actively draining the board**, which is the fact that changed this run's arming decision.
[MEASURED] from the sweep's `[LIVE] MERGED (most recent 8)`: **eight** PRs merged today —
`#1994` 08:20Z, `#1995` 09:04Z, `#1996` 08:31Z, `#1997` 08:45Z, `#1999` 09:29Z, `#2000` 09:23Z,
`#2001` 09:36Z, `#2003` 11:27Z — and `#1995` is a `feat(tendering)` PR outside `tests|docs`, so it
took a human merge. The two open PRs are **2.5 h and 3.1 h old**, not a stale backlog.

## WHAT CHANGED

One board PR, built in an **isolated worktree off `origin/main`** on the Windows FS
(`C:\po-wt\st00-20260917-1219`, branch `docs/st00-collect-2026-09-17-1219`) — never the dev tree,
never the watcher clone. `git diff --cached --name-status` in the dev tree was **EMPTY** before I
started and **EMPTY** after the arm released its staged rename (BOARD DRIVING condition 3).

- **ARMED one prompt, one at a time, through `arm-prompt.ps1` — never a bare `git mv`.**
  `pr-scopecards-s3-line-markup-all-types-HOLD.md` → `-ready.md`, actor `station-00-scheduled`,
  at `2026-09-17T12:19:06Z`. **Read back:** `-ready.md` present **True**, `-HOLD.md` present
  **False**, armed census `0 → 1`, `.arming-log.txt` **21,572 → 21,750 bytes / 131 → 132 lines**,
  newest row quoted verbatim:
  `2026-09-17T12:19:06Z  ARMED  pr-scopecards-s3-line-markup-all-types  escalates=true  actor=station-00-scheduled  by=Marco@LAPTOP-E6NHU4E4  pid=23320  caller=powershell.exe:7612`.
- **Committed `.arming-log.txt`** in this PR, as §9.5 requires of any run that arms. It is
  append-only, so it was carried across **by content** rather than restored from `HEAD:` — the
  132-line dev-tree copy is what this PR lands, and no row was dropped.
- **Committed the tracked deletion** of `pr-scopecards-s3-line-markup-all-types-HOLD.md`, which the
  arm created and left uncommitted.
- **Archived the two dispositioned breadcrumbs** to `docs/pr-prompts/archive/` by `git mv` — the
  11:25Z supervisor report and the 10:11Z scanner report, every finding in both now carrying a
  disposition. **Confirmed tracked first** (`git ls-files docs/pr-prompts` matched both by basename),
  so neither was mistaken for unreported.
- **SPLIT AND DISCHARGED an escalation in `needs-marco/`** — see F1. Two files written, one moved,
  none deleted.
- **This breadcrumb**, written **inside the PR worktree** — cure 1 of the post-merge fast-forward
  rule, so no untracked copy is left in the dev tree to block the next FF.

**Nothing else.** No PR merged, closed, labelled or rebased. No `do-not-merge` label removed. No
branch, remote ref, worktree or stash deleted. No watcher restart. Nothing under `sot/`, `apps/`,
`scripts/`, `packages/` or `.github/` touched. No `git` run against the mount, no commit on `main`,
no `git checkout .` / `reset --hard` / `stash pop` / `git clean` anywhere (§9.2). No Azure, Entra or
SharePoint. No production data.

## FINDINGS

### F1 — The 09-14 orphan-worktree escalation is SPENT, and I split the live question out of it before discharging it rather than letting the discharge retire it.

This was handed to me by name: the 11:25Z run's F9 says *"DEFERRED to my next run, and named here so
it is not lost"*, and Station 04's 10:11Z F1 is the original measurement —
*"discharging the file as written would silently retire a live question it also contains."*

**The spent half, re-measured this run** (table under WHAT I MEASURED): `C:/po-fix1891` and
`C:/PR-Master/worktrees/pr1823` are absent from disk **and** from the worktree registry, and the
eighteen commits they held reached `main` through `#1823` (MERGED 09-11) and `#1891` (MERGED 09-14).
Three independent ways discharged: nothing to prune, nothing registered, work landed.

⚠️ **The file's own falsifying probe cannot fire as written** — it asks for a worktree returning *0
unpushed commits*, and both return **absent**, so a reader following it literally files
`[CANNOT MEASURE]` and leaves it open another cycle. That is why the discharge note says plainly that
absence is the stronger reading, and quotes the positive control (`po-vg` → **1**) that turns it from
an assumption into a measurement.

**The live half is the instrument question in its closing paragraph** — *should `status-sweep.ps1`
count unpushed commits as well as dirty files in its prune warning?* It is true today: `po-vg` is
flagged this run on `dirty=1` alone while holding **1** unpushed commit the warning never names, and
the protection is accidental — `git worktree remove` refuses on the dirty **file**, so removing that
one untracked file would make the same worktree read `dirty=0` and prunable, branch tip and all.

**DISPOSITION: ACTIONED.** Split performed and read back:
`two-orphaned-worktrees-hold-eighteen-unpushed-commits-2026-09-14.md` **moved** (never deleted) to
`needs-marco/discharged/` — source `Test-Path` **False**, destination **True**; a
`_DISCHARGE-NOTE-2026-09-17-two-orphaned-worktrees.md` written beside it naming exactly what was
measured; and the surviving question re-filed as
`needs-marco/status-sweep-prune-warning-ignores-unpushed-commits-2026-09-17.md`, RULE-1 ordered with
the complete-and-additive option first. `needs-marco/` count **57 → 57** — one out, one in, which is
the whole point of a split.

⚠️ **`needs-marco/` is gitignored — `git check-ignore -v` on the new file returns
`.gitignore:82:docs/pr-prompts/needs-marco/`, exit 0 — so this PR carries none of those three files
and this paragraph is the only channel by which the discharge is reported.** Falsifying probe:
re-run the sweep and read section 5; the discharged filename must no longer appear.

### F2 — The whole open board is parked on one human decision, and the two reds are not defects. Nothing here is agent-side work.

Both open PRs carry `do-not-merge` with the description
`escalates:true - Marco merges this, not automation (DOCTRINE 5b)`, both read `mergeStateStatus:
BLOCKED`, and **zero are DIRTY**. Their `13 pass / 2 fail` is the one cause counted twice that §9.4
predicts — `Approval receipt (CP-26)` and `PR gates — diff checks` both failing on
`[LABEL_PRESENT]`. §9.4 is explicit: **PARKED BY DESIGN, not a defect and not work**, and **only
Marco removes the label**.

Both are watcher-opened (2 prompt-log hits each, negative control 0, freshness control passing), so
§10.1 step 1 applies directly and step 2's hand-classification is not needed.

**DISPOSITION: ACTIONED** — verified and correctly classified; there is no agent-side action behind
`[LABEL_PRESENT]`. The verdict token is §9.4's own prescribed falsifying probe and it is what I read.

### F3 — I armed the gate-released slice this run, reversing the previous run's deferral, because the fact it turned on has changed.

The 11:25Z run held `pr-scopecards-s3-line-markup-all-types-HOLD.md` on a throughput argument:
*"the board grows monotonically until Marco merges. Arming faster makes the queue longer, not
shorter."* That argument is sound **when Marco is not draining**. [MEASURED] he is: **eight merges
today**, the newest at 11:27Z, and `#1995` at 09:04Z is a `feat(tendering)` PR outside `tests|docs`
that only a human could have merged. The open queue is two PRs aged 2.5 h and 3.1 h.

Against that, DOCTRINE §5b is directive and points the other way: *"Do NOT blanket-quarantine
`escalates: true` prompts … the right handling of an escalating prompt is: run it, open the PR, and
label it do-not-merge. Merging is the gate — not starting."* It also records the cost of the
cautious-looking sweep: *"it silently discards work Marco asked for."* Deferring once on a
throughput judgement is prudent; deferring the same prompt every run is a veto by attrition, and
§5b says the veto is not the station's to hold.

The prompt itself is the next link of a live chain — `cluster: scopecards`, `cluster_order: 4`, its
`requires_on_main` gate released by `#1995` **this morning** — and its `rollback_strategy` is
additive-only: *"one nullable `markup_override` Decimal(5,2) column … no `UPDATE ... SET`, no
default … re-running drops nothing."* It carries `gate_allow: migrations`, `seed_only: false`,
`backfill: false`, `escalates: true`, and a `design_ref`, so it will open as a `do-not-merge` PR for
Marco exactly as §5b intends. It is not on the never-arm list
(`pr-fv2-formrule-contract`, `pr-siteid-notnull-backfill`, MT-3/MT-5 prod-data).

**DISPOSITION: ACTIONED** — armed at `12:19:06Z` and read back four ways (file present/absent,
census `0 → 1`, arming-log byte and line delta, the new row quoted verbatim). The watcher had been
idle 141 minutes with an empty queue; it now has the next chain link. **The other gate-satisfied
candidate was NOT armed** — see F4.

### F4 — A prompt sits permanently in the ADMIT bucket that no lane the watcher can reach is allowed to build, and the triage tool will surface it as a candidate forever.

`pr-queue-layout-sot-entry-HOLD.md` lints ADMIT and appears under **GATES SATISFIED — CANDIDATES**
every run. It cannot be armed by me, and not for a reason the linter can see: arming hands the
prompt to the watcher, which builds through **Station 01**, and the authority matrix in
`STATION-CAPABILITIES.md` §5 gives 01 **no `/sot/` access** — `Edit /sot/` is ✅ for **05 only**.
**CP-24 then hard-fails any PR mixing `sot/` with code, with no escape hatch.** So arming it can only
produce a build that cannot legally land, and `lint-prompt.mjs` will keep returning ADMIT because its
gates ask about the premise, not about who is permitted to write the path.

This is the same shape §9.5 records elsewhere: **ADMIT is necessary, not sufficient**, and the
insufficiency here is a *lane* fact rather than a *content* fact — which is exactly the class no
instrument in the triage chain measures.

**DISPOSITION: DISPATCHED to Station 05 (SoT-keeper).** The work is a `/sot/` entry for
`QUEUE_LAYOUT_V1`, and 05 is the only station that may write it — via a doc-reconcile PR, which is
also the only shape CP-24 admits. 05 runs daily (`10 0 * * *`, `nextRunAt 2026-09-17T14:10Z`) and
reads this breadcrumb, so the hand-over needs nothing from me but naming it. I have left the prompt
`-HOLD.md` and untouched: it is not spent, it is not wrong, and it is not mine.

### F5 — The "a run cannot carry the full binding read" condition is INTERMITTENT, and this run is the counter-example. Do not let it harden into a standing exemption.

`needs-marco/binding-read-contract-exceeds-what-a-run-can-carry-2026-09-14.md` is open, and the
11:25Z run declared against it honestly: *"`DOCTRINE.md` is 2588 lines and I read §1–§9.1, §9.2, §9.3
(head), §9.4, §9.6 and §10.1 — not the whole of §9.5 or §10.2–§10.6."*

[MEASURED] **this run read all three in full** — `00-supervisor.md` 1350 lines, `DOCTRINE.md` 2589
lines end to end, `STATION-CAPABILITIES.md` 545 lines — and it mattered: **§10.6's correction about
directory-form `scope:` entries is what settled F3's duplicate flag**, §9.5's `checkHumanGate`
over-reporting bullet is what told me to settle a grep hit with the linter rather than on the grep,
and §9.3's `*>` UTF-16LE bullet is why both sweep captures decoded rather than reading as 380
structureless lines. All three sit in the region the previous run did not reach.

**So the escalation's premise is "sometimes", not "always"** — and that distinction decides what
Marco is being asked for. A standing exemption from reading the binding documents is a very
different request from a budget or a restructure, and an escalation that reads as the former when the
latter is true will get the wrong answer.

**DISPOSITION: DEFERRED**, with the trigger named. I did not edit the escalation, because amending
someone else's open question on the strength of one counter-example is how a live finding gets
quietly narrowed, and the file is gitignored so the amendment would reach nobody anyway.
**What would make it urgent:** a run declaring a partial binding read and then filing a finding that
one of the unread sections already answers — at which point the cost is measured rather than
hypothetical, and the escalation should be re-put to Marco as *"split DOCTRINE §9/§10 into a
separately-loadable instrument index"* rather than as *"stations may read less."*

### F6 — Deferred, with the trigger that would change each one.

- **`'00': 2` in `check-breadcrumb.mjs`'s `CADENCE` map against a live hourly cron.** Confirmed
  again this run (`00 … (cadence 2h) ok`). It is a one-character `scripts/` fix, outside my lane to
  merge, and already filed for Marco. Its effect today is nil — `lastRunAt` and the breadcrumb agree
  for all four stations — but it means a green `--freshness` is a weaker statement about `00` than
  about any other station. **Urgent when:** a 00 occurrence is missed and `--freshness` still reads
  `ok`, which takes three consecutive misses at the current threshold.
- **F5 of the 11:25Z run — the §9.3 `node -e "…\uXXXX…"` bullet lands in the hash-gated `instruments
  v2` canonical block.** Still deferred for the same reason my predecessor gave, which my station
  doc endorses in as many words: a canonical-block change must be re-recorded and shipped across all
  seven docs in one PR, *"more than a collect run should carry."* **Urgent when:** a station reports
  a file clean off an inline `node -e` probe, or any other §9 change forces a re-record, at which
  point this rides along for free.
- **`po-vg`, parked 13.2 days, and the 447-local-branch / 54-remote-tracking-ref count.** Both are
  Station 04 findings the 11:25Z run already dispositioned (F10, F11) and both are irreversible
  decisions or instrument noise rather than work. Nothing changed this run; the numbers are STATE and
  are re-measured above rather than quoted forward. **Urgent when:** a run files a branch finding off
  `git branch -r` instead of asking the remote, or `po-vg`'s one untracked file is removed — which
  would turn F1's latent defect live inside the hour.

## WHAT I DID NOT DO

**I did not merge anything, and did not remove a `do-not-merge` label.** Both open PRs are
`[LABEL_PRESENT]`; only Marco removes it, and a station may not clear a watcher routing verdict
(§10.1 step 1, `STATION-CAPABILITIES.md` §5 gate 1). I did not open, close, rebase or update-branch
either of them.

**I did not arm a second prompt.** RULE 4 is one at a time, and `arm-prompt.ps1` enforces it — it
checks *"no other prompt is already armed"* before it will rename. The other gate-satisfied
candidate is dispatched to 05 in F4 rather than armed, for a lane reason the linter cannot see.

**I did not restart, kill or touch the watcher.** RUNNING pid 30248, wrapper alive ×2, empty queue.
A 141-minute heartbeat on `armed: 0` is the documented idle reading, not a stall. I did not run the
ENSURE-UP relaunch either: the wrapper count is **2**, not the `wrapper=0` that block is written for,
so there was no question to resolve by parent chain.

**I did not dispatch the sweep's `watcher clone: dirty=3` line to Station 03.** Re-derived from its
own source this run: `--untracked-files=no` → EMPTY, and two of the three files are review verdicts
the `rev-<N>` job writes into the clone by design. §9.5 records thirteen verbatim mis-routings of
that line in `archive/`; this is not the fourteenth.

**I did not delete a remote ref, prune a worktree, or drop a stash.** All three are irreversible
(§5.4) and none is a station's, however well evidenced — including `po-fix1891` and `pr1823`, which
are already gone, and `po-vg`, which is not.

**I did not edit the open escalation in F5, or any other file under `needs-marco/`** beyond the
split F1 describes. I did not delete anything there; the spent file was **moved**.

**I did not run `git` against the mount**, did not commit on `main`, did not work in the dev tree or
the watcher clone for anything but reads and the serialized arm, and did not run `git checkout .` /
`reset --hard` / `stash pop` / `git clean` anywhere (§9.2).

**I did not leave an untracked breadcrumb in the dev tree.** This file was written inside the PR
worktree — cure 1 — so the post-merge fast-forward has one blocker fewer. The two breadcrumbs this
PR archives are the case cure 2 covers, and the dev tree will need the §9.2-safe restore sequence
after this PR lands.

**I did not write to `docs/qa/qa-findings.md` or any other gitignored sink.** Every finding above is
in this tracked breadcrumb — which is also the only place the `needs-marco/` discharge in F1 is
reported at all.

**I did not touch Azure, Entra or SharePoint**, did not write production data, and did not edit
`sot/`.
