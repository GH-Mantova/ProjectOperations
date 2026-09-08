# Station 00 — Supervisor | 2026-09-08T01:09Z–2026-09-08T01:45Z

## GROUND

```
UTC            2026-09-08T01:09:02Z
origin/main    e453ee8d            (fetch first, then rev-parse)
dev tree       main @ e453ee8d     C:\ProjectOperations2   (3e3ff890 on entry, fast-forwarded)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not read-only on that account.

**SIGHTED.** `start_process` (shell `powershell.exe`) succeeded after loading the Desktop Commander
schemas with a keyword `ToolSearch`. The first call was mangled by the `-Command` `$`-expansion trap
(§9.1) — `$env:COMPUTERNAME` arrived already substituted to empty and PowerShell died on a parser
error — which is a measurement of that trap, not of blindness: the shell itself answered. A healthy
run, not a quiet blind one.

**Device-bridge git guard, last line quoted as the contract requires** —
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`:

```
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

**Which tree the binding documents were read in:** the dev tree, `C:\ProjectOperations2`.
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**, so the working copies ARE `origin/main`'s
blobs and all three were read in full. No piped hash was compared (PREFLIGHT step 2).

**Fresh needle minted for this run, now spent by appearing here:** `zzQq00N20260908T0118`. Every
negative control below used it and returned 0.

## WHAT I MEASURED

**Board, `scripts/pipeline/status-sweep.ps1` at 01:10:36Z and again at 01:19:21Z.** The first read
`CAUTION` (a PR touched on GitHub inside two minutes); the second, taken immediately before the only
git write of this run, read **SAFE TO ACT** — no board mutation in progress, no recent remote
activity, no live station worktrees. Both instrument positive controls passed. [MEASURED] Both
captures came back UTF-16LE from the `*>` redirect exactly as §9.3 records and were decoded with node
before reading.

**Watcher, by the sanctioned probe only** — `scripts\restart-watcher-if-wedged.ps1`, report-only:
`VERDICT: OK - nothing armed and the watcher is alive.` node pid **31660**, wrapper alive, restart
churn 0 cycles in 20 min, armed 0. An idle watcher with an empty queue is correct, not wedged.

**COLLECT: one breadcrumb in the queue root, every finding in it already carrying a disposition.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → `structure: 1 checked, 0 malformed`,
`CLEAN`, exit 0; `00` 1.1h · `03` 2.2h · `04` 3.0h · `05` 11.0h, all `ok`. Crossed against `lastRunAt`
from the scheduled-tasks MCP as the contract requires: `03` 2026-09-07T23:01:27Z, `04`
2026-09-07T22:10:12Z, `05` 2026-09-07T14:11:15Z — each station's newest breadcrumb sits within two
minutes of its own last run, so no station is silent and none is in the started-and-died shape.
⚠️ `CADENCE['00']` is still `2` against an hourly cron, so a green `ok` for `00` remains the weak
reading; that is already with Marco and is not re-raised here.

**One open PR, and it is Marco's.** [MEASURED] `gh pr list --state open --json
number,mergeStateStatus,labels,files,createdAt`: **`#1796`** SOR-S9a register API, `BLOCKED`,
labels `[]`, created 2026-09-07T23:36:54Z, **13 pass / 0 fail / 2 pending**. Its file list carries
`apps/api/prisma/migrations/20260907140000_sor_s9a_claim_line_agreed_record/migration.sql`, which
`classifyPolicyFiles` refuses on its own `(^|/)migrations/` clause before any test-or-docs question
is asked, plus four `apps/api/src/…` paths outside all three `NESTED_TEST_PATHS` forms.
**Zero DIRTY PRs on the board** — the answer to Q1 is 0, so no PR's CI is frozen.

