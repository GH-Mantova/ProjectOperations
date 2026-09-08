# Station 00 — Supervisor | 2026-09-08T00:09Z–2026-09-08T00:55Z

## GROUND

```
UTC            2026-09-08T00:09:38Z
origin/main    0ba04fb7            (fetch first, then rev-parse)
dev tree       main @ 0ba04fb7     C:\ProjectOperations2   (5345aab4 on entry, fast-forwarded)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not read-only on that account.

**SIGHTED.** `start_process` (shell `powershell.exe`) succeeded on the first call after loading the
Desktop Commander schemas with a keyword `ToolSearch`. A healthy run, not a quiet blind one.

**Device-bridge git guard, last line quoted as the contract requires** —
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`:

```
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

**Which tree the binding documents were read in:** the dev tree, `C:\ProjectOperations2`.
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**, so the working copies ARE `origin/main`'s
blobs and all three were read in full at 0ba04fb7. No piped hash was compared (PREFLIGHT step 2).

**Fresh needles minted for this run, both now spent by appearing here:**
`zzQq00N20260908T0015` and `zzQq00N20260908T0040`. Every negative control below used one and
returned 0.

## WHAT I MEASURED

**Board, `scripts/pipeline/status-sweep.ps1` at 00:11:04Z, `[LIVE]` lines only. Verdict SAFE TO ACT.**
Both instrument positive controls passed. Open PRs **2**; armed **0**; watcher node RUNNING pid
31660 with its wrapper alive and a 17-min heartbeat; `index.lock` False in both trees; 0 git
processes. [MEASURED] The capture came back UTF-16LE from the `*>` redirect exactly as §9.3 records,
and was decoded with node before reading.

**COLLECT: four breadcrumbs in the queue root, every finding in all four already carrying a
disposition.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `structure: 4 checked, 0
malformed`, `CLEAN`, exit 0; `00` 1.1h · `03` 1.2h · `04` 2.0h · `05` 10.0h, all `ok`. Crossed
against `lastRunAt` from the scheduled-tasks MCP as the contract requires: `00`
2026-09-08T00:08:35Z, `03` 2026-09-07T23:01:27Z, `04` 2026-09-07T22:10:12Z, `05`
2026-09-07T14:11:15Z — every station's newest breadcrumb aligns with its own last run, so no station
is silent and none is in the started-and-died shape. ⚠️ `CADENCE['00']` is still `2` against an
hourly cron, so a green `ok` for `00` remains the weak reading (F5 of the 2310 collect, already with
Marco). All four are archived in this PR.

**#1767 MERGED at 2026-09-07T23:58:24Z, and its merge commit IS today's `origin/main` `0ba04fb7`.**
[MEASURED] `gh pr view 1767 --json state,mergedAt,mergeCommit`. That closes the third of the three
PRs the 2310 collect reported open.

**Both remaining open PRs now carry NO labels, and both are Marco's.** [MEASURED]
`gh pr list --state open --json number,mergeStateStatus,labels,files`:

| PR | state | labels | classified by | verdict |
|---|---|---|---|---|
| `#1796` SOR-S9a register API | BEHIND, 13 pass / 0 fail / 2 pending | `[]` | `apps/api/prisma/migrations/20260907140000_.../migration.sql` — a `(^\|/)migrations/` path | **MARCO'S**, refused by `classifyPolicyFiles` on its own clause |
| `#1775` TIP-ID-S2 | BLOCKED, 14 pass / 0 fail / 1 pending | `[]` | `apps/api/src/modules/map-locations/…`, `scripts/rates/…`, `package.json` — outside all three `NESTED_TEST_PATHS` forms | **MARCO'S** |

**RULE 2 probe, live tree, with its controls.** `docs\pr-prompts\processed` in
`C:\ProjectOperations2` (never the clone): **2064** logs, newest **2026-09-07T23:54:21Z** — younger
than `#1796`'s `createdAt` 23:36:54Z and than `#1775`'s 08:57:26Z, which is the freshness control
§9.5 requires. `-Pattern 'marco.:true'` (regex form, no quote character) → **620**; NEG needle → 0.
`Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern 'PR #<n>'`, excluding `rev-*` →
**0** for `#1796`, `#1775` and `#1767`. So all three read `NO LOG`, recorded as
`[NO LANE VERDICT — hand-classified]` per §10.1 step 4, with the classification in the table above.
**Zero DIRTY PRs on the board** — the answer to Q1 is 0, so no PR's CI is frozen.

