import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Backs the "My Day" dashboard widget — a per-user composition of what
 * matters to the caller today: their day-grain scheduler allocations,
 * form approvals waiting on their decision, and forms scheduled to
 * them that come due today. All reads are strictly scoped to the
 * requesting user; the widget must never leak someone else's day.
 *
 * All three feeds come from existing tables — no new columns, no
 * cross-tenant assumptions. If a user has no workerProfile linked to
 * their User row, `allocations` returns [] rather than the whole roster.
 */
@Injectable()
export class MyDayService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compose the three per-user feeds for today.
   *
   * @param userId - authenticated User.id from the JWT
   * @param now - override clock (tests)
   * @returns `{ allocations, approvals, formsDue, workerProfileId }`
   */
  async getMyDay(userId: string, now: Date = new Date()) {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000 - 1);

    const workerProfile = await this.prisma.workerProfile.findUnique({
      where: { internalUserId: userId },
      select: { id: true }
    });
    const workerProfileId = workerProfile?.id ?? null;

    const [allocations, approvals, formsDue] = await Promise.all([
      workerProfileId
        ? this.prisma.scheduleAllocation.findMany({
            where: {
              workerProfileId,
              date: { gte: dayStart, lte: dayEnd }
            },
            include: {
              project: { select: { id: true, name: true, projectNumber: true } },
              jobRole: { select: { id: true, name: true } }
            },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }]
          })
        : Promise.resolve([]),
      this.prisma.formApproval.findMany({
        where: { assignedToId: userId, status: "pending" },
        include: {
          submission: {
            select: {
              id: true,
              submittedAt: true,
              submittedBy: { select: { firstName: true, lastName: true } },
              templateVersion: {
                select: { template: { select: { id: true, name: true, code: true } } }
              }
            }
          }
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }]
      }),
      this.prisma.formSchedule.findMany({
        where: {
          assignToUserId: userId,
          isActive: true,
          nextRunAt: { lte: dayEnd }
        },
        include: {
          template: { select: { id: true, name: true, code: true } }
        },
        orderBy: { nextRunAt: "asc" }
      })
    ]);

    return {
      workerProfileId,
      allocations: allocations.map((a) => ({
        id: a.id,
        date: a.date,
        note: a.note,
        projectId: a.projectId,
        projectName: a.project.name,
        projectNumber: a.project.projectNumber,
        jobRoleId: a.jobRoleId,
        jobRoleName: a.jobRole?.name ?? null
      })),
      approvals: approvals.map((r) => ({
        id: r.id,
        submissionId: r.submissionId,
        stepNumber: r.stepNumber,
        dueAt: r.dueAt,
        overdue: r.dueAt ? r.dueAt < now : false,
        submittedAt: r.submission.submittedAt,
        submittedByName: r.submission.submittedBy
          ? `${r.submission.submittedBy.firstName} ${r.submission.submittedBy.lastName}`.trim()
          : null,
        templateName: r.submission.templateVersion.template.name,
        templateCode: r.submission.templateVersion.template.code
      })),
      formsDue: formsDue.map((s) => ({
        id: s.id,
        templateId: s.templateId,
        templateName: s.template.name,
        templateCode: s.template.code,
        scheduleType: s.scheduleType,
        nextRunAt: s.nextRunAt,
        overdue: s.nextRunAt ? s.nextRunAt < dayStart : false
      }))
    };
  }
}
