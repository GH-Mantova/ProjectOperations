## PR #1151 — CFX-5 Xero file import — TypeScript build blocker

**Status**: REJECT-AND-REDO (do NOT merge)

**Issue**: 4 TypeScript compilation errors in `xero-contact-import.service.ts` at lines 609, 614, 622, 627. The code casts Prisma transaction client methods to simpler function signatures without using `as unknown` as an intermediate. Example error:

```
Conversion of type '<T extends ClientCreateArgs>(...) => Prisma__ClientClient<...>' 
to type '(args: { data: Record<string, unknown> }) => Promise<unknown>' 
may be a mistake because neither type sufficiently overlaps with the other.
```

This blocks `pnpm build` and all CI, preventing merge.

**Fix**: Use `as unknown as (args: {...}) => Promise<unknown>` in the casts at lines 609, 614, 622, 627 to satisfy TypeScript's type checker. (Alternatively, restructure the transaction operations to avoid casts entirely.)

**Secondary**: ESLint warning at line 150 (unused eslint-disable directive) — must also be cleaned.

**Decision**: Prompt should re-fire with instruction to fix the type casts and remove the unused directive, then re-run CI validation before merge consideration.

**Escalation context**: This is CFX-5 (final slice of the Xero exchange plan), marked with `escalates: true`. Once the build passes, it will carry the `do-not-merge` label and await Marco's finance-boundary review before merge. The build block is purely a mechanical/typing issue, not a design or scope issue.
