import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { JobRolesService } from "../job-roles.service";

type MockPrisma = {
  jobRole: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  jobRoleRequirement: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
  };
  competency: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): MockPrisma {
  const prisma: MockPrisma = {
    jobRole: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({})
    },
    jobRoleRequirement: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    competency: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn()
  };
  prisma.$transaction.mockImplementation(async (cb: (tx: MockPrisma) => unknown) => cb(prisma));
  return prisma;
}

function makeService(prisma: MockPrisma) {
  return new JobRolesService(prisma as never);
}

describe("JobRolesService", () => {
  test("list returns roles ordered with requirements included", async () => {
    const prisma = makePrisma();
    prisma.jobRole.findMany.mockResolvedValue([{ id: "r-1", requirements: [] }]);
    const out = await makeService(prisma).list();
    expect(prisma.jobRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
      })
    );
    expect(out).toHaveLength(1);
  });

  test("get throws NotFoundException when missing", async () => {
    const prisma = makePrisma();
    prisma.jobRole.findUnique.mockResolvedValue(null);
    await expect(makeService(prisma).get("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  test("create persists role with requirements", async () => {
    const prisma = makePrisma();
    prisma.competency.findMany.mockResolvedValue([{ id: "c-1" }, { id: "c-2" }]);
    prisma.jobRole.create.mockResolvedValue({ id: "r-new", requirements: [] });
    const result = await makeService(prisma).create({
      name: "Supervisor",
      requirements: [
        { competencyId: "c-1" },
        { competencyId: "c-2", isMandatory: false }
      ]
    });
    expect(prisma.jobRole.create).toHaveBeenCalled();
    const arg = prisma.jobRole.create.mock.calls[0][0];
    expect(arg.data.requirements.create).toHaveLength(2);
    expect(arg.data.requirements.create[0].competency.connect.id).toBe("c-1");
    expect(arg.data.requirements.create[1].isMandatory).toBe(false);
    expect(result.id).toBe("r-new");
  });

  test("create rejects unknown competency id", async () => {
    const prisma = makePrisma();
    prisma.competency.findMany.mockResolvedValue([{ id: "c-1" }]);
    await expect(
      makeService(prisma).create({
        name: "X",
        requirements: [{ competencyId: "c-1" }, { competencyId: "c-missing" }]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.jobRole.create).not.toHaveBeenCalled();
  });

  test("create translates P2002 unique violation to 409", async () => {
    const prisma = makePrisma();
    prisma.competency.findMany.mockResolvedValue([]);
    prisma.jobRole.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "x"
      })
    );
    await expect(makeService(prisma).create({ name: "Dup" })).rejects.toBeInstanceOf(ConflictException);
  });

  test("update with requirements replaces the requirement set", async () => {
    const prisma = makePrisma();
    prisma.jobRole.findUnique.mockResolvedValue({ id: "r-1", requirements: [] });
    prisma.competency.findMany.mockResolvedValue([{ id: "c-9" }]);
    prisma.jobRole.update.mockResolvedValue({ id: "r-1", requirements: [] });
    await makeService(prisma).update("r-1", {
      name: "Updated",
      requirements: [{ competencyId: "c-9" }]
    });
    expect(prisma.jobRoleRequirement.deleteMany).toHaveBeenCalledWith({ where: { jobRoleId: "r-1" } });
    expect(prisma.jobRoleRequirement.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ jobRoleId: "r-1", competencyId: "c-9", isMandatory: true })
      ]
    });
    expect(prisma.jobRole.update).toHaveBeenCalled();
  });

  test("update without requirements field leaves them untouched", async () => {
    const prisma = makePrisma();
    prisma.jobRole.findUnique.mockResolvedValue({ id: "r-1", requirements: [] });
    prisma.jobRole.update.mockResolvedValue({ id: "r-1", requirements: [] });
    await makeService(prisma).update("r-1", { name: "Renamed" });
    expect(prisma.jobRoleRequirement.deleteMany).not.toHaveBeenCalled();
    expect(prisma.jobRoleRequirement.createMany).not.toHaveBeenCalled();
  });

  test("remove returns { deleted: true } and calls prisma.delete", async () => {
    const prisma = makePrisma();
    prisma.jobRole.findUnique.mockResolvedValue({ id: "r-1", requirements: [] });
    await expect(makeService(prisma).remove("r-1")).resolves.toEqual({ deleted: true });
    expect(prisma.jobRole.delete).toHaveBeenCalledWith({ where: { id: "r-1" } });
  });
});
