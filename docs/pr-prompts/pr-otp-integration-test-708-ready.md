---
premise: gh pr view 708 --repo GH-Mantova/ProjectOperations --json state --jq .state | grep -q OPEN && ! gh pr view 708 --repo GH-Mantova/ProjectOperations --json files --jq '[.files[].path]|join(" ")' | grep -q "CP-G6-field-worker-otp"
premise_means: PR #708 (FIELD-worker OTP) is still open and does NOT yet carry a canonical integration spec, so its OTP track still depends on a manual pass by Marco.
scope:
  - apps/api/test/canonical/**
done_when: pnpm build && pnpm lint && test -f apps/api/test/canonical/CP-G6-field-worker-otp.spec.ts
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Add a canonical integration spec that clears the FIELD-worker OTP track on CI evidence

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** -- the work is discarded either way.

## Why this exists

PR #708 ships the FIELD-worker OTP provider. Its test plan carries one unticked item:

> `[ ] Marco: exercise POST /auth/request-otp + POST /auth/verify-otp end-to-end against a
> seeded FIELD user (dev delivery logs the code).`

That is the only thing standing between #708 and a merge decision, and it is a manual step that
does not survive a re-run. Marco ruled on 2026-07-20 that this track should clear on **CI
evidence instead of his manual pass**. Your job is to write that evidence.

The existing `otp-auth.provider.spec.ts` is a UNIT spec with a mocked Prisma client. It proves the
provider's logic. It does **not** prove the wiring: controller route, DTO validation, throttler,
module registration, real Prisma round-trip, real JWT envelope. That wiring is exactly what a
manual pass exercises, and exactly what is currently unproven.

## THIS WORK GOES ON AN EXISTING BRANCH -- DO NOT OPEN A NEW PR

The OTP code does not exist on `main`. It exists only on the #708 branch.

  - Branch to check out and push to: `feat/auth-otp-field-workers`
  - Pushing to it UPDATES PR #708. That is intended.
  - **Do NOT open a new PR. Do NOT merge #708. Do NOT remove its `do-not-merge` label.**
  - **Do NOT rebase or squash the branch.** Add one commit on top.

## Steps, in execution order

1. `git fetch origin` then `git checkout feat/auth-otp-field-workers` and
   `git pull --ff-only origin feat/auth-otp-field-workers`. Confirm with `git log --oneline -1`.
2. Read these three files ON THIS BRANCH before writing anything -- they define the real shapes:
   `apps/api/src/modules/auth/otp-auth.provider.ts`,
   `apps/api/src/modules/auth/otp-delivery.port.ts`,
   `apps/api/src/modules/auth/auth.controller.ts`.
   Take the exact route paths, DTO field names, and the delivery-port injection token FROM THE
   CODE. Do not assume the names used in this prompt are current.
3. Write `apps/api/test/canonical/CP-G6-field-worker-otp.spec.ts`, mirroring the existing
   canonical pattern (embedded below).
4. Run it: `pnpm --filter @project-ops/api exec jest test/canonical/CP-G6-field-worker-otp`.
   It must pass against a seeded dev DB. If it fails, fix the TEST until it reflects the real
   behaviour -- do NOT change the OTP provider to suit the test. If the provider is genuinely
   wrong, say so plainly in the PR comment and stop.
5. `pnpm build` and `pnpm lint` -- both must pass.
6. Commit, push to `feat/auth-otp-field-workers`, and post a PR COMMENT on #708 (not a new PR)
   stating which manual step the spec replaces.

## How to get the code without reading logs

The dev delivery adapter logs the OTP code. **Do not scrape logs.** `OtpDeliveryPort` is a
pluggable interface precisely so a test can substitute a capturing fake:

  - Build the testing module with `.overrideProvider(<the delivery port token>)` and supply a
    fake whose send method records the code into a variable the test can read.
  - Everything else stays real: real controller, real service, real Prisma, real JWT signing.

## Self-seed the FIELD user -- do not depend on seed state

Do NOT add a FIELD user to the seed, and do NOT assume one exists. Create the user your test
needs in `beforeAll` (via PrismaService, with the `kind` discriminator set to the FIELD value the
code actually uses), and delete it plus its `OtpChallenge` rows in `afterAll`. Use a unique
throwaway email such as `cp-g6-field-<timestamp>@example.invalid`.

This is not a style preference. On 2026-07-20 a timeline spec failed in CI purely because it
depended on seed state and test order; the fix was to make it seed its own data via the API.

## Cases the spec must cover

  - `request-otp` for the self-seeded FIELD user returns its success status, and the fake
    delivery port captured a code.
  - `verify-otp` with that captured code returns the standard envelope: `accessToken`,
    `refreshToken`, and `user`. Assert the access token has three dot-separated segments.
  - **Replay:** calling `verify-otp` a second time with the same code returns 401. Single-use is
    the security property most likely to regress silently.
  - **Wrong code** returns 401 and does not issue a token.
  - **No enumeration oracle:** `request-otp` for an email that matches no user returns the same
    status and the same body shape as the success case. This is a stated security property of the
    provider and nothing currently proves it over HTTP.
  - **Expiry:** drive it by ageing the persisted challenge row directly (set `expiresAt` into the
    past via Prisma), then `verify-otp` returns 401. Do NOT use fake timers -- they do not travel
    through a real HTTP round-trip.

Assert on **status codes and response shape**, never on the code value itself.

## Do not do these

  - Do not touch `apps/api/prisma/schema.prisma` or add a migration. This is test-only.
  - Do not touch any Graph / SMTP / Azure / Entra / SharePoint code or config. The production
    delivery adapter is deliberately out of scope and is Marco-supervised.
  - Do not weaken the throttler to make the test pass. If throttling interferes, give each case
    its own email address.

## The canonical pattern to mirror

This is `apps/api/test/canonical/CP-G2-seeded-admin-login.spec.ts` from `main`, reproduced here
because a fresh worktree cannot read a file you have not been pointed at. Follow its bootstrap
exactly -- the global prefix and ValidationPipe matter, and omitting them yields 404s that look
like routing bugs.

```ts
import request from "supertest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../../src/app.module";

describe("Canonical CP-G2 - seeded admin can authenticate", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /api/v1/auth/login with seeded admin credentials returns a JWT", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "admin@projectops.local", password: "Password123!" });

    expect([200, 201]).toContain(res.status);
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.accessToken.split(".").length).toBe(3);
  });
});
```

Note the routes are served under the `api/v1` global prefix.

## What success looks like

PR #708 gains one commit containing exactly one new file, its `API - lint, test, compliance
smoke` check passes with the new spec running, and the unticked manual line in its test plan is
answered by a test that re-runs on every future change to the auth module.

**#708 remains unmerged and keeps its `do-not-merge` label.** Whether the CI evidence is
sufficient to release that label is Marco's decision, not yours.
