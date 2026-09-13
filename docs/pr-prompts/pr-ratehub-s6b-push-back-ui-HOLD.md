---
premise: '! grep -q "push-back" apps/web/src/pages/ScheduleOfRatesAdminPage.tsx'
premise_means: The Schedule of Rates page has no push-back affordance - the S6a preview and push endpoints exist but nothing on the screen calls them, and a hub-linked line shows no drift against the hub.
scope:
  - apps/web/src/pages/ScheduleOfRatesAdminPage.tsx
  - apps/web/src/components/sor/PushBackDialog.tsx
done_when: pnpm build && pnpm lint && grep -q "push-back" apps/web/src/pages/ScheduleOfRatesAdminPage.tsx && test -f apps/web/src/components/sor/PushBackDialog.tsx
size: 2
gate_allow: none
seed_only: false
escalates: false
module: schedule-of-rates
cluster: ratehub-s6
cluster_order: 2
requires_on_main: 'apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts :: sor.rate.push-back'
design_ref: https://claude.ai/code/artifact/2d70131e-79f9-4a92-a3d7-3df058e4ec99
---

# Rate Hub S6b - guarded push-back, web: the button, the drift lines, the dialogs

**Slice 2 of 2.** S6a shipped the service, `GET rates/:id/push-back/preview`,
`POST rates/:id/push-back`, `GET periods/:periodId/push-back/hub-figures` and the
`rates.push-back` permission. This slice is the Schedule of Rates page only. **The mock-up in
`design_ref` is the standard** - its five states are the acceptance test. Read all five and the
grounding panel before writing a line; take every response shape from the S6a controller, not from
this description.

**Gate:** S6a must be on main - the literal audit action `sor.rate.push-back` in
`sor-push-back.service.ts`. That is a real symbol S6a introduces, not a marker file: if the
endpoints this page calls do not exist, the page cannot work.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the two files in `scope`. That is a scope limit,
**not** a reason to stop before pushing.

## Guardrails

