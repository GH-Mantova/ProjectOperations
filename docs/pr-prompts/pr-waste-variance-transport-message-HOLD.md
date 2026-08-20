---
premise: '! grep -q "v.transportDelta" apps/api/src/modules/tendering/scope-waste.service.ts'
premise_means: escalateVariance still builds its notification body from disposal and fuel only, so a transport-only variance fires a notification that cannot describe itself.
scope:
  - apps/api/src/modules/tendering/scope-waste.service.ts
  - apps/api/src/modules/tendering/__tests__/scope-waste-transport-snapshot.spec.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/api test -- scope-waste && grep -q "v.transportDelta" apps/api/src/modules/tendering/scope-waste.service.ts
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# A transport-only rate variance sends a notification that says nothing changed

## The bug, precisely

`ScopeWasteService.variance()` compares **three** snapshots against live rates and flags any of
them:

```ts
const hasVariance =
  (disposalDelta != null && Math.abs(disposalDelta) >= 0.5) ||
  (fuelDelta     != null && Math.abs(fuelDelta)     >= 0.01) ||
  (transportDelta != null && Math.abs(transportDelta) >= 1.0);
```

`escalateVariance()` then builds the notification body from **two**:

```ts
const delta = [
  v.disposalDelta != null ? `disposal $... -> $...` : null,
  v.fuelDelta     != null ? `fuel $.../L -> $.../L` : null
]
  .filter((s): s is string => s !== null)
  .join(", ") || "no live rate available";
```

`transportDelta` is never added to that array. So when **only** the transport rate has moved —
which is the common case, since the truck day rate changes far more often than a disposal rate or
the fuel price — the escalation fires and the recipient reads:

> Rate changed since quoted (**no live rate available**). Confirm or reprice the line — the system
> does NOT auto-reprice.

A notification telling someone something changed, while showing them nothing, is worse than no
notification: it burns the reader's trust in the whole channel.

## What to build

1. Add the transport clause to the `delta` array in `escalateVariance`, matching the existing two
   in shape and wording — something like
   `` `transport $${v.quotedTransportRatePerDay ?? "?"}/day -> $${v.currentTransportRatePerDay ?? "?"}/day` ``.
   Both fields are already on the object `variance()` returns; no new lookup is needed.

2. Keep the `|| "no live rate available"` fallback. It is correct for the genuine case where every
   live rate is unavailable — it was only ever wrong because transport could not reach the array.

3. Add a spec to `scope-waste-transport-snapshot.spec.ts` covering the exact regression: a row
   whose **transport rate alone** has moved past the $1.00/day threshold, asserting the
   notification body names the transport change and does **not** read "no live rate available".

## Do NOT

- Do not change the thresholds (0.5 / 0.01 / 1.0). They are deliberate and documented in the
  comment above `hasVariance`.
- Do not change `variance()` itself — its return shape is already correct and the UI reads it.
- Do not touch the auto-reprice behaviour, `PRICING_INPUTS`, or any snapshot field.
- Do not resolve the `TODO(SLICE-5)` about `resolveEffectiveChannel` sitting just above the loop —
  that is a separate, larger piece of work.
- Do not touch `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if you cannot proceed, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.
- Read the job log before diagnosing any CI failure.
