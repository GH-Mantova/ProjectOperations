# Station 00 — supervisor | 2026-09-09 2202Z–2345Z

**HANDOVER TO STATION 06 — PR MASTER.** Marco asked for this by name. The brief in the last
section is written so 06 can start at PHASE 2 and verify, rather than re-interview him.

## GROUND

- Actor: Station 00, supervised cloud lane, Marco present in chat throughout.
- Bridge: `device_bash` mounts are broken this session (`no Plan9 drive shares mounted`); every
  command below ran through desktop-commander (`powershell.exe -File`, never `-Command` — the
  quote-stripping trap in DOCTRINE 9).
- Tree: probes run against `origin/main`, not the working copy. `origin/main = eb5aa0eb` at the
  time of the last probe. Local `C:\ProjectOperations2` was at the same sha earlier in the run.
- Watcher: alive, node pid 13352, relaunched 2026-09-09T22:00:45Z after an 8.5 h sleep gap.

## WHAT I MEASURED

**[MEASURED] The whole scope-card redesign chain is already on `origin/main`.** Each prompt in the
chain gates on a sentinel string, so each premise is directly testable:

| slice | sentinel | on main | shipped by |
|---|---|---|---|
| cardui-s5 actions + expandables | `SCOPE_WBS_ACTIONS_V1` | 6 files | #1646, 5 Sep |
| cardui-s6 other operational costs | `SCOPE_OTHER_COSTS_V1` | 3 files | #1681, 6 Sep |
| cardui-s7 cutting section | `SCOPE_CUTTING_V1` | 3 files | #1682, 6 Sep |
| cardui-s8 waste section | `SCOPE_WASTE_SECTION_V1` | 3 files | #1689, 6 Sep |
| scopecosts-s1 operational-cost API | `ScopeOperationalCostLine` | 1 file | #1698, 6 Sep |

POS control: `SCOPE_WBS_PLANT_V1` (cardui-s4, known shipped) returns 2 files on the same
instrument, so the probe is not blind. NEG control: `zqxNoSuchSentinelZzz` exits 1.

