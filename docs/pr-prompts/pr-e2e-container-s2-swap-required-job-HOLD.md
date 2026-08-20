---
premise: 'grep -q "playwright install --with-deps" .github/workflows/playwright.yml'
premise_means: >-
  The required `tendering-e2e` job still installs 181 apt packages on every run.
  The trial workflow from slice 1 is on main and has been dispatched enough
  times to show the container image runs the same suites to the same verdict.
  This slice moves the required job into that image and deletes the trial.
scope:
  - .github/workflows/playwright.yml
  - .github/workflows/playwright-container-trial.yml
done_when: >-
  grep -q "^  tendering-e2e:" .github/workflows/playwright.yml && grep -q
  "playwright:v1.59.1-noble" .github/workflows/playwright.yml && grep -q
  "@postgres:5432" .github/workflows/playwright.yml && ! grep -q "playwright
  install --with-deps" .github/workflows/playwright.yml && ! grep -q
  "ms-playwright" .github/workflows/playwright.yml && grep -q "playwright test
  tests/e2e/tendering.spec.ts --reporter" .github/workflows/playwright.yml && !
  test -f .github/workflows/playwright-container-trial.yml
size: 2
gate_allow: none
escalates: true
backfill: false
cluster: e2e-container
cluster_order: 2
requires_on_main: '.github/workflows/playwright-container-trial.yml :: mcr.microsoft.com/playwright'
rollback_strategy: >-
  One commit touching two workflow files. `git revert` restores the previous
  `tendering-e2e` verbatim, including the install step and the browser cache
  step. The job id and therefore the required-check name is unchanged by this
  slice and unchanged by the revert, so branch protection needs no edit in
  either direction and no PR is left waiting on a check that can never appear.
  A revert costs one run of the old, slow path. Detection is immediate — if the
  container is wrong, `tendering-e2e` goes red on the first PR after merge.
---

# SLICE 2 of 2 — move the required `tendering-e2e` job into the container

**`escalates: true`. This edits the one required check that gates every PR in
the repository. Do not arm this prompt on the strength of its gate being open.**

## Do not start until the trial has actually been run

Slice 1's gate only proves the trial **file** reached main. It cannot prove
anyone dispatched it. Before writing a line of this slice, confirm all four:

1. **At least three successful dispatches** of `playwright-container-trial.yml`,
   on **at least two different branches**, at least one of which is a real PR
   head rather than main.
2. **Both suites ran and passed** in those dispatches — the tendering smoke and
   the PR-acceptance suite. A run that installed cleanly and executed nothing is
   not evidence.
3. **Agreement with the required job on the same commit.** For at least one
   commit, `tendering-e2e` and `tendering-e2e-container` reached the **same**
   verdict. Two greens on different commits is not agreement; it is two greens.
4. **The saving is real and written down.** Total job seconds, container versus
   host, on the same commit. If the container is not meaningfully faster, say so
   and stop — the reason for this change evaporates and the correct action is to
   close it, not to ship a lateral move.

Paste all four into the PR body with run IDs. **If you cannot, this slice is not
ready and no amount of care in the diff makes it ready.**

## What to change

In `.github/workflows/playwright.yml`, in the `tendering-e2e` job only:

- add `container: mcr.microsoft.com/playwright:v1.59.1-noble`;
- change the `DATABASE_URL` host from `localhost` to `postgres` — see slice 1's
  note 1 for why the port mapping stops applying inside a container;
- delete the `Cache Playwright browsers` step;
- delete the `Install Playwright browsers` step;
- add the version-guard step from slice 1, after `Install dependencies`.

Then delete `.github/workflows/playwright-container-trial.yml`. It has served
its purpose and leaving two copies of the same job invites them to drift.

Take the exact step list from the trial workflow as it stands **on main** after
its successful dispatches. Do not re-derive it. The trial is the artefact that
was tested; copying anything else discards the evidence you just gathered.

## The one thing that must not change

The job id stays `tendering-e2e`.

Branch protection requires a check by that name. Rename the job and the required
check never reports, every open PR blocks forever, and unblocking it needs a
ruleset edit — which is Marco's, not automation's. The `done_when` greps for
`^  tendering-e2e:` for exactly this reason.

For the same reason, do **not** take the opportunity to tidy the job name, add a
`name:` key, split the job, or move it to another workflow file.

## Coverage must not quietly shrink

The tendering smoke at `:120` runs with no `--project` flag, so it runs chromium,
firefox and webkit. The container image ships all three. There is no reason to
touch that line and the `done_when` asserts it survives verbatim. A slice that
"optimises" by pinning `--project=chromium` cannot go green.

## What NOT to do

- Do **not** change any `env:` value other than the `DATABASE_URL` host.
- Do **not** remove the `services.postgres` block or its healthcheck. Services
  work with a job container; only the address changes.
- Do **not** remove the `ports: 5432:5432` mapping. It becomes redundant, not
  harmful, and removing it is one more difference to debug if this goes wrong.
- Do **not** touch the `changes` job. It runs `git diff` on the runner host and
  must stay there.
- Do **not** set `continue-on-error` on the job to "de-risk" the swap. That
  converts the repository's only e2e gate into decoration, which is a far worse
  outcome than a red check.

## Verification

State in the PR body, in addition to the four trial facts above:

1. the full diff of the `tendering-e2e` job;
2. the job id before and after, shown to be identical;
3. this PR's own `tendering-e2e` duration against the pre-change distribution
   quoted in slice 1 — this PR exercises the changed job on itself, which is the
   first and only chance to see the new required check run before it is
   protecting anything;
4. the revert command, and confirmation that the required-check name is
   unaffected by it.

If `tendering-e2e` is red on this PR, **revert rather than iterate**. A red
required check on the PR that changes the required check blocks the whole board
while it is being debugged.
