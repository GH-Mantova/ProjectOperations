---
premise: '! grep -q "ms-playwright" .github/workflows/playwright.yml'
premise_means: >-
  The tendering-e2e job re-downloads Chromium, Firefox and WebKit from scratch on
  every run. Only the pnpm store is cached (playwright.yml:96); the Playwright
  browser cache directory is not. The install step is the single largest cost in
  the pipeline and its only external dependency.
scope:
  - .github/workflows/playwright.yml
done_when: >-
  grep -q "actions/cache" .github/workflows/playwright.yml && grep -q
  "ms-playwright" .github/workflows/playwright.yml && grep -q "chromium firefox
  webkit" .github/workflows/playwright.yml
size: 1
gate_allow: none
escalates: false
backfill: false
rollback_strategy: >-
  Single workflow file, additive. Revert is a git revert of one commit. A bad
  cache key degrades to a cache miss, which is exactly today's behaviour, so the
  worst case is no worse than the status quo.
---

# Cache the Playwright browsers in tendering-e2e

## The measurement

`.github/workflows/playwright.yml:117`

```yaml
- name: Install Playwright browsers
  run: pnpm exec playwright install --with-deps chromium firefox webkit
```

`:96` caches the **pnpm store only** (`cache: pnpm`). Nothing caches
`~/.cache/ms-playwright`, so all three browsers are downloaded on every PR run
and every push to main.

Measured on 2026-08-19:

- a healthy `tendering-e2e` takes **~14 minutes end to end** (run 32227426136,
  07:21:39 -> 07:35:38), of which the install step is the large majority;
- when the upstream download degrades, the step **hangs**. Run 32230164454 (#1239)
  reached the 60-minute job timeout still on that step. The run on `main`
  (32228849626) sat on the same step for over 90 minutes. Neither test suite ever
  executed. Everything before the step - dependencies, Prisma generate, migrations,
  seed, API build, web logic - passed in both.

That is the whole board blocked on one external download.

## What to do

Add an `actions/cache` step **before** the install step, restoring and saving
`~/.cache/ms-playwright`, keyed on the runner OS and the **resolved** Playwright
version - not the `^1.59.1` range in package.json, which does not change when the
resolved version does. Read it from the lockfile or from
`pnpm exec playwright --version`, and put it in the key so a Playwright upgrade
produces a new key rather than a stale hit.

Keep `--with-deps`: the system libraries it installs live outside the cached
directory and are cheap. Only the browser binaries are being cached.

## What NOT to do

- **Do NOT drop firefox or webkit from the install line.** It is tempting - the
  PR-acceptance suite is chromium-only (`:123`). But `playwright.config.ts`
  declares chromium (`:46`), firefox (`:54`) and webkit (`:62`) as projects, and
  the tendering smoke at `:120` runs with **no** `--project` flag, so it runs all
  three. Removing a browser silently reduces coverage. The `done_when` above
  greps for `chromium firefox webkit` still being present precisely so a slice
  that "optimises" by dropping one cannot go green.
- Do NOT change any test, config or project definition. This slice changes the
  workflow file and nothing else.
- Do NOT add `continue-on-error` or otherwise weaken the gate to route around the
  hang. The point is to stop depending on the download, not to stop noticing when
  it fails.

## Verification

State in the PR body:

1. the cache key expression, and what it resolves to for the current version;
2. that the cache step is ordered **before** the install step;
3. the install-step duration on this PR's own run compared with the ~14-minute
   baseline above. A first run is necessarily a cache MISS and will be slow -
   say so plainly rather than presenting a miss as a win. The saving shows up on
   the second run.

A cache that has only ever been observed missing has not been shown to work.
