import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { UserDashboardsService } from "./user-dashboards.service";

const OWNER = "user-1";

function makeService(overrides: {
  findUnique?: jest.Mock;
  findFirst?: jest.Mock;
  delete?: jest.Mock;
  update?: jest.Mock;
  create?: jest.Mock;
}) {
  const prisma = {
    userDashboard: {
      findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue(null),
      findFirst: overrides.findFirst ?? jest.fn().mockResolvedValue(null),
      delete: overrides.delete ?? jest.fn().mockResolvedValue(undefined),
      update: overrides.update ?? jest.fn().mockResolvedValue(undefined),
      create: overrides.create ?? jest.fn().mockResolvedValue(undefined)
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

describe("UserDashboardsService.update — system dashboard rename guard", () => {
  const NON_ADMIN = { sub: OWNER, permissions: ["dashboards.view"], isSuperUser: false };
  const ADMIN = { sub: OWNER, permissions: ["platform.admin"], isSuperUser: false };

  it("allows an admin to rename a system dashboard", async () => {
    const record = dashboard({ isSystem: true });
    const update = jest.fn().mockResolvedValue({ ...record, name: "Ops (renamed)" });
    const { service, audit } = makeService({
      findUnique: jest.fn().mockResolvedValue(record),
      update
    });

    const result = await service.update(ADMIN, "dash-1", { name: "Ops (renamed)" });

    expect(result.name).toBe("Ops (renamed)");
    expect(update).toHaveBeenCalledWith({ where: { id: "dash-1" }, data: { name: "Ops (renamed)" } });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "userDashboards.update", entityId: "dash-1" })
    );
  });

  it("allows a super user to rename a system dashboard", async () => {
    const record = dashboard({ isSystem: true });
    const update = jest.fn().mockResolvedValue({ ...record, name: "Renamed" });
    const { service } = makeService({
      findUnique: jest.fn().mockResolvedValue(record),
      update
    });

    await service.update({ sub: OWNER, isSuperUser: true }, "dash-1", { name: "Renamed" });
    expect(update).toHaveBeenCalled();
  });

  it("rejects a non-admin rename of a system dashboard (403) without touching the row", async () => {
    const update = jest.fn();
    const { service, audit } = makeService({
      findUnique: jest.fn().mockResolvedValue(dashboard({ isSystem: true })),
      update
    });

    await expect(
      service.update(NON_ADMIN, "dash-1", { name: "Hijacked" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  it("still lets a non-admin owner update config on a system dashboard", async () => {
    const record = dashboard({ isSystem: true });
    const nextConfig = { period: "7d", widgets: [] };
    const update = jest.fn().mockResolvedValue({ ...record, config: nextConfig });
    const { service } = makeService({
      findUnique: jest.fn().mockResolvedValue(record),
      update
    });

    await service.update(NON_ADMIN, "dash-1", { config: nextConfig as never });
    expect(update).toHaveBeenCalledWith({ where: { id: "dash-1" }, data: { config: nextConfig } });
  });

  it("lets a non-admin rename their own custom dashboard", async () => {
    const record = dashboard({ isSystem: false });
    const update = jest.fn().mockResolvedValue({ ...record, name: "Mine" });
    const { service } = makeService({
      findUnique: jest.fn().mockResolvedValue(record),
      update
    });

    await service.update(NON_ADMIN, "dash-1", { name: "Mine" });
    expect(update).toHaveBeenCalledWith({ where: { id: "dash-1" }, data: { name: "Mine" } });
  });
});

describe("UserDashboardsService.create — copy-from clones become custom dashboards", () => {
  it("always creates with isSystem: false, preserving the copied widget config", async () => {
    const copiedConfig = {
      period: "30d" as const,
      widgets: [
        { id: "ops_active_jobs_kpi-default", type: "ops_active_jobs_kpi", visible: true, order: 0, config: { period: null, filters: {} } }
      ]
    };
    const create = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "dash-new", ...data }));
    const { service } = makeService({ create });

    const result = await service.create(OWNER, {
      name: "Operations copy",
      slug: "custom",
      config: copiedConfig
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: OWNER,
        name: "Operations copy",
        slug: "custom",
        isSystem: false,
        isDefault: false,
        config: copiedConfig
      })
    });
    expect(result.isSystem).toBe(false);
    expect(result.config).toEqual(copiedConfig);
  });
});
