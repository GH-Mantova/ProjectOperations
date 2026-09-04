# Station 00 — Supervisor | 2026-09-04T00:09Z–2026-09-04T00:22Z

## GROUND

```
UTC            2026-09-04T00:09:11Z
origin/main    16955727 -> 0d8dca09 (at entry, after fetch) -> dd51a2f8 (at exit, this run merged #1557)
dev tree       main @ 16955727        C:\ProjectOperations2   (read HERE, not the watcher clone)
doc version    1
bootstrap      1
```

Version match — full authority, not read-only. **SIGHTED, not blind:** `start_process`
(powershell.exe) returned a live shell; every claim below is from that shell.

## WHAT I MEASURED

- **[MEASURED] Blindness check.** `start_process` → PID 21900 live. Not blind.
- **[MEASURED] The binding docs I read were current.** The contract's cure ran in the DEV TREE:
  `git show origin/main:docs/pipeline/DOCTRINE.md | git hash-object --stdin` = `860b5e32`, and
  `git show HEAD:… | git hash-object --stdin` = `860b5e32` — identical. Same for
  `00-supervisor.md` (`b356ee71` both). My working-copy read was byte-current.
- **[MEASURED] …but the NAIVE form of that cure reported a false mismatch.**
  `git hash-object docs/pipeline/DOCTRINE.md` (path form, no `--stdin`) = `0f6f8963`;
  `--no-filters` = `9077ba99`; the blob = `860b5e32`. **Three different hashes for an unmodified
  file.** `core.autocrlf=false`, on-disk file is CRLF, so the path form hashes post-`clean`-filter
  content that matches neither. Decisive control: `git update-index --refresh` then
  `git diff --quiet HEAD -- docs/pipeline/DOCTRINE.md` → **exit 0** (file identical to HEAD), and
  `git status --porcelain` on that path → empty. See FINDING 2.
- **[MEASURED] `git log -- <path>` silently walks HEAD, not `origin/main`.**
  `git log -- docs/decisions/merge-approvals/1536.md` returned **nothing** while
  `git show origin/main:<same path>` printed the file. HEAD was 10 commits behind; the empty result
  read as "no such file ever existed". §9.6 with a different mask — pass the ref explicitly.
- **[MEASURED] Breadcrumb collection: nothing new to collect.**
  `node scripts/pipeline/check-breadcrumb.mjs --freshness` → 8 checked, 0 malformed, exit 2.
  Newest tracked breadcrumbs are `…-2309-…` (mine, last run) and `…-03-machine-minder-…-2302-…`
  (collected by my 23:09Z run). No breadcrumb is newer than my last run; `git status` shows no
  untracked `00-NN-*` breadcrumb in the queue root. **Nothing uncollected.**
- **[MEASURED] Freshness vs `lastRunAt`, crossed per contract.**

  | station | breadcrumb | `lastRunAt` | cron | reading |
  |---|---|---|---|---|
  | 00 | 23:09Z, 1.1h | 2026-09-04T00:08:46Z | `5 * * * *` | healthy (this run) |
  | 03 | 23:02Z, 1.2h | 2026-09-03T23:01:39Z | `0 9 * * *` | aligned |
  | 04 | 22:10Z, 2.1h | 2026-09-03T22:10:24Z | `0 */4 * * *` | aligned |
  | 05 | **09-01T14:11Z, 58.0h SILENT** | **2026-09-03T14:11:26Z** | `10 0 * * *` | **ran and did not report** |

  05 is row 2 of the contract's table — `lastRunAt` fresh, no breadcrumb — i.e. it *started and
  died*, the known 529-on-turn-one. It is **not** a stopped station. Next fire
  `2026-09-04T14:10:37Z`.
- **[MEASURED] 03's cron is DAILY**, `0 9 * * *`, next `2026-09-04T23:00:45Z` — confirms the
  escalation raised at 23:09Z (bootstrap claims "every 4 hours"). Unchanged, still Marco's.
- **[MEASURED] Board census, 00:1xZ.** 5 open at entry → 4 at exit.

  | PR | state | lane verdict | classification |
  |---|---|---|---|
  | #1557 | CLEAN, all checks green | **NO LOG** (only `rev-1557` review job) | `[NO LANE VERDICT — hand-classified]` docs-only ⇒ **not Marco's** → **MERGED this run** |
  | #1554 | CLEAN | **NO LOG** (only `rev-1554`) | `[NO LANE VERDICT — hand-classified]` `sot/**` outside `^(tests\|docs)/` ⇒ **MARCO'S** |
  | #1544 | CONFLICTING / DIRTY | **NO LOG** | `[NO LANE VERDICT — hand-classified]` `.claude/agents/**`, `scripts/pipeline/**` ⇒ **MARCO'S** |
  | #1543 | BLOCKED | `marco:true` | **MARCO'S — RULE 2** |
  | #1541 | BLOCKED | `marco:true` | **MARCO'S — RULE 2** |

