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

> **STATUS 2026-09-01.** SLICES 1–4 remain valid and unshipped. SLICES 5–15 are SUPERSEDED by
> the hex-baseline ratchet — see SECTION 5 — and are kept only as a record of measured debt.
> SLICES 16–17 are superseded by the S1–S6 chain in SECTION 7.

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

## 5. Sequencing Rule — AMENDED 2026-09-01

**Superseded:** the original rule gated SLICE 17 behind cleanup SLICES 5–13. That rule is
withdrawn. It was written when the literal count was 3,792; by 2026-09-01 it was 4,339, and
SLICE 12's scope had outgrown the prompt linter's ten-file cap. A campaign that loses ground
while it waits cannot be a precondition for the work it is blocking.

**In force from 2026-09-01:** the visible theme surface is gated on the **hex-baseline ratchet**
(`docs/qa/hex-baseline.json` + `scripts/pipeline/check-hex-ratchet.mjs`) being live in CI. The
ratchet permits a file's hex count to fall or hold and rejects any increase, and requires new
files to start at zero. Token cleanup then happens opportunistically: a lane converts the
literals in a file it is already editing, and the baseline shrinks as a side effect of ordinary
work.

SLICES 5–15 are retained below as a **record of measured debt, not as a work queue.** They are
not to be armed as written; their file lists and counts are stale.

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


---

## 7. The build chain in force from 2026-09-01

Marco approved `erp-theme-builder-mockup.pdf` on 2026-09-01 and confirmed he wants all of it
built. This chain replaces SLICES 16–17.

| Slice | What it does | Schema? | Gate |
|---|---|---|---|
| **S1** | The application path: a saved scheme reaches the screen as CSS variables. Two colours (`--brand-primary`, `--brand-accent`), one unprivileged read route. | no | none |
| **S2** | The hex-baseline ratchet. | no | none |
| **S3** | Widen `BrandColorScheme` to the mockup's full palette — sidebar, cards, text, five status colours. | **YES — migration** | **Marco merges** |
| **S4** | Named presets (Harbour, Graphite) as seeded `BrandColorScheme` rows. | seed only | S3 |
| **S5** | Density (compact / comfortable) as tokens plus a control. | no | SLICE 1 |
| **S6** | Live preview, contrast-ratio badges, per-user override in `localStorage`. | no | S3, S5 |

**Only S3 carries a migration.** The per-user override in S6 is stored in `localStorage`
alongside the existing `projectops.theme` key, so it needs no table: there is no general
per-user preference store in the schema today (`NotificationPreference` is the only per-user
preference model, and it is channel-specific).

**SLICE 1 of this plan is a genuine prerequisite for S3 and S5.** MEASURED 2026-09-01:
`tokens.css` declares 14 dark-mode tokens in `:root[data-theme="dark"]` and duplicates all 14
inside the `@media (prefers-color-scheme: dark)` fallback. Until that duplication is collapsed,
every token S3 and S5 add must be written twice and kept in sync by hand.

Presets are seeded rows rather than `[data-theme="..."]` CSS blocks — the approved mockup is a
*builder*, so a preset the company cannot then edit would contradict it. This supersedes
SLICE 3's and SLICE 16's `[data-theme]` approach.
