---
premise: '! grep -q "draftCarryOver" apps/api/prisma/schema.prisma'
premise_means: A tender that leaves DRAFT with gaps loses them silently - the panel disappears and nothing on the page says a builder still has no submission date or that no drawings were uploaded - and the list-page Resume-drafts picker is fed the page's own filtered, page-capped list, so it misses drafts and still opens the wizard instead of the tender that now carries the panel. The panel's Builders row is also wrong on every draft, because the detail page hands the derivation a null submissionDate for every builder.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/tendering/tendering.controller.ts
  - apps/api/src/modules/tendering/tendering.service.ts
  - apps/api/src/modules/tendering/__tests__/draft-carry-over.spec.ts
  - apps/web/src/pages/tendering/newTenderWizard.helpers.ts
  - apps/web/src/pages/tendering/DraftCarryOverStrip.tsx
  - apps/web/src/pages/tendering/TenderDetailPage.tsx
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/pages/tendering/__tests__/draft-carry-over.test.tsx
  - apps/web/src/pages/tendering/__tests__/unfinished-drafts-picker.test.tsx
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test -- draft-carry-over unfinished-drafts-picker draft-completeness draft-progress-panel && grep -q "draftCarryOver" apps/api/prisma/schema.prisma && grep -q "DraftCarryOverStrip" apps/web/src/pages/tendering/TenderDetailPage.tsx && grep -q "Unfinished drafts" apps/web/src/pages/tendering/TenderingPage.tsx && ! grep -q "Pick a DRAFT tender to reopen in the wizard" apps/web/src/pages/tendering/TenderingPage.tsx && ! grep -qE "submissionDate:\s*null" apps/web/src/pages/tendering/TenderDetailPage.tsx && test -f docs/data-model/relationship-map.json && node scripts/data-model/build-relationship-map.mjs --check
size: 6
gate_allow: migrations
seed_only: false
escalates: false
backfill: false
rollback_strategy: Additive only - one nullable Json column `draft_carry_over` on `tenders`, no UPDATE ... SET, no default backfill. Safe to leave on main if the run is capped before the code lands; re-running drops nothing. To revert, remove `draftCarryOver` from the Tender model and drop the migration.
module: tendering
cluster: draftpanel
cluster_order: 3
requires_on_main: 'apps/web/src/pages/tendering/DraftProgressPanel.tsx :: DraftProgressPanel'
design_ref: https://claude.ai/code/artifact/4b84db67-140c-41cc-a803-08851e77d246
---

# Draft panel S3 - the carry-over strip, and the picker becomes "Unfinished drafts"

> "would be nice to have the resume draft or resume tender wizard inside each individual
> tender still marked as draft." - Marco

