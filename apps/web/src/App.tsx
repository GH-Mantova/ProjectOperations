import type { ReactElement } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { ShellLayout } from "./components/ShellLayout";
import { DashboardPlaceholderPage } from "./pages/DashboardPlaceholderPage";
import { UsersPage } from "./pages/UsersPage";
import { RolesPage } from "./pages/RolesPage";
import { PermissionsPage } from "./pages/PermissionsPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { PlatformPage } from "./pages/PlatformPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { DashboardsPage } from "./pages/DashboardsPage";
import { TenderingDashboardPage } from "./pages/tendering/TenderingDashboardPage";
import { CreateTenderPage } from "./pages/CreateTenderPage";
import { TenderPipelinePage } from "./pages/TenderPipelinePage";
import { TenderWorkspacePage } from "./pages/TenderWorkspacePage";
import { TenderClientsPage } from "./pages/TenderClientsPage";
import { TenderContactsPage } from "./pages/TenderContactsPage";
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
import { SchedulerWorkspacePage } from "./pages/scheduler/SchedulerWorkspacePage";
import { WorkersListPage } from "./pages/workers/WorkersListPage";
import { WorkerDetailPage } from "./pages/workers/WorkerDetailPage";
import { AssetsListPage } from "./pages/assets/AssetsListPage";
import { AssetDetailPage } from "./pages/assets/AssetDetailPage";
import { MaintenancePage as MaintenanceDashboardPage } from "./pages/maintenance/MaintenancePage";
import { FormsListPage } from "./pages/forms/FormsListPage";
import { FormDesignerPage } from "./pages/forms/FormDesignerPage";
import { FormSubmitPage } from "./pages/forms/FormSubmitPage";
import { DocumentsWorkspacePage } from "./pages/documents/DocumentsWorkspacePage";
import { MasterDataWorkspacePage } from "./pages/master-data/MasterDataWorkspacePage";
import { SubcontractorsPage } from "./pages/directory/SubcontractorsPage";
import { ContactsPage } from "./pages/directory/ContactsPage";
import { EstimateRatesAdminPage } from "./pages/EstimateRatesAdminPage";
import { UserDashboardPage } from "./pages/dashboards/UserDashboardPage";
import { FieldLayout } from "./layouts/FieldLayout";
import { FieldAllocationsPage } from "./pages/field/FieldAllocationsPage";
import { FieldPreStartPage } from "./pages/field/FieldPreStartPage";
import { FieldTimesheetPage } from "./pages/field/FieldTimesheetPage";
import { FieldDocumentsPage } from "./pages/field/FieldDocumentsPage";
import { FieldSafetyPage } from "./pages/field/FieldSafetyPage";
import { TimesheetApprovalPage } from "./pages/timesheets/TimesheetApprovalPage";
import { UserProfilePage } from "./pages/account/UserProfilePage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { ContractsListPage } from "./pages/contracts/ContractsListPage";
import { ContractDetailPage } from "./pages/contracts/ContractDetailPage";

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

function FieldOnlyGuard({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  // Field-only users (have field.view but not projects.view / tenders.view / users.view) are
  // redirected here from the root. If a desktop user lands on /field/* they can still use it.
  if (!user) return children;
  const hasField = user.permissions.includes("field.view");
  if (!hasField) return <Navigate to="/" replace />;
  return children;
}

function RootRedirect({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  if (user) {
    const hasField = user.permissions.includes("field.view");
    const hasDesktop =
      user.permissions.includes("projects.view") ||
      user.permissions.includes("tenders.view") ||
      user.permissions.includes("users.view") ||
      user.permissions.includes("dashboards.view");
    if (hasField && !hasDesktop) {
      return <Navigate to="/field/allocations" replace />;
    }
  }
  return children;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route
            path="/field"
            element={
              <FieldOnlyGuard>
                <FieldLayout />
              </FieldOnlyGuard>
            }
          >
            <Route index element={<Navigate to="/field/allocations" replace />} />
            <Route path="allocations" element={<FieldAllocationsPage />} />
            <Route path="pre-start" element={<FieldPreStartPage />} />
            <Route path="timesheet" element={<FieldTimesheetPage />} />
            <Route path="documents" element={<FieldDocumentsPage />} />
            <Route path="safety" element={<FieldSafetyPage />} />
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
            <Route path="/scheduler" element={<SchedulerWorkspacePage />} />
            <Route path="/tenders" element={<TenderingPage />} />
            <Route path="/tenders/dashboard" element={<TenderingDashboardPage />} />
            <Route path="/tenders/pipeline" element={<TenderPipelinePage />} />
            <Route path="/tenders/create" element={<CreateTenderPage />} />
            <Route path="/tenders/workspace" element={<TenderWorkspacePage />} />
            <Route path="/tenders/clients" element={<TenderClientsPage />} />
            <Route path="/tenders/contacts" element={<TenderContactsPage />} />
            <Route path="/tenders/settings" element={<TenderingSettingsPage />} />
            <Route path="/tenders/reports" element={<TenderingReportsPage />} />
            <Route path="/tenders/:id" element={<TenderDetailPage />} />
            <Route path="/jobs" element={<JobsListPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/projects" element={<ProjectsListPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/timesheets/approval" element={<TimesheetApprovalPage />} />
            <Route path="/workers" element={<WorkersListPage />} />
            <Route path="/workers/:id" element={<WorkerDetailPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/assets" element={<AssetsListPage />} />
            <Route path="/assets/:id" element={<AssetDetailPage />} />
            <Route path="/maintenance" element={<MaintenanceDashboardPage />} />
            <Route path="/forms" element={<FormsListPage />} />
            <Route path="/forms/designer/:templateId" element={<FormDesignerPage />} />
            <Route path="/forms/submit/:templateId" element={<FormSubmitPage />} />
            <Route path="/documents" element={<DocumentsWorkspacePage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/roles" element={<RolesPage />} />
            <Route path="/admin/permissions" element={<PermissionsPage />} />
            <Route path="/admin/audit" element={<AuditLogsPage />} />
            <Route path="/admin/platform" element={<PlatformPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/contracts" element={<ContractsListPage />} />
            <Route path="/contracts/:id" element={<ContractDetailPage />} />
            <Route path="/admin/estimate-rates" element={<EstimateRatesAdminPage />} />
            <Route path="/account" element={<UserProfilePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/dashboards" element={<DashboardsPage />} />
            <Route path="/dashboards/:id" element={<UserDashboardPage />} />
            <Route path="/master-data" element={<MasterDataWorkspacePage />} />
            <Route path="/sites" element={<Navigate to="/master-data?tab=sites" replace />} />
            <Route path="/directory/subcontractors" element={<SubcontractorsPage />} />
            <Route path="/directory/contacts" element={<ContactsPage />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/archive/:jobId" element={<ArchiveDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
