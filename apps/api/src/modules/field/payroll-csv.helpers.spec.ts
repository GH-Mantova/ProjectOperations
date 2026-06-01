import {
  escapeCsvField,
  formatIsoDate,
  PAYROLL_CSV_COLUMNS,
  renderPayrollCsv,
  truncateNotes
} from "./payroll-csv.helpers";

describe("payroll-csv helpers (RFC 4180)", () => {
  describe("escapeCsvField", () => {
    it("returns plain alphanumerics unchanged", () => {
      expect(escapeCsvField("Alice Worker")).toBe("Alice Worker");
    });

    it("wraps fields containing a comma in double quotes", () => {
      expect(escapeCsvField("Smith, John")).toBe('"Smith, John"');
    });

    it("escapes internal double quotes by doubling and wrapping", () => {
      expect(escapeCsvField('A "nick" name')).toBe('"A ""nick"" name"');
    });

    it("wraps fields containing a newline", () => {
      expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
    });
  });

  describe("truncateNotes", () => {
    it("returns empty string for null / undefined", () => {
      expect(truncateNotes(null)).toBe("");
      expect(truncateNotes(undefined)).toBe("");
    });

    it("returns the value unchanged when under the limit", () => {
      expect(truncateNotes("short note")).toBe("short note");
    });

    it("truncates at 200 chars by default", () => {
      const long = "x".repeat(250);
      expect(truncateNotes(long)).toHaveLength(200);
    });
  });

  describe("formatIsoDate", () => {
    it("emits YYYY-MM-DD in UTC", () => {
      expect(formatIsoDate(new Date("2026-03-04T00:00:00.000Z"))).toBe("2026-03-04");
    });
  });

  describe("renderPayrollCsv", () => {
    it("emits header even when there are no rows", () => {
      const csv = renderPayrollCsv([]);
      expect(csv).toBe(PAYROLL_CSV_COLUMNS.join(",") + "\r\n");
    });

    it("emits one CSV line per row in order, with CRLF separators", () => {
      const csv = renderPayrollCsv([
        {
          workerName: "Alice Worker",
          workerEmployeeId: "wp-1",
          date: "2026-05-01",
          jobRef: "P-2026-001",
          regularHours: "8",
          notes: "fence install"
        }
      ]);
      const lines = csv.split("\r\n");
      expect(lines[0]).toBe(PAYROLL_CSV_COLUMNS.join(","));
      expect(lines[1]).toBe("Alice Worker,wp-1,2026-05-01,P-2026-001,8,fence install");
      // Trailing CRLF leaves an empty final element.
      expect(lines[2]).toBe("");
    });

    it("escapes worker names that contain commas or quotes", () => {
      const csv = renderPayrollCsv([
        {
          workerName: 'Smith, "Slim" John',
          workerEmployeeId: "wp-2",
          date: "2026-05-02",
          jobRef: "P-2026-002",
          regularHours: "7.5",
          notes: ""
        }
      ]);
      const dataLine = csv.split("\r\n")[1];
      expect(dataLine).toBe('"Smith, ""Slim"" John",wp-2,2026-05-02,P-2026-002,7.5,');
    });
  });
});
