# Station 00 — Supervisor | 2026-08-28T16:08Z–2026-08-28T16:20Z

## GROUND

```
UTC            2026-08-28T16:08:56Z
origin/main    5e15d67c            (fetched with the explicit refspec, then rev-parse)
dev tree       main @ 82ba8538      C:\ProjectOperations2   (4 behind origin/main)
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE — this run was read-write. Desktop Commander reached the box (PowerShell pid 12072);
this was **not** a blind run.

## WHAT I MEASURED

- **[MEASURED] Ground.** `git fetch origin +refs/heads/main:refs/remotes/origin/main` then
  `git rev-parse --short origin/main` → `5e15d67c`; `HEAD` → `82ba8538`;
  `git rev-list --count HEAD..origin/main` → `4`. `gh` resolves to
  `C:\Program Files\GitHub CLI\gh.exe`, so DOCTRINE §9.5's "ADMIT without gh" caveat does not apply.

- **[MEASURED] Sweep.** `scripts/pipeline/status-sweep.ps1` at 16:09:26Z and 16:09:59Z.
  Section 0 positive controls both PASS (gh saw merged #1381; node runs). Verdict:
  `SAFE TO ACT: no board mutation in progress, no recent remote activity.`

- **[MEASURED] Board, 3 open PRs.**
  `gh pr list --state open --json number,title,mergeStateStatus`
  - `#1383` CLEAN — 8 pass / 0 fail. `docs(pipeline): name check-breadcrumb.mjs, correct docs/qa/ claim`
  - `#1382` CLEAN — 8 pass / 0 fail. `docs(stations): name check-breadcrumb validator, correct docs/qa/ tracking claim`
  - `#1377` UNSTABLE — 12 pass / 1 fail.
  Trunk green (last 3 main runs: 3 success).

- **[MEASURED] The two CLEAN PRs touch the SAME seven files.**
  `gh pr view <n> --json files` — both change all six `docs/pipeline/stations/0N-*.md` **and**
  `docs/pipeline/stations/_canonical-blocks.json`. #1382 is `+3 -4` per doc on branch
  `docs/station-contract-breadcrumb-validator`, created `14:41:03Z`. #1383 is `+16 -4` per doc on
  branch `feat/station-contract-breadcrumb-fix`, created `14:42:41Z`. **98 seconds apart.**
  Because both rewrite the canonical block and its recorded hash, they are mutually exclusive:
  whichever merges first makes the other DIRTY.

- **[MEASURED] #1377's single red is the diff-checks job, not a code fault.**
  `gh pr checks 1377` → the only `fail` is
  `PR gates - diff checks (CP-09-13, CP-17, CP-22, CP-23)`. That is the job carrying the CP-26
  **step** (CP-26 is a step inside that job, not a check run of its own). Consistent with the
  standing finding that #1377's only red *is* its `do-not-merge` label.

- **[MEASURED] RULE-2 probe on #1383 — it FIRES, and ownership is PROVEN.**
  `Select-String -Pattern '"marco":true' -SimpleMatch` against
  `docs/pr-prompts/processed/pr-station-contract-breadcrumb-validator-and-qa-claim-ready.md.log`:
  ```
  [watcher] merge result for PR #1383: {"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"}
  ```
  The known defect here is that the merge lane logs `{"marco":true}` for PRs it never opened, so
  existence is not ownership. **Ownership was checked separately and holds:** the same log contains
  #1383's PR body verbatim, and `gh pr view 1383 --json body` confirms that body is on #1383.
  This prompt owns #1383. RULE 2 binds.

- **[MEASURED] #1382 carries no routing record.**
  `Select-String -Path docs/pr-prompts/processed/*.log -Pattern 'PR #1382' -SimpleMatch` → no hits.
  Neither PR carries any label (`labels=` empty on both).

- **[MEASURED] The watcher restarted at ~14:32Z and startup-scanned the armed prompt.**
  `C:\po-watcher\watcher-launch.log`:
  ```
  [2026-08-28T14:32:56.678Z] [queue] pr-station-contract-...-ready.md (depth: 1, source: startup-scan)
  [2026-08-28T14:32:56.866Z] [start] pr-station-contract-...-ready.md (max-turns=240)
  ```
  `ensure-watcher.log` corroborates the pid change: `14:25:02Z pid 5444` → `14:35:03Z pid 26364`.

