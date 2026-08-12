# Fieldworker mobility — web-first now, native wrapper de-risked for later

**Status:** Shaping / pre-build draft. Folds into `sot/06-active-specs.md` (via 05-sot-keeper) once slices land.
**Decision owner:** Marco.
**Supersedes:** the "parked / do not re-surface" standing note on `gps-native-wrapper-app` in `docs/pr-prompts/BACKLOG.yaml`.

## Decision update — 2026-08-12 (web-first; native wrapper deferred but de-risked)
- **Near-term plan:** a **fieldworker WEB version of the ERP** (responsive / installable PWA). NOT a native app. No Apple/Google Developer accounts, no store spend now.
- **GPS on the web app = Option A (track-while-open).** A browser/PWA suspends geolocation when backgrounded or the phone locks, so the web app **cannot** produce a gapless trail. Acceptable for general field use.
- **⚠️ Gapless caveat:** if the client that reactivated this contractually needs a *gapless* trail, web-only will NOT satisfy it. Gapless requires the native wrapper (Apple **$99/yr** floor for the iPhones in the fleet). Confirm the client can accept track-while-open for now.
- **Device mix:** mixed iPhone + Android (confirmed).
- **Tracking scope:** on-shift only — from clock-on to clock-off (confirmed 2026-08-12).
- **Disclosure:** placeholder message for now; real mandated-tracking wording later (HR/legal).

### "Minimum background to enable future app development" — the wrapper-readiness seams
Bake these into the fieldworker web app now so a later Capacitor wrap is a thin step, not a rebuild:
1. **LocationProvider abstraction** — code the app against a `LocationProvider` interface with a **browser** implementation now (`navigator.geolocation` / `watchPosition`); a **native background-geolocation** implementation drops in later without touching any caller.
2. **On-shift lifecycle at the app layer** — start/stop tracking on clock-on / clock-off; a future native plugin feeds the same hooks.
3. **Consent / disclosure gate + acknowledgement** — implemented in the web app now; carries over unchanged to native.
4. **Cohesive fieldworker bundle/routes** — keep the field surface self-contained so a future `apps/mobile` Capacitor project can wrap that exact build with minimal config.
5. **Reuse the existing API as-is** — clock GPS, breadcrumb ingest, and `locationConsent` already ship on `main`; both the web app and any future wrapper POST to the same endpoints. No API rebuild.

### Explicitly deferred (the future native step, if/when a gapless client justifies the spend)
Create `apps/mobile`, add Capacitor + a background-geolocation plugin, obtain Apple/Google accounts, store distribution. See the Option B detail below — it becomes the plan for that step, and thanks to the seams above it collapses to roughly "M-1: scaffold + wrap".

---

## 1. Why the native option exists (retained for the future step)
The 2026-08-03 ruling parked the native wrapper — Option A (track-while-open, honest gaps) stood. On 2026-08-12 a client requirement for a gapless trail briefly reactivated Option B; it was then re-scoped to web-first (above), with the native path kept ready.

## 2. What already exists on `main` (do NOT rebuild)
The capture layer shipped already; a wrapper only adds *background execution*.
- `apps/api/src/modules/field/field.service.ts`:
  - Clock-on/off capture of lat/lng/accuracy, behind a **hard gate** (a clock time cannot be set without coordinates).
  - `recordLocationBreadcrumb()` — appends breadcrumb points to the worker's currently-open shift; **120s throttle**; open-shift-only; **consent-gated**.
  - Per-worker `locationConsent` opt in/out.
  - Site geofences (`SiteGeofence`, geofence lookup).
- `apps/` contains only `api` and `web` — **no `apps/mobile` yet**.

## 3. The gap only a native app can close
Mobile browsers/PWAs suspend the Geolocation API when backgrounded or locked, so the trail stops at screen-sleep. A Capacitor shell with an OS background-geolocation plugin keeps posting to the existing breadcrumb endpoint while a worker is on shift — the only route to a gapless trail.

## 4. Option B architecture (the deferred native step)
- **Shell:** a Capacitor project under `apps/mobile` wrapping the existing fieldworker web build. No second frontend.
- **Background location:** a background-geolocation plugin, started on clock-on / stopped on clock-off, posting to the existing endpoint; mirror the 120s throttle client-side.
- **BYOD specifics:** iOS "When in use" → "Always Allow" + purpose string (expect Apple review scrutiny); Android foreground-service + persistent notification + battery-optimisation exemption.
- **New data flag:** the acknowledgement audit record likely needs `WorkerLocationDisclosureAck { workerId, disclosureVersion, acknowledgedAt }` beyond the boolean `locationConsent` (schema ⇒ `escalates:true`).

## 5. Hard stops (prepared, never executed by an agent)
- Apple Developer Program (**$99/yr**) + Google Play Console — company legal identity, secrets, fees → Marco.
- Store submission / distribution → Marco (agent provides the runbook + exact steps).
- BYOD keeps MDM/Intune out of scope; if that changes it is shared-tenant infra and a hard stop.

## 6. Slice plan (only if/when the native step is approved)
- **M-1** — scaffold `apps/mobile` Capacitor project wrapping the fieldworker web build (thin, because of the readiness seams). Creating `apps/mobile` retires the backlog gate.
- **M-2** — background-geolocation plugin + on-shift lifecycle (reuses the web app's LocationProvider hooks).
- **M-3** — swap the native LocationProvider implementation in; disclosure/ack already present from the web app.
- **M-4** — store-submission runbook + exact Apple/Google steps for Marco.

## 7. Open items for Marco
1. **Client requirement** — can the reactivating client accept track-while-open (web) for now, or do they contractually need gapless (native)? Drives whether the native step is near-term.
2. **Disclosure wording** — HR/legal sign-off (placeholder used until then).
3. **Store accounts** — only needed if/when the native step is approved (Apple $99/yr floor).
