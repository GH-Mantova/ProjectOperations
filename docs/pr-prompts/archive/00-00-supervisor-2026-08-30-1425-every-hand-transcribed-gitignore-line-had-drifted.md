# Station 00 — Supervisor | 2026-08-30T14:25:00Z–2026-08-30T14:5xZ

**Second breadcrumb of the 14:08Z run.** The first
(`00-00-supervisor-2026-08-30-1408-the-board-was-73-percent-old-breadcrumbs.md`, merged in #1404)
reported the collect channel as empty, and it was — at 14:08Z. **Station 04 then ran at 14:09:54Z,
77 seconds after my measurement**, and filed a four-finding breadcrumb while #1404 was still in CI.
This is the collect record for it. Two breadcrumbs from one station in one window is deliberate: the
alternative was to leave four dispatched findings sitting until 16:09Z.

## GROUND

```
UTC            2026-08-30T14:25:00Z
origin/main    757450b6              (#1404, merged 14:17:29Z; git fetch then rev-parse)
dev tree       main @ 757450b6       C:\ProjectOperations2   (fast-forwarded this run, 0 ahead / 0 behind)
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (scheduled-task SKILL.md station_doc_version)
```

SIGHTED run, same shell (PID 14468). Work done in a second disposable worktree
`C:\po-worktrees\sup-1425` off `origin/main` — never the dev tree, never the watcher clone.

## WHAT I MEASURED

**#1404 landed and the archive is safe on `main`, not just in a worktree.** `gh pr view 1404` →
`state=MERGED`, `mergedAt=2026-08-30T14:17:29Z`, `mergeCommit=757450b6c060c779d91910b6d22809edc4231bf4`.
Dev tree fast-forwarded to the same SHA, `0	0`. Then, **on the merged tree**,
`check-breadcrumb.mjs --freshness` → **CLEAN exit 0**, and it still finds `03` (15.2h) and `05`
(24.1h) whose newest breadcrumbs are now inside `archive/`. That is the read-back the safety claim
needed. [MEASURED]

**04's off-by-one finding reproduces, independently, at every point it names.** I did not take it on
trust: `.gitignore` read from `origin/main` as a raw Buffer via node (never a PS `>` redirect —
DOCTRINE §9.3), **4940 bytes, 136 lines**, printed with 1-based numbering. [MEASURED]

| Cited in the docs as | TRUTH on `origin/main` | |
|---|---|---|
| `:75` = `docs/pr-prompts/*-ready.md` | line 75 IS exactly that | **OK — leave it** |
| `:76` = a file inside `processed/` | line 76 IS `docs/pr-prompts/processed/` | **OK — leave it** |
| `:75-82` = the watcher sink folders | folders run **76-83** | **+1** |
| `:106-110` = the five `docs/qa/` sink files | files run **107-111**; 106 is a comment | **+1** |
| `:107` = `docs/qa/qa-findings.md` | 107 is `qa-checklist.md`; findings is **108** | **+1** |
| `:106` = `qa-checklist.md` | 106 is a comment; checklist is **107** | **+1** |
| `:105` = the "Master Plan stays committable" comment | that comment is on **106** | **+1** |
| `:126-127` = `relationship-map.{json,md}` | they are on **127-128** | **+1** |

**The sink range is the one that is more than cosmetic.** `.gitignore:83` is
`docs/pr-prompts/no-pr-opened/` — a real gitignored sink that the canonical block's `75-82`
enumeration omitted entirely. A station listing "the gitignored sinks" from that sentence was
missing one, and `no-pr-opened/` currently holds **107** files. [MEASURED]

**One more the sweep did not reach: `PROMPT-SCHEMA.md:540` cites `.gitignore:73` for
`docs/pr-prompts/*-ready.md`. That is off by TWO, not one.** 04's scan was scoped to the pipeline
documentation set; `docs/pr-prompts/PROMPT-SCHEMA.md` sits outside it. Found by re-running the
citation census repo-wide rather than only over the files 04 named. [MEASURED]

**Why exactly three citations survived, which is the transferable lesson.** The three correct ones
(`:75` ×2, `:76` ×1) are precisely the ones DOCTRINE §9.2 obtained by **running
`git check-ignore -v`** and quoting its output. Every citation entered by hand drifted by one when a
line was inserted somewhere between 76 and 105, and nothing above the insertion was re-checked.
[INFERRED — from which citations are right, not from the commit that inserted the line]

**Canonical-block integrity held across the edit.** `lint-station.mjs` → `x canonical block
station-contract has been EDITED (sha b2d50ecee93e1f43, expected 192677cc8d5680a6)`,
**`REJECT: 6 of 7`**, exit 1 → `--write-canonical` → `ADMIT: all 7 docs clean`, exit 0. All six
station docs reported the **same** new sha, which is the proof the block is still byte-identical
across them rather than six separately-edited copies. [MEASURED]

**04's own worktree was visible while I worked.** `git worktree list` showed
`C:/po-worktrees/sot-1411` at `4461c8be`, detached — not mine. Different lane (`/sot/`), and
`status-sweep.ps1` read `in-progress prompts: 0` and `SAFE TO ACT`. No collision: my merge went
through and the dev index was empty before and after. Recorded because "another actor is on the
box" is exactly what LL-38 says to check for and say out loud. [MEASURED]

## WHAT CHANGED

**PR #1406.** All docs; no code, no `sot/`, no migration, no data.

- **The three canonical-block citations**, in all six station docs at once: `:106-110` → **`:107-111`**,
  `:107` → **`:108`**, `:75-82` → **`:76-83`**, and `no-pr-opened` **added** to the sink enumeration.
  Then `--write-canonical`; `station-contract v1` hash `192677cc8d5680a6` → `b2d50ecee93e1f43`.
- **The non-canonical strays**: `00-supervisor.md:390`, `04-scanner.md:185` and `:187`,
  `05-sot-keeper.md:227`, `STATION-CAPABILITIES.md:193`, and `PROMPT-SCHEMA.md:540`.
- **`STATION-CAPABILITIES.md` §3 no longer restates the DOCTRINE §9.1 shell traps** (F3 below); it
  points at §9.1 and records why the paraphrase is banned.
- **`pr-station-docs-wrong-wrapper-and-false-gitignore-claim-HOLD.md` corrected at `:75`, `:82`,
  `:90`, `:94`** — as authored it instructed its future agent to write two of these wrong citations
  *into* the canonical block, so fixing the docs without fixing the prompt would have re-installed
  the bug on the prompt's next run.
- **Swept up from the dev tree**: 04's 14:09Z breadcrumb (25894 B, `Buffer.compare` = 0 against the
  source) and `docs/pipeline/sweep-rotation.json`, which 04 advanced but cannot commit.
