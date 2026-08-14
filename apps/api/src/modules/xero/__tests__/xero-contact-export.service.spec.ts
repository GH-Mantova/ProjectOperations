import {
  XeroContactExportService,
  XERO_CONTACT_CSV_COLUMNS,
  type XeroExportableContact
} from "../xero-contact-export.service";

// Xero's stock contact-import column order (from Xero's help centre). Any
// deviation from this exact sequence — including the leading asterisk on
// *ContactName — breaks the importer with an opaque error, so the assertion
// pins the header verbatim.
const EXPECTED_HEADER =
  "*ContactName,EmailAddress,FirstName,LastName," +
  "POAddressLine1,POAddressLine2,POAddressLine3,POAddressLine4,POCity,PORegion,POPostalCode,POCountry," +
  "SAAddressLine1,SAAddressLine2,SAAddressLine3,SAAddressLine4,SACity,SARegion,SAPostalCode,SACountry," +
  "PhoneNumber,MobileNumber,DirectDialNumber,FaxNumber," +
  "Website,TaxNumber,AccountNumber," +
  "BankAccountName,BankAccountNumber," +
  "SalesAccount,PurchasesAccount,Discount,DefaultCurrency";

function makeContact(overrides: Partial<XeroExportableContact> = {}): XeroExportableContact {
  return {
    name: "Acme Constructions",
    code: "ACME-001",
    email: "billing@acme.example",
    phone: "07 5555 1111",
    website: "https://acme.example",
    abn: "12345678901",
    country: "Australia",
    physicalAddress: "1 Site St",
    physicalSuburb: "Toowoomba",
    physicalState: "QLD",
    physicalPostcode: "4350",
    postalAddress: "PO Box 42",
    postalSuburb: "Toowoomba",
    postalState: "QLD",
    postalPostcode: "4350",
    bankAccountName: "Acme Constructions Pty Ltd",
    bankBsb: "084-424",
    bankAccountNumber: "12345678",
    salesAccountCode: "200",
    purchaseAccountCode: "300",
    discount: null,
    ...overrides
  };
}

function parseRows(csv: string): string[] {
  // Trailing CRLF from the builder yields a final empty row; strip it so tests
  // don't have to account for it every time.
  return csv.split("\r\n").filter((line) => line.length > 0);
}

function headerRow(csv: string): string {
  return parseRows(csv)[0] ?? "";
}

function dataRow(csv: string, index = 0): string {
  return parseRows(csv)[index + 1] ?? "";
}

describe("XeroContactExportService — CSV shape", () => {
  const service = new XeroContactExportService();

  it("emits the header exactly in Xero's spec order", () => {
    const csv = service.buildClientsCsv([], { includeBankDetails: false });
    expect(headerRow(csv)).toBe(EXPECTED_HEADER);
    expect(XERO_CONTACT_CSV_COLUMNS.length).toBe(EXPECTED_HEADER.split(",").length);
  });

  it("emits header + rows for vendors using the same column layout", () => {
    const csv = service.buildVendorsCsv([makeContact()], { includeBankDetails: false });
    expect(headerRow(csv)).toBe(EXPECTED_HEADER);
    expect(parseRows(csv).length).toBe(2);
  });
});

describe("XeroContactExportService — bank-detail gating", () => {
  const service = new XeroContactExportService();

  it("blanks BankAccountName and BankAccountNumber when includeBankDetails=false", () => {
    const csv = service.buildClientsCsv([makeContact()], { includeBankDetails: false });
    const cols = dataRow(csv).split(",");
    // Column indices from XERO_CONTACT_CSV_COLUMNS: BankAccountName=27, BankAccountNumber=28.
    expect(cols[27]).toBe("");
    expect(cols[28]).toBe("");
  });

  it("joins BSB and account with a hyphen when includeBankDetails=true", () => {
    const csv = service.buildClientsCsv([makeContact()], { includeBankDetails: true });
    const cols = dataRow(csv).split(",");
    expect(cols[27]).toBe("Acme Constructions Pty Ltd");
    expect(cols[28]).toBe("084-424-12345678");
  });

  it("emits empty BankAccountNumber when includeBankDetails=true but both halves are null", () => {
    const csv = service.buildClientsCsv(
      [makeContact({ bankBsb: null, bankAccountNumber: null, bankAccountName: null })],
      { includeBankDetails: true }
    );
    const cols = dataRow(csv).split(",");
    expect(cols[27]).toBe("");
    expect(cols[28]).toBe("");
  });
});

describe("XeroContactExportService — value serialisation", () => {
  const service = new XeroContactExportService();

  it("excludes custom fields — extra properties on the input are ignored", () => {
    const csv = service.buildClientsCsv(
      [
        {
          ...makeContact(),
          // Extra "custom" fields the caller may pass in; must not leak.
          customFields: { purchaseOrderNumber: "PO-9999", riskLevel: "high" }
        } as XeroExportableContact & { customFields: Record<string, string> }
      ],
      { includeBankDetails: false }
    );
    expect(csv).not.toContain("PO-9999");
    expect(csv).not.toContain("riskLevel");
    expect(csv).not.toContain("purchaseOrderNumber");
    // Sanity — the row still has exactly the spec column count.
    expect(dataRow(csv).split(",").length).toBe(XERO_CONTACT_CSV_COLUMNS.length);
  });

  it("serialises Prisma Decimal discount as a plain number string, never [object Object]", () => {
    const decimalLike = { toString: () => "12.50" };
    const csv = service.buildClientsCsv(
      [makeContact({ discount: decimalLike })],
      { includeBankDetails: false }
    );
    const cols = dataRow(csv).split(",");
    // Discount column index = 31.
    expect(cols[31]).toBe("12.50");
    expect(csv).not.toContain("[object Object]");
  });

  it("serialises empty optionals as empty strings, never the literal text null or undefined", () => {
    const csv = service.buildClientsCsv(
      [
        makeContact({
          email: null,
          phone: null,
          website: null,
          physicalAddress: null,
          postalAddress: null,
          salesAccountCode: null,
          purchaseAccountCode: null,
          discount: null
        })
      ],
      { includeBankDetails: false }
    );
    expect(csv).not.toContain("null");
    expect(csv).not.toContain("undefined");
    const cols = dataRow(csv).split(",");
    // A few spot checks against the spec column indices.
    expect(cols[1]).toBe(""); // EmailAddress
    expect(cols[20]).toBe(""); // PhoneNumber
    expect(cols[24]).toBe(""); // Website
    expect(cols[31]).toBe(""); // Discount
  });

  it("always emits AUD in the DefaultCurrency column", () => {
    const csv = service.buildClientsCsv([makeContact()], { includeBankDetails: false });
    const cols = dataRow(csv).split(",");
    // DefaultCurrency column index = 32.
    expect(cols[32]).toBe("AUD");
  });

  it("quotes fields that contain commas per RFC 4180", () => {
    const csv = service.buildClientsCsv(
      [makeContact({ name: "Acme, Inc." })],
      { includeBankDetails: false }
    );
    expect(dataRow(csv).startsWith('"Acme, Inc."')).toBe(true);
  });
});
