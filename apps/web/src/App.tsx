import { useEffect, useState, type ReactElement } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { can, canAny } from "./auth/permissions";
import { runDraftPurgeJob } from "./drafts";
import { LoginPage } from "./pages/LoginPage";
import { ShellLayout } from "./components/ShellLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DashboardPlaceholderPage } from "./pages/DashboardPlaceholderPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AdminUsersTab } from "./pages/admin/AdminUsersTab";
import { RolesPermissionsPage } from "./pages/administration/RolesPermissionsPage";
import { AdministrationLandingPage } from "./pages/administration/AdministrationLandingPage";
import { AdminClientVersionsPage } from "./pages/administration/AdminClientVersionsPage";
import { MapLocationsPage } from "./pages/administration/MapLocationsPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { PlatformPage } from "./pages/PlatformPage";
import { InboxPage } from "./pages/InboxPage";
import { NotificationPreferencesPage } from "./pages/settings/NotificationPreferencesPage";
import { HandoverTemplatePage } from "./pages/settings/HandoverTemplatePage";
import { ArchiveDetailPage } from "./pages/archive/ArchiveDetailPage";
import { TenderingPage } from "./pages/tendering/TenderingPage";
import { TenderDetailPage } from "./pages/tendering/TenderDetailPage";
import { JobsListPage } from "./pages/jobs/JobsListPage";
import { JobDetailPage } from "./pages/jobs/JobDetailPage";
import { ProjectsListPage } from "./pages/projects/ProjectsListPage";
import { ProjectDetailPage } from "./pages/projects/ProjectDetailPage";
import { SchedulerHomePage } from "./pages/scheduler/SchedulerHomePage";
import { CalendarSyncPage } from "./pages/calendar/CalendarSyncPage";
import { WorkersListPage } from "./pages/workers/WorkersListPage";
import { WorkerDetailPage } from "./pages/workers/WorkerDetailPage";
import { WorkerLeaveApprovalsPage } from "./pages/workers/WorkerLeaveApprovalsPage";
import { LiveCrewMapPage } from "./pages/workers/LiveCrewMapPage";
import { FieldLeavePage } from "./pages/field/FieldLeavePage";
import { FieldNotificationsPage } from "./pages/field/FieldNotificationsPage";
import { AssetsListPage } from "./pages/assets/AssetsListPage";
import { AssetDetailPage } from "./pages/assets/AssetDetailPage";
import { InventoryPage } from "./pages/inventory/InventoryPage";
import { ProcurementPage } from "./pages/procurement/ProcurementPage";
import { ExpensesPage } from "./pages/expenses/ExpensesPage";
import { MaintenancePage as MaintenanceDashboardPage } from "./pages/maintenance/MaintenancePage";
import { PlantUtilisationReportPage } from "./pages/maintenance/PlantUtilisationReportPage";
import { FormsListPage } from "./pages/forms/FormsListPage";
import { FormDesignerPage } from "./pages/forms/FormDesignerPage";
import { FormRulesBuilderPage } from "./pages/forms/FormRulesBuilderPage";
import { FormFillPage } from "./pages/forms/FormFillPage";
import { FormSubmissionDetailPage } from "./pages/forms/FormSubmissionDetailPage";
import { PublicFormFillPage } from "./pages/forms/PublicFormFillPage";
import { CorrectiveActionsPage } from "./pages/forms/CorrectiveActionsPage";
import { CorrectiveActionDetailPage } from "./pages/forms/CorrectiveActionDetailPage";
import { DocumentsWorkspacePage } from "./pages/documents/DocumentsWorkspacePage";
import { MasterDataWorkspacePage } from "./pages/master-data/MasterDataWorkspacePage";
import { DirectoryPage } from "./pages/directory/DirectoryPage";
import { SitesListPage } from "./pages/sites/SitesListPage";
import { SiteDetailPage } from "./pages/sites/SiteDetailPage";
import { MusterPage } from "./pages/sites/MusterPage";
import { CompliancePage } from "./pages/compliance/CompliancePage";
import { SafetyPage } from "./pages/safety/SafetyPage";
import { ScheduleOfRatesAdminPage } from "./pages/ScheduleOfRatesAdminPage";
import { JobSorAttachWizardPage } from "./pages/JobSorAttachWizardPage";
import { VariationPricingPage } from "./pages/VariationPricingPage";
import { JobRolesPage } from "./pages/admin/JobRolesPage";
import { RatesListsAdminPage } from "./pages/admin/RatesListsAdminPage";
import { AutomationsPage } from "./pages/admin/AutomationsPage";
import { UserDashboardPage } from "./pages/dashboards/UserDashboardPage";
import { DashboardRedirectPage } from "./pages/dashboards/DashboardRedirectPage";
import { GlobalDashboardPage } from "./pages/dashboards/GlobalDashboardPage";
import { FieldLayout } from "./layouts/FieldLayout";
import { FieldAllocationsPage } from "./pages/field/FieldAllocationsPage";
import { FieldPreStartPage } from "./pages/field/FieldPreStartPage";
import { FieldTimesheetPage } from "./pages/field/FieldTimesheetPage";
import { FieldDocumentsPage } from "./pages/field/FieldDocumentsPage";
import { FieldSafetyPage } from "./pages/field/FieldSafetyPage";
import { FieldDocketPage } from "./pages/field/FieldDocketPage";
import { FieldExpensePage } from "./pages/field/FieldExpensePage";
import { AgreedRecordCapturePage } from "./pages/AgreedRecordCapturePage";
import { TimesheetApprovalPage } from "./pages/timesheets/TimesheetApprovalPage";
import { PayrollExportPage } from "./pages/field/PayrollExportPage";
import { DocketsRegisterPage } from "./pages/dockets/DocketsRegisterPage";
import { UserProfilePage } from "./pages/account/UserProfilePage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { AdminCompanyPage } from "./pages/admin/AdminCompanyPage";
import { AdminCompaniesPage } from "./pages/admin/AdminCompaniesPage";
import { DataModelMapPage } from "./pages/admin/DataModelMapPage";
import { FieldDefinitionAdminPage } from "./pages/admin/FieldDefinitionAdminPage";
import { AiSettingsPage } from "./personas/pages/AiSettingsPage";
import { SettingsShell, AdminOnly, RequirePermissions, SuperUserOnly } from "./components/SettingsShell";
import { ContractsListPage } from "./pages/contracts/ContractsListPage";
import { ContractDetailPage } from "./pages/contracts/ContractDetailPage";
import { HandoverWizardPage } from "./pages/handover/HandoverWizardPage";
import { PortalAuthProvider } from "./portal/PortalAuthContext";
import { PortalLayout } from "./portal/PortalLayout";
import { PortalProtectedRoute } from "./portal/PortalProtectedRoute";
import { PortalLoginPage } from "./portal/pages/PortalLoginPage";
import { PortalAcceptInvitePage } from "./portal/pages/PortalAcceptInvitePage";
import { PortalDashboardPage } from "./portal/pages/PortalDashboardPage";
import { PortalProjectsPage } from "./portal/pages/PortalProjectsPage";
import { PortalJobsPage } from "./portal/pages/PortalJobsPage";
import { PortalQuotesPage } from "./portal/pages/PortalQuotesPage";
import { PortalDocumentsPage } from "./portal/pages/PortalDocumentsPage";
import { PortalAccountPage } from "./portal/pages/PortalAccountPage";
import { CasesListPage } from "./pages/cases/CasesListPage";
import { CaseDetailPage } from "./pages/cases/CaseDetailPage";
import { KbListPage } from "./pages/knowledge/KbListPage";
import { KbArticlePage } from "./pages/knowledge/KbArticlePage";
import { OpportunityDetailPage } from "./pages/crm/OpportunityDetailPage";
import { AccountDetailPage } from "./pages/crm/AccountDetailPage";
import { AccountsListPage } from "./pages/crm/AccountsListPage";
import { PipelineDashboardPage } from "./pages/crm/PipelineDashboardPage";
import { CommsHubPage } from "./pages/crm/CommsHubPage";
import { CrmIndex } from "./pages/crm/CrmIndex";
import { CrmCatchAllRedirect, ClientsEntryRedirect } from "./pages/crm/CrmRedirects";
import { TendersRegisterPage } from "./pages/crm/TendersRegisterPage";
import { CrmBoardContent } from "./pages/crm/CrmBoardPage";
import { RelationshipsPage } from "./pages/crm/RelationshipsPage";
import { ReportsPage } from "./pages/reports/ReportsPage";
import { OfflineProvider } from "./offline/OfflineContext";
import { OfflineIndicator } from "./offline/OfflineIndicator";
import { InstallPrompt } from "./offline/InstallPrompt";
import { UpdatePromptToast } from "./pwa/UpdatePromptToast";
import { ConfirmProvider } from "./hooks/useConfirm";

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

