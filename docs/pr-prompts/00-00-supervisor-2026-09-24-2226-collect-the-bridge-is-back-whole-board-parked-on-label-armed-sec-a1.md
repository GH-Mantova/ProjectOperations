# Station 00 — Supervisor | 2026-09-24T22:14Z–2026-09-24T22:4xZ

## GROUND

```
UTC            2026-09-24T22:14:57Z
origin/main    9055c6b9            (git fetch origin +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 755f3440      C:\ProjectOperations2   (0 ahead, 3 behind origin/main)
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE**. This run was **SIGHTED** — a PowerShell shell opened on the
Windows host on the first call, so every `[LIVE]` line below is a real measurement. **The two runs
before this one (00 at 21:15Z, 04 at 22:11Z) were both BLIND**; the bridge came back between 22:11Z
and 22:14Z.

🔧 **PREFLIGHT step 2's "read from `git show origin/main:<path>`, never the working copy" was
satisfied by measurement rather than by transport.** The dev tree is 3 behind, so the working copy
could have been stale. It is not: `git diff --numstat origin/main -- <path>` returned **EMPTY** for
all three of `docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md` and
`docs/pipeline/STATION-CAPABILITIES.md`. All three were then read in full from the working copy,
which is byte-equal to `origin/main` for those paths. This is the §9.3-sanctioned comparison
(`--numstat`, EMPTY is the real answer) and not a piped hash.

---

## WHAT I MEASURED

### Reachability and the guard

- [MEASURED] **Desktop Commander reachable.** `start_process` shell `powershell.exe` → PID 43308 on
  the first call, after a `ToolSearch` load. **Not blind.** The `CONNECT_TIMEOUT` that stopped the
  21:15Z and 22:11Z runs has cleared.
- [MEASURED] **`vm-git-guard.sh` exit `2`**, read with **no pipeline appended**
  (`; echo "GUARD_EXIT=$?"` as its own statement). Headline verbatim:
  `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
  Last line verbatim: `PATH="/sessions/charming-serene-babbage/.local/bin:$PATH" git <args>`.
  Its own controls: `bash -lc 'command -v git'` →
  `/sessions/charming-serene-babbage/.local/bin/git`; `bash -c 'command -v git'` → `/usr/bin/git`.
  **Tenth consecutive run at exit 2.** Expected outcome for a station, a FINDING not a STOP, and
  known state — not re-filed. **No `git` was run against the mount at any point this run**; every
  `git` and `gh` call went through the Windows shell.

### The sweep

- [MEASURED] `scripts/pipeline/status-sweep.ps1` run **twice** — 22:16:26Z (survey) and 22:26:27Z
  (immediately before the arm, because the verdict expires the moment it prints). **Both
  `SAFE TO ACT`**, section 0 instrument controls PASS both times (`gh` reached GitHub, `node` runs).
  Captured with `*>` and decoded `utf16le` per §9.3 — the raw file opens `FF FE`, 144,534 bytes.
- [MEASURED] **Section 5 carried ZERO `[STALE]` escalation rows.** A `[STALE]` scan over the whole
  report returned 4 hits and **all four are the header/legend/footer lines and one quotation inside
  a `[FILE]` station summary** — line 0 (`all facts [LIVE] unless tagged [FILE]/[STALE]`), line 3
  (the HOW TO READ legend), line 97 (a quoted breadcrumb sentence) and line 419 (the footer).
  **Nothing to discharge in COLLECT this run** — the eleven-row backlog the station doc records was
  already cleared, and the one discharge that happened today is F4 below.
- [MEASURED] **Locks: none.** `git index.lock interactive/clone: False / False`, `git processes
  touching our trees (scoped): 0`, `no PR touched on GitHub in the last 2 min`, both sweeps.

### The board — and this is the headline

- [MEASURED] **3 open PRs, and ALL THREE are parked on Marco's `do-not-merge` label.**
  `gh pr view <n> -R <owner>/<repo> --json ...,labels,files` per PR, `-R` on every call:

  | PR | title | files | labels | mergeStateStatus |
  |---|---|---|---|---|
  | #2167 | fix(pr-watcher): rescue bare paths under spaced top-level directories | 3 × `scripts/pr-watcher/**` | `do-not-merge` | BLOCKED |
  | #2164 | feat(tendering): S8h waste travel-index UI and find-tip fix | 4 × `apps/web/**` | `do-not-merge` | BLOCKED |
  | #2158 | feat(forms): drop five legacy FormRule flat columns (F-2c contract) | 10 × `apps/api/**` incl. a migration | `do-not-merge` | BLOCKED |

