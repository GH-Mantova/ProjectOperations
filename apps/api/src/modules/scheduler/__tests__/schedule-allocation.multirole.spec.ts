import { Prisma, PrismaClient } from "@prisma/client";

/**
 * B-P0a-1 — multi-role guard regression (locked decision, design section 5).
 *
 * `schedule_alloc_worker_uniq` is `@@unique([date, projectId, workerProfileId, jobRoleId])`.
 * Because `jobRoleId` is part of the key, one worker may hold two different
 * JobRoles on the same project on the same day. This spec locks that in: any
 * future migration that narrows the key to (date, projectId, workerProfileId)
 * fails here before it can ship.
 *
 * Runs against the real test database — serial suite only.
 */

jest.setTimeout(60_000);

const DAY = new Date("2026-07-20T00:00:00.000Z");

describe("ScheduleAllocation multi-role guard (schedule_alloc_worker_uniq)", () => {
  const prisma = new PrismaClient();

  let projectId: string;
  let workerProfileId: string;
  let roleAId: string;
  let roleBId: string;
  let userId: string;
  let clientId: string;

  async function cleanup(): Promise<void> {
    await prisma.scheduleAllocation.deleteMany({
      where: { project: { projectNumber: "ZZTEST-BP0A1-P1" } }
    });
    await prisma.project.deleteMany({ where: { projectNumber: "ZZTEST-BP0A1-P1" } });
    await prisma.site.deleteMany({ where: { name: "ZZTEST-BP0A1 Site" } });
    await prisma.workerProfile.deleteMany({ where: { lastName: "ZZTEST-BP0A1" } });
    await prisma.jobRole.deleteMany({ where: { name: { startsWith: "ZZTEST-BP0A1-" } } });
    await prisma.client.deleteMany({ where: { name: "ZZTEST-BP0A1 Client" } });
    await prisma.user.deleteMany({ where: { email: "zztest-bp0a1@projectops.local" } });
  }

  beforeAll(async () => {
    await cleanup();

    const user = await prisma.user.create({
      data: {
        email: "zztest-bp0a1@projectops.local",
        firstName: "ZZTEST",
        lastName: "ZZTEST-BP0A1",
        passwordHash: "not-a-login"
      }
    });
    userId = user.id;

    const client = await prisma.client.create({
      data: { name: "ZZTEST-BP0A1 Client" }
    });
    clientId = client.id;

    const site = await prisma.site.create({
      data: { name: "ZZTEST-BP0A1 Site", clientId }
    });

    const project = await prisma.project.create({
      data: {
        projectNumber: "ZZTEST-BP0A1-P1",
        name: "ZZTEST-BP0A1 Multi-role guard project",
        clientId,
        siteId: site.id,
        siteAddressLine1: "1 Test St",
        siteAddressSuburb: "Brisbane",
        siteAddressState: "QLD",
        siteAddressPostcode: "4000",
        estimateSnapshot: {},
        createdById: userId
      }
    });
    projectId = project.id;

    const worker = await prisma.workerProfile.create({
      data: { firstName: "ZZTEST", lastName: "ZZTEST-BP0A1", role: "Operator" }
    });
    workerProfileId = worker.id;

    const roleA = await prisma.jobRole.create({ data: { name: "ZZTEST-BP0A1-Role-A" } });
    const roleB = await prisma.jobRole.create({ data: { name: "ZZTEST-BP0A1-Role-B" } });
    roleAId = roleA.id;
    roleBId = roleB.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("allows the same worker two DIFFERENT JobRoles on the same project + day", async () => {
    const first = await prisma.scheduleAllocation.create({
      data: {
        date: DAY,
        projectId,
        targetType: "WORKER",
        workerProfileId,
        jobRoleId: roleAId,
        createdById: userId
      }
    });
    const second = await prisma.scheduleAllocation.create({
      data: {
        date: DAY,
        projectId,
        targetType: "WORKER",
        workerProfileId,
        jobRoleId: roleBId,
        createdById: userId
      }
    });

    expect(first.id).toBeTruthy();
    expect(second.id).toBeTruthy();
    expect(first.id).not.toBe(second.id);
  });

  it("rejects an exact duplicate of (date, projectId, workerProfileId, jobRoleId) with P2002", async () => {
    let caught: unknown;
    try {
      await prisma.scheduleAllocation.create({
        data: {
          date: DAY,
          projectId,
          targetType: "WORKER",
          workerProfileId,
          jobRoleId: roleAId,
          createdById: userId
        }
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    const known = caught as Prisma.PrismaClientKnownRequestError;
    expect(known.code).toBe("P2002");
  });
});