// Redirects to `to`, merging the inbound location.search into the target.
// The target's own query keys win (so `?tab=` from the target is preserved)
// while inbound `?new=1`, `?highlight=…` and friends survive the hop.
function QueryPreservingRedirect({ to }: { to: string }) {
  const location = useLocation();
  const [path, targetSearch = ""] = to.split("?");
  const merged = new URLSearchParams(location.search);
  const targetParams = new URLSearchParams(targetSearch);
  for (const [k, v] of targetParams) merged.set(k, v);
  const search = merged.toString();
  return <Navigate to={search ? `${path}?${search}` : path} replace />;
}

function FieldOnlyGuard({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  // Field-only users (have field.view but not projects.view / tenders.view / users.view) are
  // redirected here from the root. If a desktop user lands on /field/* they can still use it.
  if (!user) return children;
  const hasField = can(user, "field.view");
  if (!hasField) return <Navigate to="/" replace />;
  return children;
}

// Global "Home" dashboard id — seeded by migration
// 20260716120000_user_default_dashboard. When the resolver returns this
// id we stay on the frontend's Home (`/` -> DashboardPlaceholderPage);
// any other id means the user has picked a personal default and we
// redirect them to the standalone renderer.
const HOME_DASHBOARD_ID = "seed-home-dashboard";

function RootRedirect({ children }: { children: ReactElement }) {
  const { user, authFetch } = useAuth();
  const hasField = can(user, "field.view");
  const hasDesktop = canAny(
    user,
    "projects.view",
    "tenders.view",
    "users.view",
    "dashboards.view"
  );
  const fieldOnly = Boolean(user) && hasField && !hasDesktop;

  // `undefined` = resolver still in flight; `null` = confirmed no
  // personal default (stay on children); string = navigate there.
  const [redirect, setRedirect] = useState<string | null | undefined>(
    user ? (fieldOnly ? "/field/allocations" : undefined) : null
  );

  useEffect(() => {
    if (!user) {
      setRedirect(null);
      return;
    }
    if (fieldOnly) {
      setRedirect("/field/allocations");
      return;
    }
    let cancelled = false;
    setRedirect(undefined);
    void authFetch("/users/me/default-dashboard")
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setRedirect(null);
          return;
        }
        const body = (await response.json()) as { id?: string; isFallback?: boolean };
        // Fallback (no override) OR the override IS Home: stay on `/`
        // so the existing DashboardPlaceholderPage renders. Non-Home
        // overrides route to the standalone renderer.
        if (!body?.id || body.isFallback || body.id === HOME_DASHBOARD_ID) {
          setRedirect(null);
        } else {
          setRedirect(`/dashboards/global/${body.id}`);
        }
      })
      .catch(() => {
        if (!cancelled) setRedirect(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, fieldOnly, authFetch]);

  if (redirect === undefined) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
        Loading your dashboard…
      </div>
    );
  }
  if (redirect) return <Navigate to={redirect} replace />;
  return children;
}