- [MEASURED] **Every one reads `13 pass / 2 fail`, and the two reds are ONE cause on all three.**
  Read from **column 3** of each CP-26 job log per §9.1 (the log is
  `<job name>\t<step>\t<timestamp> <text>`, and the job name itself contains `CP-26`), verbatim and
  identical on #2167, #2164 and #2158:

  ```
  FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label
  (escalates:true). A human must review and REMOVE the label; removing it is what releases the merge.
  ```

  The second red is `PR gates — diff checks`, which runs the same check as a step. **This is
  `[LABEL_PRESENT]` — PARKED BY DESIGN, not a defect and not work** (§9.4). Only Marco removes the
  label, so there is no agent-side action behind any of the three.
  **Controls:** the first pass of this probe anchored on `^(PASS|FAIL) - CP-26` and returned **0**
  verdicts on both PRs it was run against — the column-3 text is prefixed by the runner timestamp,
  so the anchor could never match. Re-run unanchored on `CP-26 approval-receipt \[` it returned
  **1 of 1** on each; NEGATIVE control, a freshly minted needle over the same output → **0**.
  *A uniform zero across a heterogeneous set was the only symptom.*
- [MEASURED] **Trunk green.** `main CI on 9055c6b9: 4 success / 0 failed`, with the scoped verdict
  correctly excluding 1 non-trunk run (`Pipeline heartbeat`) — the `TRUNK_VERDICT_SCOPED_V1`
  denylist landed by `#1852` is doing its job.
- [MEASURED] **Watcher HEALTHY-IDLE.** `watcher node: RUNNING pid 42212`, `auto-restart wrapper:
  alive (2)`, `watcher clone: branch=main dirty=0`, heartbeat **56 min** at 22:16Z and **66 min** at
  22:26Z. The heartbeat ticks only mid-run, and the queue was empty, so **stale heartbeat + empty
  queue = idle, NOT wedged**. No restart attempted; none warranted.

### The queue

- [MEASURED] `armed (*-ready.md): 0` at 22:16Z and again at 22:26Z, immediately before the arm.
- [MEASURED] `triage-holds.ps1` exit 0 — **15 `-HOLD.md` at depth 1: gates-satisfied 2,
  still-gated 13, spent 0.** Its own SPENT fixture control PASSED (`lint-prompt.mjs` exit 3 on the
  fixture), so the empty SPENT bucket is a measurement and not an unusable query.
- [MEASURED] `needs-marco/ 48 · no-pr-opened/ 111 · failed/ 59 · blocked/ 153`.

### Breadcrumb freshness — no station is SILENT