- **[MEASURED] The prompt was consumed MID-RUN, between my two measurements.**
  At 16:09Z `pr-station-contract-...-ready.md` was armed at depth 1. At ~16:13Z it was gone from
  disk and present in `processed/` (log mtime `16:13:25Z`). A `git mv` I issued against it failed
  `fatal: bad source` — which is how I learned it had moved. **Re-measured immediately: still 3 open
  PRs, so no third PR was opened.** This is the §7 "`[LIVE]` means true when measured" rule paying
  out inside a single run.

- **[MEASURED] Two leftover half-arms in the SHARED dev-tree index.**
  `git diff --cached --name-status` at 16:10Z:
  ```
  R100  docs/pr-prompts/pr-lint-armed-gate-inversion-HOLD.md  ->  ...-ready.md
  R100  docs/pr-prompts/pr-station-contract-breadcrumb-validator-and-qa-claim-HOLD.md  ->  ...-ready.md
  ```
  Both destinations were **absent from disk** (`git status` showed `RD`). Both prompts are
  **CONSUMED**: each has 2 entries in `docs/pr-prompts/processed/` and 0 in `no-pr-opened/` or
  `failed/`. Both `-HOLD.md` sources are still on `origin/main` (`git cat-file -e`).

- **[MEASURED] `check-breadcrumb.mjs` is CLEAN but its freshness pass reported a false UNTRACKED.**
  `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 0, `CLEAN`,
  `80 checked, 0 malformed, 7 skipped as pre-contract`. No station SILENT (00 2.1h/2h · 03 41.2h/24h
  · 04 2.0h/4h · 05 26.0h/24h). But it emitted:
  ```
  NOTE  00-04-scanner-2026-08-28-1010-...md is UNTRACKED - it reaches nobody until a board PR commits it
  NOTE  00-04-scanner-2026-08-28-1410-...md is UNTRACKED - it reaches nobody until a board PR commits it
  ```
  `git cat-file -e origin/main:docs/pr-prompts/<each>` → **ON-MAIN, both.** They landed in #1378/#1381.

- **[MEASURED] `sweep-rotation.json` / `metadata-catalog.json` are NOT uncommitted work.**
  `git status` shows both ` M`, and the sweep raised a `[FILE]` warning that the rotation must be
  committed or Station 04 repeats `instruction-drift`. `git diff --stat origin/main --` against both
  paths returns **empty** (only a CRLF advisory). They are byte-identical to `origin/main`; the ` M`
  is against `HEAD`, which is 4 commits behind. **The warning is a false alarm.**

- **[MEASURED] Machinery.** `scripts/restart-watcher-if-wedged.ps1` (report-only) at 16:15:03Z:
  `armed prompts waiting: 0 · watcher process: ALIVE (pid 26364) · restart churn: 0 cycle(s) in 20 min`
  → `VERDICT: OK - nothing armed and the watcher is alive.` Wrapper alive (3). Guard hook present.
  Watcher clone `branch=main dirty=35`; 4 orphaned worktrees — both unchanged from the prior run and
  already open with Station 03.

## WHAT CHANGED

Two index-only mutations. **No merge, no arm, no PR close, no push.**

1. `git restore --staged docs/pr-prompts/pr-lint-armed-gate-inversion-{HOLD,ready}.md` → exit 0.
2. `git restore --staged docs/pr-prompts/pr-station-contract-breadcrumb-validator-and-qa-claim-{HOLD,ready}.md` → exit 0.

**Read back:** `git diff --cached --name-status` → empty. Both `-HOLD.md` sources verified still on
`origin/main` by `git cat-file -e`. Armed at depth 1: **0**. Nothing was deleted — the consumed
`-ready.md` files remain in `processed/` and the tracked `-HOLD.md` files remain on `main`.

One failed mutation, recorded because it is evidence: `git mv ...-ready.md ...-HOLD.md` →
`fatal: bad source`, exit 128. The file had already been consumed by the watcher. Nothing changed.

## FINDINGS

### F1 — One prompt, two PRs, 98 seconds apart, over the same canonical block

`#1382` and `#1383` make the same two corrections (name `check-breadcrumb.mjs`; fix the "`docs/qa/`
is gitignored" claim) across the same seven files. They cannot both merge.

