# GPS Native Wrapper — Option B Build Plan (BYOD, mandated + disclosure)

**Status:** Shaping / pre-build draft. Folds into `sot/06-active-specs.md` (via 05-sot-keeper) once slices land.
**Decision owner:** Marco — reactivated 2026-08-12 (the item was parked 2026-08-03).
**Supersedes:** the "parked / do not re-surface" standing note on `gps-native-wrapper-app` in `docs/pr-prompts/BACKLOG.yaml`.

## 1. Why now
The 2026-08-03 ruling parked the native wrapper — Option A (track-while-open, honest gaps) stood. On 2026-08-12 a client requirement for a gapless location trail reactivated it. This is the Option B plan.

## 2. Decisions locked (2026-08-12)
- **Approach — Option B:** Capacitor wrapper, field-surfaces only. Option C (full React Native rewrite) stays rejected — it means two frontends for no gain over Capacitor.
- **Device model — BYOD:** workers' personal phones. No MDM enforcement; distribution via the public App Store and Google Play.
- **Governance — mandated + explicit disclosure:** background tracking is required for field roles, gated behind a prominent in-app disclosure and an acknowledgement that is recorded (audit). Wording pending HR/legal sign-off.

## 3. What already exists on `main` (do NOT rebuild)
The capture layer shipped already; the wrapper only adds *background execution*.
- `apps/api/src/modules/field/field.service.ts`:
  - Clock-on/off capture of lat/lng/accuracy, behind a **hard gate** (a clock time cannot be set without coordinates).
  - `recordLocationBreadcrumb()` — appends breadcrumb points to the worker's currently-open shift; **120s throttle**; open-shift-only; **consent-gated**.
  - Per-worker `locationConsent` opt in/out (clock GPS and breadcrumbs persist only with consent).
  - Site geofences (`SiteGeofence`, geofence lookup).
- `apps/` contains only `api` and `web` — **no `apps/mobile` yet**.

## 4. The gap Option B closes
Mobile browsers/PWAs suspend the Geolocation API when the tab is backgrounded or the device locks, so the breadcrumb trail stops at screen-sleep — exactly the gaps Option A accepted. A Capacitor shell running an OS background-geolocation plugin keeps posting to the *existing* breadcrumb endpoint while a worker is on shift, producing a gapless trail.

## 5. Architecture
- **Shell:** a Capacitor project under `apps/mobile` wrapping the existing `apps/web` production build. No second frontend — the web app remains the entire UI.
- **Background location:** a background-geolocation Capacitor plugin started on clock-on and stopped on clock-off; posts to the existing `POST /field/.../breadcrumb` endpoint. Mirror the server's 120s throttle client-side to save battery.
- **On-shift lifecycle:** start on clock-on, stop on clock-off, survive app kill/restart via the OS scheduler.
- **Consent/disclosure gate:** first launch (and on any disclosure-version change) shows the mandated disclosure; the acknowledgement is recorded server-side before tracking can start; ties into the existing `locationConsent` flag.
- **BYOD specifics:**
  - iOS: request "When in use", then escalate to "Always Allow"; supply the purpose string; expect Apple's background-location review scrutiny.
  - Android: a foreground service with a persistent notification (Android 10+ background-location rules) plus a battery-optimisation exemption prompt.
  - Battery + data: throttle, coalesce, and stop cleanly off-shift.

## 6. New data — flag
The acknowledgement audit record likely needs a small model beyond the boolean `locationConsent` — e.g. `WorkerLocationDisclosureAck { workerId, disclosureVersion, acknowledgedAt }`. Schema change => `escalates:true`, its own reviewable PR.

## 7. Hard stops (prepared, never executed by an agent)
- **Apple Developer Program + Google Play Console** accounts, signing certs, provisioning — company legal identity, secrets, fees → Marco.
- **Store submission / distribution** → Marco (agent provides the runbook and exact steps).
- BYOD keeps **MDM/Intune out of scope**; if that ever changes it is shared-tenant infra and a hard stop.

## 8. Slice plan (proposed; not yet armed)
- **SLICE-0** — this plan (register it).
- **M-1** — scaffold the `apps/mobile` Capacitor project wrapping the web build; CI builds the shell. *(escalates: new top-level app + deps.)* Creating `apps/mobile` retires the backlog gate.
- **M-2** — background-geolocation plugin + on-shift start/stop lifecycle posting to the existing breadcrumb endpoint; client-side throttle.
- **M-3** — mandated disclosure + acknowledgement gate; `WorkerLocationDisclosureAck` model *(escalates: schema)*; wire to `locationConsent`.
- **M-4** — store-submission runbook + the exact Apple/Google steps for Marco; privacy-manifest / purpose strings.

## 9. Open items for Marco (before / around build)
1. **Client requirement specifics** — required accuracy, retention period, and whether "gapless" means continuous while-on-shift or something stricter (drives plugin config + retention).
2. **Disclosure wording** — HR/legal sign-off on the mandated-tracking notice.
3. **Store accounts** — confirm Apple Developer + Google Play availability (needed before M-4 can ship).
