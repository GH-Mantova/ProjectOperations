# Station 04 — Scanner | 2026-08-30T02:10Z–2026-08-30T02:2xZ

## GROUND

```
UTC            2026-08-30T02:11:11Z
origin/main    5e9f52be            (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ 5e9f52be     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task SKILL.md)
```

Versions agree — full authority, not read-only.

Sweep this run: **`gate-liveness`** (`node scripts/pipeline/next-sweep.mjs` → `rotation position 1
of 4; previous run 2026-08-29T22:11:25Z`). Rotation advanced at the end of this run;
`docs/pipeline/sweep-rotation.json` is modified and must be committed **with** this file.

## WHAT I MEASURED

**Reachability.** `start_process` shell `powershell.exe` → PID 37736, then PID 27816 for the ground
stamp. `MACHINE=LAPTOP-E6NHU4E4`. **Not blind.** `[MEASURED]`

🔬 **A free datapoint on the unexplained blindness, and it is a tight one.** Station 00's run this
cycle — `docs/pr-prompts/00-00-supervisor-2026-08-30-0209-blind-and-the-collector-itself-cannot-run-from-the-mount.md`,
GROUND `UTC 2026-08-30T02:09:54Z` — records **"Desktop Commander is absent"** and had no shell. My
own `start_process` succeeded at **02:11:11Z**. Same box, same day, **77 seconds apart**: one station
blind, the next sighted. That rules out any explanation that is a property of the machine, the hour,
or the Cowork session being down, and leaves it a per-run toolset lottery — which is what
`STATION-CAPABILITIES.md` §2 already says ("intermittent … its cause is not known"). Recorded, not
diagnosed; the cause question is open and is not mine to close. `[MEASURED]`

**Binaries resolve** (§9.5 — an ADMIT obtained without `git` silently waives every `origin/main:`
file gate, and `gh` is not the binary that does it): `git` = `C:\Program Files\Git\cmd\git.exe`,
`node` = `C:\Program Files\nodejs\node.exe`, `gh` = `C:\Program Files\GitHub CLI\gh.exe`. Control
pair on the exact probe the linter uses: `git cat-file -e origin/main:docs/pipeline/DOCTRINE.md`
→ exit **0**; the same command on a path that does not exist → exit **128**. The instrument answers
both ways. `[MEASURED]`

**Binding docs read from `origin/main`, not from the working copy** (station doc, PREFLIGHT step 2).
`git diff --stat origin/main -- docs/pipeline/` → **empty**, so the working copies of
`DOCTRINE.md`, `STATION-CAPABILITIES.md` and `stations/04-scanner.md` are byte-equal to `origin/main`
and reading them locally is sound. Per §9.3 this was decided with `git diff`, **not**
`Compare-Object`. `[MEASURED]`

**Sweep.** `scripts\pipeline\status-sweep.ps1` @02:12:05Z → section 0 both positive controls
`[LIVE]`, section 7 **`SAFE TO ACT`**. OPEN PRs **0**, armed **0**, needs-marco 14, no-pr-opened 107,
failed 41, watcher node RUNNING pid 26364 with 3 wrappers, main CI 3/3 green,
`watcher clone: dirty=35` (the standing `verdict-archive` amber, not news). `[MEASURED]`

**Board trap.** `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` → 551 paths, 224 at
depth 1, of which `*-ready.md` = **0** and `*-HOLD.md` = **61**. Positive control on the same query:
`pr-524-rates-b-slice2-canonical-HOLD.md` returned. The zero is a real zero, not a blind query
(§9.2 — `-r` present, control run). **Board trap CLEAN.** `[MEASURED]`

**Dev tree vs main, exactly.** 224 depth-1 `.md` on disk vs 224 tracked; 61 HOLDs both sides; 0
untracked HOLDs, 0 tracked-but-missing HOLDs. The 08-29T18:10Z finding *"dev tree carries 23 HOLDs
main retired"* is **discharged** — #1392 retired them and the two trees are now identical at depth 1.
`git diff --cached --name-status` → 0 lines, before and after. `[MEASURED]`

