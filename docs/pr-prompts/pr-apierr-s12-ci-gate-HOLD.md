---
premise: '! grep -rq "raw-error-envelope" .github/workflows'
premise_means: >-
  No CI check enforces the humane-API-error rule, so a new page can reintroduce the raw envelope
  the day after the migration finishes and nothing will notice.
scope:
  - .github/workflows/**
  - scripts/pr-gates/**
  - docs/**
done_when: >-
  pnpm build && grep -rq "raw-error-envelope" .github/workflows && ! grep -rqE "(throw new
  Error\(await [A-Za-z_][A-Za-z0-9_]*\.text\(\)\)|setError\(await [A-Za-z_][A-Za-z0-9_]*\.text\(\)\))"
  apps/web/src
size: 3
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# Humane API errors — the CI gate. THIS SLICE RUNS LAST.

## Arm this ONLY when every other slice has landed

This slice is deliberately self-gating: its `done_when` requires **zero** matches across the whole
of `apps/web/src`. If any slice is still outstanding it cannot go green, and the agent will burn a
full run discovering that. Check first:

```
grep -rlE "(throw new Error\(await [A-Za-z_][A-Za-z0-9_]*\.text\(\)\)|setError\(await [A-Za-z_][A-Za-z0-9_]*\.text\(\)\))" apps/web/src | wc -l
```

**82 on origin/main 15d9b1d3. Arm this when that command prints 0.**

## Do

1. Add a CI check — name it so the string `raw-error-envelope` appears in the workflow file — that
   greps `apps/web/src` for both shapes and **fails** on any match:
   - `throw new Error(await <anything>.text())`
   - `setError(await <anything>.text())`
2. The failure message must name every offending file and line, and point at
   `apps/web/src/lib/api-errors.ts` as the fix. A gate that says only "failed" costs the next
   person an hour.
3. **Match on shape, not on the variable name.** The original migration was scoped to the literal
   `throw new Error(await res.text())` and that single word `res` is why it under-reported the
   work by 44 files. Do not repeat it.
4. Add a short note to `docs/` recording the rule, the pattern the gate matches, and the one
   legitimate exception process (see below).

## The exception process

If a call site genuinely reads a non-API-error body, the gate must be escapable **explicitly and
visibly** — a narrowly scoped inline comment directive on that line, never a blanket path
exclusion. Document the directive in the same `docs/` note. A silent exclusion list is how this
rule rots.

## Do NOT

- Do NOT modify any `apps/web/**` file. Every one of them should already be clean; if the gate
  fails, a slice was missed — **report that, do not fix it here.**
- Do NOT add path exclusions to make the gate pass.
- Do NOT touch `apps/api/**`, `/sot/`, or Azure/Entra/SharePoint.

## Verify

- The gate **fails** when you temporarily reintroduce one raw call, and **passes** once removed.
  Run both directions and state both results in the PR body. A gate only ever observed passing has
  not been tested — it has been assumed.
- Do not commit the temporary reintroduction.

## STANDING AUTHORITY

CI gate + doc note only. Stop and report rather than widening scope.
