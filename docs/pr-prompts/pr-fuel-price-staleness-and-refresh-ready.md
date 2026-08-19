---
premise: '! grep -rq "fuel-price/refresh" apps/api/src/modules'
premise_means: >-
  There is no way to trigger a fuel-price fetch on demand. The only caller of
  runDailyFuelPriceFetch is its own @Cron, so after fixing a credential the price stays stale for
  up to 24 hours with no way to hurry it.
scope:
  - apps/api/src/modules/estimates/**
  - apps/api/src/modules/admin-settings/**
  - apps/web/src/pages/admin/AdminCompanyPage.tsx
done_when: >-
  pnpm build && pnpm lint && grep -rq "fuel-price/refresh" apps/api/src/modules && grep -q
  "fuel-price/refresh" apps/web/src/pages/admin/AdminCompanyPage.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# Fuel price — show when it went stale, and let someone refresh it

## What actually happened, on 2026-08-19

The `fuelpricesqld` API key expired. The daily fetch failed every night from **04/08 to 20/08** —
sixteen days. Nothing surfaced it. `OperationsSettings.fuelPricePerLitre` sat frozen the whole
time and kept being used to price waste lines, because that price feeds the transport cost engine's
fuel term and is snapshotted onto each line as `quotedFuelPricePerLitre`.

Two separate gaps let a credential failure become sixteen days of silently stale pricing. This
slice closes both. **It does not change how prices are calculated.**

## Gap 1 — the timestamp is shown but never judged

`AdminCompanyPage.tsx:647` and `:701` already render `fuelPriceFetchedAt`, as a plain
`toLocaleString` in muted grey. A date rendered in grey next to a price reads as metadata, not as a
warning. "fetched 04/08/2026" looked exactly the same on day one as it did on day sixteen.

Worse, the "Live feed" banner at `:627` only renders when
`fuelPriceSource === "fuelpricesqld:Ampol-Diesel-max"` **and** `fuelPricePerLitre != null`. If the
feed has never succeeded, or the source is manual, there is **no fetch indicator at all** — the
case where you most need one.

## Gap 2 — there is no way to refresh

`runDailyFuelPriceFetch` (`fuel-price.service.ts:95`) is decorated
`@Cron("0 2 * * *", timeZone: "UTC")` and **nothing else calls it** — verified across the whole
repo. After fixing the key on 20/08 the only option was to wait until 02:00 UTC.

## Do

### API

1. Add a **manual refresh** endpoint. Guard it with `@RequirePermissions("platform.admin")` —
   the same permission `@Get("operations")` and `@Patch("operations")` already use
   (`admin-settings.controller.ts:97`, `:105`). Do not invent a new permission.

2. **Put it wherever `FuelPriceService` can be injected without creating a circular module
   dependency.** `admin-settings` does not currently import the estimates module; if wiring it
   creates a cycle, expose the route from the estimates side instead. **State which you chose and
   why in the PR body.** The path must contain the literal `fuel-price/refresh` either way.

3. **The refresh must report its outcome.** `runDailyFuelPriceFetch` returns `void` and swallows
   failures into log warnings — correct for an unattended cron, useless for a button. Refactor so
   the shared work returns a result the caller can act on — at minimum `{ ok, message }`, plus the
   new price and timestamp on success. The cron keeps ignoring the result and keeps its current
   behaviour; only the manual path surfaces it. **A refresh button that reports nothing is the same
   disease this slice exists to cure.**

4. **Do not change the failure policy.** On a failed fetch the service logs and retains the last
   stored price (`fuel-price.service.ts:167`). That is right — a stale price beats a blank one.
   Keep it. What changes is that the staleness becomes visible, not that the value is discarded.

5. **Guard against hammering the upstream.** The service already tracks `lastPriceFetchAt`. Refuse
   a manual refresh within a short window of the previous one (60 seconds is enough) and return a
   clear message rather than calling out again. It is a paid third-party API.

### Web — `AdminCompanyPage.tsx`

6. **Judge the age, do not just print it.** Alongside the existing timestamp, render how old the
   fetch is and mark it when it is overdue. The cron runs daily, so anything past **48 hours** is
   unambiguously overdue — one missed run could be a blip, two is a fault. Put the threshold in a
   named constant with a comment saying why it is 48 and not 24.

7. **Show the fetch state even when the live-feed banner does not render.** Move the staleness
   readout out of the `fuelPriceSource === "fuelpricesqld:Ampol-Diesel-max"` condition, or add a
   second readout, so a never-succeeded feed still shows *something*. Cover the
   `fuelPriceFetchedAt === null` case explicitly — "never fetched" is a real state and is worse
   than stale, not better.

8. **Add a "Refresh now" button** next to the fuel price, calling the new endpoint. Show the result
   inline — new price and time on success, the reason on failure. Use `readApiErrorMessage` from
   `lib/api-errors.ts`; do not render a raw response body.

9. Tests: the service returning a failure result without clearing the stored price; the throttle
   refusing a second immediate call; and the staleness helper at the boundary (47h fine, 49h
   overdue).

## Do NOT

- Do NOT change how any price is calculated, or touch `scope-waste.service.ts`.
- Do NOT change the cron schedule, or make the cron surface errors to users.
- Do NOT store the API key anywhere new, log it, or return it. The vault owns it.
- Do NOT add an email or notification alert — that is a bigger decision about who gets told, and it
  is not this slice. Visible-when-you-look is the goal here.
- Do NOT touch `/sot/` or Azure/Entra/SharePoint.

## Verify

- `pnpm build && pnpm lint`; API and web tests green.
- **Exercise both paths and say what happened in the PR body**: a refresh that succeeds, and one
  that fails (point it at a bad token in a scratch environment). Confirm the stored price is
  unchanged after the failure — that is the property most at risk from this refactor.
- Confirm the staleness marker appears for a `fuelPriceFetchedAt` older than 48h, and that a
  `null` shows "never fetched".
- **Do not run this against production.**

## Unrelated, and worth knowing while you are on this screen

The same form has "Travel rate (per km, AUD)" (`AdminCompanyPage.tsx:673`). It is currently unset,
which is why every Tip Finder result reads *"Travel rate not configured — set in Operations
Settings."* That is configuration, not code — **do not change it in this PR**, just be aware the
field is right there.

## STANDING AUTHORITY

Visibility and a manual trigger only. No pricing changes. Stop and report rather than widening scope.