**[MEASURED] The retirements were mechanically correct and were not a considered decision.** All
five prompts were moved to `superseded/` by routine board-collect commits, not by a review of the
chain: `00 collect 1008` (#1653, 5 Sep) took s5; `00 collect 0208` (#1686, 6 Sep) took s6 and
scopecosts-s1; `00 collect 0608` (#1693, 6 Sep) took s7 and s8. Every premise was already false by
then, so `lint-prompt.mjs` returns SPENT and none of them can be re-armed at all.

**[MEASURED] `ScopeCardsTab.tsx` on `origin/main` mounts the old sections alongside the new ones.**
The file is 1429 lines and renders four sections, each imported once and rendered once:

```
L929  <OtherOperationalCosts     new  (s6)
L960  <ScopeWasteTab             OLD  flat waste block
L992  <CuttingSection            new  (s7) — renders the heading "Cutting take-off"
L998  <ScopeCuttingSheet         OLD  — renders "Concrete cutting" with Saw cuts / Core holes / Other
```

NEG control: `<ZqxNotAComponent>` returns 0 in the same file. The strings confirm which is which —
"Saw cuts" and "Core holes" exist only in `ScopeCuttingSheet.tsx` (plus two admin tests), and
"Cutting take-off" exists in `CuttingSection.tsx`. **The old cutting sheet is mounted six lines
below its own replacement.** That is the duplicate Marco is looking at, and it is on main.

**[MEASURED] Every `done_when` in the chain was a presence check.** All five read
`grep -q <SENTINEL>`. A presence check proves a section was ADDED. It cannot prove the section it
replaces was REMOVED, and it cannot prove the result matches the design_ref. Nothing else in the
chain looked, so nothing failed.

**[MEASURED] This is not a deployment lag.** `deploy.yml` completed successfully on 2026-09-08
(three runs) and 2026-09-09T23:13Z, all after the 5–6 Sep merges.

**[MEASURED] No successor exists anywhere in the queue.** 63 files at depth 1 of
`docs/pr-prompts/`; none is in the cardui, scopecosts, waste, cutting or operational-costs family.
The chain has no continuation and cannot be restarted from the retired prompts.

**[MEASURED — upgraded 2026-09-09 2350Z] The shipped sections do not match the approved mock-up.**
This was first written INFERRED, off Marco's screenshots. He then asked for the diff, so it was
done properly: mock-up columns extracted from the rendered `<th>` labels in the design_ref artifact,
shipped columns read from `origin/main`. Both sides measured.

*Other operational costs* — `OtherOperationalCosts.tsx:648` ships
`["Item","Qty","Unit","Days","Rate","Total",""]`. The mock-up has From, Item description, **Source**,
Qty, Duration, **Duration period**, Rate, **Markup**, Total. `markup` appears **0 times** in the
whole 903-line component, so per-line markup is absent altogether, not merely unlabelled.

*Waste* — `ScopeWasteTab.tsx:687-702` ships WBS, Description, Group, Type, Facility, Billed by,
Tonnes, M³, Loads, Duration, $/unit, $/Load, Line total. The mock-up additionally has **Truck**,
**Cap (t)**, **Cap (m³)**, **Trucks**, **Loads/day**, **Loads · days**, **Disposal**, **Transport**,
**Markup**, **From**, and a **Road / Straight distance toggle**. This is the largest gap: the mock-up
prices waste as disposal + transport derived from truck capacity and load counts; the shipped table
prices it as a flat rate times a quantity.

*Concrete cutting* — `CuttingSection.tsx` ships WBS, Description, Rig, Method, Elevation, Depth (mm),
Length (Lm), Rate ($/m), Total. The mock-up has From, **Type**, Description, Equipment, Elevation,
**Material**, Depth, **Ø**, Qty, Method, Rate, **Markup**, Total. Its per-row `Type` is what the old
`ScopeCuttingSheet` expresses as Saw cuts / Core holes / Other **tabs** — so the mock-up's single
table replaces BOTH shipped components.

**[NOT MEASURED] Whether each missing column has a backing field.** Nothing here was executed and no
API was read. Where a column has no field, the options are a new API slice, a derived value, or
dropping the column — a product decision, and Marco's. It must not be resolved by quietly adding a
migration: #1823 was rejected today for exactly that shape.

**[NOT MEASURED] Whether `ScopeCuttingSheet` holds a capability `CuttingSection` lacks.** This is the
question that decides whether the removal can ship on its own or has to wait for the reconciliation.
Station 06 must answer it in PHASE 5.

## WHAT CHANGED

Nothing. This was a read-only investigation: `git grep`, `git log`, `git show`, `gh run list`,
`gh pr view`. No file written, no prompt armed, renamed or moved, no PR opened, nothing merged.

## FINDINGS

**F1 — The old concrete-cutting sheet renders below its replacement, on main.**
`ScopeCardsTab.tsx:992` mounts `CuttingSection` and `:998` mounts `ScopeCuttingSheet`. Users see
two cutting UIs on every card. Same question, unanswered, for `ScopeWasteTab` at `:960`: s8 edited
that file in place rather than replacing it, so whether it is "the old block" or "the new section
that has not caught up" is a code question 06 must settle before scoping the fix.
**DISPOSITION: DISPATCHED to Station 06.**

**F2 — The chain is complete, retired, and unrestartable, with the work unfinished.**
Every premise is dead, so nothing can be re-armed; and no successor was ever written. The design
intent survives only inside five files in `superseded/`, which nothing reads. Any continuation
needs a NEW prompt with a NEW premise.
**DISPOSITION: DISPATCHED to Station 06.**

**F3 — A `done_when` that greps for its own sentinel cannot see a half-finished slice.**
Five slices passed on presence checks while leaving a superseded component mounted. This is the
same shape as two other findings raised today: CP-23 could not see an unsatisfiable prompt
(PR #1824), and the merge path cannot see a verdict written for a different commit (PR #1825,
merged `5acf6d45`). The generalisation: a gate that proves the thing it looks for, and is silent
about everything else, reads as a pass. A replacement slice arguably needs a `done_when` that also
asserts the ABSENCE of what it replaced.
**DISPOSITION: ESCALATED to Marco — rule on whether replacement slices must assert absence.**

**F4 — The mock-up has been diffed against what shipped.**
Done at Marco's request rather than deferred. Per-section column diff in WHAT I MEASURED above,
both sides measured. Delivered to him as a Station 06 intake brief carrying the full table, PHASE 1
pre-filled and PHASE 2 grounded, so 06 can start at PHASE 2. The two things the diff could NOT
settle — whether each missing column has a backing field, and whether `ScopeCuttingSheet` holds a
capability `CuttingSection` lacks — are named in the brief as PHASE 5 and PHASE 6 questions.
**DISPOSITION: ACTIONED — handed to Station 06 via Marco.**

## WHAT I DID NOT DO

- **Did not execute anything, or read the API.** The column diff is a static read of both sides. It
  says what each table RENDERS, not what data exists behind it and not how either behaves at
  runtime. Both gaps are named as NOT MEASURED above.
- **Did not draft or stage any prompt.** Drafting is Station 06's job and staging is Phase 6, which
  is Marco's gate. Station 00 writing the prompt would skip both.
- **Did not touch code, or `ScopeCardsTab.tsx`.** Deleting a mount is a code change and belongs in
  a slice with a test, not in a supervisor's investigation.
- **Did not un-retire anything.** The premises are dead; moving files back would produce five
  prompts that lint SPENT and mislead the next reader.
- **Did not touch #1823 or #1824.** Both carry a claim of mine that measurement has since falsified
  (that `tenders.allocate` is already held by manager roles — 0 of 245 migrations and 0 of 14 seed
  files grant it, and the startup registry sync creates permission rows but no role links). Both
  are held for Marco.

---

# THE BRIEF — Station 06, start at PHASE 2

PHASE 1 is pre-filled below. Restate it and get Marco's yes, then ground it — do not re-interview
him from scratch, and do not accept the INFERRED gap list without checking it.

- **PROBLEM (one sentence):** The scope-card redesign shipped its five new sections but never
  removed the sections they replace, so a card now renders both the new and the old cutting UI,
  and what shipped may not match the mock-up Marco approved.
- **USERS:** Estimators pricing a tender on the Scope of Works tab; Marco reviewing tenders.
- **MODULES:** `tendering` (web: `apps/web/src/pages/tendering/**`, notably `scope-cards/`).
- **DONE, as observable behaviour:** one cutting section per card, not two; each of the three
  sections matches the approved mock-up or a written, Marco-approved deviation; no visual
  regression on cards that have no waste or no cutting.
- **OUT of scope:** how cutting or waste is PRICED — the rate resolver, the take-off maths, and the
  transport calculator are all untouched by this; the API and schema (`ScopeOperationalCostLine`
  already exists); anything outside `apps/web/src/pages/tendering/`.
- **URGENCY:** Marco raised it unprompted while reviewing a live tender screen, so it is in front of
  him daily. Not a production-data risk — no price changes, no migration.
- **GROUNDING ALREADY DONE (verify, don't repeat):** ALREADY BUILT — yes, see the sentinel table;
  the answer is NOT "build the sections", it is "remove the predecessors and reconcile to the
  mock-up". ALREADY QUEUED — no, 63 depth-1 prompts, no family member among them.
- **THE ONE THING TO GROUND FIRST:** open
  `https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035` and diff it, section by
  section, against what `OtherOperationalCosts.tsx`, `ScopeWasteTab.tsx` and `CuttingSection.tsx`
  actually render on `origin/main`. Produce that diff as a table before any prompt is drafted.
- **LIKELY SHAPE (06 decides, not me):** probably two slices — a small one that removes the
  superseded mount(s) with a test asserting the old heading is gone, and a larger reconciliation
  per section. Splitting matters because the removal is safe and shippable immediately, while the
  reconciliation depends on the diff above.
