// One-shot CLI: import Xero contact exports (Customers + Suppliers CSVs) into
// our `Client`, `SubcontractorSupplier`, and `Contact` tables.
//
// Default mode is DRY-RUN: the script reads the CSVs, classifies each row as
// CREATE / UPDATE / NO_CHANGE against the current DB, and writes a markdown
// report. Pass `--commit` to actually persist via Prisma upserts.
//
// Idempotency: matching is by `xeroContactId` if known, otherwise by exact
// (trimmed, case-sensitive) `name`. Re-running with the same input on the
// same DB produces no further changes.
//
// Companion tests live in scripts/__tests__/xero-import-contacts.spec.ts and
// exercise the pure helpers without touching the filesystem or the database.

import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// CSV parsing (inline RFC 4180 — no external dependency)
// ---------------------------------------------------------------------------

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(text: string): ParsedCsv {
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  while (i < stripped.length) {
    const ch = stripped[i];
    if (inQuotes) {
      if (ch === '"') {
        if (stripped[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      if (stripped[i + 1] === "\n") {
        i += 2;
      } else {
        i += 1;
      }
      row.push(field);
      records.push(row);
      field = "";
      row = [];
      continue;
    }
    if (ch === "\n") {
      i += 1;
      row.push(field);
      records.push(row);
      field = "";
      row = [];
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  if (records.length === 0) {
    return { headers: [], rows: [] };
  }
  const headerLine = records.shift() as string[];
  const headers = headerLine.map((h) => h.replace(/^\*/, "").trim());
  const rows: Record<string, string>[] = [];
  for (const record of records) {
    if (record.length === 1 && record[0] === "") continue;
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = (record[idx] ?? "").trim();
    });
    rows.push(obj);
  }
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Pure mapping helpers
// ---------------------------------------------------------------------------

export function parseBankNumber(raw: string): {
  bsb: string | null;
  account: string | null;
} {
  const cleaned = (raw ?? "").replace(/\s/g, "").trim();
  if (!cleaned) return { bsb: null, account: null };
  if (cleaned.includes("-")) {
    // Australian BSB is "XXX-XXX" (3-3 with a hyphen). When the bank field
    // is e.g. "034-198 491719", whitespace strips to "034-198491719", and we
    // recognise the 3-3 BSB and split off the account number. Per Codex
    // review on PR #280 — previously the naive split corrupted the BSB.
    const bsbStyle = cleaned.match(/^(\d{3})-(\d{3})(\d+)$/);
    if (bsbStyle) {
      return { bsb: bsbStyle[1] + bsbStyle[2], account: bsbStyle[3] };
    }
    // Fall back to "fullBSB-account" split where the segment before the
    // hyphen is already a complete 6-digit BSB.
    const parts = cleaned.split("-");
    if (parts.length === 2 && /^\d{6}$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
      return { bsb: parts[0], account: parts[1] };
    }
    return { bsb: null, account: null };
  }
  if (/^\d{8,15}$/.test(cleaned)) {
    return { bsb: cleaned.slice(0, 6), account: cleaned.slice(6) };
  }
  return { bsb: null, account: null };
}

const TERM_MAP: Record<string, string> = {
  DAYSAFTERBILLDATE: "DAYS_AFTER_INVOICE",
  DAYSAFTERBILLMONTH: "DAYS_AFTER_END_OF_MONTH",
  OFCURRENTMONTH: "DAY_OF_CURRENT_MONTH",
  OFFOLLOWINGMONTH: "DAY_OF_FOLLOWING_MONTH"
};

export function mapTerm(raw: string | undefined | null): string | null {
  const v = (raw ?? "").trim().toUpperCase();
  if (!v) return null;
  return TERM_MAP[v] ?? null;
}

function nullIfEmpty(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  return v.length > 0 ? v : null;
}

function joinLines(a: string | undefined, b: string | undefined): string | null {
  const lines = [a, b]
    .map((line) => (line ?? "").trim())
    .filter((line) => line.length > 0);
  return lines.length > 0 ? lines.join("\n") : null;
}

function parseDayInt(raw: string | undefined): number | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > 31) return null;
  return n;
}

export interface OrgImportFields {
  name: string;
  /**
   * Xero's stable contact identifier — read from the CSV's `AccountNumber`
   * column (Xero's contact code, populated when the contact was created via
   * the Xero adapter sync). Null when the CSV doesn't carry one.
   *
   * When non-null, the importer matches existing rows by this ID FIRST,
   * falling back to name match only when no ID match is found. Prevents
   * duplicate rows when a Xero contact is renamed in either system. Per
   * Codex review on PR #280.
   */
  xeroContactId: string | null;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  postalAddress: string | null;
  postalSuburb: string | null;
  postalState: string | null;
  postalPostcode: string | null;
  country: string;
  physicalAddress: string | null;
  physicalSuburb: string | null;
  physicalState: string | null;
  physicalPostcode: string | null;
  bankAccountName: string | null;
  bankBsb: string | null;
  bankAccountNumber: string | null;
  paymentTermsDay: number | null;
  paymentTermsType: string | null;
}

export interface MapResult {
  fields: OrgImportFields | null;
  warning?: string;
}

export function mapXeroRow(row: Record<string, string>): MapResult {
  const name = (row.ContactName ?? "").trim();
  if (!name) {
    return { fields: null, warning: "row has blank *ContactName — skipping" };
  }
  const bank = parseBankNumber(row.BankAccountNumber ?? "");
  let warning: string | undefined;
  if ((row.BankAccountNumber ?? "").trim().length > 0 && bank.bsb === null) {
    warning = `bank number "${row.BankAccountNumber}" could not be parsed — bsb/account left null`;
  }
  const fields: OrgImportFields = {
    name,
    xeroContactId: nullIfEmpty(row.AccountNumber),
    legalName: nullIfEmpty(row.LegalName),
    email: (() => {
      const v = nullIfEmpty(row.EmailAddress);
      return v ? v.toLowerCase() : null;
    })(),
    phone: nullIfEmpty(row.PhoneNumber),
    website: nullIfEmpty(row.Website),
    postalAddress: joinLines(row.POAddressLine1, row.POAddressLine2),
    postalSuburb: nullIfEmpty(row.POCity),
    postalState: nullIfEmpty(row.PORegion),
    postalPostcode: nullIfEmpty(row.POPostalCode),
    country: nullIfEmpty(row.POCountry) ?? "Australia",
    physicalAddress: joinLines(row.SAAddressLine1, row.SAAddressLine2),
    physicalSuburb: nullIfEmpty(row.SACity),
    physicalState: nullIfEmpty(row.SARegion),
    physicalPostcode: nullIfEmpty(row.SAPostalCode),
    bankAccountName: nullIfEmpty(row.BankAccountName),
    bankBsb: bank.bsb,
    bankAccountNumber: bank.account,
    paymentTermsDay: parseDayInt(row.DueDateBillDay),
    paymentTermsType: mapTerm(row.DueDateBillTerm)
  };
  return { fields, warning };
}

export interface PersonImportFields {
  firstName: string;
  lastName: string;
  email: string | null;
  includeInInvoiceEmails: boolean;
}

function truthyFlag(raw: string | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "true" || v === "yes" || v === "1";
}

export function extractPersons(row: Record<string, string>): PersonImportFields[] {
  const result: PersonImportFields[] = [];
  for (let n = 1; n <= 4; n += 1) {
    const first = (row[`Person${n}FirstName`] ?? "").trim();
    const last = (row[`Person${n}LastName`] ?? "").trim();
    const email = (row[`Person${n}Email`] ?? "").trim();
    if (!first && !last && !email) continue;
    result.push({
      firstName: first,
      lastName: last,
      email: email ? email.toLowerCase() : null,
      includeInInvoiceEmails: truthyFlag(row[`Person${n}IncludeInEmail`])
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// CLI flag parsing
// ---------------------------------------------------------------------------

export interface CliFlags {
  customersPath: string;
  suppliersPath: string;
  commit: boolean;
  reportPath: string;
}

const DEFAULT_CUSTOMERS = "C:/ProjectOperations-Reference/Xero exports/Contacts Customers.csv";
const DEFAULT_SUPPLIERS = "C:/ProjectOperations-Reference/Xero exports/Contacts Suppliers.csv";

export function parseArgs(argv: string[]): CliFlags {
  let customersPath = DEFAULT_CUSTOMERS;
  let suppliersPath = DEFAULT_SUPPLIERS;
  let commit = false;
  let reportPath = resolve(__dirname, "xero-import-report.md");
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--commit") {
      commit = true;
      continue;
    }
    if (arg === "--customers") {
      customersPath = argv[++i] ?? customersPath;
      continue;
    }
    if (arg === "--suppliers") {
      suppliersPath = argv[++i] ?? suppliersPath;
      continue;
    }
    if (arg === "--report") {
      reportPath = argv[++i] ?? reportPath;
      continue;
    }
  }
  return { customersPath, suppliersPath, commit, reportPath };
}

// ---------------------------------------------------------------------------
// DB diff + apply
// ---------------------------------------------------------------------------

type Decision = "CREATE" | "UPDATE" | "NO_CHANGE" | "SKIPPED";

interface RowOutcome {
  decision: Decision;
  name: string;
  reason?: string;
  warnings: string[];
  changedFields: string[];
}

function eq(
  a: string | number | null | undefined,
  b: string | number | null | undefined
): boolean {
  return (a ?? null) === (b ?? null);
}

function diffOrgFields(
  fields: OrgImportFields,
  existing: Record<string, unknown>
): string[] {
  const changed: string[] = [];
  const keys: (keyof OrgImportFields)[] = [
    "legalName",
    "email",
    "phone",
    "website",
    "postalAddress",
    "postalSuburb",
    "postalState",
    "postalPostcode",
    "country",
    "physicalAddress",
    "physicalSuburb",
    "physicalState",
    "physicalPostcode",
    "bankAccountName",
    "bankBsb",
    "bankAccountNumber",
    "paymentTermsDay",
    "paymentTermsType"
  ];
  for (const key of keys) {
    const next = fields[key];
    const current = existing[key] as string | number | null | undefined;
    if (!eq(next as string | number | null, current)) {
      changed.push(key);
    }
  }
  return changed;
}

// ---------------------------------------------------------------------------
// Report writer
// ---------------------------------------------------------------------------

interface ReportSection {
  title: string;
  counts: Record<Decision, number>;
  warnings: string[];
  samples: RowOutcome[];
}

function buildReport(
  flags: CliFlags,
  customer: ReportSection,
  supplier: ReportSection,
  contactCounts: Record<Decision, number>
): string {
  const mode = flags.commit ? "COMMIT (writes applied)" : "DRY RUN (no writes)";
  const lines: string[] = [];
  lines.push(`# Xero contacts import — ${mode}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`- Customers source: \`${flags.customersPath}\``);
  lines.push(`- Suppliers source: \`${flags.suppliersPath}\``);
  lines.push("");
  for (const section of [customer, supplier]) {
    lines.push(`## ${section.title}`);
    lines.push("");
    lines.push(`- CREATE: ${section.counts.CREATE}`);
    lines.push(`- UPDATE: ${section.counts.UPDATE}`);
    lines.push(`- NO_CHANGE: ${section.counts.NO_CHANGE}`);
    lines.push(`- SKIPPED: ${section.counts.SKIPPED}`);
    lines.push("");
    if (section.warnings.length > 0) {
      lines.push(`### Warnings (${section.warnings.length})`);
      for (const w of section.warnings.slice(0, 40)) {
        lines.push(`- ${w}`);
      }
      if (section.warnings.length > 40) {
        lines.push(`- ...and ${section.warnings.length - 40} more`);
      }
      lines.push("");
    }
    for (const decision of ["CREATE", "UPDATE", "NO_CHANGE", "SKIPPED"] as Decision[]) {
      const subset = section.samples.filter((s) => s.decision === decision).slice(0, 20);
      if (subset.length === 0) continue;
      lines.push(`### First ${subset.length} ${decision}`);
      for (const s of subset) {
        const tail = s.changedFields.length > 0 ? ` (fields: ${s.changedFields.join(", ")})` : "";
        const reason = s.reason ? ` — ${s.reason}` : "";
        lines.push(`- ${s.name}${tail}${reason}`);
      }
      lines.push("");
    }
  }
  lines.push("## Contacts (Person1-4)");
  lines.push("");
  lines.push(`- CREATE: ${contactCounts.CREATE}`);
  lines.push(`- UPDATE: ${contactCounts.UPDATE}`);
  lines.push(`- NO_CHANGE: ${contactCounts.NO_CHANGE}`);
  lines.push(`- SKIPPED: ${contactCounts.SKIPPED}`);
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

interface ProcessOptions {
  organisationType: "CLIENT" | "SUBCONTRACTOR";
  title: string;
  rows: Record<string, string>[];
  flags: CliFlags;
  prisma: PrismaClient;
  createdByUserId: string | null;
  contactCounts: Record<Decision, number>;
}

async function processRows(opts: ProcessOptions): Promise<ReportSection> {
  const { organisationType, title, rows, flags, prisma, createdByUserId, contactCounts } = opts;
  const counts: Record<Decision, number> = {
    CREATE: 0,
    UPDATE: 0,
    NO_CHANGE: 0,
    SKIPPED: 0
  };
  const samples: RowOutcome[] = [];
  const warnings: string[] = [];
  for (const row of rows) {
    const mapped = mapXeroRow(row);
    const outcome: RowOutcome = {
      decision: "SKIPPED",
      name: (row.ContactName ?? "").trim() || "(blank)",
      warnings: [],
      changedFields: []
    };
    if (!mapped.fields) {
      outcome.reason = mapped.warning ?? "skipped";
      warnings.push(`${outcome.name}: ${outcome.reason}`);
      counts.SKIPPED += 1;
      samples.push(outcome);
      continue;
    }
    if (mapped.warning) {
      outcome.warnings.push(mapped.warning);
      warnings.push(`${outcome.name}: ${mapped.warning}`);
    }
    const fields = mapped.fields;
    let existing: { id: string } & Record<string, unknown> | null = null;
    // Match by Xero contact ID first (stable across renames) — per Codex
    // review on PR #280. Falls back to exact-name match when the CSV row
    // doesn't carry an ID (the common case for Marco's current export).
    if (organisationType === "CLIENT") {
      if (fields.xeroContactId) {
        existing = await prisma.client.findFirst({
          where: { xeroContactId: fields.xeroContactId }
        }) as ({ id: string } & Record<string, unknown>) | null;
      }
      if (!existing) {
        existing = await prisma.client.findUnique({
          where: { name: fields.name }
        }) as ({ id: string } & Record<string, unknown>) | null;
      }
    } else {
      if (fields.xeroContactId) {
        existing = await prisma.subcontractorSupplier.findFirst({
          where: { xeroContactId: fields.xeroContactId }
        }) as ({ id: string } & Record<string, unknown>) | null;
      }
      if (!existing) {
        existing = await prisma.subcontractorSupplier.findFirst({
          where: { name: fields.name }
        }) as ({ id: string } & Record<string, unknown>) | null;
      }
    }

    let orgId: string;
    if (!existing) {
      outcome.decision = "CREATE";
      counts.CREATE += 1;
      if (flags.commit) {
        if (organisationType === "CLIENT") {
          const created = await prisma.client.create({
            data: {
              name: fields.name,
              xeroContactId: fields.xeroContactId,
              legalName: fields.legalName,
              email: fields.email,
              phone: fields.phone,
              website: fields.website,
              postalAddress: fields.postalAddress,
              postalSuburb: fields.postalSuburb,
              postalState: fields.postalState,
              postalPostcode: fields.postalPostcode,
              country: fields.country,
              physicalAddress: fields.physicalAddress,
              physicalSuburb: fields.physicalSuburb,
              physicalState: fields.physicalState,
              physicalPostcode: fields.physicalPostcode,
              bankAccountName: fields.bankAccountName,
              bankBsb: fields.bankBsb,
              bankAccountNumber: fields.bankAccountNumber,
              paymentTermsDay: fields.paymentTermsDay,
              paymentTermsType: fields.paymentTermsType
            }
          });
          orgId = created.id;
        } else {
          if (!createdByUserId) {
            throw new Error(
              `Cannot create supplier "${fields.name}" without a createdBy user — seed an admin first.`
            );
          }
          const created = await prisma.subcontractorSupplier.create({
            data: {
              name: fields.name,
              xeroContactId: fields.xeroContactId,
              legalName: fields.legalName,
              email: fields.email,
              phone: fields.phone,
              website: fields.website,
              postalAddress: fields.postalAddress,
              postalSuburb: fields.postalSuburb,
              postalState: fields.postalState,
              postalPostcode: fields.postalPostcode,
              country: fields.country,
              physicalAddress: fields.physicalAddress,
              physicalSuburb: fields.physicalSuburb,
              physicalState: fields.physicalState,
              physicalPostcode: fields.physicalPostcode,
              bankAccountName: fields.bankAccountName,
              bankBsb: fields.bankBsb,
              bankAccountNumber: fields.bankAccountNumber,
              paymentTermsDay: fields.paymentTermsDay,
              paymentTermsType: fields.paymentTermsType,
              entityType: "subcontractor",
              createdById: createdByUserId
            }
          });
          orgId = created.id;
        }
      } else {
        orgId = "<dry-run-no-id>";
      }
    } else {
      orgId = existing.id;
      const changed = diffOrgFields(fields, existing);
      outcome.changedFields = changed;
      if (changed.length === 0) {
        outcome.decision = "NO_CHANGE";
        counts.NO_CHANGE += 1;
      } else {
        outcome.decision = "UPDATE";
        counts.UPDATE += 1;
        if (flags.commit) {
          const data = {
            legalName: fields.legalName,
            email: fields.email,
            phone: fields.phone,
            website: fields.website,
            postalAddress: fields.postalAddress,
            postalSuburb: fields.postalSuburb,
            postalState: fields.postalState,
            postalPostcode: fields.postalPostcode,
            country: fields.country,
            physicalAddress: fields.physicalAddress,
            physicalSuburb: fields.physicalSuburb,
            physicalState: fields.physicalState,
            physicalPostcode: fields.physicalPostcode,
            bankAccountName: fields.bankAccountName,
            bankBsb: fields.bankBsb,
            bankAccountNumber: fields.bankAccountNumber,
            paymentTermsDay: fields.paymentTermsDay,
            paymentTermsType: fields.paymentTermsType
          };
          if (organisationType === "CLIENT") {
            await prisma.client.update({ where: { id: existing.id }, data });
          } else {
            await prisma.subcontractorSupplier.update({ where: { id: existing.id }, data });
          }
        }
      }
    }

    samples.push(outcome);

    const persons = extractPersons(row);
    if (orgId === "<dry-run-no-id>") {
      contactCounts.CREATE += persons.length;
      continue;
    }
    for (const person of persons) {
      const where = {
        organisationType,
        organisationId: orgId,
        firstName: person.firstName,
        lastName: person.lastName,
        ...(person.email ? { email: person.email } : { email: null })
      };
      const existingContact = await prisma.contact.findFirst({ where });
      if (!existingContact) {
        contactCounts.CREATE += 1;
        if (flags.commit) {
          await prisma.contact.create({
            data: {
              organisationType,
              organisationId: orgId,
              firstName: person.firstName,
              lastName: person.lastName,
              email: person.email,
              includeInInvoiceEmails: person.includeInInvoiceEmails
            }
          });
        }
      } else if (existingContact.includeInInvoiceEmails === person.includeInInvoiceEmails) {
        contactCounts.NO_CHANGE += 1;
      } else {
        contactCounts.UPDATE += 1;
        if (flags.commit) {
          await prisma.contact.update({
            where: { id: existingContact.id },
            data: { includeInInvoiceEmails: person.includeInInvoiceEmails }
          });
        }
      }
    }
  }
  return { title, counts, warnings, samples };
}

export async function run(flags: CliFlags): Promise<void> {
  const mode = flags.commit ? "COMMIT" : "DRY-RUN";
  console.log(`[xero-import] mode=${mode}`);
  console.log(`[xero-import] customers=${flags.customersPath}`);
  console.log(`[xero-import] suppliers=${flags.suppliersPath}`);

  const customersText = readFileSync(flags.customersPath, "utf8");
  const suppliersText = readFileSync(flags.suppliersPath, "utf8");
  const customers = parseCsv(customersText);
  const suppliers = parseCsv(suppliersText);
  console.log(`[xero-import] customer rows: ${customers.rows.length}`);
  console.log(`[xero-import] supplier rows: ${suppliers.rows.length}`);

  const prisma = new PrismaClient();
  try {
    const adminUser = await prisma.user.findFirst({
      where: { email: "admin@projectops.local" }
    });
    const createdByUserId = adminUser?.id ?? null;
    if (!createdByUserId) {
      console.warn(
        "[xero-import] no admin user found; supplier CREATE rows will fail in --commit mode"
      );
    }
    const contactCounts: Record<Decision, number> = {
      CREATE: 0,
      UPDATE: 0,
      NO_CHANGE: 0,
      SKIPPED: 0
    };
    const customerSection = await processRows({
      organisationType: "CLIENT",
      title: "Customers → Client",
      rows: customers.rows,
      flags,
      prisma,
      createdByUserId,
      contactCounts
    });
    const supplierSection = await processRows({
      organisationType: "SUBCONTRACTOR",
      title: "Suppliers → SubcontractorSupplier",
      rows: suppliers.rows,
      flags,
      prisma,
      createdByUserId,
      contactCounts
    });
    const report = buildReport(flags, customerSection, supplierSection, contactCounts);
    writeFileSync(flags.reportPath, report, "utf8");
    console.log(`[xero-import] report written to ${flags.reportPath}`);
    console.log(`[xero-import] customers: ${JSON.stringify(customerSection.counts)}`);
    console.log(`[xero-import] suppliers: ${JSON.stringify(supplierSection.counts)}`);
    console.log(`[xero-import] contacts:  ${JSON.stringify(contactCounts)}`);
    if (!flags.commit) {
      console.log("[xero-import] dry run — no rows persisted. Re-run with --commit to apply.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  const flags = parseArgs(process.argv.slice(2));
  run(flags).catch((err) => {
    console.error("[xero-import] FAILED:", err);
    process.exit(1);
  });
}
