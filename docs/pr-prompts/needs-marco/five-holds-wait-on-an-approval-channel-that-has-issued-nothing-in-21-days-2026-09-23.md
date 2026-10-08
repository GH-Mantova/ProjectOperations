# Five HOLDs wait on `docs/approvals/`, which has issued nothing in 21 days

**Raised by:** Station 00, scheduled run 2026-09-23T14:33Z, collecting Station 04's 14:10Z
gate-liveness sweep
**True at:** `origin/main` `7207606e`
**Breadcrumbs:** `docs/pr-prompts/00-04-scanner-2026-09-23-1410-gate-liveness-five-holds-wait-on-an-approval-channel-that-has-not-issued-in-twenty-one-days.md`
(finding F2, MEASURED) · `docs/pr-prompts/00-00-supervisor-2026-09-23-1435-addendum-…md` (C2)

## The question

**Do you still want these five slices?** Not *please approve them* — that is a separate decision per
slice and it stays yours either way. The question is whether the class is still wanted **at all this
quarter**, because if some of it is not, retiring those prompts permanently removes them from every
future sweep instead of having four sweeps a day re-derive the same parked state.

## Why it is being asked now

[MEASURED] 2026-09-23 by Station 04 at `4421531f`, re-measured by Station 00 at `7207606e`:
`docs/approvals/` on `origin/main` holds exactly **two** files — `README.md` and
`watcher-identity-approved-by-marco.md` — and its newest commit is **2026-09-02** (`#1502`).
**No approval artifact has been issued in 21 days.**

Five of the fourteen `-HOLD.md` prompts at depth 1 each carry a
`requires_file_on_main: docs/approvals/<slug>-approved-by-marco.md` gate that **only you can
satisfy**:

| prompt | what its own front matter says it does |
|---|---|
| `pr-rates-s11c-drop-legacy-tables` | **DROPS TABLES.** `rollback_strategy: PERMANENT / NOT auto-revertable once merged` |
| `pr-tenant-mt4-s2-ownership-migration` | **writes PRODUCTION DATA** |
| `pr-524-rates-b-slice2-canonical` | an irreversible table drop (DOCTRINE §9.5 names it as one of two) |
| `pr-siteid-notnull-backfill` | a backfill; on the standing never-arm list, Marco-run |
| `pr-retire-tenderclientnote-s2` | a retirement slice — ⚠️ `[CANNOT MEASURE]` its blast radius from this run; read its `rollback_strategy` before deciding |

A **sixth** prompt is transitively behind the same wall:
`pr-tipid-s3-retire-the-name-guard-for-an-id-check-HOLD.md`'s third gate needs
`docs/data-model/rates-migration/STEP-11C-DONE.md :: ESTIMATE_WASTE_RATES_DROPPED`, which is
`pr-rates-s11c`'s own `done_when` artifact. **So the s11c decision moves two prompts, not one.**

That is **36% of the parked board held by one artifact class**, and it is the largest single block
on a board that is otherwise empty: 0 open PRs, 0 armed, `gates-satisfied=0 of 14`, trunk green,
watcher healthy.

🔴 **The gate is working exactly as designed and no agent has touched it.** `docs/approvals/README.md`
records that for this class the dead dependency gate is *the only thing `lint-prompt.mjs` rejects
on* — so "repairing" the gate would silently remove the protection on two irreversible migrations
and one production-data write. Station 04 measured all five and repaired none, deliberately. This
escalation is **not** a request to weaken anything.

## Options — RULE 1 order

### (a) Decide the fate of the class, slice by slice — **complete and additive; recommended**

For each of the five, one of: **keep** (stays parked, you approve it when you want it), or **retire**
(Station 00 moves it to `docs/pr-prompts/superseded/` with your one-line reason in the file).

- **Solves it immediately:** whatever you retire stops appearing in every triage pass from that
  moment.
- **Solves it in future:** the remaining prompts are ones you have said you still want, so a future
  *"5 of 14 are parked"* reading becomes information rather than noise.
- **Damages nothing, existing or future.** Retiring a prompt is a `git mv` into `superseded/`; it
  deletes no data, runs no migration, and is reversible by moving the file back. Nothing is
  approved, armed or merged by this option — the destructive slices stay yours to run whatever you
  decide, and RULE 1's second test is therefore passed trivially.
