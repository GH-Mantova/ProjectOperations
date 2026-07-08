import { PrismaClient } from "@prisma/client";
import { FormsEngineService } from "../forms-engine.service";

/**
 * Widgets batch 2 — `GET /forms/pre-starts-today` service coverage.
 *
 * Seeds two templates (one prestart-coded, one not) and a mix of
 * submissions (some yesterday, some today, one still a draft) and
 * asserts only today's non-draft prestart submissions are counted.
 *
 * Serial suite, real database, self-cleaning via ZZTEST-B2-PST prefix.
 */

jest.setTimeout(60_000);

describe("FormsEngineService.getPreStartsToday — batch 2 widget", () => {
  const prisma = new PrismaClient();
  const service = new FormsEngineService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never
  );

  const CODE = "ZZTEST-B2-PRESTART";
  const OTHER = "ZZTEST-B2-OTHER";
  let versionId: string;
  let otherVersionId: string;

  async function cleanup(): Promise<void> {
    await prisma.formSubmission.deleteMany({
      where: { templateVersion: { template: { code: { in: [CODE, OTHER] } } } }
    });
    await prisma.formTemplateVersion.deleteMany({
      where: { template: { code: { in: [CODE, OTHER] } } }
    });
    await prisma.formTemplate.deleteMany({ where: { code: { in: [CODE, OTHER] } } });
  }

  beforeAll(async () => {
    await cleanup();
    const prestart = await prisma.formTemplate.create({
      data: { name: "ZZTEST B2 Prestart Checklist", code: CODE, status: "ACTIVE" }
    });
    const other = await prisma.formTemplate.create({
      data: { name: "ZZTEST B2 Toolbox Talk", code: OTHER, status: "ACTIVE" }
    });
    versionId = (
      await prisma.formTemplateVersion.create({
        data: { templateId: prestart.id, versionNumber: 1, status: "ACTIVE" }
      })
    ).id;
    otherVersionId = (
      await prisma.formTemplateVersion.create({
        data: { templateId: other.id, versionNumber: 1, status: "ACTIVE" }
      })
    ).id;

    const today = new Date();
    today.setHours(10, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86_400_000);

    // 2 today (prestart, non-draft) — should count
    await prisma.formSubmission.create({
      data: { templateVersionId: versionId, status: "submitted", submittedAt: today }
    });
    await prisma.formSubmission.create({
      data: { templateVersionId: versionId, status: "SUBMITTED", submittedAt: today }
    });
    // 1 today prestart but draft — should NOT count
    await prisma.formSubmission.create({
      data: { templateVersionId: versionId, status: "draft", submittedAt: today }
    });
    // 1 yesterday prestart — should NOT count
    await prisma.formSubmission.create({
      data: { templateVersionId: versionId, status: "submitted", submittedAt: yesterday }
    });
    // 1 today non-prestart — should NOT count
    await prisma.formSubmission.create({
      data: { templateVersionId: otherVersionId, status: "submitted", submittedAt: today }
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("counts today's non-draft prestart submissions and reports the most recent", async () => {
    // Seed data may already have prestart submissions in the DB; we
    // compare the service against a direct Prisma query with the same
    // filter so the assertion stays deterministic across environments.
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000 - 1);
    const beforeCount = await prisma.formSubmission.count({
      where: {
        submittedAt: { gte: dayStart, lte: dayEnd },
        status: { notIn: ["draft", "DRAFT"] },
        templateVersion: {
          template: {
            OR: [
              { code: { contains: "prestart", mode: "insensitive" } },
              { name: { contains: "prestart", mode: "insensitive" } }
            ]
          }
        }
      }
    });

    const result = await service.getPreStartsToday();
    expect(result.count).toBe(beforeCount);
    expect(result.latestSubmittedAt).not.toBeNull();
    // My seeded rows contribute at least 2 today
    expect(result.count).toBeGreaterThanOrEqual(2);
  });
});
