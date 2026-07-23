# Shepherd State

Records merge conflict resolutions and their outcomes.

---

## PR #732 feat/erp-site-signin — resolved 2026-07-20, merged 2026-07-21

**Merge commit (conflict-resolution):** `9004bd81`
**PR merge commit (squash to main):** `9f7abea3`

**Cause:** main advanced past this branch via #723 (`feat(erp): cost-to-complete forecast per job`), then #728 (`PrequalificationRequest`) and the KnowledgeModule work landed, all touching the same registration points.

**Files resolved (both sides kept, main first then #732):**
1. `apps/api/prisma/schema.prisma` — main added `KbArticle` model; this PR added `SiteAttendance` model
2. `apps/api/src/app.module.ts` — main registered `KnowledgeModule`; this PR registered `SitesModule`

**Both-sides-survived confirmation:**
- `SiteAttendance` present in schema and `SitesModule` registered in AppModule
- `KbArticle` present in schema and `KnowledgeModule` registered in AppModule

**Build/lint:** PASS (`pnpm build` + `pnpm lint`)

**done_when:** `git merge-base --is-ancestor origin/main origin/feat/erp-site-signin` — branch was deleted post-merge; PR merged `2026-07-21T00:44Z`. VERIFIED via `gh pr view 732` state: MERGED.

**PR comment:** https://github.com/GH-Mantova/ProjectOperations/pull/732 (conflict-resolution comment posted 2026-07-20T13:36Z)

**Note:** This prompt was surfaced again 2026-07-23 but PR #732 was already merged. Premise premise `! git merge-base --is-ancestor origin/main origin/feat/erp-site-signin` cannot be evaluated (branch deleted). PR state MERGED confirmed. Prompt moved to processed/.

---

## PR #722 feat/crm-lead-opportunity — resolved 2026-07-20

**Merge commit:** `82a2a125`

**Cause:** main advanced via #723 (`feat(erp): cost-to-complete forecast per job`) after the branch's last merge-base (`de450167`), creating four additive registration-point conflicts.

**Files resolved (both sides kept, main first then #722):**
1. `apps/api/prisma/schema.prisma` — User CRM relations + Lead/Opportunity models alongside KbArticle model
2. `apps/api/src/app.module.ts` — CrmModule import/registration alongside KnowledgeModule
3. `apps/web/src/App.tsx` — CRM routes alongside KB routes
4. `apps/web/src/components/ShellLayout.tsx` — CRM nav entry alongside KB nav entry

**Both-sides-survived confirmation:**
- `schema.prisma`: `model Lead` (line 6066), `model Opportunity` (line 6105), `model KbArticle` (line 6161)
- `schema.prisma`: `leadsOwned` (line 200), `opportunitiesOwned` (line 201), `kbArticlesAuthored` (line 203)
- `app.module.ts`: `CrmModule` (lines 70, 146), `KnowledgeModule` (lines 69, 145)
- `App.tsx`: `CrmBoardPage` (lines 100, 348), `KbListPage` (lines 98, 346)
- `ShellLayout.tsx`: `"/crm": "CRM"` (line 388), `"/knowledge": "Knowledge Base"` (line 387)

**Build/lint:** PASS (`pnpm build` + `pnpm lint`)

**done_when:** `git merge-base --is-ancestor origin/main origin/feat/crm-lead-opportunity` returns exit 0. VERIFIED.

**PR comment:** https://github.com/GH-Mantova/ProjectOperations/pull/722#issuecomment-5022754533
