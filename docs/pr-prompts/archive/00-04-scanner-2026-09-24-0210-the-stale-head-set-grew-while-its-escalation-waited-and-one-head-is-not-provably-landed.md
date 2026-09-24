# Station 04 — Scanner | 2026-09-24T02:10Z–2026-09-24T02:24Z

## GROUND

```
UTC            2026-09-24T02:10Z
origin/main    fcdf66c0            (fetched, then rev-parse)
dev tree       main @ fcdf66c0  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`) — this run was not read-only-by-mismatch.

**Sighted run.** `start_process` shell `powershell.exe` answered on the first call
(`git rev-parse --short HEAD` → `fcdf66c0`, host clock `2026-09-24 12:10` local = `02:10Z`,
Brisbane UTC+10). This was **not** a blind run and nothing here is a GitHub-side substitute for a
dev-tree read.

**Which tree I read the binding documents in.** The dev tree, `C:\ProjectOperations2` — and the
PREFLIGHT rule that they be read from `origin/main` is satisfied by measurement rather than by
transport: `git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**, and
`git rev-list --left-right --count HEAD...origin/main` returned `0 0`. [MEASURED] All three working
copies are byte-identical to `origin/main`. No piped `hash-object` comparison was made (§9.1 —
unsound in PowerShell).

**Sweep taken this run: `repo-hygiene`** (rotation position 3 of 4, chosen by
`node scripts/pipeline/next-sweep.mjs`, not by me).

---

## WHAT I MEASURED

**vm-git-guard installer.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`.
Last line, quoted verbatim:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/nice-charming-newton/.local/bin:$PATH" git <args>
```

Headline line: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your
shell.` **EXIT CODE = 2.** [MEASURED] This is the expected middle outcome for a station, not an
anomaly: the device-bridge git ban is REMEMBERED this run, not mechanical. No `git` was run through
the device bridge against a mounted `.git` at any point in this run — every `git` call below ran in
a PowerShell shell on the Windows host.

**status-sweep.ps1.** Captured with `*>` and decoded `utf16le` in node (§9.3 — the capture was
indeed UTF-16LE, `ENC=utf16le`, 142,290 bytes, 836 lines). The script outran the 180 s MCP call cap;
I did **not** read the truncated first capture — I polled the file to byte-stability (three
consecutive equal reads) before decoding, so §9.1's early-return trap is excluded by construction.

- Section 0 positive controls: `gh CAN reach GitHub (saw merged PR #2146)`, `node runs`. **Both
  PASS**, so the report is trustable.
- §7 VERDICT: **`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live
  station worktrees.`**
