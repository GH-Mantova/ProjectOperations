import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ContactsService } from "./contacts.service";

type TxFn = <T>(cb: (tx: Record<string, unknown>) => Promise<T>) => Promise<T>;

function buildPrismaMock(overrides: {
  clientExists?: boolean;
  subcontractorExists?: boolean;
  existingContact?: Record<string, unknown> | null;
  contactList?: Array<Record<string, unknown>>;
  updateManyFn?: jest.Mock;
  createFn?: jest.Mock;
  updateFn?: jest.Mock;
}) {
  const updateMany = overrides.updateManyFn ?? jest.fn().mockResolvedValue({ count: 0 });
  const create =
    overrides.createFn ??
    jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "new-id",
      ...data
    }));
  const update =
    overrides.updateFn ??
    jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
      id: where.id,
      ...(overrides.existingContact ?? {}),
      ...data
    }));
  const findUnique = jest.fn(async ({ where }: { where: { id: string } }) => {
    if (overrides.existingContact === null) return null;
    if (overrides.existingContact) return { id: where.id, ...overrides.existingContact };
    return null;
  });
  const findMany = jest.fn().mockResolvedValue(overrides.contactList ?? []);
  const count = jest.fn().mockResolvedValue(overrides.contactList?.length ?? 0);

  const contact = { create, update, updateMany, findUnique, findMany, count };
  const prisma = {
    contact,
    client: {
      findUnique: jest.fn(async () => (overrides.clientExists === false ? null : { id: "client-1" }))
    },
    subcontractorSupplier: {
      findUnique: jest.fn(async () =>
        overrides.subcontractorExists === false ? null : { id: "sub-1" }
      )
    },
    $transaction: (fnOrOps: unknown) => {
      if (typeof fnOrOps === "function") return (fnOrOps as TxFn)(prisma as never);
      return Promise.all(fnOrOps as Promise<unknown>[]);
    }
  } as never;
  return { prisma, mocks: { create, update, updateMany } };
}

describe("ContactsService", () => {
  it("creates a CLIENT contact and unsets prior primary when isPrimary=true", async () => {
    const { prisma, mocks } = buildPrismaMock({ clientExists: true });
    const service = new ContactsService(prisma);
    await service.create(
      {
        organisationType: "CLIENT",
        organisationId: "client-1",
        firstName: "Cameron",
        lastName: "Blake",
        isPrimary: true
      },
      "actor-1"
    );
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { organisationType: "CLIENT", organisationId: "client-1", isPrimary: true },
      data: { isPrimary: false }
    });
    expect(mocks.create).toHaveBeenCalled();
  });

  it("creates a SUBCONTRACTOR contact against a valid directory entry", async () => {
    const { prisma, mocks } = buildPrismaMock({ subcontractorExists: true });
    const service = new ContactsService(prisma);
    await service.create(
      {
        organisationType: "SUBCONTRACTOR",
        organisationId: "sub-1",
        firstName: "Dan",
        lastName: "Carter"
      },
      "actor-1"
    );
    expect(mocks.create).toHaveBeenCalled();
  });

  it("rejects an invalid organisationId with NotFound", async () => {
    const { prisma } = buildPrismaMock({ clientExists: false });
    const service = new ContactsService(prisma);
    await expect(
      service.create({
        organisationType: "CLIENT",
        organisationId: "missing",
        firstName: "A",
        lastName: "B"
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects unknown organisationType with BadRequest", async () => {
    const { prisma } = buildPrismaMock({});
    const service = new ContactsService(prisma);
    await expect(
      service.create({
        organisationType: "PLATYPUS",
        organisationId: "x",
        firstName: "A",
        lastName: "B"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("soft-deletes by setting isActive=false", async () => {
    const { prisma, mocks } = buildPrismaMock({ existingContact: { isActive: true } });
    const service = new ContactsService(prisma);
    const result = await service.softDelete("contact-1");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "contact-1" },
      data: { isActive: false }
    });
    expect(result.isActive).toBe(false);
  });

  it("list filters by organisationType + organisationId", async () => {
    const { prisma } = buildPrismaMock({
      contactList: [
        { id: "c1", organisationType: "CLIENT", organisationId: "client-1", firstName: "A", lastName: "B" }
      ]
    });
    const service = new ContactsService(prisma);
    const result = await service.list({ organisationType: "CLIENT", organisationId: "client-1" });
    expect(result.items).toHaveLength(1);
    expect((prisma as never as { contact: { findMany: jest.Mock } }).contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organisationType: "CLIENT",
          organisationId: "client-1"
        })
      })
    );
  });
});
