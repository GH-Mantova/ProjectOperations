# Station 00 — Supervisor | 2026-08-27T00:08:26Z–2026-08-27T00:27:00Z

## GROUND

```
UTC            2026-08-27T00:08:26Z
origin/main    549537a4              (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 7ad50697 -> 549537a4   C:\ProjectOperations2   (was 8 behind; FAST-FORWARDED this run)
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (scheduled-task SKILL.md station_doc_version)
```

Versions **AGREE**. Full-authority run.

**NOT blind.** Desktop Commander present; PowerShell 5.1 on the box; `REACH_OK 2026-08-27T00:08:26Z`.
Machine clock is Brisbane UTC+10 (local 10:08 == UTC 00:08Z). Every timestamp below is UTC unless
it says local.

---

## WHAT I MEASURED

### Instrument controls, run first (DOCTRINE §7)

- `[MEASURED]` **DC `-Command "$..."` is stripped — confirmed again.** The first probe died with
  `You must provide a value expression following the '+' operator`. Everything after that ran
  through an **interactive** `powershell.exe` session via `interact_with_process`, where `$` survives.
- `[MEASURED]` 🔴 **NEW INSTRUMENT TRAP.** `@(gh pr checks N --json ... | Out-String | ConvertFrom-Json | Where-Object {...})`
  collapses to **ONE object whose properties are arrays** — the filter is a silent no-op and prints
  all 13 checks as if one had failed. The **assign-then-foreach** form
  (`$c = gh ... | ConvertFrom-Json; foreach ($x in @($c)) {...}`) returned the correct **1**.
  This is DOCTRINE §9.4's array-collapse, and it bites the *inline* form specifically.
- `[MEASURED]` `git ls-tree` positive control: `-r ... -- docs/pipeline/DOCTRINE.md` returned **1**.
  So `INCOMING_READY = 0` below is a real zero, not a blind query.
- `[MEASURED]` Label-read positive control: #1344 read `labels=do-not-merge` in the same call in
  which #1343 read empty. The JSON path is not the broken-`--jq` lie.
