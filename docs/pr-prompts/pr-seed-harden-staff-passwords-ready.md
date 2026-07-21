---
premise: grep -q "Password123" apps/api/prisma/seed-initial-services.ts
premise_means: The real Initial Services staff roster is still seeded with the public Password123! local password -- the SSO-only sentinel fix has not landed.
scope:
  - apps/api/prisma/seed-initial-services.ts
done_when: bash -c '! grep -q "Password123" apps/api/prisma/seed-initial-services.ts' && pnpm lint
size: 1
gate_allow: none
seed_only: true
escalates: false
---

# fix(seed): stop seeding real staff with the public Password123! local password

## What to build

In `apps/api/prisma/seed-initial-services.ts`, the real staff roster (Sean, Marco, Raj, and the
rest) is created with `passwordHash: hashPassword("Password123!")`. The repo is public, so that
password is world-readable, and `LocalAuthProvider` (see
`apps/api/src/modules/auth/local-auth.provider.ts`) accepts local password login for ANY user
whose stored hash contains a `:` -- the Entra track does not disable the local endpoint.

Fix: seed staff users as SSO-only. Replace the `passwordHash: hashPassword("Password123!")`
value with the literal sentinel string `"SSO-ONLY"`. `LocalAuthProvider` already treats a hash
without a `:` as "no usable password" and substitutes its random fallback hash, so local login
becomes impossible for these accounts while Entra login is unaffected. Add a comment above the
field explaining exactly this mechanism and referencing `local-auth.provider.ts`.

If the upsert has an `update:` branch, ensure it does NOT re-write `passwordHash` (so a future
re-seed cannot resurrect a password on an account that went SSO-only).

## Do NOT

- Do not touch `apps/api/prisma/seed.ts` -- the dev/test `admin@projectops.local` and
  `viewer@projectops.local` users are load-bearing for CI (CP-G2, CP-18, e2e helpers).
- Do not change `LocalAuthProvider`, `PasswordService`, or any auth module code.
- Do not add migrations.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** -- the work is discarded either way.

## Guardrails

- One attempt; never exit silently -- say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval; there is no human in a headless run.
- Read the job log before diagnosing any CI failure.
- Completion test: is there a PR number in your output? If not, say `NO-OP: <reason>`.