- [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness`:
  `00  1.1h ago (cadence 1h) ok` · `03  23.3h ago (cadence 24h) ok` · `04  0.2h ago (cadence 4h) ok`
  · `05  8.0h ago (cadence 24h) ok` · `02 dispatch-only`. **Exit 1, and the 1 was structure, not
  freshness** — see F1.
- [MEASURED] **Every row is "both fresh and aligned".** No station is SILENT and none was
  dispositioned as such. The 20:1xZ Station 00 occurrence **did fire and did report** — see F5 for
  how this run nearly filed the opposite.

### COLLECT — five breadcrumbs in this cycle's window, and only TWO were uncollected

🔴 **The tracked-set probe was asked of `origin/main`, never of the dev tree's index**
(`TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1`), because the dev tree is 3 behind and `git ls-files`
there would have answered *"unreported"* about work the 20:36Z board PR already landed — which is
how a duplicate root copy gets committed.

- [MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` → **1407** paths.
  POSITIVE control, `00-00-supervisor-2026-09-24*` → **21**.

  | breadcrumb at depth 1 | on `origin/main`? | disposition |
  |---|---|---|
  | `00-00-supervisor-…-1915-three-prs-released-at-1901z…` | **YES**, at `archive/` | already collected by the 20:36Z run — root copy is a stale leftover |
  | `00-04-scanner-…-1810-repo-hygiene-571-of-577…` | **YES**, at `archive/` | already collected — root copy is a stale leftover |
  | `00-00-supervisor-…-2115-BLIND-desktop-commander-connect-timeout…` | **NO** | **this cycle — collected below** |
  | `00-04-scanner-…-2211-BLIND-no-windows-shell-and-bootstrap-contradicts…` | **NO** | **this cycle — collected below** |
  | `00-00-supervisor-…-2015-the-supervised-interactive-lane-cleared-the-receipt-escalation…` | **YES**, at **depth 1** | tracked but **NOT archived** — self-dispositioned; archived by this PR (F5) |

**Findings carried in the two new breadcrumbs, each given a disposition below:** 00/2115Z F1
(CONNECT_TIMEOUT) and F2 (unobserved window); 04/2211Z F1 (bootstrap contradicts the station doc),
F2 (`maintenance.lock`), F3 (stale `packed-refs`), F4 (nothing gates the bootstraps) and F5 (00's
own breadcrumb is malformed).

**And a sixth, from the 20:14Z run, which this run only saw once it stood in a worktree at
`origin/main`:** its F1–F6 all carry their own dispositions, and its **ADDENDUM** hands the next run
the append-only `.arming-log.txt` cure by name. Its one still-live hand-over — F4,
`C:/po-worktrees/sup-cwd-paths`, DISPATCHED to Station 03 — is **re-affirmed, not re-dispositioned**:
[MEASURED] this run, the same worktree is still there and now `age=881 min` with the same
`dirty=2 files`. 03's `nextRunAt` is `2026-09-24T23:02:45Z`, i.e. within the half-hour.

---

## WHAT CHANGED

**Four mutations, every one read back.**

**1. ARMED `pr-sec-a1-auth-secret-fail-fast` — one prompt, all gates verified LIVE.**

`arm-prompt.ps1 -Name pr-sec-a1-auth-secret-fail-fast -Actor station-00` → **exit 0**, via the
sanctioned script, never a hand `git mv`. Its own trace: lock acquired (PID 1552) → index clean
before → RULE 4 no-other-prompt-armed → lint → rename → *"Index contains exactly the two expected
paths"* → audit line written → index released → lock released.

Gates, each confirmed **live** and not from a note, before arming:

| gate | probe | result |
|---|---|---|
| `requires_on_main: otp-delivery.port.ts :: SEC_A3_NO_CREDENTIAL_LOGS_V1` | `git show origin/main:apps/api/src/modules/auth/otp-delivery.port.ts` | marker **1** hit; POSITIVE control 43 lines; NEGATIVE control (minted needle) **0** |
| predecessor merged **and on `origin/main`** | `gh pr view 2148 -R … --json state,mergedAt` | **MERGED** `2026-09-24T20:16:30Z` |
| `lint-prompt.mjs` | via `arm-prompt.ps1` | **PROMOTE**, `GATE_RELEASED` — the linter reached the same verdict independently |
| human gate | read the BODY, not the linter | `MARCO GATE ("M2") — RELEASED 2026-09-24 by Marco, in chat, to Station 00`, with what it does and does not release stated in the prompt |
| never-arm denylist | `pr-fv2-formrule-contract`, `pr-siteid-notnull-backfill`, MT-3/MT-5 | **not on it**; A1 is code-only and reads/sets/changes no Azure setting |
| already-shipped / duplicate | `triage-holds.ps1` duplicate bucket | **not flagged** against any of the 3 open PRs |

**Read-back:** `pr-sec-a1-auth-secret-fail-fast-ready.md` present, `-HOLD.md` gone,
`armed = 1`. `escalates: true`, so the watcher will label the resulting PR `do-not-merge` and it
will park for Marco — which is correct for an auth PR and is stated here so it is not read later as
a stall.

**2. REPAIRED the 2115Z breadcrumb — 04's F5, discharged.** Added the two missing sections
(`## WHAT CHANGED`, `## WHAT I DID NOT DO`), each carrying an HTML comment naming this run as the
author so the edit is not mistaken for the original run's own words. **Nothing in the existing
sections was altered.**
**Read-back:** `node scripts/pipeline/check-breadcrumb.mjs` → `structure: 4 checked, 0 malformed`,
**`CLEAN`, exit 0** (it was `1 malformed`, exit 1, before the edit).

**3. Opened this board PR** from an isolated worktree off `origin/main`
(`C:\po-wt\st00-collect-2226`, branch `docs/st00-collect-2026-09-24-2226`, created at `9055c6b9`) —
never the dev tree, never the watcher clone. It carries:

- both new breadcrumbs, straight into `docs/pr-prompts/archive/` (both fully dispositioned here);
- **this** breadcrumb, at depth 1, written **inside the worktree** — cure 1, so no loose copy is
  ever left in the dev tree to block the next fast-forward;
- the **20:14Z** breadcrumb `git mv`-ed from depth 1 into `archive/` — every one of its findings
  carries a disposition, which is the archive rule's condition, and it is safe for freshness because
  `check-breadcrumb.mjs` builds its tracked set with `git ls-tree -r` and matches by basename;
- `.arming-log.txt`, which **must** ride in this PR (§9.5) — see the warning under item 4;
- three deletions: the consumed `pr-formrule-legacy-payload-retire-HOLD.md`, the
  `pr-sec-a1-auth-secret-fail-fast-HOLD.md` this run armed, and the discharged
  `needs-marco/duplicate-verdict-guard-prs-2166-vs-2167-2026-09-24.md`.

🔧 **Landing those three paths IS the discharge of the 20:14Z addendum, and it is the cheaper of the
two cures that addendum named.** It wrote: *"the cheaper answer may be to wait rather than to cure …
if its own board PR lands them, the blockers clear themselves and no restore is needed at all."* The
other lane's PR did not land them — they were still dirty two hours later, at 22:33Z — so this run
lands all three instead. **After this PR merges, the dev tree's fast-forward has nothing to block
on, and no `git show HEAD:` restore is performed on the append-only file at all.**

**4. 🔴 `.arming-log.txt` carries a line THIS RUN DID NOT WRITE, and restoring it to `HEAD` would
have destroyed it silently.**

[MEASURED] `git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` → **`2  0`** —
insertions with **zero** deletions, which is precisely the append-only **superset** shape the
station doc names as the discriminator. `Compare-Object` against `git show origin/main:<path>`
(155 lines vs 156 on disk before my own arm) isolated the local-only line:

```
2026-09-24T20:21:20Z  ARMED  pr-formrule-legacy-payload-retire  escalates=false
actor=station-00.interactive-0004  by=Marco@LAPTOP-E6NHU4E4  pid=33512  caller=powershell.exe:45520
```

**A second actor — the supervised interactive lane — armed a prompt at 20:21:20Z and nothing has
committed its audit line.** On that shape `git show HEAD:<path>` piped to a write is a **deletion,
not a repair**, and every read-back in the post-merge FF cure still passes. Both lines (20:21:20Z
and my own 22:33:26Z) are carried into this PR verbatim by a raw-Buffer copy — **26,127 bytes,
byte-exact, verified on read-back.**

**Nothing else.** No PR merged, closed, rebased or commented on. No label added or removed. No
`/sot/` edit. No production data. No Azure / Entra / SharePoint. No watcher restart. No lock
cleared. No commit on `main` in any tree.

---

## FINDINGS

### F1 — Station 00's own 2115Z breadcrumb was malformed and would have turned `pipeline-tests` red on an unrelated PR — **ACTIONED**

Dispatched to me by Station 04 (2211Z breadcrumb, F5). `check-breadcrumb.mjs` rejected it for two
missing sections, `## WHAT CHANGED` and `## WHAT I DID NOT DO`. Harmless while untracked — which is
why CI was green — but the file's whole purpose is to be swept into a board PR, and that sweep would
have surfaced the failure on whichever PR happened to carry it.

04 was right that the substantive cost is the larger one: for a **blind** run those two sections are
the load-bearing ones, because a blind run and a healthy quiet run produce identical silence and
those sections are where the silence gets an explicit reading.

**Fixed this run and verified: `CLEAN`, exit 0.** Both added sections are drawn from that run's own
WHAT I MEASURED block — nothing reconstructed.

⚠️ **04's meta-observation stands and is NOT fixed here:** *nothing in PREFLIGHT tells a station to
run `check-breadcrumb.mjs` before ending its run.* Both blind runs today were written under time
pressure at a hard stop, and this one was caught only because 04's due sweep happened to be
`instruction-drift`. **DISPOSITION for that half: DEFERRED** — it is a one-line addition to the
`station-contract` canonical block, which must be re-recorded and shipped across all seven station
docs in a single PR. That is more than a collect run should carry, and it becomes urgent the moment
a malformed breadcrumb actually reaches `main`.

### F2 — The Windows bridge outage that blinded two consecutive runs has CLEARED — **ACTIONED**

00/2115Z F1 escalated `CONNECT_TIMEOUT` to Marco; 04/2211Z corroborated it 56 minutes later from a
different session (`eager-compassionate-ptolemy`, `ecstatic-zen-volta`) and called it *"a persistent
outage of the Windows bridge, not a transient per-session flake."* That was the right reading of the
evidence available at 22:11Z.

**It is now closed by measurement: this run reached the box on its first `start_process` call at
22:14Z**, three minutes after 04 stopped. So the outage ran from at most 21:15Z to at most 22:14Z —
**under an hour, and it self-cleared.** STATION-CAPABILITIES §2 already records blindness as
intermittent with an unknown cause, and this is one more datum for that, not a new diagnosis.

**Nothing is escalated to Marco for it.** The escalation existed to tell him the board was unread;
the board has now been read. Re-escalating a cleared transient is how a real outage gets shrugged
at later.

⚠️ **What it cost is real and is recorded, not waved away:** the **20:40Z → 22:14Z** window — 94
minutes — was unobserved by any sighted station. This run treated it as uncollected, exactly as
00/2115Z F2 asked (**that finding is hereby ACTIONED, not left deferred**), and found the board
healthy across it — trunk green, no locks, watcher alive, queue empty. *(00/2115Z F2 guessed the
window began at 19:40Z; it began at 20:40Z, because the 20:14Z run reported in full — F5.)*

### F3 — The whole open board is parked on Marco's label. Arming cannot move it. — **ESCALATED**

**This is the single most important thing about the board right now, and it is not a defect.**

All three open PRs carry `do-not-merge` and all three fail CP-26 with `[LABEL_PRESENT]`. Only Marco
removes that label. So **there is nothing on this board for any station to merge, fix, rebase or
re-run** — the two reds per PR are the gate working, and treating them as work is the mistake three
consecutive collect runs have already made.

The throughput consequence is the one the archived record states exactly: *"00 can arm work, the
watcher can build it, CI can green it — and every PR that touches anything outside `tests/` or
`docs/` then stops. The board grows monotonically until Marco merges. Arming faster makes the queue
longer, not shorter."* I armed `sec-a1` anyway, because Marco personally released its gate and it
unblocks the later `authsession` (F02) cluster — but it is `escalates: true`, so it will become a
**fourth** parked PR, not a merge.

**The question for Marco, and it is a question, not a status update:**

> Three PRs have been waiting on your label since 08:05Z, 12:48Z and 13:53Z today, and `sec-a1` will
> join them within the hour. **Do you want Station 00 to keep arming gate-cleared work while the
> release channel is closed, or to hold the queue at zero armed until you have cleared the backlog?**

**RULE 1 — complete-and-additive first:**

1. **Release the three now, then keep arming.** Review and unlabel #2167 (watcher fix), #2164 (web
   UI), #2158 (API + migration); each needs a `docs/decisions/merge-approvals/<N>.md` receipt on its
   branch, after which CP-26 turns green and the PRs merge themselves.
   *Complete:* clears the present backlog **and** restores the standing throughput, so the same
   question does not return tomorrow. *Additive:* nothing is discarded, no prompt is binned, no data
   is touched. **Passes both halves.**
