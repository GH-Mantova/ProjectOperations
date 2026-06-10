# pr-test-analyzer findings on PR #342 + #343

**Date:** 2026-06-10
**Source:** VS Code's built-in `pr-review-toolkit:pr-test-analyzer` agent (ran while attempting to invoke our pr-tester, which hadn't loaded yet)
**Status:** PARTIAL — F2-01 RESOLVED (pr-146); F2-02..F2-05 remain open

---

## F2-01 (HIGH, **RESOLVED 2026-06-10 via pr-146**) — `deleteSite` missing `formSubmissions` referential guard

**PR:** #342 (merged 2026-06-10) — `[Feat/§4 API] DELETE /master-data/sites/:id`
**File:** `apps/api/src/modules/master-data/master-data.service.ts` — `deleteSite()` method

**Issue:** the referential-integrity guard checks `_count.tenders` and `_count.jobs`, but `Site` also has a `formSubmissions FormSubmission[]` relation per the Prisma schema. A site with form submissions can be deleted silently, orphaning compliance records.

**Impact:** breaks the audit trail. Form submissions are the WHS/compliance evidence — losing the linking site without notice is bad for the audit trail Initial Services depends on.

**Fix sketch (for a future pr-146):**

```typescript
const site = await this.prisma.site.findUnique({
  where: { id },
  include: {
    _count: {
      select: { tenders: true, jobs: true, formSubmissions: true },  // add formSubmissions
    },
  },
});
// ...
if (site._count.formSubmissions > 0) {
  blockers.push(`${site._count.formSubmissions} linked form submission(s)`);
}
```

Plus one extra test case in `master-data.service.spec.ts`: "throws ConflictException when form submissions are linked".

---

## F2-02 (MEDIUM) — `getDocumentsForSite` access-rule filter has zero test coverage

**PR:** #343 (merged 2026-06-10) — `[Feat/§4+§14 API] Site documents rollup endpoint`
**File:** `apps/api/src/modules/documents/documents.service.spec.ts` — `getDocumentsForSite` describe block

**Issue:** the 4 existing unit tests all stub `getActorRoles → []` and seed `accessRules: []` on every doc. So `canAccessDocument` returns `true` unconditionally for every item. The entire ROLE/PERMISSION filtering branch — the security boundary of the endpoint — is structurally untested.

**Regression risk:** if a future refactor removes or breaks the `.filter(canAccessDocument)` line, no test fails. Restricted documents would be exposed silently.

**Fix sketch (for a future pr-147):**

Add two test cases:
1. "filters out documents the actor cannot view" — seed a doc with `accessRules` denying the actor's role, assert `items` excludes it and `total` reflects the filtered count
2. "filter-then-paginate order" — combine the filter with `skip:0, take:1` and assert pagination operates on the filtered set, not the raw set

Also a lint follow-up: the spec uses `as never` / `as any` casts which violate the repo's `no-any` convention.

---

## F2-03 (MEDIUM) — `SiteDetailPage.handleDelete` status-code branching is untested

**PR:** #344 (open at time of finding) — `[Feat/§4 UX] Sites detail tabs + KPI + Delete`
**File:** `apps/web/src/pages/sites/SiteDetailPage.tsx`

**Issue:** `handleDelete` encodes four distinct status-code branches (204 → navigate + toast, 404 → toast + redirect, 409 → inline `body.message` with fallback, other → generic), plus a `.catch(()=>null)` for a malformed 409 body. None of these branches are unit-tested.

**Regression risk:** a refactor flipping the 409 branch to the generic branch would strip the referential-integrity message (Marco wouldn't know why he can't delete a site). CI stays green.

**Existing pattern to follow:** `apps/web/src/pages/admin/resetUserPassword.ts` extracts the equivalent admin flow's branching into a plain helper that's unit-tested. Same pattern for sites delete: extract `deleteSite(authFetch, id, options): Promise<DeleteResult>` to a helper, test all four branches.

**Fix sketch (pr-148):** new file `apps/web/src/pages/sites/deleteSite.ts` with extracted helper. Update `SiteDetailPage.tsx` to call it. Add `apps/web/src/pages/sites/__tests__/deleteSite.test.ts` with 6 cases (204, 404, 409 + body.message, 409 + missing body, 500-other, network error).

---

## F2-04 (LOW) — Documents lazy-load + cache-reset untested

**PR:** #344 — same file as F2-03

**Issue:** the `useEffect` that lazy-loads `/documents/sites/:id/documents` has untested behavior:
- The `if (docs !== null) return;` cache check (without which Documents tab would re-fetch every render)
- The `cancelled` flag (prevents stale-response state update if user navigates away mid-fetch)
- The cache-reset-on-id-change `useEffect` (without which navigating from site A to site B would show A's docs)

**Regression risk:** these are subtle correctness invariants. Easy to break in a refactor.

**Fix sketch (pr-149):** extract the fetch portion to `loadSiteDocuments(authFetch, siteId): Promise<SiteDocumentsResponse | { error: string }>`. Test that. The cache + cancellation logic is React-bound so harder to test without jsdom; defer to manual smoke for now.

---

## F2-05 (LOW) — `formatRelativeDate` inline + untested

**PR:** #344 — same file as F2-03

**Issue:** `formatRelativeDate` is defined inline in `SiteDetailPage.tsx` with 6 branches (today, <7d, <30d, <365d, ≥365d, invalid). It's strictly more logic-dense than `formatKpiCount`, which IS tested. Inconsistent test discipline.

**Fix sketch (pr-150 or bundle with pr-148):** move to `site-detail-helpers.ts`, test with `vi.useFakeTimers()` for stable date math.

---

## Decision log

- **2026-06-10:** All five findings captured (F2-01 through F2-05). Not drafting PR prompts yet — Marco is mid-flight on pr-tester calibration + Phase 2 audit work. Revisit after Phase 2 lands.
- F2-01 (formSubmissions guard) is the only HIGH severity item; the rest are MEDIUM/LOW test-coverage gaps.
- All five are "should fix soon" not "must fix now": no user-facing breakage today, but every one is a silent-regression risk.

## Suggested follow-up prompts (don't fire yet)

- `pr-146-sites-delete-formsubmissions-guard.md` — backend service + test, single-commit, ~30 lines (HIGH)
- `pr-147-documents-rollup-access-rule-test-coverage.md` — test-only, ~80 lines, also clean up the `any` casts (MEDIUM)
- `pr-148-extract-and-test-site-delete-branching.md` — frontend refactor + test, ~120 lines (MEDIUM)
- `pr-149-extract-and-test-site-documents-fetch.md` — frontend refactor + test, ~80 lines (LOW)
- `pr-150-move-format-relative-date-to-helpers.md` — small refactor + test, ~40 lines (LOW)

Consider bundling pr-148 + pr-149 + pr-150 into one frontend test-coverage PR (~240 lines) since they all touch the same file and share a justification.