**RULE 2 probe, live tree, with its controls and the freshness control.** `docs\pr-prompts\processed`
in `C:\ProjectOperations2` — never the clone: **2066** logs, newest **2026-09-08T00:45:05Z**, which
is younger than `#1796`'s `createdAt`, satisfying §9.5's freshness precondition. `-Pattern
'marco.:true'` (regex form, no quote character) → **620**; NEG needle → **0**.
`Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern 'PR #1796\b'` → **0**.
**POSITIVE control on the exact PR-number form:** `PR #1797` returns a real verdict in a `pr-*.log`
— `[watcher] merge result for PR #1797: {"ok":true}` — so the probe can produce a positive and
`#1796`'s zero is a real absence. Recorded as `[NO LANE VERDICT — hand-classified]` per §10.1 step 4,
classification **MARCO'S**.

**`classifyPolicyFiles` transcription verified before it was used.** `git show
origin/main:scripts/pr-watcher/index.mjs | Select-String 'NESTED_TEST_PATHS' -Context 0,6` returned
the three-regex array byte-for-byte as transcribed (POS control `classifyPolicyFiles` → 2, NEG
needle → 0), so the hand-classifier below is running the live definition and not a paraphrase.

**Arming candidates: 14 gate-satisfied, and NOT ONE is `tests-docs` eligible.**
`triage-holds.ps1` (GIT control PASS, SPENT fixture control PASS) over 41 depth-1 HOLDs →
`spent=1 gates-satisfied=14 still-gated=26 unreadable=0`. Each candidate's `scope:` block was
classified by the verified regexes: **14 of 14 MARCO'S**, with the classifier's own controls passing
(4 positive paths all true, 3 negative paths all false). Two of the fourteen are Station 05's `sot/`
lane; one — `pr-sor-s9a-register-api-HOLD.md` — duplicates open `#1796` by scope (§10.6).

**The watcher clone is pinned four commits behind and does not carry today's merged work.**
[MEASURED] read-only git in `C:\po-watcher\ProjectOperations`: `HEAD` and its own `origin/main`
tracking ref **both `5345aab4`** — the dev tree's HEAD *before* the 00:09Z run — and `e453ee8d` is
not a known revision there at all. `Test-Path` on
`apps\api\src\modules\crm\reminders\comms-reminder.service.ts` (landed by `#1799` at 01:04Z) →
**False**. The clone is dirty with two untracked files, neither of which blocks a pull.

## WHAT CHANGED

**On the board: nothing merged, nothing labelled, nothing armed, nothing disarmed.** One PR opened
by this station, carrying only `docs/`.

1. **`docs/pipeline/DOCTRINE.md`** — one bullet added to §9.5 recording F1, with its fixture-based
   falsifying probe. `48 0`; byte deltas asserted on both writes (`+2874` then `+862`, each equal to
   the intended insert) per §9.3's node rule. Written by concatenation, never a replacement string.
   Inside the hash-gated `instruments v2` block, so the block hash was re-recorded.
2. **`docs/pipeline/stations/_canonical-blocks.json`** — `instruments v2` re-recorded to
   `093b70d294652946` via `lint-station.mjs --write-canonical`. `node scripts/pipeline/lint-station.mjs`
   then returned `ADMIT: all 8 docs clean`, exit 0. The edit cost ONE document, not seven —
   `instruments v2` lives only in DOCTRINE.
3. **`docs/pr-prompts/pr-triage-holds-open-pr-duplicate-bucket-HOLD.md`** — its Do and Acceptance
   sections rewritten to §10.6's CORRECTED rule. `32 13`, byte delta asserted. Re-linted after the
   edit: **ADMIT**, exit 0. See F2.
4. **`pr-tr-s2-reminder-engine-HOLD.md` retired** to `docs/pr-prompts/superseded/`. See F3.
5. **The collected breadcrumb archived** to `docs/pr-prompts/archive/`.
6. **This breadcrumb, written inside this run's own PR worktree** — cure 1 of the station doc's
   delete-the-disk-copy rule, so no loose untracked copy is left in the dev tree to block the next
   fast-forward.

