# Settings restructure — permission-code map (SLICE 1)

**Status:** SLICE 1 of `docs/plans/settings-restructure-plan.md`. Docs-only.
**Grounded against:** `apps/api/src/common/permissions/permission-registry.ts` @ HEAD
`feat/settings-restructure-permission-map` (2026-08-04). Positive control: `masterdata.manage`
is present at `apps/api/src/common/permissions/permission-registry.ts:36` — grep hits confirm
the registry is the authoritative catalogue used by `seed-reference.ts` and the API guards.
**Marco decisions (in — no PENDING block):**
- Missing codes are created AS NAMED: `company.manage`, `automations.manage`, `audit.view`,
  `platform.manage`, `ai.manage`. (Two of these five turn out to already exist — see below.)
- Job roles' final home is `/workers/job-roles` (plan SLICE 15 variant chosen).

Registry file cited below is
`apps/api/src/common/permissions/permission-registry.ts`; line numbers are its lines.

---

## 1. Map — every §2 target IA entry to its permission code

Format: `<IA entry>` — `<gate declared in plan §2>` → **EXISTS**(<file:line>) or **NEW**(<slice
that first gates on it>).

### Personal (no gate — self-service)

| IA entry | Plan gate | Status |
|---|---|---|
| Account (`/settings/account`) | none | EXISTS (no gate needed) |
| Notification preferences (`/settings/notifications`) | none | EXISTS (no gate needed) |
| Calendar sync (`/settings/calendar-sync`) | none | EXISTS (no gate needed) |

Note: `calendar.sync` is a distinct permission at registry:62 that gates the actual sync
action, not the settings screen. The screen itself is self-service.

### Company

| IA entry | Plan gate | Status | Evidence / slice |
|---|---|---|---|
| Company profile (`/settings/company`) | `company.manage` | **NEW** | first gated by SLICE 3 (drops `AdminOnly` on `/admin/company` and replaces with `RequirePermissions perms={["company.manage"]}`). Registry has **no** `company.*` entries today. |
| Reference data & Lists (`/settings/reference-data`) | `rates.manage` OR `lists.manage` | **EXISTS** | `rates.manage` @ registry:86; `lists.manage` @ registry:87. First gated by SLICE 6. |
| AI settings (`/settings/ai`) | `ai.manage` | **NEW** | first gated by SLICE 3 (adds a gate to the currently-ungated `SettingsShell` "AI settings" item — plan finding 7). Registry has only `ai.persona.tendering` @ registry:83; **no** `ai.manage`. |
| Data model (`/settings/data-model`) | super-user only | EXISTS (SuperUserGuard, not a permission code) | unchanged by this plan. |

### Administration

| IA entry | Plan gate | Status | Evidence / slice |
|---|---|---|---|
| Users (`/settings/administration/users`) | `users.view` | **EXISTS** | registry:16. First gated by SLICE 3/SLICE 7. |
| Roles & Permissions (`/settings/administration/roles`) | `roles.manage` | **NEW** | registry has `roles.view` (23), `roles.create` (24), `roles.update` (25) — **no** `roles.manage`. First gated by SLICE 3/SLICE 8. See §3 caveat below. |
| Audit log (`/settings/administration/audit`) | `audit.view` | **EXISTS** | registry:27. First gated by SLICE 3/SLICE 9. (Plan §4 SLICE 1 listed this as a candidate for a NEW code — it was wrong; the code already exists.) |
| Platform / Integrations (`/settings/administration/platform`) | `platform.manage` | **NEW** | registry has `platform.admin` (19), high-risk — **no** `platform.manage`. First gated by SLICE 3/SLICE 12. |
| Automations (`/settings/administration/automations`) | `automations.manage` | **EXISTS** | registry:117 (high-risk). First gated by SLICE 3/SLICE 10. (Plan §4 SLICE 1 listed this as a candidate for a NEW code — it was wrong; the code already exists.) |

---

## 2. NEW codes to add (per Marco's 2026-08-03 decision — names ARE final)

Three of the five codes Marco named as NEW are genuinely absent from the registry today. The
other two (`audit.view`, `automations.manage`) already exist and need no work — the plan §4
SLICE 1 candidate list overstated the gap.

