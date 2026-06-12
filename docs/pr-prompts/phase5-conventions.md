# Phase 5 — Playwright conversion conventions (shared by pr-157 … pr-164)

*Read this FULLY before starting any Phase 5 batch prompt. Every batch prompt references this file instead of repeating it. This file is not a prompt — the watcher ignores it (no `-ready` suffix).*

## Mission context

Phase 5 of the PR test-plan audit converts the 231 UI-MANUAL items from `docs/pr-test-audit/2026-06-10/inventory.json` into Playwright specs, batch by batch. Each batch owns a module slice. The goal is durable regression coverage, not theatrical 1:1 conversion — triage is expected.

## Extraction step (start of every batch)

Filter your batch's items from the inventory with Node (adapt the title regex to your batch's scope line):

```
node -e "const d=require('./docs/pr-test-audit/2026-06-10/inventory.json');
const rx=/<BATCH_TITLE_REGEX>/i;
for(const p of d) for(const i of (p.items||[]))
  if(i.classification==='UI-MANUAL' && rx.test(p.title))
    console.log(p.pr+'\t'+i.text)"
```

Then triage every item into one of:
- **CONVERT** — becomes (part of) a spec.
- **COVERED** — already exercised by `tests/e2e/tendering.spec.ts` or the canonical API suite; cite which.
- **SKIP** — with one of the approved reasons: requires live AI call; requires live SharePoint/Graph or real email send; pixel-level drag-and-drop assertion (flaky); feature since removed/reworked (cite the PR); duplicate of another item in the batch.

The PR body MUST contain the full triage table: `PR # | item (truncated) | CONVERT→spec name / COVERED→where / SKIP→reason`. Every item accounted for, none silently dropped.

## Spec conventions

- Location: `tests/e2e/pr-acceptance/batch{N}-{slug}.spec.ts` (e.g. `batch3-scope-of-works.spec.ts`). Multiple spec files per batch are fine if a flow grouping demands it.
- Mirror the style of `tests/e2e/tendering.spec.ts` (imports, baseURL usage, login pattern) — read it first.
- Shared fixtures live in `tests/e2e/pr-acceptance/helpers.ts` (created by batch 1 / pr-157; later batches import, never duplicate). It exports at minimum: `loginAsAdmin(page)`, `loginAsViewer(page)` (seeded `viewer@projectops.local`), and seeded-data constants (IS-T100 tender, `client-001`, etc.).
- Selectors: `getByRole` / `getByLabel` / `getByPlaceholder` / `getByText` only. NO css chains, NO nth-child, NO xpath. If an element is genuinely unreachable without a `data-testid`, do NOT add one (production code is off-limits) — SKIP the item with reason "needs testid, production change out of scope" and list it in the PR body's follow-up section.
- Tests are independent and re-runnable: rely only on seed data for reads; for write flows (CP-20 items) use unique names (`e2e-${Date.now()}`) and clean up via UI where a delete exists, otherwise document the residue in a comment.
- No fixed `waitForTimeout` calls — use Playwright auto-waiting and `expect` polling.
- Never assert transient/conditional intermediate states — loading skeletons (LL-23), or empty-state hint copy that data can replace (the Ctrl+K palette "Start typing to search." flake, 2026-06-12: the palette fetches `/search` on open and an empty query returns every registered search entry, so result rows race the hint and CI timing decides which one renders). Assert durable user-visible outcomes instead; for empty states, assert the container/role or the tolerant set of legitimate states (`.or()` locators), not one exact piece of transient copy.
- Each spec's `test.describe` title cites the originating inventory PRs: `"Batch 3 — Scope of Works (PRs #29, #37, #61, ...)"`.

## Runtime budget

- Whole batch must pass locally on chromium in under 5 minutes. If your converted set exceeds that, demote the slowest low-value items to SKIP (reason: "runtime budget") and note them.
- Do NOT touch CI workflow files in batches 2–8. Batch 1 (pr-157) wires the single CI step for the whole suite; see its prompt.

## Verification (every batch)

1. `pnpm lint` passes.
2. `npx playwright test tests/e2e/pr-acceptance --project=chromium` — all green, ≤5 min.
3. `npx playwright test tests/e2e/tendering.spec.ts --project=chromium` — still green (no helper collisions).
4. `git diff main --stat` — only `tests/e2e/pr-acceptance/**` (plus the CI file for batch 1 only).

Prereq for 2–3: seeded local DB + dev servers per `playwright.config.ts` webServer blocks (they boot automatically).

## PR conventions (every batch)

- Title: `[Test/§{sections}] Phase 5 batch {N} — {slug} ({X} converted / {Y} covered / {Z} skipped)`
- Reviewer: `GH-Mantova`. 
- Body: triage table (mandatory), follow-up section for testid-blocked items, runtime figure.
- This is a NIGHTLY CHAIN PR — the watcher auto-merges on green CI; the auto-reviewer audits post-merge. Make the triage table verdict-ready.
- No GATE-ALLOW markers (no migrations/env/deps). Never put a literal gate-scope fence or column-0 GATE-ALLOW line in the body.

## Universal operating rules

- Branch: `test/e2e-batch{N}-{slug}` off main. Pre-flight: standard force-clean (`git fetch origin && git checkout -f main && git reset --hard origin/main && git checkout -b <branch>`). For batches 2–8 also: verify `tests/e2e/pr-acceptance/helpers.ts` exists on main — if not, batch 1 hasn't merged; STOP and escalate `docs/pr-prompts/needs-marco/pr-{NNN}-batch1-not-merged.md`.
- Single commit. No production code, no deps, no migrations, no env vars.
- No AskUserQuestion — escalate to `docs/pr-prompts/needs-marco/`.
- Turn budget 120. Hard ABORT on 3 failed Edits of one file.
- TOKEN BUDGET rule: if approaching the limit, finish the current spec, lint, commit `wip: <branch> — pausing for token reset`, push, STOP. On resume, finish the batch before opening the PR.
