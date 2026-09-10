# Station 00 — supervisor — 2026-09-08 07:00Z

Supervised cloud lane. Marco present in chat throughout; every merge below was cleared by him by
name before it happened.

## GROUND

SIGHTED (Desktop Commander answered; `node scripts/pipeline/lint-prompt.mjs` and `git` both ran).
Read in the DEV TREE `C:\ProjectOperations2` unless stated. `origin/main` moved
`516debef` → `c8fe314c` (#1811) → `4252db5b` (#1810) → `27cf57c3` (#1814) across the run.
Watcher node pid **31660**, single instance, alive. Sweep verdict at 04:57:18Z: SAFE TO ACT.

## WHAT I MEASURED

**The board, at the start.** Four open PRs, all four hand-classified MARCO'S. `watcher-launch.log`
carried no `opened PR #<n>` line for #1805, #1809, #1810 or #1811 (POS control: 28 such lines exist,
newest `#1797` 09-07T23:37Z; fresh NEG needle 0), so all four were second-lane. RULE 2 probe on
`C:\ProjectOperations2\docs\pr-prompts\processed` — 2074 logs, newest 04:49:47Z, POS `marco.:true`
**620**, NEG **0** — returned zero merge-result lines for all four.

**Every red on #1809, #1810 and #1811 was one cause.** Pulled all six failing job logs:
`FAIL - CP-26 approval-receipt [LABEL_PRESENT]` plus its twin assertion inside `PR gates — diff
checks`. Every other CP printed PASS or SKIP.

**The queue.** `triage-holds.ps1`, exit 0, both instrument controls PASS: 38 HOLDs at depth 1 —
1 spent, 11 gates-satisfied, 26 still gated, 0 unreadable, 0 spent-behind-a-reject. Three of the
eleven were already consumed by #1809, #1810 and #1811 and still lint-ADMIT.

**Chain gaps.** Checked every prompt name referenced by all 43 plan documents and `BACKLOG.yaml`
against all 3,199 distinct prompt stems on disk: two misses, neither real work. By chain,
`pr-brandtheme` S3–S6 existed nowhere (POS control: 2 brandtheme files found; NEG 0), and so did
the token foundation that SECTION 7 of the theme plan names as the prerequisite for S3 and S5 — no
prompt anywhere is scoped to `tokens.css`.

**The lane.** `tests-docs policy satisfied — enabling auto-merge` — the line the lane logs when it
ACTS — appears **4 times in the whole launch log**, newest `2026-08-24T02:41:33Z`. Controls:
`policy=tests-docs, waiting` **172**, `merged at` **17**, fresh NEG needle **0**. Per-PR, #1563,
#1580, #1583, #1797 and #1814 each have **0** such lines; POS control #1301 has 1.

## WHAT CHANGED

- **#1811 merged** `c8fe314c` 05:27:59Z, **#1810 merged** `4252db5b` 06:06:24Z, **#1814 merged**
  `27cf57c3` 06:59:36Z — each through `Assert-SmokedOrEscalate` then `Merge-Pr`, each read back.
