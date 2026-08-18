/**
 * CFX-5 — Reusable header-to-field column mapper.
 *
 * Renders a table with one row per detected CSV header; each row has a
 * dropdown that lets the user pick which BUILTIN field key (or "— ignore —")
 * that header maps to.
 *
 * Emits a `columnMap: Record<string, string>` where key = BUILTIN field key
 * and value = CSV header name. Unmapped headers are excluded from the output.
 *
 * Custom fields are never offered as targets (plan §2 decision 3).
 */

// ── BUILTIN field options ─────────────────────────────────────────────────────

export type BuiltinFieldKey =
  | "xeroContactId"
  | "name"
  | "email"
  | "phone"
  | "website"
  | "abn"
  | "code"
  | "country"
  | "physicalAddress"
  | "physicalSuburb"
  | "physicalState"
  | "physicalPostcode"
  | "postalAddress"
  | "postalSuburb"
  | "postalState"
  | "postalPostcode"
  | "bankName"
  | "bankAccountName"
  | "bankBsb"
  | "bankAccountNumber"
  | "salesAccountCode"
  | "purchaseAccountCode"
  | "discount";

export const BUILTIN_FIELD_OPTIONS: Array<{ key: BuiltinFieldKey; label: string }> = [
  { key: "xeroContactId", label: "Xero Contact ID" },
  { key: "name", label: "Name *" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
  { key: "abn", label: "ABN (Tax Number)" },
  { key: "code", label: "Account Number" },
  { key: "country", label: "Country" },
  { key: "physicalAddress", label: "Physical Address" },
  { key: "physicalSuburb", label: "Physical Suburb" },
  { key: "physicalState", label: "Physical State" },
  { key: "physicalPostcode", label: "Physical Postcode" },
  { key: "postalAddress", label: "Postal Address" },
  { key: "postalSuburb", label: "Postal Suburb" },
  { key: "postalState", label: "Postal State" },
  { key: "postalPostcode", label: "Postal Postcode" },
  { key: "bankName", label: "Bank Name" },
  { key: "bankAccountName", label: "Bank Account Name" },
  { key: "bankBsb", label: "Bank BSB" },
  { key: "bankAccountNumber", label: "Bank Account Number" },
  { key: "salesAccountCode", label: "Sales Account Code" },
  { key: "purchaseAccountCode", label: "Purchase Account Code" },
  { key: "discount", label: "Discount %" }
];

// ── Helpers (exported for tests) ──────────────────────────────────────────────

/**
 * Given a list of detected CSV headers and a current mapping state
 * (headerName → builtinKey | ""), returns the column map
 * (builtinKey → headerName) that the server expects.
 *
 * Headers mapped to "" (ignore) are excluded from the output.
 * Duplicate builtinKey assignments: the last one wins (keeps the map valid).
 */
export function buildColumnMap(
  headerMappings: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [headerName, builtinKey] of Object.entries(headerMappings)) {
    if (builtinKey === "" || builtinKey === undefined) continue;
    result[builtinKey] = headerName;
  }
  return result;
}

/**
 * Auto-suggest a mapping for a CSV header by fuzzy-matching against BUILTIN
 * field labels and keys (case-insensitive, partial match).
 *
 * Returns the matching builtinKey, or "" if no strong match found.
 */
