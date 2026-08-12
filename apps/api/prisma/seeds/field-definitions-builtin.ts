import { FieldAppliesTo, FieldSource, PrismaClient } from "@prisma/client";

// CFX-1: Upsert one FieldDefinition row per typed BUILTIN column on Client
// and SubcontractorSupplier. Idempotent — upsert on [appliesTo, key].

interface FieldRow {
  key: string;
  label: string;
  group: string;
  sortOrder: number;
  appliesTo: FieldAppliesTo;
}

const FIELD_ROWS: FieldRow[] = [
  // ── Identity (BOTH) ────────────────────────────────────────────────────────
  { key: "name",            label: "Name",              group: "Identity",  sortOrder: 10,  appliesTo: FieldAppliesTo.BOTH },
  { key: "tradingName",     label: "Trading Name",      group: "Identity",  sortOrder: 20,  appliesTo: FieldAppliesTo.BOTH },
  { key: "businessType",    label: "Business Type",     group: "Identity",  sortOrder: 30,  appliesTo: FieldAppliesTo.BOTH },
  { key: "abn",             label: "ABN",               group: "Identity",  sortOrder: 40,  appliesTo: FieldAppliesTo.BOTH },
  { key: "acn",             label: "ACN",               group: "Identity",  sortOrder: 50,  appliesTo: FieldAppliesTo.BOTH },
  { key: "gstRegistered",   label: "GST Registered",    group: "Identity",  sortOrder: 60,  appliesTo: FieldAppliesTo.BOTH },
  { key: "legalName",       label: "Legal Name",        group: "Identity",  sortOrder: 70,  appliesTo: FieldAppliesTo.BOTH },
  { key: "country",         label: "Country",           group: "Identity",  sortOrder: 80,  appliesTo: FieldAppliesTo.BOTH },

  // ── Identity (CLIENT only) ─────────────────────────────────────────────────
  { key: "code",            label: "Client Code",       group: "Identity",  sortOrder: 15,  appliesTo: FieldAppliesTo.CLIENT },
  { key: "industry",        label: "Industry",          group: "Identity",  sortOrder: 85,  appliesTo: FieldAppliesTo.CLIENT },

  // ── Contact (BOTH) ─────────────────────────────────────────────────────────
  { key: "email",           label: "Email",             group: "Contact",   sortOrder: 10,  appliesTo: FieldAppliesTo.BOTH },
  { key: "phone",           label: "Phone",             group: "Contact",   sortOrder: 20,  appliesTo: FieldAppliesTo.BOTH },
  { key: "website",         label: "Website",           group: "Contact",   sortOrder: 30,  appliesTo: FieldAppliesTo.BOTH },

  // ── Address (BOTH) ─────────────────────────────────────────────────────────
  { key: "physicalAddress",  label: "Physical Address",  group: "Address",   sortOrder: 10,  appliesTo: FieldAppliesTo.BOTH },
  { key: "physicalSuburb",   label: "Physical Suburb",   group: "Address",   sortOrder: 20,  appliesTo: FieldAppliesTo.BOTH },
  { key: "physicalState",    label: "Physical State",    group: "Address",   sortOrder: 30,  appliesTo: FieldAppliesTo.BOTH },
  { key: "physicalPostcode", label: "Physical Postcode", group: "Address",   sortOrder: 40,  appliesTo: FieldAppliesTo.BOTH },
  { key: "postalAddress",    label: "Postal Address",    group: "Address",   sortOrder: 50,  appliesTo: FieldAppliesTo.BOTH },
  { key: "postalSuburb",     label: "Postal Suburb",     group: "Address",   sortOrder: 60,  appliesTo: FieldAppliesTo.BOTH },
  { key: "postalState",      label: "Postal State",      group: "Address",   sortOrder: 70,  appliesTo: FieldAppliesTo.BOTH },
  { key: "postalPostcode",   label: "Postal Postcode",   group: "Address",   sortOrder: 80,  appliesTo: FieldAppliesTo.BOTH },
  { key: "postalSameAs",     label: "Postal Same As Physical", group: "Address", sortOrder: 90, appliesTo: FieldAppliesTo.BOTH },

  // ── Payment (BOTH) ─────────────────────────────────────────────────────────
  { key: "paymentTermsDay",     label: "Payment Terms Day",      group: "Payment",  sortOrder: 10,  appliesTo: FieldAppliesTo.BOTH },
  { key: "paymentTermsType",    label: "Payment Terms Type",     group: "Payment",  sortOrder: 20,  appliesTo: FieldAppliesTo.BOTH },
  { key: "paymentTermsDays",    label: "Payment Terms Days",     group: "Payment",  sortOrder: 30,  appliesTo: FieldAppliesTo.BOTH },
  { key: "creditLimit",         label: "Credit Limit",           group: "Payment",  sortOrder: 40,  appliesTo: FieldAppliesTo.BOTH },
  { key: "creditApproved",      label: "Credit Approved",        group: "Payment",  sortOrder: 50,  appliesTo: FieldAppliesTo.BOTH },
  { key: "preferredPayment",    label: "Preferred Payment",      group: "Payment",  sortOrder: 60,  appliesTo: FieldAppliesTo.BOTH },
  { key: "salesAccountCode",    label: "Sales Account Code",     group: "Payment",  sortOrder: 70,  appliesTo: FieldAppliesTo.BOTH },
  { key: "purchaseAccountCode", label: "Purchase Account Code",  group: "Payment",  sortOrder: 80,  appliesTo: FieldAppliesTo.BOTH },
  { key: "discount",            label: "Discount (%)",           group: "Payment",  sortOrder: 90,  appliesTo: FieldAppliesTo.BOTH },

  // ── Banking (BOTH) ─────────────────────────────────────────────────────────
  { key: "bankName",          label: "Bank Name",           group: "Banking",  sortOrder: 10,  appliesTo: FieldAppliesTo.BOTH },
  { key: "bankAccountName",   label: "Bank Account Name",   group: "Banking",  sortOrder: 20,  appliesTo: FieldAppliesTo.BOTH },
  { key: "bankBsb",           label: "BSB",                 group: "Banking",  sortOrder: 30,  appliesTo: FieldAppliesTo.BOTH },
  { key: "bankAccountNumber", label: "Bank Account Number", group: "Banking",  sortOrder: 40,  appliesTo: FieldAppliesTo.BOTH },

  // ── Integration (BOTH) ─────────────────────────────────────────────────────
  { key: "xeroContactId", label: "Xero Contact ID", group: "Integration", sortOrder: 10,  appliesTo: FieldAppliesTo.BOTH },
  { key: "myobCardId",    label: "MYOB Card ID",     group: "Integration", sortOrder: 20,  appliesTo: FieldAppliesTo.BOTH },

  // ── Status (BOTH) ──────────────────────────────────────────────────────────
  { key: "isActive",       label: "Active",          group: "Status",  sortOrder: 10,  appliesTo: FieldAppliesTo.BOTH },
  { key: "onHold",         label: "On Hold",         group: "Status",  sortOrder: 20,  appliesTo: FieldAppliesTo.BOTH },
  { key: "onHoldReason",   label: "On Hold Reason",  group: "Status",  sortOrder: 30,  appliesTo: FieldAppliesTo.BOTH },
  { key: "internalNotes",  label: "Internal Notes",  group: "Status",  sortOrder: 40,  appliesTo: FieldAppliesTo.BOTH },

  // ── Compliance (VENDOR only) ───────────────────────────────────────────────
  { key: "entityType",             label: "Entity Type",              group: "Compliance", sortOrder: 10,  appliesTo: FieldAppliesTo.VENDOR },
  { key: "categories",             label: "Categories",               group: "Compliance", sortOrder: 20,  appliesTo: FieldAppliesTo.VENDOR },
  { key: "prequalStatus",          label: "Prequal Status",           group: "Compliance", sortOrder: 30,  appliesTo: FieldAppliesTo.VENDOR },
  { key: "prequalNotes",           label: "Prequal Notes",            group: "Compliance", sortOrder: 40,  appliesTo: FieldAppliesTo.VENDOR },
  { key: "swmsOnFile",             label: "SWMS On File",             group: "Compliance", sortOrder: 50,  appliesTo: FieldAppliesTo.VENDOR },
  { key: "complianceBlocked",      label: "Compliance Blocked",       group: "Compliance", sortOrder: 60,  appliesTo: FieldAppliesTo.VENDOR },
  { key: "complianceBlockReason",  label: "Compliance Block Reason",  group: "Compliance", sortOrder: 70,  appliesTo: FieldAppliesTo.VENDOR },
  { key: "performanceRating",      label: "Performance Rating",       group: "Compliance", sortOrder: 80,  appliesTo: FieldAppliesTo.VENDOR }
];

export async function seedFieldDefinitionsBuiltin(prisma: PrismaClient): Promise<void> {
  for (const row of FIELD_ROWS) {
    await prisma.fieldDefinition.upsert({
      where: {
        appliesTo_key: {
          appliesTo: row.appliesTo,
          key: row.key
        }
      },
      update: {
        label: row.label,
        group: row.group,
        sortOrder: row.sortOrder,
        visible: true,
        source: FieldSource.BUILTIN
      },
      create: {
        key: row.key,
        label: row.label,
        group: row.group,
        sortOrder: row.sortOrder,
        visible: true,
        required: false,
        appliesTo: row.appliesTo,
        source: FieldSource.BUILTIN
      }
    });
  }
}
