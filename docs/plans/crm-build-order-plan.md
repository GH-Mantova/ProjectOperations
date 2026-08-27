# CRM build-order plan — the last mile, in dependency order

**Status:** PLAN (slice-0). Approved by Marco 2026-08-27 after a screen-by-screen walk of the mock-up.
**Cluster prefixes:** `crm-build` (S1–S11), `crm-reminders` (S12–S14), `pipeline-guard` (P0-a/b, not CRM).
**Owner:** Marco.
**Marker:** `CRM_BUILD_ORDER_V1` — every slice in this programme gates on this literal via `requires_on_main`.
**Rule:** every code slice chains behind this document. Slices ship independently, each CI-green,
each ≤ ~10 files. Arm ONE AT A TIME.

---

## 1. Why this plan exists

`crm-module-plan.md` (2026-08-12) defined CRM-1..CRM-6. Measured against its own description of each
slice on 2026-08-27 at `478112c5`, **one of six delivers** (CRM-6, the pipeline dashboard). The other
five have their schema, service and controller on main and stop one step short of a user reaching or
using them. Separately, the tender-reminders cluster (TR-1..TR-4) — the follow-up engine the CRM exists
for under Marco's 2026-08-20 ruling — has not started.

Measured shape of the shortfall:

- **18 API endpoints have no web caller.** All six Accounts routes, all three lead-intake routes,
  thread archive/unarchive, note PATCH/DELETE, the five legacy lead routes.
- **Three finished pages have no nav entry** — `/crm/relationships` (427 lines),
  `/crm/opportunities/:id`, `/administration/crm-drop-reasons` (420 lines).
- **Five schema columns are written by nothing** — `Opportunity.ownerId`, `.captureChannel`,
  `.captureDetail`, `.notes`, and `Account.archivedAt`.
- **Callers with no endpoint: zero.** All 28 `/crm/*` calls in the web tree resolve. The gap is only
  ever in the last mile.
- **Three additive FK columns shipped with no backfill and no write path** — `contacts.account_id`,
  `opportunities.account_id`, and an Account for every Client created since 2026-08-14. Nine Account
  rows exist against a register of hundreds of tenders.

This plan is the last mile, ordered.

## 2. Marco's decisions (2026-08-27) — bake in, do NOT re-litigate

1. **Keep all four**: the Relationships page, the Comms hub as a decoupled sub-module, the lead-intake
   module, and the CRM Tenders register as a distinct CRM view. Wire them up; do not retire or replace.
2. **Nav is flat, and nesting happens as tabs inside the page** — never as a collapsible sidebar parent.
   Three CRM items: **Accounts** (List · Relationships), **Tenders** (Register · Follow-ups),
   **Comms hub** (Inbox · Threads · To-dos).
