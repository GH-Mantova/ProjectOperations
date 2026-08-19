---
premise: '! test -f apps/web/src/pages/field/location/LocationProvider.ts && grep -q "navigator.geolocation" apps/web/src/pages/field/useAutoGps.ts'
premise_means: The field GPS reads call navigator.geolocation directly and there is no LocationProvider seam, so a future native (Capacitor) location engine cannot be swapped in without editing every consumer.
scope:
  - apps/web/src/pages/field/location/**
  - apps/web/src/pages/field/useAutoGps.ts
  - apps/web/src/pages/field/__tests__/**
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/field/location/LocationProvider.ts && ! grep -q "navigator.geolocation" apps/web/src/pages/field/useAutoGps.ts
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# Field location-provider seam (wrapper-readiness) — behaviour-preserving refactor

## Why
The fieldworker web app already captures GPS on shift — clock-on/off reads and the `useBreadcrumbTrail`
on-shift sampler — through `captureGpsReading()` in `apps/web/src/pages/field/useAutoGps.ts`, which calls
`navigator.geolocation` directly. To make a FUTURE native wrapper (Capacitor + OS background geolocation)
a one-module swap rather than a rewrite, every field GPS read must go through a single `LocationProvider`
seam. This PR introduces that seam with the existing browser behaviour as the default implementation.
**No user-visible behaviour changes — this is a pure refactor.**

## What to build
1. New module `apps/web/src/pages/field/location/LocationProvider.ts`:
   - Export an interface `LocationProvider` with:
     - `getCurrentReading(): Promise<GpsResult>` — one-shot read. Reuse the existing `GpsResult` /
       `GpsReading` / `GpsFailureReason` types (import or re-export them from `useAutoGps`).
     - `readonly supportsBackground: boolean` — capability flag; `false` for the browser. This is the
       documented hook a future native provider will set `true`.
   - Export `BrowserLocationProvider` implementing it: move the existing
     `navigator.geolocation.getCurrentPosition` logic (enableHighAccuracy, 10s timeout, maximumAge 0,
     and the typed failure mapping) out of `useAutoGps` and into this class/object. `supportsBackground = false`.
   - Export `getLocationProvider(): LocationProvider` returning a module-level singleton (default
     `BrowserLocationProvider`), plus `setLocationProvider(p: LocationProvider): void` for tests and for a
     future native bootstrap to swap in ONE place. This accessor is the only swap point.
2. Refactor `apps/web/src/pages/field/useAutoGps.ts`:
   - `captureGpsReading()` KEEPS its exact signature and typed `GpsResult` contract, but its body becomes
     `return getLocationProvider().getCurrentReading()`. No `navigator.geolocation` reference remains in
     this file after the change.
3. Tests in `apps/web/src/pages/field/__tests__/`:
   - Contract test: `setLocationProvider(...)` a mock provider, then assert `captureGpsReading()` returns
     the mock's reading (proves the swap point works end to end).
   - Assert `BrowserLocationProvider.supportsBackground === false`.
   - Keep the existing `useBreadcrumbTrail` tests green — they consume `captureGpsReading` unchanged.

## Do NOT
- Do NOT change `useBreadcrumbTrail.ts` — it already consumes `captureGpsReading` and must keep working
  untouched (its on-shift / visibility / 25m-move logic is out of scope for this PR).
- Do NOT touch the forms GPS (`FormFillPage.tsx` LocationStamp) or the admin map picker
  (`AdminSettingsPage.tsx`) — a later slice migrates those to the provider; leaving them out keeps this PR small.
- Do NOT add Capacitor, any native dependency, or an `apps/mobile` project — this PR is web-only seam prep.
- Do NOT change any API, endpoint, permission, or schema.
- Do NOT alter GPS runtime behaviour, timeouts, or accuracy — identical behaviour before and after.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. If the work is already on `main`, say `NO-OP: <reason>` and stop. Never exit silently.
- Never ask a question or "stand by" for approval — there is no human in this run. Open the PR.
- If a CI check fails, read the job log before diagnosing.
- Do NOT auto-merge — open the PR and leave it unmerged (Marco reviews the diff).

## VERIFY
- `pnpm build`
- `pnpm lint`
- The web test suite (new provider contract test + existing field tests all green).
- `test -f apps/web/src/pages/field/location/LocationProvider.ts`
- `! grep -q "navigator.geolocation" apps/web/src/pages/field/useAutoGps.ts` (proof the direct call now lives only in the provider).
