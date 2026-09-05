# Station 00 — Supervisor | 2026-09-05T11:55Z–2026-09-05T12:0xZ

**Addendum to `00-00-supervisor-2026-09-05-1108-trunk-went-red-on-a-webkit-flake-and-a-lane-signature-died-to-its-control.md`**, same station, same run.
It exists because that breadcrumb's HANDOVER says *"the board is **empty** — 0 open PRs, 0 armed …
that is starvation, not blockage"*, and **that stopped being true nine minutes before it merged.**

## GROUND

```
UTC            2026-09-05T11:55:00Z
origin/main    df030fe2            (my own #1661, merged 11:51:39Z)
dev tree       main @ df030fe2     C:\ProjectOperations2   (0 0, --numstat EMPTY, --cached EMPTY)
doc version    1
bootstrap      1
```

SIGHTED throughout, shell PID 26640. Doc version and bootstrap AGREE.

## WHAT I MEASURED

**[MEASURED] A destructive-migration PR opened while my collect PR was in CI.**
`#1662` `feat(scope)!: retire the legacy plant-days path and drop its five columns`, branch
`pr-plantdays-retire-and-drop`, created **11:45:57Z**. My 11:08Z breadcrumb recorded `OPEN_PRS=0` at
11:45Z and merged at 11:51:39Z. **The claim was true when measured and false six minutes later** —
`[LIVE]` expiry for the second time in one run, and this one landed inside a tracked document.

Its own body states the risk correctly and without hedging:

> **🔴 This PR is irreversible.** A `git revert` of this PR restores the five columns **EMPTY**.
> Whatever they held is gone permanently.

Six files. The one that decides the classification:
`apps/api/prisma/migrations/20260905010000_drop_legacy_plant_days/migration.sql`. `GATE-ALLOW:
migrations` is present and **bare at column 0**, which is what CP-11 requires.

**[MEASURED] It is SECOND LANE, and the branch name is not what proved it.**
The branch reads exactly like a queue prompt, which DOCTRINE §10.1 records as proving nothing —
`#1633`'s did too and was never armed. Four independent probes, each with a control where one exists:

| probe | result |
|---|---|
| `pr-plantdays-retire-and-drop-HOLD.md` on `origin/main` **and** on disk | **still `-HOLD.md`** — never renamed to `-ready.md` |
| `.arming-log.txt` | newest row **2026-09-04T22:03:13Z** — no arm for this prompt, and none at all for 13 h |
| `docs/pr-prompts/processed/*plantdays*` | **0** · POSITIVE control `*crmui-account360*` → **2** |
| `C:\po-watcher\watcher-launch.log` | `[review] enqueued review for PR #1662` at 11:49:27Z **only** — the watcher never built it |

RULE 2: `PR #1662` in `processed\pr-*.log` → **0**; POSITIVE control `PR #600` → **1**.
**`[NO LANE VERDICT — hand-classified]`.**

The available reading — *"branch named like a prompt, so the watcher built it, so its verdict will
appear"* — is wrong in the dangerous direction, because a verdict that never comes is indistinguishable
from one that has not come **yet**, and the newest processed log (11:27:07Z) is **older** than the PR
(11:45:57Z), so waiting for one looks reasonable indefinitely.

**[MEASURED] The hand-classification is not close.** `classifyPolicyFiles` refuses any path matching
`(^|/)migrations/` before it examines anything else, and this PR carries one; the rest is
`apps/api/**`, far outside `tests|docs`. **⇒ MARCO'S.** §10.1 step 3's station-lane exception
excludes it in its own words — *"Migrations are untouched … no station lane covers them"* — and
DOCTRINE §8.3 and §5.4 reach the same answer independently.

## WHAT CHANGED

1. **`needs-marco/pr-1662-destructive-migration-open-on-the-board-2026-09-05.md` written** — the full
   hand-over, with the four lane probes and their controls, and RULE 1 options for the one gap it
   exposes. That directory is gitignored (`.gitignore:76-83`), so it is **also stated in full below**,
   in a tracked file.
2. **This breadcrumb**, written inside this PR's own worktree (cure 1).

**Not changed — and each of these is a deliberate refusal, not an omission:** `#1662` is untouched.
No label applied. No auto-merge armed. No branch update forced. Nothing merged.

## FINDINGS

### F1 — `#1662` is Marco's, and its lack of a `do-not-merge` label is not a clearance

**DISPOSITION: ESCALATED.** Written to
`needs-marco/pr-1662-destructive-migration-open-on-the-board-2026-09-05.md`.

Nothing about the *design* is escalated — Marco ruled on it twice and the PR body records it. What
is escalated is (a) the merge itself, because the PR body names a row-count gate it calls *"the only
thing standing between this PR and irreversible loss of pricing data"*, and evaluating that gate is a
production-data judgement (§5.2) and not mine; and (b) the structural gap in F2.

