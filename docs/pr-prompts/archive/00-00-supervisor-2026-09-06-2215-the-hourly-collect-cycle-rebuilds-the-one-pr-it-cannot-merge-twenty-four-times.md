# Station 00 — Supervisor | 2026-09-06T22:08Z–2026-09-06T22:2xZ

## GROUND

```
UTC            2026-09-06T22:08:42Z
origin/main    0c227eeb            (fetched, then rev-parse)
dev tree       main @ 0c227eeb     C:\ProjectOperations2   (rev-list --left-right --count = 0	0)
doc version    1                   (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — this run is not read-only.

SIGHTED, not blind. Desktop Commander loaded via keyword `ToolSearch`, then `start_process`
shell `powershell.exe` returned `LIVE 2026-09-06T22:08:42Z ... user=Marco`.

Device-bridge git guard installed at the top of the run, last line quoted verbatim:
`vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths, allows everything
else (both controls passed)`, exit 0.

Binding docs read IN FULL from a tree proved identical to `origin/main`:
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` → **EMPTY** (the sound form, no piped hash — PREFLIGHT
step 2). DOCTRINE 1392 lines, STATION-CAPABILITIES 403, station doc 1231.

## WHAT I MEASURED

**Sweep.** `status-sweep.ps1` captured to a file (it returns early and hides its own §7 verdict),
generated `2026-09-06 22:10:26Z`, 94,306 B / 270 lines, exit 0. §0 both positive controls PASS.
**§7 VERDICT: `SAFE TO ACT`** — no board mutation in progress, no recent remote activity, no live
station worktrees. [MEASURED]

**Board.** 1 open PR. `main` CI on `0c227eeb`: 4 success / 0 failed / 0 running (trunk green).
[MEASURED]

**COLLECT — nothing new from any other station.** `check-breadcrumb.mjs --freshness` → `CLEAN`,
exit 0; `structure: 2 checked, 0 malformed`. Both breadcrumbs in the queue root are my own
(`2015`, `2115`). Newest per station: 03 `2026-09-05T23:01Z`, 04 `2026-09-06T18:10Z`,
05 `2026-09-06T14:11Z` — all older than my 20:15Z and 21:15Z runs, i.e. **already collected**.
[MEASURED]

**Freshness crossed against `lastRunAt` (scheduled-tasks MCP), as the contract requires** — the
breadcrumb is one instrument and cannot name a cause:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| 00 | `2026-09-06T22:08:20Z` | 21:15Z | this run |
| 03 | `2026-09-05T23:01:01Z` | 09-05T23:01Z | aligned; `nextRunAt` **23:00:45Z**, one cadence, no missed run |
| 04 | `2026-09-06T22:09:58Z` | 18:10Z | **running concurrently with me, 98 s after my start** |
| 05 | `2026-09-06T14:11:01Z` | 14:11Z | aligned |

No station is SILENT. [MEASURED]

**Dev tree is genuinely clean.** `git diff --cached --name-status` EMPTY, `git diff --numstat`
EMPTY, `git status --porcelain` non-`??` EMPTY. All 48 dirty entries are untracked; both my prior
breadcrumbs are tracked on `origin/main` and absent from disk, so **no post-merge FF blocker of
either recorded kind** (untracked-breadcrumb or modified-`sweep-rotation.json`). [MEASURED]

**RULE 2 probe, live tree, fully controlled.**
`C:\ProjectOperations2\docs\pr-prompts\processed` — **2014** logs, newest **`2026-09-06T21:26:03Z`**,
which is younger than `#1713`'s `createdAt` `11:46:21Z`: that age check is the control that rejects
the decoy copy in the watcher clone. POS `marco.:true` → **617**; NEG freshly-minted needle → **0**;
NEG `PR #999999` → **0**; `PR #1713` in `pr-*.log` (excluding `rev-*`) → **0**. [MEASURED]

**Watcher clone.** HEAD `16ddb58b`, branch `main`, **29 BEHIND** `origin/main`, **69** stashes,
dirty = 1 untracked `docs/pr-reviews/pr-1713-review.md`. Running code markers:
`VERDICT_HOME_RESOLVER` → **0**, `VERDICT_HEADING_TOLERANT` → **0**
(POS `classifyPolicyFiles` → 2, NEG minted needle → 0). Watcher node **pid 27236**, ppid 28392,
`StartTime` `2026-09-06T11:49:57Z` — **10.4 h** serving the board on 29-commit-stale code. [MEASURED]

