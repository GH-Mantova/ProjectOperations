# PR #219 — Test Plan Verification Report

- **Date:** 2026-05-25 (AEST)
- **Author:** Cowork (local diagnostic agent — see project_instructions §19)
- **PR:** #219 — `[5A.1] persona sub-mode routing fix + §5A.1 finalisation`
- **Branch:** `pr219` (`refs/pull/219/head`) — commit `3f5fa090417a2825c617734e11a1ef0279b47542`
- **Parent / base:** `45185d5` (PR #218, `main` at time of report)
- **Subject of report:** the 7-item "Test plan" checklist in the PR #219 description

---

## §1 — Scope and method

PR #219's 7 test-plan items were verified **two independent ways**:

1. **Code + automated tests.** The full PR #219 diff was read, and the 8
   unit-test files the PR updates were run from a fresh clone of the branch
   (139 tests, all passing — see §5).
2. **Live browser run.** Claude Code stood the application up locally on the
   `pr219` branch (Docker Postgres, all 87 migrations applied, seeded, dev
   servers running). Cowork then drove the running app in a real Chrome
   browser via the Claude-in-Chrome extension and walked all 7 items
   end-to-end. This resolves the caveat noted in the first revision of this
   report — a live click-through has now been done.

All 7 items pass under both methods.

---

## §2 — Environment

**Code / test pass:**

```
Repo:      github.com/GH-Mantova/ProjectOperations — fresh clone of pr219
Node:      v22.22.0 · pnpm 10.0.0
Web tests: vitest 3.2.4   API tests: jest (ts-jest)
```

**Live pass:**

```
App:       pr219 @ 3f5fa09, run locally by Claude Code
DB:        Docker Postgres (project-operations-postgres), reset +
           87 migrations applied + seeded
Web:       http://localhost:5173   API: http://localhost:3000 (health: ok)
Driver:    Cowork via Claude-in-Chrome (real Chrome browser)
Login:     admin@projectops.local (seed admin user "Alex Admin", role ADMIN)
Test data: tender IS-T020 "Brisbane Grammar School — Science Block
           refurbishment", id cmpkbsv4c00rlub70c5tt7kc0
```

---

## §3 — What PR #219 changes (verbatim diffstat)

```
 18 files changed, 582 insertions(+), 289 deletions(-)
```

Three parts, per the commit message: (1) tender page tabs move from React
`useState` to real routes (`/tenders/:id`, `/tenders/:id/scope`,
`/tenders/:id/quote`); (2) persona sub-modes collapsed 6 → 4 — `estimate`
merged into `quote`, `clarifications` merged into `tender-detail`, tool
bindings re-pointed; (3) stale placeholder copy removed from
`persona-window-helpers.ts`, `CompanySettingsTab.tsx`, `MySettingsTab.tsx`.
PR #219 touches **zero** migration files.

---

## §4 — Test plan results

### Item 1 — Navigate to `/tenders/:id` → Overview tab active, persona shows "Tender detail"

**Result: PASS (code + live).**

*Live:* Loaded `http://localhost:5173/tenders/cmpkbsv4c00rlub70c5tt7kc0`.
The **Overview** tab rendered active (orange underline). Opening the
Tendering Assistant window showed subtitle **"Tender detail — answer
questions about the tender"**.

*Code:* `App.tsx:186` route `/tenders/:id` → `TenderDetailPage`; the `tab`
`useMemo` returns `"overview"` when the path ends with neither `/scope` nor
`/quote`. Persona `tender-detail` sub-mode has `routePattern: "/tenders/:id"`.

### Item 2 — Click "Scope of Works" tab → URL `/tenders/:id/scope`, persona shows "Scope"

**Result: PASS (code + live).**

*Live:* Clicked the **Scope of Works** tab. URL changed to
`http://localhost:5173/tenders/cmpkbsv4c00rlub70c5tt7kc0/scope`; the Scope of
Works tab became active and the Scope content rendered. Persona window
subtitle: **"Scope — propose and refine scope items"**.

*Code:* Tab button `onClick={() => navigate(`/tenders/${id}/scope`)}`;
`App.tsx:187` route added; `tab` `useMemo` resolves `.../scope` to `"scope"`.

### Item 3 — Click "Quote" tab → URL `/tenders/:id/quote`, persona shows "Quote"

**Result: PASS (code + live).**

*Live:* Clicked the **Quote** tab. URL changed to
`http://localhost:5173/tenders/cmpkbsv4c00rlub70c5tt7kc0/quote`; the Quote
tab became active and the quote content rendered. Persona window subtitle:
**"Quote — estimating, costing, and client quotes"**.

*Code:* Tab button `onClick={() => navigate(`/tenders/${id}/quote`)}`;
`App.tsx:188` route added; render guard `{tab === "quote" && <QuoteTab .../>}`.

### Item 4 — Direct-navigate to `/tenders/:id/scope` → Scope tab active on load

**Result: PASS (code + live).**

*Live:* Performed a fresh browser navigation straight to
`http://localhost:5173/tenders/cmpkbsv4c00rlub70c5tt7kc0/scope` (cold load).
On load, the **Scope of Works** tab was already active and the Scope content
rendered — no flash of the Overview tab.

*Code:* `tab` is computed by `useMemo` from `location.pathname`; the former
`useState<Tab>("overview")` default was removed, so a cold load at `/scope`
resolves to `"scope"` on the first render.

### Item 5 — Browser back/forward between tabs works correctly

**Result: PASS (code + live).**

*Live:* Built history Overview → Scope → Quote by clicking tabs, then used
the browser's history controls:

```
back     /quote  → /scope                       Scope tab active
back     /scope  → /tenders/cmpkbsv4c00...       Overview tab active
forward  /tenders/cmpkbsv4c00... → /scope        Scope tab active
```

Both URL and active tab tracked the history correctly at every step.

*Code:* Each tab is a distinct URL and switches use `navigate(path)` (history
push, no `replace`); the removed `useState<Tab>` means no local state can
desync from the URL.

### Item 6 — Persona chat panel hint text updates per sub-mode

**Result: PASS (code + live + unit test).**

*Live:* The Tendering Assistant panel's empty-state hint differed per
sub-mode:

```
tender-detail :  "Ask the Tendering Assistant about this tender."
scope         :  "Ask the Tendering Assistant about scope drafting."
quote         :  "Ask the Tendering Assistant about the quote and estimate."
```

*Code:* `chat-helpers.ts` `SUB_MODE_FRIENDLY_LABELS` maps each sub-mode to
the phrase used by `chatPanelEmptyHint()`. Covered by `chat-helpers.test.ts`.

### Item 7 — AI Settings page renders without stale placeholder text

**Result: PASS (code + live + unit test + repo scan).**

*Live:* Opened the AI Settings page via the persona window's cog →
`http://localhost:5173/admin/ai-settings`. It rendered cleanly. Full visible
text captured:

```
AI Settings
Personal preferences for the AI personas you have access to.
Personal API Keys (Bring Your Own Key)
Personal AI keys are disabled by your administrator.
Tendering Assistant
Active on: /tenders/*
Provider override (optional)  ·  Use system default (Anthropic)
Company Instruction (read-only)  ·  No company instruction set yet.
Save my settings
```

No stale placeholder copy is present — no "coming soon", "next PR", "in
development", or "arrives with the AI integration PR". The BYOK area now
shows a real state message ("Personal AI keys are disabled by your
administrator.") in place of the removed "BYOK is currently in development"
stub. The `/admin/platform` AI & Integrations panel was also viewed and
renders clean.

*Caveat:* `CompanySettingsTab` ("Provider Access") was not reachable in the
UI as the seed ADMIN user — it appears Super-User-gated (Sean). Its
stale-copy removal is verified by the code diff, by the repo scan (§6), and
by the unit tests (§5), but was not exercised live.

*Code:* `persona-window-helpers.ts` drops the `body` "coming soon" field;
`CompanySettingsTab.tsx` / `MySettingsTab.tsx` strip the stale copy.

---

## §5 — Automated test execution (verbatim output)

All 8 unit-test files PR #219 updates were run from the PR branch.

**Web — vitest** (`apps/web`):

```
 ✓ src/personas/__tests__/chat-helpers.test.ts (31 tests)
 ✓ src/personas/__tests__/persona-window-helpers.test.ts (21 tests)
 ✓ src/personas/__tests__/context-key-helpers.test.ts (9 tests)
 Test Files  3 passed (3)        Tests  61 passed (61)
```

**API — jest** (`apps/api`):

```
PASS src/modules/personas/__tests__/persona-registry.spec.ts
PASS src/modules/personas/__tests__/personas.module.bindings.spec.ts
PASS src/modules/personas/__tests__/persona-definitions.shape.spec.ts
PASS src/modules/personas/__tests__/rate-lookup-policy.prompt.spec.ts
PASS src/modules/personas/__tests__/personas.service.spec.ts
Test Suites: 5 passed         Tests: 78 passed
```

**Total: 139 unit tests passed, 0 failed.** Full CI (lint, build,
`compliance:smoke`, Playwright E2E, CodeQL) is GitHub's responsibility and
was not run here.

---

## §6 — Additional integrity checks

- **No leftover state-based tab logic.** `grep -E "setTab|useState<Tab>"` in
  `TenderDetailPage.tsx` → no matches.
- **No broken frontend links to removed routes.** No `navigate(...)` /
  `<Link>` targets `/tenders/:id/estimate` or `/tenders/:id/clarifications`;
  the only matches for those strings are unrelated backend REST calls.
- **No stale placeholder strings** anywhere under `apps/web/src/personas` —
  a scan for `coming soon` / `next PR` / `in development` / `arrives with` /
  `TODO` / `TBD` returns only legitimate `placeholder=` input attributes and
  the functional `" — price TBD ($0)"` label.

---

## §7 — Observations

1. **Cosmetic nit — `MySettingsTab.tsx`.** Removing the `showBYOK={false}`
   prop left an empty line inside the `<PersonaSettingsCard … />` JSX
   attribute list. No functional or type impact; CI is already green.
   Flagged only so MAIN can fold a one-line tidy into the next PR that
   touches that file.
2. **Expected behaviour, not a bug.** On every tab switch the Tendering
   Assistant window collapses to its pill (it had to be re-opened to read
   each sub-mode subtitle). This matches the documented behaviour in
   `persona-window-helpers.ts` ("Each navigation to a different sub-mode
   resets the panel to closed").
3. **`CompanySettingsTab` not exercised live** — see §4 Item 7 caveat. Its
   stale-copy removal is covered by code review, the repo scan, and unit
   tests; a Super-User (Sean) login would be needed to view it in the UI.

---

## §8 — Summary

| # | Test plan item | Result |
|---|----------------|--------|
| 1 | `/tenders/:id` → Overview active, persona "Tender detail" | PASS — code + live |
| 2 | Scope tab → `/tenders/:id/scope`, persona "Scope" | PASS — code + live |
| 3 | Quote tab → `/tenders/:id/quote`, persona "Quote" | PASS — code + live |
| 4 | Direct-navigate `/tenders/:id/scope` → Scope active on load | PASS — code + live |
| 5 | Browser back/forward between tabs | PASS — code + live |
| 6 | Persona chat panel hint text per sub-mode | PASS — code + live + test |
| 7 | AI Settings page — no stale placeholder text | PASS — code + live + test |

All 7 test-plan items pass — verified by code inspection, by 139 passing
unit tests, and by a live browser click-through on the running `pr219`
build. One cosmetic nit (§7.1); one component not exercised live but
otherwise verified (§7.3). No defects found.

*Report produced by Cowork. Interpretation and any follow-up prompts are
MAIN's responsibility (project_instructions §19). Not committed by Cowork.*