- Board: 6 open PRs (#2144 #2143 #2142 #2135 #2131 #2127), all `CLEAN`, all green.
  `main CI on fcdf66c0: 4 success / 0 failed (trunk green)`.
- Watcher: `node RUNNING pid 38776`, wrapper alive, heartbeat 26 min (idle, empty armed queue).
- Queue: `armed (*-ready.md): 0` · needs-marco 48 · no-pr-opened 111 · failed 59 · blocked 150.
- Backlog gates: `ready=1 needs-marco=2 blocked=4 broken=0`.

### The repo-hygiene sweep, all six sub-checks

**(a) Orphaned worktrees and their locks — NONE.** [MEASURED]
`git worktree list` in the dev tree → one entry, `C:/ProjectOperations2 fcdf66c0 [main]`.
Same in the clone → one entry, `C:/po-watcher/ProjectOperations 02c0e7e5 [main]`.
`C:\po-worktrees` → **0** directories · `C:\po-wt` → **0** · `C:\po-watcher-worktrees` → absent.
`index.lock` absent in both trees. **The four worktree escapees under `C:\po-worktrees` recorded in
earlier station summaries are GONE** — do not re-file them.

**(b) Stash growth in the watcher clone — 77, and still climbing.** [MEASURED]
`git -C C:\po-watcher\ProjectOperations stash list` → **77**. Dev tree → **1**.
DOCTRINE §9.5 records **71** for the clone on 2026-09-10. **+6 in fourteen days**, which is the
closed loop §9.2 names (the launcher preflight stashes on every start; nothing ever pops).

**(c) Queue-root litter — 6 loose `*.log`, none of them dangerous.** [MEASURED]
30 files at depth 1 of `docs/pr-prompts`: 13 `-HOLD.md`, 1 breadcrumb, 1 `rev-*` artifact,
15 other (of which 9 are the by-design registers/schema/state files). The six loose logs are
`pr-fv2-import-s2-review-route-b`, `…-route-c`, `pr-scopecards-s1-operational-costs-priced-b`,
`pr-scopecards-s4a-push-by-destination-api-b`, `pr-scopecards-s8a-travel-time-snapshot-b` (all
`-ready.md.log`, 279–1264 bytes, 09-15 to 09-23) and `rev-2016-ready.md.usage-limit.log`.
**I checked their CONTENTS rather than stopping at their presence**, because a build log that never
reached `processed/` would be invisible to §10.1 step 1 — RULE 2's only probe:

| needle | loose logs (6) | POSITIVE control `processed/pr-*.log` | NEGATIVE control (minted needle) |
|---|---|---|---|
| `merge result for PR #` | **0** | **761** | 0 |
| `marco.:true` (regex form, §10.1) | **0** | — | 0 |
| `opened PR #` | **0** | — | 0 |

**So the RULE-2 probe corpus is NOT holed by these files.** They are litter, not a safety hole.

**(d) THE BOARD TRAP — 0 tracked `*-ready.md` at depth 1.** [MEASURED]
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` (trailing slash AND `-r`, per §9.2;
no glob pathspec, the result was filtered in PowerShell) → 1374 tracked paths, 24 at depth 1, of
which `-ready.md` = **0**. POSITIVE control `-HOLD.md` at depth 1 = **13**; NEGATIVE control
(minted needle) = **0**. The instrument can produce a non-zero answer, and the answer is zero.

**(e) Branches merged but not deleted.** [MEASURED] Asked the **remote**
(`git ls-remote --heads origin`, never `git branch -r`): **21** heads. Each resolved with
`gh pr list -R GH-Mantova/ProjectOperations --head <b> --state all --json number,state,mergedAt`
(`-R` always passed, `$LASTEXITCODE` tested before parsing, per §9.4):

| class | count | heads |
|---|---|---|
| OPEN PR — legitimate | 6 | #2143 #2144 #2142 #2135 #2127 #2131 |
| MERGED, head not deleted | 4 | #1778 #1927 #1823 #1577 |
| CLOSED UNMERGED, head still present | 9 | #1871 #1612 #1960 #1978 #1703 #1707 #1571 #1708 #1705 |
| **NO PR EVER** | 1 | `fix1483` |

POSITIVE control: `fix/field-service-nul-separator` → `[{"number":2127,"state":"OPEN"}]`.
NEGATIVE control: a minted branch name → `[]`.
Local cache gap, for the §9.2 record only: `git branch -r` = **90** against a remote truth of
**21**.

**(f) HOLD files whose work has already shipped — 0 of 13.** [MEASURED]
`scripts/pipeline/triage-holds.ps1` (read-only; `--dequeue` never passed). Its own two controls
**both PASS** — `GIT control: PASS` (git read 217,258 chars of DOCTRINE from `origin/main`, so the
gate probes can actually run) and `SPENT control: PASS` (`lint-prompt.mjs` emitted exit 3 on the
fixture, so the SPENT bucket is measurable). Totals: `spent=0 of 13 · gates-satisfied=1 ·
still-gated=12 · unreadable=0`. The single ADMIT is `pr-fv2-formrule-contract-HOLD.md` — a
CANDIDATE only, and **not mine to arm**. The 12 REJECTs were re-probed directly: `0 spent behind a
REJECT`. **A spent count of 0 here means none, not "the instrument cannot say".**

### Two cross-checks the doctrine required, both of which changed the answer

**1. The escalation file is NOT byte-damaged — `Get-Content` was lying (§9.3).**
`Get-Content` rendered `CONSOLIDATED-stale-remote-heads-…md` with `?"` mojibake throughout. Read as
bytes in node: `bytes=7794 · U+FFFD=0 · doubleEncodedSig(U+00E2 U+20AC)=0 · BOM=false`, and line 1
decodes as `# CONSOLIDATED — stale remote heads: …` with the em dash intact. **The file is clean
UTF-8.** Had I reported what the reader showed me, this run would have filed a corruption finding
against a healthy file — §7's lie #2, exactly.

**2. The sweep's own `[LIVE]` clone-dirty line does not survive being re-derived (§9.5).**
The sweep printed `watcher clone: branch=main dirty=3  <-- NOT clean-on-main; the watcher may
refuse to start`. Re-derived from its own source in the same minute:

| form | anchor | result |
|---|---|---|
| `git status --short` | `status-sweep.ps1` | **3** |
| `git status --porcelain --untracked-files=no` | `start-watcher.ps1` | **0** |

The three entries are `?? docs/pr-reviews/pr-2127-review.md`, `pr-2143-review.md`,
`pr-2144-review.md` — review verdicts the `rev-<N>` job writes into the clone **by design**.
The clone is clean of tracked modifications and the watcher will not refuse to start.

### Leads (measured, not dispositioned as findings)

- **Watcher clone is 4 commits behind `origin/main`, 0 ahead** (`02c0e7e5` vs `fcdf66c0`),
  tracked-clean. Ordinary drift — the clone fast-forwards on relaunch — and Station 03's lane if it
  persists across several of its runs.
- `docs/pr-prompts/reports/` **does not exist**, on disk or on `origin/main` (`tracked=0`), while
  642 tracked breadcrumbs live at depth 1 (1) and in `archive/` (641). See F5.

### ⚠️ `origin/main` MOVED MID-RUN — every reading above is stamped `fcdf66c0`, and one has changed

[MEASURED] at 02:22Z, after the sweep completed: the dev tree read `0 1` against `origin/main`,
having read `0 0` at 02:10Z. Re-fetched: **`origin/main` is now `688f7e4c`**, one commit ahead of
the SHA in my GROUND block —
`688f7e4c docs(pr-prompts): stage sec-auth A3 … as HOLD (#2142)`. Re-measured board:
**5 open PRs** (#2144 #2143 #2135 #2131 #2127); **#2142 merged during this run**, at roughly 02:21Z.

**What this changes:** the open-PR count of 6 and the depth-1 `-HOLD.md` count of 13 were true at
`fcdf66c0` and are now 5 and 14 respectively. **What it does not change:** every finding below. The
board trap (0 tracked `*-ready.md`), the spent-HOLD result (0 of 13 evaluated, and the newly landed
HOLD was not evaluated because it did not exist when `triage-holds.ps1` ran), the stale-head census,
the stash count, the loose-log contents and the `reports/` contradiction are all independent of that
commit. I am recording the movement rather than re-running the sweep against a moving board,
because a claim that names the SHA it was true at is checkable and a re-run would only move the
problem forward one commit (§7.1, and §7's `[LIVE]` rule — *true when measured, not true now*).

**The dev tree is therefore 1 BEHIND `origin/main` and holds this untracked breadcrumb.** That does
not block the fast-forward: the only path `688f7e4c` creates is
`docs/pr-prompts/pr-sec-a3-no-credential-logs-HOLD.md`, and the working tree holds no untracked
file at that path. `git diff --cached --name-status` is **EMPTY** — I staged nothing, and the
shared index carried nothing of anyone else's when I finished.

---

## WHAT CHANGED

**One file, deliberately left uncommitted.** `node scripts/pipeline/next-sweep.mjs --advance --utc
2026-09-24T02:20:05Z` → `advanced: last_index=2 last_run_utc=2026-09-24T02:20:05Z`, exit 0.
Read back: `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → `2 2`, i.e.
**dirty and uncommitted in the dev tree, as the contract requires.** The next run is told
`instruction-drift` (rotation position 4 of 4).

🔴 **Station 00: `docs/pipeline/sweep-rotation.json` needs committing with your next board PR.**
I may not commit it — 04 is read-only on the board and the dev tree is on `main`. If it is not
committed, the next run repeats `repo-hygiene` and the rotation silently stops.

**This breadcrumb** was written to `C:\ProjectOperations2\docs\pr-prompts\` and is **untracked**
until a board PR commits it. It is not in a worktree and not in the session's `outputs` folder.

**Nothing else.** No prompt armed, disarmed, renamed, moved or staged. No PR opened, merged,
labelled or updated. No board mutation of any kind. No `/sot/` edit. Nothing written to any of the
five gitignored `docs/qa/` sinks, and no finding of mine lives only there.

---

## FINDINGS

### F1 — The stale remote-head set GREW from 15 to 21 in the three days its consolidated escalation has been waiting, and one of the heads is NOT provably landed, so the ask's delete-set is wrong as written

[MEASURED] `CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md` is present in
`needs-marco/` (7794 bytes, mtime `2026-09-21T02:35:12Z`). It records a remote truth of **15**
heads on 2026-09-21 and asks Marco one question: *"May I enable Settings → General → Pull Requests →
Automatically delete head branches … and then hand-delete the three provably-landed heads below?"*
Its own header says **"Branch state is STATE — re-measure before acting."** I re-measured:

- Remote truth today is **21**, not 15. **+6 in three days**, while the question waits. Six of the
  21 are the currently-open PRs, so the *stale* residue is **14**: 4 merged-not-deleted,
  9 closed-unmerged, 1 with no PR at all.
- 🔴 **`fix1483` has NO PR, ever, and its tip is NOT on `main`.**
  `git ls-remote --heads origin refs/heads/fix1483` → `9de072673edd10fd6e9c3c81f61ed0a7bb1aa8f4`;
  `git merge-base --is-ancestor 9de07267 origin/main` → **exit 1** (POSITIVE control, `origin/main`
  against itself → exit 0). So it is neither landed nor abandoned-after-review: it is unreviewed
  work with no PR and no merge. **It must be excluded from any "delete the landed heads" action**,
  and the auto-delete-on-merge setting would never have touched it, so enabling that setting does
  not address it either.

This is **not** a fourth filing. The escalation exists, it is correct, and 04 already refused to
re-file this subject once on 2026-09-21. What is new is (i) the growth rate, which is the argument
for the setting rather than for a one-off cleanup, and (ii) a named head that the ask's delete-set
must not include.

**DISPOSITION: DISPATCHED** → Station 00, to fold into the existing
`CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md` rather than to open anything new:
refresh its census to 21/14, add the `fix1483` exclusion with the `--is-ancestor` evidence above,
and re-state that the setting is the complete-and-additive half (it stops the growth permanently and
damages no data) while hand-deletion alone fails the "future" half of RULE 1.

---

### F2 — The sweep's `clone dirty=3 → "the watcher may refuse to start"` is still the documented false warning, fourteen days after it was filed, and it still fires on an artifact the review lane creates by design

[MEASURED] today, both forms against the clone in the same minute: `git status --short` → **3**,
`git status --porcelain --untracked-files=no` → **0**; all three entries are
`?? docs/pr-reviews/pr-<N>-review.md`. This is precisely the falsifying probe DOCTRINE §9.5
prescribes for `sweep-clone-dirty-flag-counts-untracked-files-2026-09-10.md`, and the bullet's
2026-09-23 revision already names this row as **"the SURVIVING live instance"**. It survived again.

The measured cost of the line is a mis-routed dispatch to Station 03 as clone hygiene — DOCTRINE
records 13 verbatim quotations of that sentence in `archive/`. It fires on **every** reviewed PR
whose verdict has not yet been mirrored, so with three reviewed PRs open it is firing now.

**DISPOSITION: DEFERRED.** The escalation exists and the fix is a `status-sweep.ps1` scope change
(count with `--untracked-files=no`), which is Station 00's script lane, not mine, and the board
already carries two instrument-repair PRs waiting on Marco. **What would make it urgent:** a run
that ACTS on the line — dispatching 03, or treating the clone as unable to start — rather than
re-deriving it. Until then the guard is that every reader re-derives it, which is what this section
did.

---

### F3 — Clone stash count is 77 and rose 6 in fourteen days; the loop has no drain

[MEASURED] clone **77**, dev tree **1**. DOCTRINE §9.5 recorded **71** on 2026-09-10 as the
receipts of the auto-stash self-heal path in `start-watcher.ps1`. Nothing pops them and §9.2 is
explicit that `git stash drop` — never `pop` — is the only sanctioned disposal, which no station is
scheduled to do. At the present rate the list grows ~0.4/day indefinitely.

This is cosmetic today: a stash list costs nothing to carry and the self-heal path is correct
behaviour, not a defect. It is worth a number rather than an action.

**DISPOSITION: DEFERRED.** **What would make it urgent:** a stash that holds work someone needs
back (all 77 are preflight auto-stashes of a dirty clone, so today none do), or the count starting
to rise per-rescan rather than per-relaunch — which would mean the preflight is running far more
often than the watcher is restarting. Re-measure the count, not this sentence.

---

### F4 — Six build logs are stranded at depth 1 of the queue root instead of in `processed/`, and the check that matters came back clean

[MEASURED] Six `*.log` at depth 1, dated 09-15 to 09-23, all untracked. Five are `-b-ready.md.log`
retry-attempt logs whose `.md` is long gone; one is `rev-2016-ready.md.usage-limit.log`. Per
QUEUE_LAYOUT_V1 a consumed prompt's log belongs in `processed/` (or `no-pr-opened/`), and `nothing
is ever deleted — retiring a prompt means moving it`.

The reason this is a finding at all rather than tidiness is that §10.1 step 1 probes
`docs/pr-prompts/processed/pr-*.log` **and nothing else**, so a verdict stranded outside that
directory would be invisible to RULE 2 while reading as "this PR was checked and is not Marco's".
I checked: **none of the six carries `merge result for PR #`, `opened PR #`, or `marco.:true`**
(POSITIVE control 761 hits in `processed/`; NEGATIVE control 0). So the hole is potential, not
actual, today.

**DISPOSITION: DEFERRED.** Moving them is a queue mutation and 04 arms and moves nothing; the
population is six files and static. **What would make it urgent:** a loose depth-1 log that *does*
contain a `merge result for PR #` line — at which point RULE 2's corpus is genuinely holed and the
fix is to widen the probe, not to move the file. The cheap standing guard is to re-run the three
needles above over depth-1 `*.log` on each repo-hygiene sweep; it is three `Select-String` calls.

---

### F5 — DOCTRINE §8.5 sends reports to `docs/pr-prompts/reports/`, a directory that has never existed, while the station contract sends them to depth 1 — two binding documents, opposite instructions, and one of the destinations is unreadable by the validator

[MEASURED] at `fcdf66c0`:

| probe | result |
|---|---|
| `docs/pr-prompts/reports/` on disk | **ABSENT** |
| `git ls-tree -r --name-only origin/main -- docs/pr-prompts/reports/` | **0** |
| tracked breadcrumbs (`/00-NN-`) on `origin/main` | **642** — `archive/` 641, depth 1 **1** |
| NEGATIVE control, minted needle over the same tree listing | **0** |

DOCTRINE §8.5 states, under QUEUE_LAYOUT_V1: *"Reports are not prompts. Breadcrumbs and run reports
go in `docs/pr-prompts/reports/`."* The station-contract v5 REPORT CONTRACT — the canonical block
byte-identical in every station doc, including this one — states the opposite: breadcrumbs go to
`docs/pr-prompts/00-<NN>-<station>-<YYYY-MM-DD>-<HHMM>-<slug>.md`, i.e. **depth 1**. All 642
breadcrumbs ever written follow the contract; none follows §8.5.

§8.5 does say *"Not yet enforced. This standard is written in S1 and enforced in S4"*, so this is a
planned-not-built standard rather than a regression — but the sentence naming the directory is
written in the present tense and sits in the document every station is told it can trust, four
sections below a rule about exactly this failure mode. **A station that follows it writes its
breadcrumb into a directory that does not exist, that no PR has created, and that
`check-breadcrumb.mjs` is structurally blind to** — that validator's structure pass iterates
`readdirSync(DIR)` at depth 1 only (§9.5), so a report in `reports/` would fail no check and be
seen by nobody. That is the nine-day `qa-findings.md` failure with a different path.

I record it here rather than acting on it because the remedy is a one-clause edit to a
hash-gated canonical-adjacent section of DOCTRINE, which is 00's to land and 05's to reconcile if
it touches `sot/`.

**DISPOSITION: DISPATCHED** → Station 00, and flagged forward to the **next run's
`instruction-drift` sweep**, which the rotation has already selected. The minimal fix is to mark
§8.5's `reports/` row explicitly as NOT-YET-BUILT and to name the station-contract depth-1 path as
the live destination until S4 lands — so that the two binding documents stop giving opposite
instructions to whichever run reads §8.5 last.

---

## WHAT I DID NOT DO

- **Armed nothing.** `pr-fv2-formrule-contract-HOLD.md` is the single lint-ADMIT on the board.
  ADMIT is necessary, not sufficient; arming is Station 00's on Marco's authority, and 04's matrix
  row is *Arm a prompt: ❌*. I did not read its body to form an arming opinion either — that is not
  my call to prepare.
- **Staged no prompt.** My budget is 2 and I used 0: F1 and F2 belong to escalations that already
  exist and a third filing is the failure mode; F5's remedy is a DOCTRINE edit, not a build.
- **Did not move, delete or retire any of the six stranded logs, the 14 stale remote heads, the 77
  clone stashes, or any HOLD.** Branch deletion is irreversible (§5.4) and the sweep's own brief is
  *"REPORT ONLY — no agent bulk-deletes"*.
- **Did not commit `docs/pipeline/sweep-rotation.json`**, by contract. Named above for 00.
- **Did not mint a worktree** to get a clean read — `git show` / `ls-tree` against `origin/main` at
  a named SHA was sufficient, and an orphaned worktree's lock has no holding process by
  construction, forever.
- **Did not run Part 2 (live-site visual patrol).** The `repo-hygiene` sweep is a repo sweep and
  `next-sweep.mjs` chose it; taking one named sweep completely is the instruction, and a shallow
  pass over everything is what the rotation exists to prevent. No live-site claim appears anywhere
  in this report.
- **Did not touch Azure, Entra or SharePoint**, in any form, read-modify-write included.
- **Did not run `git` through the device bridge against either Windows `.git`**, and did not run
  `git checkout`/`reset --hard`/`stash pop`/`git clean` anywhere.
- **Did not clear, or judge, any lock** — there were none to judge.
- **Left `/sot/` alone** entirely; it is Station 05's.

---

## FOR MARCO — nothing needs you this run

The board is quiet and healthy: six open PRs, all clean and green, trunk green, watcher running,
nothing armed, no locks, no orphaned worktrees, no board trap, no spent holds. The two live
conditions this sweep found are both already sitting in your `needs-marco/` queue, and the only
thing F1 adds is that **the stale-branch population is growing while the question waits** — 15 heads
on 21 September, 21 today — which is the argument for the repository setting rather than for a
hand-cleanup. One correction to that file's ask: the branch `fix1483` has no PR and is **not** on
`main`, so it is not one of the "provably landed" heads and should not be in any delete set.
