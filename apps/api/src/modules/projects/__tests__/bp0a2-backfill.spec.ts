import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, ProjectStatus } from "@prisma/client";

/**
 * B-P0a-2 — Job -> Project attribute backfill (design doc section 6 row B-P0a-2).
 *
 * Re-executes the statements from migration
 * 20260703071228_bp0a2_backfill_job_attributes against the test database and
 * asserts:
 *  - tender-keyed mapping (shared sourceTenderId) backfills legacyJobId,
 *    jobNumber, status, siteId and the siteAddress* columns,
 *  - client + lower(name) mapping covers tender-less Jobs,
 *  - a Project whose status has already progressed past MOBILISING is never
 *    clobbered,
 *  - a second run is a no-op (idempotent).
 *
 * Runs against the real test database — serial suite only.
 */

jest.setTimeout(60_000);

const MIGRATION_SQL_PATH = join(
  __dirname,
  "../../../../prisma/migrations/20260703071228_bp0a2_backfill_job_attributes/migration.sql"
);

function loadStatements(): string[] {
  const sql = readFileSync(MIGRATION_SQL_PATH, "utf8");
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  return withoutComments
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

describe("B-P0a-2 backfill — Job attributes onto Project", () => {
  const prisma = new PrismaClient();

  let siteId: string;
  let jobA: { id: string; jobNumber: string };
  let jobB: { id: string; jobNumber: string };
  let jobC: { id: string; jobNumber: string };
  let projectAId: string;
  let projectBId: string;
  let projectCId: string;

  // The temp table is ON COMMIT DROP, so all statements must share one
  // transaction — exactly how Prisma applies the migration itself.
  async function runBackfill(): Promise<number[]> {
    const statements = loadStatements();
    return prisma.$transaction(statements.map((stmt) => prisma.$executeRawUnsafe(stmt)));
  }

  async function cleanup(): Promise<void> {
    // ProjectActivityLog rows cascade with their Project.
    await prisma.project.deleteMany({ where: { projectNumber: { startsWith: "ZZTEST-BP0A2-" } } });
    await prisma.job.deleteMany({ where: { jobNumber: { startsWith: "ZZTEST-BP0A2-" } } });
    await prisma.tender.deleteMany({ where: { tenderNumber: { startsWith: "ZZTEST-BP0A2-" } } });
    await prisma.site.deleteMany({ where: { name: "ZZTEST-BP0A2 Site" } });
    await prisma.client.deleteMany({ where: { name: "ZZTEST-BP0A2 Client" } });
    await prisma.user.deleteMany({ where: { email: "zztest-bp0a2@projectops.local" } });
  }

  beforeAll(async () => {
    await cleanup();

    const user = await prisma.user.create({
      data: {
        email: "zztest-bp0a2@projectops.local",
        firstName: "ZZTEST",
        lastName: "ZZTEST-BP0A2",
        passwordHash: "not-a-login"
      }
    });

    const client = await prisma.client.create({ data: { name: "ZZTEST-BP0A2 Client" } });

    const site = await prisma.site.create({
      data: {
        name: "ZZTEST-BP0A2 Site",
        clientId: client.id,
        addressLine1: "42 Backfill Rd",
        suburb: "Yatala",
        state: "QLD",
        postcode: "4207"
      }
    });
    siteId = site.id;

    const tenderA = await prisma.tender.create({
      data: { tenderNumber: "ZZTEST-BP0A2-T1", title: "ZZTEST-BP0A2 tender A" }
    });
    const tenderC = await prisma.tender.create({
      data: { tenderNumber: "ZZTEST-BP0A2-T2", title: "ZZTEST-BP0A2 tender C" }
    });

    // Pair A — mapped via shared sourceTenderId; carries a Site; ACTIVE status.
    jobA = await prisma.job.create({
      data: {
        jobNumber: "ZZTEST-BP0A2-J1",
        name: "ZZTEST-BP0A2 Job A",
        clientId: client.id,
        siteId: site.id,
        sourceTenderId: tenderA.id,
        status: "ACTIVE"
      }
    });
    const projectA = await prisma.project.create({
      data: {
        projectNumber: "ZZTEST-BP0A2-P1",
        name: "ZZTEST-BP0A2 Project A",
        clientId: client.id,
        sourceTenderId: tenderA.id,
        siteAddressLine1: "",
        siteAddressSuburb: "",
        siteAddressState: "",
        siteAddressPostcode: "",
        estimateSnapshot: {},
        createdById: user.id
      }
    });
    projectAId = projectA.id;

    // Pair B — tender-less Job mapped on (clientId, lower(name)); COMPLETE status.
    jobB = await prisma.job.create({
      data: {
        jobNumber: "ZZTEST-BP0A2-J2",
        name: "ZZTEST-BP0A2 Name Match",
        clientId: client.id,
        status: "COMPLETE"
      }
    });
    const projectB = await prisma.project.create({
      data: {
        projectNumber: "ZZTEST-BP0A2-P2",
        name: "zztest-bp0a2 NAME match",
        clientId: client.id,
        siteAddressLine1: "7 Existing St",
        siteAddressSuburb: "Beenleigh",
        siteAddressState: "QLD",
        siteAddressPostcode: "4207",
        estimateSnapshot: {},
        createdById: user.id
      }
    });
    projectBId = projectB.id;

    // Pair C — mapped via tender, but the Project has already progressed to
    // ACTIVE. Its status must never be clobbered by the COMPLETE -> CLOSED map.
    jobC = await prisma.job.create({
      data: {
        jobNumber: "ZZTEST-BP0A2-J3",
        name: "ZZTEST-BP0A2 Job C",
        clientId: client.id,
        sourceTenderId: tenderC.id,
        status: "COMPLETE"
      }
    });
    const projectC = await prisma.project.create({
      data: {
        projectNumber: "ZZTEST-BP0A2-P3",
        name: "ZZTEST-BP0A2 Project C",
        clientId: client.id,
        sourceTenderId: tenderC.id,
        status: ProjectStatus.ACTIVE,
        siteAddressLine1: "9 Progressed Ave",
        siteAddressSuburb: "Ormeau",
        siteAddressState: "QLD",
        siteAddressPostcode: "4208",
        estimateSnapshot: {},
        createdById: user.id
      }
    });
    projectCId = projectC.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("backfills jobNumber, legacyJobId, status, siteId and address via the tender map", async () => {
    await runBackfill();

    const projectA = await prisma.project.findUniqueOrThrow({ where: { id: projectAId } });
    expect(projectA.legacyJobId).toBe(jobA.id);
    expect(projectA.jobNumber).toBe(jobA.jobNumber);
    expect(projectA.status).toBe(ProjectStatus.ACTIVE);
    expect(projectA.siteId).toBe(siteId);
    expect(projectA.siteAddressLine1).toBe("42 Backfill Rd");
    expect(projectA.siteAddressSuburb).toBe("Yatala");
    expect(projectA.siteAddressState).toBe("QLD");
    expect(projectA.siteAddressPostcode).toBe("4207");
  });

  it("maps tender-less Jobs on client + case-insensitive name, COMPLETE -> CLOSED", async () => {
    const projectB = await prisma.project.findUniqueOrThrow({ where: { id: projectBId } });
    expect(projectB.legacyJobId).toBe(jobB.id);
    expect(projectB.jobNumber).toBe(jobB.jobNumber);
    expect(projectB.status).toBe(ProjectStatus.CLOSED);
    // No Site on Job B — existing (non-empty) address data untouched.
    expect(projectB.siteId).toBeNull();
    expect(projectB.siteAddressLine1).toBe("7 Existing St");
  });

  it("never clobbers a Project whose status has progressed past MOBILISING", async () => {
    const projectC = await prisma.project.findUniqueOrThrow({ where: { id: projectCId } });
    expect(projectC.legacyJobId).toBe(jobC.id);
    expect(projectC.jobNumber).toBe(jobC.jobNumber);
    // Job C is COMPLETE (-> CLOSED), but Project C had already progressed.
    expect(projectC.status).toBe(ProjectStatus.ACTIVE);
  });

  it("is idempotent — a second run touches zero rows", async () => {
    const before = await Promise.all([
      prisma.project.findUniqueOrThrow({ where: { id: projectAId } }),
      prisma.project.findUniqueOrThrow({ where: { id: projectBId } }),
      prisma.project.findUniqueOrThrow({ where: { id: projectCId } }),
      prisma.projectActivityLog.count()
    ]);

    const affected = await runBackfill();
    // Index 0 is the CREATE TEMP TABLE map build; every data statement after
    // it must report zero affected rows on the second pass.
    expect(affected.slice(1)).toEqual(affected.slice(1).map(() => 0));

    const after = await Promise.all([
      prisma.project.findUniqueOrThrow({ where: { id: projectAId } }),
      prisma.project.findUniqueOrThrow({ where: { id: projectBId } }),
      prisma.project.findUniqueOrThrow({ where: { id: projectCId } }),
      prisma.projectActivityLog.count()
    ]);
    expect(after).toEqual(before);
  });
});
