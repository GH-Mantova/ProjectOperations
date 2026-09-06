// settings-nav-items.ts
// Populated nav-item declarations for every settings page.
// Extracted from SettingsShell.tsx to keep that file readable now that
// description and tabs have been added (SLICE 1, settings-home-plan.md).
//
// IMPORTANT: re-export path.  SettingsShell re-exports PERSONAL_ITEMS,
// COMPANY_ITEMS, and ADMINISTRATION_ITEMS so that every existing import of
// those names from SettingsShell continues to work without change.
//
// SETTINGS_HOME_S1 (pr-settings-home-s1-cards-tabs-counts): every description
// below is the copy Marco approved for the settings-home mock-up
// (erp-settings-home-mockup.pdf 2026-09-01; CRM drop reasons approved
// 2026-09-05).  The earlier inferred-from-the-page-code wording — and the
// per-item comments that flagged it as inferred — are gone; this file no
// longer carries an unapproved description.
//
// SETTINGS_HOME_S1 also adds EXTERNAL_ITEMS: two settings pages that live
// outside /settings.  Marco decided 2026-09-01 to link them in place rather
// than move them — no new routes, no redirects, no broken bookmarks.  They
// carry `external: true`, which only affects styling and grouping; the link
// itself is an ordinary route link.

import type { SettingsNavItem } from "./SettingsShell";

// ── Personal ──────────────────────────────────────────────────────────────

export const PERSONAL_ITEMS: SettingsNavItem[] = [
  {
    to: "/settings/account",
    label: "Account",
    description:
      "Your profile: name, contact details, email signature and the theme you see. Also where you view the permissions you hold and request ones you do not.",
    tabs: []
  },
  {
    to: "/settings/notifications",
    label: "Notification preferences",
    description:
      "Choose which alerts reach you, and whether each arrives in the app, by email, or both.",
    tabs: []
  },
  {
    to: "/settings/calendar-sync",
    label: "Calendar sync",
    description:
      "Connect your work calendar so scheduled jobs and leave appear alongside your meetings.",
    tabs: []
  }
];

// ── Company ───────────────────────────────────────────────────────────────

export const COMPANY_ITEMS: SettingsNavItem[] = [
  {
    to: "/settings/company",
    label: "Company",
    requiresPermission: "platform.admin",
    description:
      "The business itself — legal details, addresses, the defaults used when pricing, how documents are numbered, branding, and the licences and insurances you must keep current.",
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
    description:
      "Which AI provider the assistants use, and the company-wide behaviour of the tendering and forms helpers.",
    tabs: [
      { id: "company", label: "Company",     description: "Company-wide AI provider selection, API keys, and instruction defaults." },
      { id: "mine",    label: "My Settings", description: "Personal AI provider override and instruction customisation." }
    ]
  },
  {
    to: "/settings/reference-data",
    label: "Reference data & Lists",
    requiresAnyPermission: ["rates.manage", "lists.manage"],
    description:
      "The numbers estimating runs on — rate tables, material densities, waste rates — plus the drop-down lists used across the system.",
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
    description:
      "The template that defines what a job handover must capture before it can be signed off.",
    tabs: []
  },
  {
    to: "/settings/data-model",
    label: "Data model",
    superUserOnly: true,
    description:
      "A live map of every entity in the system and how they relate. Regenerated automatically on each build.",
    tabs: []
  },
  {
    to: "/settings/field-definitions",
    label: "Field definitions",
    superUserOnly: true,
    description: "Custom fields available on records, and which of them map to Xero.",
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
    description:
      "Create and manage the companies hosted in this system, and assign people to them.",
    tabs: []
  }
];

// ── Administration ────────────────────────────────────────────────────────

export const ADMINISTRATION_ITEMS: SettingsNavItem[] = [
  {
    to: "/settings/administration/system",
    label: "Admin settings",
    requiresPermission: "system.manage",
    description:
      "System-wide switches: notification triggers, outbound email, access requests awaiting approval, integration keys, and site geofences.",
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
    description:
      "Everyone with a login: invite, deactivate, and set which company and role each person belongs to.",
    tabs: []
  },
  {
    to: "/settings/administration/roles",
    label: "Roles & Permissions",
    requiresPermission: "roles.view",
    description:
      "Define what each role can see and do. Changing a role changes it for everyone who holds it.",
    tabs: []
  },
  {
    to: "/settings/administration/audit",
    label: "Audit",
    requiresPermission: "audit.view",
    description: "A record of who changed what, and when. Read-only.",
    tabs: []
  },
  {
    to: "/settings/administration/platform",
    label: "Platform",
    requiresPermission: "sharepoint.view",
    description:
      "SharePoint connection and the folder structure the system creates for tenders and jobs.",
    tabs: []
  },
  {
    to: "/settings/administration/automations",
    label: "Automations",
    requiresPermission: "automations.view",
    description:
      "Rules that react to changes — when something happens, notify someone or add a note. Currently limited: only notification events are wired in, so most rules will not fire yet.",
    tabs: []
  },
  {
    to: "/settings/administration/client-versions",
    label: "Client versions",
    requiresPermission: "system.manage",
    description:
      "Which app version each device is running, and the minimum version you will support.",
    tabs: []
  },
  {
    to: "/settings/administration/map-locations",
    label: "Map locations",
    requiresPermission: "system.manage",
    description:
      "Tips, depots, fuel stops and other places the system uses to work out travel and disposal costs.",
    tabs: []
  },
  {
    to: "/settings/administration/xero-exchange",
    label: "Xero file exchange",
    requiresPermission: "platform.admin",
    description:
      "Import and export the contact and invoice files that move between this system and Xero.",
    tabs: []
  },
  {
    to: "/settings/administration/crm-drop-reasons",
    label: "CRM drop reasons",
    requiresPermission: "crm.manage",
    description:
      "Why an opportunity was dropped — the list your team picks from when they close one out.",
    tabs: []
  }
];

// ── Elsewhere ─────────────────────────────────────────────────────────────
//
// Settings that live outside /settings.  They are linked in place; the route
// is untouched.  The permission on each card is the guard the destination
// actually enforces, so a card never opens into a 403:
//
//   Schedule of Rates — ScheduleOfRatesAdminPage:514 renders
//     <NoAccess required="rates.manage" /> for a user without rates.manage.
//   Job roles — JobRolesPage:51 renders <NoAccess required="resources.view" />
//     (PR #1700), mirroring job-roles.controller.ts:26, which requires
//     resources.view to read.
//
// Neither route is wrapped in RequirePermissions in App.tsx (they are bare
// <Route> elements at App.tsx:613 and App.tsx:377), which is why the guard
// has to be read off the page/API rather than the route.

export const EXTERNAL_ITEMS: SettingsNavItem[] = [
  {
    to: "/admin/schedule-of-rates",
    label: "Schedule of Rates",
    requiresPermission: "rates.manage",
    external: true,
    description:
      "Master schedules of rates and the per-client rate cards priced from them.",
    tabs: []
  },
  {
    to: "/workers/job-roles",
    label: "Job roles",
    requiresPermission: "resources.view",
    external: true,
    description:
      "The roles people are booked as, and the qualifications each role requires before someone can be allocated.",
    tabs: []
  }
];