export function autoSuggestMapping(headerName: string): string {
  const lower = headerName.toLowerCase().trim();
  // Exact key match first.
  const exactKey = BUILTIN_FIELD_OPTIONS.find(
    (opt) => opt.key.toLowerCase() === lower
  );
  if (exactKey) return exactKey.key;

  // Common Xero column → BUILTIN mapping heuristics.
  const HEURISTICS: Array<[RegExp, BuiltinFieldKey]> = [
    [/^\*?contactname$/i, "name"],
    [/^emailaddress$/i, "email"],
    [/^phonenumber$/i, "phone"],
    [/^website$/i, "website"],
    [/^taxnumber$/i, "abn"],
    [/^accountnumber$/i, "code"],
    [/^xerocontactid$/i, "xeroContactId"],
    [/^bankaccountname$/i, "bankAccountName"],
    [/^bankaccountnumber$/i, "bankAccountNumber"],
    [/^(bsb|bankbsb)$/i, "bankBsb"],
    [/^bankname$/i, "bankName"],
    [/^salesaccount$/i, "salesAccountCode"],
    [/^purchasesaccount$/i, "purchaseAccountCode"],
    [/^discount$/i, "discount"],
    [/^pocity$/i, "postalSuburb"],
    [/^poregion$/i, "postalState"],
    [/^popostalcode$/i, "postalPostcode"],
    [/^pocountry$/i, "country"],
    [/^poaddressline1$/i, "postalAddress"],
    [/^sacity$/i, "physicalSuburb"],
    [/^saregion$/i, "physicalState"],
    [/^sapostalcode$/i, "physicalPostcode"],
    [/^saaddressline1$/i, "physicalAddress"]
  ];

  for (const [regex, key] of HEURISTICS) {
    if (regex.test(lower)) return key;
  }

  return "";
}

// ── Component ─────────────────────────────────────────────────────────────────

export type CsvColumnMapperProps = {
  /** Detected CSV header names from the uploaded file. */
  headers: string[];
  /**
   * Current mapping state: headerName → builtinKey (or "" to ignore).
   * Caller owns this state via useState.
   */
  headerMappings: Record<string, string>;
  /** Called whenever any mapping changes. */
  onChange: (updated: Record<string, string>) => void;
};

export function CsvColumnMapper({ headers, headerMappings, onChange }: CsvColumnMapperProps) {
  if (headers.length === 0) return null;

  function handleSelect(headerName: string, value: string) {
    onChange({ ...headerMappings, [headerName]: value });
  }

  // Track which BUILTIN keys are already assigned (to warn on duplicates).
  const assignedKeys = new Set<string>(
    Object.values(headerMappings).filter((v) => v !== "")
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 13,
          tableLayout: "fixed"
        }}
      >
        <colgroup>
          <col style={{ width: "45%" }} />
          <col style={{ width: "55%" }} />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--border-default, #e5e7eb)" }}>
            <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>
              CSV header
            </th>
            <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 600 }}>
              Maps to field
            </th>
          </tr>
        </thead>
        <tbody>
          {headers.map((header) => {
            const selectedKey = headerMappings[header] ?? "";
            // Detect duplicate assignment (another header already uses this key).
            const isDuplicate =
              selectedKey !== "" &&
              Object.entries(headerMappings).some(
                ([otherHeader, otherKey]) =>
                  otherHeader !== header && otherKey === selectedKey
              );

            return (
              <tr
                key={header}
                style={{ borderBottom: "1px solid var(--border-subtle, #f3f4f6)" }}
              >
                <td
                  style={{
                    padding: "6px 8px",
                    fontFamily: "monospace",
                    fontSize: 12,
                    color: "var(--text-default)"
                  }}
                  title={header}
                >
                  {header}
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <select
                    value={selectedKey}
                    onChange={(ev) => handleSelect(header, ev.target.value)}
                    style={{
                      width: "100%",
                      padding: "4px 6px",
                      fontSize: 13,
                      borderRadius: 4,
                      border: isDuplicate
                        ? "1px solid var(--border-error, #ef4444)"
                        : "1px solid var(--border-default, #d1d5db)",
                      background: "var(--surface-input, #fff)",
                      color: "var(--text-default)"
                    }}
                    aria-label={`Map column '${header}'`}
                    data-testid={`col-map-${header}`}
                  >
                    <option value="">— ignore —</option>
                    {BUILTIN_FIELD_OPTIONS.map((opt) => {
                      const alreadyUsed =
                        opt.key !== selectedKey && assignedKeys.has(opt.key);
                      return (
                        <option key={opt.key} value={opt.key} disabled={alreadyUsed}>
                          {opt.label}
                          {alreadyUsed ? " (already mapped)" : ""}
                        </option>
                      );
                    })}
                  </select>
                  {isDuplicate && (
                    <span
                      role="alert"
                      style={{ fontSize: 11, color: "var(--text-error, #ef4444)", display: "block" }}
                    >
                      Another column is already mapped to this field.
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