- `[MEASURED]` `gh` resolves at `C:\Program Files\GitHub CLI\gh.exe` **before** any lint verdict was
  believed (04's §9.5 inversion: `gh` absent ⇒ false ADMIT with file-gates silently waived).
- `[MEASURED]` Premise polarity control: `no inline .if. expression` present in DOCTRINE = **True**;
  negative control `no inline zzzz expression` = **False**. The instrument discriminates.

### Board

```
[MEASURED] 00:09Z  open = 2   #1344 UNSTABLE labels=do-not-merge   #1343 CLEAN labels=[]
[MEASURED] 00:23Z  open = 4   + #1345 CLEAN, + #1346 BLOCKED   (both from ONE prompt — see F1)
[MEASURED] 00:24Z  open = 3   #1346 CLOSED by me as a duplicate
[MEASURED] trunk 549537a4 by `gh api .../commits/<sha>/check-runs` = 12 success + 1 correctly-skipped
           `PR gates` (a push to main has no PR).  TRUNK GREEN.
           NOT quoted from status-sweep, whose TRUNK verdict is a coin flip.
```

### RULE 2 — the live routing probe, re-measured this run

`[MEASURED]` `processed/<prompt>.md.log` -> `"marco":true`:

```
marco=True   pr-lessons-folder-s2-unfold-sot05-ready.md.log   -> #1344
marco=True   pr-ew-s2b-alloc-engine-core-ready.md.log         -> #1343
marco=False  rev-1344 / rev-1343 / rev-1342 / rev-1341 / rev-1340 / rev-1339 / rev-1338
```

Control holds: **12 prompt logs hit, 0 `rev-*` logs hit.** #1343 and #1344 are both watcher-routed
to Marco. **DO NOT MERGE EITHER.**

### #1344 — its only red is the gate, by design

`[MEASURED]` Read from the job log (`gh run view 33020050416 --job 98347942046 --log`), never the PR page:

```
PASS - CP-11 / CP-12 / CP-13 / CP-17 / CP-23 / CP-25
PASS - CP-24 sot-purity [sot-only change (doc-reconcile PR)]
SKIP - CP-09/10, CP-22
FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true).
       A human must review and REMOVE the label; removing it is what releases the merge.]
```

The 5 other non-green checks are `SKIPPED` by the changed-path filter on a docs/sot diff. The work
is real: `+708 / -698` across 4 extracted docs plus `sot/05` reduced to pointers.

### Watcher chain

```
[MEASURED] 00:09Z  node pid 29024, up since 2026-08-24T05:35:04Z   (unchanged for 2.7 d)
[MEASURED] 00:13:08Z  [queue] pr-doctrine-s9-four-false-traps-ready.md (depth 1, source: watch)
[MEASURED] 00:13:08Z  [start] pr-doctrine-s9-four-false-traps-ready.md (max-turns=240)
[MEASURED] 00:13:13Z  Watcher exited with code 1 (raw node exit: -1)      <- node 29024 DIED
[MEASURED] 00:14:31Z  node count = 0.  Launcher pid 10364 still alive and did NOT restart it.
[MEASURED] 00:15:03Z  ensure-watcher.log: "RELAUNCHED - wrapper pid 23100"
[MEASURED] 00:15:25Z  "VERIFIED node pid 28328 ancestry: powershell:43236 <- powershell:23100 <- WmiPrvSE  detached=True"
[MEASURED] 00:25:13Z  restart-watcher-if-wedged.ps1 -> VERDICT: BUSY (heartbeat 0 min, churn 1 cycle
                      in 20 min vs threshold 4).  DO NOT RESTART.
```

`[MEASURED]` `Watcher exited with code 1 (raw node exit: -1)` has **98 prior occurrences** in
`watcher-launch.log`, the last on 2026-08-24T05:23Z. It is a recurring, non-deterministic failure
mode, not something this prompt uniquely triggers — the three prompts before it ran clean on the
same pid.

`[MEASURED]` The **Keepalive** recovered it, not the launcher. `[INFERRED]` The launcher wrapper
10364's own child chain died with the node and it did not relaunch; the PT10M Keepalive tick did.

`[MEASURED]` `watcher-launch.log` has been frozen at `00:13:13Z` ever since — the new chain does not
write to it, and no new `.log` appeared in `C:\po-watcher`. The live-log-filename-frozen-at-process-start
trap, confirmed. **Do not read watcher liveness off that file's mtime.**

### Post-restart machine state

```
[MEASURED] launchers  = 2   pids 10364 (old, 08-24) and 23100 (new, Keepalive).  node = 1 (28328).
[MEASURED] clone      C:\po-watcher\ProjectOperations still main @ 355dfdec — the restart did NOT
                      fast-forward it.  03's F1 confirmed by observation.
[MEASURED] stash list in the clone: 39 -> 41 across the crash+relaunch.  03's F6 prediction confirmed,
                      and it grew by TWO, not one.
```

### Queue

```
[MEASURED] 00:09Z  armed = 0
[MEASURED] 00:12Z  armed = 1   pr-doctrine-s9-four-false-traps-ready.md   (mine)
[MEASURED] 00:22Z  armed = 2   + rev-1345-ready.md
[MEASURED] 00:23Z  armed = 1   after I renamed the looping prompt        (rev-1345 only)
[MEASURED] 00:24Z  armed = 2   + rev-1346-ready.md  (auto-generated for the PR I had just closed)
[MEASURED] no-pr-opened/ newest = 2026-08-20;  failed/ newest = 2026-08-13.  Nothing new in either.
```

### Breadcrumb collection

`[MEASURED]` `node scripts/pipeline/check-breadcrumb.mjs --freshness` -> exit **1** (malformed), **not 2** (silence).

```
freshness:  00 2.3h ok | 02 dispatch-only | 03 1.4h ok | 04 2.1h ok | 05 10.2h ok
structure:  48 checked, 7 malformed, 7 skipped as pre-contract
```

**No station is SILENT.** All 7 malformed are Station 06's, all with the same two defects (no
`# Station <NN>` heading, no disposition line) — already known and already dispatched; not re-raised.

