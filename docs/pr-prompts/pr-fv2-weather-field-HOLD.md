---
premise: ! grep -q "weather_capture" apps/web/src/pages/forms/formDesignerState.ts
premise_means: The forms designer has no weather field type yet, though the site-weather service it must reuse (WeatherService.getSiteWeather) already exists on main.
scope:
  - apps/web/src/pages/forms/formDesignerState.ts
  - apps/web/src/pages/forms/FormFillPage.tsx
  - apps/api/src/modules/forms/forms-engine.service.ts
  - apps/api/src/modules/forms/forms-engine.controller.ts
done_when: pnpm build && pnpm lint && grep -q "weather_capture" apps/web/src/pages/forms/formDesignerState.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# Forms Engine v2 — weather auto-capture field (F-6)

`apps/api/src/modules/platform/weather.service.ts` already exists on `main`:
`WeatherService.getSiteWeather(siteId)` proxies Open-Meteo, caches results
30 minutes, and returns a typed `WeatherResponse` (`unavailable: false` with
`current`/`forecast`, or `unavailable: true` with a `reason`). It is wired
into `platform.module.ts` and exposed via `weather.controller.ts` (the
dashboard "Site weather" widget already calls
`GET /dashboards/weather/site/:siteId` per `apps/web/src/dashboards/widgets/weather.tsx`).
This slice adds a small forms field that auto-captures the current weather
for the submission's site, reusing that service — it does not create a new
one.

## What to build

- In `apps/web/src/pages/forms/formDesignerState.ts`: add
  `"weather_capture"` to the `FieldType` union and to the `site_whs` entry
  of `PALETTE_GROUPS` (label "Weather", icon of your choosing). No
  `defaultConfigFor` entry is needed — the field has no authored config, it
  resolves automatically at fill time.
- In `apps/web/src/pages/forms/FormFillPage.tsx`: add a `weather_capture`
  case to the field-type switch that calls the existing weather endpoint
  (`GET /dashboards/weather/site/:siteId`, the same one
  `apps/web/src/dashboards/widgets/weather.tsx` already calls) using the
  submission's `siteId`, renders the current conditions read-only, and
  writes the resolved summary into `FormSubmissionValue` (text/json — pick
  whichever existing typed column the renderer already uses for read-only
  system fields, matching the pattern used for `system_field` at L957).
- In `apps/api/src/modules/forms/forms-engine.service.ts`: add a
  weather system-value resolver that, given the submission's `siteId`,
  calls `WeatherService.getSiteWeather` (inject `WeatherService` — it is
  already exported from `PlatformModule`, which `FormsModule` already
  imports per `forms.module.ts`) and returns the current conditions for use
  wherever the engine resolves system values for a submission (the same
  context-auto-fill mechanism used for project/timesheet/allocation at
  L105-138). If the site has no weather available (`unavailable: true`),
  resolve to `null` rather than throwing — never block a submission on a
  weather-fetch failure.
- Keep this slice small: no schema change, no new endpoints beyond wiring
  the resolver into the existing context-auto-fill path.

## Do NOT

- Do not create a new weather service, proxy, or cache — reuse
  `WeatherService.getSiteWeather` exactly as the dashboard widget does.
- Do not touch `weather.service.ts`, `weather.controller.ts`, or
  `platform.module.ts` — those are complete on `main`.
- Do not touch the WHS fields (worker/asset picker, signature seal) — that
  is F-5.
- Do not touch Azure/Entra/SharePoint.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

One attempt. Never exit silently — if something in scope cannot be completed,
say `NO-OP: <reason>` and stop. Never ask or stand by for approval. Read the
CI job log before diagnosing any failure. `pnpm build` and `pnpm lint` must
both pass before pushing.