**Arming candidates: 15 gate-satisfied, and NOT ONE is `tests-docs` eligible.** `triage-holds.ps1`
(SPENT fixture control PASS) over 43 depth-1 HOLDs → `spent=1 gates-satisfied=15 still-gated=27
unreadable=0`. Each candidate's `scope:` block was classified by hand against the three
`NESTED_TEST_PATHS` forms plus the `(^|/)migrations/` refusal: **15 of 15 FALSE.** Two of the
fifteen duplicate an open PR by scope AND by marker — `pr-sor-s9a-register-api-HOLD.md` ⇔ `#1796`
and `pr-tipid-s2-write-the-ids-backfill-and-admin-HOLD.md` ⇔ `#1775` (§10.6) — and two are Station
05's `sot/` lane.

**Receipt provenance — the measurement this run turns on.** `gh pr view <N> --json commits`, then
`gh api repos/GH-Mantova/ProjectOperations/commits/<sha>`, on four receipts written inside 25
minutes:

| receipt | commit | `commit.author.name` | message |
|---|---|---|---|
| `1797.md` | `08ce2ae0` 23:37:35Z | `Claude Opus 5 (station-00 cloud lane) <noreply@anthropic.com>` | `docs(merge-approvals): receipt for #1797 - supervised cloud lane, standing authority` |
| `1767.md` | `268a9a54` 23:15:59Z | `GH-Mantova`, committer `GitHub <noreply@github.com>` | `Create 1767.md` |
| `1775.md` | `d146637e` 23:17:08Z | `GH-Mantova`, committer `GitHub <noreply@github.com>` | `Add approval details for PR 1775` |
| `1796.md` | `6aaf5f62` 2026-09-08T00:08:17Z | `GH-Mantova`, committer `GitHub <noreply@github.com>` | `Create 1796.md` |

**POSITIVE control:** `#1797`'s own BUILD commit `985fa475` (23:36:31Z, the two in-scope doc edits)
reads `Marco <marco@initialservices.net>` — the watcher's local git config on Marco's box.
`opened PR #1797` → **1** in the daily clone log selected by name-shape filter then newest mtime
(`2026-09-07.log`, mtime 00:21:14Z, POS `[merge]` 9, NEG 0); `opened PR #1790` and `#1777` → **0**,
consistent with their own receipts saying the cloud lane opened them.

## WHAT CHANGED

**On the board: nothing merged, nothing labelled, nothing armed, nothing disarmed.** One PR opened
by this station, carrying only `docs/`.

1. **`docs/pipeline/DOCTRINE.md`** — one block added to §10.2.1 recording the receipt-provenance
   measurement above, its positive control, its falsifying probe, and the `approved_by` ambiguity.
   `36 0`, byte delta asserted equal to the insert (`before=129910 after=132916 delta=3006
   expected=3006 OK=true`) per §9.3's node rule. Written by concatenation, never a replacement
   string. Outside the hash-gated `instruments v2` block, which ends at §9.6.
