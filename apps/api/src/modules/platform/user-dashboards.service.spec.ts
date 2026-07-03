import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { UserDashboardsService } from "./user-dashboards.service";

const OWNER = "user-1";

function makeService(overrides: {
  findUnique?: jest.Mock;
  findFirst?: jest.Mock;
  delete?: jest.Mock;
}) {
  const prisma = {
    userDashboard: {
      findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue(null),
      findFirst: overrides.findFirst ?? jest.fn().mockResolvedValue(null),
      delete: overrides.delete ?? jest.fn().mockResolvedValue(undefined)
    }
  };
  const audit = { write: jest.fn().mockResolvedValue(undefined) };
  const service = new UserDashboardsService(prisma as never, audit as never);
  return { service, prisma, audit };
}

function dashboard(partial: Partial<{ id: string; userId: string; isSystem: boolean }>) {
  return {
    id: "dash-1",
    userId: OWNER,
    name: "My dashboard",
    slug: "custom",
    isSystem: false,
    isDefault: false,
    config: { period: "30d", widgets: [] },
    ...partial
  };
}

describe("UserDashboardsService.remove", () => {
  it("deletes a custom dashboard owned by the actor and writes an audit entry", async () => {
    const record = dashboard({ isSystem: false });
    const del = jest.fn().mockResolvedValue(record);
    const { service, prisma, audit } = makeService({
      findUnique: jest.fn().mockResolvedValue(record),
      delete: del
    });

    const result = await service.remove(OWNER, "dash-1");

    expect(result).toEqual({ id: "dash-1" });
    expect(del).toHaveBeenCalledWith({ where: { id: "dash-1" } });
    expect(prisma.userDashboard.findUnique).toHaveBeenCalledWith({ where: { id: "dash-1" } });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: OWNER,
        action: "userDashboards.delete",
        entityType: "UserDashboard",
        entityId: "dash-1"
      })
    );
  });

  it("refuses to delete a system dashboard (403) and never touches the row", async () => {
    const del = jest.fn();
    const { service, audit } = makeService({
      findUnique: jest.fn().mockResolvedValue(dashboard({ isSystem: true })),
      delete: del
    });

    await expect(service.remove(OWNER, "dash-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(del).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown dashboard id", async () => {
    const del = jest.fn();
    const { service } = makeService({
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      delete: del
    });

    await expect(service.remove(OWNER, "missing")).rejects.toBeInstanceOf(NotFoundException);
    expect(del).not.toHaveBeenCalled();
  });

  it("returns 404 when the dashboard belongs to another user", async () => {
    const del = jest.fn();
    const { service } = makeService({
      findUnique: jest.fn().mockResolvedValue(dashboard({ userId: "someone-else" })),
      delete: del
    });

    await expect(service.remove(OWNER, "dash-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(del).not.toHaveBeenCalled();
  });
});
