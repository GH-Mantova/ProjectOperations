/*
 * routes.js — single source of truth for the Claude Design gallery.
 * Generated from apps/web/src/App.tsx (route table) and ShellLayout.tsx (nav groups).
 * Each entry drives BOTH the gallery sidebar (index.html) and the in-mockup
 * shell chrome (chrome.js). Keep `file` names in sync with /mockups/*.html.
 */
window.PO_ROUTES = {
  surfaces: [
    {
      id: "desktop",
      label: "Desktop (staff workspace)",
      note: "Authenticated staff app rendered inside ShellLayout (dark sidebar + 56px top bar).",
      groups: [
        {
          id: "dashboards",
          label: "Dashboards",
          items: [
            { route: "/", title: "Operations Dashboard", file: "dashboard-operations.html", component: "DashboardPlaceholderPage" },
            { route: "/tenders/dashboard", title: "Tendering Dashboard", file: "tenders-dashboard.html", component: "TenderingDashboardPage" },
            { route: "/dashboards/:id", title: "Custom Dashboard", file: "dashboard-custom.html", component: "UserDashboardPage" }
          ]
        },
        {
          id: "commercial",
          label: "Commercial",
          items: [
            { route: "/tenders", title: "Tendering Register", file: "tenders.html", component: "TenderingPage" },
            { route: "/tenders/:id", title: "Tender Detail", file: "tender-detail.html", component: "TenderDetailPage" },
            { route: "/tenders/clients", title: "Tender Clients", file: "tenders-clients.html", component: "TenderClientsPage" },
            { route: "/tenders/contacts", title: "Tender Contacts", file: "tenders-contacts.html", component: "TenderContactsPage" },
            { route: "/tenders/reports", title: "Tendering Reports", file: "tenders-reports.html", component: "TenderingReportsPage" },
            { route: "/tenders/settings", title: "Tendering Settings", file: "tenders-settings.html", component: "TenderingSettingsPage" },
            { route: "/contracts", title: "Contracts", file: "contracts.html", component: "ContractsListPage" },
            { route: "/contracts/:id", title: "Contract Detail", file: "contract-detail.html", component: "ContractDetailPage" }
          ]
        },
        {
          id: "operations",
          label: "Operations",
          items: [
            { route: "/projects", title: "Projects", file: "projects.html", component: "ProjectsListPage" },
            { route: "/projects/:id", title: "Project Detail", file: "project-detail.html", component: "ProjectDetailPage" },
            { route: "/jobs", title: "Jobs", file: "jobs.html", component: "JobsListPage" },
            { route: "/jobs/:id", title: "Job Detail", file: "job-detail.html", component: "JobDetailPage" },
            { route: "/scheduler", title: "Scheduler", file: "scheduler.html", component: "SchedulerWorkspacePage" },
            { route: "/scheduler/availability-report", title: "Availability report", file: "scheduler-availability-report.html", component: "AvailabilityReportPage" },
            { route: "/scheduler/grid", title: "Scheduler Grid", file: "scheduler-grid.html", component: "SchedulerGridPage" },
            { route: "/account/calendar-sync", title: "Calendar Sync", file: "calendar-sync.html", component: "CalendarSyncPage" },
            { route: "/sites", title: "Sites", file: "sites.html", component: "SitesListPage" },
            { route: "/sites/:id", title: "Site Detail", file: "site-detail.html", component: "SiteDetailPage" },
            { route: "/assets", title: "Assets", file: "assets.html", component: "AssetsListPage" },
            { route: "/assets/:id", title: "Asset Detail", file: "asset-detail.html", component: "AssetDetailPage" },
            { route: "/maintenance", title: "Maintenance", file: "maintenance.html", component: "MaintenancePage" },
            { route: "/maintenance/utilisation", title: "Plant Utilisation Report", file: "maintenance-utilisation.html", component: "PlantUtilisationReportPage" },
            { route: "/forms", title: "Forms", file: "forms.html", component: "FormsListPage" },
            { route: "/forms/designer/:id", title: "Form Designer", file: "forms-designer.html", component: "FormDesignerPage" },
            { route: "/forms/fill/:id", title: "Form Fill", file: "forms-fill.html", component: "FormFillPage" },
            { route: "/forms/submissions/:id", title: "Form Submission Detail", file: "forms-submission-detail.html", component: "FormSubmissionDetailPage" },
            { route: "/safety", title: "Safety", file: "safety.html", component: "SafetyPage" },
            { route: "/timesheets/approval", title: "Timesheet Approval", file: "timesheets-approval.html", component: "TimesheetApprovalPage" },
            { route: "/workers", title: "Workers", file: "workers.html", component: "WorkersListPage" },
            { route: "/workers/:id", title: "Worker Detail", file: "worker-detail.html", component: "WorkerDetailPage" },
            { route: "/resources", title: "Resources (legacy)", file: "resources.html", component: "ResourcesPage" }
          ]
        },
        {
          id: "directory",
          label: "Directory",
          items: [
            { route: "/master-data", title: "Master Data", file: "master-data.html", component: "MasterDataWorkspacePage" },
            { route: "/directory/subcontractors", title: "Subcontractors & Suppliers", file: "directory-subcontractors.html", component: "SubcontractorsPage" },
            { route: "/directory/contacts", title: "Contacts", file: "directory-contacts.html", component: "ContactsPage" }
          ]
        },
        {
          id: "platform",
          label: "Platform",
          items: [
            { route: "/documents", title: "Documents", file: "documents.html", component: "DocumentsWorkspacePage" },
            { route: "/compliance", title: "Compliance", file: "compliance.html", component: "CompliancePage" },
            { route: "/archive", title: "Archive", file: "archive.html", component: "ArchivePage" },
            { route: "/archive/:jobId", title: "Archive Detail", file: "archive-detail.html", component: "ArchiveDetailPage" }
          ]
        },
        {
          id: "admin",
          label: "Admin",
          items: [
            { route: "/admin/settings", title: "Admin Settings", file: "admin-settings.html", component: "AdminSettingsPage" },
            { route: "/admin/estimate-rates", title: "Rates & Lists", file: "admin-estimate-rates.html", component: "EstimateRatesAdminPage" },
            { route: "/admin/job-roles", title: "Job Roles", file: "admin-job-roles.html", component: "JobRolesPage" },
            { route: "/admin/ai-settings", title: "AI Settings", file: "admin-ai-settings.html", component: "AiSettingsPage" },
            { route: "/admin/users", title: "Users", file: "admin-users.html", component: "UsersPage" },
            { route: "/admin/roles", title: "Roles", file: "admin-roles.html", component: "RolesPage" },
            { route: "/admin/permissions", title: "Permissions", file: "admin-permissions.html", component: "PermissionsPage" },
            { route: "/admin/audit", title: "Audit Logs", file: "admin-audit.html", component: "AuditLogsPage" },
            { route: "/admin/platform", title: "Platform", file: "admin-platform.html", component: "PlatformPage" }
          ]
        },
        {
          id: "account",
          label: "Account & System",
          items: [
            { route: "/account", title: "My Account", file: "account.html", component: "UserProfilePage" },
            { route: "/notifications", title: "Notifications", file: "notifications.html", component: "NotificationsPage" },
            { route: "*", title: "Not Found (404)", file: "not-found.html", component: "NotFoundPage" }
          ]
        }
      ]
    },
    {
      id: "field",
      label: "Field (mobile crew app)",
      note: "Offline-capable mobile surface in FieldLayout — bottom tab bar, large touch targets, ~390px frame.",
      groups: [
        {
          id: "field",
          label: "Field tabs",
          items: [
            { route: "/field/allocations", title: "My Allocations", file: "field-allocations.html", component: "FieldAllocationsPage" },
            { route: "/field/pre-start", title: "Pre-Start", file: "field-pre-start.html", component: "FieldPreStartPage" },
            { route: "/field/timesheet", title: "Timesheet", file: "field-timesheet.html", component: "FieldTimesheetPage" },
            { route: "/field/documents", title: "Documents", file: "field-documents.html", component: "FieldDocumentsPage" },
            { route: "/field/safety", title: "Safety", file: "field-safety.html", component: "FieldSafetyPage" }
          ]
        }
      ]
    },
    {
      id: "portal",
      label: "Client portal",
      note: "External client-facing surface in PortalLayout — lighter top nav, read-mostly views.",
      groups: [
        {
          id: "portal",
          label: "Portal",
          items: [
            { route: "/portal", title: "Portal Dashboard", file: "portal-dashboard.html", component: "PortalDashboardPage" },
            { route: "/portal/projects", title: "Portal Projects", file: "portal-projects.html", component: "PortalProjectsPage" },
            { route: "/portal/jobs", title: "Portal Jobs", file: "portal-jobs.html", component: "PortalJobsPage" },
            { route: "/portal/quotes", title: "Portal Quotes", file: "portal-quotes.html", component: "PortalQuotesPage" },
            { route: "/portal/documents", title: "Portal Documents", file: "portal-documents.html", component: "PortalDocumentsPage" },
            { route: "/portal/account", title: "Portal Account", file: "portal-account.html", component: "PortalAccountPage" }
          ]
        }
      ]
    },
    {
      id: "auth",
      label: "Authentication",
      note: "Unauthenticated entry points (no shell chrome).",
      groups: [
        {
          id: "auth",
          label: "Sign in",
          items: [
            { route: "/login", title: "Staff Login", file: "login.html", component: "LoginPage" },
            { route: "/portal/login", title: "Portal Login", file: "portal-login.html", component: "PortalLoginPage" },
            { route: "/portal/accept-invite", title: "Accept Invite", file: "portal-accept-invite.html", component: "PortalAcceptInvitePage" }
          ]
        }
      ]
    }
  ]
};