## FINDINGS

### F1 — S2 — RULE 4's union grep OVER-reports, because `checkHumanGate` strips code context and a `Select-String` cannot — and it lands on the prompts that repair this pipeline's own instruments.

DOCTRINE §9.5 records that the union grep RULE 4 mandates as its second instrument **under**-reports,
through case sensitivity. It does not record that the same grep also **over**-reports, and the
over-report runs in the opposite direction: it makes a run **refuse to arm real work**.

`checkHumanGate` opens with `const stripped = stripCodeContext(bodyText)`, so fenced blocks and
inline code spans are removed **before** the three marker regexes run — exactly as its own doc
comment says. A grep reads the unstripped source, so a prompt that *documents* the arming gate
matches the marker it is quoting.

**[MEASURED]** union grep over the depth-1 `-HOLD.md` at `e453ee8d`, each hit then re-linted:
**12 flagged · 11 lint exit 1 `HUMAN_GATE_PRESENT` (true) · 1 lint exit 0 ADMIT (false)**. The false
positive is `pr-triage-holds-open-pr-duplicate-bucket-HOLD.md`, whose body asks the script to print
a heading containing the marker inside an inline code span. **NEGATIVE control:** two prompts the
grep did not flag were re-linted and neither reported `HUMAN_GATE_PRESENT`, so on this board the
error is one-directional.

**This run walked into it.** The grep was run as RULE 4 requires and flagged the one prompt this run
had selected as its best arming candidate. Believing the grep would have refused a prompt the linter
correctly admits — and the prompts that quote the marker are, by construction, the prompts that fix
the arming machinery.

**DISPOSITION: ACTIONED.** Landed in DOCTRINE §9.5 by this PR with the cure — treat a grep hit as a
QUESTION and settle it by running `lint-prompt.mjs` on that one file and reading the
`HUMAN_GATE_PRESENT` **code**, never the exit code alone, since a HOLD also exits 1 for
`GATE_NOT_RELEASED`. ⚠️ **The board count is deliberately NOT the falsifying probe**, because this
same PR repairs the one false positive it names, so a re-run over tomorrow's HOLDs would return
11 of 11 and read as a refutation. The probe landed instead is a **fixture whose truth is known by
construction**, measured this run against the exported `checkHumanGate`: prose marker → gate; the
same words in an inline code span → no gate; in a fenced block → no gate; the HTML comment → gate;
no marker → clear on both instruments.

### F2 — S2 — the staged fix for §10.6 implements the PRE-correction rule, and arming it would have landed an instrument DOCTRINE has already measured as wrong in both directions.

`pr-triage-holds-open-pr-duplicate-bucket-HOLD.md` was staged from a 2026-09-06T13:3xZ measurement.
§10.6's correction landed **2026-09-07T03:4xZ**, after it. The prompt's step 2 said *"mark the prompt
OPEN_PR_DUPLICATE when every `scope:` entry is present in one open PR's file list … a full match is
an answer"*, and step 3 told the script to **remove** those prompts from CANDIDATES. Both halves are
what §10.6 measured as wrong:

- **Under-reports.** An exact-path set test can never match a `scope:` entry ending in `/`. §10.6's
  worked case is `pr-rates-plant-fuel-column` scoring 3 of 4 against `#1746`, the miss being
  `apps/api/prisma/migrations/` — so a full-match rule silently clears a `gate_allow: migrations`
  prompt, i.e. Marco's, which is the exact class the bucket exists to protect.
- **Over-reports, then acts on it.** For a one-file `scope:` the test's precision is zero by
  construction — three prompts sharing the sole entry `scripts/pipeline/status-sweep.ps1` each
  scored 1/1 against `#1750` and only one was that PR's work. Removing them from CANDIDATES turns an
  unconfirmed overlap into a verdict and hides real work.

