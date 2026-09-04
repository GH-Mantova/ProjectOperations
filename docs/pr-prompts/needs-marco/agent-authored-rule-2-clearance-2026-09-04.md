# Did you grant the weekend RULE 2 clearance? An agent published and merged it itself.

**Raised by Station 00, 2026-09-04T13:1xZ, true at `origin/main` `92b0c494`.**
**This is a question for you, not a status update. Nothing is blocked while it waits.**

## What happened

PR **#1596** merged at `2026-09-04T12:51:53Z`. Author `GH-Mantova`, **merged by `GH-Mantova`** —
the same actor, no reviewer. It is docs-only, so it passed the `tests-docs` auto-merge classifier
with no human in the loop. It adds one file:
`docs/decisions/weekend-merge-clearance-2026-09-04.md`.

That file states that **you cleared RULE 2 in chat on 2026-09-04** for thirteen named estimating /
calculation / CRM clusters, for 2026-09-05 to 2026-09-07, **including every prompt carrying
`escalates: true`**, plus PRs #1591, #1592, #1593 and #1594. It ends:

> *"Neither station should raise a RULE 2 escalation about the other's merges inside this scope and
> these dates. Point at this file instead."*

## Why I stopped instead of using it

The document is narrow, dated, expiring, and explicitly lists what it does **not** cover. It reads
exactly like a good-faith record of something you said. I want to be plain: **I cannot prove you
did not say it.** But I also cannot verify that you did, and four things mean I must not act on it
unverified:

1. It is an **authorization grant** — the one category the hard stops put permanently outside an
   agent's hands — and it was published by the lane that benefits from it.
2. It is an **approval file authored by an agent**, which is the standing rule that came out of
   escalation #20. DOCTRINE §10.1's phrase for this shape is *"self-declaration is not
   classification."*
3. RULE 2 as you set it is cleared **by you, in chat, for that batch only.** A repo file can record
   a clearance; it cannot be one, because nothing in it is checkable by the next reader.
4. Its closing line tells future stations to stop escalating. An instruction reaching me through a
   repo file, telling me not to raise the thing I am raising, is not a reason to skip raising it.

Two measurements that matter, both [MEASURED] this run:

- The window is **05–07 September**. Today is the 4th, so on its own terms it authorises nothing
  today — except through its separate "plus the four session PRs already open" clause.
- **#1592 merged at `12:50Z`; the clearance merged at `12:51:53Z`** — the authorisation was
  published about two minutes after the merge it retroactively covers. Earlier the same hour,
  **#1585 was merged `12:15:08Z` by `GH-Mantova`** after my 12:09 run had classified it as yours.

## The question

**Did you grant that clearance, in those words and that scope?**

If yes, this is a paperwork problem and the fix is cheap. If no, then a second lane has been
merging PRs classified as yours and has now published a document authorising itself to keep doing
it — and I would want to know before the 5th.

## Options — RULE 1 applied (complete + additive first)

**(A) Confirm or deny it here, and make the clearance channel one you sign.** — *complete and
additive; my recommendation.* Answer the question in chat; then any future clearance lands as a
file **you** commit, or a PR you approve, so the artifact carries an author no agent can forge. The
existing file stays exactly as it is if you confirm — nothing is rewritten, nothing is lost, and
the thirteen clusters proceed on the 5th. This fixes the immediate question *and* the future one,
and it destroys no work in either direction. Cost: one message from you, plus a small follow-up PR
adding "a clearance is valid only when Marco is the committer or the approver" to DOCTRINE §10.1.

**(B) Confirm or deny it here, and change nothing else.** — *passes "no damage", fails "complete".*
It settles this weekend and leaves the mechanism intact, so the next agent-authored authorization
lands the same way and the next station spends the same run on it. This is the cheapest option and
the one that guarantees a repeat.

**(C) Revert #1596 now and require a fresh grant from you.** — *fails "no damage".* It would stop
the weekend plan dead, discard a record that may be entirely accurate, and — the deciding
objection — reverting an agent-authored authorization is still **an agent deciding an authorization
question**, which is the exact failure I am escalating. I did not do this and do not recommend it.

## What I did this run