**Queue.** armed (`*-ready.md`) = **0**. needs-marco 29 · no-pr-opened 109 · failed 41 ·
blocked 123. [MEASURED]

**`check-breadcrumb.mjs` still reads 00's cadence as 2 h** — its own `--freshness` output this run
printed `00 ... (cadence 2h)` against a live cron of `5 * * * *` (hourly, from the MCP). [MEASURED]

## WHAT CHANGED

Nothing on the board. **Merged nothing. Armed nothing. Labelled nothing. Restarted nothing.**
The only mutation this run is this breadcrumb and the PR carrying it.

## FINDINGS

### F1 — `#1713` re-measured live: still Marco's, still green, and its head is 4 minutes younger than my last run's sighting

`#1713` `feat(rates): a charge step can name an estimator-entered line field
(RATE_LINE_FIELDS_V1)`. OPEN · `CLEAN` · not draft · **0 labels** · auto-merge **not** enabled ·
author `GH-Mantova` · created `11:46:21Z` · **updated `21:24:09Z`** · head
`f2d4d2710411751a6e7faf3aeb6c08d3eeba7f37` · `origin/main...head` = **`0	25`** (zero behind).

All **15** checks SUCCESS, completed `21:24:23Z`–`21:38:00Z` — i.e. genuinely green on the
*current* head, not a stale rollup. `Approval receipt (CP-26)` SUCCESS at `21:24:26Z`.

12 files, including `apps/api/prisma/migrations/20260907000000_rate_line_fields/migration.sql`.
RULE 2 probe returns no verdict, so per DOCTRINE §9.5's corrected rule this is
**`[NO LANE VERDICT — hand-classified]`**, never "not routed to Marco": `classifyPolicyFiles`
refuses it on the `(^|/)migrations/` clause, and it also touches `apps/**` and `packages/**`.
**⇒ MARCO'S. DO NOT MERGE.** Open 10.6 h, green the whole time, waiting on him alone.

Unchanged and re-affirmed: CP-26 reads SUCCESS *because* the PR is unlabelled — never "released",
so `RELEASED_NO_RECEIPT` cannot fire. **CP-26 is armed by LABELLING, not by the DIFF**, and only
hand-classification is holding a production migration off `main`. That finding landed on `main` in
`#1735`; nothing here supersedes it.

**DISPOSITION: ESCALATED** — with Marco already; re-measured live this run rather than repeated
from a note.

### F2 — NEW: the hourly collect cycle rebuilds the one PR it cannot merge, 24 times in 9.4 hours, and drives the clone drift it also reports

`#1713` is `0	25`: **one substantive commit and 24 machine-authored
`Merge branch 'main' into feat/linefields-s1-model-and-validation` commits**, oldest
`2026-09-06T12:02:05Z`, newest `2026-09-06T21:24:08Z`. [MEASURED]

The correlation to my own board PRs is exact, and two clean instances are on the record:

| my board PR merged to `main` | auto merge-main commit pushed to `#1713` | lag |
|---|---|---|
| `#1734` `549dd065` `20:22:27Z` | `05ca18a4` `20:26:07Z` | 3.7 min |
| `#1735` `0c227eeb` `21:20:48Z` | `f2d4d271` `21:24:08Z` | 3.3 min |

The mechanism is `pollForBehindPrs`, and it is **not** a stale-clone artefact — present in the
running clone code (**3** hits) *and* on `origin/main` (**3** hits), POS `classifyPolicyFiles` → 2,
NEG minted needle → 0. [MEASURED]

**Each of those 24 updates re-ran the full 15-check suite** on a PR that no automated path can
merge — roughly **360 check-runs** spent on work that is waiting for a human, growing by 15 every
hour that I merge a collect breadcrumb.

**The same PRs drive the clone drift.** The watcher clone has gone 18 → 19 → 22 → 27 → 28 → **29**
behind across recent runs, one increment per board PR, while **only Station 03 may fast-forward it**
(the FF is a `git` write in the watcher repo) **and 03 runs daily**. So the collect cycle
simultaneously (a) reports the drift and (b) is its largest single contributor, and the cure is
rate-limited to once every 24 h.