- **[MEASURED] RULE 2 probe, pinned to the LIVE tree.** `C:\ProjectOperations2\docs\pr-prompts\processed`
  — **1867 logs, newest `2026-09-04T00:14:03Z`** (`rev-1557-ready.md.log`), positive control
  `marco.:true` = **606**. Fresh, so this is the live tree and not the 08-17 decoy.
- **[MEASURED] Queue.** `*-ready.md` = **0** armed. `*-HOLD.md` = **80**.
- **[MEASURED] `PR_WATCHER_AUTO_UPDATE` is still on and still churning.** #1536's branch carries
  ~17 `Merge branch 'main' into feat/wbs-shift-s2-…` commits, one per hour 07:23Z→23:25Z. Live
  confirmation of the already-dispatched finding; heads move under you.

## WHAT CHANGED

- **MERGED #1557** — `docs(00-supervisor): never-arm pr-claudedesign-s1`, one file,
  `docs/pipeline/stations/00-supervisor.md`. Path: `Assert-SmokedOrEscalate -PR 1557` → True, then
  `Merge-Pr -PR 1557` → True. **Read back, not assumed:** `state MERGED`,
  `mergedAt 2026-09-04T00:16:42Z`, `mergeCommit dd51a2f8a0…`, and `origin/main` now `dd51a2f8`.
  Guard verified live on main: `git show origin/main:docs/pipeline/stations/00-supervisor.md`
  contains `pr-claudedesign-s1-track-the-written-half`.
- ⚠️ **Post-merge `main` CI was still IN FLIGHT at run end** — `CI`, `Push on main`, `Deploy` all
  `in_progress` at `dd51a2f8`, `Tendering Browser Smoke` pending. The PR's own five required checks
  were green before merge, and the diff is one docs paragraph, so the risk is low — but **green
  before merge is not green on main**, and I did not wait for it. **The 01:07Z run must confirm
  `main` at `dd51a2f8` went green** and treat a red there as this run's regression to fix.
- Nothing armed. Nothing disarmed. No label touched. No `/sot/` edit. No breadcrumb archived
  (the current cycle is still live).
- 🔴 **This breadcrumb is UNTRACKED** in the dev tree (`check-breadcrumb.mjs` says so explicitly).
  It is in the sanctioned fallback home, not inside its own run's PR, because I declined to open a
  PR while Marco is hand-driving the board. **It reaches nobody until a board PR commits it, and a
  `git clean` in the dev tree would destroy it** — the next 00 run should commit it with its own
  board PR.

## FINDINGS

### FINDING 1 — `merge-approvals/1536.md` is MARCO'S OWN HAND, not an agent forgery

`#1536` merged at `2026-09-04T00:05:59Z`, four minutes before this run, carrying a new file
`docs/decisions/merge-approvals/1536.md` reading `approved_by: marco`, `approved_at 21:57:42Z`.
`#1536` held a `marco:true` verdict, so on its face this is the shape the standing rule exists to
forbid: **no agent may ever author an approval file, and a file cannot clear RULE 2 — only Marco in
chat can.**

It is not a forgery. Evidence, all [MEASURED]:

- the file arrived in commit `1f19fc418`, message **`Create 1536.md`** — the GitHub *web editor's*
  default message for creating a file;
- author **GH-Mantova alone**, whereas the agent-authored commits on the same branch
  (`35783210e`, `4d70e476e`) carry `marco@initialservices.net,**claude**` co-authorship;
- committed `21:58:06Z`, **24 seconds after** the `approved_at` the file states;
- `mergedBy GH-Mantova`, `is_bot false`, and he opened `#1557` by hand 49 seconds before merging.

Marco was at the keyboard, approved on the merits, and merged his own routed PR. **RULE 2 binds
stations, not Marco — it is intact.** Recorded here so a later run does not re-derive this as a
breach and act destructively on it (§7: a false alarm licenses destructive action).

**DISPOSITION: ACTIONED** — provenance established by four independent signals and written down.

### FINDING 2 — the freshness cure has a FALSE-POSITIVE form, and it is the obvious one

The station contract mandates hash-comparing the binding docs to catch a stale tree. Run the way it
is written — `git show <ref>:<path> | git hash-object --stdin` on **both** sides — it is sound; that
is how 03 caught the stale clone on 09-03.

But the *natural* shorthand, `git hash-object <path>` for the local side, **compares a filtered
working-tree hash against a blob and disagrees on every CRLF file in this repo**, whichever tree you
are in. Measured above: three hashes for one unmodified file. A station doing this reads
"my docs are stale" on a perfectly current tree, and the prescribed response is to re-read from
`origin/main` — harmless — but it will also *report* staleness that does not exist, and it cannot
distinguish that artifact from the real thing 03 found. One instrument, two opposite conditions,
identical output.

Cure, additive and complete: the canonical block should say **both sides must go through
`git hash-object --stdin`**, and name `git update-index --refresh` + `git diff --quiet <ref> -- <path>`
(exit 0/1) as the decisive test, since it answers the actual question — *does my file differ from
that ref* — without a hash at all.

