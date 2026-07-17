import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

/**
 * B-P0a-3 — unique Project.sourceTenderId (design doc sections 3, 6; risk R2).
 *
 * Asserts against the real test database (serial suite only):
 *  - two Projects sharing a sourceTenderId violate the unique index,
 *  - multiple NULL sourceTenderId Projects coexist (tender-less shells),
 *  - the migration's duplicate audit RAISEs when a duplicate exists
 *    (exercised inside a rolled-back transaction).
 */

jest.setTimeout(60_000);

const MIGRATION_SQL_PATH = join(
  __dirname,
  "../../../../prisma/migrations/20260703132937_bp0a3_project_source_tender_unique/migration.sql"
);

function loadAuditBlock(): string {
  const sql = readFileSync(MIGRATION_SQL_PATH, "utf8");
  const match = sql.match(/DO \$\$[\s\S]*?END \$\$/);
  if (!match) {
    throw new Error("audit DO block not found in bp0a3 migration");
  }
  return match[0];
}

describe("B-P0a-3 — unique sourceTenderId on Project", () => {
  const prisma = new PrismaClient();

  let userId: string;
  let clientId: string;
  let siteId: string;
  let tenderId: string;

  const projectData = (projectNumber: string, sourceTenderId: string | null) => ({
    projectNumber,
    name: `ZZTEST-BP0A3 ${projectNumber}`,
    clientId,
    siteId,
    sourceTenderId,
    siteAddressLine1: "",
    siteAddressSuburb: "",
    siteAddressState: "",
    siteAddressPostcode: "",
    estimateSnapshot: {},
    createdById: userId
  });

  async function cleanup(): Promise<void> {
    await prisma.project.deleteMany({ where: { projectNumber: { startsWith: "ZZTEST-BP0A3-" } } });
    await prisma.tender.deleteMany({ where: { tenderNumber: { startsWith: "ZZTEST-BP0A3-" } } });
    await prisma.site.deleteMany({ where: { name: "ZZTEST-BP0A3 Site" } });
    await prisma.client.deleteMany({ where: { name: "ZZTEST-BP0A3 Client" } });
    await prisma.user.deleteMany({ where: { email: "zztest-bp0a3@projectops.local" } });
  }

  beforeAll(async () => {
    await cleanup();

    const user = await prisma.user.create({
      data: {
        email: "zztest-bp0a3@projectops.local",
        firstName: "ZZTEST",
        lastName: "ZZTEST-BP0A3",
        passwordHash: "not-a-login"
      }
    });
    userId = user.id;

    const client = await prisma.client.create({ data: { name: "ZZTEST-BP0A3 Client" } });
    clientId = client.id;

    const site = await prisma.site.create({
      data: { name: "ZZTEST-BP0A3 Site", clientId }
    });
    siteId = site.id;

    const tender = await prisma.tender.create({
      data: { tenderNumber: "ZZTEST-BP0A3-T1", title: "ZZTEST-BP0A3 tender", siteId: "site-unassigned" }
    });
    tenderId = tender.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("rejects a second Project with the same sourceTenderId (unique violation)", async () => {
    await prisma.project.create({ data: projectData("ZZTEST-BP0A3-P1", tenderId) });

    await expect(
      prisma.project.create({ data: projectData("ZZTEST-BP0A3-P2", tenderId) })
    ).rejects.toMatchObject(
      expect.objectContaining({ code: "P2002" }) as Prisma.PrismaClientKnownRequestError
    );
  });

  it("allows multiple Projects with NULL sourceTenderId", async () => {
    const a = await prisma.project.create({ data: projectData("ZZTEST-BP0A3-P3", null) });
    const b = await prisma.project.create({ data: projectData("ZZTEST-BP0A3-P4", null) });
    expect(a.sourceTenderId).toBeNull();
    expect(b.sourceTenderId).toBeNull();
  });

  it("audit block raises on a duplicate (rolled-back transaction)", async () => {
    const audit = loadAuditBlock();

    await expect(
      prisma.$transaction(async (tx) => {
        // Drop the unique index inside the transaction so a duplicate can
        // exist for the audit to catch; the rollback restores everything.
        await tx.$executeRawUnsafe('DROP INDEX "projects_source_tender_id_key"');
        await tx.project.create({ data: projectData("ZZTEST-BP0A3-D1", tenderId) });
        await tx.project.create({ data: projectData("ZZTEST-BP0A3-D2", tenderId) });
        await tx.$executeRawUnsafe(audit);
      })
    ).rejects.toThrow(/bp0a3 aborted: duplicate Project\.source_tender_id/);

    // Rollback restored the index and removed the duplicate rows.
    const dupes = await prisma.project.findMany({
      where: { projectNumber: { in: ["ZZTEST-BP0A3-D1", "ZZTEST-BP0A3-D2"] } }
    });
    expect(dupes).toHaveLength(0);
    await expect(
      prisma.project.create({ data: projectData("ZZTEST-BP0A3-D3", tenderId) })
    ).rejects.toMatchObject(
      expect.objectContaining({ code: "P2002" }) as Prisma.PrismaClientKnownRequestError
    );
  });
});
