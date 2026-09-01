# Station 04 — Scanner | 2026-09-01T10:10Z–2026-09-01T10:35Z

## GROUND

```
UTC            2026-09-01T10:10:55Z
origin/main    605aca10            (fetched, then rev-parse)
dev tree       main @ 755255ab      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/04-scanner.md)
bootstrap      1                    (C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md)
```

Versions agree — this run was NOT read-only-by-mismatch.

**SIGHTED run.** `start_process` on `powershell.exe` succeeded on the first attempt; every claim
below was measured on the Windows host. This was not a quiet blind run dressed as coverage.

Working copies of the three binding documents were diffed against `origin/main` before being
trusted — `git diff --stat origin/main -- docs/pipeline/stations/04-scanner.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/sweep-rotation.json`
returned **empty**, so the dev tree's copies are byte-identical to `main` despite the tree being
behind it.

**Sweep this run: `instruction-drift`** — assigned, not chosen.
`node scripts/pipeline/next-sweep.mjs` → `SWEEP: instruction-drift (rotation position 4 of 4;
previous run: 2026-08-31T18:10:27Z)`.

## WHAT I MEASURED

**Locks, first, per the standing instruction.** `[MEASURED]` No `index.lock` in the dev tree
(`C:\ProjectOperations2\.git\`), the watcher clone (`C:\po-watcher\ProjectOperations\.git\`), or
`C:\po-watcher\.git\`. Three probes, three misses. The device-bridge lock did not recur this cycle.

**Sweep verdict.** `[MEASURED]` `scripts/pipeline/status-sweep.ps1` exit 0,
`SWEEP COMPLETE 2026-09-01 10:11:36Z`, verdict **CAUTION** — "no local lock, but a PR was touched
on GitHub in the last 2 min". I mutated nothing on the board, so CAUTION did not bind anything I
did; the two prompts I staged are new untracked files and touch no existing board state.

**Board, from the sweep's own `[LIVE]` lines.** `[MEASURED]` 3 open PRs.
`#1492` CLEAN, CI 14 pass / 0 fail / 0 pending. `#1483` BLOCKED, 12/0/1. `#1477` BLOCKED,
10 pass / **2 fail** / 1 pending. Trunk on `605aca10`: 4 success / 0 failed / 0 running — green.
I did not hand-classify lanes because I merge nothing; whoever does must, per DOCTRINE §10.1.

**Watcher.** `[MEASURED]` `watcher node: NOT RUNNING` — confirmed independently with a second
instrument, `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` filtered on
`pr-watcher|index.mjs|supervise-watcher|watcher-launcher`, which returned **zero rows**. Wrapper
alive (5), heartbeat age 104 min, watcher clone `branch=main dirty=4`. The queue will not drain
while this holds. Not mine to restart.

**Bootstraps vs repo station docs.** `[MEASURED]` Five live bootstraps under
`C:\Users\Marco\Claude\Scheduled\` (`00`, `02`, `03`, `04`, `05`), each 103 lines, each declaring
`station_doc_version: 1`, each naming a station doc that resolves. Repo side, on `origin/main`, all
six station docs also declare `station_doc_version: 1`. **Ten of ten agree.** The five
`projectops-*` files that used to muddy this listing are correctly filed under
`_retired-2026-08-18/` and declare no version.

**The bootstraps were repaired, and this run found the receipt.** `[MEASURED]`
`node C:\po-sup-fix-scripts\fix-station-bootstraps.mjs --dry` →
`SUMMARY changed=0 already-clean=5 not-touched=0`, five `[SKIP] … already corrected (A=true B=true)`.
The script itself is 4908 B, mtime **2026-09-01T00:07:33Z**; all five bootstraps have mtime
**2026-09-01T00:07:44Z** — eleven seconds later. Somebody edited the script and ran it for real,
overnight. `[INFERRED]` from the mtime pair: the standing "may 00 run it?" escalation has been
overtaken by events on its measurable half.

**Doc linter.** `[MEASURED]` `node scripts/pipeline/lint-station.mjs` exit 0 —
`ADMIT: all 7 docs clean`. One advisory on my own doc: *"names a Windows path outside the known
folder map: `C:\po-scan-`"*. That string sits inside the commented-out, explicitly SUPERSEDED
worktree recipe in the CLEAN-TREE MANDATE. It is a comment about a practice the same file forbids.
Not a defect; noted so the next run does not re-open it.

**Compiled agents — the whole `SHARED-DOCTRINE` thread is DISCHARGED.** `[MEASURED]`
`scripts/pipeline/install-agents.ps1` now opens with
`# [STOP] RETIRED 2026-08-31 - THIS SCRIPT WOULD DESTROY THE AGENTS IT CLAIMS TO INSTALL. DO NOT RUN.`
and states the replacement rule: the doctrine lives in `docs/pipeline/DOCTRINE.md` and the agents
point at it. Six of the nine `.claude/agents/*.md` were rewritten at 2026-09-01T00:38:06Z and each
now cites `docs/pipeline/DOCTRINE.md` **twice**. `node scripts/pipeline/check-agent-doctrine.mjs`
exit 0: `7 station agent(s) checked, 0 in violation`, and it carries its own controls —
`positive(copy is caught)=true negative(pointer passes)=true`. **Do not re-raise this.**

**Path resolution — and my first instrument was a liar.** `[MEASURED]` A regex sweep of every
repo-relative path named by `DOCTRINE.md`, `STATION-CAPABILITIES.md` and the six station docs
returned **82 unresolved**. Almost all were false: prose fragments (`sot/05`,
`sot/01/02/03/05/06`, `tests/docs`), truncated filename *prefixes* (`docs/pr-prompts/00-`,
`docs/pr-reviews/pr-`), and paths that are deliberately gitignored. Narrowing to references that
carry a real file extension, then subtracting everything `git check-ignore` confirms is
intentionally excluded, gives **12 candidates, 7 explained by `.gitignore`, 5 unexplained**.
Positive control on the same run: `docs/pipeline/DOCTRINE.md`,
`scripts/pipeline/lint-station.mjs` and `scripts/pipeline/status-sweep.ps1` all resolve. The first
number was the instrument, not the world; the finding is the second.

The five, each probed individually for on-disk / tracked / ignored:

```
docs/pr-prompts/triage-state.md          onDisk=False tracked=False gitignored=False
docs/pr-prompts/queue-watch-state.md     onDisk=True  tracked=False gitignored=False
docs/pr-prompts/AWAITING-MARCO-DECISION.md onDisk=False tracked=False gitignored=False
docs/qa/qa-github-audit.md               onDisk=False tracked=False gitignored=False
docs/qa/Master-QA-and-Consolidation-Program-Plan.md onDisk=False tracked=False gitignored=False
```

**Arming state, read from the dev tree only.** `[MEASURED]` `git ls-tree origin/main
docs/pr-prompts/` shows **zero tracked `*-ready.md`** — the BOARD TRAP is not present this cycle.
One armed prompt on disk: `pr-gates-approval-receipt-ready.md`. `git status --porcelain` shows
` D docs/pr-prompts/pr-gates-approval-receipt-HOLD.md` — a *worktree* deletion, unstaged. That is
`RD`-free, i.e. the healthy post-`arm-prompt.ps1` shape, not the staged-rename-with-no-file trap.
`.arming-log.txt` last line: `2026-09-01T09:07:42Z ARMED pr-gates-approval-receipt escalates=true
by=Marco@`. That prompt is the origin of open PR `#1492`.

**A limit on the arming log's `by=` field, stated because it will otherwise be misread.**
`[INFERRED]` Every actor on this box — Marco, the watcher, and every scheduled station — runs as
the same Windows account. `by=Marco@` therefore records the *OS user*, not a human. It cannot
distinguish "Marco armed this" from "an agent armed this", and must never be quoted as evidence
that a human authorised an `escalates=true` arm.

**Station 06 still has no cadence.** `[MEASURED]` `docs/pipeline/stations/06-pr-master.md` and
`.claude/agents/06-pr-master.md` both exist and both lint clean, but there is no
`C:\Users\Marco\Claude\Scheduled\06-*` folder. This is an **already-open escalation**; recorded
here only as a confirmation that it is still true at `605aca10`. Not re-filed.

**Two stations, one host, one minute apart, opposite sight.** `[MEASURED]` Station 00's breadcrumb
for this same slot — `00-00-supervisor-2026-09-01-1010-blind-run-desktop-commander-connect-timeout.md`,
window 10:05Z–10:12Z — records `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT):
connection timed out after 30000ms`, three `ToolSearch` passes with a positive control, and
**no PowerShell on the host at all**. My window opened at 10:10:55Z, inside 00's, and
`start_process` returned a live shell on the **first** attempt. Same box, same account, overlapping
minutes, opposite outcomes. See F6.

## WHAT CHANGED

Three new **untracked** files in `C:\ProjectOperations2\docs\pr-prompts\`. Nothing else. No board
mutation, no arm, no disarm, no rename, no merge, no label, no push, no `git` write of any kind —
the index was empty before I started (`git diff --cached --name-status` returned nothing) and I
left it empty.

| file | what it is | verified how |
|---|---|---|
| `pr-station04-qa-audit-marker-contradiction-HOLD.md` | staged prompt, docs-only, size 1 | `lint-prompt.mjs` → **exit 0, ADMIT**, no warnings |
| `pr-statussweep-local-time-timestamps-HOLD.md` | staged prompt, `scripts/` , size 1 | `lint-prompt.mjs` → **exit 0, ADMIT**, no warnings |
| this breadcrumb | the run's report | `check-breadcrumb.mjs`, quoted below |

Both prompts first linted `ADMIT` **with** a `MISSING_STANDING_AUTHORITY` warning; I added the
standing-authority block to each and re-linted to a clean `ADMIT`. Both end `-HOLD.md`, which
matches no watcher glob, so **neither is armed and neither can self-arm**. Arming is 00's, on
Marco's authority.

`docs/pipeline/sweep-rotation.json` advanced — see the last line of this report.

## FINDINGS

### F1 — `status-sweep.ps1` prints file timestamps in local time, unmarked, inside a UTC report

`scripts/pipeline/status-sweep.ps1:279` and `:302` render mtimes with
`$f.LastWriteTime.ToString("MM-dd HH:mm")`: **local** clock, **no `Z`**, in a report whose GitHub
section and closing line both carry explicit `Z`. The host is `E. Australia Standard Time`
(UTC+10), so every file timestamp in the sweep reads **ten hours fresher than it is**, sitting
beside UTC lines that invite direct comparison.

Caught on a real reading, not by inspection. Section 4C printed
`freshest station summary: queue-watch-state.md  (09-01 06:26)` in a report closing
`SWEEP COMPLETE 2026-09-01 10:11:36Z` — apparently 3.8 h old. The file's actual
`LastWriteTimeUtc` is **2026-08-31 20:26:21Z**: 13.8 h old.

Controls, both run: the UTC lines really are UTC (`gh pr view 1487 --json mergedAt` matches §1's
`#1487 2026-09-01 09:38Z`), and these two sites are the **only** renders —
`Select-String -Pattern 'LastWriteTime\b'` returns `:143` (age arithmetic, no render), `:269` and
`:299` (`Sort-Object`, ordering only), and `:279` / `:302` (renders). `:143` subtracts two *local*
values and is correct as written; changing it to a mixed pair would introduce the very bug this
finding is about.

Severity S3, but it feeds freshness judgements at the two places stations look to decide whether
the previous run's summary is worth trusting — which is how a 14-hour-old snapshot gets read as
current. Fix is two lines: `LastWriteTimeUtc` + a literal `"Z"`. Acceptance is a readback (the
printed value equals `(Get-Item <file>).LastWriteTimeUtc` to the minute), not a green build.

Lane, stated up front: `scope` is `scripts/pipeline/**`, outside `^(tests|docs)/`, so
`classifyPolicyFiles` routes the PR to **Marco**. That is correct; do not widen the lane to get it
merged.

**DISPATCHED** → Station 00. Prompt authored, linted `ADMIT` and staged as
`docs/pr-prompts/pr-statussweep-local-time-timestamps-HOLD.md`. It is untracked, so it is not yet
a real queue entry (`PROMPT-SCHEMA.md`) — 00 commits it with this breadcrumb, then arms it under
RULE 4 when it chooses to.

### F2 — 04's own doc orders a tracked write on line 209 and forbids tracked writes on line 232

`docs/pipeline/stations/04-scanner.md:209` (Part 1a) tells this station to keep its
GitHub-reconciliation marker in `docs/qa/qa-github-audit.md`, *"create if absent"*. Line 232
(HARD RULES) says tracked-file writes are *"NONE except staged prompt files and `docs/qa/` state
files **(all gitignored)**"*.

The parenthetical is false. `.gitignore:107-111` names five `docs/qa/` paths;
`qa-github-audit.md` is not among them. Measured: `git check-ignore -q` exits **1** (not ignored),
`git ls-files --error-unmatch` exits **1** (not tracked), and the file does not exist on disk.
Positive control on a file the sentence *is* true about: `git check-ignore -q docs/qa/qa-findings.md`
exits **0**.

So the sentence is true of four of the five and false of the one Part 1 depends on, and a station
obeying both lines can only skip the marker — which is what has happened: the file has never been
created, and every Part 1 pass has re-scanned from no baseline.

RULE 1 shapes the fix. **Complete and additive: repoint the marker at the tracked breadcrumb the
REPORT CONTRACT already mandates** — Part 1's baseline then lives where every other Station 04
finding lives, visible to any `origin/main` reader, and the false parenthetical is replaced by the
accurate enumeration. The alternative, adding `qa-github-audit.md` to `.gitignore`, ends the
contradiction but fails the *future* half: the marker stays invisible to every station reading
`origin/main`, which is precisely the failure `.gitignore:108` already produced for nine days.

**DISPATCHED** → Station 00. Prompt authored, linted `ADMIT`, staged as
`docs/pr-prompts/pr-station04-qa-audit-marker-contradiction-HOLD.md`. Single-file and docs-only on
purpose, so the `tests|docs` auto-merge lane can take it without consuming Marco. Untracked until
00 commits it.

### F3 — three state files are named by the station docs as if they exist; two do not, one is invisible

`00-supervisor.md:388,549`, `02-board-driver.md:319` and `03-machine-minder.md:175` name
`docs/pr-prompts/triage-state.md`, `docs/pr-prompts/queue-watch-state.md` and
`docs/pr-prompts/AWAITING-MARCO-DECISION.md`. Measured at `605aca10`: `triage-state.md` and
`AWAITING-MARCO-DECISION.md` exist **nowhere** — not on disk, not tracked, not ignored.
`queue-watch-state.md` exists on disk, is **not tracked and not ignored**.

That third state is the harmful one and it is two defects wearing one filename. It is invisible to
every station that reads `origin/main` — including the `status-sweep` line that quotes it as "the
freshest station summary", which is quoting a file no other station can open. And an untracked
file inside a tracked directory is exactly what makes a dev-tree fast-forward fail, a trap this
pipeline has already paid for.

I did not stage a prompt for this. The honest fix touches `.gitignore` (a root file) *or* commits
the state file, and the choice between "make it tracked so stations can read it" and "make it
ignored so it stops breaking FF" is a design call about whether that summary is meant to be shared
— and the two dangling references may simply be dead and want deleting. Guessing would produce a
third wrong answer.

**DISPATCHED** → Station 00, as the owner of `00-supervisor.md` and of the queue directory. Three
concrete questions: is `queue-watch-state.md` meant to be readable by other stations (⇒ track it)
or scratch (⇒ ignore it); are `triage-state.md` and `AWAITING-MARCO-DECISION.md` live concepts or
dead references to delete; and should `status-sweep.ps1:302` stop advertising a file that no
`origin/main` reader can fetch.

### F4 — the bootstrap-drift escalation has been overtaken by events

The standing item — *"(A) standing authority for 00 to run `fix-station-bootstraps.mjs` / (B)
approve one run / (C) Marco pastes them"* — has been asking about work that is now **done**. All
five bootstraps are already corrected, the dry run changes nothing, versions agree ten of ten with
the repo, and the script's own mtime (00:07:33Z) eleven seconds before every bootstrap's
(00:07:44Z) is the receipt of a real run overnight on 2026-09-01.

The narrow authority question can outlive its own answer, but its urgency cannot: there is no
drift left to authorise a fix for. The companion thread — the compiled `.claude/agents/*.md`
carrying frozen 2026-08-17 doctrine — is separately and fully discharged: the generator is
retired with a `[STOP]` banner, the agents point at the live DOCTRINE, and
`check-agent-doctrine.mjs` passes with both controls green.

**ACTIONED** — as a measurement, and the disposition is precisely that this needs no further
measuring. Recorded so 00 can retire the "STATIONS: STOP RE-MEASURING IT" line from the open list
rather than paying another run to rediscover it. Nothing was changed to reach it: `--dry` writes
nothing, and I ran the script in dry mode only.

### F5 — the watcher is down, so nothing I staged will move on its own

`watcher node: NOT RUNNING`, confirmed on two instruments (the sweep's probe, and a direct
`Win32_Process` query on `node.exe` that returned zero matching rows). Wrapper alive (5),
heartbeat 104 min, watcher clone `branch=main dirty=4` — and a dirty clone is itself a reason the
watcher may refuse to start, so restarting the process without cleaning the clone may not be the
whole fix.

I state this not as news to 00 — its own sweep prints it — but because it changes how the rest of
this report should be read. Two staged prompts and a green `#1492` do not become progress while
the queue has no drainer. **The board's constraint this cycle is the watcher, not the queue.**

**DISPATCHED** → Station 03 (machine minder), which owns watcher liveness and clone hygiene, with
Station 00 to sequence it. Restarting the watcher is a mutating operation under STATION 00 in the
script registry and explicitly not mine; per my own doc, I report it and do not run it.

### F6 — blindness is per-session, not per-host: two stations split on it inside the same minute

`STATION-CAPABILITIES.md` §2 records that blindness is intermittent and that **its cause is not
known**, having already refuted the old "in the listing ⇒ cloud-fired ⇒ blind" rule. This cycle
produced an unusually clean discriminator, and it narrows the unknown.

Station 00 ran 10:05Z–10:12Z and was **blind**: `desktop-commander` reported `CONNECT_TIMEOUT`
after 30000 ms, three `ToolSearch` passes found no tool under any name (with a positive control
proving absence rather than slowness), and it correctly stopped at PREFLIGHT step 1 without
substituting GitHub reads. Station 04 — this run — started at 10:10:55Z, **inside 00's window**,
and got a PowerShell session on the Windows host on the first attempt, then ran `git`, `gh`, `node`
and PowerShell against the real tree for twenty-five minutes.

Same host, same Windows account, same scheduler, overlapping minutes, opposite outcomes. That is
evidence **against** any host-side or bridge-side cause — the box was demonstrably reachable while
00 could not reach it — and **for** a per-session MCP attachment failure: the toolkit simply never
attached to 00's session. It does not identify the cause, and I am not claiming it does; it
eliminates a family of them, which is worth more than another "intermittent, cause unknown" line.

This also confirms the contract's rule was load-bearing in both directions on the same day: 00's
blind run and a healthy quiet run would have looked identical, and 00 said so loudly instead.

**DISPATCHED** → Station 00, which owns `STATION-CAPABILITIES.md`. The datum belongs in §2 beside
the refuted listing rule: *a blind run and a sighted run can overlap on the same host in the same
minute, so blindness is a property of the session, not the machine.* Worth pairing with 00's own
breadcrumb, which is untracked and needs the same sweep-up.

## WHAT I DID NOT DO

- **Did not run Part 0 or Part 2 of the station brief.** The rotation assigned
  `instruction-drift` and the doc is explicit that the sweep is not my choice: a shallow pass over
  everything is why findings rot. Part 0's static audit and the live-site visual patrol are
  untouched this run and are owed by whichever run draws them.
- **Did not arm, disarm, rename, move or delete any prompt.** Two HOLDs written; both end
  `-HOLD.md` and match no watcher glob. The existing `pr-gates-approval-receipt-ready.md` was read
  and left exactly where it was.
- **Did not restart the watcher, clean the watcher clone, prune the eleven registry-escapee
  worktrees, or touch the two `stage-brandtheme` worktrees** the sweep lists as orphaned under a
  session id that is not mine. All are Station 03's, and one of them is another lane's live work —
  a `locked` worktree 92 minutes old is not obviously dead, and the sweep's own `age=-1 min` on
  both is a clock artefact I did not chase.
- **Did not merge, label, or classify a lane on any open PR**, including `#1492`, which is CLEAN
  with 14/14 green. RULE 2 and DOCTRINE §10.1 bind whoever does; I am read-only on the board and
  a CLEAN rollup from a station that merges nothing is not a merge recommendation.
- **Did not clear the ` D` on `pr-gates-approval-receipt-HOLD.md`.** It is the healthy
  post-arm shape, not the staged-`R100`-with-no-file trap, and `git restore` in the shared dev
  tree is how consumed prompts come back armed.
- **Did not stage a prompt for F3.** Three plausible fixes, one design question underneath, and a
  wrong guess would add a fourth dangling reference. It goes to 00 as a question.
- **Did not re-file Station 06's missing cadence.** Already escalated; confirmed still true and
  left alone.
- **Did not touch `/sot/`, Azure, Entra or SharePoint**, and wrote no production data.
- **Did not commit anything.** All three of my files are untracked in the dev tree at
  `C:\ProjectOperations2\docs\pr-prompts\` — **Station 00 must sweep them up**, or this run's
  output and both staged prompts stay invisible to every station that reads `origin/main`.
- **Did not touch the other lane's untracked files, and did not fast-forward the dev tree.**
  `git status --porcelain` at 10:34Z also shows `pr-brandtheme-s1-apply-the-saved-scheme-HOLD.md`,
  `pr-brandtheme-s2-hex-ratchet-HOLD.md` and `pr-sot-05-d24-theme-sequencing-reconcile-HOLD.md`
  untracked, plus `queue-watch-state.md` (F3) and 00's own blind-run breadcrumb. Those three
  brandtheme HOLDs match the two `stage-brandtheme` worktrees the sweep flagged — another lane's
  live work, not orphans to clean.

**For 00's collection, the exact list this run leaves behind** — one board PR, `docs/`-only:

```
?? docs/pr-prompts/00-04-scanner-2026-09-01-1010-instruction-drift-...-clock-is-local.md   (this report)
?? docs/pr-prompts/pr-station04-qa-audit-marker-contradiction-HOLD.md                      (F2)
?? docs/pr-prompts/pr-statussweep-local-time-timestamps-HOLD.md                            (F1)
 M docs/pipeline/sweep-rotation.json    last_index=3  last_run_utc=2026-09-01T10:10:55Z
```

`sweep-rotation.json` **must** ride with this breadcrumb. If it does not land, the next Station 04
run draws `instruction-drift` again and repeats a sweep that is now clean.

One thing I noticed and deliberately left: `git status` also reports ` M` on the tracked
`00-06-pr-master-2026-09-01-0525-...md` — a committed breadcrumb edited in the shared dev tree by
someone other than me. I did not write it, did not revert it, and did not stage it. Whoever collects
should look before committing: a breadcrumb is a record of a run, and an after-the-fact edit to a
landed one is either a correction worth keeping or a stray write worth understanding.
