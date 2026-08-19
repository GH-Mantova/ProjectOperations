import * as fs from "fs";
import * as path from "path";

// Migration-naming guard. Prisma applies migrations in alphabetical folder
// order, and the house convention is a full `YYYYMMDDHHMMSS_` prefix. A bare
// `YYYYMMDD_` prefix sorts AFTER every same-day timestamped sibling, because
// at character index 8 the byte `_` (0x5F) is greater than any digit. That
// means a backfill named `20260812_fix_thing` silently runs LAST among the
// day's migrations — after the one it was supposed to precede.
//
// The 58 folders on the KNOWN_BARE_PREFIXES allowlist below are already
// applied on every existing database; renaming them would break the
// `_prisma_migrations` checksum. This guard only rejects NEW offenders.

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "..", "..", "prisma", "migrations");

// Frozen historical baseline of bare-prefix migration folders that predate
// this guard. DO NOT extend this list. A new entry means someone added a
// migration with a bare `YYYYMMDD_` prefix instead of using the full
// `YYYYMMDDHHMMSS_` convention — fix the folder name instead.
const KNOWN_BARE_PREFIXES = new Set<string>([
  "20260418_s4_sso_user_flag",
  "20260420_feat_dashboard_builder",
  "20260420_feat_estimate_editor",
  "20260420_feat_estimate_equip_lines",
  "20260420_feat_fuel_enclosure_rates",
  "20260420_feat_scope_revision",
  "20260420_fix_tender_timestamps",
  "20260421_feat_clarifications",
  "20260421_feat_cutrite_rates",
  "20260421_feat_estimate_export",
  "20260421_feat_lists_system",
  "20260421_feat_platform_config",
  "20260421_feat_platform_config_multi_ai",
  "20260421_feat_platform_config_openai",
  "20260421_feat_projects",
  "20260421_feat_resource_allocation",
  "20260421_feat_scope_of_works",
  "20260421_feat_user_ai_providers",
  "20260422_feat_admin_settings",
  "20260422_feat_contracts",
  "20260422_feat_field_worker_experience",
  "20260422_feat_provisional_amount",
  "20260422_feat_quote_tab",
  "20260422_feat_scope_redesign",
  "20260422_feat_scope_redesign_cutrite_method",
  "20260422_feat_timesheet_rejection",
  "20260423_feat_cutting_fixes",
  "20260423_feat_quote_pdf_rebuild",
  "20260423_feat_quote_system",
  "20260424_feat_tender_filter_presets",
  "20260425_feat_scope_redesign_v2",
  "20260425_feat_scope_ux",
  "20260426_feat_business_directory",
  "20260426_feat_client_portal",
  "20260426_feat_compliance_tracking",
  "20260426_feat_contacts_unified",
  "20260426_feat_drop_deprecated_tables",
  "20260426_feat_forms_engine",
  "20260426_feat_gantt",
  "20260426_feat_gps_clockon",
  "20260426_feat_quote_cost_line_visibility",
  "20260426_feat_quote_section_visibility",
  "20260426_feat_safety_forms",
  "20260426_feat_site_tender_fk",
  "20260426_feat_worker_availability",
  "20260426_feat_xero_integration",
  "20260426_fix_availability_audit",
  "20260519_feat_job_number_canonicalisation",
  "20260526_tender_delete_safety_fk",
  "20260528_rename_person_days_to_labour_days_override",
  "20260731_feat_tip_recommendation_log",
  "20260804_fv2_form_number_sequence",
  "20260804_fv2_formrule_expand",
  "20260804_fv2_repeating_entry_index",
  "20260806_b_hw_1_handover_template_schema",
  "20260806_fv2_signature_seal",
  "20260806_notification_preferences",
  "20260812_b_hw_5_handover_instance_schema"
]);

const BARE_PREFIX_RE = /^\d{8}_/;
const FULL_PREFIX_RE = /^\d{14}_/;

function listMigrationFolders(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

describe("Migration-naming guard — new migrations must use a full YYYYMMDDHHMMSS_ prefix", () => {
  const folders = listMigrationFolders();

  // Positive control. If the reader silently returned an empty list the guard
  // would pass forever while checking nothing. There are hundreds of migration
  // folders on main, so 100 is a safely loose floor that still trips if the
  // path resolves to the wrong directory.
  it("enumerates migration folders (sanity: reader saw the migrations directory)", () => {
    expect(folders.length).toBeGreaterThan(100);
  });

  it("no NEW migration folder uses a bare YYYYMMDD_ prefix (must be full YYYYMMDDHHMMSS_)", () => {
    const offenders: string[] = [];
    for (const name of folders) {
      if (!BARE_PREFIX_RE.test(name)) continue;
      if (FULL_PREFIX_RE.test(name)) continue;
      if (KNOWN_BARE_PREFIXES.has(name)) continue;
      offenders.push(`  - ${name}`);
    }
    if (offenders.length > 0) {
      throw new Error(
        [
          "The following migration folders use a bare `YYYYMMDD_` prefix.",
          "Prisma applies migrations in alphabetical folder order, and a bare",
          "`YYYYMMDD_` prefix sorts AFTER every same-day timestamped sibling",
          "(byte `_` = 0x5F is greater than any digit at character index 8).",
          "That means a backfill written with a bare prefix silently runs LAST",
          "among the day's migrations — after the one it was meant to precede.",
          "",
          "Fix: rename the folder to a full `YYYYMMDDHHMMSS_` prefix (pick an",
          "HHMMSS that places it where you want it in the day's ordering).",
          "",
          ...offenders
        ].join("\n")
      );
    }
  });

  it("KNOWN_BARE_PREFIXES contains no folder that has been renamed or deleted (allowlist cannot rot)", () => {
    const present = new Set(folders);
    const stale = [...KNOWN_BARE_PREFIXES].filter((name) => !present.has(name));
    if (stale.length > 0) {
      throw new Error(
        [
          "The following entries are on KNOWN_BARE_PREFIXES but no folder of",
          "that name exists under apps/api/prisma/migrations. Historical",
          "migrations must not be renamed or deleted — doing so breaks the",
          "`_prisma_migrations` checksum on every existing database. If a",
          "rename was deliberate, restore the original folder name; otherwise",
          "remove the stale entry:",
          "",
          ...stale.map((n) => `  - ${n}`)
        ].join("\n")
      );
    }
  });
});
