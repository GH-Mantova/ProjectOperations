# Humane API errors — CI regression gate

Rule name: **raw-error-envelope**

## Why this gate exists

The humane-API-errors migration replaced dozens of call sites that exposed raw server
responses directly to the UI:

```ts
// BAD — raw text() leaks JSON envelopes, NestJS error objects, or empty strings
throw new Error(await res.text());
setError(await response.text());
```

The CI gate prevents regressions: any new page that reintroduces either shape fails the
build immediately, with a message pointing at the fix.

## Patterns matched

The gate greps `apps/web/src` (`.ts` and `.tsx` files) for these two shapes.
The variable name is shape-matched, not the literal `res` (which caused under-reporting
during the migration).

```
throw new Error(await [A-Za-z_][A-Za-z0-9_]*\.text\(\))
setError(await [A-Za-z_][A-Za-z0-9_]*\.text\(\))
```

## How to fix a violation

Import from `apps/web/src/lib/api-errors.ts` and use one of these helpers:

| Helper | Use when |
|---|---|
| `readApiErrorMessage(response)` | You want a `string` back from a failed response |
| `throwIfApiError(response)` | You want an `ApiError` thrown (carries `statusCode` + humanised message) |
| `parseApiErrorPayload(payload)` | You already have the parsed body and need a human string |

Example migration:

```ts
// Before
const msg = await res.text();
setError(msg);

// After
import { readApiErrorMessage } from "@/lib/api-errors";
const msg = await readApiErrorMessage(res);
setError(msg);
```

## Inline exception directive

If a call site genuinely reads a **non-API-error body** — that is, a response that is
not produced by `ApiExceptionFilter` and does not carry the API error envelope — you
may suppress the gate with an inline directive on the **same line** as the call:

```ts
const raw = await customResponse.text(); // raw-error-envelope-allow: webhook payload, not an ApiExceptionFilter envelope
```

The directive must be:
- On the **same line** as the offending call.
- Prefixed with `// raw-error-envelope-allow:` (exact spelling, case-sensitive).
- Followed by a short reason so reviewers understand why the exception is legitimate.

**Path exclusions are not supported.** The gate recognises only per-line directives.
A blank or vague reason (e.g., `// raw-error-envelope-allow: skip`) will pass the
gate mechanically but will draw scrutiny in review — be specific.

## Worked examples

### Fail case

```ts
// apps/web/src/features/widgets/some-widget.tsx
const res = await fetch("/api/widget");
if (!res.ok) throw new Error(await res.text()); // FAILS gate
```

Gate output (abbreviated):

```
======================================================================
RAW-ERROR-ENVELOPE GATE: FAIL
======================================================================
Found 1 raw error-envelope call site(s) in apps/web/src.
  apps/web/src/features/widgets/some-widget.tsx:14:  if (!res.ok) throw new Error(await res.text());
...
Fix: import { throwIfApiError } from "apps/web/src/lib/api-errors"
======================================================================
```

### Pass case (after fix)

```ts
import { throwIfApiError } from "@/lib/api-errors";
const res = await fetch("/api/widget");
await throwIfApiError(res);
// Gate output: raw-error-envelope gate: PASS — no violations found in apps/web/src
```

### Pass case (explicit suppression)

```ts
const body = await webhookRes.text(); // raw-error-envelope-allow: Stripe webhook body, not an ApiExceptionFilter envelope
```

## Gate location

- CI job: `raw-error-envelope` in `.github/workflows/ci.yml`
- Script: `scripts/pr-gates/check-raw-error-envelope.mjs`
- Fix pointer: `apps/web/src/lib/api-errors.ts`
