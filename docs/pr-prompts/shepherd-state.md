# Shepherd State

Records merge conflict resolutions and their outcomes.

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