**DISPOSITION: ACTIONED.** The prompt is corrected in this PR: directory-form entries match as a
PREFIX; any overlap of one or more is a CANDIDATE and never a verdict; the new heading annotates
rather than filters, so the CANDIDATES total is unchanged; confirmation is on the prompt's own marker
string, never the head branch. Its Acceptance now exercises both §10.6 shapes, which makes the
correction checkable in CI rather than in prose. Re-linted after the edit: ADMIT, exit 0.
**It was NOT armed this run** — the correction must be on `main` before the watcher builds from it,
or the build would carry a prompt no clone, CI or other station can see. It is the first arming
candidate for the next run.

### F3 — ACTIONED — `pr-tr-s2-reminder-engine-HOLD.md` is SPENT now that `#1799` has merged.

`#1799` (TR-2, the scheduled reminder engine) merged at **2026-09-08T01:04Z** and is `origin/main`
`e453ee8d`. It was built by a second lane, and §10.6 records that a second lane does not consume the
prompt — which is why this station has been carrying `pr-tr-s2-reminder-engine` as a do-not-arm name
since 2026-09-07. **The premise dies on MERGE, and it has now merged.** Re-linted at `e453ee8d`:
**`STALE`, exit 3**, *"Premise no longer holds … The work is ALREADY DONE."* `triage-holds.ps1`
reports it as the board's only SPENT, with the SPENT fixture control PASS so the bucket was
measurable.

**DISPOSITION: ACTIONED** — retired to `docs/pr-prompts/superseded/` in this PR. **The board's
do-not-arm carry-forward is empty again**, and no name from it survives into the next run.

### F4 — DEFERRED — the `tests-docs` lane is proven, and starved for the fifth consecutive run: 14 of 14 gate-satisfied HOLDs are ineligible.

The lane works and was seen working within the last two hours: `#1797`'s log carries
`[watcher] merge result for PR #1797: {"ok":true}` — a docs-only PR merged with no human. What it has
never had is supply from the HOLD board. Hand-classified again this run with the live regexes and
their controls: **0 of 14**. Every arm available today therefore produces a PR that stops at Marco.

**DISPOSITION: DEFERRED**, and this run deliberately armed nothing. What would make it urgent: a
docs-or-tests-only HOLD appearing on the board, at which point it should be armed the same run. The
standing structural question — that the only lane which merges without Marco can only ever be fed by
prompts nobody writes — is already on record and is not re-raised. ⚠️ **The arithmetic changed in
one direction worth naming:** Marco's open board is down from three PRs to one, so the "he already
has enough" half of the four previous runs' reasoning is weaker than it was. The reason this run
still armed nothing is F2 — the one high-leverage candidate needed its correction landed first — not
a repeat of that argument.

### F5 — DEFERRED — the watcher clone is four commits behind and missing today's merged code, and the fast-forward still belongs to nobody.

[MEASURED] the clone's `HEAD` and its own `origin/main` are **both `5345aab4`**, the dev tree's HEAD
before the 00:09Z run; `e453ee8d` is not a known revision there; and `#1799`'s
`comms-reminder.service.ts` is absent from the clone's working tree. This is the standing escalation
`needs-marco/nobody-may-fast-forward-the-watcher-clone-2026-09-07.md`, unchanged in substance and
now with a fresh measurement: 00's ABSOLUTE forbids `git merge` in the clone and 03 declines on
report-only.

**It is NOT currently blocking a build**, and that is worth recording so the next run does not
escalate it as one: `index.mjs` carries its own sync path — `log("sync", "git fetch + git checkout
main + git pull")` and a `runGit(["fetch", "origin", "main"])` in the dependency check — so a build
brings the clone forward itself. What the stale pin does block is anything that reads the clone
*without* a build, including a restart adopting new watcher code (§9.5).

