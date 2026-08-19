---
premise: '! grep -rq "mcr.microsoft.com/playwright" .github/workflows/'
premise_means: >-
  Every `tendering-e2e` run installs 181 apt packages before a single test
  executes. Nothing in the workflow directory uses the official Playwright
  container image, which ships those packages and the browsers pre-installed.
  This slice adds a dispatch-only trial workflow that proves the container
  works. It does not touch the required check.
scope:
  - .github/workflows/playwright-container-trial.yml
done_when: >-
  grep -q "workflow_dispatch" .github/workflows/playwright-container-trial.yml
  && grep -q "playwright:v1.59.1-noble"
  .github/workflows/playwright-container-trial.yml && grep -q "@postgres:5432"
  .github/workflows/playwright-container-trial.yml && ! grep -Eq
  "^(on|  )?(pull_request|push):" .github/workflows/playwright-container-trial.yml
  && ! grep -q "ms-playwright" .github/workflows/playwright-container-trial.yml
  && grep -q "playwright install --with-deps" .github/workflows/playwright.yml
size: 1
gate_allow: none
escalates: false
backfill: false
cluster: e2e-container
cluster_order: 1
rollback_strategy: >-
  One new file, no existing file touched. The workflow has no `pull_request` and
  no `push` trigger, so it cannot run on its own and cannot appear on any PR's
  check list. Rollback is deleting the file. Worst case if it is merged and
  never dispatched is one inert file in the workflows directory.
---

# SLICE 1 of 2 — a dispatch-only trial of the Playwright container image

**This slice must not change `tendering-e2e`. If your diff touches
`.github/workflows/playwright.yml`, you have done the wrong slice.**

## The measurement that motivates it

`playwright.yml:117` runs `pnpm exec playwright install --with-deps chromium
firefox webkit`. Read from the jobs API on 2026-08-19, the duration of that one
step across runs where `tendering-e2e` actually executed:

```
39s   40s   47s   50s   51s   123s   344s   551s   579s   665s   667s   748s   1099s
```

Two things this rules out:

- **It is not the browser download.** Run 32297411527's step log contains zero
  download lines — only `Installing dependencies...` followed by eleven minutes
  of apt. The `actions/cache` step added in #1243 restores 444 MB in 4 seconds
  and reports a genuine hit.
- **It is not a regression from that cache.** The distribution is bimodal both
  before and after #1243 merged. The cache changed nothing measurable, because
  the cost it removes was never the dominant one.

The cost is `--with-deps` installing **181 apt packages** on every run. Dropping
a browser does not fix it: only **23** of the 181 are webkit-family
(gstreamer, libnice, libgupnp, libsoup and friends). The other 158 are shared
and chromium/firefox dependencies. Cutting webkit buys ~13% of the cost and
loses a browser the tendering smoke actually exercises.

The official image `mcr.microsoft.com/playwright:v1.59.1-noble` ships all 181
packages **and** the three browsers. Running the job in it deletes the install
step and the browser cache step outright.

## Why this is a trial and not the change

`tendering-e2e` is a **required** status check. It is currently the only gate
standing between every open PR and main. Moving it into a container changes how
it reaches its database. If that goes wrong, nothing merges.

So slice 1 proves the container in isolation, and slice 2 — a separate prompt,
held, `escalates: true` — does the swap only after a human has read the trial's
results.

## What to build

A new workflow file, `.github/workflows/playwright-container-trial.yml`:

- **Trigger: `workflow_dispatch` only.** No `pull_request`. No `push`. No
  `schedule`. This is the property that makes the slice safe, and the `done_when`
  greps for its absence.
- Give the dispatch a `ref` the operator can point at any branch — that is how
  the trial gets run against a real PR head rather than a synthetic one.
- One job, named `tendering-e2e-container` (**not** `tendering-e2e` — a second
  job by that name would collide with the required check).
- `container: mcr.microsoft.com/playwright:v1.59.1-noble`
- Copy the `services.postgres` block and the whole `env:` block from
  `playwright.yml:56-84` **verbatim except for one value** — see below.