**The sweep proper.** Re-ran the *unchanged* harness from the 08-29T10:10Z run,
`C:\po-sup-fix-scripts\gate-liveness-04-2026-08-29-1010.mjs` (read-only; imports `runGate` /
`selfTest` from the repo's own `scripts/pipeline/gate-eval.mjs`; parses front matter without
collapsing block scalars). Same instrument, so the readings are comparable. All six controls as
expected before anything was believed: `[MEASURED]`

```
CONTROL gate-eval selfTest: PASS -- positive+negative controls both behaved
CONTROL fileOnMain(DOCTRINE.md)=true (expect true)
CONTROL fileOnMain(zz-nope.md)=false (expect false)
CONTROL needleOnMain(DOCTRINE::SHARED DOCTRINE)=true (expect true)
CONTROL needleOnMain(DOCTRINE::zzz...)=false (expect false)
CONTROL prState(1390)={"state":"MERGED",...} (expect MERGED)
SHA=5e9f52be23131e8faf3abc8e1bfcb0102602dc35
```

Across all **61** depth-1 `-HOLD.md` (armed = 0, so there were no `-ready.md` to evaluate):
**0 BROKEN**, 23 ungated, 27 gate-shut, 11 gate-open (23+27+11=61, checked). **1 premise DEAD**,
11 gate-open **and** premise-alive. Full output: `C:\po-sup-fix-scripts\gate-liveness-04-2026-08-30-0210-out.txt`.
`[MEASURED]`

**Dead-gate hunt (the repair half of this sweep).** Every `requires_merged` gate — 1111, 1257, 1317,
1348, 1350, 1351, 1361 — resolves **MERGED**; none names a CLOSED or UNREADABLE PR. Exactly one gate
cannot find its file, `pr-sor-s9b-register-ui-HOLD` on
`apps/api/src/modules/agreed-records/agreed-record-register.controller.ts :: eligible-for-claim`
(`SHUT:FILE-ABSENT`); it is **not dead** — its live predecessor `pr-sor-s9a-register-api-HOLD`
creates that controller. **ZERO dead gates**, the fourth consecutive run with that reading (08-27,
08-28, 08-29, now). `[MEASURED]`

**No masking.** The single dead premise sits behind **no gate at all**, so no gate repair could have
changed a premise reading this run. `[MEASURED]`

**Premise MORTALITY census (new angle this run).** Gate liveness asks *"is the premise alive?"*.
The complementary question — *"will it DIE when the fix lands?"* (LL-54) — is what decides whether a
prompt re-fires forever after merge, and no instrument in the pipeline asks it. Harness
`C:\po-sup-fix-scripts\s04-0210-mortality.mjs` (read-only), two controls passed. Result over 61:
**42 mortal · 14 premises that use `test -f` rather than `grep` (out of scope for this instrument) ·
5 flagged.** `[MEASURED]`

🔬 **My census instrument is CRUDE and I checked its hits by hand before believing any of them.**
Its shell parser does not understand pipes, so `ls … | grep -q X` is mis-read as pattern `-q`.
**Four of the five flags are parser artefacts**, confirmed mortal by reading the raw front matter:
`pr-fv2-formrule-contract`, `pr-rates-11b2-resolver-isactive-surface`,
`pr-tenant-mt4-s2-ownership-migration`, `pr-transport-capacity-column-order`. One survived — F2
below. A 4-in-5 false-positive rate is why this census is reported as a **lead-generator, not a
verdict**. `[MEASURED]`

**Targeted lint probes** (five prompts, not a board census — the 30/30/21 census stands and was not
re-run): `pr-doctrine-s9-gh-vs-git-waiver-HOLD` **ADMIT exit 0** · `pr-dns-s5-checker-flip-to-fail-HOLD`
**ADMIT exit 0** · `pr-hygiene-gitignore-no-pr-opened-HOLD` **STALE exit 3** ·
`pr-e2e-container-s2-swap-required-job-HOLD` **ADMIT exit 0** ·
`pr-station-docs-wrong-wrapper-and-false-gitignore-claim-HOLD` **ADMIT exit 0**. The exit-3 is the
positive control that the linter's staleness detector works at all on this corpus. `[MEASURED]`