- **Three CP-26 receipts authored** by this lane on Marco's instruction under his 2026-09-07 ruling
  (#1736), each recording `approved_by: marco` with the lane named as author: `8562b039` (1811),
  `94dfad89` (1809), `5f81a954` (1810). Marco stripped all three `do-not-merge` labels himself at
  05:15:03–05:15:37Z; no agent touched a label.
- **#1817 opened** — five prompts staged (`pr-brandtheme-s0`, `s3`, `s4`, `s5`, `s6`) and two
  consumed HOLDs retired to `superseded/` with `git mv`.
- **`7a8d06a7`** corrected the 1810 receipt before it merged, removing a false claim this lane had
  written into it.

## FINDINGS

**F1 — The tests-docs lane's merge action has not fired since 2026-08-24, and the instrument that
says otherwise is a different instrument.** Every recent `merged at … (policy: tests-docs)` is the
loop OBSERVING a merge another actor performed. #1797 carries a `merge-approvals` file in its own
diff, marking it as the cloud lane's merge. ⚠️ This bears on escalation #21, whose "deadlocked"
headline was REFUTED on 2026-09-04 citing #1563 — which has no action line either. **This is not a
re-raise of #21**; it is one new probe, and the ruling is Marco's.
**ESCALATED** → `docs/pr-prompts/needs-marco/tests-docs-lane-merge-action-has-not-fired-since-2026-08-24.md`
(that folder is gitignored — `git check-ignore -v` names `.gitignore:82`, NEG control exit 1 — so
this breadcrumb is the tracked copy of the finding), with RULE 1 options and a falsifying probe.

**F2 — A watcher-opened docs PR manufactures a false `marco:true` at 90 minutes.** #1814 sat green
with `verdictApproves` false because `pr-1814-review.md` was absent from all three search homes,
and the job that writes it was queued `depth: 1, busy` behind the same worker. `MERGE_TIMEOUT_MS`
is 90 min, so it would have exited at ~07:18:39Z blaming Marco. **ACTIONED** — merged #1814 at
06:59:36Z on Marco's instruction; the wait loop exited within 25 seconds and the worker freed.
The general defect is folded into F1's escalation, not raised separately.

**F3 — The module vocabulary has no rule for `apps/web/src/{styles,lib,components}`, and it fails
open.** A web slice touching only those paths derives nothing and REJECTs `MODULE_AMBIGUOUS`. When
`scope` resolves to NO module, any vocabulary value is accepted — `settings`, `docs`, `board`, `ci`
and `admin` all returned ADMIT on the same file — so `MODULE_DECLARED_OUTSIDE_SCOPE` never fires on
an empty derived set. **DEFERRED** — recorded in each of the three affected prompts in #1817 with
the reasoning; no fix staged, because the honest fix is a `lint-prompt.mjs` change and the
vocabulary's derive-don't-hand-list design is deliberate.

**F4 — `lint-prompt.mjs` reports the wrong line number for a human gate.** On
`pr-devtree-sync-ff-only-guard-HOLD.md` it says `line 45 contains 'Arm ONLY'`; the quoted text is at
line **67**. The quotation is correct, so the diagnosis is sound and only the number is wrong.
**DEFERRED** — cosmetic; recorded in #1817's body.

**F5 — Retiring a consumed prompt can break a source-of-truth reference.** `check-sot-refs` failed
#1817's first push: `sot/01-charter-and-architecture.md:457` cites
`pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md`. It is the only `docs/pr-prompts` reference in
`sot/01`, and neither other retired prompt is referenced under `sot/` (POS: `sot/06` has 10; NEG 0).
**DISPATCHED → 05** — that line needs repointing AND is stale in a second way, describing the NAV-5
reconcile as pending when it shipped in #1810. #1817 now retires two, not three.

**F6 — Two of my own instruments lied and were caught by their controls.** `Set-Content -Encoding
UTF8` wrote a BOM, so a validation pass read its own corruption as `NO_FRONT_MATTER` on all five
files. And a RULE 4 detector run `-CaseSensitive` on all three markers returned 0 where the linter
found one — only the CAPS marker is case-sensitive; the marker read "Arm only". **ACTIONED** — both
re-run with passing controls (POS 1 / NEG 0) before anything was committed.

## WHAT I DID NOT DO

- **Armed nothing.** RULE 4: `pr-stationcaps-blind-run-names-one-mount-ready.md` held the slot from
  05:45:21Z, armed by `station-00.sched0509`, not by me. Marco chose "wait, then arm one", and
  named `pr-brandtheme-s1-apply-the-saved-scheme`.
- **Did not mass-arm the eight armable HOLDs** Marco initially asked for. RULE 4 is one at a time,
  none of the eight is `tests/`-or-`docs/`-only so all eight would route to him, and the last
  mass-arm of that size killed the queue for 13 hours (LL-38). Put to him; he agreed.
- **Did not stage a prompt for the `operations/assets-equipment` missing leading slash.** Marco
  approved staging it; then I read the four lines above it. `ShellLayout.tsx:347-350` says the
  parent is a collapse toggle, not a route, and `:490` names the relative form as the toggle key.
  It is a sentinel, deliberate since 2026-07-17. The claim had travelled through five layers — a
  prompt, an 05 breadcrumb, a PR body, a watcher verdict and this lane — with nobody reading the
  surrounding lines. Recorded in the 1810 receipt; no prompt staged on a false premise.
- **Did not strip a single label.** All three removals were Marco's, at 05:15Z, by hand.
- **Did not touch `sot/`, `.arming-log.txt`, or the watcher clone.** Both disposable worktrees were
  torn down; `git worktree list` shows the dev tree and `C:/po-vg` only.
