# The two top links of the live watcher chain are not in the repository

**Opened 2026-09-04T23:2xZ by Station 00, on behalf of Station 04 (breadcrumb
`00-04-scanner-2026-09-04-2210-instruction-drift-bootstraps-clean-launcher-chain-unversioned.md`,
findings F1 and F3). At `origin/main f9961700`.**

04 measured that this concern is carried in the project-memory index and **nowhere else** —
`Select-String -Pattern 'ensure-watcher'` across the 16 open `needs-marco/*.md` returned **0**,
`'singlelane'` **0**, POSITIVE CONTROL `'watcher'` **7 files**, NEGATIVE `'zzzNoSuchZzz'` **0**.
DOCTRINE §5b says `needs-marco/` is the only real stop, and STATION-CAPABILITIES §2 records that a
device task may have no project-memory tool (Station 03 currently does not) — so the one station
whose lane *is* the watcher machines cannot read the only place this was written down.
**This file exists so that stops being true.** Its absence was half of 04's finding.

---

## 1. The chain is three deep; only the bottom link is versioned

[MEASURED] by 04 at 22:1xZ and re-confirmed by 03 at 23:01Z, both by `Get-CimInstance
Win32_Process` matched on **command line**, never image name (24 `node.exe` running, exactly one is
the watcher):

```
pid=35328 ppid=28504  powershell -File C:\po-watcher\watcher-launcher-singlelane.ps1     <- NOT in repo
pid=36224 ppid=35328  powershell -File C:\po-watcher\ProjectOperations\scripts\pr-watcher\start-watcher.ps1
pid=20000 ppid=36224  node --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs   <- tracked
```

- `C:\po-watcher\watcher-launcher-singlelane.ps1` — 2367 B, mtime `2026-08-18T02:41:02Z`, **running
  now**. `git ls-files` hits for `singlelane`: **0** (POSITIVE CONTROL `watcher-launcher.ps1` → 1).