2. **`docs/pipeline/STATION-CAPABILITIES.md`** — one sentence added to §5 pointing at that block
   rather than restating it (§3's no-paraphrase rule). `2 0`, delta asserted, `263 = 263`.
3. **Two spent prompts retired to `docs/pr-prompts/superseded/`** — see F3 and F4.
4. **Four collected breadcrumbs archived** to `docs/pr-prompts/archive/`.
5. **This breadcrumb, written inside this run's own PR worktree** — cure 1 of the station doc's
   delete-the-disk-copy rule, so no loose untracked copy is left in the dev tree to block the next
   fast-forward.
6. **Outside the PR, in the dev tree:** `needs-marco/a-scheduled-build-forged-a-merge-approval-receipt-naming-you-2026-09-07.md`
   rewritten and renamed — see F1. That directory is gitignored, so the correction cannot travel in
   a PR; it is recorded here so the change is not invisible.

## FINDINGS

### F1 — S1 — my own 23:48Z escalation accused an actor of forging Marco's approval, and the receipt commit names its own lane in the git identity. REFUTED.

The 2310 run filed `needs-marco/a-scheduled-build-forged-a-merge-approval-receipt-naming-you-2026-09-07.md`,
whose central claim was *"The file was written by the code-writer agent inside the build"*. Its own
falsifying probe reads: *"if a repo instrument is found that authored it, this escalation is wrong
about the cause."* **[MEASURED] the authoring commit `08ce2ae0` is authored AND committed by
`Claude Opus 5 (station-00 cloud lane) <noreply@anthropic.com>`** — the supervised cloud lane of
DOCTRINE §10.2.1, signing itself, exactly as the receipt body claims. It is a **separate commit
28 seconds AFTER the watcher opened the PR**, so the build — which had already pushed — cannot have
written it. The build commit is a different identity again (`Marco <marco@initialservices.net>`,
the watcher's local git config).

**Why the earlier run could not see it.** `git log --format=%an origin/main --
docs/decisions/merge-approvals/1797.md` answers `GH-Mantova`, because the squash-merge commit is all
`main` retains. That is the only instrument the 2310 run reached for. **The identity survives on the
PR's own commit list and nowhere else.**

**Two of the escalation's three supporting claims also fail.** *"There is no such instrument in this
repo — `bd-push-slice.ps1` does not exist under `scripts/pipeline/`"* searched ONE directory and read
the empty result as an empty world (§9.6). The script is genuinely absent from the repo, but that is
what DOCTRINE §10.2 **predicts** — the cloud lane's instruments are by construction not in this tree
— and the name appears on `origin/main` in **24** files, 20 of them receipts describing it
(POS control `classifyPolicyFiles` 115, NEG 0). And `#1774`'s receipt names `#1767` and `#1775` as
the two Marco said he would receipt personally; he did exactly that, by hand, in the GitHub web UI
at 23:15:59Z and 23:17:08Z. The whole picture is coherent and authorised.

**DISPOSITION: ACTIONED.** The escalation is rewritten and renamed on disk to
`needs-marco/nothing-verifies-a-merge-approval-receipt-2026-09-07.md`, the forgery framing retracted
and the surviving ask kept (F2). The measurement and its falsifying probe are landed in DOCTRINE
§10.2.1 by this PR so the next run cannot repeat the error from the same instrument. **Nothing on
`main` was reverted or deleted** — the `#1596` precedent stands.

### F2 — S2 — `approved_by: marco` records WHOSE AUTHORITY, not WHO LOOKED, and the field contradicts the body of its own file.

This is what survives F1, and it is real. On a standing-authority receipt the front matter says
`approved_by: marco` while the body says, verbatim, *"Marco did not see this PR before it merged."*
A station read the field, did not read the body, and filed a forgery accusation. The underlying gap
is unchanged and already stated in §10.2.1 by the lane itself: **CP-26 is armed by LABELLING, not by
the diff**, so `approval-receipt.mjs` returns `PASS / NEVER_ESCALATED` on a PR that was never
labelled and never looks at the receipt at all. Nothing verifies a receipt's claims.

**DISPOSITION: ESCALATED**, narrowed, in the rewritten file. The complete-and-additive option is
unchanged from the original — arm CP-26 off the DIFF as well as the label, so a PR adding
`docs/decisions/merge-approvals/<N>.md` must have `<N>` match its own number and carry a signature
the check can verify — and it now has a **cheaper companion that needs no signing scheme**: add
`authority: standing | personal` to the receipt front matter, which removes the ambiguity at the
source and is the thing that actually cost a run. Both are additive, neither removes a gate, and the
62 existing receipts are untouched. Choosing between them is Marco's.

### F3 — ACTIONED — `#1797` shipped its prompt's content and did NOT delete the prompt, so the `-HOLD.md` is still tracked on `main` and armable again.

[MEASURED] `git diff --numstat origin/main --
docs/pr-prompts/pr-doctrine-s9-powershell-readonly-automatic-variables-HOLD.md` → `0 102` on a tree
at **0 behind, 0 ahead** (so §9.2's behind-tree caveat does not apply), and
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` still lists it. The disk copy is gone
because arming renamed it, so the only thing standing between this board and a duplicate build of
already-merged work is the absence of a file that `git checkout .` would restore — which is exactly
what §9.2 forbids and what the board trap describes. **This is the stays-armable-forever defect,
live, on today's board.**

**DISPOSITION: ACTIONED** — retired to `docs/pr-prompts/superseded/` in this PR. The general defect
(nothing makes an armed prompt's PR delete it) remains unstaged and is Station 06's to design.

### F4 — ACTIONED — `pr-tr-s1-reminder-policy-HOLD.md` is SPENT now that `#1767` has merged.

`triage-holds.ps1` reports it as the board's only `SPENT` (lint exit 3), with the SPENT fixture
control PASS so the bucket was measurable. The 2310 run correctly refused to retire it while `#1767`
was open; `#1767` merged at 23:58:24Z, so the retirement is now due and this run is the first that
could make it.

**DISPOSITION: ACTIONED** — retired to `docs/pr-prompts/superseded/` in this PR.

### F5 — DEFERRED — the `tests-docs` lane is proven and permanently starved: 15 of 15 gate-satisfied HOLDs are ineligible, for the third consecutive run.

The lane works — the 2310 run proved it end to end with zero humans in 10m32s. What it has never had
is supply from the HOLD board. Measured again this run by hand-classifying every candidate's `scope:`
block: **0 of 15**. Every arm available today therefore produces a PR that stops at Marco, and he
already has two open.

**DISPOSITION: DEFERRED**, and this run deliberately armed nothing. What would make it urgent: a
docs-or-tests-only HOLD appearing on the board, at which point it should be armed the same run. The
standing structural question — that the only lane which merges without Marco can only ever be fed by
prompts nobody writes — is already on record from the 22:09 run and does not need re-raising.

### F6 — ACTIONED (recorded, stood off) — Marco is hand-driving this board right now, and BOARD DRIVING condition 3 is the reason this run touched neither open PR.

Three web-UI receipts inside 53 minutes (23:15:59Z, 23:17:08Z, 00:08:17Z), the last of them **91
seconds before this run started**, plus both `do-not-merge` labels removed since Station 04 measured
them present at 22:12Z. Only Marco removes that label. `#1796` is BEHIND and I did not update its
branch: a branch update on a PR its author is actively working is the LL-38 collision, and §9.4
records that `why-blocked.ps1` attempts a real REST merge, which on a Marco-classified PR is a live
RULE 2 hazard.

**DISPOSITION: ACTIONED** — recorded and stood off, which is the correct action, not an absence of
one.

### F7 — DEFERRED — `C:\po-vg` is still an orphaned worktree holding one uncommitted file, now 5297 minutes old.

Unchanged from the 2310 run except in age (5179 → 5297 min). `git worktree remove` will refuse and
`--force` would discard the file. Worktree repair is Station 03's and it is already escalated.

**DISPOSITION: DEFERRED**, unchanged. It becomes urgent the moment a second worktree accumulates the
same way, or if the file's content is ever needed.

## WHAT I DID NOT DO

- **Did not arm anything.** F5 gives the measurement; 0 of 15 candidates can enter the lane that
  merges without Marco, and two of the fifteen duplicate an open PR.
- **Did not merge, update, label or unlabel `#1796` or `#1775`.** Both hand-classify as Marco's, both
  are unlabelled only because Marco removed the labels himself, and removing a label does not clear
  RULE 2.
- **Did not revert, delete or edit `docs/decisions/merge-approvals/1797.md`.** The `#1596` precedent
  is that an agent-authored authority claim is neither honoured nor reverted by another agent — and
  it turns out not to be an unauthorised claim at all.
- **Did not touch the watcher, the clone, or `C:\po-vg`.** The watcher is RUNNING with a live
  wrapper and an empty queue; that is idle-and-correct, not wedged. The clone fast-forward remains
  the open escalation from the 2310 run — still nobody's, still not mine to perform.
- **Did not run `git` from the VM against the Windows `.git`.** The guard was installed first and
  every git call went through Desktop Commander.
- **Did not compare a piped hash.** `git diff --numstat origin/main -- <path>` was used throughout.
- **Did not edit `/sot/`,** and did not touch Azure, Entra or SharePoint — not once, not
  read-modify-write.

## ADDENDUM — 2026-09-08T00:36Z–00:50Z (same run, later measurements)

`#1798` merged at **00:36:05Z** (`87e47607`), and the dev tree fast-forwarded onto it cleanly — all
three read-backs the station doc requires: `git rev-list --left-right --count HEAD...origin/main`
→ `0 0`, `git diff --numstat` → EMPTY, `git diff --cached --name-status` → EMPTY. No disk-copy cure
was needed because the breadcrumb was written inside the worktree (cure 1).

### F8 — ACTIONED — `#1775` merged mid-run, which made a second prompt SPENT within the hour

**[MEASURED]** `#1775` merged at **2026-09-08T00:2xZ** as `b34a8d86` while this run was building its
board PR — Marco's own merge, the third of the three PRs the 2310 collect reported open. Its work is
exactly the scope of `pr-tipid-s2-write-the-ids-backfill-and-admin-HOLD.md`, which the 2310 run
correctly refused to retire while the PR was open (`superseded/` only once it MERGES).

Re-linted after the merge: `node scripts/pipeline/lint-prompt.mjs
docs/pr-prompts/pr-tipid-s2-write-the-ids-backfill-and-admin-HOLD.md` → **`STALE`, exit 3**,
*"Premise no longer holds … The work is ALREADY DONE."* That is the SPENT bucket, and the retirement
is now due.

**DISPOSITION: ACTIONED** — retired to `docs/pr-prompts/superseded/` in this PR. With it, all three
of the do-not-arm names this station has been carrying since 2026-09-07 are discharged: two by their
PRs merging, one because its content shipped while its prompt stayed tracked. **The board's
do-not-arm carry-forward is now empty.**

### What this does not change

The arming picture is unaffected: `pr-tipid-s2` was never armable, and removing it from the board
leaves the same measurement — no HOLD on this board can enter the `tests-docs` lane. `#1796` is still
open, still Marco's, still untouched by this station.
