<!-- Tracked copy. The working original lives in docs/pr-prompts/needs-marco/, which is
     gitignored, so it reaches nobody outside Marco's machine. The prompts written under
     these rulings cite THIS path. Amend both together, or amend this one and say so. -->

# Four decisions the estimating work cannot be written around

**Filed by Station 06 (cloud lane), 2026-09-04, from the package 9 audit.**
Both reference mock-ups were read in full and compared to `origin/main` symbol by symbol:
`1c1d373e` (Scope of Works — Discipline Cards) and `a6a66f6e` (Charging Methods Admin).

Thirty-six findings became nine prompts. **These four did not**, because each is a call about what
the product should be, not a defect with a right answer. Every one of the nine prompts names them
in its `## Do NOT` so no agent quietly builds one.

---

## 1. Line fields — the rates mock-up cannot be built without them

The charging-methods mock-up is built on **two kinds of operand**: rate-table columns, and values
the estimator enters on the line (`Depth mm`, `Elevation`, `Holes`). Line fields are first-class —
they carry `src:'line'`, they appear in the operand picker, and the Fields table labels them *"the
estimate line"* against the columns' *"the rate table"*.

The shipped model has **columns and rows only**. `RateTable` has no line-field concept, the editor
builds its operand list from columns alone, and the server rejects any field name that is not a
column on the table.

**Consequence, measured:** all four of the mock-up's worked examples are unexpressible.
`Depth ÷ 10 … × Rate × Holes` cannot be entered, because `Depth` and `Holes` do not exist as
things a step may reference.

**The decision:** do charge steps price against estimator-entered quantities, or only against
stored rate rows? If yes, this is a data-model slice (a `lineFields` definition on the table, a
values payload at pricing time) and three further findings unblock with it — the Fields table's
`From` column, its `Used in` column, and the scenario picker that currently offers `Row 1, Row 2`
instead of the key columns. If no, the mock-up needs amending and those three findings are retired.

---

## 2. Wiring `evaluateSteps` into pricing

`chargeSteps` is stored, validated, and **priced against nothing**. `evaluateSteps` has exactly two
references in the whole repo: its own definition and its unit spec. `RateResolverService` never
reads `chargeSteps`.

So the mock-up's central claim — a charge step resolves to a rate — is true only inside the admin
preview. It also explains why the client/server evaluator disagreements have never surfaced as
bugs: the server evaluator has never run on real data.

**The decision:** when does a charge step become the price? This sits behind the same gate as the
`RATES_CANONICAL_SOURCE` switch already on the board (items 1.2.2 / 1.2.15) — making a stored rule
authoritative for money is the thing the parity proof exists to gate.

`pr-chargesteps-s1-evaluator-parity` hardens the evaluator **first**, deliberately, so that
whenever this is switched on the two sides already agree. It does not switch anything on.

---

## 3. In-place step editing

The mock-up edits every step where it sits — op select, operand select, condition pill, all live.
What shipped renders each step as a read-only sentence with reorder and remove only; all authoring
happens in a separate add-form at the bottom.

**Consequence:** changing `× 2` to `× 3` means deleting the step, re-picking op, operand and
condition in the add form, then re-ordering it back into place.

**The decision:** is the read-only sentence a deliberate simplification, or an unfinished half of
the mock-up? It is a real rebuild of the editor either way — worth doing once the answer to (1) is
known, since line fields change what the operand picker has to offer.

---

## 4. Per-discipline card stacking

The mock-up has **one tab per discipline**, stacking every card in that discipline, each
independently collapsible, with a discipline-level roll-up above them. What shipped has **one tab
per card** and shows exactly one card at a time.

This is not part of the redesign chain — it predates it (PR B1.5) — so no `cardui` slice covers it,
and it is the reason the summary bar labelled "Discipline total" actually shows one card's total.

**The decision:** does the estimator need to see two cards of a discipline side by side? If yes it
is a navigation rebuild, not a fix, and the summary bar's labelling follows from it. If no, the bar
should be relabelled to say what it actually shows, which is a one-line change.

---

## What I need from you

One line on each. (1) and (2) unblock the largest amount of queued work; (3) depends on (1);
(4) is independent and can be answered last.

**Not blocked on any of this:** the nine prompts in `0003-package-9-prompts.patch`, and the six
existing estimating prompts the same patch unblocks by adding the `design_ref` key they were all
missing.

---

# RULINGS

