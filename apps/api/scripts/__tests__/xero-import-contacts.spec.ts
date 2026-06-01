import {
  extractPersons,
  mapTerm,
  mapXeroRow,
  parseBankNumber,
  parseCsv
} from "../xero-import-contacts";

describe("parseBankNumber", () => {
  it("splits concatenated 12-digit numbers as 6-digit BSB + remainder", () => {
    expect(parseBankNumber("034198491719")).toEqual({
      bsb: "034198",
      account: "491719"
    });
  });

  it("respects an explicit hyphen separator", () => {
    expect(parseBankNumber("034-198491719")).toEqual({
      bsb: "034",
      account: "198491719"
    });
  });

  it("returns nulls for non-numeric input", () => {
    expect(parseBankNumber("abc")).toEqual({ bsb: null, account: null });
  });

  it("returns nulls for empty input", () => {
    expect(parseBankNumber("")).toEqual({ bsb: null, account: null });
  });

  it("returns nulls for malformed hyphen input with non-digit parts", () => {
    expect(parseBankNumber("ab-12")).toEqual({ bsb: null, account: null });
  });

  it("returns nulls when total digits are too few", () => {
    expect(parseBankNumber("1234567")).toEqual({ bsb: null, account: null });
  });

  it("ignores whitespace inside the value", () => {
    expect(parseBankNumber("034 198 491719")).toEqual({
      bsb: "034198",
      account: "491719"
    });
  });
});

describe("mapTerm", () => {
  it("maps DAYSAFTERBILLDATE to DAYS_AFTER_INVOICE", () => {
    expect(mapTerm("DAYSAFTERBILLDATE")).toBe("DAYS_AFTER_INVOICE");
  });

  it("maps DAYSAFTERBILLMONTH to DAYS_AFTER_END_OF_MONTH", () => {
    expect(mapTerm("DAYSAFTERBILLMONTH")).toBe("DAYS_AFTER_END_OF_MONTH");
  });

  it("maps OFCURRENTMONTH to DAY_OF_CURRENT_MONTH", () => {
    expect(mapTerm("OFCURRENTMONTH")).toBe("DAY_OF_CURRENT_MONTH");
  });

  it("maps OFFOLLOWINGMONTH to DAY_OF_FOLLOWING_MONTH", () => {
    expect(mapTerm("OFFOLLOWINGMONTH")).toBe("DAY_OF_FOLLOWING_MONTH");
  });

  it("returns null for unknown terms", () => {
    expect(mapTerm("UNKNOWN_TERM")).toBeNull();
  });

  it("returns null for empty / whitespace input", () => {
    expect(mapTerm("")).toBeNull();
    expect(mapTerm("   ")).toBeNull();
    expect(mapTerm(undefined)).toBeNull();
  });
});