The mock-up (`design_ref`) is the standard. S2 (#1910, on `main`) built states 1-4: the
derivation, the panel, the wizard re-entry. This slice builds the two ends the mock-up left
for S3 - **state 5b** (what survives when a tender leaves DRAFT with gaps) and **state 6** (what
the list-page picker becomes) - and repairs one thing S2 shipped wrong that both of them would
otherwise inherit.

**Marco's four rulings, 2026-09-14** (they settle what the drawing left open):

1. The strip shows only while the tender is in **Estimating** (`IN_PROGRESS`) - the status DRAFT
   hands over to. Never further down the pipeline, never on a DRAFT (the panel owns that).
2. **Dismiss is stored on the server**, so it is gone for everyone - not per browser.
3. A tender that leaves DRAFT **from now on** gets the **full** check - the panel's own 7-step
   result, snapshotted the moment it leaves - and the strip re-checks it live. A tender that left
   DRAFT **before this shipped** (no snapshot) gets the **light** check: builders + documents from
   what the page already loaded, no extra requests.
4. The picker is **kept and re-pointed**: renamed, its own query, rows open the tender.

Rulings 2 and 3 are one column: `Tender.draftCarryOver Json?`.

## Grounding [read on origin/main 834747ef, 2026-09-14 - re-verify line numbers before you edit]

- **The derivation is fed a lie.** `TenderDetailPage.tsx:714-719` and `:743-748` build the
  `BuilderDraft[]` for `deriveDraftCompleteness` with `submissionDate: null` hard-coded and
  `contactId: tc.contact?.id`. The wizard reads the same `GET /tenders/:id` payload and gets
  `tc.submissionDate` and `tc.primaryContactId` (`NewTenderWizard.tsx:307-312`). So
  `detectIncompleteBuilders` (`helpers.ts:191-204`) flags every builder on every draft, the
  Builders row can never be `ready`, and state 4b (*Ready to move on*) is unreachable. The
  `TenderDetail` type (`:51-65`) simply omits the two fields; the API sends them.
- **Draft data is fetched only while DRAFT.** The effect at `:262-303` loads packages, matrix,
  documents and the rate set behind `tender.status !== "DRAFT"` and clears `draftDataLoaded`
  otherwise. The detail payload itself carries `tenderClients` (`:51`) and `tenderDocuments`
  (`:74`, used at `:922`).
- **How a tender leaves DRAFT from its own page:** `changeStatus` (`:341-357`) calls
  `PATCH /tenders/:id/status` with `{ status }`; the panel's *Move to Estimating* (`:770`) goes
  through it with `IN_PROGRESS`. Server side: `UpdateTenderStatusDto`
  (`tendering.controller.ts:64-75`, already carries an optional nested `outcome`), handler `:558-563`,
  `TenderingService.updateStatus(id, status, actorId, outcome)` (`tendering.service.ts:1015-1060`,
  reads `existing` first, builds one `Prisma.TenderUpdateInput`). The **bulk** status action on the
  list page (`bulkUpdateStatus`, `:282`) is a different path and gets no snapshot - ruling 3's
  fallback covers it.
- **Tender model:** `schema.prisma:1311`; `folderProvisioningErrors Json?` (`:1354`) is the Json
  precedent on this model. Latest migration folder: `20260914041500_brandtheme_s4_named_presets`.
- **The panel's home** is the first child of `tender-detail__sections` on Overview, `:703-707`.
  The Documents card is `:919-935`; the builders editor is `TenderEntriesPanel` at `:989`. Both
  are on Overview - the strip's links are in-page, not tab changes. `reload()` is `:223-236`.
- **The picker.** `ResumeDraftPicker` (`TenderingPage.tsx:2491-2544`) is fed
  `tenders.filter((t) => t.status === "DRAFT")` (`:895`) - the active view's filtered,
  page-capped list from `fetchAllPages` (`tenderingPage.helpers.ts:267-289`, `MAX_PAGES = 50`,
  a `truncated` flag the picker never sees). Its rows call `onResume(id)` (`:897-901`), which
  sets `resumeDraftId` and opens the list-page wizard mount (`:878-891`,
  `existingDraftId={resumeDraftId}`). Button *Resume drafts* (`:755-762`); heading *Resume
  incomplete tenders*, subtitle *Pick a DRAFT tender to reopen in the wizard* (`:2508-2509`);
  `(untitled)` at `:2533`.
- **The API already answers the picker's real question.** `GET /tenders` takes `status=DRAFT`
  (comma list, `tendering.controller.ts:131`, `tendering.service.ts:199-200`), `page` /
  `pageSize`, `sortBy=updatedAt` (`:258`). `buildQueryStringWithPage` + `fetchAllPages` build it.
- No test pins the picker's copy or the `Resume drafts` label (grep on `origin/main`: only
  `TenderingPage.tsx`). `draft-completeness.test.ts` and `draft-progress-panel.test.tsx` pin the
  derivation and the panel; `tendering.service.spec.ts`, `tendering-submit-locks-rates.spec.ts`
  and `tendering-win-counted.spec.ts` pin `updateStatus` - all stay green untouched.

## What to build

### 0. Feed the derivation the truth - `TenderDetailPage.tsx`

Add `submissionDate?: string | null` and `primaryContactId?: string | null` to the
`tenderClients` entry of the `TenderDetail` type and pass them through: `contactId:
tc.primaryContactId ?? tc.contact?.id ?? null`, `submissionDate: tc.submissionDate ?? null`.
Lift the two identical `deriveDraftCompleteness(...)` calls (`:708-730`, `:737-759`) into one
`useMemo` so the panel, the resume seeding and the snapshot read one result. No change to the
derivation's rules.

### 1. The column - `schema.prisma` + migration + data-model map

```prisma
// DraftPanel S3 - what was still unfinished when this tender left DRAFT, snapshotted
// from the page that moved it; null for tenders that left DRAFT before this shipped
// or via the bulk action. { capturedAt, rows: [{ step, text }], dismissedAt? }
draftCarryOver           Json?                       @map("draft_carry_over")
```

beside `folderProvisioningErrors`. `npx prisma migrate dev --name draftpanel_s3_draft_carry_over
--create-only`; the SQL must be exactly one `ALTER TABLE "tenders" ADD COLUMN "draft_carry_over"
JSONB` - nothing else. Then `node scripts/data-model/build-relationship-map.mjs` and commit the
regenerated files under `docs/data-model/`. Put `GATE-ALLOW: migrations` **bare, at column 0**
in the PR body.

### 2. The API - `tendering.controller.ts` + `tendering.service.ts`