- **What you would need to do:** five words, one per prompt. Reply in chat or drop the answers in
  this file.

### (b) Issue one approval — the s11c artifact — and leave the other four parked

- **Fails the future half of RULE 1.** It moves two prompts now and leaves the class, and this
  question, exactly where it is; the twenty-second day looks like the twenty-first.
- It is listed because it is the single highest-leverage *approval* if you want board movement
  rather than board cleanup — s11c releases `pr-tipid-s3` behind it.
- ⚠️ **It is also the most destructive thing on the board.** `PERMANENT / NOT auto-revertable once
  merged`, and DOCTRINE §9.5 records that this prompt has *never been linted by a working
  `rollback_strategy` gate*. The backlog item `rates-11c-blocked-consumers` further records that
  s11c **must not merge** until `pr-rates-11b2-c-parity-proof` has RUN and come back clean — that
  is a precondition on top of your approval, not a substitute for it.

### (c) Leave it — the five stay parked and unasked

- **Fails the future half outright.** This is the fourth consecutive Station 04 sweep to re-derive
  the same measurement, and until now no artifact asked you anything about it, so there was nothing
  for you to answer. That is the honest cost of (c): the sweeps keep paying for a question that is
  never put.

## What Station 00 did not do

Did not create, edit or delete anything under `docs/approvals/` — those are yours alone. Did not arm,
disarm or retire any of the six prompts. Did not repair any dependency gate. Did not merge anything
touching `migrations/` or production data. `armed (*-ready.md)` was **0** before and after this run.

---

## ADDENDUM 2026-09-23T21:3xZ — Station 00 (scheduled), at `origin/main` `1edd7454`

Same defect, counted from the other side, and one new fact that changes what to do about it.

**The count.** [MEASURED] this run: **13** `*-HOLD.md` in the queue, `lint-prompt.mjs` ⇒ **6 ADMIT**,
and **0 of the 6 are armable**. Four of the six are held by a human-approval artefact:

| prompt | gate | state on `origin/main` |
|---|---|---|
| `pr-rates-s11c-drop-legacy-tables` | `docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md` | **ABSENT** |
| `pr-tenant-mt4-s2-ownership-migration` | `docs/approvals/tenant-mt4-s2-ownership-migration-approved-by-marco.md` | **ABSENT** |
| `pr-tipid-s3-retire-the-name-guard...` | `requires_on_main: docs/data-model/rates-migration/STEP-11C-DONE.md` (+ the backfill audit) | **ABSENT** — only the 11C drop above can produce it, so this is *transitively* the same approval |
| `pr-fv2-output-channels` | `requires_file_on_main: .../form-digests.service.ts` | **ABSENT** — chained behind `pr-fv2-ai-digests`, itself gated |

**`docs/approvals/` holds exactly TWO files on `origin/main`** — `README.md` and
`watcher-identity-approved-by-marco.md`. [MEASURED] `git ls-tree -r origin/main -- docs/approvals`.
One approval has ever been issued through this channel.

**The new fact, and it is the reason for this addendum.** A release *was* performed and it cleared
the wrong layer. `pr-tipid-s3-retire-the-name-guard-for-an-id-check-HOLD.md` carries, in its own
body: *"HUMAN LAYER RELEASED 2026-09-24 by Marco ('Release the nine prompts', in chat), removed and
recorded by `station-00.interactive-0004`"* — and, correctly, its own next sentence: *"The release
clears ONE of the two layers. The three `requires_on_main` gates below are"* still in force.

So nine prompts had their prose hard-stop lifted, and this run measures **zero** additional armable
prompts as a result. **Anyone who issued that release may reasonably believe the queue was
unblocked. It was not.** That is the gap worth closing — not the gate itself, which is doing exactly
what it was built to do.

**The ask, RULE 1 ordered.**

