## PR #684 Review: Out-of-scope .env.example commit

The PR contains TWO commits, but the originating prompt (pr-qa-field-guard-superuser-ready.md) explicitly scopes ONLY `apps/web/src/App.tsx`. The first commit (`docs(env): document AUTH_MODE...`) adds `.env.example` changes with a new environment variable `AUTH_MODE=local`, which:

1. **Violates prompt scope** — prompt lists only `apps/web/src/App.tsx`.
2. **Fails PR gates** — CP-12 flags new env vars; prompt specifies `gate_allow: none`, so exceptions are not allowed.
3. **Unrelated to the fix** — this commit should land in a separate PR or be removed.

The App.tsx fix itself is correct (both guards properly updated with can/canAny helpers). The issue is purely the scope violation. Either re-fire on a clean branch or split into two PRs.
