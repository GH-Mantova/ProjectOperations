# Theme System Plan

Authored by PR Master with Marco, 2026-08-17.
References briefs 1.2 / 1.2.1 / 1.2.2 and decisions D5 + D24.
This is a DOCS-ONLY planning artefact — every code slice chains behind it and is armed one at a time by Marco.

---

## 1. Goal + Non-Goals

### Goal

Deliver four named colour schemes, each working in both light and dark mode, with a separate density
(compact/comfortable) control. The company sets a default; individual users may override. Picker and
density control are built first, exposed last — no user sees them until token cleanup for the agreed
areas has landed.

### Non-Goals

- No layout changes of any kind.
- No navigation structure changes (nav grouping, menu positions, nav labels, per-item annotations).
- No new nav components sourced from the approved CRM mock-up (the mock-up is reference for the
  "Initial" scheme's visual language only).
- No PDF or email theming (generated documents keep fixed company branding per decision D8).
- No login-page theming (pre-auth and out of scope).
- No new brand-hue decision without Marco's explicit sign-off.
- No parallel token system — all work extends the existing system shipped in PR #668.

---

## 2. Current State

### Token system (shipped in PR #668)

The following files exist on `origin/main` and are the foundation this plan extends:

- `apps/web/src/styles/tokens.css` — defines `:root` (light defaults) and a `[data-theme="dark"]`
  block. It also contains a verbatim duplicate of the entire `[data-theme="dark"]` block inside an
  `@media (prefers-color-scheme: dark)` fallback. Every new token must currently be added twice.
  SLICE 1 collapses this duplication.
- `apps/web/src/lib/theme.ts` — exports `ThemePreference = "system" | "light" | "dark"`.
- `apps/web/src/components/ThemeToggle.tsx` — existing toggle component.
- `apps/web/index.html` — contains the first-paint bootstrap script that applies the stored
  preference before React hydrates, preventing a flash on reload.

### Branding API (shipped in PR #616)

The API module contains:

- `BrandColorScheme` entity (name + primary/secondary hex, full CRUD).
- `BrandAsset` entity.
- `CompanyProfile.activeColorSchemeId` field.

The web app currently consumes none of this API. No database migration is needed for SLICE 17's
company-default wiring.

### Hard-coded colour literals on `origin/main`

Total: **3,763** hex colour literals (`#RRGGBB` / `#RGB` / `#RRGGBBAA`) across the codebase.

| Area | Count | Files |
|---|---|---|
| tendering | 372 | 34 |
| crm | 267 | 10 |
| shared components | 219 | 28 |
| field | 199 | 11 |
| workers | 90 | 6 |
| projects | 74 | 5 |
| jobs | 7 | 2 |
| scheduler | 6 | 2 |
| dashboard | 0 | 0 |

`sot/01` SECTION 5 already mandates "Always use CSS variables — never hardcode colour values". The
codebase violates that rule 3,763 times. This plan recommends a `sot/01` doc-reconcile PR to add
the enforcement reference and lint rule to the charter. That reconcile PR must NOT edit `sot/`
content itself (CP-24 blocks sub-agent writes); it is logged as an Open Decision below for Marco to
arm manually.

---

## 3. Slice List (dependency order)

### SLICE 1 — Token foundation

**Goal:** Collapse the duplicated dark block so each token is declared exactly once; add density
tokens (spacing, row height, control height). Zero visual change.

**Expected files:**
- `apps/web/src/styles/tokens.css`

**Executable premise:** `grep -c "prefers-color-scheme: dark" apps/web/src/styles/tokens.css`
returns a value greater than 0 (duplication present).

**Requires merged:** none (can be armed immediately after this plan is reviewed).

---

### SLICE 2 — Named-theme registry + ThemePicker.tsx (NOT mounted)

**Goal:** Widen `ThemePreference` to include named scheme values; create `ThemePicker.tsx` as a
built-but-not-mounted component; keep first-paint bootstrap in sync so no scheme flashes on reload.

**Expected files:**
- `apps/web/src/lib/theme.ts`
- `apps/web/src/components/ThemePicker.tsx`
- `apps/web/index.html` (bootstrap script updated)

**Executable premise:** `grep -q "ThemePicker" apps/web/src/components/ThemePicker.tsx` returns
non-zero (file does not exist yet).

**Requires merged:** SLICE 1.

---

### SLICE 3 — `[data-theme="initial"]` block

**Goal:** Define the "Initial" scheme's full `[data-theme="initial"]` block: colours, type scale,
spacing rhythm, radii. Visual language sourced from the approved CRM mock-up; nav structure and new
components from that mock-up are NOT included.

**Expected files:**
- `apps/web/src/styles/tokens.css`

**Executable premise:** `grep -q 'data-theme="initial"' apps/web/src/styles/tokens.css` returns
non-zero (block absent).

**Requires merged:** SLICE 2.

---

### SLICE 4 — Density preference + compact/comfortable control (NOT mounted)

**Goal:** Implement density as a token-based control (not a class). Build the
compact/comfortable UI component but do NOT mount it in the shell.

**Expected files:**
- `apps/web/src/styles/tokens.css` (density token additions if not already in SLICE 1)
- `apps/web/src/components/DensityControl.tsx`

**Executable premise:** `grep -q "DensityControl" apps/web/src/components/DensityControl.tsx`
returns non-zero (file does not exist yet).

**Requires merged:** SLICE 3.

---

### SLICES 5–7 — Token cleanup: shared components (28 files, three slices of ≤10 files)

**Goal (SLICE 5):** Replace hard-coded hex literals with CSS variable references in shared
component files 1–10 of 28.

**Goal (SLICE 6):** Replace hard-coded hex literals in shared component files 11–20 of 28.

**Goal (SLICE 7):** Replace hard-coded hex literals in shared component files 21–28 of 28.

**Expected files (each slice):** ≤10 files under `apps/web/src/components/` (shared area).

**Executable premise (each slice):**
```
grep -rE "#[0-9a-fA-F]{3,8}" <files-in-scope>
```
Returns matches before the slice; returns no matches after for those same files.

**Per-slice acceptance:** The PR body must include before/after screenshots of the busiest shared
component screen, in light mode and dark mode. A green build is not evidence the screen still looks
right.

**Requires merged:** SLICE 4 (for SLICE 5); SLICE 5 (for SLICE 6); SLICE 6 (for SLICE 7).

---

### SLICES 8–11 — Token cleanup: tendering (34 files, four slices of ≤10 files)

**Goal (SLICE 8):** Replace hard-coded hex literals in tendering files 1–10 of 34.

**Goal (SLICE 9):** Replace hard-coded hex literals in tendering files 11–20 of 34.

**Goal (SLICE 10):** Replace hard-coded hex literals in tendering files 21–30 of 34.

**Goal (SLICE 11):** Replace hard-coded hex literals in tendering files 31–34 of 34.

**Expected files (each slice):** ≤10 files under the tendering area.

**Executable premise (each slice):**
```
grep -rE "#[0-9a-fA-F]{3,8}" <files-in-scope>
```
Returns matches before the slice; returns no matches after for those same files.

**Per-slice acceptance:** The PR body must include before/after screenshots of the busiest
tendering screen, in light mode and dark mode. A green build is not evidence the screen still looks
right.

**Requires merged:** SLICE 7 (for SLICE 8); chain within 8→9→10→11.

---

### SLICE 12 — Token cleanup: CRM (10 files)

**Goal:** Replace all hard-coded hex literals in the CRM area (10 files, 267 literals).

**Expected files:** ≤10 files under the CRM area.

**Executable premise:**
```
grep -rE "#[0-9a-fA-F]{3,8}" <crm-files-in-scope>
```
Returns matches before; returns no matches after.

**Per-slice acceptance:** PR body must include before/after screenshots of the busiest CRM screen,
in light mode and dark mode. A green build is not evidence the screen still looks right.

**Requires merged:** SLICE 11.

---

### SLICE 13 — Token cleanup: projects + jobs + scheduler (9 files)

**Goal:** Replace all hard-coded hex literals across projects (5 files), jobs (2 files), and
scheduler (2 files). Total: 9 files, 87 literals.

**Expected files:** ≤9 files across projects / jobs / scheduler areas.

**Executable premise:**
```
grep -rE "#[0-9a-fA-F]{3,8}" <projects-jobs-scheduler-files-in-scope>
```
Returns matches before; returns no matches after.

**Per-slice acceptance:** PR body must include before/after screenshots of the busiest screen in
each of the three sub-areas (projects, jobs, scheduler), in light mode and dark mode. A green build
is not evidence the screen still looks right.

**Requires merged:** SLICE 12.

---

### SLICES 14–15 — Token cleanup: field (11 files, two slices) — CONDITIONAL

**CONDITIONAL:** These slices are only armed if Marco confirms that field screens are in scope for
the theme system.

**Goal (SLICE 14):** Replace hard-coded hex literals in field files 1–6 of 11.

**Goal (SLICE 15):** Replace hard-coded hex literals in field files 7–11 of 11.

**Expected files (each slice):** ≤6 files under the field area.

**Executable premise (each slice):**
```
grep -rE "#[0-9a-fA-F]{3,8}" <field-files-in-scope>
```
Returns matches before; returns no matches after for those files.

**Per-slice acceptance:** PR body must include before/after screenshots of the busiest field
screen, in light mode and dark mode. A green build is not evidence the screen still looks right.

**Requires merged:** SLICE 13 (for SLICE 14); SLICE 14 (for SLICE 15). Both conditional on Marco's
confirmation.

---

### SLICE 16 — Schemes three and four — GATED ON MARCO

**GATED:** This slice must not be armed until Marco has reviewed mock-ups and chosen two candidate
schemes. The mock-up review round happens before this slice is armed.

**Goal:** Add two `[data-theme]` blocks for the third and fourth named colour schemes.

**Expected files:**
- `apps/web/src/styles/tokens.css`
- `apps/web/src/lib/theme.ts` (extend scheme registry)

**Executable premise:** Marco has confirmed scheme names and approved mock-ups. Grep for the two new
`data-theme` attribute values to confirm they are absent before arming.

**Requires merged:** SLICE 15 (or SLICE 13 if field is out of scope).

---

### SLICE 17 — EXPOSE LAST: mount picker + density control in shell

**Goal:** Mount `ThemePicker.tsx` and `DensityControl.tsx` in the shell top bar. Wire company
default from the existing branding API (`BrandColorScheme` / `CompanyProfile.activeColorSchemeId`)
with personal user override stored in user preferences.

**Expected files:**
- Shell layout component (top bar)
- `apps/web/src/lib/theme.ts` (personal override persistence)
- API integration for company default read

**Executable premise:** `grep -rE "#[0-9a-fA-F]{3,8}" apps/web/src` across all non-conditional
cleanup areas returns no matches (all literals replaced).

**Requires merged:** SLICE 16, AND all non-conditional cleanup slices (5–13) merged.

---

## 4. Per-Slice Acceptance: Grep Premise and Screenshot Requirement

For every token-cleanup slice (SLICES 5–15), the following acceptance criteria apply:

1. **Before premise:** Run `grep -rE "#[0-9a-fA-F]{3,8}" <area-files>` against the files in
   scope for that slice. The command must return matches. If it returns nothing, the premise is
   already satisfied and the slice is a NO-OP.

2. **After premise:** After the PR lands, running `grep -rE "#[0-9a-fA-F]{3,8}" <same-files>`
   must return no matches.

3. **Screenshots required in the PR body:** Before/after screenshots of the busiest screen in the
   area, captured in light mode and dark mode (four screenshots per slice). A green CI build is not
   evidence the screen still looks correct — visual regressions do not fail tests.

---

## 5. Sequencing Rule

**SLICE 17 must not be armed until every non-conditional cleanup slice (SLICES 5–13) has merged to
main.** The field slices (14–15) are conditional and do not block SLICE 17 if Marco confirms field
is out of scope. SLICE 16 must also be merged before SLICE 17 is armed.

---

## 6. Open Decisions

The following decisions are unresolved and require Marco's input before the affected slices can be
armed:

1. **Field screens in or out of scope.** 199 literals across 11 files. Marco must confirm before
   SLICES 14–15 are armed. If out of scope, those slices are dropped and SLICE 16 becomes dependent
   on SLICE 13 instead.

2. **Which two candidate schemes Marco picks for SLICE 16.** A mock-up review round must occur
   before SLICE 16 is armed. The plan does not pre-select schemes; that decision belongs to Marco.

3. **Recommended `sot/01` SECTION 5 doc-reconcile.** `sot/01` SECTION 5 mandates CSS variables,
   but there is no lint rule enforcing it. A doc-reconcile PR should add the lint rule reference and
   note the 3,763 pre-existing violations as technical debt being retired by this plan. This
   reconcile PR is outside the scope of any code-writer agent (CP-24); Marco arms it manually.