> **(a) complete + additive — write the two approval files you actually intend.**
> `docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md` and
> `docs/approvals/tenant-mt4-s2-ownership-migration-approved-by-marco.md`. That arms those two, and
> once 11C lands its `STEP-11C-DONE.md` it transitively releases `tipid-s3`. Both remain
> destructive / production-data slices, so they stay yours to merge regardless — approving the
> *arming* does not approve the *merge*.
> **(b) additive but incomplete — approve `tenant-mt4-s2` only**, leaving the rates chain
> (11C -> tipid-s3) parked. Fails the *future* half of RULE 1: these same prompts resurface on every
> collect run.
> **(c) complete but damaging — retire the `requires_file_on_main` approval gates.** Fails the
> *without damaging* half outright: that gate is the only thing between an autonomous station and a
> permanent `DROP` of the legacy rate tables. Recorded for completeness; **not recommended.**

A chat-level "release the prompts" does not satisfy any of these, because the gate reads the
filesystem, not the conversation. **The unblocking action is naming a file.**

---

## ADDENDUM 2026-09-23T22:45Z — Station 00 (scheduled). A SECOND item, on the same release event.

**This is not the approvals-channel defect above. It is the opposite one**, and it arrived through
the same chat action ("Release the nine prompts", 2026-09-24). The item above is a gate too *tight*
to open — five holds waiting on approval files that were never written. This item is a gate that
**has** been opened, where nothing says **for whom**.

**[MEASURED] 2026-09-23T22:2xZ at `d6c086c8`.** `pr-fv2-formrule-contract-HOLD.md` is the **only** one
of the thirteen depth-1 holds that lints **ADMIT, exit 0**. Every other hold rejects: 7
`HUMAN_GATE_PRESENT`, 4 `FILE_GATE_NOT_RELEASED`, 1 `GATE_NOT_RELEASED`. It carries **no**
`requires_merged`, **no** `requires_file_on_main` and **no** `requires_on_main` — all three spellings
checked — its premise is TRUE, and its scope overlaps **zero** files with any of the three open PRs.

So every mechanical gate on it is open. What it still is, from its own front matter:
`gate_allow: migrations`, `escalates: true`, and a `rollback_strategy` beginning *"This is a
destructive column drop and is deliberately irreversible for the dropped column values."* It drops
five columns from `FormRule`.

**The only thing holding it is a sentence in `docs/pipeline/stations/00-supervisor.md`:** *"Never-arm
list still stands: `pr-fv2-formrule-contract`, `pr-siteid-notnull-backfill` … those are
**Marco-run**."*

**And the prompt now carries a release note that reads against it.** Verbatim from the file:

> `<!-- RELEASED 2026-09-24 by Marco - see the release note below. -->`
> *"This prompt sat on the Station 00 Marco-run list (`docs/pipeline/stations/00-supervisor.md`)
> behind a linter-visible marker, so `lint-prompt.mjs` rejected it `[HUMAN_GATE_PRESENT]` before the
> premise was ever evaluated. Marco released it in chat on 2026-09-24 ("Release the nine prompts")
> and `station-00.interactive-0004` removed the marker and recorded this note."*

**[MEASURED] the marker state, with a positive control.** `pr-fv2-formrule-contract`: `watcher:
do-not-arm` **0**, `DO NOT ARM` (case-sensitive) 0, `Arm ONLY` 0 — **unmarked**.
`pr-siteid-notnull-backfill`, the other name on the same never-arm sentence: `watcher: do-not-arm`
**1** — still marked, still rejecting. And `queue-sync.ps1`'s `$Forbidden` denylist holds
`rates-s11c`, `site-dissolution`, `b-p0a-4-ii`, `b-p0a-5/6/7/8`, `b-sd` — **neither
`fv2-formrule-contract` nor `siteid-notnull-backfill` is on it.**

🔴 **So this prompt's never-arm status is now enforced by nothing but a station reading a sentence
and applying it** — and the marker that used to enforce it mechanically was removed deliberately, as
part of the release.

**Two readings, and they prescribe opposite actions.**

- **(a)** *Marco released it, therefore Station 00 may arm it.* The release note's plain sense.
- **(b)** *The prompt is **Marco-run**; removing the marker unblocked `arm-prompt.ps1` **for Marco**,
  because the marker was rejecting it for every actor including him. Station 00's never-arm entry is
  untouched.*

Reading (b) is what the never-arm sentence actually says, and it explains why the marker had to be
removed at all. **I applied (b) and armed nothing.** But nothing in either document names the actor,
and reading (a) on an irreversible column drop is a one-way door — so the next station to meet the
release note without meeting the never-arm sentence can reasonably reach the other answer.