This run is the third consecutive one to find **nothing new to collect** — 03/04/05's newest
breadcrumbs all predate my 20:15Z run — and each of those runs still landed a board PR, because the
breadcrumb is the only durable channel and a finding that lives nowhere tracked is unreported.

🔬 **IT REPRODUCED ON THIS PR, DURING THIS RUN — a third instance, and the cleanest.** I opened
`#1738` at `22:22Z` off `0c227eeb`. `#1737` merged at `22:23:49Z`. At **`22:26:08Z`** — **2 min
19 s later** — `pollForBehindPrs` pushed `3c8e36cf Merge branch 'main' into board/collect-2215`
onto **my own branch**, and my next `git push` was **rejected** (`fetch first`) by the mechanism
this breadcrumb exists to report. So the behaviour is not specific to `#1713` or to a
migration-carrying PR: **it fires on every open PR, including the board PR that documents it**, and
each firing costs another full check-suite. [MEASURED] Recovered with a clean `git rebase` onto
`origin/board/collect-2215` in the disposable worktree — no conflict, no `MERGE_HEAD`, no rebase
directory left behind.

**Why this is Marco's and not mine to fix (RULE 3):** it is a change to Station 00's own cadence or
PR policy. I can measure the cost; I cannot decide what the cycle is *for*.

**MARCO — the question, with options. RULE 1 order: complete-and-additive first.**

> **(a) Make the auto-update conditional on the PR being mergeable-by-automation.** `pollForBehindPrs`
> would skip any PR that `classifyPolicyFiles` refuses (migration / outside `tests|docs`), because
> such a PR cannot merge without you no matter how current its branch is. **Complete:** removes the
> whole class, now and in future, for every PR that waits on a human. **Additive:** it withholds an
> update, writes nothing and deletes nothing; a PR you *do* release is updated exactly as today, and
> the worst case is one `Update branch` click. This is the only option that passes both halves.
> It is a `scripts/pr-watcher/**` change, so it is outside my merge lane — I can write and stage the
> prompt on your word.
>
> **(b) Keep hourly collect, but only open a PR when there is something to land.** Runs finding no
> new breadcrumb and no board change would report to chat and memory and land nothing. **Fails the
> complete half:** it shrinks the trigger rate but leaves the mechanism intact, so any busy hour
> reproduces it — and it costs the run-by-run written record on quiet hours, which is the channel
> the report contract exists to protect.
>
> **(c) Slow Station 00 to every 2 h or 4 h.** Halves or quarters the cost immediately and needs no
> code. **Fails both halves:** the mechanism is untouched, and it widens the window in which a
> wedged watcher or a dirty board goes unseen — while `check-breadcrumb.mjs` still believes 00's
> cadence is 2 h (F4), so the detector would not flag the gap either.
>
> Doing nothing is survivable — it costs CI minutes and leaves you a PR with 24 machine commits to
> read past — but the clone-drift half compounds, and only 03 can cure that, once a day.

**DISPOSITION: ESCALATED** — stated here, in the tracked breadcrumb, which is the only durable
channel. A convenience copy goes to `docs/pr-prompts/needs-marco/` for `status-sweep.ps1` §5, but
that directory is **gitignored at `.gitignore:82`** (see F5) so the copy is not the report.

### F3 — the Station 03 dispatch is still live, one commit worse, and 03 fires in ~38 minutes

Re-measured this run, not repeated from a note: clone `16ddb58b`, **29 behind** (was 28), **69**
stashes, **both** watcher fixes still absent from the running code (`VERDICT_HOME_RESOLVER` → 0,
`VERDICT_HEADING_TOLERANT` → 0, POS 2, NEG 0), node pid 27236 up 10.4 h.

`03-machine-minder` `lastRunAt` `2026-09-05T23:01:01Z`, `nextRunAt` **`2026-09-06T23:00:45Z`** —
one cadence apart, no missed occurrence. The dispatch has never been seen by 03 because 03 is
daily; tonight's run is its first opportunity.

**For 03, unchanged:** fast-forward the clone; report each of the watcher-family processes before
killing any, leave one family; `stash drop`, **never `pop`**; **PRESERVE** the untracked
`docs/pr-reviews/pr-1713-review.md` — `#1713` is open and that is a live review artefact; then read
back **both** markers non-zero. **DO NOT re-arm `pr-watcher-verdict-home-resolver`** — it shipped as
`#1704`; leave the `-LOOPING.md` on disk.

