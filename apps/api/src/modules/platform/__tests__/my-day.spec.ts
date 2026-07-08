import { PrismaClient } from "@prisma/client";
import { MyDayService } from "../my-day.service";

/**
 * Widgets batch 2 — `GET /dashboards/my-day` service coverage.
 *
 * Seeds a user + workerProfile + project + a today ScheduleAllocation
 * plus one pending FormApproval assigned to the user and one FormSchedule
 * due today; a second user's rows must NOT bleed into the response.
 *
 * Serial suite, real database, self-cleaning via ZZTEST-B2-MD prefix.
 */

jest.setTimeout(60_000);

describe("MyDayService.getMyDay — batch 2 widget", () => {
  const prisma = new PrismaClient();
  const service = new MyDayService(prisma as never);

  let userId: string;
  let otherUserId: string;
  let clientId: string;
  let projectId: string;
  let workerProfileId: string;

  async function cleanup(): Promise<void> {
    await prisma.scheduleAllocation.deleteMany({
      where: { project: { projectNumber: "ZZTEST-B2-MD-P" } }
    });
    await prisma.project.deleteMany({ where: { projectNumber: "ZZTEST-B2-MD-P" } });
    await prisma.workerProfile.deleteMany({ where: { lastName: "ZZTEST-B2-MD" } });
    await prisma.formApproval.deleteMany({
      where: { submission: { templateVersion: { template: { code: "ZZTEST-B2-MD" } } } }
    });
    await prisma.formSchedule.deleteMany({
      where: { template: { code: "ZZTEST-B2-MD" } }
    });
    await prisma.formSubmission.deleteMany({
      where: { templateVersion: { template: { code: "ZZTEST-B2-MD" } } }
    });
    await prisma.formTemplateVersion.deleteMany({
      where: { template: { code: "ZZTEST-B2-MD" } }
    });
    await prisma.formTemplate.deleteMany({ where: { code: "ZZTEST-B2-MD" } });
    await prisma.client.deleteMany({ where: { name: "ZZTEST-B2-MD Client" } });
    await prisma.user.deleteMany({
      where: {
        email: { in: ["zztest-b2-md@projectops.local", "zztest-b2-md-other@projectops.local"] }
      }
    });
  }

  beforeAll(async () => {
    await cleanup();
    const user = await prisma.user.create({
      data: {
        email: "zztest-b2-md@projectops.local",
        firstName: "ZZTEST",
        lastName: "ZZTEST-B2-MD",
        passwordHash: "not-a-login"
      }
    });
    userId = user.id;
    const other = await prisma.user.create({
      data: {
        email: "zztest-b2-md-other@projectops.local",
        firstName: "ZZTEST",
        lastName: "ZZTEST-B2-MD-Other",
        passwordHash: "not-a-login"
      }
    });
    otherUserId = other.id;
    const client = await prisma.client.create({ data: { name: "ZZTEST-B2-MD Client" } });
    clientId = client.id;
    const project = await prisma.project.create({
      data: {
        projectNumber: "ZZTEST-B2-MD-P",
        name: "ZZTEST-B2-MD Project",
        clientId,
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
      data: {
        firstName: "ZZTEST",
        lastName: "ZZTEST-B2-MD",
        role: "Operator",
        internalUserId: userId
      }
    });
    workerProfileId = worker.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.scheduleAllocation.create({
      data: {
        date: today,
        projectId,
        targetType: "WORKER",
        workerProfileId,
        createdById: userId,
        note: "ZZTEST-B2-MD note"
      }
    });

    const template = await prisma.formTemplate.create({
      data: { name: "ZZTEST-B2-MD Template", code: "ZZTEST-B2-MD", status: "ACTIVE" }
    });
    const version = await prisma.formTemplateVersion.create({
      data: { templateId: template.id, versionNumber: 1, status: "ACTIVE" }
    });
    const submission = await prisma.formSubmission.create({
      data: { templateVersionId: version.id, status: "submitted", submittedById: otherUserId }
    });
    await prisma.formApproval.create({
      data: {
        submissionId: submission.id,
        stepNumber: 1,
        assignedToId: userId,
        status: "pending",
        dueAt: new Date(today.getTime() + 3_600_000)
      }
    });
    // Other user's approval — must not appear for `userId`
    await prisma.formApproval.create({
      data: {
        submissionId: submission.id,
        stepNumber: 2,
        assignedToId: otherUserId,
        status: "pending",
        dueAt: new Date(today.getTime() + 3_600_000)
      }
    });

    await prisma.formSchedule.create({
      data: {
        templateId: template.id,
        scheduleType: "cron",
        assignToUserId: userId,
        isActive: true,
        nextRunAt: new Date(today.getTime() + 30_000)
      }
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("returns caller-scoped allocations, approvals, and forms due today", async () => {
    const result = await service.getMyDay(userId);

    expect(result.workerProfileId).toBe(workerProfileId);
    expect(result.allocations.map((a) => a.projectId)).toContain(projectId);
    expect(result.approvals.map((a) => a.stepNumber)).toContain(1);
    expect(result.approvals.map((a) => a.stepNumber)).not.toContain(2);
    expect(result.formsDue.length).toBeGreaterThanOrEqual(1);
  });

  it("returns empty allocations when the user has no worker profile linked", async () => {
    const result = await service.getMyDay(otherUserId);
    expect(result.workerProfileId).toBeNull();
    expect(result.allocations).toEqual([]);
    // Other user still has their own approval
    expect(result.approvals.map((a) => a.stepNumber)).toContain(2);
  });
});