- `UpdateTenderStatusDto` gains an optional nested `draftCarryOver?: { rows: Array<{ step:
  string; text: string }> }` (class-validator, `@ValidateNested`, `@Type`, `rows` max 7,
  `step` one of the seven wizard keys, `text` max 300 chars). `updateStatus` accepts it as a
  fifth argument and writes `draftCarryOver = { capturedAt: now, rows }` **only when
  `existing.status === "DRAFT"`**; on any other source status the field is ignored (no error).
  Same `prisma.tender.update`, same audit row - one write, atomic with the status change.
- `POST /tenders/:id/draft-carry-over/dismiss` (same permission as `PATCH :id/status`,
  `@CurrentUser`): merges `dismissedAt: now` into the existing Json, or writes `{ dismissedAt }`
  when there is no snapshot (a legacy tender dismissing the light strip). Returns the detail.
- `getById` already returns every scalar on the model; confirm `draftCarryOver` reaches the
  detail payload (it does unless a `select` narrows it - check `:634`).
- `draft-carry-over.spec.ts` (the unit style of `tendering-submit-locks-rates.spec.ts`):
  DRAFT -> IN_PROGRESS with rows writes the snapshot with `capturedAt`; IN_PROGRESS -> SUBMITTED
  with rows writes nothing to the column; dismiss on a tender with a snapshot keeps `rows` and
  adds `dismissedAt`; dismiss on a tender with `null` writes `{ dismissedAt }`.

### 3. `selectCarryOverRows` - `newTenderWizard.helpers.ts`

One pure function beside `deriveDraftCompleteness`:

```ts
selectCarryOverRows(completeness: DraftCompleteness, mode: "full" | "light"): CarryOverRow[]
// CarryOverRow = { step: WizardStepKey; text: string }
```

