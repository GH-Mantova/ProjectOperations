---
premise: '! grep -q "onArchive" apps/web/src/pages/crm/LeadsTriageList.tsx'
premise_means: A triage card offers only "Price it" and "Don't pursue" — there is no way to remove an entry from the triage list, so test and mistaken entries sit there permanently.
scope:
  - apps/web/src/pages/crm/LeadsTriageList.tsx
  - apps/web/src/pages/crm/CrmBoardPage.tsx
  - apps/web/src/pages/crm/crm-api.ts
  - apps/web/src/pages/crm/__tests__/LeadsTriageList.archive.test.tsx
done_when: pnpm build && pnpm lint && grep -q "onArchive" apps/web/src/pages/crm/LeadsTriageList.tsx
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# Let a triage entry be removed from the list

Marco reported this directly on 2026-08-20: *"I need to be able to delete the triage items, I don't
have this option at the moment."*

## ⚠️ Read this before you write a DELETE endpoint

**He said delete. Build archive.** That is not a softening — it is the house rule, recorded twice:

- `sot/06-active-specs.md:1088` — *"**Prefer archive over hard-delete** … A true hard delete is only
  offered (to Sean/Marco) once usage is zero."*
- `docs/plans/directory-archive-decommission-plan.md:5` (LOCKED, Marco 2026-08-10) — *"'delete' =
  **Decommission only** (export + freeze + keep searchable) — **there is NO true hard row-delete**."*

There are **zero** soft-delete columns in the schema (`deletedAt` returns 0 hits across all of
`schema.prisma`) and the CRM module has exactly two `@Delete` routes — `drop-reasons/:id` and
`relationships/notes/:id` — neither for an entry. Adding the first hard row-delete in the codebase,
to satisfy a one-line request, on the module that captures inbound work, is not what was asked for.

**The mechanism you need already exists and is simply unreachable.**
`crm-api.ts:6` already declares `archived` in `CrmStage`, and `PATCH /crm/entries/:id` already accepts
it (`crm.controller.ts:337-341` documents `open | not_pursued | archived` and rejects legacy stages
with a 400). `LeadsTriageList.tsx:30-31` filters to `stage === "open"` and `stage === "not_pursued"`,
so an archived entry already vanishes from this screen. Nothing new is needed server-side. Confirm
that before writing any API code — if `PATCH` already works, the API scope in this prompt is unused
and you should say so in the PR body rather than adding to it.

## What to build

1. **An `Archive` action on the triage card.** `LeadsTriageList.tsx` `TriageRow` (line 73) currently
   renders exactly two buttons. Add a third, visually subordinate to both — this is a tidy-up
   action, not a workflow exit like "Price it" or "Don't pursue". A small text/icon button is right;
   a third full-width orange button is not.
   Thread `onArchive: (id: string) => void` through `Props` (line 3) the same way `onDontPursue`
   is threaded, and wire it in `CrmBoardPage.tsx` to `updateEntry(id, { stage: "archived" })`.

2. **Confirm before archiving.** One click must not silently remove a row. Reuse whatever confirm
   primitive the app already has — `ConfirmDialog` / `useConfirm` shipped as the dialogs foundation;
   grep for it and use it. Do **not** use `window.confirm`, and do **not** build a new modal.

3. 🔴 **Make archived entries reachable again. This is the part that makes it archive and not a
   delete with extra steps.** Today nothing renders `stage === "archived"` anywhere, so an archived
   entry is invisible from every screen — which is a hard delete in everything but the database.
   Add a collapsed **`Archived (N)`** section to `LeadsTriageList`, mirroring the existing
   `Not pursued (N)` section at lines 58-70 (same `NotPursuedRow`-style muted treatment), with a
   **Restore** action on each row that sets `stage: "open"`.
   Collapsed by default and hidden entirely when `N === 0`, so it costs nothing on a clean board.

4. **Undo on the toast.** After archiving, the confirmation toast should offer Restore for as long
   as it is on screen. If the app has no toast primitive, skip this step and say so in the PR body —
   do not build a notification system for it.

## Why archive is the complete answer, not the timid one

Marco's standing rule is to *"lean towards what solves the issue completely (immediately and future)
without damaging existing and/or future data entry."* Both halves apply here:

- **Immediately** — the row disappears from Triage on click, which is the behaviour he asked for.
- **Future** — a CRM entry can already have been converted to a draft tender
  (`POST /crm/leads/:id/generate-draft-tender`). Hard-deleting the entry behind a live tender orphans
  it. Archive cannot do that.

If, having seen this, Marco still wants rows genuinely gone, that is a **different and larger
item** — it needs the export-then-drop shape from the decommission plan, and it needs him to say so
against that plan. Do not pre-empt it here.

## Tests

`apps/web/src/pages/crm/__tests__/LeadsTriageList.archive.test.tsx`, following the style of the
existing tests in that folder:

1. An open entry's card renders an Archive action alongside Price it and Don't pursue.
2. Archiving calls the handler with the entry id and does **not** fire on the confirm being
   dismissed. **This is the one that matters** — a confirm that archives on cancel is worse than no
   confirm.
3. An entry with `stage: "archived"` renders under `Archived (N)` and **not** under `Triage (N)`,
   and the Triage count excludes it.
4. Restore calls the handler with `stage: "open"`.
5. **Negative control:** with zero archived entries the `Archived` section is not rendered at all.

## Do NOT

- Do NOT add a `DELETE` endpoint, a `deletedAt` column, or `prisma.delete` / `deleteMany` anywhere.
- Do NOT reuse the `not_pursued` stage for this. They are different meanings: *not pursued* is a
  commercial decision that carries a drop reason and feeds win/loss reporting; *archived* is "this
  row should not be on my screen". Collapsing them corrupts the drop-reason data.
- Do NOT require a drop reason to archive. `DontPursueModal` exists for the other path.
- Do NOT touch `OpportunityDetailPage`'s existing stage buttons (`STAGES` at line 49) — they already
  expose `archived` and keep working.
- Do NOT change what `listEntries` fetches. It already returns every stage; the filtering is
  client-side and stays that way.

## Guardrails

- One attempt. If `onArchive` already exists in `LeadsTriageList.tsx`, say `NO-OP: <reason>`.
- `pnpm build`, `pnpm lint`, and the new test must pass.
- Four files. If the API turns out to need a change after all, stop and say so in the PR body rather
  than widening into `apps/api`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