- `C:\po-watcher\ensure-watcher.ps1` — 5266 B, mtime `2026-08-24T00:01:25Z`. Absent from
  `C:\ProjectOperations2\scripts\pr-watcher\` (`existsSync` → false). This is open escalation #19.
- `scripts/pr-watcher/index.mjs` — tracked. The only link CI can gate.

**Why this is S2 and not hygiene.** `docs/pipeline/stations/03-machine-minder.md:312` instructs the
relaunch step with *"source of truth: `ensure-watcher.ps1:10`"* — a line-number citation into a file
that is not in the repository. No PR can review it, no CI can gate it, `lint-station.mjs` cannot see
it, and DOCTRINE §9.5's *anchor by symbol, never by line number* cannot be enforced against a blob
that does not exist. A station following that instruction reads a line number into a file any
process on that box may have rewritten, with nothing that would tell it.

## 2. RULE 1 options — this is machine state on a shared box, so it is yours

- **(a) COMPLETE + ADDITIVE — move both files into `scripts/pr-watcher/`, repoint the scheduled task
  and `ensure-watcher.ps1:10` at the repo copies, and leave the `C:\po-watcher\` copies in place
  until the first successful supervised restart proves the new path.** Solves it immediately (both
  files become reviewable, greppable, CI-gatable and `lint-station.mjs`-visible) and permanently
  (any future edit arrives as a PR). Damages no existing or future data entry — nothing here reads
  or writes ERP data — and keeping the old copies until proven means a failed cutover cannot leave
  the board with no watcher. **Passes both halves of RULE 1.**
- **(b) Commit copies into the repo for review but keep the scheduled task pointing at
  `C:\po-watcher\`.** Fails *complete-for-the-future*: two copies begin diverging immediately, and
  the repo copy — the one every station and every grep finds — is the one that is **not** running.
  That is the decoy shape DOCTRINE §9.5 already records for the `processed/` probe, rebuilt on
  purpose.
- **(c) Leave it as-is now that this file exists.** Fails *complete-immediately*: the launcher stays
  unreviewable. It is still strictly better than yesterday, when the concern was invisible to
  Station 03 entirely — so if (a) is not approved, (c) is the floor, not nothing.

**The question, in one sentence:** *may Station 03 move `watcher-launcher-singlelane.ps1` and
`ensure-watcher.ps1` into `scripts/pr-watcher/` and repoint the scheduled task (option a)?*

---

## 3. Second item, same hand-off — the bootstrap layer needs one repaste

04's F3. Only you repaste the five `C:\Users\Marco\Claude\Scheduled\*\SKILL.md` bootstraps; no
station may. Two single clauses are stale in them, and both are one-line edits:

**(i) `05-sot-keeper`'s bootstrap, line 63** cites `pr-gates.mjs:327`. [MEASURED] against
`origin/main:scripts/pr-gates/pr-gates.mjs` (581 lines), NEGATIVE CONTROL `zzzNoSuchGateZzz` → 0:
line 327 is a bare `{`. The **substance is correct** — CP-24 is real and is a hard block — but the
citation lands on an anonymous brace, and DOCTRINE §9.5 (landed 2026-09-04) now makes symbol
anchoring binding. The bootstrap layer has not been repasted since the rule that governs it was
written. Replacement text, so no thinking is needed:

> CP-24 is a hard block: a PR mixing `sot/` with `scripts/` or `apps/` fails (`pr-gates.mjs`, the
> `CP-24 - sot purity` block — anchor on that comment, not a line number).

**(ii) All five bootstraps, line 73** carry DOCTRINE §9.2's *"never run `git` through the device
bridge against the Windows `.git`"*. [MEASURED] `STATION-CAPABILITIES.md:127-133` records that the
device bridge **no longer exists in this environment** ("A fallback that does not exist is not a
fallback", measured 2026-09-04T06:1xZ). The two are not flatly contradictory — the bridge existed
when it caused the three `index.lock` freezes §9.2 records — but a live hard stop phrased *never do
X through the bridge* presupposes a bridge is available, and the bootstraps prescribe reading
DOCTRINE **first** and STATION-CAPABILITIES **second**, so the presupposition is read first and its
refutation last. The DOCTRINE half of this sits inside the hash-gated `instruments v2` canonical
block and must ship to all seven docs together; **Station 00 has DEFERRED that half** and will carry
it when a canonical-block re-record is the point of the run. The bootstrap half is yours whenever
you next repaste.

---

**Nothing in this file asks you to undo anything, and nothing here is urgent tonight.** The watcher
is up (pid 20000, 13.4 h, heartbeat 0 min) and the chain is intact. What is missing is not
reliability — it is reviewability.

---

## ADDENDUM 2026-09-06T06:2xZ — the closing sentence above is now REFUTED. It cost 13 minutes of watcher downtime.

**Appended by Station 00 (scheduled, 06:08Z run) at `origin/main 42aae6be`, collecting the 05:40Z
addendum breadcrumb `00-00-supervisor-2026-09-06-0540-addendum-the-watcher-died-and-nothing-
restarted-it-for-eight-minutes.md`, finding F7.** That breadcrumb was UNTRACKED when written; it is
committed to `docs/pr-prompts/archive/` in this run's board PR, so this addendum and its source can
be read together.

This file ends: *"What is missing is not reliability - it is reviewability."* On 2026-09-06 it was
reliability, measured:

| | [MEASURED] by the 05:40Z run |
|---|---|
| watcher exited | `05:27:31.250Z` - `Watcher exited with code 1 (raw node exit: -1)` |
| the wrapper was NOT absent | `watcher-launcher-singlelane.ps1` pid 35328, alive since 2026-09-04T09:37:11Z |
| documented 60 s auto-restart in `supervise-watcher.ps1` | **did not fire** - no node and no new log line at +98 s, +3 m 22 s, +7 m 06 s |
| what DID recover it | `ensure-watcher.ps1` at `05:35:03Z` - **7 m 32 s later**, on a 10-minute tick |
| and it did not hold | relaunched pid 14744 GONE by `05:37:07Z`; stale `.watcher.lock` naming pid 33244 written `05:38:12Z` with no such process |
| sanctioned verdict | `restart-watcher-if-wedged.ps1` -> `DOWN - no watcher process, but 1 prompts are armed` |
| recovery | `-Fix` at `05:40:07Z`; read back `05:44:43Z` `VERDICT: OK`, pid 17944 |
| total downtime | about 13 minutes, of which 7.5 before anything reacted |

Three consequences that belong to THIS escalation, not to a new one:

1. **The documented safety net for the most common failure did not run, and `00-supervisor.md` §3a
   tells every future run not to duplicate it.** A run that believes §3a and stands down waits for a
   restart that is not coming. §3a cannot be corrected from evidence, because the file that would
   explain the failure is the one not in the tree.
2. **The real recovery mechanism is the unreadable one.** `ensure-watcher.ps1` is what brought the
   watcher back and it is not in this repository - which is exactly what this file asks about. This
   is the first measured COST of that gap rather than an argument from principle.
3. **A watcher relaunched by `ensure-watcher.ps1` is invisible to `watcher-launch.log`** - no line
   since `05:27:31Z` through two relaunches, a completed review job and an archived verdict at
   `05:40:18Z`. `restart-watcher-if-wedged.ps1` reads its churn counter from that log, so it
   reported `1 cycle in 20 min` while at least three starts had occurred. **Every liveness reading
   this pipeline takes is taken through that log.**

**RULE 1 options are unchanged from F7 and are Marco's** - (a) bring `ensure-watcher.ps1`,
`watcher-launcher-singlelane.ps1` and `supervise-watcher.ps1` into `scripts/pr-watcher/` and point
`C:\po-watcher\*` at them, THEN diagnose the exit-1 path (complete and additive: the outage becomes
diagnosable immediately and the chain becomes reviewable, testable and fixable permanently; touches
no queue, no prompt, no schema, no gate); (b) fix only the logging (fails the complete half - makes
the fault visible rather than absent); (c) shorten the tick to 2 minutes (fails both halves - caps
the outage, touches neither cause, multiplies relaunch churn).

**No station has edited `C:\po-watcher\*.ps1`, and none should:** an unversioned launcher edited by
hand cannot be reviewed or rolled back.

⚠️ **The falsifying probe for this addendum:** the next `Watcher exited with code 1` in
`watcher-launch.log` followed within 60 s by a new `[start]` line from the same wrapper pid. If that
happens, the exit-1 path works and 2026-09-06 was a one-off - say so here.

⚠️ **This file is GITIGNORED (`.gitignore:82`)** - measured by the 05:08Z run, F1. This addendum
reaches this machine and nothing else until that is decided.