**[MEASURED]** the duplication, the file overlap, the 98-second gap, and the ~14:32Z watcher restart
whose `startup-scan` re-queued the armed prompt.
**[INFERRED]** the cause, and I will not overstate it — there are two candidate mechanisms and I did
not separate them. Either (a) the restart's `startup-scan` re-queued a prompt whose run was already
in flight, or (b) a parallel out-of-lane Station-06 run authored the second. #1383's own PR body
asserts (b) — it says #1382 was "opened by a parallel Station-06 run". That is the prompt's claim
about itself, not an independent measurement, and Station 06 has no schedule, so (b) is plausible but
unproven. Station 04 had already reported this fix was **staged twice**, which fits (b).

Root-causing this needs the watcher's queue internals and the Station-06 lane, neither of which is
mine to touch.

**DISPATCHED** — to **03-machine-minder**: determine whether `startup-scan` can re-queue a prompt
that is already in flight or already has an open PR, and if so guard it. Hand-off evidence: the two
`watcher-launch.log` lines quoted above, the pid change 5444→26364 in `ensure-watcher.log`, and the
two PR head branches (`docs/station-contract-breadcrumb-validator`, `feat/station-contract-breadcrumb-fix`).

### F2 — #1383 is watcher-routed to Marco. I did not merge it.

`{"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"}`, with
ownership proven by the body match. The routing reason is a *timeout*, and the PR is green and
unlabelled — none of which clears the gate. RULE 2 is not overridden by green, CLEAN, unlabelled, a
diff check, a MERGE verdict, or a routing reason that looks wrong. Only Marco clears it, in chat, for
that batch.

**ESCALATED** — see the question in F3; the two are one decision.

### F3 — The duplicate is Marco's pick, not mine, and it is a wording choice

The watcher already framed it that way in #1383's body: *"Duplicate — Marco to pick one … merge
whichever wording you prefer, close the other."* Choosing between two wordings of a governance
document is a design call reserved for Marco, and merging either one silently discards the other.

**RULE 1 applied — both options solve the issue completely; they differ in future cost, not coverage:**

- **Option A — merge #1383, close #1382 (complete + additive; recommended).** It cites the exact
  `.gitignore:106-110` lines, names `docs/qa/sot-refs-baseline.json` as the checked-in file that
  disproves "the folder is gitignored", keeps the document's ~100-col wrapping, and adds the
  instruction *not* to write `breadcrumb-clean` until `check-breadcrumb.mjs` has actually exited 0.
  Damages no existing or future data entry. Costs more words in the canonical block, which is
  byte-identical across six station docs.
- **Option B — merge #1382, close #1383.** Tighter (`+3 -4` per doc). Fails the *complete* half:
  it does not cite the `.gitignore` line numbers, does not name the counter-example file, and omits
  the "run the validator before claiming clean" instruction — which is the behaviour the whole fix
  exists to install. It also collapses the wrapped paragraph into a single very long line,
  inconsistent with the surrounding document.
- Neither fails the *no-damage* half.

One check worth recording, since the two PRs disagreed on it and I expected one to be wrong: #1382
names the CI job **"Pipeline - watcher + linter tests"**, #1383 names it **`pipeline-tests`**.
`.github/workflows/ci.yml:148-149` shows `pipeline-tests:` with `name: Pipeline - watcher + linter tests`.
**Both are correct** — job id vs display name. This is not a tiebreaker.

**ESCALATED** — Marco: pick A or B. Until then both stay open and nothing else touching the station
canonical block may be armed, because it would conflict with whichever you pick.

### F4 — Two consumed prompts sat in the shared index as staged `HOLD→ready` renames

`git diff --cached --name-status` carried two `R100` arming renames whose `-ready.md` destinations
did not exist on disk, for prompts that had already run and been filed to `processed/`. The dev
tree's index is shared between concurrent chats, so **any pathspec-less commit by any chat would
have landed two `-ready.md` files on `main`** — publishing consumed prompts as tracked and armed.
That is the resurrection failure the "never `reset --hard` / `checkout .`" rule exists to prevent,
arriving by a different door.

Triage followed the recorded rule (`processed` ≥ 2 ⇒ consumed ⇒ leave the ` D`, do not restore the
file): I unstaged the renames only. No file was written, deleted, or checked out.

**ACTIONED** — verified by `git diff --cached --name-status` returning empty, both `-HOLD.md` sources
confirmed present on `origin/main`, and armed-at-depth-1 = 0.

### F5 — `check-breadcrumb.mjs --freshness` calls files UNTRACKED that are on `origin/main`

