# Contract handover wizard — tender→contract conversion, WBS seed, versioned template, gated job creation

**Status:** draft 2026-08-06 (Marco brainstorm 2026-08-05/06; grounded against `origin/main` HEAD).
**Owner:** Marco / ProjectOperations estimating → delivery.
**Rule:** every code slice chains behind this document (`requires_merged` / `requires_file_on_main`).
Slices ship independently, each ≤ ~10 files, each CI-green. Schema slices declare
`gate_allow: migrations` and a `rollback_strategy`. `/sot/` edits land only in a dedicated reconcile
slice (SoT-Keeper).

This program builds the estimator→PM handover as a **wizard launched at the tender→contract
conversion**. It absorbs item **#1** (contract value breakdown) as the wizard's pricing step.
It is independent of item **#7** (sites→jobs).

---

## 1. Decisions ledger (locked with Marco 2026-08-05/06)

1. **Trigger.** Moving a tender to Contract (the confirm pop-up on the tender timeline)
   (a) creates a `Contract` record immediately so it appears on `/contracts` — closing the
   gap that `issueContract` today only flips status; and (b) launches the handover wizard.
2. **One flow, resumable.** The wizard is a savable draft with a completion %. On reaching
   100% it prompts "create the job"; on confirm the system creates the Job on the ERP **and**
   provisions the SharePoint folder — reusing the deployed `convertTenderToJob` path — and
   snapshots the handover + WBS as the job baseline.
3. **WBS source.** Reuse the existing tender scope structure as-is (`ScopeCard` →
   `ScopeOfWorksItem.wbsCode`). Pull the **awarded client's highest `ClientQuote` revision**
   (`TenderClient.isAwarded` + `@@unique([tenderId, clientId, revision])`). Allow light edits
   in the wizard; deeper breakdown is the PM's job on the live job.
4. **History = minimal.** Only quoted-vs-contracted: awarded `ClientQuote` total vs
   `Contract.contractValue`, shown as a variance. No node-level change log.
5. **Client program = attachment only.** Uploaded as a document; the PM/OM break it down on the
   live job, not in the wizard.
6. **Template is configurable + versioned.** Sections and fields can be renamed / added /
   removed / reordered in Settings. Each save is an **explicit Publish** producing a new version.
   Every handover **pins the template version it was created on** (freeze) — same mechanism as the
   T&C `legal-doc-versioning` ADR. Field stable IDs make rename/remove non-destructive to saved
   data (retire, never delete).
7. **Auto-field safeguards.** Prefill is **one-way** (handover stores its own copy; never writes
   back to tender/quote/contract). Edited auto-fields show an "edited — differs from source"
   badge + reset-to-source; a re-sync prompt appears if the source changed before finalise;
   after finalise the handover is frozen. Derived fields (variance, completion %) are computed,
   never hand-editable.
8. **Compliance = hybrid.** Obligations (SWMS, Form 65 demolition/asbestos, permits,
   disconnection certificates) are **suggested from WBS activity types** (rowType/discipline)
   and the estimator confirms or adds manually, with a responsible-party flag (us / client).
9. **Permissions.** Template editing = new `handovertemplate.manage`, a standard **grantable**
   permission: seeded to Marco, Colin and Sean, and assignable to any other user by
   super-admin/admin through the existing role/permission management (`permission-registry.ts`).
   Filling/finalising a handover = existing `tenderconversion.manage`.

---

## 2. Grounding (pinned to origin/main)

- **Conversion today.** `apps/api/src/modules/jobs/jobs.service.ts` — `awardTenderClient`
  (→ `AWARDED`), `issueContract` (~:1102, → `CONTRACT_ISSUED`, **writes no Contract row**),
  `convertTenderToJob` (creates Job + SharePoint folder `…/Jobs/{number}_{slug}` +
  `JobConversion` + `SearchEntry`). `ProjectsService.convertFromTender` allocates `IS-P###`,
  snapshots the estimate, **flattens scope**, moves documents, notifies PM.
- **Contract.** `contracts.service.ts` — `createContract({ projectId, contractValue, … })`
  requires an existing Project (Contract is 1:1 with Project); `listContracts` renders `Contract`
  rows joined to Project. Pins the active T&C version at create (legal-doc-versioning ADR).