## WHAT CHANGED

**Nothing on the board.** No file staged, armed, renamed, moved, edited or deleted; no `git` write;
no PR touched. `git diff --cached --name-status` → 0 lines, before and after (the dev-tree index is
shared; it was clean and I left it clean). Two artifacts written outside the queue — the mortality
harness and both harness outputs under `C:\po-sup-fix-scripts\` (scratch, untracked, outside the
repo) — plus this breadcrumb in the dev tree, and `docs/pipeline/sweep-rotation.json` advanced
1 → 2 per the station doc. `[MEASURED]`

## FINDINGS

### F1 — a prompt whose fix SHIPPED five commits ago still reads ADMIT, because the fix kept the phrase its premise greps for `[MEASURED]`

`docs/pr-prompts/pr-doctrine-s9-gh-vs-git-waiver-HOLD.md` exists to correct DOCTRINE §9.5, which
blamed a missing **`gh`** for the silent gate-waiver when the binary responsible is **`git`**. That
correction **landed in #1394** on 2026-08-29T16:32Z. `origin/main:docs/pipeline/DOCTRINE.md` now reads:

```
- 🔴 **`lint-prompt.mjs` does NOT reject when `git` is missing or broken — the binary is `git`, NOT
```

The work is done. The prompt is not:

```
premise:   grep -q "does NOT reject when" docs/pipeline/DOCTRINE.md          -> PASS (alive)
done_when: ! grep -q "does NOT reject when" docs/pipeline/DOCTRINE.md && …   -> can never be met
lint-prompt.mjs docs/pr-prompts/pr-doctrine-s9-gh-vs-git-waiver-HOLD.md      -> ADMIT, exit 0
```

The premise greps the **sentence shape** (`"does NOT reject when"`), not the **wrong claim**
(`gh`). The correct fix rewrote the claim and preserved the shape, so the premise cannot die and the
linter's staleness check — which is driven by the premise — cannot fire. Contrast the control in the
same batch: `pr-hygiene-gitignore-no-pr-opened-HOLD` returned **STALE exit 3** the moment its
premise inverted. The detector works; this premise is un-detectable by it.

**Two consequences, and the second is the dangerous one.** (i) Every liveness instrument — this
sweep's harness, `lint-prompt.mjs`, and therefore any next-arm list built from them — reports this
prompt as ready work. (ii) `done_when` is unsatisfiable by the *right* fix, so an agent that armed it
would be pushed toward deleting or mangling a now-correct line **inside the `instruments v2`
CANONICAL-BLOCK**, which `lint-station.mjs` hash-gates. The only thing currently standing between
this prompt and an arm is a line in a chat-memory file.

**This is now the SECOND prompt in that position.** DOCTRINE §9.5 already records that
`pr-dns-s5-checker-flip-to-fail-HOLD` must never be armed while carrying **neither** literal marker
and passing every mechanical gate — I re-measured it this run: **ADMIT, exit 0**. Two prompts,
mechanically indistinguishable from ready work, held back only by human recall.

**DISPOSITION: DISPATCHED → Station 00.** Two moves, both additive, neither able to fire anything (a
`-HOLD.md` matches no watcher glob at any point, so the standing OAuth "arm nothing" block is not
engaged). Commit **with a pathspec** — the dev-tree index is shared.

1. `git mv docs/pr-prompts/pr-doctrine-s9-gh-vs-git-waiver-HOLD.md docs/pr-prompts/superseded/` —
   its work is on main; retention, not deletion.
2. `git mv docs/pr-prompts/pr-hygiene-gitignore-no-pr-opened-HOLD.md docs/pr-prompts/superseded/` —
   see F3; the linter itself calls it STALE.
3. Add **one line** to the body of `docs/pr-prompts/pr-dns-s5-checker-flip-to-fail-HOLD.md`, verbatim,
   so the standing block is enforced by the linter instead of by memory:

   ```
   <!-- watcher: do-not-arm -->
   ```

   `lint-prompt.mjs:728` matches `DO_NOT_ARM_COMMENT` case-insensitively and hard-REJECTs with
   `HUMAN_GATE_PRESENT` at `:741`, **before the premise runs** (`:1099`). Read-back: after the edit,
   `node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-dns-s5-checker-flip-to-fail-HOLD.md`
   must print `HUMAN_GATE_PRESENT` and exit non-zero, where it printed `ADMIT` exit 0 today.

   I did **not** make this edit myself: the ADVERSARIAL PROMPT CRITIQUE section of my station doc
   forbids the scanner editing the prompt it is critiquing, and the mechanism is a prompt-body edit.

**Note on the mechanism, so 00 does not reach for the wrong one.** `queue-sync.ps1:79-84`'s
`$Forbidden` denylist is the wrong door here: it blocks **materialisation into the queue**
(`:93-96`), and both of these prompts are already tracked in the queue at depth 1. It would not stop
a `git mv` to `-ready.md`. The `lint-prompt` marker is the door that is actually on the arming path.

### F2 — `pr-e2e-container-s2-swap-required-job-HOLD` will still be "alive" after it merges `[MEASURED]`

```
premise:   grep -q "playwright install --with-deps" .github/workflows/playwright.yml
done_when: grep -q "^  tendering-e2e:" … && grep -q "playwright:v1.59.1-noble" … && grep -q "@postgres:5432" …
```

`done_when` asserts three things the change **adds** and nothing it **removes**. Measured against
`origin/main:.github/workflows/playwright.yml`: exactly **one** job, `tendering-e2e`, and exactly
**one** occurrence of the premise token, at **L123**
(`run: pnpm exec playwright install --with-deps chromium firefox webkit`). The prompt converts that
same job to run in `mcr.microsoft.com/playwright:v1.59.1-noble`, where the browsers are already in
the image — but if the implementing agent leaves L123 in place (harmless, slow, and the obvious
belt-and-braces choice), **every clause of `done_when` passes, the PR merges, and the premise stays
true forever.** The prompt then re-fires on every liveness sweep and is re-armable to redo shipped
work. This is exactly LL-54, and the station doc rates a premise that does not die on landing **S2 —
the prompt is broken as authored.**

Fix, one clause, additive: append to `done_when`
`&& ! grep -q "playwright install --with-deps" .github/workflows/playwright.yml`. That makes
`done_when` the exact inverse of `premise`, which is the property that lets the linter's staleness
check retire the prompt on its own after merge.

**DISPOSITION: DISPATCHED → Station 00.** One-line front-matter edit; not mine to make (same
adversarial-critique rule as F1). It is a **prerequisite of arming this prompt**, not a follow-up:
after merge the evidence needed to notice the defect is gone.

### F3 — the single dead premise on the board `[MEASURED]`

`pr-hygiene-gitignore-no-pr-opened-HOLD` — premise `! grep -q "no-pr-opened" .gitignore` → **FAIL**.
`git show origin/main:.gitignore` now carries `docs/pr-prompts/no-pr-opened/` (landed in #1395). The
linter agrees independently: **STALE, exit 3**. Honestly spent.

Worth recording as a *result*, not just a finding: 08-29T10:10Z measured **23 of 84** root HOLDs
spent and dispatched them; #1392 retired all 23; this run measures **1 of 61**. The dispatch that had
been filed three times without movement was actioned, and the board is now genuinely clean by this
metric. The F2 escalation from that run (*who may retire a spent HOLD*) is therefore **not re-raised
here** — the existing route worked.

**DISPOSITION: DISPATCHED → Station 00** (folded into F1's move list, item 2).

### F4 — the 11-item arm-candidate list is unchanged for the third consecutive sweep `[MEASURED]`

Gate-open **and** premise-alive, all `-HOLD.md`: `pr-crm-s3-account-on-client-create` ·
`pr-crm-wincount-s3-recompute` · `pr-dns-s5-checker-flip-to-fail` ·
`pr-e2e-container-s2-swap-required-job` · `pr-ew-s2c-alloc-rejection-path` ·
`pr-fv2-maintenance-usage-intervals` · `pr-pipeline-nodrift-agents-write-sweep-commits` ·
`pr-queue-armed-tracked-detector` · `pr-rates-11b2-resolver-isactive-surface` ·
`pr-rates-consumers-s3-persona-export` · `pr-unified-api-key-vault-slice4c-retire-old-screens`.

Byte-identical membership to 08-28T18:10Z and 08-29T10:10Z. **Expected, not a defect**: armed = 0
because the OAuth block correctly holds the agent lane. Recorded so the next run can tell a held
brake from a stalled one. 🔴 **Two of the eleven are not recommendations**:
`pr-dns-s5-checker-flip-to-fail` is on the standing must-not-arm list (F1), and
`pr-e2e-container-s2-swap-required-job` must not be armed until its `done_when` is repaired (F2).

**DISPOSITION: DEFERRED** — becomes actionable when the OAuth block clears. Arming is 00's on
Marco's authority, one at a time, and nothing here changes that.

### F5 — `pr-station-docs-wrong-wrapper-and-false-gitignore-claim-HOLD` is genuinely alive, and its defect is a doc that contradicts itself on main `[MEASURED]`

Re-verified both halves against `origin/main`, because #1396 (08-29T20:25Z) corrected the wrapper
name in **00-supervisor's ENSURE-UP probe** and it would be easy to assume 03 was fixed with it.
It was not:

```
git show origin/main:docs/pipeline/stations/03-machine-minder.md | grep watcher-launcher
  -> "The launcher is **watcher-launcher-singlelane.ps1**. Older instructions named a different file…"
  -> "the WRAPPER first, then the node, then relaunch DETACHED via C:\po-watcher\watcher-launcher.ps1"
