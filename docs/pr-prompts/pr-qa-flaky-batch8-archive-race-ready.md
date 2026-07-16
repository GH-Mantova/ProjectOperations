---
premise: "grep -A2 -F '.first().click();' tests/e2e/pr-acceptance/batch8-documents-archive.spec.ts | grep -q 'toHaveURL'"
premise_means: The archive View-link click is still immediately followed (within 2 lines) by a bare toHaveURL assertion, with no settle-wait inserted -- the post-navigation race is still present.
scope:
  - tests/e2e/pr-acceptance/batch8-documents-archive.spec.ts
done_when: "pnpm build && pnpm lint && ! ( grep -A2 -F '.first().click();' tests/e2e/pr-acceptance/batch8-documents-archive.spec.ts | grep -q 'toHaveURL' )"
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# PR prompt: Fix flaky e2e race in batch8-documents-archive (View-link -> toHaveURL)

Branch: `fix/qa-flaky-batch8-archive-race`. New PR.

## Why this PR exists

`tests/e2e/pr-acceptance/batch8-documents-archive.spec.ts`, test **"archive detail opens
read-only from the register's View link"** (around line 44), does this:

```ts
await page.goto("/archive");
await page.getByRole("link", { name: "View", exact: true }).first().click();
await expect(page).toHaveURL(/\/archive\/.+/);
```

The click can fire **before the Archive register rows have settled**, so `.first()` resolves against
a stale/placeholder row and the SPA route transition never lands on the detail URL. `toHaveURL` then
times out. This is a **race, not a flake** -- the same class as `flaky-batch5-sites-post-delete-race`.

It reddened **PR #608** (1 failed / 141 passed) whose diff was the per-user default-dashboard
feature -- code that **cannot reach the Archive route** -- and it passed on a bare re-run. That is
the signature of a test race, and it trains agents to re-run for green, which **DOCTRINE section 2
explicitly forbids**.

## What to build -- TEST-ONLY, one file

Edit only `tests/e2e/pr-acceptance/batch8-documents-archive.spec.ts`, in that one test:

1. **After `page.goto("/archive")`, wait for the register to settle before clicking View.** Wait on
   the register's own rows/content -- e.g. wait for the first `View` link to be `visible` (and, if
   the page shows a loading indicator, for it to detach) -- so the click lands on a real, rendered
   row rather than a stale one. Use the settle pattern already used elsewhere in this suite; do not
   invent a bare `waitForTimeout`.
2. **Prefer `page.waitForURL(/\/archive\/.+/)` over the bare `toHaveURL`** for the post-click
   navigation assertion (or wait for the detail header to be visible), so the assertion waits for
   the transition instead of sampling the URL the instant it may change.

The fix must remove the pattern "`.first().click();` immediately followed within 2 lines by
`toHaveURL`". Keep every existing assertion (the read-only subtitle, the "Job summary" /
"Closeout & checklist" panel toggles) intact -- you are only removing the race, not the coverage.

## Do NOT

- Do NOT touch any file other than this one spec.
- Do NOT weaken coverage: keep the read-only-subtitle and panel-toggle assertions.
- Do NOT paper over the race with a bare `page.waitForTimeout(...)` -- wait on a real signal
  (rows visible / loading detached / URL settled).
- Do NOT touch app source, other specs, Azure, Entra, SharePoint, auth, or any deploy config.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails

- One attempt. If blocked, say `NO-OP: <reason>` loudly -- never exit silently, never "stand by"
  for approval (there is no human in this run).
- `pnpm build` + `pnpm lint` must pass before you open the PR.
- Read the CI job log before diagnosing any CI failure; never re-run hoping for green.
- The completion test: is there a PR number in your output? If not because the work was already on
  main, say `NO-OP`. If not because you are waiting for someone -- there is nobody. Open the PR.