- **Awarded quote.** `ClientQuote` (`@@unique([tenderId, clientId, revision])`, `detailLevel`,
  `status`, `adjustmentPct`) with children `QuoteCostLine`, `QuoteProvisionalLine`,
  `QuoteAssumption`, `QuoteExclusion`, `QuoteScopeItem.sourceItemId`. `TenderClient.isAwarded`.
- **Scope / WBS.** `ScopeCard` (discipline group, DEM1/CIV1) → `ScopeOfWorksItem` (`wbsCode`,
  `rowType`, dims, `men`/`days`); `ScopeOfWorksHeader` (siteAddress, accessConstraints,
  proposedStartDate, durationWeeks). Activity level downstream: `JobStage → JobActivity → Shift`.
- **Reusable patterns.** `CompanyLegalDocument` (version + isActive, pinned at issue) → freeze;
  `ScopeViewConfig` (JSON-defined configurable columns) → template storage; `GlobalListItem`
  (Director-configurable lists) → list-type fields.

---

## 3. Target architecture

**Flow:** tender timeline → *Move to Contract* confirm → **Contract created** (prefilled from
awarded quote, shows on `/contracts` with a completion bar) → **handover wizard** (resumable) →
*finalise* → prompt → **Job on ERP + SharePoint** (reuses `convertTenderToJob`) + baseline
snapshot + generated handover PDF.