2. **Keep arming; review in a batch later.** *Fails the "immediately" half.* The board keeps growing
   and each new PR needs rebasing against a moving `main`; the existing escalation
   `five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md` is this
   option already running for three weeks.
3. **Hold the queue at zero armed until the backlog clears.** *Fails the "future" half.* It stops
   the growth but also stops the pipeline, and it silently discards the scheduling value of gates
   you have already released — `sec-a1`'s among them.

I cannot choose between these: it is a question about how you want to spend your own review time,
which only you know (§5.5).

### F4 — The `duplicate-verdict-guard` escalation was discharged correctly by the interactive lane — **ACTIONED**

`needs-marco/duplicate-verdict-guard-prs-2166-vs-2167-2026-09-24.md` is absent from the dev tree and
present at `needs-marco/discharged/` with a `_DISCHARGE-NOTE-*.md` beside it — **moved, never
deleted**, which is the required procedure.

I re-ran the escalation's own falsifying probe live rather than clearing on the note:
`gh pr view 2166 -R … --json state,closedAt` → **CLOSED `2026-09-24T20:18:46Z`, `mergedAt: null`**;
`#2167` → **OPEN**. The probe's stated condition (*"if either is already MERGED or CLOSED, this
escalation is spent"*) is satisfied, and the note additionally records the line-by-line diff proving
`#2167`'s superset covers `#2166`'s case, plus Marco's chat delegation of the duplicate question.

