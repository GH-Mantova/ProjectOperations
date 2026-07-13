import { ConflictException, NotFoundException } from "@nestjs/common";
import { ListBindingsService } from "../list-bindings.service";
import { ListBindingConsumerTypeDto } from "../dto/list-binding.dto";

function makePrisma() {
  return {
    globalList: { findUnique: jest.fn() },
    listBinding: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({})
    }
  };
}

function makeAudit() {
  return { write: jest.fn().mockResolvedValue(undefined) };
}

describe("ListBindingsService", () => {
  test("whereUsed throws when list missing", async () => {
    const prisma = makePrisma();
    prisma.globalList.findUnique.mockResolvedValue(null);
    const svc = new ListBindingsService(prisma as never, makeAudit() as never);
    await expect(svc.whereUsed("nope")).rejects.toBeInstanceOf(NotFoundException);
  });

  test("whereUsed returns bindings with count", async () => {
    const prisma = makePrisma();
    prisma.globalList.findUnique.mockResolvedValue({ id: "l-1", slug: "materials" });
    prisma.listBinding.findMany.mockResolvedValue([
      { id: "b-1", listId: "l-1", consumerType: "RATE_COLUMN", consumerRef: "col-1", label: null }
    ]);
    const svc = new ListBindingsService(prisma as never, makeAudit() as never);
    const out = await svc.whereUsed("l-1");
    expect(out.count).toBe(1);
    expect(out.bindings).toHaveLength(1);
    expect(out.listSlug).toBe("materials");
  });

  test("create surfaces unique-violation as ConflictException", async () => {
    const prisma = makePrisma();
    prisma.globalList.findUnique.mockResolvedValue({ id: "l-1", slug: "materials" });
    prisma.listBinding.create.mockRejectedValue({ code: "P2002" });
    const svc = new ListBindingsService(prisma as never, makeAudit() as never);
    await expect(
      svc.create({
        listId: "l-1",
        consumerType: ListBindingConsumerTypeDto.RATE_COLUMN,
        consumerRef: "col-1"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  test("remove requires an existing binding", async () => {
    const prisma = makePrisma();
    prisma.listBinding.findUnique.mockResolvedValue(null);
    const audit = makeAudit();
    const svc = new ListBindingsService(prisma as never, audit as never);
    await expect(svc.remove("missing", "actor-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.listBinding.delete).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });

  test("remove hard-deletes an existing binding and writes an audit row", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.listBinding.findUnique.mockResolvedValue({
      id: "b-1",
      listId: "l-1",
      consumerType: "RATE_COLUMN",
      consumerRef: "col-1",
      label: "Materials"
    });
    const svc = new ListBindingsService(prisma as never, audit as never);
    await expect(svc.remove("b-1", "actor-1")).resolves.toEqual({ deleted: true });
    expect(prisma.listBinding.delete).toHaveBeenCalledWith({ where: { id: "b-1" } });
    expect(audit.write).toHaveBeenCalledTimes(1);
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "actor-1",
        action: "listBinding.delete",
        entityType: "ListBinding",
        entityId: "b-1",
        metadata: expect.objectContaining({
          listId: "l-1",
          consumerType: "RATE_COLUMN",
          consumerRef: "col-1",
          label: "Materials"
        })
      })
    );
  });
});