**Wizard steps** (rendered from the active template version): Pricing & budget (**= #1**) ·
Scope of works · Key contacts & procurement · Documentation, compliance & approvals · Site /
logistics / programme · Risk & watch-items / handover notes. Every field tagged
auto / capture / attach / derived.

**Contract-before-project.** A `Contract` must exist at the contract moment, before any Project.
Make `Contract.projectId` nullable and add `Contract.tenderId` + `tenderClientId`; link the
Project at job creation (finalise). Existing rows keep their `projectId` — additive, reversible.

---

## 4. New schema (summary; exact fields fixed in each slice)

- **HandoverTemplate** (`version`, `isActive`, `publishedAt`, `publishedById`).
- **HandoverTemplateSection** (`templateId`, `key`, `label`, `sortOrder`).
- **HandoverTemplateField** (`sectionId`, `key` **stable/immutable**, `label`, `type`
  ∈ text|money|date|list|attachment|contact, `sourceType` ∈ auto|capture|attach|derived,
  `autoBinding?`, `listId?`, `required`, `sortOrder`, `retiredAt?`).
- **Handover** (`contractId`, `tenderId`, `templateVersionId` **pinned**, `status`
  ∈ draft|finalised, `completionPct`, `createdById`, `finalisedAt?`).
- **HandoverValue** (`handoverId`, `fieldKey`, `value` Json, `sourceValue` Json?,
  `isOverridden`, `sectionDone`).
- **HandoverComplianceItem** (`handoverId`, `type`, `origin` ∈ suggested|manual,
  `responsibleParty` ∈ us|client, `status`, `docRef?`).
- **HandoverSubcontractor** (`handoverId`, `name`, `quoteRef?`, `poRef?`, `folderSlot`).
- **HandoverAttachment** (`handoverId`, `fieldKey|category`, `docRef`).
- **Contract** += nullable `tenderId`, `tenderClientId`; `projectId` → nullable.

---

## 5. Slice list (ordered, independently shippable) — prefix **B-HW-**

Gates use `requires_file_on_main` on the canonical NEW artifact each prerequisite slice creates,
so a slice can only run once its real dependencies are on `main`. Escalating slices build a PR but
never auto-merge (they wait for Marco). SLICE-0 is this plan; it may auto-merge to arm the chain —
the escalating schema + job-creation slices remain the human gates.

| Slice | Purpose | Creates (gate artifact) | Depends on (files on main) | size | gate_allow | escalates |
|---|---|---|---|---|---|---|
| B-HW-1 | `handovertemplate.manage` perm + HandoverTemplate/Section/Field schema + seed default template | `apps/api/prisma/seeds/handover-default-template.ts` | plan.md | 7 | migrations | **yes** |
| B-HW-2 | Template CRUD + explicit publish/versioning API (grantable, admin-assignable) | `apps/api/src/modules/handover-templates/handover-templates.service.ts` | B-HW-1 seed | 6 | none | no |
| B-HW-3 | Template editor UI (Settings → Handover Template) | `apps/web/src/pages/settings/HandoverTemplatePage.tsx` | B-HW-2 service | 8 | none | no |
| ~~B-HW-4~~ **FOLDED INTO B-P0a-4** | Contract-at-issue is merged into the B-P0a-4 conversion-unify slice (see §6) — one coherent rewrite of `jobs.issueContract`. That Marco-present slice creates `apps/api/src/modules/contracts/contract-at-issue.service.ts`, makes `Contract.projectId` nullable, and adds `tenderId`/`tenderClientId`. Standalone `pr-hw-4` prompt removed. | (produced by B-P0a-4) | — | — | — | via B-P0a |
| B-HW-5 | Handover instance schema (Handover + Value + Compliance/Subcontractor/Attachment) pinned to templateVersion | `apps/api/src/modules/handovers/handover.types.ts` | B-HW-1 seed, `contract-at-issue.service.ts` (created by B-P0a-4) | 8 | migrations | **yes** |
| B-HW-6 | Handover API: create-on-contract, get/patch values, one-way prefill from awarded quote, completeness, section-done | `apps/api/src/modules/handovers/handovers.service.ts` | B-HW-5 types | 8 | none | no |
| B-HW-7 | Wizard UI shell: launch from confirm, render pinned template as steps, draft/resume, completion bar | `apps/web/src/pages/handover/HandoverWizardPage.tsx` | B-HW-6 service, B-HW-3 page | 9 | none | no |
| B-HW-8 | Auto-field safeguards: edited badge + reset, pre-finalise re-sync, derived variance | `apps/web/src/pages/handover/autoFieldSafeguards.ts` | B-HW-7 page | 6 | none | no |
| B-HW-9 | Compliance derivation: activity rowType/discipline → suggested obligations + manual add + responsible-party | `apps/api/src/modules/handovers/compliance-derivation.ts` | B-HW-6 service | 7 | none | no |
| B-HW-10 | Subcontractors/procurement capture + quote/PO link + folder-slot mapping | `apps/api/src/modules/handovers/handover-subcontractors.service.ts` | B-HW-6 service | 6 | none | no |
| B-HW-11 | Finalise → create job: reuse convertTenderToJob, link Project to Contract, snapshot baseline, generate handover PDF, scaffold folder tree | `apps/api/src/modules/handovers/handover-finalise.service.ts` | B-HW-8, B-HW-9, B-HW-10 | 9 | none | **yes** |

**B-HW-12 (SoT reconcile)** — sot/04 data-model additions + sot/01 nav if changed. **SoT-Keeper
only**; NOT staged here (the pipeline routes `/sot/` edits to station 05).

**Sequencing.** Template chain (1→2→3) runs behind the plan; **contract-at-issue is delivered by
B-P0a-4 (Marco-present, §6), not a standalone B-HW slice**; B-HW-5 waits for B-HW-1 + the
`contract-at-issue.service.ts` that B-P0a-4 creates; 6 gates 7/9/10; 11 waits for 8+9+10. Schema
changes (B-HW-1, B-HW-5) and the job-creation step (B-HW-11) escalate — they open PRs but wait for
Marco to merge.

---

## 6. Cross-references

- **B-P0a-4 absorbs contract-at-issue (Marco 2026-08-06).** B-P0a is mid-flight — slices B-P0a-1/-2/-2b/-3 are already merged; the frontier is **B-P0a-4** (conversion-unify). B-P0a-4 already rewrites `jobs.issueContract` (delegate to `ContractsService`) and re-points `JobConversion → projectId`. Rather than have the standalone B-HW-4 rewrite the same method, contract-at-issue is **folded into B-P0a-4**: that one Marco-present slice unifies conversion AND creates the `Contract` at issue, creating `apps/api/src/modules/contracts/contract-at-issue.service.ts` (so B-HW-5's gate is satisfied), making `Contract.projectId` nullable, and adding `tenderId`/`tenderClientId`. The standalone `pr-hw-4-contract-at-issue-ready.md` prompt is removed so it can never run into the active merge. **Follow-up for SoT-Keeper:** reconcile `sot/04-data-model.md` B-P0a-4 scope to note the added contract-at-issue behaviour.

- **#1 (contract value breakdown)** ships as the wizard's Pricing & budget step (B-HW-6/7 render it
  from `QuoteCostLine` + `QuoteProvisionalLine`); there is no separate #1 program.
- **#7 (sites→jobs)** is independent; job creation here uses `convertTenderToJob` regardless.
- **SharePoint scaffold** extends the folder tree `convertTenderToJob` already builds; exact folder
  names confirmed with Marco before B-HW-11.
