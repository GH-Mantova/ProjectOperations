// §7 payroll CSV export — service-level tests with mocked Prisma. Verifies
// the where clause filters (APPROVED only + inclusive date range), sort
// order, escaping of awkward worker names, and BadRequest on inverted /
// invalid date ranges. The 400-on-missing case is enforced by IsDateString
// at the ValidationPipe and is not re-tested here.

import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FieldService } from "./field.service";
import { PAYROLL_CSV_COLUMNS } from "./payroll-csv.helpers";

type TimesheetRow = {
  id: string;
  status: "APPROVED";
  date: Date;
  hoursWorked: Prisma.Decimal;
  description: string | null;
  workerProfile: { id: string; firstName: string; lastName: string };
  project: { projectNumber: string };
};

type FindManyArgs = { where: { status: string; date: { gte: Date; lte: Date } } };

function buildService(rows: TimesheetRow[]) {
  const findMany = jest.fn((_args: FindManyArgs) => Promise.resolve(rows));
  const prisma = { timesheet: { findMany } };
  const notifications = {};
  const service = new FieldService(prisma as never, notifications as never);
  return { service, findMany };
}

function ts(overrides: Partial<TimesheetRow> & { id: string }): TimesheetRow {
  return {
    status: "APPROVED",
    date: new Date("2026-05-01T00:00:00.000Z"),
    hoursWorked: new Prisma.Decimal("8"),
    description: null,
    workerProfile: { id: "wp-default", firstName: "Default", lastName: "Worker" },
    project: { projectNumber: "P-2026-001" },
    ...overrides
  };
}

describe("FieldService.getPayrollExportCsv (§7 payroll export)", () => {
  const HEADER = PAYROLL_CSV_COLUMNS.join(",");

  it("returns header-only CSV when no timesheets match", async () => {
    const { service } = buildService([]);
    const csv = await service.getPayrollExportCsv({ from: "2026-05-01", to: "2026-05-07" });
    expect(csv).toBe(`${HEADER}\r\n`);
  });

  it("queries only APPROVED rows within the inclusive date range", async () => {
    const { service, findMany } = buildService([]);
    await service.getPayrollExportCsv({ from: "2026-05-01", to: "2026-05-07" });
    expect(findMany).toHaveBeenCalledTimes(1);
    const where = findMany.mock.calls[0]![0].where;
    expect(where.status).toBe("APPROVED");
    expect(where.date.gte).toEqual(new Date("2026-05-01T00:00:00.000Z"));
    // Upper bound is end-of-day so single-day queries still hit timesheets
    // stored at UTC midnight on that date.
    expect(where.date.lte).toEqual(new Date("2026-05-07T23:59:59.999Z"));
  });

  it("sorts by worker_name ASC then date ASC", async () => {
    const { service } = buildService([
      ts({
        id: "t-3",
        date: new Date("2026-05-03T00:00:00.000Z"),
        workerProfile: { id: "wp-b", firstName: "Bob", lastName: "Carter" }
      }),
      ts({
        id: "t-1",
        date: new Date("2026-05-02T00:00:00.000Z"),
        workerProfile: { id: "wp-a", firstName: "Alice", lastName: "Worker" }
      }),
      ts({
        id: "t-2",
        date: new Date("2026-05-01T00:00:00.000Z"),
        workerProfile: { id: "wp-a", firstName: "Alice", lastName: "Worker" }
      })
    ]);
    const csv = await service.getPayrollExportCsv({ from: "2026-05-01", to: "2026-05-07" });
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(HEADER);
    // Alice 05-01, Alice 05-02, then Bob 05-03.
    expect(lines[1].startsWith("Alice Worker,wp-a,2026-05-01,")).toBe(true);
    expect(lines[2].startsWith("Alice Worker,wp-a,2026-05-02,")).toBe(true);
    expect(lines[3].startsWith("Bob Carter,wp-b,2026-05-03,")).toBe(true);
  });

  it("escapes worker names that contain commas or quotes", async () => {
    const { service } = buildService([
      ts({
        id: "t-1",
        workerProfile: { id: "wp-1", firstName: 'Slim "Jim"', lastName: "Smith, Jr" }
      })
    ]);
    const csv = await service.getPayrollExportCsv({ from: "2026-05-01", to: "2026-05-01" });
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine.startsWith('"Slim ""Jim"" Smith, Jr",wp-1,')).toBe(true);
  });

  it("truncates description at 200 chars before writing", async () => {
    const longNote = "x".repeat(250);
    const { service } = buildService([ts({ id: "t-1", description: longNote })]);
    const csv = await service.getPayrollExportCsv({ from: "2026-05-01", to: "2026-05-01" });
    const dataLine = csv.split("\r\n")[1];
    // 200 x's, comma-prefixed (last field, no trailing delimiter).
    expect(dataLine.endsWith("," + "x".repeat(200))).toBe(true);
  });

  it("throws BadRequest when from is after to", async () => {
    const { service, findMany } = buildService([]);
    await expect(
      service.getPayrollExportCsv({ from: "2026-05-10", to: "2026-05-01" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("throws BadRequest when from / to parse to NaN", async () => {
    const { service, findMany } = buildService([]);
    await expect(
      service.getPayrollExportCsv({ from: "not-a-date", to: "2026-05-01" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