New since my 22:08Z run: **one** breadcrumb —
`00-03-machine-minder-2026-08-26-2301-clone-diverged-cannot-ff-and-five-staged-in-the-shared-index.md`.
Its seven findings are dispositioned below. (04's 22:18Z and my own 22:08Z were collected last run.)

---

## WHAT CHANGED

Four mutations, each read back:

1. **Fast-forwarded the dev tree.** `git merge --ff-only origin/main` -> exit 0,
   `Updating 7ad50697..549537a4`, 24 files. Read back: `HEAD = 549537a4`, `BEHIND = 0`,
   staged entries still **5** (untouched), armed still **0** (no prompt armed by the FF).
   Pre-checked: incoming depth-1 `*-ready.md` = **0** (control passed), overlap between the 24
   incoming paths and the 5 staged paths = **0**, and with the 53 dirty paths = **0**.
2. **Armed `pr-doctrine-s9-four-false-traps-HOLD.md`** by `git mv` to `-ready.md`. Read back: on
   disk, HOLD gone, armed 0 -> 1, index carries only my entry plus the 4 pre-existing ones.
3. **Disarmed it again to `-LOOPING.md`** by `git mv`, after it ran twice (F1). Read back: `-ready.md`
   gone, `-LOOPING.md` present, armed back to review-jobs only.
4. **Closed #1346** as a duplicate, with a comment naming the cause. Read back:
   `gh pr view 1346 -> state=CLOSED closed=True`.

**Not done:** no merge, no label added or removed, no restart, no kill, no `sot/` edit, no commit,
no push, nothing in `C:\po-watcher\ProjectOperations`, nothing near Azure/Entra/SharePoint.

---

## FINDINGS

### F1. I armed a prompt, the watcher died 5 s into it, and the SAME prompt then produced TWO PRs. Stopped at two.

`[MEASURED]` Sequence, all from the box:

```
00:12:0xZ  I git mv'd pr-doctrine-s9-four-false-traps-HOLD.md -> -ready.md   (armed 0 -> 1)
00:13:08Z  watcher pid 29024 logged [queue] then [start] on it
00:13:13Z  watcher pid 29024 exited code 1 (raw node exit -1).  node count 0.
00:15:08Z  Keepalive relaunched -> node pid 28328
00:19:36Z  PR #1345 opened  docs/doctrine-section-9-corrections            CLEAN   +20 -14
00:22:27Z  PR #1346 opened  feat/doctrine-section-9-four-measured-false-traps  BLOCKED +19 -14
00:23:xxZ  I git mv'd the still-armed -ready.md -> -LOOPING.md
```

`[INFERRED]` The node died but **its spawned agent survived and finished**, opening #1345. Because
the watcher never reached the step that consumes the prompt file, the prompt was **still armed**
when the relaunched watcher globbed the queue, so it ran a second time and opened #1346. There is
**no `processed/pr-doctrine-s9-*.log` at all** — consistent with the consume step never running,
and it is why no `marco:true` routing decision exists for either PR.

This is §3c LOOP, and §3c's remedy is exactly what I applied: rename to `*-LOOPING.md` so it cannot
run a third time. Verified on disk.

`[MEASURED]` The crash shape is not new: **98** `raw node exit: -1` lines in `watcher-launch.log`,
most recently 2026-08-24T05:23Z. The three prompts immediately before this one ran clean on the same
pid, so this is not a poison prompt.

🔴 **The durable defect is that a mid-run watcher death leaves the prompt ARMED, so the restart
re-fires it.** Nothing in the chain reconciles armed prompts against already-open PRs on restart —
`00-supervisor.md` §6 tells *me* to do that reconciliation by hand, which means it only happens
every 2 hours and only if a supervisor run is not blind.

RULE 1, complete-and-additive first:

- **(a) COMPLETE + ADDITIVE — claim the prompt before running it.** Have the watcher write an
  ownership marker (prompt name + pid + UTC) at `[start]`, and on startup refuse to run any armed
  prompt that already carries one, routing it to `needs-marco/` or `*-LOOPING.md` instead. Solves it
  immediately and permanently, destroys no queue entry, and loses no work — a genuinely interrupted
  prompt is surfaced for a human rather than silently re-fired. Passes both halves.
- **(b) Reconcile on startup by querying the board** — on relaunch, for each armed prompt, search
  open PRs for a branch matching its slug and disarm on a hit. Fails the *future* half: the match is
  heuristic (#1345 and #1346 chose two different branch names for the same prompt), so it will
  both miss and false-positive, and a false positive silently disarms real work.
- **(c) Leave it to the 2-hourly supervisor.** Fails the *immediate* half — this run only caught it
  because the crash happened while a supervisor was watching. Overnight it is two duplicate PRs and
  a wasted agent run, every time.

**ESCALATED** — (a) needs a `scripts/pr-watcher/**` change, which is a watcher-lifecycle change, and
merging one requires an idle-window restart plus a clone fast-forward that is itself blocked (F2).
Marco's call on whether to schedule that.

### F2. The watcher clone is DIVERGED and a restart proved it cannot self-heal. 03 asked me to authorise the repair.

`[MEASURED]` `C:\po-watcher\ProjectOperations` is `main @ 355dfdec`, 12 behind / **1 ahead** of
`origin/main @ 549537a4`; the one local commit is `355dfdec docs(pr-reviews): verdict on pr-1339`,
committed directly to `main` in the shared clone. `[MEASURED]` The restart at 00:15Z did **not**
move it — still `355dfdec` at 00:24Z. `[MEASURED]` Stashes 39 -> 41 across the same restart.

03 measured the blast radius as small: **zero** of the 12 missing commits touch `scripts/pr-watcher/**`,
so the running `index.mjs` is current. The exposure is future: the first watcher-code PR to land will
silently not take effect, and F1's fix is exactly such a PR.

RULE 1, complete-and-additive first:

- **(a) COMPLETE + ADDITIVE.** Re-confirm `355dfdec` is contained in `origin/feat/orphaned-discharge-guard`
  (03 measured it is, and its content is already on `origin/main`), `git stash push --include-untracked`
  the dirty paths, then `git reset --hard origin/main` on `main` **in the clone only**, with the
  watcher stopped. Nothing is lost — the commit is redundant, the dirty paths are the archive sweep's
  own deletions, the stash is reversible. Passes both halves.
- **(b) `git merge --ff-only`.** Fails the *immediate* half: it is refused outright while diverged.
- **(c) Leave it.** Fails the *future* half: every merge widens the gap.

**ESCALATED** — `reset --hard` in a shared tree is a DOCTRINE §5 item 4 irreversible action, and
`00-supervisor.md` marks git-in-the-watcher-repo an **ABSOLUTE** never for this station. I will not
reason past either. Marco authorises, or dispatches 03 with an explicit grant.

### F3. `lint-prompt.mjs` in the dev tree was 3 versions stale. Fixed — and the newest version immediately caught something the old one could not.

03's F2. `[MEASURED]` The dev tree was 8 behind and the only `scripts/` files in the gap were
`lint-prompt.mjs`, its test, and `__tests__/lint-prompt.human-gate.test.mjs` — i.e. #1330
`GATE_RELEASED`, #1336 human-gate detector, #1340 `ORPHANED_DISCHARGE`.

I fast-forwarded before arming anything (see WHAT CHANGED 1). `[MEASURED]` Proof it mattered — the
negative control on a prompt that drops database tables:

```
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-524-rates-b-slice2-canonical-HOLD.md
REJECT  [HUMAN_GATE_PRESENT]  line 3 contains DO NOT ARM.
exit 1
```

🔴 **DOCTRINE §9.5 is now partly out of date in the safe direction:** it says the linter "cannot see"
`DO NOT ARM` markers. Post-#1336 it **can**, and REJECTs on them. The rule to keep is the weaker one —
ADMIT is still necessary-not-sufficient, because the linter still does not gate the `requires_*`
family or `docs/approvals/`. **DISPATCHED** to Station 04 as an addition to its own §9 correction
work (PR #1345 is already in flight on §9; this is a further bullet, not a conflict).

### F4. Five entries sit STAGED in the dev tree's shared index. Still five. Still not mine to sweep.

03's F3, re-measured at 00:23Z after all my mutations:

```
A    docs/pr-prompts/00-04-scanner-2026-08-26-2218-instrument-honesty-four-false-traps.md
A    docs/pr-prompts/pr-doctrine-s9-four-false-traps-LOOPING.md      <- was -HOLD, then -ready, now -LOOPING (mine)
R100 pr-ew-s2b-alloc-engine-core-HOLD.md        -> ...-ready.md      (consumed; orphan rename)
R100 pr-lessons-folder-s2-unfold-sot05-HOLD.md  -> ...-ready.md      (consumed; orphan rename)
R100 pr-sot-02-reconcile-2026-08-19-HOLD.md     -> ...-ready.md      (consumed; orphan rename)
```

`[MEASURED]` I checked `git diff --cached --name-status` before and after **every** mutation and used
`git mv` (which stages precisely one path) rather than `git add`. Nothing of another chat's was
disturbed. **Any commit here without a pathspec still ships all five.**

**DEFERRED** — deliberately. `git reset` would throw away another chat's staging with no record
(fails the future half of RULE 1), and committing them belongs in a board PR with a chosen pathspec,
not in a run that has already made four mutations. It becomes urgent the moment any station needs to
commit in the dev tree. Next 00: **commit with an explicit pathspec, always.**

### F5. 04's "`watcher-launch.log` is dead" — 03 refuted it, and today it is half-true again for a new reason.

03's F4 measured the file at 1.6 MB with a live 5-minute cadence, so "dead" was wrong.
`[MEASURED]` But since 00:13:13Z the file has not been written at all, while the watcher is
demonstrably alive (heartbeat 0 min, two PRs opened, two review jobs armed). The correct statement
for both cases: **the log filename is bound at process start; after a relaunch the old file goes
quiet and its mtime says nothing about liveness.**

**DISPATCHED** to Station 04, to fold into its instrument note alongside 03's F4 correction.

### F6. Duplicate launcher wrappers: two `watcher-launcher-singlelane.ps1` are running.

`[MEASURED]` pids **10364** (started 2026-08-24, whose node died at 00:13:13Z and which did not
relaunch it) and **23100** (started 00:15:03Z by the Keepalive). One node (28328); the
single-instance guard is holding.

`[INFERRED]` Not harmful right now, but if node 28328 exits, two wrappers may race to restart it, and
10364 has already demonstrated it does not restart reliably. Killing 10364 is a machine repair in
03's lane, and this station's §3b ENSURE-UP block — which would have *started yet another* wrapper —
is already recorded as a defect.

**DISPATCHED** to Station 03 (next scheduled run ~03:00Z): identify pid 10364 by command line,
report what it is, then terminate the stale wrapper and confirm exactly one launcher and one node
remain. Do not kill by image name.

### F7. `rev-1346-ready.md` armed itself for a PR I had just closed.

`[MEASURED]` #1346 closed 00:24Z; `rev-1346-ready.md` present at 00:24:54Z. `[INFERRED]` The review
job will run and produce a verdict on a closed PR — one wasted agent run, no damage.

**DEFERRED** — the cost is one run. It becomes worth fixing if closing duplicates becomes routine;
the natural home is the same startup-reconciliation change as F1(a).

### F8. Board: three open PRs, all three gated on Marco. Nothing was mergeable by me.

```
#1343  CLEAN, 13/13 green, labels=[]      — watcher-routed marco:true.  RULE 2.  NOT MERGED.
#1344  UNSTABLE, only red is CP-26        — do-not-merge label; only Marco removes it.  NOT MERGED.
#1345  CLEAN, 8 success + 5 path-skipped  — no label, no routing decision exists (F1).
```

On **#1345** I deliberately stopped short of merging. `rev-1345-ready.md` was **armed at the moment I
looked**, i.e. the watcher is mid-lane on that exact PR, and the DISPATCH-UNAVAILABLE FALLBACK's
single-actor condition says: if something else is acting, STOP — that is the LL-38 collision. The
`tests-docs` policy auto-merges docs PRs itself. `[MEASURED]` Its diff is complete and correct
against the prompt's `done_when`: the four §9 claims corrected, the canonical block bumped
`instruments v1 -> v2`, and `_canonical-blocks.json` re-recorded `version 2 / sha f012f0596e33037c`.

**DEFERRED** to the next 00 run: if #1345 is still open, still green, still unlabelled and
`processed/rev-1345-ready.md.log` shows no `"marco":true`, merge it via
`Assert-SmokedOrEscalate` -> `Merge-Pr`.

### F9. Standing escalations, re-checked and NOT re-raised.

`[MEASURED]` Station 06 still has no scheduled task; the 7 malformed breadcrumbs are all 06's. Both
were escalated at 16:09Z with RULE-1 options, and the verdict-funnel loss was escalated at 21:15Z.
Re-raising them each run trains Marco to skim.

**DEFERRED** — carried, not repeated. They become urgent again only if 06 starts arming or merging
out of lane a second time.

---

## WHAT I DID NOT DO

- **Did not merge anything.** #1343 and #1344 are RULE-2 / label gated; #1345 has another actor on it.
- **Did not remove or add any label.** CP-26 red on #1344 **is** the gate; driving it green would be
  driving through the gate.
- **Did not touch `C:\po-watcher\ProjectOperations`** — not the divergence, not the 41 stashes, not
  the 37 dirty paths. ABSOLUTE for this station; escalated as F2 instead.
- **Did not restart, kill or relaunch anything.** The sanctioned verdict was **BUSY** and the
  Keepalive had already recovered the chain correctly. I did not run §3b ENSURE-UP, which would have
  started a third wrapper on top of the two in F6.
- **Did not `git reset` the five staged entries**, and did not commit in the dev tree at all.
- **Did not re-arm the LOOPING prompt**, and did not arm a second prompt (RULE 4, one at a time).
- **Did not edit `/sot/`**, DOCTRINE, or any station document — including for the F3 and F5
  corrections, which are dispatched, not self-applied.
- **Did not run `git` through the device bridge.** Every git call was native PowerShell on the host.
- **Did not go near Azure, Entra or SharePoint.**

---

**This breadcrumb is UNTRACKED until a board PR commits it.** Every claim is stamped against
`origin/main 549537a4`, dev tree `549537a4`, clone `355dfdec`, watcher node pid `28328`. Anything read
after those move is a lead, not a finding.