- One attempt. If `push-back` already appears in `ScheduleOfRatesAdminPage.tsx` on main, say
  `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.

## Grounded on main (read first)

- The page is `apps/web/src/pages/ScheduleOfRatesAdminPage.tsx`, route `/admin/schedule-of-rates`,
  gated by `can(user, "rates.manage")` (~319) with `<NoAccess required="rates.manage" />` (~513-514).
- The **Source / markup** cell is rendered **three times** - once per table (~1190-1192, ~1443-1445,
  ~1746-1749) - as `sourceBadge(rate.sourceType)` + `<MarkupCell>` + `<PromoteButton>`. The push
  control goes into that cell, beside them, in **all three** places - build one component and use it
  three times; do not paste it.
- `PromoteButton` (~253-273) is the sibling to copy: it decides from `rate.sourceType` and calls
  `callApi(\`/schedule-of-rates/rates/${rate.id}/promote-to-hub\`, "POST")`. `callApi` and
  `authFetch` are the page's request helpers; period + change log load at ~434-435.
- `SorPeriodStatus` is `"ACTIVE" | "EXPIRED" | string` (~57); `statusBadge` renders it (~277). The
  selected period is `selectedPeriod` (~581).
- The row type carries `sourceType`, `sourceRateRowId`, `sourceSubRateId` (~86-90) and the three
  figures `ordinary / oneAndHalf / double`.
- Read error bodies with `readApiErrorMessage` (find it under `apps/web/src/lib/`) - do not
  reintroduce a raw `res.text()` read.
- Use the page's existing `s7-*` classes and tokens. No new UI library, no new font, no hex literal.

## What to build

### 1. `PushBackButton` (inside the page file, next to `PromoteButton`)

Rendered in the Source / markup cell at all three sites. Decides from the row and the period:

| Row | Renders |
|---|---|
| user lacks `rates.push-back` | nothing (the drift lines still render - see 2) |
| `sourceType MANUAL` | the chip `⊘ No hub anchor — cannot push` in the button's place; `PromoteButton` stays beside it |
| `INTERNAL`, period `"ACTIVE"` | button **Push 3 figures** |
| `SUBBIE` / `SUPPLIER`, period `"ACTIVE"` | button **Push 1 figure** |
| all landing figures equal the hub | the same button, **disabled**, title "Nothing to push — all figures match the hub" |
| period status not `"ACTIVE"` | button disabled, title `SoR period <label> status is "<status>"`, plus the chip `⊘ Period "<status>"` |

"Disabled" and "absent" are two different refusals with two different remedies (mock-up, "Invented
here"); keep both shapes. The button label names its own arity - never a uniform "Push to hub".

### 2. Drift lines - one under each of Ordinary / 1.5× / 2×

Load `GET /schedule-of-rates/periods/${periodId}/push-back/hub-figures` once per period load and keep
the map in state. Under each figure cell render one small line (mock-up state 1):

- hub linked, differs: `hub $92.50 · +$3.50` (signed delta, currency-formatted like the cell above)
- hub linked, equal: `hub $92.50 · in sync`
- vendor line, `oneAndHalf` / `double`: `no vendor column — stays local`
- MANUAL: `typed on this page`
- period not `"ACTIVE"`: `period closed <expiryDate>` on every figure
- map not loaded yet / line missing from the map: render nothing, never a placeholder number.

Add a **Drifted from hub** cell to the markup strip (count of linked lines with any landing figure
differing) and a **Lines linked to hub** cell (`n / total`). Both computed from the map, no new call.

### 3. `PushBackDialog` - `apps/web/src/components/sor/PushBackDialog.tsx`

Opens from the button; fetches `GET rates/:id/push-back/preview`; shows a loading state, then the
dialog exactly as mock-up state 2 (and state 3 when `futureLocks` is empty). Sections, in order:

1. **Header** - `Push back to hub — <line name>`, sub-line with period label, category, class, id,
   `<landingCount> figures`.
2. **Target** - the chain `SorRate → RateTable <slug> → RateRow <id> (same id, new cells)` for
   INTERNAL, or `SorRate → SubcontractorRate <id> (<vendor>)` for a vendor line, with the badge
   `in-place cells update · row id preserved` / `supersede · line re-anchored`.
3. **What is being pushed** - table SoR field / Hub column / cells key / Hub now / Becomes / Δ /
   Lands?, one row per figure from `preview.figures`; `lands: false` rows show the reason badge
   (`no — stays on the SoR line`); SoR-only fields (`markupPct`, `comments`) are **not** listed -
   they are not figures and the API does not return them.
4. **Affected — tenders that have not locked yet** - table Tender / Name / Stage / Would lock today /
   Will lock after / Δ at lock from `preview.futureLocks`. Empty -> the state-3 empty box verbatim:
   *"No tender is currently waiting to lock on this rate."* with its explanatory paragraph. The
   mock-up's **"Wizard rates step"** column is **not built** - nothing on main records per-tender
   wizard progress, so there is nothing truthful to put in it.
5. **Proof** - the guarantee banner, then **Untouched — already locked**: Record / Name / Locked by,
   at / What holds it / Value held / Why it cannot move, from `preview.frozen`. The "why" column is
   derived from `mechanism` with the three fixed sentences the mock-up uses (TenderRateEntry: copied
   `originalValue` / `overrideValue`, key still names this row; JobSorSnapshotRate: all three figures
   copied at lock; SorClientRateEntry: override recorded against the SoR line, never the hub).
6. **Will be written** - change log rows (`hub.ordinary` etc., old -> new) and the audit line
   `sor.rate.push-back`. Field names come from the API's preview (`figures[].field` prefixed `hub.`),
   not typed here.
7. **Footer** - the note (*"This changes the master price every tender locks from here on. It cannot
   be undone from here — correcting it means another push."*), **Cancel**, and the primary
   **Confirm — N figures, M future locks**. Confirm posts `{ ordinary, oneAndHalf, double }` exactly
   as the preview showed them (that is S6a's stale-preview guard).

Do **not** render the mock-up's "Correction against the code" box or the state-0 ledger - those are
mock-up chrome about the design process, not product.

### 4. Refusals are dialogs, not toasts

- **403** (period not `"ACTIVE"`): the state-4 dialog - danger header *"Push-back refused"*, the
  server's message as the headline, **Why** and **Nothing was written** paragraphs, then **What to do
  instead** with the three steps and a **Switch to <active period>** button that changes the period
  selector to the period whose status is `"ACTIVE"` and closes the dialog.
- **409** (line changed since preview / nothing to push): a short dialog with the server's message
  and a **Reopen preview** button that refetches.
- **400 / 404**: the server's message in the same short dialog.
All copy from `readApiErrorMessage`; never a generic "Something went wrong".

### 5. Success

Toast (mock-up state 5): *"Hub rate updated — N figures. M tenders will lock the new number."* with
the detail line naming the target and, for INTERNAL, *"row id preserved"*. Then refetch the period,
the change log and the hub-figures map so the drift lines read `in sync`, the button disables for the
right reason, the Drifted-from-hub count falls, and the Change log tab count rises.

## Do NOT

- Do NOT call the API for anything but the three S6a endpoints and the existing period / change-log
  reads. If a shape is wrong or a field is missing, say so in the PR body and work with what exists -
  do not widen into S6a's files.
- Do NOT hide a MANUAL row's Promote button - push-back sits beside it, not instead of it.
- Do NOT show the push button to a user without `rates.push-back`; do NOT hide the drift lines from
  a user who has only `rates.manage`.
- Do NOT render "recommended, not decided" anywhere - the permission is decided.
- Do NOT touch the API, the schema, `/sot/`, Azure/Entra/SharePoint.

## VERIFY

```
pnpm build && pnpm lint
grep -q "push-back" apps/web/src/pages/ScheduleOfRatesAdminPage.tsx
test -f apps/web/src/components/sor/PushBackDialog.tsx
```

Open the PR titled `feat(schedule-of-rates): S6b - push-back button, drift lines and impact dialog`
and leave it UNMERGED.