- **This breadcrumb.**

`docs/pipeline/DOCTRINE.md` was NOT edited here. Its only `.gitignore` citation is `:76`, which is
correct.

## FINDINGS

### F1 (from 04's F2) — 27 of 30 `.gitignore:NNN` citations were off by exactly one, and the wrong range hid a real sink

Re-measured from `origin/main` before acting, and it reproduces at every point. The canonical block
made it un-patchable one file at a time, which is why it survived: it is byte-identical across six
docs and hash-gated, so a single-file fix fails the linter and a reader who tried once would have
backed off.

**DISPOSITION: ACTIONED** in #1406, plus the `.gitignore:73` stray 04's scope did not cover.
Verified by the `REJECT: 6 of 7` → `ADMIT: all 7` pair and by a repo-wide re-grep showing no
remaining wrong citation in any governing doc.

### F2 (from 04's F3) — the file a station reads LAST understated the more dangerous failure mode

`STATION-CAPABILITIES.md` §3 said `$` is **stripped** from a `-Command` string; DOCTRINE §9.1
measured it **expanded**. Stripping dies loudly; expansion can hand you a valid command carrying a
value you never wrote and exit 0. 04 hit it in its own first tool call. The same section also
asserted the `#`-heading pause that §9.1 records as not reproduced.

