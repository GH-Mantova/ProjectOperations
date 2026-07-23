VERDICT: MERGE

## Scope compliance

In scope:
- `apps/api/src/modules/metadata/` (controller, module, service) — `GET /meta/catalog` endpoint, JWT-guarded, reads from disk fresh per request
- `apps/api/src/app.module.ts` — MetadataModule import and registration
- `apps/web/src/dashboards/SmartWizardModal.tsx` — React component that fetches catalog on open via `authFetch("/meta/catalog")`
- `apps/web/src/dashboards/smartWizardCatalog.ts` — logic-only helper functions (parseCatalog, buildWizardWidgetFilters, visibleModels, etc.), no code generation
- `apps/web/src/dashboards/DashboardCanvas.tsx` — button integration and modal wiring

Out of scope (if any):
- None detected. All changes are confined to declared scope in prompt (apps/web/src/**, apps/api/src/**)

## Self-verification claims

- [GREEN] `pnpm build` — CI passed (Web — lint, logic tests, build)
- [GREEN] `pnpm lint` — CI passed (Web — lint, logic tests, build)
- [GREEN] grep -rqi "SmartWizard" apps/web/src — SmartWizardModal.tsx, smartWizardCatalog.ts, and DashboardCanvas.tsx all contain SmartWizard artifacts
- [GREEN] Catalog fetched at runtime on modal open (no build-time snapshot, no code generation)
  - MetadataService.getCatalog() reads docs/data-model/metadata-catalog.json fresh each call via fs.readFileSync()
  - No writeFile/codegen/writeFileSync calls anywhere in the web or metadata module code
- [GREEN] Model list populated from /meta/catalog at request time (useQuery fetches on modal open)
- [GREEN] JWT auth guard on controller (JwtAuthGuard applied)
- [GREEN] Added model to catalog surfaces in wizard with no rebuild (staleTime: 30_000 on useQuery + parser is pure logic)
- [GREEN] Wire to dashboard builder UI complete (button + modal integration in DashboardCanvas)
- [GREEN] Config output via customWidget shape (WidgetConfigEntry uses CUSTOM_WIDGET_TYPE, filters bag matches existing CustomWidgetConfig contract)

## Key design decisions verified

1. **Runtime-read enforced**: MetadataService reads fresh from disk on every getCatalog() call. No in-memory cache. No build-time bundling. Catalog changes surface on next request without restart.

2. **Auto-generator on first open**: If catalog file is missing, tryGenerate() invokes `build-relationship-map.mjs` with a 20s timeout and logs failures without breaking the flow — fresh checkout workable without manual setup step.

3. **Placeholder contract for unmapped models**: 
   - Renderable models (Tender, Job, Project, FormSubmission, MaintenancePlan) → live data source + metric/chart selection
   - Non-renderable models → config object with `dataSource: "__wizard:<model>"` + placeholder signal
   - Both emit valid WidgetConfigEntry shape; CustomBuilderWidget handles the rendering difference

4. **Field classification from catalog**:
   - Measure fields: catalog fields with role "measure" or "measure-candidate"
   - Dimension fields: catalog fields with role "dimension"
   - Uses catalog roles directly; no hardcoded model metadata

5. **No TypeScript generation**: All catalog → config translation is pure logic in smartWizardCatalog.ts. The wizard parses the catalog object at runtime and emits a widget config; the web client executes directly without codegen.

## Risks Marco should know

- **None identified**. The endpoint is JWT-guarded, the wizard reads cleanly at runtime with no file system write, and the placeholder contract gracefully handles unmapped models until rendering slices are implemented. The auto-generator on first open (if missing) is wrapped in try-catch and logged (no crash).
- The staleTime of 30_000 (30 seconds) means rapid catalog edits to the JSON file may not reflect in the wizard for up to 30s depending on when the modal is opened. This is documented in the code and is intentional to avoid excessive re-fetches.

## Test plan coverage

All manual test plan items are substantiated by code:
- `pnpm build && pnpm lint` — green across all CI jobs
- Dashboard button wired: `data-testid="smart-wizard-button"` in DashboardCanvas
- Modal load state with Skeleton component + error state with retry button
- Model picker populated from `visibleModels(catalog)` — filters by `wizardVisible: true`
- Measure/dimension pickers use `measureFieldsOf()` and `dimensionFieldsOf()` — pure field classification
- Chart type picker: hardcoded SMART_WIZARD_CHART_TYPES = ["kpi", "bar", "donut", "line"]
- Config submission via `buildWizardWidgetFilters()` → emits WidgetConfigEntry with proper type and filters
- Placeholder rendering for unmapped models supported (config.dataSource = "__wizard:ModelName")

## Recommendation

Safe to merge. Implementation precisely follows the "runtime catalog, no codegen" mandate from BACKLOG-DECISIONS.md #4. Scope, self-verification, and design all align with prompt guardrails.
