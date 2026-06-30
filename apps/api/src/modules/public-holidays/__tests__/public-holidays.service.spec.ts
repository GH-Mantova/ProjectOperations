import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PublicHolidaysService } from "../public-holidays.service";

type Row = { id: string; date: Date; name: string; region: string };

function buildService() {
  const rows: Row[] = [];
  let counter = 0;
  const prisma = {
    publicHoliday: {
      findMany: jest.fn(async ({ where }: { where: any }) => {
        return rows
          .filter((r) => r.region === where.region)
          .filter((r) => {
            if (!where.date) return true;
            const gte = where.date.gte ? r.date >= where.date.gte : true;
            const lte = where.date.lte ? r.date <= where.date.lte : true;
            return gte && lte;
          })
          .sort((a, b) => a.date.getTime() - b.date.getTime());
      }),
      create: jest.fn(async ({ data }: { data: Omit<Row, "id"> }) => {
        if (rows.some((r) => r.region === data.region && r.date.getTime() === data.date.getTime())) {
          throw new Prisma.PrismaClientKnownRequestError("dup", {
            code: "P2002",
            clientVersion: "test"
          });
        }
        const row: Row = { id: `ph-${++counter}`, ...data };
        rows.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) =>
        rows.find((r) => r.id === id) ?? null
      ),
      delete: jest.fn(async ({ where: { id } }: { where: { id: string } }) => {
        const idx = rows.findIndex((r) => r.id === id);
        if (idx < 0) throw new Error("not found");
        const [removed] = rows.splice(idx, 1);
        return removed;
      })
    }
  };
  return { service: new PublicHolidaysService(prisma as never), rows };
}

describe("PublicHolidaysService.list", () => {
  it("filters by region and date window, sorted ascending", async () => {
    const { service } = buildService();
    await service.create({ date: "2026-01-01", name: "NYD", region: "QLD" });
    await service.create({ date: "2026-04-25", name: "Anzac", region: "QLD" });
    await service.create({ date: "2026-08-12", name: "Brisbane Show", region: "BRISBANE" });

    const qld = await service.list({ region: "QLD", from: "2026-01-01", to: "2026-06-30" });
    expect(qld.map((r) => r.name)).toEqual(["NYD", "Anzac"]);

    const brisbane = await service.list({ region: "brisbane" });
    expect(brisbane.map((r) => r.name)).toEqual(["Brisbane Show"]);
  });

  it("defaults region to QLD when omitted", async () => {
    const { service } = buildService();
    await service.create({ date: "2026-01-01", name: "NYD" });
    const rows = await service.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].region).toBe("QLD");
  });

  it("rejects malformed date bounds", async () => {
    const { service } = buildService();
    await expect(service.list({ from: "01/01/2026" })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("PublicHolidaysService.create", () => {
  it("requires a name", async () => {
    const { service } = buildService();
    await expect(service.create({ date: "2026-01-01", name: "   " })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("rejects duplicates on (date, region)", async () => {
    const { service } = buildService();
    await service.create({ date: "2026-01-01", name: "NYD" });
    await expect(
      service.create({ date: "2026-01-01", name: "NYD again" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("normalises region to upper case", async () => {
    const { service } = buildService();
    const row = await service.create({ date: "2026-01-01", name: "NYD", region: "qld" });
    expect(row.region).toBe("QLD");
  });
});

describe("PublicHolidaysService.remove", () => {
  it("throws NotFound for an unknown id", async () => {
    const { service } = buildService();
    await expect(service.remove("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("removes an existing row", async () => {
    const { service, rows } = buildService();
    const row = await service.create({ date: "2026-01-01", name: "NYD" });
    await service.remove(row.id);
    expect(rows).toHaveLength(0);
  });
});