**Nothing GENERAL survives the closed PR**, so the discharge is sound. The tracked deletion rides in
this PR. ⚠️ `discharged/` is gitignored, so the note reaches nobody on its own — **which is why it
is named here.**

### F5 — I nearly filed a missing 20:1xZ occurrence that never went missing, from a probe run in a tree 3 behind `origin/main` — **ACTIONED**

🔴 **This is a §7 instrument lie I caught in my own draft, and it is worth more than the finding it
replaced.**

This run's first pass concluded that the 20:1xZ Station 00 occurrence *"left no breadcrumb and no
trace this run could reach"*, and drafted it as a DEFERRED finding about an hourly station missing a
fire. **It is false.** `00-00-supervisor-2026-09-24-2015-the-supervised-interactive-lane-cleared-the-receipt-escalation-and-armed-the-2158-fix-mid-run.md`
is **tracked on `origin/main` at depth 1** — a full report covering `2026-09-24T20:14:12Z–20:40Z`,
with six findings, all dispositioned, plus a 20:33Z addendum.

**How the wrong answer was produced, and why nothing warned.** `check-breadcrumb.mjs`'s structure
pass iterates `readdirSync(DIR)` over the **working tree**. Run in the dev tree — **3 commits behind
`origin/main`** — it listed 4 breadcrumbs and the 2015Z file was not among them, because the commit
that added it is one of the three this tree has not got. Exit 0 on the freshness pass, no error, no
empty result. §9.6 cannot fire: the tool answered exactly the question it was asked, about a
**different tree** from the one the question was about.