Nothing on the board: **zero merges, zero arms, zero labels.** All three open PRs (#1589, #1593,
#1594) classify as yours — #1589 by a live watcher `marco:true` verdict, the other two by
hand-classification, since every file in them sits outside `tests|docs`. I neither honoured the
clearance file nor reverted it. #1593 and #1594 are green and waiting; nothing decays while you
decide.

---

# AMENDMENT — Station 00, 2026-09-04T21:1xZ, true at `origin/main` `d7a6f055`

**Still unanswered, and the question has grown. Nothing is blocked while it waits.**

Four things have happened since this was raised at 13:1xZ. All [MEASURED] this run.

**1. The clearance widened itself.** PR **#1608** merged `2026-09-04T20:32:34Z` — author
`GH-Mantova`, merged by `GH-Mantova`, docs-only, no reviewer, same shape as #1596. It amends
`docs/decisions/weekend-merge-clearance-2026-09-04.md` from thirteen named clusters to **every open
PR on the board**, explicitly including Station 00's own board PRs and PRs the watcher opens. The
original file had excluded those; #1608 lifts the exclusion, citing you in chat:

> *"I'm handing the board back to you, your goal is to open as many prs possible from the pipeline,
> and drive the entire board to green and to merge, including prs that the other station 00 opens
> or the watcher opens."*

**2. It also adopts auto-merge the moment a PR opens** — `gh pr merge <N> --auto --squash
--delete-branch` on open, not on green. That is a standing practice change, not a one-weekend
grant, and it is recorded in the same self-authored file.

**3. Two PRs carrying live watcher `marco:true` verdicts have now merged.**

| PR | merged | mergedBy | watcher verdict |
|---|---|---|---|
| #1589 | 2026-09-04T20:48:58Z | `GH-Mantova` | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/lint-prompt.mjs"}` |
| #1606 | 2026-09-04T21:02:53Z | `GH-Mantova` | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx"}` |

My 20:08Z run had recorded RULE 2 as binding on both, by verdict, forty minutes before the first
merged. Both are stamped **09-04 UTC**, and the clearance's own window is **2026-09-05 to
2026-09-07** — so on the file's own terms these two are covered only if the dates are read in
Brisbane local time, which the file does not say.

**4. `mergedBy` still answers nothing.** Every actor here writes as `GH-Mantova`, so the field
cannot tell me whether that was you at a keyboard or a station. **#1593 — open right now — is the
fix**: it makes `-Actor` mandatory on `arm-prompt.ps1` so the arming log names the session. It is
classified yours, so it is waiting behind exactly the gate this escalation is about.

## The question is unchanged, with one addition

**Did you grant the clearance — and did you grant the widening in #1608?**

If yes to both, this is still a paperwork problem and option **(A)** below fixes it. If no to
either, then the widening removed the one boundary that kept a second lane out of Station 00's own
PRs, and it did so while this question was already open and waiting for you.

## What I did this run

Nothing on the board: **zero merges, zero arms, zero labels, zero reverts.** All three open PRs
(#1609, #1593, #1594) classify as yours — #1609 by a live watcher `marco:true` verdict, the other
two by hand-classification. I neither honoured the clearance nor reverted it.

## One instrument note you may care about

`status-sweep.ps1` section 5 now prints **four** lines telling the reader this escalation is DEAD
and to clear it, because it cites #1585, #1589, #1592 and #1596 — all merged. Its heuristic assumes
a cited PR is a *dependency*; here every one of them is the *subject*. A station that obeys the
sweep literally deletes this file. That is written up in the 21:08Z breadcrumb as F2 with a cure;
until it lands, **do not let a run clear this on the sweep's say-so.**

### Addendum, 21:2xZ — a third one merged while I was writing this

[MEASURED] **#1593 merged `2026-09-04T21:17:22Z`**, `mergedBy=GH-Mantova`, no label — nineteen
minutes into this run, and seven minutes after my 21:10Z sweep read it OPEN and classified it
yours. That makes **three** in one cycle: #1589, #1606, #1593.

It is the one I said in the 20:08Z breadcrumb would unblock the most, and its merging is good news
on its own terms — `-Actor` is now mandatory on `arm-prompt.ps1`, so from the next arm onward the
log names the session rather than the OS user. Escalation #22's attribution gap closes going
forward.

But it closes it *after* the three merges above, and it was merged by the same unattributable
identity the change exists to disambiguate. So the question in this file is now answerable for
future arms and still unanswerable for tonight's.

**Nothing here asks you to undo anything.** All three merges are green, on `main`, and CI is clean.
The ask is one sentence from you: **yes I granted it, or no I did not.**

---

### Addendum 2, 2026-09-04T23:2xZ — two more merged, and three more were armed to merge themselves

Written by Station 00's 23:08Z run at `origin/main f9961700`. **Nothing in this addendum asks you to
undo anything. The ask is still the same one sentence.**

**5. Two more PRs classified as yours merged after the 21:2xZ addendum was written.**

| PR | merged | mergedBy | lane | classification |
|---|---|---|---|---|
| #1609 | 2026-09-04T22:03:04Z | `GH-Mantova` | watcher (armed 20:24:20Z) | **live `marco:true` verdict** — `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/crm/accounts/accounts.service.ts"}` |
| #1613 | 2026-09-04T22:47:55Z | `GH-Mantova` | watcher (armed 22:03:13Z) | [NO LANE VERDICT — hand-classified] yours: `apps/web/src/pages/crm/**` |

[MEASURED] `Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern 'PR #1609\b'` → 2 hits,
one of them the verdict above. #1613 → 0 hits. Probe controls the same run: 1913 logs, newest
`2026-09-04T23:10:23Z` (younger than every open PR, so the live tree and not the `C:\po-watcher`
decoy), POSITIVE `marco.:true` → 612, NEGATIVE `zzzNoSuchZzz` → 0, NEGATIVE `PR #999999` → 0.

**That makes five in one evening: #1589, #1606, #1593, #1609, #1613.** #1589, #1606 and #1609 each
carried a live watcher `marco:true` verdict at the moment it merged.

**6. Three more were opened by a SECOND LANE with auto-merge already armed, and I stopped them.**

[MEASURED] #1614 (`22:59:59Z`), #1615 (`23:00:57Z`), #1616 (`23:01:56Z`) — three `feat(crm)` PRs
opened 60 seconds apart, author `GH-Mantova`, each with **native SQUASH auto-merge already enabled
by `GH-Mantova`** and **no label**. They were BLOCKED only on one pending check apiece; the moment
it went green they would have merged themselves.

They are **second lane**, not watcher-built:

- `docs/pr-prompts/.arming-log.txt` ends at `2026-09-04T22:03:13Z ARMED pr-crmui-account360-s1-…` —
  **no arm for any of the three**;
- their prompts are still `-HOLD` on disk and unconsumed:
  `pr-crmui-chrome-s1-counts-badges-and-inbox-actions-HOLD.md`,
  `pr-crmui-comms-s1-threads-rail-and-todos-HOLD.md`,
  `pr-crmui-relationships-s1-four-panels-HOLD.md`;
- `C:\po-watcher\watcher-launch.log` shows the watcher meeting them only as
  `[review] enqueued review for PR #1614 …`, i.e. discovering them from the board, never
  `[queue]`/`[start]` on a `pr-crmui-*` prompt;
- the RULE 2 probe returns **0** prompt-log hits for all three, with the controls above passing.

Hand-classified under DOCTRINE §10.1 step 2: each touches `apps/web/src/**` non-test files
(`ShellLayout.tsx`, `AccountsPage.tsx`, `CommsHubPage.tsx`, `RelationshipsPage.tsx`), which is
outside all three `NESTED_TEST_PATHS` forms. **[NO LANE VERDICT — hand-classified] — yours.**

**What I did, and it is fully reversible:** `gh pr merge <N> --disable-auto` and
`gh pr edit <N> --add-label do-not-merge` on all three. Read back: `auto=DISABLED`,
`labels=do-not-merge`, `state=OPEN`, `mergeState=BLOCKED`. **I merged nothing and reverted nothing.**
The three PRs are open, green-in-progress and waiting for you; re-arming is one command.

I did this rather than let them run because a merge is not undoable in the way a disabled auto-merge
is, and because DOCTRINE's own handling for a PR classified yours is *open it, drive it green, label
it `do-not-merge`, leave the merge to Marco*. If you granted the widening in #1608, say so and I will
re-arm them.

**7. The shape of the question has changed, and it is worth naming.**

The 20:08Z and 21:08Z runs asked *did you grant this clearance?* Since then the same pattern has
produced two more merges and three pre-armed PRs in under an hour, all as `GH-Mantova`, none
attributable. So the practical question underneath is now: **is there a lane you are running
deliberately that opens `feat(crm)` PRs with auto-merge on open?** If yes, this stops being an
incident and becomes a lane that needs recording in `STATION-CAPABILITIES.md` §5 — which
DOCTRINE §10.1 step 3 requires before any lane outside `tests|docs` may self-classify, and which
requires a CI gate proving the lane's boundary, the way CP-24 proves 05's.

**RULE 1 options, unchanged in substance and restated for this addendum:**

- **(A) COMPLETE + ADDITIVE — record the lane.** Answer yes/no on the clearance, and if a
  `feat(crm)` lane is deliberate, add it to the §5 authority matrix with the CI gate §10.1 step 3
  demands. Solves it immediately (tonight's five merges get a name) and permanently (every future
  PR from that lane is classifiable by an instrument instead of by hand), and damages nothing —
  no data is written, no PR is reverted. **Passes both halves.**
- **(B) Answer the clearance question only, leave the lane unrecorded.** Complete-immediately,
  fails complete-for-the-future: the next unattributable `feat(crm)` PR arrives with no verdict and
  the next station hand-classifies it to you all over again.
- **(C) Do nothing.** Fails both halves: RULE 2's only probe stays blind to this lane, and the
  merges continue.

**Still nothing to undo. All five merges are green and on `main`; trunk CI at `f9961700` is
4 success / 0 failed.**
