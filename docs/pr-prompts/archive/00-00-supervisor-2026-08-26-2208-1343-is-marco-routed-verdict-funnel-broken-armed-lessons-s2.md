# Station 00 — Supervisor | 2026-08-26T22:08:44Z–2026-08-26T22:22Z

## GROUND

```
UTC            2026-08-26T22:08:44Z
origin/main    549537a4
dev tree       main @ 7ad50697  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Versions AGREE. Not blind: Desktop Commander reached the box first call
(`HOSTOK ... 2026-08-26T22:08:17Z`). This was a full run, not a quiet one.

## WHAT I MEASURED

**Board — 1 open PR.** [MEASURED] `gh pr list --state open --json ...` → `OPEN_COUNT 1`:
`#1343 | CLEAN | feat/ew-2b-allocation-engine-core | draft=False | labels=[] | 2026-08-26T20:24:43Z`.
Control: `--state all --limit 8` returned 8 rows (#1336–#1343), so the empty-ish
result is a real board, not a broken query.

**#1343 is fully green.** [MEASURED] `gh pr checks 1343` → 13 checks, **all `pass`**,
including `tendering-e2e` (12m27s) and `PR gates — diff checks`.

**#1343 IS WATCHER-ROUTED TO MARCO.** [MEASURED] `processed/pr-ew-s2b-alloc-engine-core-ready.md.log:19`:

```
[watcher] merge result for PR #1343: {"ok":false,"marco":true,
  "reason":"outside tests/ or docs/: apps/api/src/modules/tendering/__tests__/allocation.service.spec.ts"}
```

Instrument check first, per DOCTRINE §7: my initial sweep found `"marco":true` in
**12 of 12** prompt logs and **0 of 13** `rev-*` logs — a perfect split by log *type*,
which is the shape of an instrument measuring the wrong thing. I opened the matching
lines. The probe is **sound**: each hit is a distinct watcher merge-result line with its
own PR number and its own reason (`#1342` → `escalates:true`, `#1338` → `outside tests/`).
The 12/12 rate is real and is explained by the `tests-docs` policy being narrow enough
that essentially every code prompt is routed out.

**Trunk is GREEN.** [MEASURED] `gh api repos/.../commits/549537a4.../check-runs` → 13 runs,
12 `success`, 1 `skipped` (`PR gates`, a `pull_request`-only gate — correct on main).
I did **not** quote `status-sweep.ps1`'s trunk colour; per the standing trap it reads an
arbitrarily old `gh run list --branch main` page.

**Watcher ALIVE, same process as 2 hours ago.** [MEASURED] exact-cmdline query
`pr-watcher[\\/]index\.mjs` → 1 node, **pid 29024**. Negative control (same query, pattern
`zzz-not-a-real-watcher`) → 0. `restart-watcher-if-wedged.ps1` (report-only) →
`VERDICT: OK - nothing armed and the watcher is alive.` **PID 29024 is unchanged since
2026-08-24T05:35Z ⇒ no restart has occurred ⇒ the clone's code is the running code.**

**Wrapper absent, restarter healthy.** [MEASURED] `supervise-watcher.ps1` wrapper count = **0**;
`PO Watcher Keepalive` scheduled task `state=Ready lastRun=2026-08-26T22:05:01Z lastResult=0`
— three minutes before this run. `wrapper=0` alone is not a fault; the Keepalive task, not the
wrapper, is the live restart path.

**Queue.** [MEASURED] armed depth-1 `*-ready.md` at run start = **0**; `*-HOLD.md` = **50**.
`index.lock` ABSENT. No `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD`.

**The 20:09Z arm worked end-to-end.** [MEASURED] `processed/pr-ew-s2b-alloc-engine-core-ready.md.log`
written 20:25:32Z; `processed/rev-1343-ready.md.log` written 20:32:55Z. Arm → build → PR #1343 →
review job, in 16 minutes.

**do-not-arm instrument, calibrated.** [MEASURED] union of all three syntaxes over `pr-*.md`
(54 files) → **9 hits**. Positive control `pr-524-rates-b-slice2-canonical-HOLD.md` →
`DO NOT ARM` True. Negative control `pr-siteid-notnull-backfill-HOLD.md` → `DO NOT ARM` False,
HTML-comment True (exactly as the standing note predicts). The instrument can produce both answers.

**A correction to my own probe.** [MEASURED] My first candidate audit reported
`pr-crm-wincount-s2`, `pr-dns-s3-sot06-widgets` and `pr-e2e-container-s2` as `FILE_ABSENT`.
That was **my error, not the tree's** — I used the abbreviated names carried in memory. The real
files are `pr-crm-wincount-s2-close-bypasses-HOLD.md`, `pr-dns-s3-sot06-widgets-and-marker-HOLD.md`
and `pr-e2e-container-s2-swap-required-job-HOLD.md`. All 50 HOLD names are now listed from disk.

## WHAT CHANGED

**One mutation: I armed `pr-lessons-folder-s2-unfold-sot05`.**

`git mv docs/pr-prompts/pr-lessons-folder-s2-unfold-sot05-HOLD.md ...-ready.md` (exit 0).

Read-back [MEASURED]: `ON_DISK_ready True` · `ON_DISK_hold False` · armed count **0 → 1** ·
`git diff --cached --name-status` shows my `R100` alongside the two pre-existing orphaned
renames (`pr-ew-s2b`, `pr-sot-02-reconcile`) left by earlier arms. **I committed nothing.**

Evidence gathered before arming, every item [MEASURED]:

| Check | Result |
|---|---|
| Tracked? | `git ls-files --error-unmatch` → path echoed (tracked; a `git mv` of an untracked path refuses) |
| Gate `requires_file_on_main: docs/lessons-learned/README.md` | `git cat-file -e origin/main:...` exit **0**; negative control on a bogus path exit **128** |
| Premise `! test -f docs/legacy-ai-providers-investigation.md` | absent on `origin/main` (exit 128) **and** absent in the worktree ⇒ premise LIVE ⇒ still needed |
| do-not-arm, all three syntaxes | `ARM=False arm=False html=False` |
| `docs/approvals/` gate | not referenced |
| STANDING AUTHORITY exact literal | `body.includes('STANDING AUTHORITY to finish the work, commit, push')` → **True**; negative control → False |
| `lint-prompt.mjs` (read-only, no `--dequeue`) | **`PROMOTE` … `GATE_RELEASED`**, exit 0 |
| `gh` present (else a REJECT is the instrument, not the prompt) | True, authed as `GH-Mantova` |
| Already shipped? | all four destination files absent from `origin/main` (exit 128 ×4); cluster slice 1 is **#1305, merged** ⇒ correct order, not a duplicate |
| Incoming depth-1 `*-ready.md` | 0 before the `git mv` ⇒ nothing was armed by accident |

It carries `escalates: true`, so the watcher will label its PR `do-not-merge` and hold it —
which is DOCTRINE §5b working as designed: run it, open the PR, block the merge.
Its own body says Marco reviews the rendered diff and removes the label himself.

CP-24 is satisfied by construction: the prompt touches `sot/` + `docs/` only, and `codeRe` at
`scripts/pr-gates/pr-gates.mjs:327` does not include `docs/`.

## FINDINGS

### F1 — #1343 is green, has a MERGE verdict, and I did not merge it. RULE 2.

All 13 checks pass, `mergeStateStatus CLEAN`, `labels=[]`. Station 06 recovered its reviewer
verdict from the log: **`VERDICT: MERGE`**. None of that overrides the watcher's routing —
`"marco":true` in the prompt log is a human gate separate from the label, and it is not
discharged by green, by CLEAN, by an empty label list, or by a MERGE verdict.

Worth stating plainly because it will come up again: the routing **reason** is arguably wrong.
It names `apps/api/src/modules/tendering/__tests__/allocation.service.spec.ts` as "outside
tests/" — that file *is* a test, in a `__tests__/` directory the policy's literal `tests/`
match does not recognise. A provably-weak reason still does not release the gate.

**DISPOSITION: ESCALATED** — #1343 waits for Marco. It needs nothing else; it is green and
mergeable the moment he says so.

### F2 — the escalation and verdict funnel silently discards files. Station 06 filed it at 21:15Z.

`needs-marco/REVIEW-VERDICTS-AND-ESCALATIONS-ARE-BEING-LOST-2026-08-26.md`. Measured effect:
of four agent runs today that logged writing a file into `docs/pr-reviews/` or
`docs/pr-prompts/needs-marco/`, **three of those files do not exist**. The one that survived
did so because an unrelated agent committed it into its branch by accident. Agents write
relative paths inside their own disposable worktree; there is no copy-back step, so the file
dies with the worktree. 06 was careful to mark the mechanism strongly-evidenced rather than
proven — it has not read the runner code — while the *effect* is measured and certain.

This is the funnel DOCTRINE §5b calls "the only real stop". An agent that halts and escalates
believes it has stopped Marco; nothing reaches him. It already swallowed the rates-consumers
slice-3 design blocker for seven days.

The workaround works and I used it this run: `processed/<prompt>-ready.md.log` survives and
carries the agent's summary, verdict line included. That is how #1343's MERGE verdict was
recovered at all.

**DISPOSITION: ESCALATED** — this is Marco's call, and RULE 1 sorts the options:

- **(A) Copy-back step in the watcher: after an agent run, copy new files under
  `docs/pr-reviews/` and `docs/pr-prompts/needs-marco/` out of the worktree into the dev tree
  before cleanup.** Complete (no verdict or escalation is lost again) and additive (it only
  copies files that would otherwise be destroyed; it writes nothing a user entered). **Passes
  both halves of RULE 1.** 06 offered to write the prompt once the worktree mechanism is
  confirmed from the runner code.
- (B) Harden `check-breadcrumb.mjs` to fail when an agent log names a path that does not exist.
  Additive, and it would have caught all three of today's losses — but it only makes the loss
  *loud*. **Fails the "solves it completely" half.** Good as a second layer behind (A), not
  instead of it.
- (C) Keep reading verdicts out of `processed/*.log`. Damages nothing, but a long verdict or a
  detailed blocker is truncated to whatever the agent put in its final message. **Fails
  "completely" outright.** This is today's status quo, not a fix.

### F3 — Station 03 reads SILENT, and the instrument is the reason.

`check-breadcrumb.mjs --freshness` → `03 last 2026-08-25T23:01:00Z 23.2h ago (cadence 4h) SILENT`.
03's real schedule is the daily cron `0 9 * * *`; at a 24h cadence, 23.2h is inside 2× and 03 is
**not** silent. `CADENCE['03'] = 4` in the checker is wrong and manufactures a false SILENT on
every 00 run. Confirmed again this run, unchanged.

**DISPOSITION: DEFERRED** — a known one-line defect in a tracked script, already on the record.
It becomes urgent the moment 03 goes *genuinely* silent, because this false positive is exactly
what will make that get shrugged at. Fixing it is a staged prompt (06's lane), and 06 has no
schedule — see F4.

### F4 — the freshness checker rejected 7 breadcrumbs, and all 7 are Station 06's.

`structure: 45 checked, 7 malformed`. Every rejection is the same pair: no `# Station <NN>`
heading, and a FINDINGS section with no disposition line. All seven are `00-06-pr-master-*`.
06's report channel is malformed and its dispatch channel is shut — it still has **no scheduled
task** — yet it is doing real work: the 21:15Z escalation in F2 is 06's, filed by hand, and it is
the most valuable finding on the board today.

**DISPOSITION: DEFERRED** — already escalated at 16:09Z with RULE-1 options; the standing
instruction is not to re-raise it every run. Recording that it is still true, and that 06's
output is worth fixing the channel *for*.

### F5 — the shared index carries two orphaned `R100` renames for prompts already consumed.

`pr-ew-s2b-alloc-engine-core` and `pr-sot-02-reconcile-2026-08-19` both show `RD` — staged
rename, target deleted in the worktree — because the watcher consumed the `-ready.md` into
`processed/` and nothing unstaged the rename. Mine now makes three. A broad-pathspec commit by
any chat would carry a rename to a file that no longer exists.

**DISPOSITION: DEFERRED** — the mitigation is already standing practice (commit with a pathspec,
always) and I committed nothing this run. I deliberately did not `git reset -- <path>` them:
the dev tree's index is shared with concurrent chats, and unstaging someone else's entries to
tidy an index is the collision LL-38 records. It becomes urgent if a commit is ever seen
carrying a phantom rename.

## WHAT I DID NOT DO

- **Did not merge #1343**, though it is green, CLEAN, unlabelled and carries a MERGE verdict.
  RULE 2 / the watcher's `marco:true` routing. See F1.
- **Did not relaunch the `supervise-watcher.ps1` wrapper**, though §3b of my own station doc
  says to. `wrapper=0` with a healthy Keepalive task (`lastResult=0`, 22:05:01Z) is not a fault,
  and §3b's relaunch starts a *second* supervisor. The station doc is wrong here; the Keepalive
  task is the live restart path.
- **Did not restart the watcher.** `VERDICT: OK`, pid 29024 unchanged since 08-24T05:35Z.
- **Did not arm a second prompt.** One at a time.
- **Did not commit this breadcrumb or the arm.** Both are untracked/staged-only; this file
  reaches nobody until a board PR commits it.
- **Did not FF the dev tree** (8 behind `origin/main`). Nothing this run needed it, and a FF
  that carries an incoming depth-1 `*-ready.md` arms it.
- **Did not touch Azure / Entra / SharePoint, production data, or `/sot/`.**

---

## ADDENDUM 22:24Z — a Station 04 run landed mid-run and dispatched work to me

Station 04 reported at **22:18Z**, after I had taken my board reading and after I had already
armed. Its breadcrumb is `00-04-scanner-2026-08-26-2218-doctrine-s9-four-false-traps-…`. This is
the concurrency case the standing rule warns about, so I am recording it rather than silently
folding it into a section I wrote before it existed. Two things in it bear on my lane:

### F6 — 04 staged `pr-doctrine-s9-four-false-traps-HOLD.md` and dispatched it to 00 to arm.

It reports the prompt as ADMIT, `git add`ed (so tracked, therefore `git mv`-able), with its premise
and a negative control proven. I have **not** armed it: I armed `pr-lessons-folder-s2` earlier this
run, and RULE 4 is one at a time. Arming a second now is exactly the discipline that keeps a failed
slice attributable.

**DISPOSITION: DEFERRED** — first item for the next 00 run, ahead of the four remaining armable
candidates. Nothing about it expires in two hours. Re-verify tracked-ness and re-run the lint
immediately before the `git mv`, per the standing re-measure rule.

### F7 — 04 measured DOCTRINE §9.5 as INVERTED, which changes how I read a lint result.

§9.5 says `lint-prompt.mjs` reports **REJECT** when `gh` is merely missing. 04 measured the
opposite failure: with `gh` absent the linter returns a false **ADMIT**, with the approval
file-gate silently skipped. A false REJECT is loud and costs a run; a false ADMIT is silent and
arms something ungated.

This does not weaken my arm this run — I measured `gh` present and authed as `GH-Mantova`
*before* reading the lint result, precisely so that the verdict meant something. But it upgrades
that check from prudence to a requirement: **confirm `gh` is present before believing any lint
verdict, in either direction.**

**DISPOSITION: DEFERRED** — the fix is the prompt in F6, which is 04's work already staged and
mine to arm next run. I am not re-deriving 04's measurement here.
