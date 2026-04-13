import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  AssignAssetDto,
  AssignWorkerDto,
  CreateShiftDto,
  SchedulerQueryDto,
  UpdateShiftDto
} from "./dto/scheduler.dto";

const shiftInclude = {
  job: true,
  stage: true,
  activity: true,
  roleRequirements: {
    include: {
      competency: true
    }
  },
  workerAssignments: {
    include: {
      worker: {
        include: {
          competencies: {
            include: {
              competency: true
            }
          },
          availabilityWindows: true,
          roleSuitabilities: true
        }
      }
    }
  },
  assetAssignments: {
    include: {
      asset: {
        include: {
          category: true,
          resourceType: true,
          maintenancePlans: true,
          inspections: true,
          breakdowns: true
        }
      }
    }
  },
  conflicts: true
} as const;

const refreshShiftInclude = {
  roleRequirements: {
    include: {
      competency: true
    }
  },
  workerAssignments: {
    include: {
      worker: {
        include: {
          competencies: {
            include: {
              competency: true
            }
          },
          availabilityWindows: true,
          roleSuitabilities: true
        }
      }
    }
  },
  assetAssignments: {
    include: {
      asset: {
        include: {
          maintenancePlans: true,
          inspections: true,
          breakdowns: true
        }
      }
    }
  }
} as const;

