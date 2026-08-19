// settings-nav-items.ts
// Populated nav-item declarations for all 20 settings pages.
// Extracted from SettingsShell.tsx to keep that file readable now that
// description and tabs have been added (SLICE 1, settings-home-plan.md).
//
// IMPORTANT: re-export path.  SettingsShell re-exports PERSONAL_ITEMS,
// COMPANY_ITEMS, and ADMINISTRATION_ITEMS so that every existing import of
// those names from SettingsShell continues to work without change.
//
// D47 — descriptions that were inferred from reading the page code rather
// than from a written spec are marked with a "// GUESS —" comment on the
// line immediately above the description string.

import type { SettingsNavItem } from "./SettingsShell";

// ── Personal ──────────────────────────────────────────────────────────────

export const PERSONAL_ITEMS: SettingsNavItem[] = [
  {
    to: "/settings/account",
    label: "Account",
    // GUESS — inferred from UserProfilePage: shows signed-in user info, default
    // dashboard selection, and links to calendar sync and notification prefs.
    description: "View your profile, choose your default dashboard, and manage personal preferences.",
    tabs: []
  },
  {
    to: "/settings/notifications",
    label: "Notification preferences",
    // GUESS — inferred from NotificationPreferencesPage: lets each user mute
    // or reduce channels (email / in-app) for triggers they are already a
    // recipient of.  They cannot add themselves to triggers or raise channels
    // above what the admin has configured.
    description: "Choose how you receive notifications — mute or reduce channels for each trigger you are subscribed to.",
    tabs: []
  },
  {
    to: "/settings/calendar-sync",
    label: "Calendar sync",
    // GUESS — inferred from CalendarSyncPage: syncs assigned shifts to a
    // personal calendar via an ICS feed / Microsoft Graph adapter (mock mode
    // for now).
    description: "Sync your assigned shifts to your calendar and view the current sync status.",
    tabs: []
  }
];

// ── Company ───────────────────────────────────────────────────────────────

export const COMPANY_ITEMS: SettingsNavItem[] = [
  {
    to: "/settings/company",
    label: "Company",
    requiresPermission: "platform.admin",
    // GUESS — inferred from AdminCompanyPage SECTIONS array: covers identity,
    // contact details, commercial defaults, document numbering, branding,
    // legal documents, and licences.
    description: "Configure your company profile, branding, commercial defaults, and legal documents.",
    tabs: [
      { id: "identity",    label: "Identity",             description: "Legal name, trading name, ABN/ACN, and entity type." },
      { id: "contact",     label: "Contact & address",    description: "Primary email, phone, website, and registered and postal addresses." },
      { id: "commercial",  label: "Commercial defaults",  description: "GST rate, currency, financial year, payment terms, and default markup." },
      { id: "numbering",   label: "Document numbering",   description: "Prefix formats for tenders, quotes, jobs, projects, variations, claims, and incidents." },
      { id: "branding",    label: "Branding",             description: "Logo, favicon, PDF letterhead, and colour scheme." },
      { id: "legal",       label: "Legal documents",      description: "Manage the company's legal document library." },
      { id: "compliance",  label: "Licences & insurances", description: "Track trade licences, insurance policies, and compliance certificates." }
    ]
  },
  {
    to: "/settings/ai",
    label: "AI settings",
    requiresPermission: "platform.admin",
    // GUESS — inferred from AiSettingsPage and ai-settings-helpers.ts: two
    // tabs — company-wide AI provider/key/instruction config (super-user only)
    // and each user's personal provider/instruction override (per persona
    // permission).
    description: "Configure AI providers, API keys, and company-wide instructions for AI-powered features.",
    tabs: [
      { id: "company", label: "Company",     description: "Company-wide AI provider selection, API keys, and instruction defaults." },
      { id: "mine",    label: "My Settings", description: "Personal AI provider override and instruction customisation." }
    ]
  },
  {
    to: "/settings/reference-data",
    label: "Reference data & Lists",
    requiresAnyPermission: ["rates.manage", "lists.manage"],
    // GUESS — inferred from RatesListsAdminPage TopTab type and tab buttons:
    // rate tables, subcontractor rates, supplier rates, and managed lists.
    description: "Manage rate tables, subcontractor and supplier rates, and system reference lists.",
    tabs: [
      { id: "rates",           label: "Rate tables",    description: "Create and edit internal labour and material rate tables." },
      { id: "subcontractors",  label: "Subcontractors", description: "Manage subcontractor rate cards and trade categories." },
      { id: "suppliers",       label: "Suppliers",      description: "Manage supplier rate cards and pricing agreements." },
      { id: "lists",           label: "Lists",          description: "Manage system reference lists used across the platform." }
    ]
  },
  {
    to: "/settings/handover-template",
    label: "Handover template",
    requiresPermission: "handovertemplate.manage",
    // GUESS — inferred from HandoverTemplatePage comment block: draft/active
    // editor with sections and fields.  No internal tab strip — it is a
    // split-pane editor, not a tabbed page.
    description: "Edit the handover document template — manage sections and fields, and publish new versions.",
    tabs: []
  },
  {
    to: "/settings/data-model",
    label: "Data model",
    superUserOnly: true,
    // GUESS — inferred from DataModelMapPage file name and location under admin
    // pages.  No internal tabs observed.
    description: "Visual map of the platform data model — entities, relationships, and schema metadata.",
    tabs: []
  },
  {
    to: "/settings/field-definitions",
    label: "Field definitions",
    superUserOnly: true,
    // GUESS — inferred from FieldDefinitionAdminPage TABS: CLIENT, VENDOR, BOTH
    // — custom field definitions that apply to client records, vendor records, or both.
    description: "Define and manage custom fields for client and vendor records.",
    tabs: [
      { id: "CLIENT", label: "Client", description: "Custom fields that appear on client records." },
      { id: "VENDOR", label: "Vendor", description: "Custom fields that appear on vendor (subcontractor/supplier) records." },
      { id: "BOTH",   label: "Both",   description: "Custom fields that appear on both client and vendor records." }
    ]
  },
  {
    to: "/settings/companies",
    label: "Companies",
    superUserOnly: true,
    // GUESS — inferred from AdminCompaniesPage file name and MT-5 comment in
    // SettingsShell/App.tsx: create and manage Tenant rows, assign users to
    // tenants.  No internal tabs observed.
    description: "Create and manage company tenants and assign users to each company.",
    tabs: []
  }
];

