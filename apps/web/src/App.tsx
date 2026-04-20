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
import { MasterDataPage } from "./pages/MasterDataPage";
import { JobsPage } from "./pages/JobsPage";
import { SchedulerPage } from "./pages/SchedulerPage";
import { TenderingDashboardPage } from "./pages/TenderingDashboardPage";
import { CreateTenderPage } from "./pages/CreateTenderPage";
import { TenderPipelinePage } from "./pages/TenderPipelinePage";
import { TenderWorkspacePage } from "./pages/TenderWorkspacePage";
import { TenderClientsPage } from "./pages/TenderClientsPage";
import { TenderContactsPage } from "./pages/TenderContactsPage";
import { TenderingSettingsPage } from "./pages/TenderingSettingsPage";
import { ResourcesPage } from "./pages/ResourcesPage";
import { AssetsPage } from "./pages/AssetsPage";
import { MaintenancePage } from "./pages/MaintenancePage";
import { FormsPage } from "./pages/FormsPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { ArchivePage } from "./pages/archive/ArchivePage";
import { ArchiveDetailPage } from "./pages/archive/ArchiveDetailPage";
import { TenderingPage } from "./pages/tendering/TenderingPage";
import { TenderDetailPage } from "./pages/tendering/TenderDetailPage";
import { TenderingReportsPage } from "./pages/tendering/TenderingReportsPage";
import { JobsListPage } from "./pages/jobs/JobsListPage";
import { JobDetailPage } from "./pages/jobs/JobDetailPage";
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
import { EstimateRatesAdminPage } from "./pages/EstimateRatesAdminPage";

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<ShellLayout />}>
            <Route path="/" element={<DashboardPlaceholderPage />} />
            <Route path="/scheduler" element={<SchedulerWorkspacePage />} />
            <Route path="/scheduler/legacy" element={<SchedulerPage />} />
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
            <Route path="/jobs/workspace" element={<JobsPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/resources" element={<WorkersListPage />} />
            <Route path="/resources/legacy" element={<ResourcesPage />} />
            <Route path="/resources/:id" element={<WorkerDetailPage />} />
            <Route path="/assets" element={<AssetsListPage />} />
            <Route path="/assets/legacy" element={<AssetsPage />} />
            <Route path="/assets/:id" element={<AssetDetailPage />} />
            <Route path="/maintenance" element={<MaintenanceDashboardPage />} />
            <Route path="/maintenance/legacy" element={<MaintenancePage />} />
            <Route path="/forms" element={<FormsListPage />} />
            <Route path="/forms/legacy" element={<FormsPage />} />
            <Route path="/forms/designer/:templateId" element={<FormDesignerPage />} />
            <Route path="/forms/submit/:templateId" element={<FormSubmitPage />} />
            <Route path="/documents" element={<DocumentsWorkspacePage />} />
            <Route path="/documents/legacy" element={<DocumentsPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/roles" element={<RolesPage />} />
            <Route path="/admin/permissions" element={<PermissionsPage />} />
            <Route path="/admin/audit" element={<AuditLogsPage />} />
            <Route path="/admin/platform" element={<PlatformPage />} />
            <Route path="/admin/estimate-rates" element={<EstimateRatesAdminPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/dashboards" element={<DashboardsPage />} />
            <Route path="/master-data" element={<MasterDataWorkspacePage />} />
            <Route path="/master-data/legacy" element={<MasterDataPage />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/archive/:jobId" element={<ArchiveDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