@Injectable()
export class SchedulerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async workspace(query: SchedulerQueryDto) {
    const [jobs, workers, assets, shifts] = await Promise.all([
      this.prisma.job.findMany({
        include: {
          stages: {
            orderBy: { stageOrder: "asc" },
            include: {
              activities: {
                orderBy: { activityOrder: "asc" },
                include: {
                  shifts: {
                    orderBy: { startAt: "asc" },
                    include: {
                      roleRequirements: {
                        include: {
                          competency: true
                        }
                      },
                      workerAssignments: {
                        include: {
                          worker: {
                            include: {
                              competencies: {
                                include: {
                                  competency: true
                                }
                              },
                              availabilityWindows: true,
                              roleSuitabilities: true
                            }
                          }
                        }
                      },
                      assetAssignments: {
                        include: {
                          asset: {
                            include: {
                              category: true,
                              resourceType: true,
                              maintenancePlans: true,
                              inspections: true,
                              breakdowns: true
                            }
                          }
                        }
                      },
                      conflicts: true
                    }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      this.prisma.worker.findMany({
        include: {
          resourceType: true,
          competencies: {
            include: {
              competency: true
            }
          },
          availabilityWindows: {
            orderBy: { startAt: "asc" }
          },
          roleSuitabilities: {
            orderBy: { roleLabel: "asc" }
          }
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      }),
      this.prisma.asset.findMany({
        include: {
          category: true,
          resourceType: true,
          maintenancePlans: true,
          inspections: true,
          breakdowns: true
        },
        orderBy: { name: "asc" }
      }),
      this.prisma.shift.findMany({
        include: shiftInclude,
        orderBy: { startAt: "asc" }
      })
    ]);

    return {
      items: {
        jobs,
        workers,
        assets,
        shifts
      },
      total: shifts.length,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  async createShift(dto: CreateShiftDto, actorId?: string) {
    const activity = await this.prisma.jobActivity.findUnique({
      where: { id: dto.jobActivityId }
    });

    if (!activity || activity.jobId !== dto.jobId) {
      throw new NotFoundException("Job activity not found for shift.");
    }

    if (new Date(dto.endAt) <= new Date(dto.startAt)) {
      throw new BadRequestException("Shift end must be after shift start.");
    }

    const shift = await this.prisma.shift.create({
      data: {
        jobId: dto.jobId,
        jobStageId: dto.jobStageId ?? activity.jobStageId,
        jobActivityId: dto.jobActivityId,
        title: dto.title,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        status: dto.status ?? "PLANNED",
        notes: dto.notes,
        workInstructions: dto.workInstructions
      },
      include: shiftInclude
    });

    await this.refreshConflicts(shift.id);
    await this.auditService.write({
      actorId,
      action: "scheduler.shift.create",
      entityType: "Shift",
      entityId: shift.id,
      metadata: {
        jobId: dto.jobId,
        jobActivityId: dto.jobActivityId
      }
    });

    return this.getShift(shift.id);
  }

  async updateShift(shiftId: string, dto: UpdateShiftDto, actorId?: string) {
    const existing = await this.requireShift(shiftId);

    if (new Date(dto.endAt) <= new Date(dto.startAt)) {
      throw new BadRequestException("Shift end must be after shift start.");
    }

    const updated = await this.prisma.shift.update({
      where: { id: shiftId },
      data: {
        jobId: dto.jobId,
        jobStageId: dto.jobStageId,
        jobActivityId: dto.jobActivityId,
        title: dto.title,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        status: dto.status ?? existing.status,
        notes: dto.notes,
        workInstructions: dto.workInstructions
      }
    });

    await this.refreshConflicts(updated.id);
    await this.auditService.write({
      actorId,
      action: "scheduler.shift.update",
      entityType: "Shift",
      entityId: updated.id
    });

    return this.getShift(updated.id);
  }

  async assignWorker(shiftId: string, dto: AssignWorkerDto, actorId?: string) {
    await this.requireShift(shiftId);

    try {
      await this.prisma.shiftWorkerAssignment.create({
        data: {
          shiftId,
          workerId: dto.workerId,
          roleLabel: dto.roleLabel
        }
      });
    } catch {
      throw new ConflictException("Worker is already assigned to this shift.");
    }

    await this.refreshConflicts(shiftId);
    await this.auditService.write({
      actorId,
      action: "scheduler.worker.assign",
      entityType: "ShiftWorkerAssignment",
      entityId: shiftId,
      metadata: {
        shiftId,
        workerId: dto.workerId
      }
    });

    return this.getShift(shiftId);
  }

  async assignAsset(shiftId: string, dto: AssignAssetDto, actorId?: string) {
    await this.requireShift(shiftId);

    try {
      await this.prisma.shiftAssetAssignment.create({
        data: {
          shiftId,
          assetId: dto.assetId
        }
      });
    } catch {
      throw new ConflictException("Asset is already assigned to this shift.");
    }

    await this.refreshConflicts(shiftId);
    await this.auditService.write({
      actorId,
      action: "scheduler.asset.assign",
      entityType: "ShiftAssetAssignment",
      entityId: shiftId,
      metadata: {
        shiftId,
        assetId: dto.assetId
      }
    });

    return this.getShift(shiftId);
  }

  async unassignWorker(shiftId: string, workerId: string, actorId?: string) {
    await this.prisma.shiftWorkerAssignment.deleteMany({
      where: { shiftId, workerId }
    });
    await this.refreshConflicts(shiftId);
    await this.auditService.write({
      actorId,
      action: "scheduler.worker.unassign",
      entityType: "ShiftWorkerAssignment",
      entityId: shiftId,
      metadata: { shiftId, workerId }
    });
    return this.getShift(shiftId);
  }

  async unassignAsset(shiftId: string, assetId: string, actorId?: string) {
    await this.prisma.shiftAssetAssignment.deleteMany({
      where: { shiftId, assetId }
    });
    await this.refreshConflicts(shiftId);
    await this.auditService.write({
      actorId,
      action: "scheduler.asset.unassign",
      entityType: "ShiftAssetAssignment",
      entityId: shiftId,
      metadata: { shiftId, assetId }
    });
    return this.getShift(shiftId);
  }

  async getShift(shiftId: string) {
    return this.requireShift(shiftId);
  }

  private async requireShift(shiftId: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: shiftInclude
    });

    if (!shift) {
      throw new NotFoundException("Shift not found.");
    }

    return shift;
  }

  private async refreshConflicts(shiftId: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: refreshShiftInclude
    });

    if (!shift) {
      return;
    }

    await this.prisma.schedulingConflict.deleteMany({
      where: { shiftId }
    });

    const conflicts: Array<{ severity: string; code: string; message: string }> = [];

    for (const assignment of shift.workerAssignments) {
      const overlapping = await this.prisma.shiftWorkerAssignment.findMany({
        where: {
          workerId: assignment.worker.id,
          shiftId: { not: shiftId },
          shift: {
            startAt: { lt: shift.endAt },
            endAt: { gt: shift.startAt }
          }
        },
        include: {
          shift: true,
          worker: true
        }
      });

      if (overlapping.length > 0) {
        conflicts.push({
          severity: "RED",
          code: "WORKER_OVERLAP",
          message: `${overlapping[0].worker.firstName} ${overlapping[0].worker.lastName} is already allocated on an overlapping shift.`
        });
      }

      const unavailableWindow = assignment.worker.availabilityWindows.find(
        (window) =>
          window.status === "UNAVAILABLE" &&
          window.startAt < shift.endAt &&
          window.endAt > shift.startAt
      );

      if (unavailableWindow) {
        conflicts.push({
          severity: "RED",
          code: "WORKER_UNAVAILABLE",
          message: `${assignment.worker.firstName} ${assignment.worker.lastName} is marked unavailable during this shift.`
        });
      }
    }

    for (const requirement of shift.roleRequirements) {
      const matchingAssignments = shift.workerAssignments.filter(
        (assignment) => assignment.roleLabel?.toLowerCase() === requirement.roleLabel.toLowerCase()
      );

      if (matchingAssignments.length < requirement.requiredCount) {
        conflicts.push({
          severity: "AMBER",
          code: "ROLE_COVERAGE",
          message: `${requirement.roleLabel} requires ${requirement.requiredCount} assigned worker(s), but only ${matchingAssignments.length} are allocated.`
        });
      }

      for (const assignment of matchingAssignments) {
        const suitability = assignment.worker.roleSuitabilities.find(
          (record) => record.roleLabel.toLowerCase() === requirement.roleLabel.toLowerCase()
        );

        if (suitability?.suitability === "UNSUITABLE") {
          conflicts.push({
            severity: "AMBER",
            code: "ROLE_SUITABILITY",
            message: `${assignment.worker.firstName} ${assignment.worker.lastName} is flagged as unsuitable for ${requirement.roleLabel}.`
          });
        }

        if (requirement.competencyId) {
          const workerCompetency = assignment.worker.competencies.find(
            (record) => record.competencyId === requirement.competencyId
          );

          if (!workerCompetency) {
            conflicts.push({
              severity: "RED",
              code: "MISSING_COMPETENCY",
              message: `${assignment.worker.firstName} ${assignment.worker.lastName} does not hold ${requirement.competency?.name ?? "the required competency"}.`
            });
            continue;
          }

          if (workerCompetency.expiresAt && workerCompetency.expiresAt <= shift.endAt) {
            conflicts.push({
              severity: "AMBER",
              code: "COMPETENCY_EXPIRING",
              message: `${assignment.worker.firstName} ${assignment.worker.lastName} has ${workerCompetency.competency.name} expiring before or during this shift.`
            });
          }
        }
      }
    }

    for (const assignment of shift.assetAssignments) {
      const overlapping = await this.prisma.shiftAssetAssignment.findMany({
        where: {
          assetId: assignment.assetId,
          shiftId: { not: shiftId },
          shift: {
            startAt: { lt: shift.endAt },
            endAt: { gt: shift.startAt }
          }
        },
        include: {
          shift: true,
          asset: true
        }
      });

      if (overlapping.length > 0) {
        conflicts.push({
          severity: "RED",
          code: "ASSET_OVERLAP",
          message: `${overlapping[0].asset.name} is already allocated on an overlapping shift.`
        });
      }

      const maintenanceSummary = this.buildAssetMaintenanceSummary(assignment.asset);

      if (maintenanceSummary.schedulerImpact === "BLOCK") {
        conflicts.push({
          severity: "RED",
          code: "ASSET_MAINTENANCE_BLOCK",
          message: `${assignment.asset.name} is unavailable due to maintenance state ${maintenanceSummary.maintenanceState}.`
        });
      } else if (maintenanceSummary.schedulerImpact === "WARN") {
        conflicts.push({
          severity: "AMBER",
          code: "ASSET_MAINTENANCE_WARNING",
          message: `${assignment.asset.name} has maintenance state ${maintenanceSummary.maintenanceState}.`
        });
      }
    }

    if (shift.workerAssignments.length === 0 || shift.assetAssignments.length === 0) {
      conflicts.push({
        severity: "AMBER",
        code: "PARTIAL_ASSIGNMENT",
        message: "Shift still needs both worker and asset coverage reviewed."
      });
    }

    if (conflicts.length > 0) {
      await this.prisma.schedulingConflict.createMany({
        data: conflicts.map((conflict) => ({
          shiftId,
          ...conflict
        }))
      });
    }
  }

  private buildAssetMaintenanceSummary(asset: {
    status?: string;
    maintenancePlans: Array<{ nextDueAt: Date | null; warningDays: number; blockWhenOverdue: boolean; status: string }>;
    inspections: Array<{ status: string }>;
    breakdowns: Array<{ status: string }>;
  }) {
    const now = new Date();
    const openBreakdown = asset.breakdowns.some((breakdown) => breakdown.status !== "RESOLVED");
    const failedInspection = asset.inspections.some((inspection) => inspection.status === "FAIL");

    let maintenanceState = "COMPLIANT";
    let schedulerImpact = "NONE";

    for (const plan of asset.maintenancePlans.filter((item) => item.status === "ACTIVE" && item.nextDueAt)) {
      if (!plan.nextDueAt) continue;

      if (plan.nextDueAt < now) {
        maintenanceState = "OVERDUE";
        schedulerImpact = plan.blockWhenOverdue ? "BLOCK" : "WARN";
        break;
      }

      const warningAt = new Date(plan.nextDueAt);
      warningAt.setDate(warningAt.getDate() - plan.warningDays);
      if (warningAt <= now && maintenanceState !== "OVERDUE") {
        maintenanceState = "DUE_SOON";
        schedulerImpact = "WARN";
      }
    }

    if (openBreakdown || failedInspection || asset.status === "OUT_OF_SERVICE") {
      maintenanceState = "UNAVAILABLE";
      schedulerImpact = "BLOCK";
    } else if (asset.status === "MAINTENANCE" && schedulerImpact !== "BLOCK") {
      maintenanceState = "IN_MAINTENANCE";
      schedulerImpact = "WARN";
    }

    return {
      maintenanceState,
      schedulerImpact
    };
  }
}