| New code | Module | Proposed label | Proposed description | isHighRisk? | Enforcement site (first) |
|---|---|---|---|---|---|
| `company.manage` | `company` | "Manage company profile and defaults" | "Edit the tenant's company profile, ABN, addresses, and commercial defaults" | no (edits are already audit-logged; contained blast radius) | SLICE 3 — `SettingsShell` "Company" item; SLICE 6/13 route guards on `/settings/company` |
| `platform.manage` | `platform` | "Manage platform integrations and connectors" | "Manage SharePoint mappings, integration connectors, and platform-level configuration (non-provider-secret writes)" | no (kept distinct from the existing high-risk `platform.admin` at registry:19, which governs AI-provider / secret writes) | SLICE 3 — `SettingsShell` gate; SLICE 12 route guard on `/settings/administration/platform` |
| `ai.manage` | `ai` | "Manage AI assistants and personas" | "Configure AI personas, assistant settings and prompt libraries. Does NOT grant provider-secret writes (those stay behind `platform.admin`)." | no | SLICE 3 — `SettingsShell` "AI settings" gate; route guard on `/settings/ai` |

Rules the adding slice must follow (so nothing regresses):
- Append the three entries to `permissionRegistry` in `apps/api/src/common/permissions/permission-registry.ts`; **do not** re-order existing entries. The seed's additive-only guarantee (`seed-reference.ts:115-127`) requires stable codes.
- Update the permission-matrix snapshot spec (`apps/api/src/common/auth/__tests__/permission-matrix.spec.ts`) in the same PR.
- Do **not** modify the two codes that already exist (`audit.view`, `automations.manage`). Reuse them.

---

## 3. Caveat — `roles.manage` was in §2 but NOT on Marco's NEW list

Plan §2 declares the "Roles & Permissions" screen gate as `roles.manage`. The registry has
`roles.view` / `roles.create` / `roles.update` but no `roles.manage`. Marco's 2026-08-03
"missing codes created AS NAMED" list did NOT include `roles.manage`. Two clean options for
the slice that adds this gate (SLICE 8) — this is the decision to surface:

- **Option A (recommended):** slice SLICE 8 gates on the existing `roles.update` (registry:25,
  high-risk, description "Update roles"). It semantically matches the screen's writes and
  avoids a fourth new `roles.*` code that overlaps `roles.update`.
- **Option B:** add a new `roles.manage` aggregate code alongside `roles.update`. Increases
  the surface area without a distinct enforcement point today.

**Ask surfaced for Marco (single decision, resolved at SLICE 8 open-time — not blocking
this SLICE 1 doc):** A or B? Default assumed for SLICE 8's PR body: **A**.

---

## 4. Proposed seeded-role bindings for the NEW codes

Author's proposals. Marco confirms at the slice that adds each code to roles (per task brief:
"adding codes to ROLES is an authorization grant and stays with him"). Grounded against
`apps/api/prisma/seed-reference.ts`, which upserts four core roles: `Admin` (63-74),
`Planner` (76-87), `Field` (89-100), `Viewer` (102-113). Admin receives every registry entry
automatically via the `permissions.map(...)` expansion at `seed-reference.ts:131-134`, so any
new code lands on Admin without a targeted grant.

| New code | Admin | Planner | Field | Viewer | Rationale |
|---|---|---|---|---|---|
| `company.manage` | yes (auto) | no | no | no | Company profile edits stay admin-only today. Planners view — do not edit — company defaults. |
| `platform.manage` | yes (auto) | no | no | no | Integrations/SharePoint mapping is admin surface. Reuses the same audience `platform.admin` already targets, minus the secret-write risk. |
| `ai.manage` | yes (auto) | no | no | no | AI persona configuration is admin surface today (`ai.persona.tendering` is per-user-use, distinct axis). |

Every row above lands via `createMany({ skipDuplicates: true })` in the seed slice that adds
the code, honouring the additive-only rule (`seed-reference.ts:115-127`).

---

## 5. Verification

- [x] Every entry in plan §2 target IA appears exactly once above (§1).
- [x] `EXISTS` rows cite a specific registry line (positive control: `masterdata.manage` at
      registry:36).
- [x] `NEW` rows name the slice that first gates on the code.
- [x] The two plan-§4 SLICE 1 misfires (`audit.view`, `automations.manage` already exist) are
      called out explicitly so no future slice re-adds them.
- [x] The `roles.manage` gap (in §2 but not on Marco's NEW list) is surfaced as a discrete
      SLICE 8-time decision with a recommended default.
- [ ] `pnpm lint` (run at PR-open time).