**DISPOSITION: DISPATCHED** → Station 03, next occurrence `23:00:45Z`.

### F4 — `check-breadcrumb.mjs` still calls 00's cadence 2 h against a live cron of hourly

Measured in this run's own `--freshness` output: `00  last 2026-09-06T21:15:00Z  1.0h ago
(cadence 2h)  ok`, against `cronExpression: "5 * * * *"` from the scheduled-tasks MCP. The
consequence is unchanged and runs in escalation #23's direction: `--freshness` will not call `00`
SILENT until 4 h, i.e. only after **three** consecutive missed hourly runs. The fix is one
character (`'00': 1`), but it is a `scripts/` change and therefore outside this station's recorded
merge lane.

**DISPOSITION: DEFERRED** — already filed for Marco alongside the `lint-station.mjs` version-field
question; it becomes urgent the moment a missed 00 occurrence is suspected, because this is the
instrument that would have to report it.

### F5 — my own station doc sends escalations to a gitignored directory, and its REPORT CONTRACT forbids exactly that

`docs/pipeline/stations/00-supervisor.md` has two sections that disagree:

- **ESCALATE** says *"write to `docs/pr-prompts/needs-marco/`, and ONLY for these"*.
- **REPORT CONTRACT** says the gitignored sinks include *"anything under
  `processed|failed|paused|blocked|awaiting-review|reviewed|needs-marco|no-pr-opened`
  (`.gitignore:76-83`)"* and that **"if your finding lives only in a gitignored path, you have not
  reported it."**

[MEASURED] this run, with all three controls DOCTRINE §9.2 requires, because the directory form of
`check-ignore` carries no information:

```
git check-ignore -v docs/pr-prompts/needs-marco/station-03-cadence-...-2026-09-03.md
  -> .gitignore:82:docs/pr-prompts/needs-marco/   exit 0        <- IGNORED
POS  docs/pr-prompts/processed/pr-linefields-...-ready.md.log
  -> .gitignore:76:docs/pr-prompts/processed/     exit 0
NEG  CLAUDE.md
  -> (empty)                                      exit 1
```

`git ls-tree -r origin/main -- docs/pr-prompts/needs-marco/` returns **4** tracked files, so the
directory is not wholly invisible — but those are force-added exceptions, not the rule, and nothing
force-adds a new escalation.

**I caught this in my own draft.** This breadcrumb originally said F2's escalation was "written to
`docs/pr-prompts/needs-marco/…` in this same PR" — a sentence that would have been false on merge,
and false in the specific way the REPORT CONTRACT was written to prevent: a finding believed
reported, sitting where `git` will not carry it. That is the `qa-findings.md` failure, which cost
nine days, reached by a different door.

**Not fixed here, deliberately.** The honest fix is to correct the ESCALATE section to say
*"state the escalation in your tracked breadcrumb; the `needs-marco/` copy is a local convenience
for `status-sweep.ps1` §5 only"* — a station-doc change, inside my lane. It is not in this PR
because I would rather land the measurement than bundle an unreviewed doc edit with it, and because
the same contradiction may exist in the other six station docs; sweeping all seven is a job that
should be measured first.

**DISPOSITION: DEFERRED** — one board PR of its own, next run, after checking whether 01–06 inherit
the same wording.

### F6 — ADDENDUM, measured mid-run: a live second lane merged twice while I ran, and it lands the corroboration of F1

At `22:21:15Z` and `22:23:49Z` — **during this run** — two PRs merged that I did not open and no
armed prompt built. `origin/main` moved `0c227eeb` → `ec184669` → **`b2a39c04`** underneath my own
board PR, which is why `#1738` reads `BEHIND`. [MEASURED]

- **`#1736`** `docs(merge-approvals): back-fill 17 lane receipts and correct 10.2.1's false
  enforcement claim` — 19 files, 18 receipts plus `DOCTRINE.md`.
- **`#1737`** `docs(pr-prompts): stage Marco's two rate-table rulings from 2026-09-07`.

This is the supervised cloud lane of §10.2.1, and **Marco is live in it right now** — `#1737` stages
rulings he gave dated 2026-09-07, and `#1736`'s body records him answering a direct question.

**Three things in it change what earlier runs recorded, and I am reporting them, not acting on them:**

