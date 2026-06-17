import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PilotFeedbackService } from "../pilot-feedback.service";

type Row = {
  id: string;
  userId: string;
  route: string;
  category: string;
  message: string;
  status: string;
  createdAt: Date;
};

function buildService() {
  const rows: Row[] = [];
  const prisma = {
    pilotFeedback: {
      create: jest.fn(async ({ data }: { data: Omit<Row, "id" | "createdAt"> }) => {
        const row: Row = {
          id: `pf-${rows.length + 1}`,
          createdAt: new Date("2026-06-16T00:00:00Z"),
          ...data,
          status: data.status ?? "new"
        };
        rows.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) =>
        rows.find((r) => r.id === id) ?? null
      ),
      update: jest.fn(
        async ({ where: { id }, data }: { where: { id: string }; data: Partial<Row> }) => {
          const row = rows.find((r) => r.id === id);
          if (!row) throw new Error("not found");
          Object.assign(row, data);
          return row;
        }
      ),
      findMany: jest.fn(async () => rows)
    }
  };
  return { service: new PilotFeedbackService(prisma as never), prisma, rows };
}

describe("PilotFeedbackService.create", () => {
  it("creates a feedback row with trimmed message and defaults status to new", async () => {
    const { service, rows } = buildService();
    const row = await service.create("user-1", {
      route: "/jobs/123",
      category: "bug",
      message: "  toggle does nothing  "
    });
    expect(row.message).toBe("toggle does nothing");
    expect(row.status).toBe("new");
    expect(row.userId).toBe("user-1");
    expect(rows).toHaveLength(1);
  });

  it("rejects an empty message", async () => {
    const { service } = buildService();
    await expect(
      service.create("user-1", { route: "/", category: "idea", message: "   " })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an unknown category", async () => {
    const { service } = buildService();
    await expect(
      service.create("user-1", { route: "/", category: "spam" as never, message: "hi" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("falls back to 'unknown' when route is empty", async () => {
    const { service } = buildService();
    const row = await service.create("user-1", { route: "  ", category: "other", message: "x" });
    expect(row.route).toBe("unknown");
  });
});

describe("PilotFeedbackService.updateStatus", () => {
  it("rejects invalid status values", async () => {
    const { service } = buildService();
    await expect(service.updateStatus("pf-1", "rejected" as never)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("throws NotFound when row is missing", async () => {
    const { service } = buildService();
    await expect(service.updateStatus("missing", "triaged")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("updates the status of an existing row", async () => {
    const { service } = buildService();
    const created = await service.create("user-1", { route: "/", category: "bug", message: "x" });
    const updated = await service.updateStatus(created.id, "done");
    expect(updated.status).toBe("done");
  });
});