// ── Administration ────────────────────────────────────────────────────────

export const ADMINISTRATION_ITEMS: SettingsNavItem[] = [
  {
    to: "/settings/administration/system",
    label: "Admin settings",
    requiresPermission: "system.manage",
    // GUESS — inferred from AdminSettingsPage TABS const: notifications,
    // email, access-requests, ai (redirect pointer), integrations/API keys,
    // site geofences.
    description: "System-wide configuration — notification triggers, email delivery, API key vault, and site geofences.",
    tabs: [
      { id: "notifications",    label: "Notifications",      description: "Enable or disable notification triggers and configure recipients and delivery method." },
      { id: "email",            label: "Email",              description: "Configure the outbound email provider, sender address, and test the connection." },
      { id: "access-requests",  label: "Access requests",    description: "Review and approve or deny pending permission access requests from users." },
      { id: "ai",               label: "AI & Integrations",  description: "Link to the AI settings page for provider and API key configuration." },
      { id: "integrations",     label: "Integrations / API keys", description: "Manage API keys for third-party integrations via the key vault." },
      { id: "geofences",        label: "Site geofences",     description: "Attach circular GPS boundaries to sites for automatic clock-on site detection." }
    ]
  },
  {
    to: "/settings/administration/users",
    label: "Users",
    requiresPermission: "users.view",
    // GUESS — inferred from AdminUsersTab file name and SLICE 17 comments.
    description: "View and manage user accounts, roles, and access.",
    tabs: []
  },
  {
    to: "/settings/administration/roles",
    label: "Roles & Permissions",
    requiresPermission: "roles.view",
    // GUESS — inferred from RolesPermissionsPage file name and SLICE 8 comment
    // (permissions folded into this page).
    description: "Define roles and assign permissions — controls what each user group can see and do.",
    tabs: []
  },
  {
    to: "/settings/administration/audit",
    label: "Audit",
    requiresPermission: "audit.view",
    // GUESS — inferred from AuditLogsPage file name.
    description: "Review the platform audit log — a chronological record of significant actions and changes.",
    tabs: []
  },
  {
    to: "/settings/administration/platform",
    label: "Platform",
    requiresPermission: "sharepoint.view",
    // GUESS — inferred from PlatformPage which shows SharePoint config (site
    // ID, drive ID, root folder) and folder mappings per module.
    description: "Configure SharePoint integration — site, drive, root folder, and module folder mappings.",
    tabs: []
  },
  {
    to: "/settings/administration/automations",
    label: "Automations",
    requiresPermission: "automations.view",
    // GUESS — inferred from AutomationsPage file name and SLICE 10 comment.
    description: "Set up and manage workflow automations that trigger actions based on platform events.",
    tabs: []
  },
  {
    to: "/settings/administration/client-versions",
    label: "Client versions",
    requiresPermission: "system.manage",
    // GUESS — inferred from AdminClientVersionsPage file name and SLICE 14
    // comment (dissolved from AdminSettingsPage).
    description: "Manage the list of supported client application versions and minimum required versions.",
    tabs: []
  },
  {
    to: "/settings/administration/map-locations",
    label: "Map locations",
    requiresPermission: "system.manage",
    // GUESS — inferred from MapLocationsPage file name and SLICE 14 comment.
    description: "Configure named map locations and coordinates used across the platform.",
    tabs: []
  },
  {
    to: "/settings/administration/xero-exchange",
    label: "Xero file exchange",
    requiresPermission: "platform.admin",
    // GUESS — inferred from XeroExchangePage and CFX-4 comment: CSV export of
    // clients and subcontractor/supplier records into Xero contact-import format.
    description: "Export client and supplier records as a Xero-compatible contact import CSV.",
    tabs: []
  },
  {
    to: "/settings/administration/crm-drop-reasons",
    label: "CRM drop reasons",
    requiresPermission: "crm.manage",
    // GUESS — inferred from DropReasonAdminPage and CRM SLICE 6 comment:
    // admin screen to manage the list of CRM opportunity drop reasons.
    description: "Manage the list of reasons available when marking a CRM opportunity as dropped.",
    tabs: []
  }
];