**What caught it:** the identical command run inside the PR worktree, which is checked out at
`origin/main`, listed the 2015Z breadcrumb immediately. POSITIVE control — the worktree's own pass
read `2 checked, 0 malformed, CLEAN, exit 0`, and its two entries are the 2015Z file and this one.

🔧 **The rule this run already knew and applied in the wrong place.**
`TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1` says to ask `git ls-tree -r origin/main`, never the dev
tree's index. I applied it correctly to the *tracked-set* probe in COLLECT — which is why the two
stale root copies were caught — and then answered a *different* question, "did that occurrence
report?", from the dev tree's **directory listing**, which has exactly the same staleness and no
rule attached. **The bullet is scoped to `ls-files`; the same tree is just as stale to
`readdirSync`, and `check-breadcrumb.mjs` is a `readdirSync` caller.**

**ACTIONED:** the finding is withdrawn and replaced by this record of the near-miss. The cost, had
it shipped, was a phantom missed-occurrence escalation about an hourly station — the same class of
confident-coherent-wrong finding §7 exists to stop, and the second time today a dev-tree read nearly
manufactured one.

⚠️ **Falsifying probe, and it costs one command:** run `check-breadcrumb.mjs` in the dev tree and in
a worktree at `origin/main` **whenever `git rev-list --left-right --count HEAD...origin/main` ≠
`0 0`**, and compare the `structure: N checked` counts. Here they were **4** and **2** over
overlapping sets. If they ever agree while the tree is behind, this finding is wrong and must be
re-measured.

⚠️ **The real coverage gap is smaller than the draft claimed, and is still worth naming:** Station
00 reported at 19:15Z and 20:14Z–20:40Z, then went blind at 21:15Z. **The unobserved window is
20:40Z → 22:14Z — 94 minutes**, not two and a half hours. The board was healthy across it.

### F6 — 04's F1/F4 (bootstrap contradicts the station doc) remain Marco's, and I am not re-escalating them — **DEFERRED**

Station 04 escalated that its scheduled-task bootstrap tells the station to read its binding
instructions from the working copy while the station doc says in red never to do that, and that
`lint-station.mjs` gates the repo half of that pair and nothing gates the bootstrap half.

**Both are correctly Marco's** — the fix writes under `C:\Users\Marco\Claude\Scheduled`, which no
station may touch. They are already in 04's breadcrumb, which this PR lands, and 04's `## FOR MARCO`
section states them with RULE 1 options. **Restating them as my own finding would double-count one
escalation**, which is how the `needs-marco/` queue reached 48 files.

⚠️ **One thing I can add from this run, and it strengthens 04's case:** the contradiction was live
today. The dev tree was **3 behind** `origin/main` at 22:14Z, so a station obeying its bootstrap
would have read a working copy that was demonstrably not `main`. It happened to be harmless — I
measured all three binding docs byte-equal to `origin/main` — but that was luck, and it is exactly
what 04's option 1 removes permanently.

### F7 — 04's F2 (`maintenance.lock`) and F3 (stale `packed-refs`) — **DISPATCHED** and **DEFERRED**

**F2 → DISPATCHED to Station 03 (Machine Minder).** `.git/objects/maintenance.lock`, 0 bytes,
mtime `2026-09-01`, 24 days old. 04 could complete only two of the three staleness tests (size and
age) because the third needs a Windows shell it did not have. **I had the shell and the sweep
completed the third for me:** `git processes touching our trees (scoped): 0` and
`git processes machine-wide (unscoped): 0`, on **both** sweeps ten minutes apart, with no
`MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / rebase state anywhere. **All three tests now say
STALE.**
**I did not clear it, and that is deliberate:** clearing a lock is Station 03's on 00's dispatch
(LL-38 — 00 dispatches machine repair, it does not do it), and this is `maintenance.lock`, which
does not freeze the board the way `index.lock` would. Handed to 03: the third test is now complete,
so 03 may clear it on its next run. Its cost is that `git maintenance` has been silently skipping
for 24 days, which degrades quietly.

**F3 → DEFERRED.** `.git/packed-refs` holds `refs/remotes/origin/main = 66194af6`, correctly
shadowed by the loose ref `9055c6b9`. **This is not a git defect** — `git rev-parse origin/main`
returns `9055c6b9`, as this run measured. It is a §9-family instrument trap that bites exactly the
fallback a **blind** station is pushed toward: with no shell, grepping `packed-refs` is the obvious
way to stamp GROUND, and it hands back a well-formed 40-hex SHA that is silently wrong by an unknown
distance. Both readings are well-formed, so §9.6 cannot fire. 04 avoided it by luck rather than by
method, and said so.
**Deferred rather than actioned** because the fix is a one-line addition to PREFLIGHT step 3 (*when
GROUND must be stamped from ref files, the LOOSE ref wins over `packed-refs`, and the value is
UNVERIFIED either way*), and PREFLIGHT sits inside the `station-contract` canonical block — the same
all-seven-docs re-record as F1's deferred half. **Both should ship in one canonical-block PR**, and
naming them together here is the point of deferring rather than dropping them.
**Trigger:** urgent the moment a blind station *acts* on a `packed-refs` SHA rather than merely
reporting one. 04's read-only authority contained it today; **00 and 02 have no such containment.**

---

## WHAT I DID NOT DO

- **Did not merge, close, rebase or touch any of the three open PRs.** All three are
  `[LABEL_PRESENT]` — parked by design. Only Marco removes the label, and a run that meets that
  verdict has finished.
- **Did not remove a `do-not-merge` label**, on any PR, for any reason. Absolute.
- **Did not write a CP-26 receipt for any of the three.** A receipt is only meaningful after the
  label is removed; writing one first would manufacture the signature the gate exists to demand.
- **Did not arm a second prompt.** ARM ONE AT A TIME — `sec-a1` is the one, and the arm was taken
  against a re-measured `SAFE TO ACT` and `armed = 0`.
- **Did not arm `pr-fv2-formrule-contract-HOLD.md`**, the other gate-satisfied ADMIT. It is a
  **confirmed duplicate** of open `#2158`: 9 of 12 scope entries overlap, and — confirmed on the
  **marker string**, never on the head branch, which the prompt asserts nowhere — its marker
  `fv2_formrule_contract` appears in `#2158`'s title/body; NEGATIVE control, a minted needle against
  the same body → **0**. §10.6's premise-dies-on-MERGE-not-OPEN is why it still lints ADMIT. Left in
  place, not binned: it retires itself when `#2158` merges.