🔴 **Standing instruction to every later run: do not merge `#1662`, and do not read its empty label
set as a release.** No label was ever applied because the watcher labels only the `escalates: true`
prompts **it** builds, and this PR did not come through the watcher.

**I deliberately did not apply `do-not-merge` myself.** Marco's instruction of 2026-09-04/05, quoted
in DOCTRINE §10.2.1, was to take the labels off and keep the board moving; adding a fresh one is me
undoing that by hand, and only he can remove it again. The stop is this breadcrumb and the
escalation file, not a label.

### F2 — Nothing gates a second-lane migration PR. The only thing that stopped this one was a procedure

CP-26 proves a **released** PR carries a receipt. CP-11 proves a migration PR **declares** itself
with `GATE-ALLOW` — `#1662` declares correctly, and declaring is not permission. The watcher's
`do-not-merge` labelling reaches only prompts the watcher builds. `classifyPolicyFiles` is a
**function the merging agent chooses to call**, not a check that runs.

So a PR that drops five columns can arrive on this board **green, unlabelled, with a valid gate
marker and no watcher verdict** — and every automatic gate is satisfied. The one thing between it
and a merge is a station correctly performing §10.1's hand-classification, every time, from memory.

**DISPOSITION: ESCALATED** (same file), because the complete fix is a **new required CI check**, and
adding one is Marco's call. RULE 1, complete-and-additive first:

- **(a)** a check that fails any PR whose diff contains `(^|/)migrations/` unless a
  `docs/decisions/merge-approvals/<N>.md` receipt signed by Marco is present — the same shape as
  CP-26, which already exists and already works. **Complete:** it stops this PR and every future
  second-lane migration, whatever lane opens it, without depending on anyone remembering §10.1.
  **Additive:** a new required check removes access from nobody, changes no schema, touches no write
  path. **Both halves pass.**
- **(b)** have some actor apply `do-not-merge` to migration PRs on arrival. **Fails the future half**
  — it needs an actor that notices, which is precisely what did not happen here.
- **(c)** leave it to the hand-classification procedure. **Fails the immediate half** — that is the
  status quo, and it is one forgetful run away from an irreversible merge.

### F3 — A `[LIVE]` claim expired inside a document I had already merged

My 11:08Z breadcrumb's HANDOVER reads *"the board is **empty** … that is starvation, not blockage"*
and names it *"the single most important thing about the board right now."* Measured at 11:45Z it
was true. `#1662` opened at 11:45:57Z; the breadcrumb merged at 11:51:39Z. **A tracked, timestamped,
SHA-stamped artefact reached `main` carrying a headline that was already false.**

This is not a mistake in the measurement and there was no way to prevent it by measuring harder —
DOCTRINE §7's `[LIVE]` rule says a reading is *"true when measured, not true now"*, and a **report**
is a reading that cannot be re-taken after it is written. Twice in one run: `#1659` opened 47 seconds
after a sweep declared the board quiet, and now this.

**DISPOSITION: ACTIONED — by this addendum, which is the mechanism that exists for it.** The
1108 breadcrumb is left standing, uncorrected, with this against it, so the claim and its expiry are
both on the record. What is worth carrying forward is narrower than "re-measure more": **a
HANDOVER sentence that names a board *state* has a shelf life measured in minutes, and the fix is to
write handovers that name a *decision procedure* rather than a state.** F2 of the 1108 breadcrumb
does this correctly — it hands over a replacement arming trigger, which does not rot. Its HANDOVER
line about the empty board does not, and rotted in six minutes.

## WHAT I DID NOT DO

- **I did not merge `#1662`, did not label it, did not arm auto-merge on it, and did not update its
  branch.** It was `BEHIND` with `tendering-e2e` pending when I handed it over; `PR_WATCHER_AUTO_UPDATE`
  is `"true"` so the watcher will rebase it on its own timer, and forcing an update-branch mid-run
  would have cancelled the in-flight run for nothing — the measured churn already dispatched to 03.
- **I did not evaluate its row-count gate.** That is production data (§5.2).
- **I did not amend the 11:08Z breadcrumb.** It is on `main`; rewriting a merged report to look
  correct is worse than leaving it with an addendum against it.
- **I did not arm anything, touch `/sot/`, touch Azure / Entra / SharePoint, remove any label, or
  run a `git` write in `C:\po-watcher\ProjectOperations`.**

## HANDOVER

- **Marco — one new escalation, and it has a clock on it.** `#1662` is green-ish, unlabelled and
  irreversible. Nothing automatic will stop it. Two things: merge it yourself when its row-count gate
  satisfies you, and rule on **F2 (a)** — a required check that gates any `migrations/` diff behind a
  signed receipt, which is the only option that does not depend on every future run remembering §10.1.
- **The next 00 run:** `#1662` may still be open. **It is Marco's.** Re-verify with the four probes in
  the table above rather than trusting this sentence, and do not read an empty label set as a release.
  The arming trigger to use is F2 of the 11:08Z breadcrumb, not the receipt proxy.
