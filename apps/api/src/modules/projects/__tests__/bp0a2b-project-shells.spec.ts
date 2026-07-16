import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, ProjectStatus } from "@prisma/client";

/**
 * B-P0a-2b — Project shells for unmapped Jobs (design doc section 6).
 *
 * Re-executes the statements from migration
 * 20260703104500_bp0a2b_create_project_shells against the test database and
 * asserts:
 *  - a Job with no mapped Project gets a shell carrying its name, client,
 *    tender, site (+ resolved siteAddress*), team, createdAt, jobNumber,
 *    legacyJobId, the -2 status mapping and a continued IS-P number,
 *  - a Job already claimed by a Project (legacyJobId) is skipped,
 *  - a second run is a no-op (idempotent).
 *
 * Runs against the real test database — serial suite only.
 */

jest.setTimeout(60_000);

const MIGRATION_SQL_PATH = join(
  __dirname,
  "../../../../prisma/migrations/20260703104500_bp0a2b_create_project_shells/migration.sql"
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

describe("B-P0a-2b — Project shells for unmapped Jobs", () => {
  const prisma = new PrismaClient();

  let siteId: string;
  let tenderXId: string;
  let jobX: { id: string; jobNumber: string; createdAt: Date };
  let jobY: { id: string };
  let jobZ: { id: string; jobNumber: string };
  let mappedProjectYId: string;

  // The temp table is ON COMMIT DROP, so all statements must share one
  // transaction — exactly how Prisma applies the migration itself.
  async function runShells(): Promise<number[]> {
    const statements = loadStatements();
    return prisma.$transaction(statements.map((stmt) => prisma.$executeRawUnsafe(stmt)));
  }

  async function cleanup(): Promise<void> {
    // Shells inherit the Job's ZZTEST- jobNumber; the pre-mapped fixture
    // Project carries a ZZTEST- projectNumber.
    await prisma.project.deleteMany({ where: { jobNumber: { startsWith: "ZZTEST-BP0A2B-" } } });
    await prisma.project.deleteMany({ where: { projectNumber: { startsWith: "ZZTEST-BP0A2B-" } } });
    await prisma.job.deleteMany({ where: { jobNumber: { startsWith: "ZZTEST-BP0A2B-" } } });
    await prisma.tender.deleteMany({ where: { tenderNumber: { startsWith: "ZZTEST-BP0A2B-" } } });
    await prisma.site.deleteMany({ where: { name: "ZZTEST-BP0A2B Site" } });
    await prisma.client.deleteMany({ where: { name: "ZZTEST-BP0A2B Client" } });
    await prisma.user.deleteMany({ where: { email: "zztest-bp0a2b@projectops.local" } });
  }

  beforeAll(async () => {
    await cleanup();

    const user = await prisma.user.create({
      data: {
        email: "zztest-bp0a2b@projectops.local",
        firstName: "ZZTEST",
        lastName: "ZZTEST-BP0A2B",
        passwordHash: "not-a-login"
      }
    });

    const client = await prisma.client.create({ data: { name: "ZZTEST-BP0A2B Client" } });

    const site = await prisma.site.create({
      data: {
        name: "ZZTEST-BP0A2B Site",
        clientId: client.id,
        addressLine1: "11 Shell Ct",
        suburb: "Yatala",
        state: "QLD",
        postcode: "4207"
      }
    });
    siteId = site.id;

    const tenderX = await prisma.tender.create({
      data: { tenderNumber: "ZZTEST-BP0A2B-T1", title: "ZZTEST-BP0A2B tender X", siteId: site.id }
    });
    tenderXId = tenderX.id;

    // Job X — unmapped, tendered, sited, ACTIVE -> must gain a shell.
    jobX = await prisma.job.create({
      data: {
        jobNumber: "ZZTEST-BP0A2B-J1",
        name: "ZZTEST-BP0A2B Job X",
        clientId: client.id,
        siteId: site.id,
        sourceTenderId: tenderX.id,
        status: "ACTIVE"
      }
    });

    // Job Y — already mapped via legacyJobId -> must be skipped.
    jobY = await prisma.job.create({
      data: {
        jobNumber: "ZZTEST-BP0A2B-J2",
        name: "ZZTEST-BP0A2B Job Y",
        clientId: client.id,
        status: "ACTIVE"
      }
    });
    const mappedProjectY = await prisma.project.create({
      data: {
        projectNumber: "ZZTEST-BP0A2B-P1",
        name: "ZZTEST-BP0A2B Project Y",
        clientId: client.id,
        legacyJobId: jobY.id,
        siteAddressLine1: "",
        siteAddressSuburb: "",
        siteAddressState: "",
        siteAddressPostcode: "",
        estimateSnapshot: {},
        createdById: user.id
      }
    });
    mappedProjectYId = mappedProjectY.id;

    // Job Z — unmapped, tender-less, site-less, PLANNING -> shell with empty
    // address strings and the MOBILISING default mapping.
    jobZ = await prisma.job.create({
      data: {
        jobNumber: "ZZTEST-BP0A2B-J3",
        name: "ZZTEST-BP0A2B Job Z",
        clientId: client.id,
        status: "PLANNING"
      }
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("creates a shell for an unmapped Job with correct fields and a continued IS-P number", async () => {
    await runShells();

    const shell = await prisma.project.findUniqueOrThrow({ where: { legacyJobId: jobX.id } });
    expect(shell.projectNumber).toMatch(/^IS-P\d{3,}$/);
    expect(shell.jobNumber).toBe(jobX.jobNumber);
    expect(shell.name).toBe("ZZTEST-BP0A2B Job X");
    expect(shell.sourceTenderId).toBe(tenderXId);
    expect(shell.status).toBe(ProjectStatus.ACTIVE);
    expect(shell.siteId).toBe(siteId);
    expect(shell.siteAddressLine1).toBe("11 Shell Ct");
    expect(shell.siteAddressSuburb).toBe("Yatala");
    expect(shell.siteAddressState).toBe("QLD");
    expect(shell.siteAddressPostcode).toBe("4207");
    expect(shell.createdAt).toEqual(jobX.createdAt);
    expect(shell.estimateSnapshot).toEqual({ bp0a2bShell: true });

    // The sequence singleton was bumped past every shell, so the next
    // service allocation cannot collide.
    const seq = await prisma.projectNumberSequence.findUniqueOrThrow({ where: { id: 1 } });
    const shellNumber = Number(shell.projectNumber.replace("IS-P", ""));
    expect(seq.lastNumber).toBeGreaterThanOrEqual(shellNumber);
  });

  it("maps a site-less PLANNING Job to a shell with empty address and MOBILISING", async () => {
    const shell = await prisma.project.findUniqueOrThrow({ where: { legacyJobId: jobZ.id } });
    expect(shell.jobNumber).toBe(jobZ.jobNumber);
    expect(shell.status).toBe(ProjectStatus.MOBILISING);
    expect(shell.siteId).toBeNull();
    expect(shell.siteAddressLine1).toBe("");
    expect(shell.siteAddressSuburb).toBe("");
    expect(shell.siteAddressState).toBe("");
    expect(shell.siteAddressPostcode).toBe("");
  });

  it("skips a Job already mapped via legacyJobId", async () => {
    const projectsForY = await prisma.project.findMany({ where: { legacyJobId: jobY.id } });
    expect(projectsForY).toHaveLength(1);
    expect(projectsForY[0].id).toBe(mappedProjectYId);
    expect(projectsForY[0].projectNumber).toBe("ZZTEST-BP0A2B-P1");
  });

  it("is idempotent — a second run inserts zero rows", async () => {
    const before = await Promise.all([
      prisma.project.findUniqueOrThrow({ where: { legacyJobId: jobX.id } }),
      prisma.project.findUniqueOrThrow({ where: { legacyJobId: jobZ.id } }),
      prisma.projectNumberSequence.findUniqueOrThrow({ where: { id: 1 } })
    ]);

    const affected = await runShells();
    // Index 0 is the CREATE TEMP TABLE candidate build; every data statement
    // after it must report zero affected rows on the second pass.
    expect(affected.slice(1)).toEqual(affected.slice(1).map(() => 0));

    const after = await Promise.all([
      prisma.project.findUniqueOrThrow({ where: { legacyJobId: jobX.id } }),
      prisma.project.findUniqueOrThrow({ where: { legacyJobId: jobZ.id } }),
      prisma.projectNumberSequence.findUniqueOrThrow({ where: { id: 1 } })
    ]);
    expect(after).toEqual(before);
  });
});