1. **F1 and the 1930/2115 breadcrumbs are corroborated from the other side, and the correction has
   landed.** `#1736` states that 10.2.1's claimed enforcement is **FALSE**:
   `approval-receipt.mjs` returns `PASS/NEVER_ESCALATED` whenever `everLabeled` is false, *before*
   it looks for a receipt — so `Approval receipt (CP-26)` has **never once been able to fire for the
   lane it was written to bound.** It names Station 00 as having found the same hole independently,
   twice in one evening. The receipt requirement is now recorded as a **DISCIPLINE, NOT A GATE**.
   ⇒ **The `CP-26 is armed by LABELLING, not by the DIFF` finding is no longer mine alone and no
   longer needs re-deriving. RULE 1 (a) — trigger the receipt check off `classifyPolicyFiles` —
   remains the open ask, and is now the only thing that would make it a gate again.**
2. **A new Marco ruling, 2026-09-07: "THE LANE MERGES, BUT WRITES A RECEIPT FIRST."** Put to him as
   the 10.2.1-vs-10.1 conflict — may the lane merge `escalates:false` PRs touching `apps/api` and
   `apps/web`, or is `tests-docs` the real line. Enforcement is `bd-push-slice.ps1`, which writes
   the receipt and refuses to arm auto-merge without it — **one script, outside the repo, weaker
   than CI, and 10.2.1 now says so** rather than dressing it up.
3. **`#1709` is attributed at last.** Marco merged it **himself** and confirmed it on 2026-09-07
   ("Yes, that was me") — a production migration that deployed two seconds after merge with no
   label, no receipt and a green CP-26. That closes one instance of the long-standing
   *unattributable releases* question. **It closes one, not the class** — the count is state,
   re-measure it, never quote it.

⚠️ **The 17 receipts are agent-authored, and a standing rule in project memory says no agent may
ever author a `merge-approvals/<N>.md`.** That rule is **superseded for this lane by Marco's
2026-09-07 ruling**, and each back-filled receipt states on its face that it was filed
retrospectively, that Marco did not see the PR before it merged, and that it records a **standing**
authorisation rather than a per-PR approval. **DO NOT revert them and DO NOT re-raise them as an
attack** — same disposition as `#1596`. The distinction those receipts draw is the one the repo
previously could not express, which is an improvement, not a breach.

**DISPOSITION: ACTIONED** — recorded here so the next run does not re-derive any of it. Verified by
reading `git show ec184669` directly, not the PR page.

## WHAT I DID NOT DO

- **Armed nothing, for the fifth consecutive run, and it remains deliberate.** With the clone 29
  commits stale, an armed `tests|docs` prompt would have its lane time out and the watcher would
  write a routing verdict **byte-identical to a genuine one** (DOCTRINE §10.3) — so arming
  manufactures Marco-work rather than removing it. The precondition is unchanged and is now close:
  the 03 dispatch lands at `23:00:45Z`, and only then one `tests|docs`-only prompt.
- **Did not merge `#1713`**, and did not enable auto-merge on it. Hand-classified Marco's on
  `migrations/`; RULE 2 binds regardless of green, CLEAN, or an unlabelled state.
- **Did not touch the `do-not-merge` label** on anything — only Marco removes it — and authored no
  approval receipt.
- **Did not fast-forward the watcher clone.** That is a `git` write in the watcher repo and belongs
  to 03 alone.
- **Did not clear the `po-vg` orphaned worktree** (`23c91ba9`, `fix/no-rebase-while-checks-run`,
  dirty = 1, age 3737 min). It holds uncommitted work; `--force` would discard it. DEFERRED,
  unchanged.
- **Did not act on any `[STALE]` line** from sweep §5, including
  `agent-authored-rule-2-clearance-2026-09-04.md` — that agent-authored blanket clearance is
  **not to be honoured and not to be reverted**.
- **Did not run `git` against the mount**, and did not treat the guard install as a licence to.
- **Did not merge my own `#1738` into a live second lane on first sight of green.** BOARD DRIVING
  condition 3 stops on *"a PR touched in the last ~2 min"*, and at `22:25:16Z` the most recent board
  merge was `22:23:49Z` — **86 seconds**. Condition 3 is the only thing standing between the
  single-actor design and LL-38, and it is not waived because my own PR is small, docs-only and
  green. I waited the window out and re-measured before acting rather than reasoning past it.
