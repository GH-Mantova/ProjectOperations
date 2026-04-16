import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateNotificationDto } from "./dto/create-notification.dto";
import { AssignFollowUpNotificationDto } from "./dto/assign-follow-up-notification.dto";
import { SyncFollowUpNotificationsDto } from "./dto/sync-follow-up-notifications.dto";
import { TriageFollowUpNotificationDto } from "./dto/triage-follow-up-notification.dto";

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
  }

  async listSharedFollowUps(actorId?: string) {
    await this.ensureLiveFollowUps(actorId);

    return this.prisma.notification.findMany({
      where: {
        metadata: {
          path: ["kind"],
          equals: "LIVE_FOLLOW_UP"
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async refreshLiveFollowUps(actorId?: string) {
    await this.ensureLiveFollowUps(actorId);

    return this.prisma.notification.findMany({
      where: {
        metadata: {
          path: ["kind"],
          equals: "LIVE_FOLLOW_UP"
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async create(input: CreateNotificationDto, actorId?: string) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        body: input.body,
        severity: input.severity,
        linkUrl: input.linkUrl
      }
    });

    await this.auditService.write({
      actorId,
      action: "notifications.create",
      entityType: "Notification",
      entityId: notification.id,
      metadata: { userId: input.userId, severity: input.severity }
    });

    return notification;
  }

  async syncFollowUps(input: SyncFollowUpNotificationsDto, actorId?: string) {
    const results = [];

    for (const item of input.items) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId: item.userId,
          AND: [
            {
              metadata: {
                path: ["kind"],
                equals: "LIVE_FOLLOW_UP"
              }
            },
            {
              metadata: {
                path: ["promptKey"],
                equals: item.promptKey
              }
            }
          ]
        }
      });

      const nextMetadata = {
        kind: "LIVE_FOLLOW_UP",
        promptKey: item.promptKey,
        jobId: item.jobId,
        actionTarget: item.actionTarget,
        nextOwnerId: item.nextOwnerId ?? item.userId,
        nextOwnerLabel: item.nextOwnerLabel,
        ownerRole: item.ownerRole,
        audienceLabel: item.audienceLabel,
        urgencyLabel: item.urgencyLabel,
        triageState:
          (existing?.metadata as Record<string, unknown> | null | undefined)?.triageState ?? "OPEN",
        triagedById:
          (existing?.metadata as Record<string, unknown> | null | undefined)?.triagedById ?? null,
        triagedAt:
          (existing?.metadata as Record<string, unknown> | null | undefined)?.triagedAt ?? null
      } satisfies Prisma.InputJsonValue;

      const notification = existing
        ? await this.prisma.notification.update({
            where: { id: existing.id },
            data: {
              title: item.title,
              body: item.body,
              severity: item.severity,
              linkUrl: item.linkUrl,
              metadata: nextMetadata
            }
          })
        : await this.prisma.notification.create({
            data: {
              userId: item.userId,
              title: item.title,
              body: item.body,
              severity: item.severity,
              linkUrl: item.linkUrl,
              metadata: nextMetadata
            }
          });

      results.push(notification);
    }

    await this.auditService.write({
      actorId,
      action: "notifications.followups.sync",
      entityType: "Notification",
      metadata: { count: results.length }
    });

    return results;
  }

  async triageFollowUp(notificationId: string, dto: TriageFollowUpNotificationDto, actorId?: string) {
    const existing = await this.prisma.notification.findUniqueOrThrow({
      where: { id: notificationId }
    });
    const actor = actorId
      ? await this.prisma.user.findUnique({
          where: { id: actorId },
          select: {
            firstName: true,
            lastName: true
          }
        })
      : null;

    const currentMetadata = (existing.metadata as Record<string, unknown> | null | undefined) ?? {};
    const isReset = dto.triageState === "OPEN";

    const notification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        metadata: {
          ...currentMetadata,
          kind: currentMetadata.kind ?? "LIVE_FOLLOW_UP",
          triageState: dto.triageState,
          triagedById: isReset ? null : actorId ?? null,
          triagedByLabel: isReset
            ? null
            : actor
              ? `${actor.firstName} ${actor.lastName}`.trim()
              : null,
          triagedAt: isReset ? null : new Date().toISOString()
        } satisfies Prisma.InputJsonValue
      }
    });

    await this.auditService.write({
      actorId,
      action: "notifications.followups.triage",
      entityType: "Notification",
      entityId: notification.id,
      metadata: { triageState: dto.triageState }
    });

    return notification;
  }

  async assignFollowUp(notificationId: string, dto: AssignFollowUpNotificationDto, actorId?: string) {
    const existing = await this.prisma.notification.findUniqueOrThrow({
      where: { id: notificationId }
    });

    const assignee = await this.prisma.user.findUniqueOrThrow({
      where: { id: dto.userId },
      select: {
        firstName: true,
        lastName: true
      }
    });

    const actor = actorId
      ? await this.prisma.user.findUnique({
          where: { id: actorId },
          select: {
            firstName: true,
            lastName: true
          }
        })
      : null;

    const currentMetadata = (existing.metadata as Record<string, unknown> | null | undefined) ?? {};
    const assigneeLabel = dto.userLabel?.trim() || `${assignee.firstName} ${assignee.lastName}`.trim();

    const notification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        userId: dto.userId,
        metadata: {
          ...currentMetadata,
          kind: currentMetadata.kind ?? "LIVE_FOLLOW_UP",
          nextOwnerId: dto.userId,
          nextOwnerLabel: assigneeLabel,
          assignmentMode: "MANUAL",
          assignedById: actorId ?? null,
          assignedByLabel: actor ? `${actor.firstName} ${actor.lastName}`.trim() : null,
          assignedAt: new Date().toISOString()
        } satisfies Prisma.InputJsonValue
      }
    });

    await this.auditService.write({
      actorId,
      action: "notifications.followups.assign",
      entityType: "Notification",
      entityId: notification.id,
      metadata: {
        assignedUserId: dto.userId
      }
    });

    return notification;
  }

  async markRead(notificationId: string, actorId?: string) {
    const notification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: "READ",
        readAt: new Date()
      }
    });

    await this.auditService.write({
      actorId,
      action: "notifications.read",
      entityType: "Notification",
      entityId: notification.id
    });

    return notification;
  }

  private async ensureLiveFollowUps(actorId?: string) {
    const jobs = await this.prisma.job.findMany({
      where: {
        OR: [{ closeout: { is: null } }, { closeout: { is: { archivedAt: null } } }]
      },
      include: {
        projectManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        supervisor: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        stages: {
          select: {
            id: true,
            name: true,
            activities: {
              select: {
                id: true,
                name: true,
                plannedDate: true,
                owner: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                },
                shifts: {
                  select: {
                    id: true,
                    title: true,
                    startAt: true,
                    lead: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true
                      }
                    },
                    conflicts: {
                      select: {
                        severity: true,
                        message: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const currentDocuments = await this.prisma.documentLink.findMany({
      where: {
        linkedEntityType: "Job",
        isCurrentVersion: true
      },
      select: {
        linkedEntityId: true
      }
    });

    const currentDocumentCountByJob = new Map<string, number>();
    currentDocuments.forEach((document) => {
      currentDocumentCountByJob.set(
        document.linkedEntityId,
        (currentDocumentCountByJob.get(document.linkedEntityId) ?? 0) + 1
      );
    });

    const existing = await this.prisma.notification.findMany({
      where: {
        metadata: {
          path: ["kind"],
          equals: "LIVE_FOLLOW_UP"
        }
      }
    });

    const existingByKey = new Map(
      existing
        .map((item) => {
          const metadata = (item.metadata as Record<string, unknown> | null | undefined) ?? {};
          const promptKey = typeof metadata.promptKey === "string" ? metadata.promptKey : null;
          return promptKey ? [promptKey, item] : null;
        })
        .filter(Boolean) as Array<[string, (typeof existing)[number]]>
    );

    const nextPromptKeys = new Set<string>();
    const reconcileResults = [];

    for (const job of jobs) {
      const planningOwner = job.supervisor ?? job.projectManager;
      const documentOwner = job.projectManager ?? job.supervisor;
      const planningOwnerLabel = this.formatPersonName(job.supervisor) ?? this.formatPersonName(job.projectManager) ?? "Delivery lead";
      const documentOwnerLabel = this.formatPersonName(job.projectManager) ?? this.formatPersonName(job.supervisor) ?? "Project manager";
      const activities = job.stages.flatMap((stage) =>
        stage.activities.map((activity) => ({
          ...activity,
          stageName: stage.name
        }))
      );
      const shifts = activities.flatMap((activity) =>
        activity.shifts.map((shift) => ({
          ...shift,
          activityId: activity.id,
          activityName: activity.name,
          stageName: activity.stageName,
          activityOwner: activity.owner
        }))
      );

      const blockedShift = shifts.find((shift) =>
        shift.conflicts.some((conflict) => conflict.severity === "RED")
      );
      const blockedShiftOwner = blockedShift?.lead ?? blockedShift?.activityOwner ?? planningOwner;
      const blockedShiftOwnerRole = blockedShift?.lead
        ? "Shift lead"
        : blockedShift?.activityOwner
          ? "Activity owner"
          : "Planning owner";
      if (blockedShift && blockedShiftOwner?.id) {
        const blocker = blockedShift.conflicts.find((conflict) => conflict.severity === "RED");
        const blockedShiftOwnerLabel =
          this.formatPersonName(blockedShift.lead) ??
          this.formatPersonName(blockedShift.activityOwner) ??
          planningOwnerLabel;
        const promptKey = `blocked-${job.id}-${blockedShift.id}`;
        nextPromptKeys.add(promptKey);
        reconcileResults.push(
          await this.upsertLiveFollowUp(
            existingByKey.get(promptKey),
            {
              promptKey,
              userId: blockedShiftOwner.id,
              title: `${job.jobNumber} is blocked in planning`,
              body: blocker?.message
                ? `${blockedShift.title} in ${blockedShift.stageName} needs intervention: ${blocker.message}`
                : `${blockedShift.title} in ${blockedShift.stageName} has a blocking planning issue that needs attention.`,
              severity: "HIGH",
              linkUrl: `/jobs?jobId=${job.id}`,
              metadata: {
                kind: "LIVE_FOLLOW_UP",
                promptKey,
                jobId: job.id,
                actionTarget: "job",
                nextOwnerId: blockedShiftOwner.id,
                nextOwnerLabel: blockedShiftOwnerLabel,
                ownerRole: blockedShiftOwnerRole,
                audienceLabel: actorId && blockedShiftOwner.id === actorId ? "Assigned to me" : "Team follow-up",
                urgencyLabel: this.getUrgencyLabel(blockedShift.startAt)
              }
            }
          )
        );
        continue;
      }

      const warningShift = shifts.find((shift) =>
        shift.conflicts.some((conflict) => conflict.severity === "AMBER")
      );
      const warningShiftOwner = warningShift?.lead ?? warningShift?.activityOwner ?? planningOwner;
      const warningShiftOwnerRole = warningShift?.lead
        ? "Shift lead"
        : warningShift?.activityOwner
          ? "Activity owner"
          : "Planning owner";
      if (warningShift && warningShiftOwner?.id) {
        const warning = warningShift.conflicts.find((conflict) => conflict.severity === "AMBER");
        const warningShiftOwnerLabel =
          this.formatPersonName(warningShift.lead) ??
          this.formatPersonName(warningShift.activityOwner) ??
          planningOwnerLabel;
        const promptKey = `warning-${job.id}-${warningShift.id}`;
        nextPromptKeys.add(promptKey);
        reconcileResults.push(
          await this.upsertLiveFollowUp(
            existingByKey.get(promptKey),
            {
              promptKey,
              userId: warningShiftOwner.id,
              title: `${job.jobNumber} has planning watchpoints`,
              body: warning?.message
                ? `${warningShift.title} can probably proceed, but should be reviewed: ${warning.message}`
                : `${warningShift.title} still has warning-level planning risk to review before dispatch.`,
              severity: "MEDIUM",
              linkUrl: `/jobs?jobId=${job.id}`,
              metadata: {
                kind: "LIVE_FOLLOW_UP",
                promptKey,
                jobId: job.id,
                actionTarget: "job",
                nextOwnerId: warningShiftOwner.id,
                nextOwnerLabel: warningShiftOwnerLabel,
                ownerRole: warningShiftOwnerRole,
                audienceLabel: actorId && warningShiftOwner.id === actorId ? "Assigned to me" : "Team follow-up",
                urgencyLabel: this.getUrgencyLabel(warningShift.startAt)
              }
            }
          )
        );
        continue;
      }

      const unscheduledActivity = activities.find((activity) => activity.shifts.length === 0);
      const unscheduledActivityOwner = unscheduledActivity?.owner ?? planningOwner;
      const unscheduledActivityOwnerRole = unscheduledActivity?.owner
        ? "Activity owner"
        : "Planning owner";
      if (unscheduledActivity && unscheduledActivityOwner?.id) {
        const unscheduledActivityOwnerLabel =
          this.formatPersonName(unscheduledActivity.owner) ?? planningOwnerLabel;
        const promptKey = `planning-${job.id}-${unscheduledActivity.id}`;
        nextPromptKeys.add(promptKey);
        reconcileResults.push(
          await this.upsertLiveFollowUp(
            existingByKey.get(promptKey),
            {
              promptKey,
              userId: unscheduledActivityOwner.id,
              title: `${job.jobNumber} still needs first shift coverage`,
              body: `${unscheduledActivity.name} in ${unscheduledActivity.stageName} has not been scheduled yet. Create the first shift to move delivery forward.`,
              severity: "LOW",
              linkUrl: `/jobs?jobId=${job.id}`,
              metadata: {
                kind: "LIVE_FOLLOW_UP",
                promptKey,
                jobId: job.id,
                actionTarget: "job",
                nextOwnerId: unscheduledActivityOwner.id,
                nextOwnerLabel: unscheduledActivityOwnerLabel,
                ownerRole: unscheduledActivityOwnerRole,
                audienceLabel: actorId && unscheduledActivityOwner.id === actorId ? "Assigned to me" : "Team follow-up",
                urgencyLabel: this.getUrgencyLabel(unscheduledActivity.plannedDate)
              }
            }
          )
        );
        continue;
      }

      if (job.status === "ACTIVE" && (currentDocumentCountByJob.get(job.id) ?? 0) === 0 && documentOwner?.id) {
        const promptKey = `documents-${job.id}`;
        nextPromptKeys.add(promptKey);
        reconcileResults.push(
          await this.upsertLiveFollowUp(
            existingByKey.get(promptKey),
            {
              promptKey,
              userId: documentOwner.id,
              title: `${job.jobNumber} needs delivery document follow-up`,
              body: `${job.jobNumber} is active but has no current linked job documents yet. Open the focused document workspace to register the first delivery file.`,
              severity: "LOW",
              linkUrl: `/documents?jobId=${job.id}`,
              metadata: {
                kind: "LIVE_FOLLOW_UP",
                promptKey,
                jobId: job.id,
                actionTarget: "documents",
                nextOwnerId: documentOwner.id,
                nextOwnerLabel: documentOwnerLabel,
                ownerRole: "Document owner",
                audienceLabel: actorId && documentOwner.id === actorId ? "Assigned to me" : "Team follow-up",
                urgencyLabel: "Upcoming"
              }
            }
          )
        );
      }
    }

    const staleIds = existing
      .filter((item) => {
        const metadata = (item.metadata as Record<string, unknown> | null | undefined) ?? {};
        const promptKey = typeof metadata.promptKey === "string" ? metadata.promptKey : null;
        return promptKey && !nextPromptKeys.has(promptKey);
      })
      .map((item) => item.id);

    if (staleIds.length) {
      await this.prisma.notification.deleteMany({
        where: {
          id: { in: staleIds }
        }
      });
    }

    return reconcileResults;
  }

  private async upsertLiveFollowUp(
    existing: {
      id: string;
      metadata: Prisma.JsonValue | null;
    } | undefined,
    input: {
      promptKey: string;
      userId: string;
      title: string;
      body: string;
      severity: string;
      linkUrl: string;
      metadata: Record<string, unknown>;
    }
  ) {
    const currentMetadata = (existing?.metadata as Record<string, unknown> | null | undefined) ?? {};
    const currentAssignmentMode =
      currentMetadata.assignmentMode === "MANUAL" ? "MANUAL" : "DERIVED";
    const currentAssignedById =
      typeof currentMetadata.assignedById === "string" ? currentMetadata.assignedById : null;
    const currentAssignedByLabel =
      typeof currentMetadata.assignedByLabel === "string" ? currentMetadata.assignedByLabel : null;
    const currentAssignedAt =
      typeof currentMetadata.assignedAt === "string" ? currentMetadata.assignedAt : null;
    const currentNextOwnerId =
      typeof currentMetadata.nextOwnerId === "string" ? currentMetadata.nextOwnerId : null;
    const currentNextOwnerLabel =
      typeof currentMetadata.nextOwnerLabel === "string" ? currentMetadata.nextOwnerLabel : null;
    const currentTriageState =
      currentMetadata.triageState === "ACKNOWLEDGED" || currentMetadata.triageState === "WATCH"
        ? currentMetadata.triageState
        : "OPEN";
    const currentTriagedById =
      typeof currentMetadata.triagedById === "string" ? currentMetadata.triagedById : null;
    const currentTriagedByLabel =
      typeof currentMetadata.triagedByLabel === "string" ? currentMetadata.triagedByLabel : null;
    const currentTriagedAt =
      typeof currentMetadata.triagedAt === "string" ? currentMetadata.triagedAt : null;
    const derivedNextOwnerId =
      typeof input.metadata.nextOwnerId === "string" ? input.metadata.nextOwnerId : null;
    const derivedNextOwnerLabel =
      typeof input.metadata.nextOwnerLabel === "string" ? input.metadata.nextOwnerLabel : null;
    const effectiveUserId =
      currentAssignmentMode === "MANUAL" ? currentNextOwnerId ?? input.userId : input.userId;
    const nextMetadata = {
      ...input.metadata,
      assignmentMode: currentAssignmentMode,
      assignedById: currentAssignedById,
      assignedByLabel: currentAssignedByLabel,
      assignedAt: currentAssignedAt,
      nextOwnerId:
        currentAssignmentMode === "MANUAL"
          ? currentNextOwnerId ?? derivedNextOwnerId
          : derivedNextOwnerId,
      nextOwnerLabel:
        currentAssignmentMode === "MANUAL"
          ? currentNextOwnerLabel ?? derivedNextOwnerLabel
          : derivedNextOwnerLabel,
      triageState: currentTriageState,
      triagedById: currentTriagedById,
      triagedByLabel: currentTriagedByLabel,
      triagedAt: currentTriagedAt
    } satisfies Prisma.InputJsonValue;

    if (existing) {
      return this.prisma.notification.update({
        where: { id: existing.id },
        data: {
          userId: effectiveUserId,
          title: input.title,
          body: input.body,
          severity: input.severity,
          linkUrl: input.linkUrl,
          metadata: nextMetadata
        }
      });
    }

    return this.prisma.notification.create({
      data: {
        userId: effectiveUserId,
        title: input.title,
        body: input.body,
        severity: input.severity,
        linkUrl: input.linkUrl,
        metadata: nextMetadata
      }
    });
  }

  private formatPersonName(
    person?:
      | {
          firstName: string;
          lastName: string;
        }
      | null
  ) {
    if (!person) {
      return null;
    }

    return `${person.firstName} ${person.lastName}`.trim();
  }

  private getUrgencyLabel(dateValue?: Date | null) {
    if (!dateValue) {
      return "Upcoming";
    }

    const diffMs = dateValue.getTime() - Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    if (diffMs <= dayMs) {
      return "Urgent today";
    }

    if (diffMs <= dayMs * 3) {
      return "Due soon";
    }

    return "Upcoming";
  }
}