**THE QUESTION, RULE 1 ordered:**

> **(a) COMPLETE + ADDITIVE — make a release name its actor, once.** Add `released_for: marco` (or
> `released_for: station-00`) to a released prompt's front matter, and amend the never-arm list in
> `00-supervisor.md` to either drop `pr-fv2-formrule-contract` or annotate it *"released 2026-09-24,
> still Marco-run"*. Solves it immediately — this prompt stops being ambiguous today — and in future,
> because the other eight prompts released in the same action, and every future release, carry their
> own answer. It writes no data anything reads, removes no gate, and weakens nothing. **Fails neither
> half of RULE 1.**
> **(b) ADDITIVE BUT INCOMPLETE — re-add `<!-- watcher: do-not-arm -->` to this one prompt.** Restores
> the mechanical block, but it also re-blocks *your own* `arm-prompt.ps1`, which is exactly what the
> 09-24 release removed, and it says nothing about the other eight. **Fails the *future* half.**
> **(c) COMPLETE BUT DAMAGING — treat the release as an arming licence.** One sentence in
> `00-supervisor.md` and Station 00 arms it on the next run. It does resolve the ambiguity
> permanently, and it hands an autonomous station an irreversible five-column DROP on the strength of
> a chat quotation no station can verify. **Fails the *without damaging* half. Not recommended;
> stated for completeness.**

⚠️ **Note for whoever performed the 09-24 release:** across the nine prompts, this run measures
**zero** additional prompts that Station 00 can arm. For `pr-tipid-s3` the item above already records
why (three `requires_on_main` gates still bind). For `pr-fv2-formrule-contract` the reason is
different and is this addendum: the release cleared the only *mechanical* layer, and the *remembered*
layer — the never-arm list — was not updated either way.


---

## UPDATE 2026-10-08T23:2xZ — it is EIGHT holds and 36 days, trunk is green, the board is empty, and the last other explanation is gone

Added by Station 00 (scheduled), run `2026-10-08T22:38:06Z`, `origin/main` `375f4386`. Breadcrumb
`00-00-supervisor-2026-10-08-2238-all-four-stations-never-fired-for-41h-while-the-box-stayed-up-and-no-hold-is-armable.md`,
F4. **Nothing above is withdrawn.** This update exists because the number changed and, more
importantly, because the one competing explanation for an empty board has been eliminated by
measurement.

### The count, with the reject code for every prompt on the board

**[MEASURED]** `scripts/pipeline/triage-holds.ps1`, read-only (`--dequeue` never passed), exit 0,
**both of its own controls PASS** — `GIT control: PASS` (read `origin/main:docs/pipeline/DOCTRINE.md`,
30282 chars, so the gate probes can actually run) and `SPENT control: PASS` (`lint-prompt.mjs` exit 3
on the fixture, so the SPENT bucket is measurable):

```
TOTALS  spent=0 of 13 evaluated  gates-satisfied=0  still-gated=13  unreadable=0
        of 13 prompts (HOLD=13, ready=0, LOOPING=0)
```

| prompt | reject code |
|---|---|
| pr-524-rates-b-slice2-canonical | **HUMAN_GATE_PRESENT** |
| pr-nav-jobs-projects-merge | **HUMAN_GATE_PRESENT** |
| pr-queue-layout-sot-entry | **HUMAN_GATE_PRESENT** |
| pr-retire-tenderclientnote-s2 | **HUMAN_GATE_PRESENT** |
| pr-scopecards-s8b-azure-maps-travel | **HUMAN_GATE_PRESENT** |
| pr-sec-a2-email-codes-and-reset-links | **HUMAN_GATE_PRESENT** |
| pr-siteid-notnull-backfill | **HUMAN_GATE_PRESENT** |
| pr-vendor-invoice-ocr | **HUMAN_GATE_PRESENT** |
| pr-fv2-ai-digests | FILE_GATE_NOT_RELEASED |
| pr-fv2-output-channels | FILE_GATE_NOT_RELEASED |
| pr-rates-s11c-drop-legacy-tables | FILE_GATE_NOT_RELEASED |
| pr-tenant-mt4-s2-ownership-migration | FILE_GATE_NOT_RELEASED |
| pr-tipid-s3-retire-the-name-guard-for-an-id-check | GATE_NOT_RELEASED |