- **Did not clear `maintenance.lock`** (F7). Station 03's, on this dispatch.
- **Did not prune the four orphaned worktrees** the sweep reported (`sup-cwd-paths`, `fv2drop`,
  `s8h`, `stage-formrule-web`). One — `C:/po-worktrees/sup-cwd-paths`, 881 min old — **holds 2
  uncommitted files**, and `git worktree remove` would refuse while `--force` would discard them.
  That is Station 03's lane and a destructive action besides.
- **Did not restore `.arming-log.txt` to `HEAD`.** It is an append-only superset (`2 0`) carrying
  another actor's audit line; restoring would have deleted it unrecoverably and every read-back
  would still have passed.
- **Did not commit the two stale root breadcrumb copies** (1915Z, 1810Z). Both are already tracked
  at `archive/` on `origin/main`; committing them at depth 1 is the 2026-09-07 duplicate this
  pipeline has already paid for once.
- **Did not run `git` through the device bridge**, in any form. The guard is INERT (exit 2), so the
  ban was remembered — and an inert guard is never a licence.
- **Did not commit on `main`, in any tree.** Everything went through this worktree and this PR.
- **Did not touch the watcher clone's git**, and did not restart the watcher — it is RUNNING and
  idle with an empty queue, which is correct, not wedged.
