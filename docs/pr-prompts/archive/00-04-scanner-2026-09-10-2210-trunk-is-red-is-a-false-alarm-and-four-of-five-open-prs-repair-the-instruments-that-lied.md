# Station 04 — Scanner | 2026-09-10T22:10:20Z–2026-09-10T22:26Z

## GROUND

```
UTC            2026-09-10T22:10:20Z
origin/main    6e63dc72            (fetched, then rev-parse)
dev tree       main @ 6e63dc72     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — full authority, not read-only-on-mismatch.

Sweep this run: **gate-liveness** (`next-sweep.mjs`, rotation position 1 of 4; previous run
2026-09-10T18:10:08Z). Advanced to `last_run_utc=2026-09-10T22:21:41Z` and **LEFT DIRTY** —
`docs/pipeline/sweep-rotation.json`, `git diff --numstat origin/main` = `2 2`. **Station 00 must
commit it**; 04 may not commit to the shared dev tree.

## WHAT I MEASURED

**Transport.** Desktop Commander reached the box on the first call (`start_process`,
`powershell.exe`) — `LIVE 2026-09-10T22:10:20Z pwd=C:\ProjectOperations2` [MEASURED]. Sighted run,
not a blind one.

**Binding docs read from the tree that equals `origin/main`.**
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY** [MEASURED] — the sound probe per §9.2, not
a piped hash. All three read in full from a working copy proven byte-identical to `origin/main`.

**Device-bridge git guard: [CANNOT MEASURE] — could not be installed.** The Linux sandbox refuses to
boot. Two attempts, byte-identical error: `failed to mount … under Plan9 share "c" which is not
mounted; create: RPC error -1: ensure user … already exists unexpectedly`. So
`scripts/pipeline/vm-git-guard.sh` did not run and its last line cannot be quoted. **Consequence
this run: nil** — with no mount there were zero VM-side calls, so the `index.lock` hazard the guard
exists to prevent could not arise. No `git` was run against the mount. See F5.

**PREFLIGHT step 4 — `status-sweep.ps1`.** Exit 10, captured to a file (it returns early and hides
its own section-7 verdict) and decoded `utf16le` per §9.3's `*>` bullet — 132,842 bytes, 794 lines,
all ten sections present. Section 0 instrument controls both PASS. Section 7: **SAFE TO ACT**.
Board: 5 open PRs, armed **0**, watcher node RUNNING pid 18228, heartbeat 42 min (idle, empty queue).

Clone `dirty=2` with the warning *"the watcher may refuse to start"* is the **known false positive**
landed in DOCTRINE §9.5 at 20:2xZ today — untracked `docs/pr-reviews/pr-*.md` the review lane writes
by design. Not re-raised.

**Gate liveness — the corpus.** `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` filtered
to depth 1 (never a glob pathspec, §9.2): **40** tracked `-HOLD.md`. `triage-holds.ps1` independently
reported **40**. Both instrument controls inside it PASS (GIT control read DOCTRINE at 162,486 chars;
SPENT fixture emitted exit 3, so the SPENT bucket is measurable).

`triage-holds.ps1` totals [MEASURED]: **spent = 0 of 40**, gates-satisfied 9, still-gated 31,
unreadable 0. It re-probed all 31 REJECTs directly: **0 spent behind a REJECT**, 31 still needed, 0
unmeasurable. **No finished work is sitting on the board.**

**Front-matter parser controlled separately from the decision** (§9.3's CRLF bullet — the
`\s*\n` list form returns null on every CRLF prompt and yields a uniform zero). CRLF-explicit
`^key:[ \t]*\r?\n((?:[ \t]*-[ \t]*\S.*\r?\n)+)` used throughout. POSITIVE: front matter parsed,
1112 chars on the first prompt. NEGATIVE: a minted key → 0.

**Every `requires_*` gate evaluated against `origin/main` at `6e63dc72`.** 26 of the 40 HOLDs carry
one. Controls: file-on-main POS `CLAUDE.md` → true, NEG minted path → false; needle POS → SATISFIED,
NEG → NEEDLE_ABSENT; `gh pr view 1861` → MERGED.

- `requires_merged` — **3, all SATISFIED**: #1361 merged 2026-08-28, #1317 merged 2026-08-25,
  #1111 merged 2026-08-14. **No dead PR gate on this board.**
- `requires_file_on_main` — 5 unsatisfied are the **Marco-approval class**
  (`docs/approvals/<slug>-approved-by-marco.md`); 2 unsatisfied are the fv2 chain files.
- `requires_on_main` — 6 NEEDLE_ABSENT, 2 PATH_ABSENT, rest satisfied.

**Producer search — the question that separates a waiting gate from a dead one.** Every `.md` in the
queue, all states, 1430 files (walked in node; no PowerShell `-Include`/`\*` recursion trap).
**Every unsatisfied gate has a live producer.** POS control `premise` present in 698 of 1430; NEG
minted needle → 0. `docs/approvals/` on main holds 2 tracked files (`README.md`,
`watcher-identity-approved-by-marco.md`) — the five gate targets are genuinely absent, not mis-pathed.

Chains traced, all alive: brandtheme s3 (ADMIT) → `sidebarBgHex` → s4 · company-manage s1 (ADMIT) →
`company.manage` → s2 · #1823 (open) → `reporting.team` → ea-s2a → `estimating-analytics` → ea-s2b ·
qpdf-1 (ADMIT) → `ESTIMATE_PREVIEW_MARK_V1` → qpdf-2 · rates-column-edit-ui → `handleUpdateColumn` →
transport-capacity-column-order · fv2 ai-import → ai-digests → output-channels.

`pr-tipid-s3` first read as orphaned — its audit-doc gate traces only to a prompt in `superseded/`.
Reading the prompt refutes that: `waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO`
releases on **a real operator `--apply` run writing a zero-unmatched receipt**, not on any prompt.
An operational gate awaiting an operator, alive by design. Its third gate waits on
`STEP-11C-DONE.md`, which waits on 11c, which waits on Marco's approval file.

**Trunk.** `gh run list --commit <full 40-char SHA> -R <repo>` (full SHA per §9.4; `-R` on every call
per the CWD trap). On `6e63dc72`: **Dependabot Updates = failure (event `dynamic`)**; Deploy, CI,
Tendering Browser Smoke = **success** (event `push`); CodeQL success; Claude Code skipped. Across the
last **6** commits on main, push-event conclusions are **success,success,success** on every one, and
Dependabot attaches to only the newest. NEG control, 40 zeros → 0 runs.

**Lane classification of the open board.** RULE 2 probe pinned to the LIVE tree
`C:\ProjectOperations2\docs\pr-prompts\processed` (never the clone decoy, §9.5): 2121 logs, 869
`pr-*.log` after excluding `rev-*` (review jobs run in both lanes), **newest 2026-09-10T21:29:42Z —
younger than every open PR**, which is the freshness control that separates the live directory from
the corpse. POS `marco.:true` → **629**; NEG minted needle → 0.

| PR | age | state | labels | lane | `classifyPolicyFiles` |
|---|---|---|---|---|---|
| #1852 | 9.0h | CLEAN green | none | **[NO LANE VERDICT — hand-classified]** | MARCO'S (`scripts/pipeline/status-sweep.ps1`) |
| #1850 | 10.3h | CLEAN green | none | watcher: `marco:true` *"outside tests/ or docs/"* | MARCO'S (`scripts/pipeline/triage-holds.ps1`) |
| #1845 | 12.7h | CLEAN green | none | watcher: `marco:true` *"outside tests/ or docs/"* | MARCO'S (`scripts/pipeline/status-sweep.ps1`) |
| #1832 | 22.1h | CLEAN green | none | watcher: `marco:true` *"outside tests/ or docs/"* | MARCO'S (`scripts/pipeline/vm-git-guard.sh`) |
| #1823 | 46.2h | CLEAN green | none | watcher: `marco:true` *"escalates:true — labelled do-not-merge"* | MARCO'S (`permission-registry.ts`) |

All five 15 pass / 0 fail / 0 pending.

**CP-26 verdict token read from column 3 of the job log** (§9.1 — the three-column trap makes a
whole-line grep match every line). NEG control token → 0 in every log.

- #1852 · #1850 · #1845 · #1832 → `PASS - CP-26 approval-receipt [NEVER_ESCALATED] label absent and
  never applied; no approval receipt required.` Label events: **NONE EVER** on all four.
- #1823 → `PASS - CP-26 approval-receipt [RECEIPT_VALID] approved_by=marco
  approved_at=2026-09-09T22:40:06Z`, receipt present in the PR's own diff, label events `labeled
  do-not-merge 2026-09-09T00:06:38Z` → `unlabeled 2026-09-09T22:40:06Z`. The healthy path, and the
  positive control proving the gate CAN fire.

**`triage-holds.ps1` corpus, read from `origin/main`:** its enumeration is
`Get-ChildItem -Path $queueDir -Filter "*-HOLD.md" -File` — depth 1, one suffix. That is #1850's
subject. **Inert today**: `armed = 0`, so no `-ready.md` exists for it to miss.

**Needles spent this run — do not reuse** (§9.6: a control written into a tracked file is burned):
`zzQq04Gate20260910x`, `zzQq04Prod20260910w`, `zzQq04Lane20260910v`, `zzQq04Cp26Needle20260910t`.

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved, staged or deleted. No PR
touched, labelled or merged. No `/sot/` edit. No tracked-file write except this breadcrumb.

One working-copy change, deliberate and left uncommitted for Station 00:
`docs/pipeline/sweep-rotation.json` (`--numstat origin/main` = `2 2`).

Scratch scripts written outside the repo at `C:\po-sup-fix-scripts\` (`gates-04.mjs`,
`gatelive-04.mjs`, `producers-04.mjs`, `trunk-04.mjs`, `lanes-04.mjs`, `verdicts-04.mjs`,
`cp26-04.mjs`, `cp26b-04.mjs`) plus two decoded sweep captures. Nothing in the repo.

## FINDINGS

### F1 — `TRUNK IS RED` in the preflight sweep is a FALSE ALARM. The trunk is green.

Section 1 of `status-sweep.ps1` printed `main CI on 6e63dc72: 4 success / 1 failed <-- TRUNK IS RED`
while section 7 of the same report printed `SAFE TO ACT`. The report contradicts itself.

The single failure is **`Dependabot Updates`, event `dynamic`** — not a push check, not a code path.
Every push-event run is green on `6e63dc72` and on each of the five commits before it (three of
three, six for six). NEG control 40 zeros → 0 runs, so the query is not matching everything.

This matters because PREFLIGHT step 4 tells **every station** to run this sweep and obey it. A run
that believes the line either halts, or opens a fix-lane hunt for a main regression that does not
exist. Its cure is already authored: **open PR #1852, `TRUNK_VERDICT_SCOPED_V1`**, touching exactly
one file, `scripts/pipeline/status-sweep.ps1`, CLEAN, 15/15 green, unlabelled, 9 hours old.

The residual `Dependabot Updates` failure is real but is not a trunk regression and is not this
pipeline's code. It attaches to one commit, not to every commit — it is not chronic on the sample
measured.

**DISPATCHED** — Station 00. Do not open a fix-lane hunt for a main regression; there is none. The
cure is #1852, already open and green. 00's action is to surface it, not to re-diagnose it. (Merging
it is Marco's — see F3.)

### F2 — Gate liveness is CLEAN across 40 HOLDs. The Marco-approval class is parked, and correctly so.

`spent = 0 of 40`, both buckets proved reachable by fixture controls. All three `requires_merged`
gates satisfied. Every unsatisfied `requires_file_on_main` / `requires_on_main` gate has a live
producer in the queue. **No dead gate, and nothing to repair.**

Five gates are the Marco-approval class, none present on main:
`rates-b-slice2-canonical` · `rates-s11c-drop-legacy-tables` · `retire-tenderclientnote-s2` ·
`siteid-notnull-backfill` · `tenant-mt4-s2-ownership-migration`. Two of these prompts **drop database
tables**. Per this sweep's own standing instruction I **reported and repaired nothing** — repairing
the dependency gate on this class silently removes the only protection lint rejects on.

**DEFERRED** — real, not now. These gates are doing their job by staying shut; the file is Marco's to
write and no station may author it. This becomes urgent only if one of the five prompts is observed
in an ADMIT bucket, or if an approval file appears authored by anyone but Marco — either would mean
the protection has been bypassed rather than satisfied.

### F3 — Every open PR routes to Marco, and four of the five repair the pipeline's own instruments.

All five are CLEAN, 15/15 green and unlabelled, aged 9h to 46h. All five hand- or watcher-classify as
**MARCO'S**. Four of them fix the instruments every station is told to trust:

`status-sweep.ps1` (#1852 trunk verdict, #1845 git-process scoping) · `triage-holds.ps1` (#1850
corpus suffixes) · `vm-git-guard.sh` (#1832 self-test).

Because all four touch `scripts/`, `classifyPolicyFiles` refuses them and the `tests-docs` auto-merge
lane can **never** take them, whatever their content. So the pipeline's self-repair work is
structurally confined to the one lane that requires Marco personally — and F1 is a live instance of
the cost: a false alarm is being served to every station's preflight while its one-file fix sits
green and unmergeable nine hours later. The lane starves in a way that compounds, because the
instruments that lie are the instruments used to decide what to do next.

**ESCALATED — a question for Marco, with options. RULE 1 applied.**

> Four green one-file PRs repairing this pipeline's own instruments cannot self-merge, because
> `scripts/` is outside `tests|docs`. Meanwhile one of the defects they fix is actively misreporting
> the trunk to every station. How should instrument-repair PRs reach `main`?

- **(a) COMPLETE AND ADDITIVE — FIRST.** Add a narrow fourth form to the auto-merge policy for a
  named allowlist of pipeline instrument files under `scripts/pipeline/`, gated by a CI check that
  proves the diff touches nothing else — the way CP-24 proves 05's `sot/` lane. Passes both RULE 1
  tests: it fixes the immediate four and every future instrument fix, and it cannot touch product
  code or data entry because the gate is a path boundary enforced in CI, not a judgement.
  **This is the only option that requires a new CI gate, which DOCTRINE §10.1 step 3 demands before
  any new lane outside `tests|docs` — so it is work, not a switch.**
- **(b) Marco merges these four by hand now.** Fixes the immediate half; fails the future half —
  the next instrument fix queues behind the same wall next week.
- **(c) Leave the lane as it is and accept the latency.** Fails the immediate half outright: the
  trunk-red false alarm keeps being served to every preflight until (b) happens anyway.

I have not merged, labelled or touched any of them. RULE 2 binds on the four with `marco:true`
verdicts regardless of their green, unlabelled state.

### F4 — CP-26 is vacuous on four of the five open PRs. Corroboration only; the escalation is already open.

`[NEVER_ESCALATED] label absent and never applied` on #1852, #1850, #1845 and #1832, with **zero
label events ever** on all four — CP-26 is armed by LABELLING, not by the diff, so it offers those
PRs no protection at all. **Three of the four carry a live watcher `marco:true` verdict**, so their
sole remaining Marco-gate is a grep over a gitignored log directory. #1823 is the positive control
and the healthy path: labelled, released by Marco, receipt in diff, `[RECEIPT_VALID]`.

This is the standing escalation
`needs-marco/cp26-passes-vacuously-on-an-unlabelled-destructive-migration-2026-09-05.md` and
DOCTRINE §10.2.1's own correction, reproduced on today's board with a count.

**DEFERRED** — measured corroboration of an open escalation; deliberately **not re-raised** as new.
It becomes urgent if the RULE 2 log probe is ever found mis-pointed at the clone decoy while CP-26
reads `NEVER_ESCALATED` on the same PR: two independent instruments would then both say "fine" about
a PR routed to Marco.

### F5 — The Linux sandbox would not boot, so the device-bridge git guard could not be installed.

Two attempts, byte-identical `RPC error -1` naming an unmounted Plan9 share. Cost this run: nil — no
mount means no VM-side call, so the hazard the guard covers could not arise, and Desktop Commander
carried the whole run. The exposure is a future run that is *partly* degraded: one that loses Desktop
Commander but keeps the mount would have no guard installed and STATION-CAPABILITIES §3's blind-run
COLLECT path is exactly where a `git`-against-the-mount mistake becomes a frozen board.

Note the coincidence worth not over-reading: #1832, open and green, is the `vm-git-guard.sh`
self-test fix. It is a fix to the guard's **self-test**, not to the mount, and would not have made
this install succeed.

**DISPATCHED** — Station 00. The subject is the Cowork session's own mount, which is **outside the
repo**, so per DOCTRINE it needs a `needs-marco/` file or it is escalated to nobody; 04 is read-only
and may not write one. If 00 sees this in a second consecutive 04 breadcrumb, please open that file
rather than re-collecting the observation.

### F6 — `triage-holds.ps1`'s corpus is one suffix at depth 1. Real, currently inert, already fixed in an open PR.

Confirmed from `origin/main`: `Get-ChildItem -Path $queueDir -Filter "*-HOLD.md" -File`. Any
`-ready.md` or other suffix is invisible to the triage. **Today it costs nothing — `armed = 0`, so
the set it cannot see is empty.** That is a property of this hour, not of the script.

**DISPATCHED** — Station 00, folded into F3: the cure is #1850, green and waiting on the same wall.
Recorded here so the next run does not re-derive it, and so that a run meeting a non-zero `armed`
count knows the triage is under-reporting before it trusts a bucket.

## WHAT I DID NOT DO

- **Repaired no gate**, deliberately. The sweep's own instruction is to report and repair nothing
  where the prompt is destructive or its other gates are satisfied; and 04 is read-only on the board
  under the authority matrix, which gives it *Mutate the board: NO*. Nothing needed repair in any
  case — F2.
- **Armed, disarmed, renamed, moved and deleted nothing.** Arming is 00's, on Marco's authority.
- **Merged, labelled and re-ran nothing on the five open PRs**, including the four that are green,
  unlabelled and would look mergeable. RULE 2 binds on the four watcher verdicts; #1852 is second
  lane and hand-classified MARCO'S.
- **Did not commit `sweep-rotation.json`**, though I advanced it. 04 may not commit to the shared
  dev tree; the file is named above for 00.
- **Did not run Part 1's GitHub reconciliation or Part 2's live-site visual pass.** One named sweep
  per run, covered completely, is the standing rule — a shallow pass over everything is why findings
  rot. Rotation advanced so `instrument-honesty` follows.
- **Did not re-raise** the clone `dirty=2` false positive or the CP-26 vacuity as new findings; both
  are landed or open already.
- **Did not diagnose the `Dependabot Updates` failure from its diff or its absence.** I measured its
  conclusion and its event type and stopped there; naming its cause would need the job log, which is
  outside this sweep's scope.
- **Did not touch Azure, Entra or SharePoint**, and ran no `git` against the mount.

---

*This breadcrumb is UNTRACKED until a board PR commits it — Station 00 sweeps it up. Written to the
dev tree at `docs/pr-prompts/`, never a disposable worktree and never one of the five gitignored
`docs/qa/` sinks. All facts stamped against `origin/main = 6e63dc72`; a claim that outlives its SHA
is a lead, not a finding.*