`"full"` returns every step whose state is `partial` or `outstanding` **except** `rates` (the
gate is not the strip's business - mock-up) and the two not-checkable steps. `"light"` returns
only `builders` (`partial` | `outstanding`) and `documents` (`outstanding`, zero files). `text`
is the step's `why`; for builders prefer the per-builder wording `formatReminderBody()` already
produces (`helpers.ts:206-211`) when the caller passes the reminders.

### 4. Snapshot at the moment of leaving DRAFT - `TenderDetailPage.tsx`

`changeStatus(next)` - when `tender.status === "DRAFT"` and the memoised completeness is
loaded - sends `{ status: next, draftCarryOver: { rows: selectCarryOverRows(completeness,
"full") } }`. When the draft data is not loaded yet, send the status alone (never block a status
change on the snapshot). The status select and the panel's *Move to Estimating* both go through
`changeStatus`, so both snapshot.

### 5. The strip - `DraftCarryOverStrip.tsx`

State 5b, as drawn: one warning-toned line (`--status-warning` tint and border, the same
`s7-*` classes the panel uses), a `!` glyph, *N things were left unfinished when this tender
left Draft.*, the rows joined with ` · `, the muted line *Fix them where they live - the wizard
is for building a tender, not maintaining one.*, a button per row that has a home on Overview
(*Builders →*, *Documents →*; packages / project rows print as text only), and **Dismiss**.
`export const DRAFTPANEL_S3_V1 = "draftpanel-s3"`.

- Rendered on Overview in the panel's slot (`:705`), **only when all of**: `tender.status ===
  "IN_PROGRESS"`, `draftCarryOver?.dismissedAt` is absent, and the live row set is non-empty.
- **Which rows (ruling 3):** if `tender.draftCarryOver?.rows` exists, start from those rows -
  then **re-check builders and documents live** against `tenderClients` / `tenderDocuments`
  (through `deriveDraftCompleteness` with empty packages / matrix / null rate set) and drop a
  row the estimator has since fixed; packages / project rows stay as snapshotted. If there is no
  snapshot, the row set is `selectCarryOverRows(liveCompleteness, "light")`. Either way the
  strip costs **zero extra requests** - do not widen the DRAFT-only draft-data effect.
- *Builders →* / *Documents →* scroll to the two Overview sections: give the Documents card
  (`:919`) and the builders card (`:989`'s section) stable `id`s (`tender-builders`,
  `tender-documents`) and `scrollIntoView({ block: "start" })`. No tab change, no wizard.
- **Dismiss** calls `POST /tenders/:id/draft-carry-over/dismiss` then `reload()`. Gone for
  everyone. No localStorage.
- `data-testid`s: `draft-carry-over`, `draft-carry-over-row-<step>`,
  `draft-carry-over-link-<step>`, `draft-carry-over-dismiss`.

### 6. The picker becomes *Unfinished drafts* - `TenderingPage.tsx`

The mock-up's state 6 verdict: **keep it, but change what it is.**

- Button label (`:761`) → **Unfinished drafts**. Heading → *Unfinished drafts*. Subtitle →
  *Every draft, whatever the current filter. Open one to see what is left and pick up from
  there.*
- **Its own query.** On open, the picker fetches `fetchAllPages(authFetch, { ...EMPTY_FILTERS,
  status: ["DRAFT"], sortBy: "updatedAt", sortDir: "desc" })` itself - independent of the view,
  the filter bars and the board's list. Skeleton while loading, the existing empty state when
  zero, and when `truncated` a muted line *Showing N of M drafts - the rest are older than what
  fits here.*
- **Rows open the tender**, not the wizard: `navigate(\`/tenders/${d.id}\`)`. Each row: title
  (`(untitled)` stays), tender number, *updated <relative>* from `updatedAt`.
- Remove what the re-point orphans: the `resumeDraftId` state, `existingDraftId` on the
  list-page wizard mount (`:882`; the wizard stays mounted there for **+ New tender**), and the
  `onResume` prop. `ResumeDraftPicker` is renamed `UnfinishedDraftsPicker`.

### 7. Web tests

- `draft-carry-over.test.tsx` (no jsdom for the helper; `renderToStaticMarkup` for the strip,
  as `draft-progress-panel.test.tsx` does): `"full"` returns packages + builders + documents for
  state 4a's fixture and never `rates` / `ai` / `review`; `"light"` returns only builders and
  documents; a snapshot row for builders disappears once the live payload shows the builder
  fixed; the strip renders nothing when `dismissedAt` is set or the row set is empty; a source
  assertion that `TenderDetailPage.tsx` no longer contains `submissionDate: null` and that
  `changeStatus` sends `draftCarryOver` only from DRAFT.
- `unfinished-drafts-picker.test.tsx`: the query string carries `status=DRAFT` and no other
  filter; a row click navigates to `/tenders/<id>` and never sets `existingDraftId`; the
  truncated line appears iff `truncated`.

## Do NOT

- Do NOT store dismissal in localStorage. Do NOT add any column beyond `draftCarryOver`.
- Do NOT show the strip on any status but `IN_PROGRESS`, on a DRAFT, or when nothing is
  outstanding. Do NOT put `rates` in it.
- Do NOT let the strip open the wizard or change tab. Do NOT widen the draft-data fetch to
  non-DRAFT tenders. Do NOT make the status change wait on, or fail because of, the snapshot.
- Do NOT touch `DraftProgressPanel.tsx`, `NewTenderWizard.tsx`, `deriveDraftCompleteness`'s
  rules, `bulkUpdateStatus`, `TenderRateSetService`, or `/sot/`.
- Do NOT delete the picker. The list page has no Drafts view; until it does, this is the only
  place an untitled, builder-less, value-less draft is visible at all.
- Do NOT draw a percentage, a ring, or a strip that cannot be dismissed.

## VERIFY before opening the PR

```
pnpm --filter @project-ops/api test -- draft-carry-over tendering-submit-locks-rates tendering.service
pnpm --filter @project-ops/web test -- draft-carry-over unfinished-drafts-picker draft-completeness draft-progress-panel
pnpm build && pnpm lint
node scripts/data-model/build-relationship-map.mjs --check
grep -c "ADD COLUMN" apps/api/prisma/migrations/*draft_carry_over*/migration.sql             # exactly 1
grep -n "submissionDate: null" apps/web/src/pages/tendering/TenderDetailPage.tsx             # must be empty
grep -n "existingDraftId" apps/web/src/pages/tendering/TenderingPage.tsx                     # must be empty
grep -n "Unfinished drafts" apps/web/src/pages/tendering/TenderingPage.tsx                   # button + heading
grep -c "DraftCarryOverStrip" apps/web/src/pages/tendering/TenderDetailPage.tsx              # >= 2
```

PR body: `GATE-ALLOW: migrations` bare at column 0; quote the migration SQL, the two corrected
`BuilderDraft` mappings, the strip's three render conditions, and the picker's query string.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - if you cannot do it, say `NO-OP: <reason>` and why.
- Never ask a question or "stand by" for approval. A dismissed or unanswered question is the
  absence of a human, not a stop signal. Proceed on best judgement and record the assumption in
  the PR body.
- Read the job log before diagnosing any CI failure.
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, any
  irreversible action. Say `NO-OP: <reason>`.
- The completion test: is there a PR number in your output? If the reason for "no" is "I am
  waiting for someone" - there is nobody. Open the PR.

## STATUS

Armed by Station 00 under Marco's direction. Once this file carries the `-ready.md` suffix that
rename IS the dispatch - build it and open the PR; this section is never a reason to wait. Third
and last in the `draftpanel` cluster; dispatches once S2's `DraftProgressPanel` is on `main`
(it is, #1910).
