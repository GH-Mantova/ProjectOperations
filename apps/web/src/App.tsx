import { useEffect, useState, type ReactElement } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { can, canAny } from "./auth/permissions";
import { runDraftPurgeJob } from "./drafts";
import { LoginPage } from "./pages/LoginPage";
import { ShellLayout } from "./components/ShellLayout";
import { DashboardPlaceholderPage } from "./pages/DashboardPlaceholderPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { UsersPage } from "./pages/UsersPage";
import { RolesPage } from "./pages/RolesPage";
import { PermissionsPage } from "./pages/PermissionsPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { PlatformPage } from "./pages/PlatformPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { TenderingDashboardPage } from "./pages/tendering/TenderingDashboardPage";
import { TenderingSettingsPage } from "./pages/TenderingSettingsPage";
import { ResourcesPage } from "./pages/ResourcesPage";
import { ArchivePage } from "./pages/archive/ArchivePage";
import { ArchiveDetailPage } from "./pages/archive/ArchiveDetailPage";
import { TenderingPage } from "./pages/tendering/TenderingPage";
import { TenderDetailPage } from "./pages/tendering/TenderDetailPage";
import { TenderingReportsPage } from "./pages/tendering/TenderingReportsPage";
import { JobsListPage } from "./pages/jobs/JobsListPage";
import { JobDetailPage } from "./pages/jobs/JobDetailPage";
import { ProjectsListPage } from "./pages/projects/ProjectsListPage";
import { ProjectDetailPage } from "./pages/projects/ProjectDetailPage";
import { SchedulerHomePage } from "./pages/scheduler/SchedulerHomePage";
import { CalendarSyncPage } from "./pages/calendar/CalendarSyncPage";
import { WorkersListPage } from "./pages/workers/WorkersListPage";
import { WorkerDetailPage } from "./pages/workers/WorkerDetailPage";
import { WorkerLeaveApprovalsPage } from "./pages/workers/WorkerLeaveApprovalsPage";
import { FieldLeavePage } from "./pages/field/FieldLeavePage";
import { AssetsListPage } from "./pages/assets/AssetsListPage";
import { AssetDetailPage } from "./pages/assets/AssetDetailPage";
import { InventoryPage } from "./pages/inventory/InventoryPage";
import { ProcurementPage } from "./pages/procurement/ProcurementPage";
import { ExpensesPage } from "./pages/expenses/ExpensesPage";
import { MaintenancePage as MaintenanceDashboardPage } from "./pages/maintenance/MaintenancePage";
import { PlantUtilisationReportPage } from "./pages/maintenance/PlantUtilisationReportPage";
import { FormsListPage } from "./pages/forms/FormsListPage";
import { FormDesignerPage } from "./pages/forms/FormDesignerPage";
import { FormFillPage } from "./pages/forms/FormFillPage";
import { FormSubmissionDetailPage } from "./pages/forms/FormSubmissionDetailPage";
import { PublicFormFillPage } from "./pages/forms/PublicFormFillPage";
import { CorrectiveActionsPage } from "./pages/forms/CorrectiveActionsPage";
import { CorrectiveActionDetailPage } from "./pages/forms/CorrectiveActionDetailPage";
import { DocumentsWorkspacePage } from "./pages/documents/DocumentsWorkspacePage";
import { MasterDataWorkspacePage } from "./pages/master-data/MasterDataWorkspacePage";
import { ClientsGridPage } from "./pages/master-data/ClientsGridPage";
import { DirectoryPage } from "./pages/directory/DirectoryPage";
import { SitesListPage } from "./pages/sites/SitesListPage";
import { SiteDetailPage } from "./pages/sites/SiteDetailPage";
import { CompliancePage } from "./pages/compliance/CompliancePage";
import { SafetyPage } from "./pages/safety/SafetyPage";
import { EstimateRatesAdminPage } from "./pages/EstimateRatesAdminPage";
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
import { TimesheetApprovalPage } from "./pages/timesheets/TimesheetApprovalPage";
import { PayrollExportPage } from "./pages/field/PayrollExportPage";
import { DocketsRegisterPage } from "./pages/dockets/DocketsRegisterPage";
import { UserProfilePage } from "./pages/account/UserProfilePage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { AdminCompanyPage } from "./pages/admin/AdminCompanyPage";
import { DataModelMapPage } from "./pages/admin/DataModelMapPage";
import { AiSettingsPage } from "./personas/pages/AiSettingsPage";
import { SettingsShell, AdminOnly, SuperUserOnly } from "./components/SettingsShell";
import { ContractsListPage } from "./pages/contracts/ContractsListPage";
import { ContractDetailPage } from "./pages/contracts/ContractDetailPage";
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
import { ReportsPage } from "./pages/reports/ReportsPage";
import { OfflineProvider } from "./offline/OfflineContext";
import { OfflineIndicator } from "./offline/OfflineIndicator";
import { InstallPrompt } from "./offline/InstallPrompt";
import { UpdatePromptToast } from "./pwa/UpdatePromptToast";
import { SurveyCaptureFormPage } from "./pages/surveys/SurveyCaptureFormPage";
import { ClientSatisfactionPage } from "./pages/surveys/ClientSatisfactionPage";
import { ConfirmProvider } from "./hooks/useConfirm";

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
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
                <OfflineProvider>
                  <OfflineIndicator />
                  <InstallPrompt />
                  <FieldLayout />
                </OfflineProvider>
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
            <Route path="leave" element={<FieldLeavePage />} />
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
            <Route path="/account/calendar-sync" element={<Navigate to="/settings/calendar-sync" replace />} />
            <Route path="/tenders" element={<TenderingPage />} />
            <Route path="/tenders/dashboard" element={<TenderingDashboardPage />} />
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
            <Route path="/tenders/clients" element={<Navigate to="/directory?tab=clients" replace />} />
            <Route path="/tenders/contacts" element={<Navigate to="/directory?tab=contacts" replace />} />
            <Route path="/tenders/settings" element={<TenderingSettingsPage />} />
            <Route path="/tenders/reports" element={<TenderingReportsPage />} />
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
            <Route path="/workers/leave-approvals" element={<WorkerLeaveApprovalsPage />} />
            <Route path="/workers/:id" element={<WorkerDetailPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/assets" element={<AssetsListPage />} />
            <Route path="/assets/:id" element={<AssetDetailPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/procurement" element={<ProcurementPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/maintenance" element={<MaintenanceDashboardPage />} />
            <Route path="/maintenance/utilisation" element={<PlantUtilisationReportPage />} />
            <Route path="/forms" element={<FormsListPage />} />
            <Route path="/forms/designer/:templateId" element={<FormDesignerPage />} />
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
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="calendar-sync" element={<CalendarSyncPage />} />
              <Route path="company" element={<AdminCompanyPage />} />
              <Route path="ai" element={<AiSettingsPage />} />
              <Route
                path="data-model"
                element={
                  <SuperUserOnly>
                    <DataModelMapPage />
                  </SuperUserOnly>
                }
              />
              <Route
                path="administration/system"
                element={
                  <AdminOnly>
                    <AdminSettingsPage />
                  </AdminOnly>
                }
              />
              <Route
                path="administration/users"
                element={
                  <AdminOnly>
                    <UsersPage />
                  </AdminOnly>
                }
              />
              <Route
                path="administration/roles"
                element={
                  <AdminOnly>
                    <RolesPage />
                  </AdminOnly>
                }
              />
              <Route
                path="administration/permissions"
                element={
                  <AdminOnly>
                    <PermissionsPage />
                  </AdminOnly>
                }
              />
              <Route
                path="administration/audit"
                element={
                  <AdminOnly>
                    <AuditLogsPage />
                  </AdminOnly>
                }
              />
              <Route
                path="administration/platform"
                element={
                  <AdminOnly>
                    <PlatformPage />
                  </AdminOnly>
                }
              />
              <Route
                path="administration/job-roles"
                element={
                  <AdminOnly>
                    <JobRolesPage />
                  </AdminOnly>
                }
              />
            </Route>
            {/* Legacy path redirects — keep bookmarks working. */}
            <Route path="/admin/users" element={<Navigate to="/settings/administration/users" replace />} />
            <Route path="/admin/roles" element={<Navigate to="/settings/administration/roles" replace />} />
            <Route path="/admin/permissions" element={<Navigate to="/settings/administration/permissions" replace />} />
            <Route path="/admin/audit" element={<Navigate to="/settings/administration/audit" replace />} />
            <Route path="/admin/platform" element={<Navigate to="/settings/administration/platform" replace />} />
            <Route path="/admin/settings" element={<Navigate to="/settings/administration/system" replace />} />
            <Route path="/admin/company" element={<Navigate to="/settings/company" replace />} />
            <Route path="/admin/data-model" element={<Navigate to="/settings/data-model" replace />} />
            <Route path="/admin/ai-settings" element={<Navigate to="/settings/ai" replace />} />
            <Route path="/contracts" element={<ContractsListPage />} />
            <Route path="/contracts/:id" element={<ContractDetailPage />} />
            <Route path="/admin/estimate-rates" element={<EstimateRatesAdminPage />} />
            <Route path="/admin/rates-lists" element={<RatesListsAdminPage />} />
            <Route path="/admin/automations" element={<AutomationsPage />} />
            <Route path="/admin/job-roles" element={<Navigate to="/settings/administration/job-roles" replace />} />
            <Route path="/account" element={<Navigate to="/settings/account" replace />} />
            <Route path="/notifications" element={<Navigate to="/settings/notifications" replace />} />
            {/* /dashboards now redirects to the user's first custom dashboard
                (or to / if they have none). /dashboards/:id still serves the
                user-owned dashboard system built on DashboardCanvas. */}
            <Route path="/dashboards" element={<DashboardRedirectPage />} />
            <Route path="/dashboards/global/:id" element={<GlobalDashboardPage />} />
            <Route path="/dashboards/:id" element={<UserDashboardPage />} />
            <Route path="/master-data" element={<MasterDataWorkspacePage />} />
            <Route path="/master-data/clients-grid" element={<ClientsGridPage />} />
            <Route path="/sites" element={<SitesListPage />} />
            <Route path="/sites/:id" element={<SiteDetailPage />} />
            <Route path="/compliance" element={<CompliancePage />} />
            <Route path="/safety" element={<SafetyPage />} />
            <Route path="/cases" element={<CasesListPage />} />
            <Route path="/cases/:id" element={<CaseDetailPage />} />
            <Route path="/knowledge" element={<KbListPage />} />
            <Route path="/knowledge/:id" element={<KbArticlePage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/directory" element={<DirectoryPage />} />
            {/* Legacy per-surface directory routes redirect into the unified
                Directory tabs. Kept as redirects (not removed) so old bookmarks,
                shared links, and any lingering deep-links keep working. */}
            <Route
              path="/directory/subcontractors"
              element={<Navigate to="/directory?tab=subcontractors" replace />}
            />
            <Route
              path="/directory/contacts"
              element={<Navigate to="/directory?tab=contacts" replace />}
            />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/archive/:jobId" element={<ArchiveDetailPage />} />
            <Route path="/surveys/capture" element={<SurveyCaptureFormPage />} />
            <Route path="/surveys/satisfaction" element={<ClientSatisfactionPage />} />
          </Route>
        </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </ConfirmProvider>
      </PortalAuthProvider>
    </AuthProvider>
  );
}