**DISPOSITION: DEFERRED**, unchanged. It becomes urgent the moment a build is observed running
against stale code, or a watcher restart is needed to pick up a `scripts/pr-watcher/**` merge.

### F6 — DEFERRED — `C:\po-vg` is still an orphaned worktree holding one uncommitted file, now 5357 minutes old.

Unchanged from the previous run except in age (5297 → 5357 min). `git worktree remove` will refuse
and `--force` would discard the file. Worktree repair is Station 03's and it is already escalated.

**DISPOSITION: DEFERRED**, unchanged. It becomes urgent the moment a second worktree accumulates the
same way, or if the file's content is ever needed.

### F7 — ACTIONED (recorded, stood off) — `#1796` is Marco's, its branch was rebuilt 20 minutes before this run, and this station did not touch it.

`#1796` hand-classifies as MARCO'S on two independent clauses (a `migrations/` path, and four
`apps/api/src/…` paths outside `NESTED_TEST_PATHS`), reads `NO LOG` against a well-controlled and
fresh RULE 2 probe, and carries no labels — and Marco removing a `do-not-merge` label does not clear
RULE 2. Its head moved `0bd2fca5..64787b3f` during this run's fetch, consistent with
`pollForBehindPrs` rebuilding it after `#1799` merged. Its two pending checks are simply running.

**DISPOSITION: ACTIONED** — recorded and stood off, which is the correct action, not an absence of
one. No merge, no branch update, no label change.

## WHAT I DID NOT DO

- **Did not arm anything.** F4 gives the measurement — 0 of 14 candidates can enter the lane that
  merges without Marco — and F2 gives the reason the one candidate worth arming waits for the next
  run.
- **Did not merge, update, label or unlabel `#1796`.** It is Marco's on two clauses and he is
  actively driving this board.
- **Did not run `why-blocked.ps1`** on `#1796`: §9.4 records that it attempts a real REST merge,
  which on a Marco-classified PR is a live RULE 2 hazard.
- **Did not touch the watcher, the clone, or `C:\po-vg`.** The watcher is OK by its own sanctioned
  probe. Read-only git only in the clone; no `checkout`, `merge`, `rebase`, `commit`, `push` or
  `pull` there.
- **Did not run `git` from the VM against the Windows `.git`.** The guard was installed first and
  every git call went through Desktop Commander.
- **Did not compare a piped hash.** `git diff --numstat origin/main -- <path>` was used throughout.
- **Did not `git checkout .`, `reset --hard`, `stash pop` or `git clean`** anywhere.
- **Did not edit `/sot/`,** and did not touch Azure, Entra or SharePoint — not once, not
  read-modify-write.

## ADDENDUM — 2026-09-08T01:5xZ (same run, later measurements)

`#1796` **MERGED** while this run's board PR was in CI — Marco's own merge — and is now
`origin/main` `7fd57e37`. **The board now holds no open PR but this station's own.** This PR was
rebased onto it (`git rebase origin/main`, clean, no conflict, `4b23f31a`); no force was needed on
`main` and nothing else was touched.

### F8 — ACTIONED — `#1796` merging made a second prompt SPENT inside the hour

`pr-sor-s9a-register-api-HOLD.md` is exactly `#1796`'s scope, and the 00:08Z run correctly refused to
retire it while the PR was open — §10.6 is explicit that the premise dies on MERGE, not on OPEN.
Re-linted at `7fd57e37`: **`STALE`, exit 3**, *"Premise no longer holds … The work is ALREADY
DONE."*

**DISPOSITION: ACTIONED** — retired to `docs/pr-prompts/superseded/` in this PR.

### What this does not change

F4's measurement is unaffected. The retirement removes a candidate that was never armable, leaving
**13** gate-satisfied HOLDs and still **none** of them eligible for the `tests-docs` lane — the fifth
consecutive run with that reading. F7 is discharged by the merge: the PR was Marco's, Marco merged
it, and this station never touched it.
