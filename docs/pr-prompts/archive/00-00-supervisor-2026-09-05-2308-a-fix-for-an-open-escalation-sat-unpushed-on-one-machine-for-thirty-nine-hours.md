# Station 00 — Supervisor | 2026-09-05T23:08Z–2026-09-05T23:5xZ

## GROUND

```
UTC            2026-09-05T23:08:59Z
origin/main    02cd539f            (git fetch origin --prune, then rev-parse, in the DEV TREE)
dev tree       main @ 7695b3a5     C:\ProjectOperations2   (2 commits behind origin/main, dirty)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — this run was not restricted read-only by a version mismatch.

🟢 **SIGHTED RUN.** `start_process` shell `powershell.exe` succeeded on the first call, after the
schemas were loaded with a keyword `ToolSearch` for `desktop-commander` (PREFLIGHT step 1: a
validation error is not blindness; only a failure *after* the load is). Every claim below is a probe
on the Windows box, not a GitHub-side substitute. **This matters this run**: my three immediate
predecessors at 22:09Z was blind, and four items it could only DEFER were explicitly carried to
"the next sighted 00 run". That is this one, and they are ACTIONED below rather than deferred a
third time.

Binding documents were read from the dev tree **after proving it identical to `origin/main`** —
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY output**, which is the real answer (§9.1; no piped
hash was used anywhere in this run).

Fresh negative-control needle minted for this run per §9.6: `zzQq00Needle20260905T2312`, plus
`zzQq00Anchor20260905T2330` for the document-edit anchors. **Both are now spent**, because this file
is tracked.

## WHAT I MEASURED

### Sweep — SAFE TO ACT, captured to a file because it returns early

`scripts/pipeline/status-sweep.ps1`, run with `-File` and redirected to
`C:\po-sup-fix-scripts\sweep-20260905-2312.txt` (43,934 B) because the script returns before its own
§7 verdict is streamed. Section 0 positive controls both PASS (`gh CAN reach GitHub (saw merged PR
#1681)`, `node runs`); no `[BROKEN]`; **section 7 = `SAFE TO ACT`** at 23:09:45Z. Re-run immediately
before the board mutation (below), because a sweep verdict is `[LIVE]` and expires the moment it
prints — `#1615` merged 110 seconds after a sweep said SAFE on 2026-09-05T06:0xZ.

### Board — FIVE open PRs, and not one of them is 00's to merge

RULE 2 probe pinned to the LIVE directory `C:\ProjectOperations2\docs\pr-prompts\processed`
(**1971 logs, newest 2026-09-05T22:37:32Z** — younger than every open PR, which is the control that
separates it from the 21-log, 17-day-stale decoy in the watcher clone that passes its own mandated
positive control and then clears everything since August). Controls: POSITIVE `marco.:true` → **614**
· NEGATIVE fresh needle → **0** · NEGATIVE `PR #999999` → **0**. Probe written without a quote
character, over `pr-*.log` only (excluding `rev-*`, which name PRs from both lanes and carry zero
lane information).

| PR | `pr-*.log` hits | `opened PR #` in launch log | lane | verdict |
|---|---|---|---|---|
| **#1682** | **0** | **absent** | second lane, `[NO LANE VERDICT — hand-classified]` | **MARCO'S** — `apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx` and `ScopeCardsTab.tsx` match none of the three `NESTED_TEST_PATHS` forms |
| **#1680** | 2 | present, `21:41:26.888Z` | watcher | `marco:true`, `outside tests/ or docs/: package.json` — **RULE 2** |
| **#1675** | 1 | present, `17:27:48Z` | watcher | `marco:true`, the manufactured timeout string — **RULE 2** (§10.3 does not clear it) |
| **#1667** | 0 | absent | second lane | **MARCO'S** — `scripts/pipeline/lint-prompt.mjs` |
| **#1662** | 0 | absent | second lane | **MARCO'S** — migration dropping five columns, §5 hard stop |

Launch-log discriminator controlled positively against its own last six `opened PR #` lines
(`#1589 #1606 #1609 #1612 #1675 #1680`) and negatively against the fresh needle → 0.

### #1682's red — root cause NAMED from the job log, not from the diff

`gh pr checks 1682`: **13 pass / 1 fail**. The failure is `tendering-e2e`, run 33996110993 job
101386863555, log pulled through `cmd /c` to a file (410,596 B) and filtered:

```
Run PR-acceptance E2E suite  Error: strict mode violation: getByText('Concrete cutting') resolved to 2 elements
                             > 48 | await expect(page.getByText("Concrete cutting")).toBeVisible();
                             4 failed
                             160 passed (9.5m)
Run Tendering browser smoke  19 passed (1.5m)
```

**The PR is not broken; an existing acceptance test's locator is.** `#1682` adds a
`CuttingSection.tsx` that renders the string "Concrete cutting" a second time on the scope-cards
page, and four `pr-acceptance/batch3-scope-*` tests assert on an **unscoped** `getByText("Concrete
cutting")` at line 48. Playwright strict mode then fails on ambiguity, not on absence. The four
failures are the same assertion in four spec cases; the other 160 pass and the browser smoke is
clean.

### 03's breadcrumb REJECTed as malformed, and the REJECT was an artefact of reading it mid-write

`node scripts/pipeline/check-breadcrumb.mjs --freshness` at 23:1xZ returned **exit 1**, `REJECT: 1
malformed breadcrumb(s)`, naming Station 03's 23:01Z file as missing four of the five required
sections. It was not malformed. Station 03's run was **still writing it**:

```
23:11:44Z   6,679 B   check-breadcrumb -> REJECT (missing WHAT I MEASURED / WHAT CHANGED / FINDINGS / WHAT I DID NOT DO)
23:13:27Z  22,853 B   check-breadcrumb -> ADMIT, "structure: 5 checked, 0 malformed"
23:15:11Z  28,975 B   (final)
```

Same file, same instrument, three readings, two opposite verdicts. Had this run reported it as
filed, it would have accused a healthy station of shipping a malformed report — a §7 false alarm,
and false alarms licence action. Recorded as FINDING C below.

### Freshness — every station inside cadence

`00` 1.0 h · `03` 0.2 h · `04` 1.0 h · `05` 9.0 h, all `ok`. ⚠️ **`00`'s row is the weak one and it
is weak in escalation #23's direction**: `check-breadcrumb.mjs`'s own `CADENCE` map still holds
`'00': 2` against a live cron of `5 * * * *`, so it will not call 00 SILENT until three consecutive
hourly runs are missed. Already recorded in `STATION-CAPABILITIES.md` §6 and filed for Marco; not
re-raised here. Cross-checked against the fact that four station runs (00 at 21:08Z and 22:09Z, 04
at 22:10Z, 03 at 23:01Z) each left a breadcrumb in the last three hours.

### Machinery

From the sweep, all `[LIVE]`: watcher node **RUNNING pid 20000**, auto-restart wrapper alive (1),
heartbeat 33 min (ticks mid-run only; stale + empty queue = idle, not wedged), armed `*-ready.md`
= **0**, in-progress prompts 0, `index.lock` False/False in both trees, 0 git processes, no PR
touched in the last 2 min. Station 03 measured the same machine independently 7 minutes earlier and
agrees line for line. **No restart was needed and none was performed.**

## WHAT CHANGED

One board PR, built in a **disposable worktree** off `origin/main` (`C:\po-wt\board-2308`, branch
`docs/board-collect-2026-09-05-2308`) — never in the dev tree, never in the watcher clone. This
breadcrumb was written **inside that worktree**, which is cure 1 of the post-merge fast-forward rule:
no loose untracked copy is left in the dev tree, so the FF-blocker this station has paid for four
times cannot occur for this file.

1. **`docs/pipeline/DOCTRINE.md` §9.5** — the `docs/pr-reviews/` bullet's *cure* is inverted and the
   measured cause appended. Anchor controls asserted `1 / 1 / 1 / 0` before the edit.
2. **`docs/pipeline/DOCTRINE.md` §9.3** — new bullet: `| Measure-Object -Line` silently drops blank
   lines.
3. **`docs/pipeline/stations/_canonical-blocks.json`** — `instruments v2` re-recorded to
   `c2d7239ca442a8fe` via `node scripts/pipeline/lint-station.mjs --write-canonical`. Before the
   re-record `lint-station.mjs` read `REJECT: 1 of 8`; after it reads **`ADMIT: all 8 docs clean`**.
   Both edits are inside `CANONICAL-BLOCK: instruments v2`, which `Select-String` finds in
   **DOCTRINE.md alone** (2 hits, open + close) and in **zero** station docs — so this is one file
   plus one hash line, not "all seven station docs", which is the scope estimate that cost two
   earlier runs.
4. **`docs/pr-prompts/.arming-log.txt`** committed (04's F3) — the 2026-09-05T21:33:19Z arm of
   `pr-deps-s1-fasturi-browserslist-overrides` existed only on disk.
5. **`docs/pipeline/sweep-rotation.json`** committed — 04 advances it and may not commit it.
6. **`docs/pr-prompts/pr-deps-s1-fasturi-browserslist-overrides-HOLD.md` DELETED** — spent: armed
   21:33:19Z, consumed by the watcher, shipped as open PR **#1680**. Retiring it from `main` is the
   cure for "an armed prompt whose PR does not delete it stays armable forever", applied to this
   instance rather than described again.
7. **Three station breadcrumbs swept in** — 00's 22:09Z, 04's 22:10Z, 03's 23:01Z, all previously
   untracked and therefore unreported.
8. **`docs/pr-prompts/pr-watcher-verdict-home-resolver-HOLD.md` STAGED** (not armed) —
   `lint-prompt.mjs` → **ADMIT (size 4)**.

**Edit safety.** Every DOCTRINE edit was made in **node** by concatenation, never
`String.replace` with a replacement string (§9.3's `$`-in-replacement trap, which once injected
7,734 bytes into a file while all three read-backs passed). The **byte delta was asserted**:
`before=88865 after=93204 delta=4339 expected=4339 MATCH=true`, plus a read-back that the old cure
string is now **0** and each new block is exactly **1**.

**Outside the PR, on disk, and non-destructive:**

9. **`C:\po-vg`'s only untracked file was PRESERVED** before anyone can prune it:
   `check-pipeline-heartbeat.mjs` copied to
   `C:\po-sup-fix-scripts\PRESERVED-po-vg-check-pipeline-heartbeat-2026-09-05.mjs`, 6,144 B, verified
   byte-identical (`git hash-object` **`9c4587fb`** on both source and copy) and confirmed **different
   from `origin/main`'s copy** (`84ec92d4`). That was the half of Station 03's F3 that made a prune
   irreversible. It is no longer irreversible.

## FINDINGS

### A — [S1] The fix for an OPEN escalation has been sitting unpushed on one machine for 39 hours — ESCALATED

Station 03's F3 reports `C:\po-vg` as an orphaned worktree holding one untracked file. That is true
and it is the smaller half. **[MEASURED]** this run:

```
git log --oneline -1 fix/no-rebase-while-checks-run
  23c91ba9 fix(pr-watcher): never rebase a PR whose checks are still running
git diff --stat origin/main...fix/no-rebase-while-checks-run
  scripts/pr-watcher/__tests__/update-branch-guard.test.mjs   | 88 +++++++++
  scripts/pr-watcher/index.mjs                                | 46 ++++-
  2 files changed, 133 insertions(+), 1 deletion(-)
git ls-remote --heads origin fix/no-rebase-while-checks-run   -> EMPTY   (never pushed)
  POSITIVE CONTROL  refs/heads/main -> 02cd539f
git merge-base --is-ancestor 23c91ba9 origin/main             -> exit 1  (not merged)
  POSITIVE CONTROL  84cae7df                                  -> exit 0
```

**That commit is the fix for a live, open finding.** The project record carries
`PR_WATCHER_AUTO_UPDATE` as unfixed and dispatched to Station 03: `pollForBehindPrs()` rebases every
BEHIND PR on a timer, so PR heads move under a station mid-operation and in-flight CI is cancelled —
measured three times on 2026-09-03, and visible again in `watcher-launch.log` at 22:11:3xZ tonight
on #1675, #1667 and #1662. A commit titled *"never rebase a PR whose checks are still running"*,
**with an 88-line guard test**, is that fix — written, tested, and never pushed.

Two runs have now looked straight at this worktree and reported only the untracked file. The
worktree framing is what hid it: `status-sweep.ps1` classifies `C:/po-vg` as an *"aborted run
leftover — investigate/prune"*, and the natural next question is "what would pruning destroy?",
not "what is on the branch?". **The prune-risk question and the what-was-built question have
different answers, and only the first one was being asked.**

**What I did about it:** the destroy-risk is discharged — the untracked file is preserved byte-exact
(WHAT CHANGED item 9), so nothing unique dies with the worktree now. What remains is a decision, and
it is Marco's, because it is 133 lines of `scripts/pr-watcher/**` I did not author, cannot smoke
safely tonight, and which would route to him under §10.1 the moment it became a PR.

**RULE 1, options in order:**

1. **COMPLETE AND ADDITIVE — push the branch and open the PR with no auto-merge.** The work becomes
   durable, reviewable and CI-tested; the open `PR_WATCHER_AUTO_UPDATE` escalation gets a candidate
   fix attached to it instead of a note; nothing existing changes because the PR cannot merge without
   Marco. Passes both halves — it damages no data and it closes the future case as well as today's.
2. **Push the branch only, no PR.** Rescues the bytes, and stops there. Fails the "completely" half:
   an unreviewed branch on the remote is exactly as invisible to the escalation as an unpushed one.
3. **Leave it and prune the worktree.** Fails the "future" half: the guard test and the fix are lost
   to everyone but this machine's reflog, and the churn keeps cancelling CI.

**ESCALATED** → `docs/pr-prompts/needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`.
I have not pushed the branch: creating a remote ref for code I neither wrote nor reviewed, in a
station whose recorded lane is `docs/`, is the kind of act that should carry a name. It needs one
sentence from Marco, and option 1 is ready to execute the moment he gives it.

### B — [S1] Twelve review verdicts were produced and thrown away on 2026-09-05, and the log filed every one of them as `[ok]` — ACTIONED (documented) + DISPATCHED (staged)

Station 03's F1, Station 04's F1 and my 22:09Z predecessor's archive measurement are three
independent sightings of one defect, and together they name its cause. `verdict mirror skipped`
appears **68** times in `watcher-launch.log` (POSITIVE control `verdict mirrored to PR` → **262**),
**twelve of them on 2026-09-05**, and every one was then filed `[ok] -> processed/`.

- **(a) WRONG TREE, nine of twelve.** The review job writes into the dev tree; the mirror step and
  `verdictApproves` read `path.join(REPO_ROOT, ...)`, i.e. the clone. `pr-1682-review.md`, 2,475 B,
  mtime 22:37:16Z — **16 seconds before** the mirror declared it missing.
- **(b) THE ARCHIVE SWEEP RACES THE MIRROR, one of twelve.** `#1679` archived 21:22:23.331Z, mirror
  missed it 21:22:39.711Z. Positive control `#1681`: same two steps, opposite order, verdict landed.
- **(c) NOWHERE, two of twelve** (`pr-1652`, `pr-1672`) — `[CANNOT MEASURE]` which cause.

**Why it is S1:** `verdictApproves` is the function the `tests-docs` auto-merge gate consults. A
verdict in the wrong home cannot release the lane, so the PR times out into
`{"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"}` — which RULE
2 then correctly forbids any station from clearing. **This is a NEW measured cause for the second
conjunct of §10.3**, distinct from the queue-latency cause already on file: `#1682`'s review job
started 33 s after enqueue and finished in 4.5 min. No starvation. Wrong tree.

**ACTIONED** — DOCTRINE §9.5 now carries the correction and the cause (WHAT CHANGED 1). **DISPATCHED**
— `pr-watcher-verdict-home-resolver-HOLD.md` staged, ADMIT, implementing 03's RULE 1 option 1: one
pure resolver searching all three homes, clone first (so a file where it has always been behaves
exactly as today), newest wins, and a miss that names all three paths instead of being filed `[ok]`.
**Not armed** — arming is a separate decision and this touches the watcher's own merge gate.

### C — [S2] `check-breadcrumb.mjs` REJECTs a breadcrumb that is merely being WRITTEN, and 00's COLLECT is the one caller guaranteed to hit it — DEFERRED

Measured above: Station 03's file read REJECT at 23:11:44Z (6,679 B) and ADMIT at 23:13:27Z
(22,853 B). The instrument is not wrong — at 23:11:44Z four sections genuinely were absent. It is
**answering a question nobody asked**: "is this file, as it exists this millisecond, a valid
breadcrumb", when the caller means "did that station file a valid report".

**The collision is structural, not bad luck.** 00's cron is `5 * * * *` and 03/04/05 all write
breadcrumbs into the same directory on their own crons; 00's COLLECT is told to *start* with
`check-breadcrumb.mjs`, so it reads the queue root at the exact moment another station may be
writing into it. Tonight 00 (`:08`) and 03 (`:01`) overlapped by eleven minutes.

The consequence is a false accusation against a healthy station, and §7 records what false alarms
buy: they licence action. This run came one paragraph from filing "Station 03 shipped a malformed
report".

🔧 **The cure is one line and it is a discriminator, not a retry:** before reporting a breadcrumb
malformed, compare its `LastWriteTimeUtc` to now — a file written within the last few minutes, by a
station whose own declared run window has not closed, is **mid-write**, and the honest verdict is
`INCOMPLETE (still being written)`, not `REJECT`.

**DEFERRED**, not actioned, and the reason is a rule rather than a budget: `check-breadcrumb.mjs`
lives under `scripts/`, which is outside Station 00's recorded lane to merge — the same constraint
that parks the one-character `'00': 1` CADENCE fix. Folding a `scripts/` change into a docs-only
board PR would also cost this PR its `tests-docs` classification. It becomes urgent the moment a run
reports another station as malformed on this evidence; until then the discriminator above is enough
for a reader who knows it.

### D — [S2] Five open PRs, all Marco's, and the newest is RED on an ambiguous locator in somebody else's test — DEFERRED

The board's shape is unchanged from the last four runs: every open PR is human-gated, so 00 can arm
work, the watcher can build it, CI can green it, and nothing merges. That is the documented
throughput constraint, not a stall, and it is already open with Marco.

What is new is **#1682**, opened by the second lane at 22:30:39Z and untouched since. Its single red
is diagnosed above from the job log: `#1682` renders "Concrete cutting" a second time and four
pre-existing `pr-acceptance/batch3-scope-*` cases assert on an unscoped
`getByText("Concrete cutting")`, so Playwright strict mode fails on **ambiguity, not absence**.

**Why I did not push the fix.** The correct repair is to scope the existing locator to the element
the test means — and *which* element it means is a judgement about what those four assertions are
for. The wrong repair is `.first()`, which is a mask, and §8.2 forbids masks even as unblocks. More
decisively, `#1682` is 45 minutes old, belongs to an actively-working second lane, and its own
review job already returned MERGE at 22:37:16Z on a reading of the PR as "CI-green" — that verdict
predates the failing check. Pushing to a live lane's branch to fix a test I would have to reinterpret
is condition 3 of BOARD DRIVING (single actor) being reasoned past, which is LL-38.

**DEFERRED.** Re-open condition: `#1682` still red at the next run with no new commits on its head —
at which point the lane has plainly stopped and the locator fix is unambiguously 00's to make. The
diagnosis above is recorded precisely so that run does not have to pay 13 minutes of CI to re-derive
it.

### E — Station 04's 22:10Z and 03's 23:01Z breadcrumbs, dispositioned in full

**04 (Scanner), 22:10Z:**

- **F1** — §9.5's `docs/pr-reviews/` bullet points the wrong way. **ACTIONED**, and merged with 03's
  F2 and my predecessor's archive measurement into one correction (WHAT CHANGED 1, FINDING B). 04's
  scope estimate ("all seven station docs") is **corrected to one file plus a hash line**, measured.
- **F2** — `Measure-Object -Line` drops blank lines. **ACTIONED**, new §9.3 bullet (WHAT CHANGED 2).
- **F3** — the `.arming-log.txt` gap re-opened. **ACTIONED**, committed (WHAT CHANGED 4).
- **`sweep-rotation.json` left dirty.** **ACTIONED**, committed (WHAT CHANGED 5).
- **F4** — watcher-clone stash = 66. **DISPATCHED → Station 03**, which owns the clone and has a live
  daily cron. 03 re-measured it the same night (F4, 66, newest 2026-09-03) and DEFERRED it with the
  right instrument: report the count *and its growth*, never the absolute number.
- **F5** — negative-needle contamination growing. **DEFERRED** as 04 filed it. Complied: this run
  minted two fresh needles and used neither burned one.

**03 (Machine Minder), 23:01Z:**

- **F1** — twelve verdicts discarded. **ACTIONED + DISPATCHED**, see FINDING B.
- **F2** — DOCTRINE §9.5 needs the correction. **ACTIONED**, same edit.
- **F3** — `C:\po-vg`. **Half ACTIONED** (the untracked file is preserved byte-exact, so the prune is
  no longer irreversible), **half ESCALATED** and substantially enlarged — see FINDING A, which is
  about what is *on the branch*, not what pruning would destroy.
- **F4** — stash 66. **DEFERRED**, as filed. Nothing has stashed in 2.6 days, consistent with no
  relaunch since 2026-09-04T09:37Z rather than with the loop being fixed.
- **F5** — the stray `C:<U+F03A>temppr-1648.diff` (8,260 B) in the clone root. **DEFERRED.** Deleting
  it is a write in the watcher clone, which this station's own doc forbids outside a rescue, and the
  file blocks nothing — it only degrades the clone-hygiene signal. The half that matters is 03's
  second ask, finding the producer, and that is a `scripts/` grep better carried by 04's next
  instrument sweep than by a docs board PR. Urgent if a second such file appears, which would mean
  the path-building bug is still firing.
- **F6** — heartbeat, nothing to triage. **ACTIONED**, independently confirmed by this run's sweep.

**00 (my 22:09Z predecessor), blind:** its FINDING A carried one item to the next sighted run —
append the four-line "review verdict postdates its own merge" timing block to the open `#1635`
escalation. **ACTIONED**, appended to
`docs/pr-prompts/needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md`.
Its FINDINGS B, C and E are re-measured and unchanged; none is re-raised.

## WHAT I DID NOT DO

- **Merged nothing.** All five open PRs are Marco's — two by watcher `marco:true` verdict, three
  hand-classified under §10.1 step 2. No label was added or removed; `do-not-merge` is Marco's alone.
- **Armed nothing.** `armed (*-ready.md)` = **0** at the start and **0** at the end, and I checked
  `.arming-log.txt` as well, because an armed-count snapshot is not an arm census — that is precisely
  how the 21:08Z run missed the 21:33:19Z arm at both ends of its own window. The prompt staged this
  run is a `-HOLD.md`; **arming it is a separate decision and it touches the watcher's own merge
  gate**, so it should be asked, not assumed.
- **Did not push `fix/no-rebase-while-checks-run`, and did not prune `C:\po-vg`.** FINDING A explains
  why the first needs a name on it, and 03's F3 is explicit that the second is irreversible.
- **Did not push to #1682's branch.** FINDING D — a live second lane owns it, and the correct locator
  fix requires reinterpreting four assertions I did not write.
- **Did not fix `check-breadcrumb.mjs`'s mid-write REJECT or the `'00': 2` CADENCE row.** Both are
  `scripts/` one-liners outside 00's merge lane, and folding either into this PR would cost it its
  `tests-docs` classification.
- **Did not archive the two fully-dispositioned breadcrumbs** (20:08Z, 21:08Z) into
  `docs/pr-prompts/archive/`. The queue root holds five, not the 159 the archiving rule was written
  for, and every extra `git mv` in a PR that carries a canonical-block re-record is scope I would
  rather not spend here.
- **Ran no `git` through the device bridge**, touched no `/sot/`, no Azure, Entra or SharePoint, no
  production data, and killed no process. Nothing was run in `C:\po-watcher\ProjectOperations`
  except read-only `git`/`gh`.
- **Did not re-raise** the `escalates: true` gate, `PR_WATCHER_AUTO_UPDATE` itself, the review-job
  starvation item, the 03 cadence disagreement, `STOP-WATCHER-LANE2`, or the blind-run transport
  finding. All are live with Marco or with 03, and re-filing an open escalation splits one question
  across two documents.