3. **Lead intake merges into the Comms hub as the Inbox tab.** One window, one nav item.
   **In code the boundary stays**: comms imports nothing from Tender or Job, and the triage actions
   (Price it / Don't pursue) remain owned by the intake module. This is the whole point of decision 1.
4. **The comms anchor spans Lead · Tender · Job · Account · Contract · Other**, as a two-step picker
   (type, then record).
5. **Next action is an output, not a typed field.** Logging an interaction records channel, author and
   body AND sets the next action in the same write. `Last interaction`, `Logged by` and `Next action`
   are read together because the first two produce the third.
6. **Register and Follow-ups are one screen, two tabs**, over one list with toggleable filters —
   not two data sources.
7. **Bulk-linking clients to accounts is preview-then-confirm**, never one click. The link itself is
   unambiguous (`Account.clientId` is unique, so it is 1:1 by construction); the *lifecycle* is an
   inference and must be shown per row and editable before commit.
8. **Archive needs a governed reason**; delete exists only for an empty lead. Nothing with content is
   ever deletable.

## 3. Ground truth (cited against origin/main `478112c5`)

- `apps/web/src/pages/crm/CommsHubPage.tsx:165` filters tasks on `assigneeId: user.id`;
  `:482-500` creates them without one. `assigneeId` appears exactly once in the 705-line file.
- `apps/web/src/pages/crm/RelationshipsPage.tsx:214-216` posts `accountId: null, contactId: null`;
  `apps/api/src/modules/crm/relationships/relationships.service.ts:58-62` rejects exactly that.
- `CommsHubPage.tsx:453` — `createThread` returns early unless `anchored`; `:396` derives `anchored`
  from the query string only. Nothing in the app builds an anchored URL except the hub itself.
- `apps/api/src/modules/crm/accounts/accounts.controller.ts:80,100,120,128,138,152` — six routes,
  no web caller. `accounts.service.ts:218` `getAccount360` rolls up contacts, tenders and jobs only.
- `apps/api/src/modules/master-data/master-data.service.ts:178` creates a Client and writes no Account.
- `model RelationshipNote` anchors to **account and contact only** and carries **no channel**. The
  register rows are tenders and opportunities. See §5 — this is the open decision.
- `model DropReason` is the governed reason list (`dropReasonId` + `dropReasonDetail` on Opportunity);
  archive today is a bare `stage: "archived"` with no reason captured, and there is no delete route.
- `scripts/pr-watcher/index.mjs:1969-1973` `renderTemplate` passes only PR number and title into the
  review agent; `syncMain()` at `:1717` is called from one site at `:2477`, inside a block review jobs
  skip. That is why review verdicts describe file changes that were never in the PR.

## 4. Slices

| ID | Slice | Size | Gate | Requires |
|---|---|---|---|---|
| P0-a | Verdict guard — assert named files are in the PR | 4 | none | `index.mjs :: mirrorVerdictToPr` |
| P0-b | Prompt search by branch, in the real queue dir | 2 | none | `index.mjs :: validateVerdict` |
| S1 | Unblank to-dos and notes | 3 | none | this plan on main |
| S2 | Nav to three items with tabs | 3 | none | `RelationshipsPage.tsx :: buildCreateNoteBody` |
| S3 | Account on client-create + FK backfill | 5 | migrations | `ShellLayout.tsx :: CRM_NAV_TABS` |
| S4 | Review-and-link preview | 4 | none | `master-data.service.ts :: ensureAccountForClient` |
| S5 | Accounts CRUD wiring | 4 | none | `AccountsListPage.tsx :: AccountLinkPreview` |
| S6 | Account 360 roll-ups + Log contact on row | 5 | none | `crm-api.ts :: patchAccount` |
| S7 | Interaction log → next action | 5 | migrations | `accounts.service.ts :: rollUpContracts` **+ §5 decision** |
| S8 | Register & Follow-ups, one screen | 6 | none | `schema.prisma :: InteractionChannel` |
| S9 | New thread, anchored | 4 | none | `TendersRegisterPage.tsx :: CRM_REGISTER_V2` |
| S10 | Inbox tab | 4 | none | `CommsHubPage.tsx :: AnchorPicker` |
| S11 | Archive with reason, delete when empty | 4 | migrations | `CommsHubPage.tsx :: CommsInboxTriage` |
| S12 | Re-scope TR-1..4 to the CRM surface | 2 | none | `schema.prisma :: InteractionChannel` |
| S13–S14 | Reminder policy and engine | — | migrations | sized after S12 |

Each `requires_on_main` names a symbol its predecessor creates and that is **verified absent on
`478112c5`**. No `requires_merged`, no guessed PR numbers.

## 5. OPEN DECISION — blocks S7, and therefore S8 and S12

`Last interaction` and `Logged by` are needed on **tender and opportunity** rows.
`RelationshipNote` anchors to **account and contact** only and has no channel. Three options:

- **(a) Extend the note** — add `channel`, plus optional `opportunityId`/`tenderId`. One log, one read
  path, additive migration. Makes the model broader than its name.
- **(b) Reuse `CommThread`** — it already carries the polymorphic anchor the register needs. No new
  model, but it turns every logged phone call into a conversation thread.
- **(c) New interaction model** — cleanest conceptually, one more table, two note-ish things in the schema.

Station 06 leans (a). **Not decided. S7 is staged `do-not-arm` until Marco rules.**

## 6. Out of scope

- **Email auto-log (CRM-5).** Model and write service exist; the capture worker depends on Marco's
  M365 / Entra provisioning. Do NOT create or modify any Azure / Entra / SharePoint configuration.
- **Client → Account absorption.** `crm-module-plan.md` calls it the declared destination and defers it.
  Still deferred.
- Moving Leads & opportunities or Pipeline out of Tendering.
- Retiring any route, including the legacy `/crm/leads` API routes.

## 7. Do NOT (programme-wide)

- Do NOT delete or retire a page, route or endpoint. Every gap in §1 is closed by wiring, not removal.
- Do NOT fold the intake triage actions into the comms module (decision 3).
- Do NOT build an assignee picker on `/users` or `/admin/users` — both require `users.view` and
  `/admin/users` 403s non-admins, so a CRM user could not populate it. Default to self; a proper
  picker is a later slice that must first decide on a `crm.view`-gated assignee list.
- Do NOT change `getAccount360`'s existing three roll-ups while adding to them.
- Do NOT edit `/sot/`. Do NOT use `requires_merged` with guessed PR numbers.
