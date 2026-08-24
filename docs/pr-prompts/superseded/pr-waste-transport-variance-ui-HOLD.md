---
premise: '! grep -q "transportDelta" apps/web/src/pages/tendering/ScopeWasteTab.tsx'
premise_means: >-
  The waste variance panel renders a disposal row and a fuel row only. It has no
  transport row, so once the API starts flagging a transport-rate move the
  estimator sees a variance banner with no explanation of what moved.
scope:
  - apps/web/src/pages/tendering/**
done_when: >-
  pnpm build && pnpm lint && grep -q "transportDelta"
  apps/web/src/pages/tendering/ScopeWasteTab.tsx && grep -q
  "quotedTransportRatePerDay" apps/web/src/pages/tendering/ScopeWasteTab.tsx
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: waste-transport-snapshot
cluster_order: 2
requires_merged: 1233
---

# SLICE 2 — show the transport rate in the waste variance panel

Chained on `pr-waste-transport-rate-snapshot` (SLICE 1). The gate asserts the
column SLICE 1 actually creates, not merely that a file exists.

SLICE 1 makes `variance()` return `quotedTransportRatePerDay`,
`currentTransportRatePerDay` and `transportDelta`, and fold transport into
`hasVariance`. Until this slice lands, a transport-only variance shows the
banner with neither of its two existing rows populated — correct but mute.

## Do

1. `ScopeWasteTab.tsx` — extend the `WasteVariance` type (:85-94) with
   `quotedTransportRatePerDay: number | null`,
   `currentTransportRatePerDay: number | null`, `transportDelta: number | null`.

2. In the variance banner (:1035-1059), add a third conditional span beside the
   existing disposal (:1039-1042) and fuel (:1045-1047) rows, rendering
   quoted vs current $/day and the delta. Match the existing wording, number
   formatting and conditional-render style exactly — do not restyle the banner.

3. Nothing else. The Escalate button, the API call and the expand toggle all
   already work unchanged.

## Do NOT

- Do NOT touch `apps/api/**`. If the fields are missing from the response, the
  gate was wrong — STOP and report rather than adding them yourself.
- Do NOT change the variance thresholds; they are the API's business.
- Do NOT restyle or restructure the panel, the row, or the expand behaviour.
- Do NOT touch `/sot/` or Azure/Entra/SharePoint.

## Verify

- `pnpm build && pnpm lint` green.
- State in the PR body what the panel renders when `transportDelta` is null
  (it must render nothing for that row, not "$0.00" and not "—").

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

The lines below are a SCOPE limit, not permission to stop before pushing. Both apply.

Two-file display change. Stop and report rather than widening scope.