describe("mapXeroRow", () => {
  function baseRow(overrides: Record<string, string> = {}): Record<string, string> {
    return {
      ContactName: "Acme Pty Ltd",
      LegalName: "Acme Pty Limited",
      EmailAddress: "Sales@Acme.COM",
      PhoneNumber: "07 1234 5678",
      Website: "https://acme.example",
      POAddressLine1: "PO Box 1",
      POAddressLine2: "Branch 2",
      POCity: "Brisbane",
      PORegion: "QLD",
      POPostalCode: "4000",
      POCountry: "Australia",
      SAAddressLine1: "1 Test St",
      SAAddressLine2: "",
      SACity: "Brisbane",
      SARegion: "QLD",
      SAPostalCode: "4001",
      BankAccountName: "Acme Pty Ltd",
      BankAccountNumber: "034198491719",
      DueDateBillDay: "20",
      DueDateBillTerm: "DAYSAFTERBILLDATE",
      ...overrides
    };
  }

  it("maps a populated row into our org fields", () => {
    const result = mapXeroRow(baseRow());
    expect(result.warning).toBeUndefined();
    expect(result.fields).toEqual({
      name: "Acme Pty Ltd",
      legalName: "Acme Pty Limited",
      email: "sales@acme.com",
      phone: "07 1234 5678",
      website: "https://acme.example",
      postalAddress: "PO Box 1\nBranch 2",
      postalSuburb: "Brisbane",
      postalState: "QLD",
      postalPostcode: "4000",
      country: "Australia",
      physicalAddress: "1 Test St",
      physicalSuburb: "Brisbane",
      physicalState: "QLD",
      physicalPostcode: "4001",
      bankAccountName: "Acme Pty Ltd",
      bankBsb: "034198",
      bankAccountNumber: "491719",
      paymentTermsDay: 20,
      paymentTermsType: "DAYS_AFTER_INVOICE"
    });
  });

  it("defaults country to Australia when POCountry is empty", () => {
    const result = mapXeroRow(baseRow({ POCountry: "" }));
    expect(result.fields?.country).toBe("Australia");
  });

  it("skips rows with blank ContactName", () => {
    const result = mapXeroRow(baseRow({ ContactName: "  " }));
    expect(result.fields).toBeNull();
    expect(result.warning).toMatch(/blank/);
  });

  it("flags a warning when bank number cannot be parsed", () => {
    const result = mapXeroRow(baseRow({ BankAccountNumber: "not-a-number" }));
    expect(result.fields?.bankBsb).toBeNull();
    expect(result.fields?.bankAccountNumber).toBeNull();
    expect(result.warning).toMatch(/bank number/i);
  });

  it("ignores out-of-range DueDateBillDay", () => {
    const result = mapXeroRow(baseRow({ DueDateBillDay: "55" }));
    expect(result.fields?.paymentTermsDay).toBeNull();
  });

  it("maps unknown bill term to null", () => {
    const result = mapXeroRow(baseRow({ DueDateBillTerm: "MYSTERIOUS" }));
    expect(result.fields?.paymentTermsType).toBeNull();
  });

  it("treats empty optional fields as null rather than empty string", () => {
    const result = mapXeroRow(
      baseRow({
        LegalName: "",
        EmailAddress: "",
        Website: "",
        POAddressLine1: "",
        POAddressLine2: ""
      })
    );
    expect(result.fields?.legalName).toBeNull();
    expect(result.fields?.email).toBeNull();
    expect(result.fields?.website).toBeNull();
    expect(result.fields?.postalAddress).toBeNull();
  });
});

describe("extractPersons", () => {
  it("returns populated persons and skips empty slots", () => {
    const row: Record<string, string> = {
      Person1FirstName: "Alice",
      Person1LastName: "Smith",
      Person1Email: "Alice@Example.com",
      Person1IncludeInEmail: "true",
      Person2FirstName: "",
      Person2LastName: "",
      Person2Email: "",
      Person2IncludeInEmail: "",
      Person3FirstName: "Bob",
      Person3LastName: "Jones",
      Person3Email: "",
      Person3IncludeInEmail: "no",
      Person4FirstName: "",
      Person4LastName: "Lone",
      Person4Email: "lone@example.com",
      Person4IncludeInEmail: "1"
    };
    const persons = extractPersons(row);
    expect(persons).toEqual([
      {
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@example.com",
        includeInInvoiceEmails: true
      },
      {
        firstName: "Bob",
        lastName: "Jones",
        email: null,
        includeInInvoiceEmails: false
      },
      {
        firstName: "",
        lastName: "Lone",
        email: "lone@example.com",
        includeInInvoiceEmails: true
      }
    ]);
  });

  it("ignores Person5 columns even when present", () => {
    const row: Record<string, string> = {
      Person1FirstName: "",
      Person1LastName: "",
      Person1Email: "",
      Person5FirstName: "Ignored",
      Person5LastName: "Person",
      Person5Email: "ignored@example.com",
      Person5IncludeInEmail: "true"
    };
    expect(extractPersons(row)).toEqual([]);
  });
});

describe("parseCsv", () => {
  it("strips a leading BOM and splits header + rows", () => {
    const text = "﻿*ContactName,EmailAddress\r\nAcme,foo@bar.com\r\n";
    const parsed = parseCsv(text);
    expect(parsed.headers).toEqual(["ContactName", "EmailAddress"]);
    expect(parsed.rows).toEqual([{ ContactName: "Acme", EmailAddress: "foo@bar.com" }]);
  });

  it("respects quoted fields with embedded commas and escaped quotes", () => {
    const text = `*ContactName,Note\n"Smith, John","She said ""hi"""\n`;
    const parsed = parseCsv(text);
    expect(parsed.rows).toEqual([
      { ContactName: "Smith, John", Note: 'She said "hi"' }
    ]);
  });

  it("ignores trailing blank lines", () => {
    const text = "*ContactName\nAcme\n\n";
    const parsed = parseCsv(text);
    expect(parsed.rows).toEqual([{ ContactName: "Acme" }]);
  });
});