git show origin/main:docs/pipeline/stations/04-scanner.md | grep "state files (all gitignored)"
  -> still present
```

One document, on main, telling 03 both that `watcher-launcher.ps1` is the wrong file **and** to
relaunch through it. Both files exist on disk, so a `Test-Path` guard passes on the wrong one and
nothing errors. The prompt is docs-only, size 2, ungated, **ADMIT exit 0**.

**DISPOSITION: DEFERRED.** It is a legitimate arm candidate the moment the OAuth block clears, and
it is not on my list to arm. Raised here only because it appears un-gated and un-armed on a board
whose other 60 HOLDs are either chained or Marco-gated, so it is the cheapest live item on it.

## WHAT I DID NOT DO

- **Moved, renamed, edited or deleted nothing.** 04 is READ-ONLY on the board. F1's three moves are
  00's to execute even though 04 is the station that proved them.
- **Armed nothing, staged no new prompt.** My lane permits one `-HOLD`. I judged it net-negative for
  the third run running: the queue holds 61 HOLDs that cannot execute while the OAuth block stands,
  and every fix I found this run is a one-line edit that lands sooner as a verbatim dispatch in a
  breadcrumb 00 reads every 2 h than as a 62nd prompt waiting to be armed. All three edits are given
  above as exact text so 00's PR is transcription, not re-diagnosis.
- **Did not edit the prompts I critiqued** (F1 item 3, F2) — the ADVERSARIAL PROMPT CRITIQUE section
  forbids the scanner rewriting a prompt's premise, scope or gate. That rule exists so the design
  review is not silently poisoned by its own reviewer.
- **Did not re-lint the board.** Five targeted probes with a working positive control (one STALE
  exit 3), not a census. The 30/30/21 census stands untouched.
- **Did not re-run the 23-spent-HOLD census.** It was actioned by #1392; F3 records the result.
- **Did not re-raise** the OAuth expiry, the watcher-clone fast-forward ownership, the stale
  `Scheduled\*\SKILL.md` bootstraps, `needs-marco/`'s 13 dead escalations, the CP-26 ruleset
  question, or 06's missing cadence. All are open, all are already filed, none changed this run.
- **Did not run `status-sweep.ps1` §3b ENSURE-UP** or any watcher repair — 03's lane.
- **Did not touch Azure / Entra / SharePoint, production data, `/sot/`, or any source file.**

---

**This breadcrumb is UNTRACKED until a board PR commits it.** Station 00: sweep it up.
`docs/pipeline/sweep-rotation.json` is modified and must be committed **with** it, or the next
Station 04 run repeats `gate-liveness` and the rotation silently stops.
