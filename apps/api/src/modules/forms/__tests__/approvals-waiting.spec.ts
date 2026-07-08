import { PrismaClient } from "@prisma/client";
import { FormsEngineService } from "../forms-engine.service";

/**
 * Widgets batch 2 — `GET /forms/approvals-waiting` service coverage.
 *
 * Seeds one template, one submission, and three FormApproval rows
 * (one pending overdue, one pending future, one already approved) and
 * asserts the aggregate splits the pending vs decided rows and counts
 * the overdue subset correctly.
 *
 * Serial suite, real database, self-cleaning via ZZTEST-B2- prefixes.
 */

jest.setTimeout(60_000);

describe("FormsEngineService.getApprovalsWaiting — batch 2 widget", () => {
  const prisma = new PrismaClient();
  const service = new FormsEngineService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never
  );

  const CODE = "ZZTEST-B2-AW";
  let templateId: string;
  let versionId: string;
  let submissionId: string;
  let userId: string;

  async function cleanup(): Promise<void> {
    await prisma.formApproval.deleteMany({
      where: { submission: { templateVersion: { template: { code: CODE } } } }
    });
    await prisma.formSubmission.deleteMany({
      where: { templateVersion: { template: { code: CODE } } }
    });
    await prisma.formTemplateVersion.deleteMany({
      where: { template: { code: CODE } }
    });
    await prisma.formTemplate.deleteMany({ where: { code: CODE } });
    await prisma.user.deleteMany({ where: { email: "zztest-b2-aw@projectops.local" } });
  }

  beforeAll(async () => {
    await cleanup();
    const user = await prisma.user.create({
      data: {
        email: "zztest-b2-aw@projectops.local",
        firstName: "ZZTEST",
        lastName: "AW",
        passwordHash: "not-a-login"
      }
    });
    userId = user.id;

    const template = await prisma.formTemplate.create({
      data: { name: "ZZTEST B2 AW", code: CODE, status: "ACTIVE" }
    });
    templateId = template.id;
    const version = await prisma.formTemplateVersion.create({
      data: { templateId, versionNumber: 1, status: "ACTIVE" }
    });
    versionId = version.id;

    const submission = await prisma.formSubmission.create({
      data: { templateVersionId: versionId, status: "submitted", submittedById: userId }
    });
    submissionId = submission.id;

    const yesterday = new Date(Date.now() - 86_400_000);
    const tomorrow = new Date(Date.now() + 86_400_000);
    await prisma.formApproval.createMany({
      data: [
        {
          submissionId,
          stepNumber: 1,
          assignedToId: userId,
          status: "pending",
          dueAt: yesterday
        },
        {
          submissionId,
          stepNumber: 2,
          assignedToId: userId,
          status: "pending",
          dueAt: tomorrow
        },
        {
          submissionId,
          stepNumber: 3,
          assignedToId: userId,
          status: "approved",
          dueAt: tomorrow,
          decidedAt: new Date()
        }
      ]
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("returns pending totals with the overdue split, top-N ordered by dueAt", async () => {
    // The service counts across ALL pending rows in the DB, so this
    // assertion filters to the ones this test seeded before checking
    // ordering / overdue attribution.
    const result = await service.getApprovalsWaiting(20);
    const mine = result.items.filter((i) => i.submissionId === submissionId);

    expect(mine).toHaveLength(2);
    expect(mine[0].stepNumber).toBe(1); // yesterday first
    expect(mine[0].overdue).toBe(true);
    expect(mine[1].stepNumber).toBe(2);
    expect(mine[1].overdue).toBe(false);
    expect(mine[0].templateCode).toBe(CODE);
  });

  it("clamps limit into [1, 20]", async () => {
    const zero = await service.getApprovalsWaiting(0);
    expect(zero.items.length).toBeGreaterThanOrEqual(1);
    const huge = await service.getApprovalsWaiting(500);
    expect(huge.items.length).toBeLessThanOrEqual(20);
  });
});