- Copy the steps from `playwright.yml:87-135`, **minus** the
  `Cache Playwright browsers` step and the `Install Playwright browsers` step.
  Keep both test steps and the artifact upload.
- Keep `timeout-minutes: 60`.

## The four things that change inside a job container — get these right

1. **`DATABASE_URL` must not say `localhost`.** This is the one that will bite.
   When the job runs on the runner host, the service's `ports: 5432:5432`
   mapping publishes postgres on the host's loopback. When the job runs **in a
   container**, the job and the service are on a shared Docker network, the port
   mapping is irrelevant, and the service is reachable by its **label**. So:

   ```
   DATABASE_URL: postgresql://project_ops:project_ops@postgres:5432/project_operations?schema=public
   ```

   Symptom if you miss it: every Prisma step fails with `ECONNREFUSED
   127.0.0.1:5432`, and it will look like the database never came up. It did.

2. **Do not add a browser cache step and do not run `playwright install`.** The
   image sets `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` and the binaries are
   already there. An `actions/cache` on `~/.cache/ms-playwright` inside this
   image caches an empty directory. The `done_when` greps that `ms-playwright`
   does not appear in the new file at all.

3. **The image tag and the installed Playwright version must match.** The
   lockfile resolves `@playwright/test` to **1.59.1**; `package.json` declares
   the range `^1.59.1`, which will drift on the next dependency bump while the
   image tag stays put. Add a first step that fails loudly on mismatch rather
   than letting Playwright fail later with `Executable doesn't exist at
   /ms-playwright/chromium-XXXX`:

   ```yaml
   - name: Assert image tag matches the installed Playwright version
     run: |
       want="$(node -p "require('@playwright/test/package.json').version")"
       have="1.59.1"   # keep in step with the container image tag above
       if [ "$want" != "$have" ]; then
         echo "::error::Playwright resolves to $want but the container image is $have."
         echo "::error::Bump the image tag in this file."
         exit 1
       fi
   ```

   Run it **after** `pnpm install` — before that, the package is not on disk.

4. **`webServer` is unaffected.** `playwright.config.ts:70-80` starts the API on
   `127.0.0.1:3000` and the web app on `127.0.0.1:4173`. Both live inside the
   job container along with the tests, so those addresses stay exactly as they
   are. Do not "fix" them to match change 1 — that would break them.

## `workflow_dispatch` only works from the default branch

A `workflow_dispatch` workflow is only dispatchable once it exists on **main**.
That is not a problem — it is the reason this slice is safe to merge: the file
is inert until someone deliberately runs it. But it does mean the trial cannot
be run from the PR branch, and **this PR cannot demonstrate the container
working.** Do not attempt to make it do so, and do not claim it does.

## What NOT to do

- Do **not** edit `.github/workflows/playwright.yml`. The `done_when` asserts
  the install step is still there, precisely so a slice that "helpfully" does
  both cannot go green.
- Do **not** add `pull_request` or `push` triggers "so we can see it run". That
  puts a second, unproven e2e job on every PR's check list. A failing
  non-required check turns `mergeStateStatus` to `UNSTABLE`, which the merge
  path treats as not-CLEAN — it would stall every merge on the board while
  looking like a harmless extra job.
- Do **not** name the job `tendering-e2e`.
- Do **not** drop firefox or webkit. `playwright.config.ts` declares chromium
  (`:46`), firefox (`:54`) and webkit (`:62`), and the tendering smoke at
  `playwright.yml:120` runs with no `--project` flag, so it runs all three.
- Do **not** set `continue-on-error` anywhere. The trial's whole value is an
  honest pass/fail.

## Verification

State in the PR body:

1. the full trigger block, showing `workflow_dispatch` and nothing else;
2. a diff of the `env:` block against `playwright.yml`, showing that
   **exactly one** value differs and that it is the `DATABASE_URL` host;
3. the two steps that were **not** copied, by name;
4. that `.github/workflows/playwright.yml` is absent from `git diff --name-only`.

Do not state that the container works. Nothing in this PR can show that. The
evidence comes from dispatching it after merge, and that is slice 2's gate.