**DISPOSITION: ACTIONED** in #1406 — and fixed by **deletion of the paraphrase**, not by correcting
it. §9.1 is inside a hash-gated canonical block and cannot drift; a restatement of it in a second
binding file can, and did. A corrected paraphrase would drift again.

### F3 (from 04's F1) — the bootstraps still carry a REFUTED blindness rule, and four runs have now paid to re-measure that

Every one of the five `SKILL.md` bootstraps still says at L25 that a station appearing in the
scheduled-task listing "is cloud-fired and structurally cannot reach the box." `origin/main` records
that as REFUTED in both directions (`STATION-CAPABILITIES.md:58`, and the canonical preflight in all
six station docs). 04 disproved it again from its own run, as I did from mine — this run appears in
the listing and reached the box on the first call.

`C:\po-sup-fix-scripts\fix-station-bootstraps.mjs` exists, its five anchors still match at
`4461c8be`, and its dry run is clean. **Nothing technical is in the way.** What is in the way is
authority: `STATION-CAPABILITIES.md` §1 assigns that layer to *"Marco, by pasting"* and tells an
agent to *"prefer the repo doc — it is the only layer an agent can change — then report the drift."*
The repo layer is already correct. So the fix that remains is, by the matrix's own words, not mine.

**DISPOSITION: ESCALATED — and this is the last time a station re-measures it.** 04 is right that
four runs paying for the same measurement is the DOCTRINE §6 loop. **Stations: stop re-measuring
this. The measurement is complete and recorded here.** Marco, one question, RULE 1 applied:

- **(A) — complete and additive.** Grant Station 00 standing authority to run
  `fix-station-bootstraps.mjs` when, and only when, the repo station doc and the bootstrap disagree
  and the repo doc is the corrected side. Solves it now and every future time the two layers drift;
  damages no data — the bootstraps are instruction text, the script is anchor-matched, the current
  byte counts are recorded (5340 / 5337 / 5315 / 5276 / 5251) so a revert is exact. **Passes both
  halves of RULE 1.**
- **(B) — one-shot.** Approve this single run, and the next drift escalates again. Passes
  "immediately", **fails "future"** — this is the fourth run to raise it.
- **(C) — status quo.** You paste the five files yourself. Passes neither half: it leaves the
  governing layer stale until you have time, and it is what has already produced 28 h of a refuted
  rule governing STEP 1 of every scheduled run.

Say (A), (B) or (C) in chat and it is done in the next run.

### F4 (from 04's F4) — the sweep rotation only turns if another station happens to sweep it up

04 must advance `sweep-rotation.json` but may not open a PR, so the file sits dirty in the dev tree
waiting for 00. That dependency has never been declared anywhere.

**DISPOSITION: ACTIONED for this cycle, DEFERRED as a design issue.** The file is committed in
#1406, so the rotation turns. 04's own urgency trigger stands and is the right one: if
`next-sweep.mjs` reports `instruction-drift` **again** at 18:10Z, the advance is not being carried
and it stops being S4.

### F5 — Station 05 was not silent after all, and it did the work I dispatched

My 14:08Z breadcrumb read `05` at 24.0h/24 and DEFERRED its outstanding `sot-ref-allow` burn-down
with a trigger for the next run. **That deferral is discharged already.** While I was building this
PR, `git worktree list` showed `C:/po-worktrees/sot-1411` — Station 05, mid-run — and it has since
opened **#1405, "the sot-refs burn-down floor of 8 was not a floor - 23 baselined -> 13"**. That is
precisely the work re-dispatched to it at 06:3xZ, and it went further than the dispatch asked:
the dispatch scoped 10 of 23 entries, 05 cleared 10 and challenged the premise that the remaining 8
were structurally un-clearable. [MEASURED — `gh pr view 1405`, state OPEN, no labels]

**DISPOSITION: ACTIONED.** The F4 deferral in my 14:08Z breadcrumb is closed; do not re-raise it.
The floor claim itself — "8 is a hard floor, deleting one blocks CI on every PR" — is a standing
belief in 00's memory that #1405 contradicts, and **CI on #1405 is the instrument that settles it,
not either of us.** I drive it green and merge it on that basis, or I do not merge it at all.

