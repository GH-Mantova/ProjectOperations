---
premise: '! grep -rq "AZURE_MAPS_TRAVEL_V1" apps/api/src'
premise_means: Travel time is still a straight line multiplied by a factor. Real road travel time, averaged between a normal-hours and a peak-hours run, is what Marco prices haulage on, and no provider exists behind the travel-time port yet.
scope:
  - apps/api/src/modules/tendering/travel-time.ts
  - apps/api/src/modules/tendering/providers/azure-maps-travel.provider.ts
  - apps/api/src/modules/tendering/__tests__/azure-maps-travel.spec.ts
  - apps/api/src/modules/tendering/scope-waste.service.ts
  - apps/api/src/modules/tendering/tendering.module.ts
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/web/src/pages/tendering/ScopeWasteTab.tsx
  - docs/runbooks/**
done_when: pnpm build && pnpm lint && grep -q "AZURE_MAPS_TRAVEL_V1" apps/api/src/modules/tendering/providers/azure-maps-travel.provider.ts
size: 6
gate_allow: migrations
backfill: false
rollback_strategy: Additive only - two nullable snapshot columns for the sampled minutes. The provider is chosen at runtime by configuration, so unsetting the configuration returns every line to the straight-line fallback with no code change and no data change.
seed_only: false
escalates: true
module: tendering
cluster: scopecards
cluster_order: 13
requires_on_main: 'apps/api/src/modules/tendering/travel-time.ts :: TRAVEL_TIME_PORT_V1'
---

<!-- watcher: do-not-arm -->

**GATE (normalised 2026-09-25).** MARCO GATE: arm only after Marco has created the Azure Maps account and told Station 06 how the API authenticates (key in the vault, or the App Service identity). Only Marco removes this line.

The bare marker line above is what holds this prompt. The reason is prose so that
rewording it can never remove the gate. Only a human deletes the marker.

# Scope Cards S8b - real road travel time, normal and peak, averaged

**Second of two.** S8a built the port, the snapshot and the cycle; this slice puts a real provider
behind it. Marco's picks, 2026-09-22: **Azure Maps**, **two sampled times averaged**, **snapshot on
the line**, **straight line only as the badged fallback**.

**Code only. This slice never touches Azure itself** - it reads configuration that Marco creates,
and it ships the runbook telling him exactly what to create.

## Grounded on origin/main (re-verify) + S8a

- `travel-time.ts` exports `TRAVEL_TIME_PORT_V1`, `TravelTimeProvider`, `TravelEstimate` and
  `StraightLineTravelProvider`. This slice adds a second provider and a chooser - **the port's shape
  does not change**, except for the two sampled minutes described below.
- `ScopeWasteItem` carries S8a's snapshot columns (`travelKm`, `travelMinutesOneWay`, `travelSource`,
  `travelDetail`, `travelResolvedAt`) and `mapLocationId`.
- The BYOK key vault (`api-keys` module, AES-256-GCM, master key required) is where a provider key
  belongs if Marco chooses a key. Do not invent a second secret store, and do not put a key in
  `.env.example` beyond a commented placeholder.

## What to build

### 1. The provider - `providers/azure-maps-travel.provider.ts` (NEW)
- `export const AZURE_MAPS_TRAVEL_V1 = "scopecards-s8b";`
- One HTTPS call per sample to the Azure Maps route API, asking for travel time **with traffic** at a
  given departure time. Timeout 5 seconds, one retry, then give up and return `null`.
- **Two samples per resolve**, both in `Australia/Brisbane`, on the next working day:
  the off-peak departure and the peak departure, each read from `OperationsSettings`
  (`travelSampleOffPeak`, `travelSamplePeak`, stored as `HH:mm`). The estimate is the **average of
  the two**, rounded to the minute; `km` is the average of the two distances.
- `detail` reads like `Azure Maps, 07:00 38 min / 10:00 26 min, averaged` so the estimator can see
  both figures. Store the two sampled minutes on the line (below) as well as the average.
- `source` is `"route"`. It never returns a partial answer: if either sample fails, it returns
  `null` and the straight-line provider answers instead, badged as today.

### 2. Choosing the provider
- One factory in `tendering.module.ts`: when the Azure Maps configuration resolves (key from the
  vault, or the App Service identity, whichever Marco confirms), use the Azure provider with the
  straight-line one behind it; otherwise use straight-line alone. **No behaviour changes until the
  configuration exists.**
- Log at startup which provider is active, by name, with no secret in the line.

### 3. Snapshot the two samples (one additive migration)
- `ScopeWasteItem.travelMinutesOffPeak Int?`, `travelMinutesPeak Int?`. Nullable, no backfill.
- A line resolved before this slice keeps its single figure; the two columns stay null.

### 4. The web shows both figures
- `ScopeWasteTab.tsx`: the cycle line becomes
  `Route 21.6 km - 32 min each way (peak 38, off-peak 26) - 3 loads/day`.
  The straight-line badge and its wording are unchanged from S8a.

### 5. The runbook - `docs/runbooks/azure-maps-travel.md` (NEW)
Exact steps for Marco, no commands that touch Azure from CI or from an agent: create the Azure Maps
account, which pricing tier, which permission if the App Service identity is used, where the key goes
(the vault panel) if a key is used, how to verify with one quote, and how to turn it off again (clear
the configuration - every line falls back, nothing breaks).

## Tests (`azure-maps-travel.spec.ts`, provider mocked - no live call in CI)
- Two mocked samples average correctly, round to the minute, and the detail string names both.
- One failing sample returns `null` (and the caller falls back), not a half-answer.
- A timeout returns `null` within the budget; exactly one retry is made.
- No secret appears in any log line, error message or `detail` string.
- With no configuration, the factory selects the straight-line provider and makes no HTTP call.

## Do NOT
- Do NOT create, change or read anything in Azure, Entra or SharePoint. Write the runbook; Marco runs it.
- Do NOT call a live provider in a test or in CI.
- Do NOT let a provider failure fail a save, block a quote, or change a stored figure.
- Do NOT let the estimator choose the source, and do NOT remove the fallback badge.
- Do NOT put a key in the repo, in `.env.example` (beyond a commented placeholder), or in a log.
- Do NOT change the cycle arithmetic from S8a.

## PR body must carry (column 0, bare)
```
GATE-ALLOW: migrations
```

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never ask a question or stand by.
- If `TRAVEL_TIME_PORT_V1` is not on main, STOP with `NO-OP: predecessor s8a not merged`.
- Read the CI job log before diagnosing a failure. `pnpm build` + `pnpm lint` must pass.
- Hard stop: Azure / Entra / SharePoint, production auth or secrets, any irreversible action.