// PR #111 — once-per-session purge sweep + legacy localStorage migration.
// Runs after the auth context resolves so we have a userId for the
// migration step. Desktop, portal, and field routes all benefit from
// the daily purge regardless of which surface the user logs into.
function DraftPurgeRunner() {
  const { user } = useAuth();
  useEffect(() => {
    void runDraftPurgeJob(user?.id ?? null);
  }, [user?.id]);
  return null;
}

export function App() {
  return (
    <AuthProvider>
      <DraftPurgeRunner />
      <UpdatePromptToast />
      {/* PR F FIX 1 — OfflineProvider scoped to /field/* only. Desktop and
          portal routes are online-only, so they don't need the IndexedDB
          outbox / online-state listeners running for every navigation. */}
      <PortalAuthProvider>
        <ConfirmProvider>
        <Routes>
          <Route path="/portal/login" element={<PortalLoginPage />} />
          <Route path="/portal/accept-invite" element={<PortalAcceptInvitePage />} />
          <Route element={<PortalProtectedRoute />}>
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<PortalDashboardPage />} />
              <Route path="projects" element={<PortalProjectsPage />} />
              <Route path="jobs" element={<PortalJobsPage />} />
              <Route path="quotes" element={<PortalQuotesPage />} />
              <Route path="documents" element={<PortalDocumentsPage />} />
              <Route path="account" element={<PortalAccountPage />} />
            </Route>
          </Route>
          <Route path="/login" element={<LoginPage />} />
          {/* Public / kiosk form capture routes — no auth required (PR #621) */}
          <Route path="/forms/public/:token" element={<PublicFormFillPage />} />
        <Route element={<ProtectedRoute />}>
          <Route
            path="/field"
            element={
              <FieldOnlyGuard>
                <ErrorBoundary
                  sectionName="Field offline layer"
                  fallback={
                    <div
                      role="alert"
                      style={{
                        padding: 24,
                        margin: 16,
                        borderRadius: 8,
                        background: "var(--surface-2, #fff4e5)",
                        color: "var(--text, #1f1f1f)",
                        border: "1px solid var(--border, #f0c674)",
                      }}
                    >
                      <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
                        Offline mode unavailable
                      </p>
                      <p style={{ margin: "0 0 12px" }}>
                        We couldn't start the offline queue on this device, so this session
                        will work online only. Any pending offline data was not lost — reload
                        once you have signal to try again.
                      </p>
                      <button
                        type="button"
                        className="s7-btn s7-btn--primary s7-btn--sm"
                        onClick={() => window.location.reload()}
                      >
                        Reload
                      </button>
                    </div>
                  }
                >
                  <OfflineProvider>
                    <OfflineIndicator />
                    <InstallPrompt />
                    <FieldLayout />
                  </OfflineProvider>
                </ErrorBoundary>
              </FieldOnlyGuard>
            }
          >
            <Route index element={<Navigate to="/field/allocations" replace />} />
            <Route path="allocations" element={<FieldAllocationsPage />} />
            <Route path="pre-start" element={<FieldPreStartPage />} />
            <Route path="timesheet" element={<FieldTimesheetPage />} />
            <Route path="documents" element={<FieldDocumentsPage />} />
            <Route path="safety" element={<FieldSafetyPage />} />
            <Route path="dockets" element={<FieldDocketPage />} />
            <Route path="agreed-records" element={<AgreedRecordCapturePage />} />
            <Route path="expenses" element={<FieldExpensePage />} />
            <Route path="leave" element={<FieldLeavePage />} />
            <Route path="notifications" element={<FieldNotificationsPage />} />
          </Route>
          <Route element={<ShellLayout />}>
            <Route
              path="/"
              element={
                <RootRedirect>
                  <DashboardPlaceholderPage />
                </RootRedirect>
              }
            />
            <Route path="/scheduler" element={<SchedulerHomePage />} />
            {/* Legacy sub-routes retired in favour of ?view= tabs on the
                consolidated Scheduler page. Handled by SchedulerHomePage. */}
            <Route path="/scheduler/:legacyView" element={<SchedulerHomePage />} />
            <Route path="/account/calendar-sync" element={<QueryPreservingRedirect to="/settings/calendar-sync" />} />
            <Route path="/tenders" element={<TenderingPage />} />
            {/* NAV-3: Leads & Opportunities lives standalone under Tendering
                (the old TenderingPage ?tab=leads-opportunities tab is retired).
                CrmBoardContent renders the triage list + forecast; the Tenders
                page now stays focused on draft entry + pricing + Pipeline. */}
            <Route path="/tenders/leads" element={<CrmBoardContent />} />
            {/* Codex-era /pipeline + /workspace + /create wrappers were
                retired in PR #78 alongside the Playwright spec rewrite. The
                routes redirect to the redesigned register so older bookmarks
                keep working. */}
            <Route path="/tenders/pipeline" element={<Navigate to="/tenders" replace />} />
            <Route path="/tenders/create" element={<Navigate to="/tenders" replace />} />
            <Route path="/tenders/workspace" element={<Navigate to="/tenders" replace />} />
            {/* Unified Directory redirects — /tenders/{clients,contacts} were
                per-tender views onto the same client/contact records that now
                live on the single Directory surface. TenderClientsPage /
                TenderContactsPage are still exported for anything importing
                them directly, but the routes now feed the tabbed page. */}
            <Route path="/tenders/clients" element={<QueryPreservingRedirect to="/directory?tab=clients" />} />
            <Route path="/tenders/contacts" element={<QueryPreservingRedirect to="/directory?tab=contacts" />} />
            <Route path="/tenders/:id" element={<TenderDetailPage />} />
            <Route path="/tenders/:id/scope" element={<TenderDetailPage />} />
            <Route path="/tenders/:id/quote" element={<TenderDetailPage />} />
            <Route path="/tenders/:id/rates" element={<TenderDetailPage />} />
            <Route path="/tenders/:id/history" element={<TenderDetailPage />} />
            <Route path="/jobs" element={<JobsListPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/projects" element={<ProjectsListPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/timesheets/approval" element={<TimesheetApprovalPage />} />
            <Route path="/timesheets/payroll-export" element={<PayrollExportPage />} />
            <Route path="/dockets" element={<DocketsRegisterPage />} />
            <Route path="/workers" element={<WorkersListPage />} />
            <Route path="/workers/live-crew" element={<LiveCrewMapPage />} />
            <Route path="/workers/leave-approvals" element={<WorkerLeaveApprovalsPage />} />
            {/* SLICE 15 (settings-restructure §3): Job roles moves out of
                Settings/Administration into the Workers area. Registered
                BEFORE /workers/:id so "job-roles" is not captured as an id. */}
            <Route path="/workers/job-roles" element={<JobRolesPage />} />
            <Route path="/workers/:id" element={<WorkerDetailPage />} />
            <Route path="/assets" element={<AssetsListPage />} />
            <Route path="/assets/:id" element={<AssetDetailPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/procurement" element={<ProcurementPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/maintenance" element={<MaintenanceDashboardPage />} />
            <Route path="/maintenance/utilisation" element={<PlantUtilisationReportPage />} />
            <Route path="/forms" element={<FormsListPage />} />
            <Route path="/forms/designer/:templateId" element={<FormDesignerPage />} />
            <Route path="/forms/designer/:templateId/rules" element={<FormRulesBuilderPage />} />
            <Route path="/forms/fill/:submissionId" element={<FormFillPage />} />
            <Route path="/forms/submissions/:id" element={<FormSubmissionDetailPage />} />
            <Route path="/forms/corrective-actions" element={<CorrectiveActionsPage />} />
            <Route path="/forms/corrective-actions/:id" element={<CorrectiveActionDetailPage />} />
            <Route path="/documents" element={<DocumentsWorkspacePage />} />
            {/* Unified Settings shell (feat/settings-shell) — folds the
                scattered /account, /notifications and /admin/* pages into one
                place with a left sub-nav. Legacy routes redirect in so old
                bookmarks and inbound links keep working. */}
            <Route path="/settings" element={<SettingsShell />}>
              <Route index element={<Navigate to="account" replace />} />
              <Route path="account" element={<UserProfilePage />} />
              {/* SLICE 5 (settings-restructure §3): Notification preferences
                  screen. Replaced the SLICE-4 /inbox redirect with the actual
                  per-user channel-preference page. */}
              <Route path="notifications" element={<NotificationPreferencesPage />} />
              <Route path="calendar-sync" element={<CalendarSyncPage />} />
              <Route
                path="company"
                element={
                  <AdminOnly>
                    <AdminCompanyPage />
                  </AdminOnly>
                }
              />
              <Route path="ai" element={<AiSettingsPage />} />
              {/* SLICE 6: Reference data & Lists — single Company home for the
                  rates/lists surface previously mounted on UserProfilePage
                  (GlobalListsSection) and reachable at /admin/rates-lists.
                  Renders the existing RatesListsAdminPage unchanged; that
                  page gates internally on rates.manage || lists.manage
                  (settings-restructure-plan §3, §4 redirect map). */}
              <Route path="reference-data" element={<RatesListsAdminPage />} />
              {/* B-HW-3: Handover Template editor — gated on handovertemplate.manage */}
              <Route path="handover-template" element={<HandoverTemplatePage />} />
              <Route
                path="data-model"
                element={
                  <SuperUserOnly>
                    <DataModelMapPage />
                  </SuperUserOnly>
                }
              />
              {/* CFX-2: Field definition admin screen — super-user only. */}
              <Route
                path="field-definitions"
                element={
                  <SuperUserOnly>
                    <FieldDefinitionAdminPage />
                  </SuperUserOnly>
                }
              />
              {/* MT-5: Company admin UI — create/manage Tenant rows + assign users. Super-user only. */}
              <Route
                path="companies"
                element={
                  <SuperUserOnly>
                    <AdminCompaniesPage />
                  </SuperUserOnly>
                }
              />
              {/* SLICE 17: administration hub — outer AdminOnly guard removed.
                  The landing page already calls filterSettingsNavItems and
                  renders <NoAccess/> when no items are visible, so it is
                  self-gating (fail-closed) for users who lack every child perm. */}
              <Route
                path="administration"
                element={<AdministrationLandingPage />}
              />
              {/* SLICE 17: system.manage gates the aggregate Admin Settings page. */}
              <Route
                path="administration/system"
                element={
                  <RequirePermissions perms={["system.manage"]}>
                    <AdminSettingsPage />
                  </RequirePermissions>
                }
              />
              {/* SLICE 17: users.view gates the Users admin page. */}
              <Route
                path="administration/users"
                element={
                  <RequirePermissions perms={["users.view"]}>
                    <AdminUsersTab />
                  </RequirePermissions>
                }
              />
              {/* SLICE 17: roles.view gates the Roles & Permissions page. */}
              <Route
                path="administration/roles"
                element={
                  <RequirePermissions perms={["roles.view"]}>
                    <RolesPermissionsPage />
                  </RequirePermissions>
                }
              />
              {/* SLICE 8: Permissions folded into the Roles & Permissions page.
                  The in-Settings /administration/permissions URL now redirects
                  to the merged surface so bookmarks + the /admin/permissions
                  legacy hop below still resolve. */}
              <Route
                path="administration/permissions"
                element={<Navigate to="/settings/administration/roles" replace />}
              />
              {/* SLICE 17: audit.view gates the Audit Logs page. */}
              <Route
                path="administration/audit"
                element={
                  <RequirePermissions perms={["audit.view"]}>
                    <AuditLogsPage />
                  </RequirePermissions>
                }
              />
              {/* SLICE 17: sharepoint.view gates the Platform (SharePoint config) page. */}
              <Route
                path="administration/platform"
                element={
                  <RequirePermissions perms={["sharepoint.view"]}>
                    <PlatformPage />
                  </RequirePermissions>
                }
              />
              {/* SLICE 15 (settings-restructure §3, §4 redirect map): Job
                  roles moved to /workers/job-roles. Keep the old Settings URL
                  reachable as a redirect so bookmarks resolve. */}
              <Route
                path="administration/job-roles"
                element={<Navigate to="/workers/job-roles" replace />}
              />
              {/* SLICE 10 (settings-restructure §3): Automations moves
                  under Administration. SLICE 17: automations.view gates
                  the route (AutomationsPage self-gates on the same code). */}
              <Route
                path="administration/automations"
                element={
                  <RequirePermissions perms={["automations.view"]}>
                    <AutomationsPage />
                  </RequirePermissions>
                }
              />
              {/* SLICE 14 (settings-restructure §3): Client versions and Map
                  locations dissolved from AdminSettingsPage inline tabs into
                  standalone Administration pages.
                  SLICE 17: system.manage gates both — same audience as the
                  sibling /system (Admin Settings) page. */}
              <Route
                path="administration/client-versions"
                element={
                  <RequirePermissions perms={["system.manage"]}>
                    <AdminClientVersionsPage />
                  </RequirePermissions>
                }
              />
              <Route
                path="administration/map-locations"
                element={
                  <RequirePermissions perms={["system.manage"]}>
                    <MapLocationsPage />
                  </RequirePermissions>
                }
              />
            </Route>
            {/* Legacy path redirects — keep bookmarks working. */}
            <Route path="/admin/users" element={<Navigate to="/settings/administration/users" replace />} />
            <Route path="/admin/roles" element={<Navigate to="/settings/administration/roles" replace />} />
            <Route path="/admin/permissions" element={<Navigate to="/settings/administration/permissions" replace />} />
            <Route path="/admin/audit" element={<Navigate to="/settings/administration/audit" replace />} />
            <Route path="/admin/platform" element={<Navigate to="/settings/administration/platform" replace />} />
            {/* #544 (sot/01 §6): non-admins must see NoAccess AT /admin/settings,
                not a silent redirect.
                SLICE 17: guards on system.manage (replaces AdminOnly). */}
            <Route path="/admin/settings" element={<RequirePermissions perms={["system.manage"]}><Navigate to="/settings/administration/system" replace /></RequirePermissions>} />
            <Route path="/admin/company" element={<Navigate to="/settings/company" replace />} />
            <Route path="/admin/data-model" element={<Navigate to="/settings/data-model" replace />} />
            <Route path="/admin/field-definitions" element={<Navigate to="/settings/field-definitions" replace />} />
            <Route path="/admin/ai-settings" element={<Navigate to="/settings/ai" replace />} />
            {/* SLICE-4c: AI-keys entry surface retired. The ProviderKeyManager
                sections that lived inside /settings/ai (CompanySettingsTab +
                MySettingsTab) have been replaced with pointer banners to the
                unified vault panel. Any bookmark that targeted the old key-entry
                area is redirected to AdminSettings → Integrations / API keys.
                Six-month retirement window per unified-api-key-vault-and-
                geocoding-failover.md §4d (retire + redirect). No expiry timer
                is implemented — remove these routes after 2027-02. */}
            <Route
              path="/settings/ai/keys"
              element={<Navigate to="/settings/administration/system?tab=integrations" replace />}
            />
            <Route
              path="/admin/ai-keys"
              element={<Navigate to="/settings/administration/system?tab=integrations" replace />}
            />
            <Route path="/contracts" element={<ContractsListPage />} />
            <Route path="/contracts/:id" element={<ContractDetailPage />} />
            {/* B-HW-7: Handover wizard — launched from contract detail page */}
            <Route path="/handover/:id" element={<HandoverWizardPage />} />
            {/* SLICE 11b: legacy estimate-rates admin page retired; redirect to canonical reference-data screen. */}
            <Route path="/admin/estimate-rates" element={<Navigate to="/settings/reference-data" replace />} />
            <Route path="/admin/schedule-of-rates" element={<ScheduleOfRatesAdminPage />} />
            {/* SoR S4: attach a rate-book snapshot to a job or tender. */}
            <Route path="/schedule-of-rates/attach" element={<JobSorAttachWizardPage />} />
            {/* SoR S6: desktop-price a Variation from the locked Job SoR snapshot. */}
            <Route path="/variations/:id/pricing" element={<VariationPricingPage />} />
            <Route path="/admin/rates-lists" element={<Navigate to="/settings/reference-data" replace />} />
            <Route path="/admin/automations" element={<Navigate to="/settings/administration/automations" replace />} />
            {/* SLICE 15: /admin/job-roles retargets to the new Workers URL
                directly (was previously chained through /settings). */}
            <Route path="/admin/job-roles" element={<Navigate to="/workers/job-roles" replace />} />
            <Route path="/account" element={<Navigate to="/settings/account" replace />} />
            {/* SLICE 4: /inbox is the new top-level route for the follow-up
                inbox. Legacy /notifications now redirects here (settings-
                restructure-plan §4 redirect map). */}
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/notifications" element={<Navigate to="/inbox" replace />} />
            {/* /dashboards now redirects to the user's first custom dashboard
                (or to / if they have none). /dashboards/:id still serves the
                user-owned dashboard system built on DashboardCanvas. */}
            <Route path="/dashboards" element={<DashboardRedirectPage />} />
            <Route path="/dashboards/global/:id" element={<GlobalDashboardPage />} />
            <Route path="/dashboards/:id" element={<UserDashboardPage />} />
            {/* /master-data was the legacy "Directory" workspace. Marco ruling
                2026-08-03: the unified /directory is canonical (Clients +
                Subcontractors + Contacts). The naked route redirects into
                /directory?tab=clients; the Sites sub-view stays reachable at
                /master-data?tab=sites because its slide-over enforces AU
                postcode validation that the /sites SiteFormModal does not
                (follow-up: port validation to SiteFormModal, then delete this
                shim entirely). MasterDataWorkspacePage also still exports the
                ClientsTab that DirectoryPage renders. */}
            <Route path="/master-data" element={<MasterDataWorkspacePage />} />
            <Route path="/sites" element={<SitesListPage />} />
            <Route path="/sites/:id" element={<SiteDetailPage />} />
            <Route path="/sites/:siteId/muster/:eventId" element={<MusterPage />} />
            <Route path="/compliance" element={<CompliancePage />} />
            <Route path="/safety" element={<SafetyPage />} />
            <Route path="/cases" element={<CasesListPage />} />
            <Route path="/cases/:id" element={<CaseDetailPage />} />
            <Route path="/knowledge" element={<KbListPage />} />
            <Route path="/knowledge/:id" element={<KbArticlePage />} />
            {/* NAV-1: /crm index now redirects to /crm/accounts via CrmIndex. */}
            <Route index path="/crm" element={<CrmIndex />} />
            <Route path="/crm/opportunities/:id" element={<OpportunityDetailPage />} />
            {/* NAV-2: Accounts index page — Client-360 landing. */}
            <Route path="/crm/accounts" element={<AccountsListPage />} />
            <Route path="/crm/accounts/:id" element={<AccountDetailPage />} />
            {/* NAV-3: /crm/register — read-only view of every tender across
                all statuses, with CLIENT + STATUS columns and filters. */}
            <Route path="/crm/register" element={<TendersRegisterPage />} />
            {/* CRM-6: pipeline + win/loss dashboard (read-only). */}
            <Route path="/crm/pipeline" element={<PipelineDashboardPage />} />
            {/* CRM-4: Comms hub — internal threads + To-Do sub-module. Anchored
                via ?entityType=…&entityId=… so any record page can link in
                without the sub-module knowing about their models. */}
            <Route path="/crm/comms" element={<CommsHubPage />} />
            {/* CRM-2: Relationship intelligence — notes log + going-cold nudge
                + repeat-business surfacing. */}
            <Route path="/crm/relationships" element={<RelationshipsPage />} />
            {/* NAV-4: Catch-all for dead /crm/* paths → /crm/accounts.
                Must sit AFTER all named /crm/** routes so real routes still
                resolve first (React Router v6 most-specific-first matching). */}
            <Route path="/crm/*" element={<CrmCatchAllRedirect />} />
            {/* NAV-4: Light bookmark alias /clients → /crm/accounts.
                Deep Directory decommission deferred to site-dissolution-plan. */}
            <Route path="/clients" element={<ClientsEntryRedirect />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/directory" element={<DirectoryPage />} />
            {/* Legacy per-surface directory routes redirect into the unified
                Directory tabs. Kept as redirects (not removed) so old bookmarks,
                shared links, and any lingering deep-links keep working. */}
            <Route
              path="/directory/subcontractors"
              element={<QueryPreservingRedirect to="/directory?tab=subcontractors" />}
            />
            <Route
              path="/directory/contacts"
              element={<QueryPreservingRedirect to="/directory?tab=contacts" />}
            />
            {/* /archive is now a redirect into the Documents workspace's
                Archived tab — the ArchivePage component still renders there
                (DocumentsWorkspacePage imports it). The /archive/:jobId
                detail route stays; JobDetailPage links straight into it. */}
            <Route path="/archive" element={<QueryPreservingRedirect to="/documents?tab=archived" />} />
            <Route path="/archive/:jobId" element={<ArchiveDetailPage />} />
          </Route>
        </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </ConfirmProvider>
      </PortalAuthProvider>
    </AuthProvider>
  );
}
