---
premise: '! grep -q "WEBKIT_LOGIN_READY_PROBE_V1" tests/e2e/pr-acceptance/helpers.ts'
premise_means: >-
  loginWithStoredState() waits for the "Home" heading with a bare waitFor() that carries no timeout
  and no retry, so under WebKit it intermittently absorbs the whole 60 s test budget and fails the
  test that happens to be running. MEASURED 2026-09-25 by Station 00 on TRUNK - main at 4cc59499,
  run 36095153168, "Tendering Browser Smoke", 04:41:04Z - 1 failed / 19 passed (1.9m), the failure
  at tests/e2e/pr-acceptance/helpers.ts:89 inside the beforeEach of tests/e2e/tendering.spec.ts:40.
  The same signature hit four feature branches in the twelve hours before that, always [webkit],
  always 19 passed / 1 failed, but NOT always the same test - "Pipeline view shows the IS kanban
  stage columns" on the earlier ones, "legacy /tenders/create + /tenders/workspace return 200 and
  don't 404" on trunk. The varying test identity is the evidence that the defect is in the shared
  login helper, not in any one spec.
scope:
  - tests/e2e/pr-acceptance/helpers.ts
  - docs/pr-prompts/superseded/pr-e2e-webkit-login-helper-never-sees-home-HOLD.md
done_when: >-
  grep -q "WEBKIT_LOGIN_READY_PROBE_V1" tests/e2e/pr-acceptance/helpers.ts &&
  ! test -f docs/pr-prompts/pr-e2e-webkit-login-helper-never-sees-home-HOLD.md
size: 2
gate_allow: none
seed_only: false
escalates: false
module: e2e
---

# e2e: the stored-state login helper never sees "Home" under WebKit, and burns 60 s finding out

Staged by Station 00 on 2026-09-25 from the trunk red at 04:41Z. This is `tests/**` only, so it is
inside the `tests-docs` auto-merge policy and needs no human release.

## The exact failure

```
Test timeout of 60000ms exceeded while running "beforeEach" hook.
Error: locator.waitFor: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('heading', { name: 'Home' }) to be visible
  at loginWithStoredState (tests/e2e/pr-acceptance/helpers.ts:89:53)
  at loginAsAdmin           (tests/e2e/pr-acceptance/helpers.ts:93:3)
  at                         tests/e2e/tendering.spec.ts:41:5
```

The helper, as it stands on `main`:

```ts
await page.goto("/login");
await page.evaluate((items) => {
  window.localStorage.clear();
  for (const { name, value } of items) window.localStorage.setItem(name, value);
}, entries);
await page.goto("/");
await page.getByRole("heading", { name: "Home" }).waitFor({ state: "visible" });   // line 89
```

## What is measured, and what is NOT

**Measured.** The nineteen sibling tests in the same job pass, so the web app and the API are both
up and serving; the seeded admin session works for every other browser in the same run. The failure
is WebKit-only across every occurrence Station 00 has seen. The identity of the failing test varies
between occurrences while the failure SITE does not - it is always `helpers.ts:89`.

**Measured.** `waitFor({ state: "visible" })` on line 89 passes no `timeout`, so it inherits the
whole 60 000 ms test timeout. Every occurrence therefore costs a full minute of CI and produces a
call log that says only "waiting for ... to be visible" - no page URL, no screenshot of what the
page actually showed, nothing that distinguishes "still on /login" from "Home rendered late". The
missing diagnostic is itself part of the defect.

**NOT measured - this is yours to establish first.** WHY WebKit lands somewhere without a "Home"
heading. Two candidates the code shape points at, neither confirmed:

1. `page.goto("/login")` is documented in the helper's own comment as harmlessly redirecting to `/`
   when a session is already stored. If that redirect is in flight when `page.evaluate` runs, the
   seed can be written to a document that is being replaced, and the following `goto("/")` - a
   same-URL navigation - may not re-bootstrap auth. The app then sits on the login screen forever.
2. The app's auth bootstrap may read `localStorage` once at boot. Seeding after boot and navigating
   to the same origin would leave the store correct and the in-memory session empty.

Distinguishing these is step 1, not a detail. **Do not fix both on speculation.**

## What to do

**1. Get the evidence the current code refuses to produce.** Before changing behaviour, make the
failure legible: capture `page.url()`, the page's visible headings, and whether the seeded token is
present in `localStorage` at the moment the wait gives up. A scratch CI run on WebKit with
`--repeat-each` is the cheapest route:

```
pnpm playwright test tests/e2e/tendering.spec.ts --project=webkit --repeat-each=10
```

**If you cannot reproduce it after two honest attempts, say so plainly, do not loop, and do not
"harden" the helper on speculation** - write what you tried into the PR body and stop. That is a
correct outcome for this prompt (DOCTRINE section 8.2).

**2. Fix the cause you established.** Prefer, in this order:

- make the seed deterministic with respect to navigation - seed via `context.addInitScript` or an
  explicit `storageState`, so the session exists BEFORE the first document loads, rather than being
  written into a page that may be mid-redirect;
- if the app must re-read the store, navigate with an explicit reload rather than a same-URL `goto`;
- give line 89 an explicit, generous-but-bounded `timeout` AND a failure message that names the URL
  and the headings actually present, so the next occurrence diagnoses itself in seconds.

The bounded timeout is required whichever cause you find. A sixty-second silent wait is not
acceptable behaviour for a shared helper even when it eventually passes.

**Do NOT** add `test.retry`, raise the global timeout, drop WebKit from the project list, or
`test.skip` any test. WebKit is the only Safari-family coverage the suite has, and this helper is
the entry point for every `pr-acceptance` spec - weakening it hides far more than it fixes.

**3. Tag it.** Put `WEBKIT_LOGIN_READY_PROBE_V1` in a comment at the fix site so the premise and
`done_when` can see it.

**4. Prove it.** Re-run the repeat-each command and report the pass count in the PR body. State the
number of consecutive clean WebKit runs you achieved - and if it is small, say so rather than
calling it fixed.

## Relationship to the other e2e flake prompt

`pr-e2e-batch1-dashboards-isolate-the-four-flaky-slices` covers a DIFFERENT failure: four SLICEs in
`tests/e2e/pr-acceptance/batch1-dashboards.spec.ts` failing as a cluster in the 166-test
`tendering-e2e` workflow, with a `user_dashboards` duplicate-key red herring. This prompt covers the
20-test "Tendering Browser Smoke" workflow and a WebKit-only login helper. They share no file. Do not
merge the two pieces of work.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Work in your own disposable worktree off `origin/main`. `pnpm build` and `pnpm lint` must pass before
the PR. Retire this prompt in the same PR by `git mv`-ing it to `docs/pr-prompts/superseded/` - its
own path is in `scope` for exactly that reason, and the `done_when` above checks it is gone.

`escalates: false` and the diff is `tests/**` only, so this is eligible for the `tests-docs`
auto-merge policy. **Keep it that way**: one path outside `tests/` puts the PR in front of Marco.