### F6 — the collect window and the cadence window are not the same window

My 14:08Z run measured an empty collect channel truthfully, and 04 filed 77 seconds later. Anything
04 writes between 00's measurement and 00's next run at 16:09Z would have sat for two hours — and on
a day when 00 goes blind, longer. Nothing was lost here only because #1404's CI kept me on the box
long enough to see the file appear.

**DISPOSITION: DEFERRED.** Not worth a mechanism yet: 00 runs every 2 h, 04 every 4 h, and a
2-hour-old finding has cost nothing measurable. **What would make it urgent:** a finding that had to
be actioned inside one cycle arriving in that gap, or 00 going blind for two consecutive runs while
04 stays sighted — the alternation measured this week makes that plausible rather than theoretical.

### F7 — the sot-refs ratchet fired hardest on the work it exists to encourage

I went to merge 05's #1405 and found it RED on `Pipeline — watcher + linter tests`. Read the job
log rather than the diff (DOCTRINE §3): the failing step is `sot-refs ratchet — baseline may only
shrink`, and it was

```
git diff "origin/$base" -- docs/qa/sot-refs-baseline.json | grep '^+.*"missing_path"'
```

**A diff cannot see a reorder.** #1405 took the baseline **23 → 13** and was rejected for ONE added
line that is byte-identical to a removed line in the same diff — `sot/06-active-specs.md:3943`,
`recorded: 2026-08-28`, i.e. two days older than the PR — re-emitted at a different array position
because eleven entries above it were deleted. [MEASURED — `git fetch origin refs/pull/1405/head`,
then `git diff origin/main pr1405 -- docs/qa/sot-refs-baseline.json`]

**This was structural, not bad luck, and that is the real finding.** Burning a baselined entry down
REQUIRES editing `sot/`; editing `sot/` shifts the line numbers of every dangling ref below the
edit, which rewrites those entries. The gate was therefore guaranteed to obstruct its own purpose —
and the burn-down it blocked is the one **I dispatched to 05 eight hours earlier.** It also explains
the standing belief in 00's memory that "the floor is 8, not 0": the floor was never structural, it
was this gate refusing every attempt to go below it.

**DISPOSITION: ACTIONED** in **#1407**, as its own PR because CP-24 forbids mixing code and `sot/`
and that is precisely why the fix could not ride along in #1405.
`scripts/pipeline/check-sot-baseline-ratchet.mjs` compares SETS: it fails if HEAD holds a
`(sot_file, missing_path)` pair absent from BASE, **or** if HEAD's entry count exceeds BASE's. The
line number is excluded from the key on purpose; the count condition is what still catches a real
new entry sharing a pair with an old one. It exits **2**, never 0, when it cannot read a baseline.
Proved in BOTH directions before shipping: `origin/main → #1405` exits 0 (`23 -> 13, no new pair`),
and the same comparison **reversed** exits 1, naming `sot/README.md:190` and `COUNT 13 -> 23`.
Four-case positive control runs on every invocation.

## WHAT I DID NOT DO

- **Did not run `fix-station-bootstraps.mjs`** (F3). The authority question is open and the matrix
  assigns that layer to Marco. I escalated with options instead of guessing his intent.
- **Did not rewrite the citation in `scripts/pipeline/__tests__/check-breadcrumb.gitignored-sink.test.mjs:60`.**
  It is a synthetic fixture string inside a test, not a claim any station reads as truth, and editing
  it would have made a docs PR touch `scripts/`.
- **Did not rewrite `.gitignore` citations inside breadcrumbs** — in the queue root, in `archive/`,
  or in `superseded/` — or in `docs/data-model/sweeps/*`. Those are dated records of what was
  believed at the time. Correcting them would forge history and would bury the very drift signal 04
  used to find this.
- **Did not arm anything.** OAuth is 45.9 h dead (seventeenth reading this run); the block stands.
- **Did not touch 04's `sot-1411` worktree**, `/sot/` (05's lane), the watcher, Azure / Entra /
  SharePoint, or production data.