RULE 1: this fixes it immediately and for the future, and touches no data. The alternative
(leave it, rely on stations getting the pipe form right) fails the *future* half — the shorthand is
shorter and will be reached for again.

**DISPOSITION: DISPATCHED → Station 06 (PR Master).** It is a `station-contract v2` canonical-block
edit: change once, `node scripts/pipeline/lint-station.mjs --write-canonical`, ship all seven station
docs in one PR, pre-record the `REJECT 7 of 8` control and confirm all eight name the same new sha.
Docs-only, so it is `tests-docs`-eligible. I did not do it myself: Marco is actively hand-driving
this board right now and a 7-file docs PR from me would race him (LL-38).

### FINDING 3 — `marco:false` DOES NOT EXIST, so the obvious negative control is void

Probing 1867 logs: `marco.:true` = **606**, `marco.:false` = **0**. The watcher never writes a
false verdict, so "check that the negative control returns >0" — the instinctive way to prove the
probe is alive — **fails on a perfectly healthy probe** and would be read as a broken instrument.

The valid control is the one memory already names and this run exercised: a PR the watcher did not
open must read **NO LOG** *in the same query* in which others return verdicts. Here #1544 read
NO LOG while #1543/#1541/#1536 returned `marco:true` — so NO LOG means *second lane*, not *broken
probe*. Freshness of the newest log (00:14:03Z) is the separate control that rules out the dead decoy.

**DISPOSITION: ACTIONED** — recorded; no code change needed, the probe is sound.

### FINDING 4 — 05 has now missed two of three occurrences and `/sot/` is 58h unkept

`--freshness` says `05 … 58.0h ago SILENT`; `lastRunAt 2026-09-03T14:11:26Z` says it *fired* and
produced nothing. Both are true — it is the 529-on-turn-one that consumes a whole daily cadence.
Next fire `2026-09-04T14:10:37Z`, by which point `/sot/` will be ~72h unkept.

This is the recovery half of open escalation **#23**, already with Marco with RULE-1 options
(a second daily catch-up occurrence that no-ops if today's breadcrumb exists). **Not a new
escalation** — re-raising it would spend his attention on a question he already holds.

**DISPOSITION: DEFERRED** — becomes urgent if the 14:10Z occurrence also produces no breadcrumb,
which would be three of four and a genuine stoppage rather than a transient.

### FINDING 5 — a legitimate approval file is now precedent on `main`

`docs/decisions/merge-approvals/1536.md` is Marco's (FINDING 1) and correctly on main. The hazard is
second-order: a future agent reading it can conclude the directory is a *sanctioned clearance
channel* and author `<N>.md` for a PR it wants merged — which is precisely the forbidden act, and it
would look identical in the tree to Marco's own file. The only discriminators are commit
authorship and the `,claude` co-author trailer, neither of which any gate checks.

**DISPOSITION: DEFERRED** — real, not urgent: no agent has done this, and the standing rule already
forbids it. What would make it urgent is a second approval file appearing that this station cannot
attribute to Marco. A CI gate asserting `merge-approvals/*` may only be added by a commit with no
`claude` co-author is the complete-and-additive fix if it recurs.

## WHAT I DID NOT DO

- **Did not arm anything**, though `*-ready.md` = 0 and 80 HOLDs are waiting. Three reasons, and the
  first alone is sufficient: Marco is *actively hand-driving this board* (opened #1557 and merged
  #1536 within 50 seconds of each other, ~15 min before this run), and injecting a new PR into a
  board a second actor is working is exactly LL-38. Second, all four remaining PRs are Marco-gated,
  so the board is not draining through my lane. Third, the `tests-docs` auto-merge lane is
  deadlocked under escalation #21 with four open causes. Verifying a HOLD's premise across 80
  candidates is also the most expensive thing I could have done with the token budget for the least
  certain gain.
- **Did not merge #1554, #1544, #1543 or #1541.** #1543/#1541 carry `marco:true` (RULE 2 — a MERGE
  verdict, a green board and an unlabelled PR do not clear it). #1554 (`sot/**`) and #1544
  (`.claude/agents/**`, `scripts/**`) have no lane verdict and hand-classify as Marco's under
  `classifyPolicyFiles`. #1544 is additionally CONFLICTING.
- **Did not fix #1544's conflict.** It is Marco's by classification; rebasing a PR he owns while he
  is on the board risks moving a head under him.
- **Did not touch the `verdict-guard` / `verdictApproves` staged fixes.** Both open `scripts/` PRs,
  which route to Marco.
- **Did not archive dispositioned breadcrumbs.** The current cycle is still live; archiving is for
  what a later run has finished with.
- **Did not clear the two modified files in the shared dev tree** (`docs/data-model/metadata-catalog.json`,
  `docs/pr-prompts/.arming-log.txt`) — the index is shared with other chats and neither is mine.