## Decision 1 — LINE FIELDS: **YES**

**Marco, 2026-09-04, in chat:** *"yes, line fields — the mock-up is what I want."*

Charge steps price against estimator-entered values as well as stored rate-table columns. The
mock-up (`a6a66f6e`) is the specification, including its `From` distinction — *the rate table* vs
*the estimate line* — and its four worked examples must all be expressible when this lands.

**What this authorises**

- A line-field definition on `RateTable`, alongside `columns`, carrying at minimum a name, a kind
  (number / text), a unit, and for text fields an option list.
- A values payload at pricing time, so a step may reference a line field by name.
- Widening the server's field-name validation, which today rejects anything that is not a column
  (`rate-tables.service.ts`), to accept a declared line field.

**What it does NOT authorise.** This decision is about what a step may *reference*. It does not
switch charge steps on as the price — that is Decision 2, still open, and gated on the parity
proof exactly as the `RATES_CANONICAL_SOURCE` items (1.2.2 / 1.2.15) already are. A slice built
under this ruling must leave `RateResolverService` alone.

**Three findings unblock with it**, and should be written as slices behind the model change rather
than before it:

- 9.5.3 — the Fields table's `From` column (the rate table / the estimate line).
- 9.5.3 — the `Used in` column, which scans the step list and warns before a column that a step
  depends on is deleted. Today that breakage surfaces later as a server rejection.
- 9.5.5 — the scenario picker, which offers `Row 1, Row 2` instead of one dropdown per key column
  plus an input per line field, and does not highlight the matched row.

**Ordering note.** `pr-chargesteps-s1-evaluator-parity` should still land first. It defines one
comparison rule shared by client and server; adding a second class of operand to two evaluators
that already disagree would double the surface of that disagreement.

## Decision 2 — WHEN A CHARGE STEP BECOMES THE PRICE: **(a) PARITY-GATED**

**Marco, 2026-09-04, in chat:** *"(a), parity-gated."*

`RateResolverService` is **not** switched over on a build-and-flip. Both paths run, every
disagreement is logged against real tenders, and the switch happens only when that log is clean.

**Why (a) and not (b) per-table opt-in.** Finding 9.4.3 is the reason and it is measured: the
client preview and the server evaluator compare condition values by different rules today. A
numeric cell `150` against a condition typed as `"150"` matches in the preview and never on the
server. That is harmless only because the server evaluator has never run. Switching on without
parity makes it a live mispricing on day one. Per-table opt-in would also leave two pricing paths
alive indefinitely, so every future pricing bug starts with "which path priced this line".

**The sequence, and it is not negotiable in this order**

1. `pr-chargesteps-s1-evaluator-parity` — one comparison rule, defined once, used by both sides,
   with the same error taxonomy on both. **Must land first.** Decision 1 adds a second class of
   operand; adding it to two evaluators that already disagree doubles the surface.
2. The line-fields model slice, under Decision 1.
3. **A parity harness.** Both paths computed for every priced line, disagreements logged with the
   tender, the rate table, the step index and both numbers. Read-only: it must not be able to
   change a price. This is the piece nobody has written and it is the gate itself.
4. Soak. Length is Marco's call and should be stated when the harness lands — the FV2 soak is the
   precedent for how that is decided.
5. Only then does `RateResolverService` read `chargeSteps`.

**This is the same lever as board items 1.2.2 and 1.2.15**, which the board already says should be
merged into one decision: `RATES_CANONICAL_SOURCE` is set in no environment, so production takes
the legacy-first branch by absence. Making a stored rule authoritative for money is the thing the
existing parity proof (11b2-c) exists to gate. **The charge-step switch belongs behind the same
gate and should be tracked with them, not separately.**

**Standing constraint for every prompt written before step 5:** leave `RateResolverService` alone.
All three `charge-steps-correctness` prompts already forbid it by name in their `## Do NOT`.

## Decision 3 — IN-PLACE STEP EDITING: **(b) BUILD IT, AS ITS OWN SLICE AFTER LINE FIELDS**

**Marco, 2026-09-04, in chat:** *"(b), and rarely — maybe a few times a year."*

Two slices, not one: the line-fields model change lands first, then the editor rebuild. Keeping
them apart is deliberate — a PR carrying both a schema change and an editor rebuild is the kind
that sits unreviewed for a week, which is the throughput problem this whole session is about.