- **Did not edit `/sot/`** (Station 05's), write production data, or approach **Azure / Entra /
  SharePoint** (absolute, all stations).
- **Did not advance `sweep-rotation.json`.** 04 deliberately left it at position 4 of 4 because its
  `instruction-drift` sweep covered one bootstrap of five; advancing it would retire a sweep that
  did not happen. **That decision stands and is not mine to overturn.**

---

## FOR MARCO

**One decision, and one thing that fixed itself.**

1. **The board is parked on you, and only you can move it (F3).** #2167, #2164 and #2158 have been
   waiting on your `do-not-merge` label since 08:05Z, 12:48Z and 13:53Z; `sec-a1` will make it four
   within the hour. Nothing is broken — the two red checks on each PR are CP-26 `[LABEL_PRESENT]`,
   the gate doing its job. **The question is whether I should keep arming gate-cleared work while
   the release channel is closed, or hold the queue at zero until you have cleared the backlog.**
   Option 1 in F3 — release the three now, then keep arming — is the only one that passes both
   halves of RULE 1.
2. **The Windows bridge outage is over (F2).** Two consecutive scheduled runs stopped blind at
   preflight (00 at 21:15Z, 04 at 22:11Z) and escalated it to you. It self-cleared before 22:14Z and
   this run had full host access. **No action needed** — recorded so the two escalations do not read
   as still open. The cost was 94 minutes of unobserved board (20:40Z → 22:14Z); the board was
   healthy across it.
3. **Station 04's F1/F4 still need you** and are carried in its breadcrumb, which this PR lands: its
   scheduled-task bootstrap instructs the exact thing its station doc forbids in red, and nothing
   mechanically checks the bootstraps at all. Its option 1 — defer the paths to the station doc and
   extend `lint-station.mjs` to diff every bootstrap against the doc it points at — is the
   complete-and-additive one. It needs you because it writes under `C:\Users\Marco\Claude\Scheduled`.

---

## ADDENDUM 2026-09-24T22:5xZ — the post-merge fast-forward DID need a restore, and this file predicted it would not

Written after `#2181` merged (`2026-09-24T22:44:53Z`, merge commit `4a8ddcdb`) and the dev tree was
fast-forwarded. **Correcting a claim this breadcrumb makes about itself**, because it is a claim
about the data-loss trap, which is the one place a false *"I did not do that"* is most expensive.

🔴 **What this file says under WHAT CHANGED item 3:** *"After this PR merges, the dev tree's
fast-forward has nothing to block on, and no `git show HEAD:` restore is performed on the
append-only file at all."*

**The first half is right about CONTENT and wrong about the FAST-FORWARD.** [MEASURED] immediately
after the merge, with the dev tree 4 behind `4a8ddcdb`:

| probe | result |
|---|---|
| `git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` | **EMPTY** — the working copy already equalled `origin/main`; both arming lines had landed |
| `git status --porcelain --untracked-files=no` | still ` M` / ` D` on all three paths — because it answers about **HEAD**, not about `origin/main` (§9.2) |
| `git merge --ff-only origin/main`, attempted with those rows present | would refuse: the FF must update paths whose working tree differs from **HEAD** |

**So landing the paths removed the data-loss risk but not the FF blocker**, and the two are different
things. `git status` reporting against HEAD is exactly the §9.2 bullet, met from the direction this
file did not anticipate.

🔧 **What was actually done, in order, and every step is §9.2-safe:**

1. **Raw-Buffer restore from `HEAD` of all four paths** — the cheap first move, per
   `FF_RESTORE_MIXED_EOL_BLOB_NEEDS_RAW_BUFFER_V1`. All four `byteExact=true`:
   `.arming-log.txt` **25,784 B**, the discharged escalation **5,570 B**, the two retired HOLDs
   **10,213 B** and **7,186 B**. **This restore could not lose the 20:21:20Z line**, because it
   restores from the **post-merge HEAD**, which already carried it — that is the whole point of
   having landed it first, and it is why the sequence is safe in this order and would not have been
   in the other.
2. `git update-index --refresh` → **exit 1**, naming two paths still needing update.
3. **EOL discriminator on the one that mattered**, per the measured rule — dump the blob and the disk
   copy and count `\r\n` against bare `\n`:
   `needs-marco/duplicate-verdict-guard-…md` blob = **`{bytes:5570, crlf:0, bare:68}`**, i.e.
   **blob LF / checkout CRLF** ⇒ **convert-on-write**, not `--renormalize`. Applied: 5,570 → 5,657 B.
4. `git merge --ff-only origin/main` → **fast-forwarded on the first attempt**, `755f3440..4a8ddcdb`.

**All four read-backs, together:** `git rev-list --left-right --count HEAD...origin/main` → **`0 0`**
· `git diff --numstat` → **EMPTY** · `git diff --cached --name-status` → **EMPTY** ·
`git status --porcelain docs/pr-prompts` → **EMPTY**.

⚠️ **One path was deliberately NOT restored and still reads ` M`: `docs/data-model/metadata-catalog.json`.**
It is another actor's, and touching it is LL-38. It is also **outside the FF range** —
`git diff --name-only HEAD origin/main -- <path>` was **EMPTY**, and `git diff --numstat origin/main
-- <path>` was **EMPTY** too — so it could not block the fast-forward and did not. `git diff --cached`
was EMPTY throughout, so nothing of that actor's was ever staged into anything of mine.

⚠️ **And the stale root copies are now gone.** The 2115Z and 2211Z breadcrumbs were proved
content-identical to the `archive/` blobs this PR landed (11,410 B and 18,708 B, compared after
LF-normalising both sides) and then deleted from depth 1. `git status --porcelain docs/pr-prompts` is
**EMPTY**, so the 2026-09-07 duplicate-basename trap is closed for this cycle rather than handed on.

🔧 **The correction for the next run, stated as a rule rather than as this instance:** *landing a
blocking path in your own board PR removes the DATA-LOSS risk, not the FF blocker. You will still
restore from the new `HEAD` afterwards — and that restore is safe precisely because the content
already landed.* Do it raw first, obey `update-index --refresh`'s exit code, and only then reach for
an EOL branch.

⚠️ **Falsifying probe:** land a dirty tracked path in a board PR, merge it, then fast-forward the dev
tree **without** restoring. If `git merge --ff-only` succeeds, this addendum is wrong and must be
re-measured.

**DISPOSITION: ACTIONED** — the tree is at `origin/main`, clean, and the claim is corrected here.
