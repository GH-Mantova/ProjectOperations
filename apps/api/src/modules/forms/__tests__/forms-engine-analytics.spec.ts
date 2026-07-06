import { PrismaClient } from "@prisma/client";
import { FormsEngineService } from "../forms-engine.service";

/**
 * QA S3-006 — FormsEngineService.getAnalytics() must fold FormSubmission.status
 * to lowercase before accumulating byStatus counts. Mixed-case legacy rows
 * exist ("SUBMITTED"/"DRAFT" from schema default + seed; "submitted"/"draft"/
 * "rejected" from the engine). Response contract is lowercase.
 *
 * Serial suite, real database, self-cleaning via ZZTEST- prefixes.
 */

jest.setTimeout(60_000);

describe("FormsEngineService.getAnalytics — status casing fold (S3-006)", () => {
  const prisma = new PrismaClient();
  const service = new FormsEngineService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never
  );

  let templateId: string;
  let versionId: string;

  async function cleanup(): Promise<void> {
    await prisma.formSubmission.deleteMany({
      where: { templateVersion: { template: { code: "ZZTEST-S3006" } } }
    });
    await prisma.formTemplateVersion.deleteMany({
      where: { template: { code: "ZZTEST-S3006" } }
    });
    await prisma.formTemplate.deleteMany({ where: { code: "ZZTEST-S3006" } });
  }

  beforeAll(async () => {
    await cleanup();
    const template = await prisma.formTemplate.create({
      data: { name: "ZZTEST-S3006 template", code: "ZZTEST-S3006", status: "ACTIVE" }
    });
    templateId = template.id;
    const version = await prisma.formTemplateVersion.create({
      data: { templateId, versionNumber: 1, status: "ACTIVE" }
    });
    versionId = version.id;

    const statuses = ["SUBMITTED", "submitted", "DRAFT", "draft", "approved"];
    for (const status of statuses) {
      await prisma.formSubmission.create({ data: { templateVersionId: versionId, status } });
    }
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("folds mixed-case statuses into a single lowercase bucket per status", async () => {
    const result = await service.getAnalytics({ templateId });

    expect(result.totalSubmissions).toBe(5);
    expect(result.byStatus).toEqual({ submitted: 2, draft: 2, approved: 1 });
  });
});