**The honest tension, recorded rather than smoothed over.** Marco edits a charge rule perhaps three
times a year. On convenience alone that is a weak case for (b), and (c) — keep the read-only
sentence — would be defensible.

**The case that survives the frequency answer is correctness, not convenience.** The current edit
path is destructive: to change `x 2` to `x 3` you delete the step and re-add it. Finding 9.4.7 is
that this path can leave the list in a state that cannot be saved — `addStep` appends, so once
step 1 is deleted no `start` can be put back at the front, and a second `start` is checked by
neither validator, saves cleanly, and silently discards everything computed before it.

So the few times a year Marco touches a rule are exactly the times he is most exposed, and least
likely to remember the quirks. **Rare editing raises the value of a safe editor rather than
lowering it.** That is the reason to build it; convenience is not.

**Consequence for sequencing.** `pr-chargesteps-s3-step-one-is-pinned` guards the *current*
destructive path. It stays worth landing on its own — the editor rebuild is two slices away and the
trap is live until then — but it is a stopgap, and the rebuild should absorb its guards rather than
inherit them as a second implementation.

**The economics that made (b) affordable.** Decision 1 forces the operand picker to be rebuilt
anyway, to offer two kinds of field and show which is which. That was the expensive half of
in-place editing. Building it once, in the step row, is close to what building it once in the
add-form would have cost.

## Decision 4 — PER-DISCIPLINE CARD STACKING: **(a) REBUILD TO THE MOCK-UP**

**Marco, 2026-09-04, in chat:** *"they're stages of the same job — (a)."*

One tab per **discipline**; every card in that discipline stacks down the page, each independently
collapsible, with a discipline roll-up bar above them and a card total on each card. The mock-up
(`1c1d373e`, sections `renderTabs` / `renderDiscipline`) is the specification.

**The domain fact that decides it, recorded because it is not recoverable from the code.** Cards
within a discipline are **stages of the same job**, not unrelated scopes. DEM1, DEM2, DEM3 are one
demolition programme in sequence. That is why a discipline roll-up is a number Marco prices and
resources from, and why the current screen — one card at a time, no roll-up — hides it.

**A trap this creates, and the rebuild must not walk into it.** If the cards are stages, **the
roll-up is not a sum for every chip.** Money is additive across stages. Resourcing is not:

- **Peak crew** across sequential stages is a **maximum**, not a sum. Summing it would claim a job
  needs every stage's crew at once and overstate the labour requirement badly — on a three-stage
  demolition it could be three times the real peak.
- **Peak plant** has the same shape.
- **Duration** is additive only if the stages run end to end, and is a critical-path calculation
  if any of them overlap.
- **Person-days and labour days** are genuinely additive, because they are totals not peaks.

The mock-up's own bar distinguishes these — it lists *Discipline peak crew* and *Person-days* as
separate chips rather than one number — but it does not say what happens when stages overlap.

**Open sub-question for Marco, small but load-bearing:** do the stages of a discipline ever run at
the same time on site, or are they always sequential? If always sequential, peak crew is `max()`
across cards and duration is a sum. If they can overlap, both need a stage order or dates on the
card, which is a bigger change and should be its own slice. **The rebuild should not guess this.**

**Also settles 9.3.5.** The bar currently labelled "Discipline total" shows one card's total; its
chips read *Items / Manpower days / Plant days* against the mock-up's crew figures, and *Peak crew*
and *Labour days* are printed a second time in a separate grid below it. All of that is subsumed
by this rebuild — do not fix the labelling separately and then rebuild around it.

**Sequencing.** This is independent of Decisions 1 to 3, which are all charge-steps and rates. It
sits behind the `scope-card-corrections` and `scope-card-persistence` clusters: rebuilding the
navigation over columns that do not persist would mean doing the roll-up twice, once against local
state and again against stored state.

### Sub-question closed — stages are ALWAYS SEQUENTIAL

**Marco, 2026-09-04, in chat:** *"always sequential."*

Stages of a discipline never run at the same time on site. So the roll-up arithmetic is settled and
must be implemented exactly this way:

| Chip | Across the cards of one discipline |
|---|---|
| Peak crew | **`max()`** — never a sum |
| Peak plant | **`max()`** — never a sum |
| Person-days | sum |
| Labour days | sum |
| Duration | sum (stages run end to end) |
| Money (subtotal, markup, total) | sum |

No stage order field and no dates are needed for this. If overlapping stages are ever wanted, that
is a new decision and a new slice — the rebuild must not build for it speculatively.