**Eight waiting on you personally, not five.** Filed 2026-09-23 at five holds and 21 days; it is
**eight holds and 36 days** now.

**[MEASURED]** Station 04, running independently in the same hour (breadcrumb
`00-04-scanner-2026-10-08-2238-gate-liveness-tipid-s3-first-machine-gate-is-always-true.md`),
reached `spent=0 of 13 gates-satisfied=0 still-gated=13 unreadable=0` with its own instrument, and
separately verified every `HUMAN_GATE_PRESENT` prompt carries a real lint anchor
(`<!-- watcher: do-not-arm -->`, a case-sensitive `DO NOT ARM` line, or an `Arm ONLY` line) — with a
freshly minted needle as the negative control returning 0 hits across all nine files. **The gates
are real; none of these eight is held by a stale or phantom marker.**

### What is new: the competing explanation is gone

The previous Station 00 run (2026-10-07T05:14Z, F4) declined to arm anything and gave a reason that
was partly its own judgement: trunk was RED, so arming a feature slice that touches `apps/web` would
have produced a PR whose e2e result could not be distinguished from the trunk failure. It named
*"an empty board with a green trunk"* as the thing that would make this urgent.

**[MEASURED]** that condition is now met. `main` CI on `375f4386` → **4 success / 0 failed (trunk
green)**; the push-triggered `Tendering Browser Smoke` on that head (`run=37577042338`) is
`success`, and so are `CI`, `CodeQL` and `Deploy`. The single red (`7993d006`,
`run=37571374467`) is bracketed by a success before it and a success after it, on application code
unchanged for fourteen commits — one red in twenty-one runs of that workflow on `main`.

🔴 **So the board is empty with a green trunk, and arming is still impossible — not as a judgement
call, but as a measurement: `gates-satisfied = 0`.** No decision available to any station changes
that. There is no arming limit (your ruling, 2026-10-03), nothing is armed (`*-ready.md` = 0), and
the only open PR is #2261, held by its own `do-not-merge` label. **The pipeline has no work it is
permitted to start.**

### The question, unchanged in kind, cheaper than it was

Everything above this update still stands as written. The ask is narrower now:

> **Releasing any ONE of the eight restarts the board.** The four `FILE_GATE_NOT_RELEASED` and one
> `GATE_NOT_RELEASED` prompts are waiting on predecessors that cannot land while nothing can be
> armed, so a single release does not just unblock one slice — it re-starts the chain that feeds the
> other five.

🔧 **RULE 1 ordered, for the channel rather than for any one prompt:**

> **(a) COMPLETE + ADDITIVE — release one human-gated prompt and say which, in a file a station can
> read.** Removing the `DO NOT ARM` / `<!-- watcher: do-not-arm -->` anchor from one prompt, or
> dropping an approval marker at the path its gate names, unblocks the board today and leaves a
> durable, machine-readable record of the decision. Writes no production data, removes no CI gate,
> weakens nothing. **Fails neither half.**
> **(b) ADDITIVE BUT INCOMPLETE — tell a station in chat which one is released.** Unblocks today;
> no scheduled run can read a chat (`needs-marco/rule-2-clearance-lives-in-a-chat-no-scheduled-run-can-read-2026-09-10.md`
> is the open item for exactly this), so the next run re-asks. **Fails the *future* half.**
> **(c) COMPLETE BUT DAMAGING — let Station 00 arm a human-gated prompt on its own judgement.**
> Permanently removes the stall, and hands an autonomous station prompts that include irreversible
> column drops and a production-data migration. **Fails the *without damaging* half. Not
> recommended; stated for completeness.**

**PROBE:** `triage-holds.ps1`'s `gates-satisfied` count. The moment it is non-zero, arming is
Station 00's again, and this file narrows or discharges via `retire-escalation.mjs`.

⚠️ **One piece of context that is not an excuse and should not be read as one.** All four stations
lost 41 hours to a scheduler stall ending at `2026-10-08T22:38Z`
(`needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`, update of the
same date). That explains why no station *asked* you about this for two days. It does not change the
count, the reject codes, or the fact that the gates are yours: the eight anchors were measured this
run, on the current head, with controls.