It flagged the 04-scanner `1010` and `1410` breadcrumbs as `UNTRACKED - it reaches nobody until a
board PR commits it`. Both are on `origin/main` (#1378, #1381). The dev tree is 4 commits behind, so
a local-index resolution cannot see them. This is the same class of defect Station 05 measured in
`check-sot-refs.mjs`, which resolves with `existsSync` against the working tree and therefore reports
different numbers on the dev box and in CI **at the same SHA**.

The harm is directional and bad: it manufactures phantom "unreported finding" warnings, which is
exactly the alarm the breadcrumb contract exists to make meaningful. An alarm that cries wolf on
already-landed work trains the next station to skim past it.

**DISPATCHED** — to **06-pr-master** to stage a `-HOLD`: `--freshness` must resolve tracked-ness
against an explicit ref (`git cat-file -e origin/main:<path>`) and print the ref it used, rather than
against whatever the local index happens to be. **Do not arm it until F3 is settled** — it touches
`scripts/pipeline/`, not the station docs, so it will not conflict, but the one-at-a-time rule stands
and nothing should be armed while the board is Marco-blocked.

### F6 — The sweep's "commit `sweep-rotation.json` or the rotation stops" warning is a false alarm

Both ` M` files are byte-identical to `origin/main` (`git diff --stat origin/main --` empty). The
modification is only against a `HEAD` that is 4 commits stale. Rotation already landed at
`last_index=3` in #1381. No action needed, and the next station should not chase it.

**ACTIONED** — refuted by measurement; recorded here so it is not re-diagnosed a third time.

### F7 — #1377's only red is its own label gate

Confirms the standing finding rather than adding to it: the sole failing check is the diff-checks
job that carries the CP-26 step, i.e. the `do-not-merge` label. There is no code fault to fix, and
the PR is watcher-routed to Marco besides. Nothing here is actionable by me.

**DEFERRED** — becomes urgent only if Marco clears the label, at which point it should go green and
merge on the ordinary path. Note the standing consequence: `pr-lint-not-a-prompt-HOLD` must not be
armed until #1377 merges, because its scope is the same three files.

### F8 — 05-sot-keeper is past cadence but not silent

`last 2026-08-27T14:11:00Z, 26.0h ago (cadence 24h)`. The validator calls SILENT at 2× cadence, so
this is `ok` — but it is 2h overdue and worth one line so a genuine 48h silence next run is read as
the second data point, not the first.

**DEFERRED** — escalate if 05 has still not reported by 2026-08-29T14:11Z.

## WHAT I DID NOT DO

- **Did not merge #1383.** RULE 2, with ownership proven rather than assumed. Green, CLEAN and
  unlabelled do not clear a watcher routing.
- **Did not merge #1382**, even though it carries no routing record and is technically mine. Merging
  it would make #1383 DIRTY and would settle, unilaterally, the wording choice the watcher explicitly
  handed to Marco. A PR that is *permitted* is not therefore *correct* to merge.
- **Did not close either duplicate.** Closing one destroys an option Marco is being asked to choose
  between. Both stay open until F3 is answered.
- **Did not arm anything.** Armed is 0 and that is deliberate, not neglect: the next-arm candidate
  (`pr-lint-not-a-prompt-HOLD`) shares all three of its files with #1377, which cannot merge while
  Marco-gated, and anything touching the station canonical block would conflict with whichever
  duplicate Marco picks. Arming now would manufacture a conflict rather than move the board.
- **Did not restore the two deleted `-HOLD.md` working-tree files.** Both prompts are consumed
  (`processed` = 2); the recorded triage rule says leave the ` D`. Restoring them would re-present
  finished work as pending.
- **Did not touch the watcher clone, the 35 dirty files, the 4 orphaned worktrees, or any stash.**
  Not my lane, unchanged since the prior run, and already open with Station 03.
- **Did not restart the watcher.** Verdict was OK with 0 armed and 0 restart churn. An idle watcher
  with nothing armed is correct.
- **Did not fix `check-breadcrumb.mjs` myself** (F5). It is a `scripts/pipeline/` change that wants a
  linted prompt and a test, and authoring it in the shared dev tree where the watcher runs is the
  collision the lane split exists to prevent.

---

**The one thing blocking the board:** every open PR needs Marco. Two are mutually exclusive
duplicates awaiting his wording pick (F3); the third is label-gated (F7). Armed is 0 by design. The
board resumes the moment F3 is answered.

*Stamped `[MEASURED]`/`[INFERRED]` throughout. True at `origin/main 5e15d67c`, dev tree `82ba8538`,
2026-08-28T16:20Z. This breadcrumb is UNTRACKED until a board PR commits it.*
