import { PrismaClient } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { JpmService } from "../jpm.service";

/**
 * Job/Project merge Phase A — additive links + backfill.
 *
 * Serial DB spec. Asserts:
 *  1. The backfill links tender-matched (Job, Project) pairs.
 *  2. Jobs / Projects with no counterpart stay NULL (true orphans).
 *  3. The backfill is idempotent — running twice produces the same links
 *     and no duplicate work.
 *  4. The reconciliation report separates linked / orphan-job / orphan-project
 *     counts for the seeded fixtures.
 */
jest.setTimeout(60_000);

describe("Job/Project merge Phase A — backfill + reconciliation", () => {
  const prisma = new PrismaClient();
  const service = new JpmService(prisma as unknown as PrismaService);

  const TENDER_A = "ZZTEST-JPMA-TA";
  const TENDER_B = "ZZTEST-JPMA-TB";
  const TENDER_C = "ZZTEST-JPMA-TC";

  let clientId: string;
  let userId: string;
  let tenderAId: string;
  let tenderBId: string;
  let tenderCId: string;

  async function cleanup(): Promise<void> {
    await prisma.job.deleteMany({ where: { jobNumber: { startsWith: "ZZTEST-JPMA-" } } });
    await prisma.project.deleteMany({ where: { projectNumber: { startsWith: "ZZTEST-JPMA-" } } });
    await prisma.tender.deleteMany({ where: { tenderNumber: { startsWith: "ZZTEST-JPMA-" } } });
    await prisma.client.deleteMany({ where: { name: "ZZTEST-JPMA Client" } });
    await prisma.user.deleteMany({ where: { email: "zztest-jpma@projectops.local" } });
  }

  beforeAll(async () => {
    await cleanup();

    const user = await prisma.user.create({
      data: {
        email: "zztest-jpma@projectops.local",
        firstName: "ZZTEST",
        lastName: "JPMA",
        passwordHash: "not-a-login"
      }
    });
    userId = user.id;

    const client = await prisma.client.create({ data: { name: "ZZTEST-JPMA Client" } });
    clientId = client.id;

    const [tA, tB, tC] = await Promise.all([
      prisma.tender.create({ data: { tenderNumber: TENDER_A, title: "ZZTEST-JPMA A", siteId: "site-unassigned" } }),
      prisma.tender.create({ data: { tenderNumber: TENDER_B, title: "ZZTEST-JPMA B", siteId: "site-unassigned" } }),
      prisma.tender.create({ data: { tenderNumber: TENDER_C, title: "ZZTEST-JPMA C", siteId: "site-unassigned" } })
    ]);
    tenderAId = tA.id;
    tenderBId = tB.id;
    tenderCId = tC.id;

    // Pair: Job + Project both from tender A -> should link.
    await prisma.job.create({
      data: { jobNumber: "ZZTEST-JPMA-J1", name: "J1", clientId, sourceTenderId: tenderAId }
    });
    await prisma.project.create({
      data: {
        projectNumber: "ZZTEST-JPMA-P1",
        name: "P1",
        clientId,
        sourceTenderId: tenderAId,
        siteAddressLine1: "",
        siteAddressSuburb: "",
        siteAddressState: "",
        siteAddressPostcode: "",
        estimateSnapshot: {},
        createdById: userId
      }
    });

    // Orphan job (tender B has a job but no project) -> stays NULL.
    await prisma.job.create({
      data: { jobNumber: "ZZTEST-JPMA-J2", name: "J2", clientId, sourceTenderId: tenderBId }
    });

    // Orphan project (tender C has a project but no job) -> stays NULL.
    await prisma.project.create({
      data: {
        projectNumber: "ZZTEST-JPMA-P2",
        name: "P2",
        clientId,
        sourceTenderId: tenderCId,
        siteAddressLine1: "",
        siteAddressSuburb: "",
        siteAddressState: "",
        siteAddressPostcode: "",
        estimateSnapshot: {},
        createdById: userId
      }
    });

    // Null out any links the deploy migration may have set on the seeded rows.
    await prisma.job.updateMany({
      where: { jobNumber: { startsWith: "ZZTEST-JPMA-" } },
      data: { survivingProjectId: null }
    });
    await prisma.project.updateMany({
      where: { projectNumber: { startsWith: "ZZTEST-JPMA-" } },
      data: { sourceJobId: null }
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("links tender-matched pairs and leaves orphans null", async () => {
    const result = await service.backfillLinks();

    const j1 = await prisma.job.findUnique({ where: { jobNumber: "ZZTEST-JPMA-J1" } });
    const j2 = await prisma.job.findUnique({ where: { jobNumber: "ZZTEST-JPMA-J2" } });
    const p1 = await prisma.project.findUnique({ where: { projectNumber: "ZZTEST-JPMA-P1" } });
    const p2 = await prisma.project.findUnique({ where: { projectNumber: "ZZTEST-JPMA-P2" } });

    expect(j1?.survivingProjectId).toBe(p1?.id);
    expect(p1?.sourceJobId).toBe(j1?.id);
    expect(j2?.survivingProjectId).toBeNull();
    expect(p2?.sourceJobId).toBeNull();
    expect(result.linked).toBeGreaterThanOrEqual(1);
  });

  it("is idempotent — second run does not change the linkage", async () => {
    const before = await service.buildReconciliationReport();
    const second = await service.backfillLinks();
    const after = await service.buildReconciliationReport();

    expect(after.linkedPairs).toBe(before.linkedPairs);
    expect(after.orphanJobs).toBe(before.orphanJobs);
    expect(after.orphanProjects).toBe(before.orphanProjects);
    expect(second.linked).toBe(before.linkedPairs);
  });

  it("reconciliation report exposes coverage counts", async () => {
    const report = await service.buildReconciliationReport();
    expect(report.linkedPairs).toBeGreaterThanOrEqual(1);
    expect(report.jobsTotal).toBeGreaterThanOrEqual(2);
    expect(report.projectsTotal).toBeGreaterThanOrEqual(2);
    expect(typeof report.generatedAt).toBe("string");
  });
});
