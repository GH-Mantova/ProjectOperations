import { Injectable } from "@nestjs/common";

// CFX-4 — Pure CSV builder that maps BUILTIN (Xero-parity) fields on Client and
// SubcontractorSupplier to Xero's contact-import column set. No HTTP, no Xero
// SDK, no auth, no DB. Custom fields NEVER round-trip to Xero — decision 3 in
// docs/plans/configurable-fields-xero-exchange-plan.md §2.

// Xero's contact-import spec — column order is strict; keep this array in sync
// with the spec and the header assertion in the spec file.
export const XERO_CONTACT_CSV_COLUMNS = [
  "*ContactName",
  "EmailAddress",
  "FirstName",
  "LastName",
  "POAddressLine1",
  "POAddressLine2",
  "POAddressLine3",
  "POAddressLine4",
  "POCity",
  "PORegion",
  "POPostalCode",
  "POCountry",
  "SAAddressLine1",
  "SAAddressLine2",
  "SAAddressLine3",
  "SAAddressLine4",
  "SACity",
  "SARegion",
  "SAPostalCode",
  "SACountry",
  "PhoneNumber",
  "MobileNumber",
  "DirectDialNumber",
  "FaxNumber",
  "Website",
  "TaxNumber",
  "AccountNumber",
  "BankAccountName",
  "BankAccountNumber",
  "SalesAccount",
  "PurchasesAccount",
  "Discount",
  "DefaultCurrency"
] as const;

export type ExportOptions = {
  includeBankDetails: boolean;
};

// Structural type — matches the BUILTIN parity subset of prisma Client and
// SubcontractorSupplier. Loose on nullability because Prisma yields `null` for
// unset optional columns; both models share this shape for the parity fields.
export type XeroExportableContact = {
  name: string;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  abn?: string | null;
  country?: string | null;
  physicalAddress?: string | null;
  physicalSuburb?: string | null;
  physicalState?: string | null;
  physicalPostcode?: string | null;
  postalAddress?: string | null;
  postalSuburb?: string | null;
  postalState?: string | null;
  postalPostcode?: string | null;
  bankAccountName?: string | null;
  bankBsb?: string | null;
  bankAccountNumber?: string | null;
  salesAccountCode?: string | null;
  purchaseAccountCode?: string | null;
  discount?: DecimalLike | null;
};

// Prisma Decimal exposes toString(); numbers and strings pass through unchanged.
export type DecimalLike = number | string | { toString(): string };

function nullableString(value: string | null | undefined): string {
  return value == null ? "" : value;
}

function decimalToPlainString(value: DecimalLike | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "string") return value;
  const text = value.toString();
  // Guard against "[object Object]" — a stringified value that begins with "["
  // is not a valid decimal representation.
  return text.startsWith("[object") ? "" : text;
}

function bankAccountNumberValue(
  contact: Pick<XeroExportableContact, "bankBsb" | "bankAccountNumber">
): string {
  const bsb = nullableString(contact.bankBsb);
  const acc = nullableString(contact.bankAccountNumber);
  if (!bsb && !acc) return "";
  return `${bsb}-${acc}`;
}

// RFC 4180 CSV field encoder. Quote when the value contains a comma, quote,
// carriage return, or line feed; double any embedded quotes. Empty strings pass
// through as bare empties (Xero treats "" as unset).
function encodeField(value: string): string {
  if (value === "") return "";
  const needsQuoting = /[",\r\n]/.test(value);
  if (!needsQuoting) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function encodeRow(cells: readonly string[]): string {
  return cells.map(encodeField).join(",");
}

function contactRow(
  contact: XeroExportableContact,
  opts: ExportOptions
): string[] {
  const bankName = opts.includeBankDetails ? nullableString(contact.bankAccountName) : "";
  const bankNumber = opts.includeBankDetails ? bankAccountNumberValue(contact) : "";

  return [
    // *ContactName
    nullableString(contact.name),
    // EmailAddress
    nullableString(contact.email),
    // FirstName / LastName — no first/last split on the ERP record, emit blank.
    "",
    "",
    // POAddress* — postal block (Xero: PO = Postal address).
    nullableString(contact.postalAddress),
    "",
    "",
    "",
    nullableString(contact.postalSuburb),
    nullableString(contact.postalState),
    nullableString(contact.postalPostcode),
    nullableString(contact.country),
    // SAAddress* — street / physical block (Xero: SA = Street address).
    nullableString(contact.physicalAddress),
    "",
    "",
    "",
    nullableString(contact.physicalSuburb),
    nullableString(contact.physicalState),
    nullableString(contact.physicalPostcode),
    nullableString(contact.country),
    // Phone group — only landline "phone" is modelled today; mobile / DDI /
    // fax stay empty rather than being invented.
    nullableString(contact.phone),
    "",
    "",
    "",
    // Website
    nullableString(contact.website),
    // TaxNumber = ABN (AU convention).
    nullableString(contact.abn),
    // AccountNumber = ERP client/vendor code.
    nullableString(contact.code),
    // Bank block — gated on opts.includeBankDetails.
    bankName,
    bankNumber,
    // Sales / Purchases / Discount (parity columns added by CFX-1).
    nullableString(contact.salesAccountCode),
    nullableString(contact.purchaseAccountCode),
    decimalToPlainString(contact.discount),
    // DefaultCurrency — AU-only tenant today; hard-code AUD.
    "AUD"
  ];
}

@Injectable()
export class XeroContactExportService {
  buildClientsCsv(clients: XeroExportableContact[], opts: ExportOptions): string {
    return this.buildCsv(clients, opts);
  }

  buildVendorsCsv(vendors: XeroExportableContact[], opts: ExportOptions): string {
    return this.buildCsv(vendors, opts);
  }

  private buildCsv(rows: XeroExportableContact[], opts: ExportOptions): string {
    const header = encodeRow(XERO_CONTACT_CSV_COLUMNS);
    const body = rows.map((row) => encodeRow(contactRow(row, opts)));
    // CRLF line ending per RFC 4180 §2.1 — Xero's importer accepts either.
    return [header, ...body].join("\r\n") + "\r\n";
  }
}
