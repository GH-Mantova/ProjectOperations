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
