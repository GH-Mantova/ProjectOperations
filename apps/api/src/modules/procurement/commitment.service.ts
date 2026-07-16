import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  CommitmentChangeStatus,
  CommitmentStatus,
  CommitmentType,
  Prisma
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type {
  CreateCommitmentChangeDto,
  CreateCommitmentDto,
  ListCommitmentsQueryDto,
  UpdateCommitmentDto
} from "./dto/commitment.dto";

/**
 * Business logic for budget-facing commitment tracking (ERP gap A).
 *
 * A Commitment is the budget-facing record of a contracted spend obligation
 * against a Job. It is distinct from ProcurementRequest (an internal purchase-
 * requisition workflow), though the two may be linked via `purchaseOrderId`.
 *
 * Budget rollup: committedTotal = sum(APPROVED commitment values + their
 * approved CommitmentChanges). Rolled up on demand, not stored, so it is
 * always consistent with the current state.
 */
@Injectable()
export class CommitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private readonly commitmentInclude = {
    supplier: { select: { id: true, name: true } },
    items: true,
    changes: {
      include: {
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    },
    createdBy: { select: { id: true, firstName: true, lastName: true } }
  } satisfies Prisma.CommitmentInclude;

  // ── List / Get ─────────────────────────────────────────────────────────

  async listCommitments(query: ListCommitmentsQueryDto) {
    const where: Prisma.CommitmentWhereInput = {
      ...(query.jobId ? { jobId: query.jobId } : {}),
      ...(query.status ? { status: query.status as CommitmentStatus } : {})
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.commitment.findMany({
        where,
        include: this.commitmentInclude,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: query.pageSize
      }),
      this.prisma.commitment.count({ where })
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getCommitment(id: string) {
    const commitment = await this.prisma.commitment.findUnique({
      where: { id },
      include: this.commitmentInclude
    });
    if (!commitment) throw new NotFoundException("Commitment not found.");
    return commitment;
  }

  /**
   * Job budget summary — returns committed total, approved total, and a
   * per-commitment breakdown. "Committed" = all non-CANCELLED commitments
   * (shows the full obligation including DRAFTs so PMs can see what's in
   * flight). "Approved" = only APPROVED or CLOSED commitments.
   */
  async getJobBudgetSummary(jobId: string) {
    const commitments = await this.prisma.commitment.findMany({
      where: { jobId, status: { not: CommitmentStatus.CANCELLED } },
      include: {
        supplier: { select: { id: true, name: true } },
        changes: { where: { status: CommitmentChangeStatus.APPROVED } }
      },
      orderBy: [{ createdAt: "asc" }]
    });

    let committedTotal = new Prisma.Decimal(0);
    let approvedTotal = new Prisma.Decimal(0);

    const breakdown = commitments.map((c) => {
      const approvedChangesSum = c.changes.reduce(
        (sum, ch) => sum.add(new Prisma.Decimal(ch.valueChange)),
        new Prisma.Decimal(0)
      );
      const adjustedValue = new Prisma.Decimal(c.value).add(approvedChangesSum);

      committedTotal = committedTotal.add(adjustedValue);
      if (c.status === CommitmentStatus.APPROVED || c.status === CommitmentStatus.CLOSED) {
        approvedTotal = approvedTotal.add(adjustedValue);
      }

      return {
        id: c.id,
        reference: c.reference,
        description: c.description,
        type: c.type,
        status: c.status,
        supplier: c.supplier,
        originalValue: c.value,
        approvedChangesSum,
        adjustedValue
      };
    });

    return {
      jobId,
      committedTotal,
      approvedTotal,
      commitments: breakdown
    };
  }

  // ── Create / Update ────────────────────────────────────────────────────

  async createCommitment(dto: CreateCommitmentDto, actorId: string) {
    // Validate job exists
    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      select: { id: true }
    });
    if (!job) throw new NotFoundException(`Job ${dto.jobId} not found.`);

    const created = await this.prisma.commitment.create({
      data: {
        jobId: dto.jobId,
        type: dto.type as CommitmentType,
        supplierId: dto.supplierId ?? null,
        reference: dto.reference,
        description: dto.description,
        value: new Prisma.Decimal(dto.value),
        purchaseOrderId: dto.purchaseOrderId ?? null,
        createdById: actorId,
        items: dto.items
          ? {
              create: dto.items.map((item) => ({
                description: item.description,
                costCategory: item.costCategory ?? null,
                quantity:
                  item.quantity !== undefined
                    ? new Prisma.Decimal(item.quantity)
                    : new Prisma.Decimal(1),
                unit: item.unit ?? "lump",
                rate:
                  item.rate !== undefined ? new Prisma.Decimal(item.rate) : null,
                amount: new Prisma.Decimal(item.amount)
              }))
            }
          : undefined
      },
      include: this.commitmentInclude
    });

    await this.audit.write({
      actorId,
      action: "commitment.create",
      entityType: "Commitment",
      entityId: created.id,
      metadata: { jobId: dto.jobId, type: dto.type, value: dto.value }
    });

    return created;
  }

  async updateCommitment(id: string, dto: UpdateCommitmentDto, actorId: string) {
    const existing = await this.getCommitment(id);

    if (
      existing.status === CommitmentStatus.CLOSED ||
      existing.status === CommitmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot edit a commitment in ${existing.status} status.`
      );
    }

    // Use UncheckedUpdateInput to address scalar FK fields (supplierId,
    // purchaseOrderId) directly without the nested relation wrapper.
    const data: Prisma.CommitmentUncheckedUpdateInput = {};
    if (dto.type !== undefined) data.type = dto.type as CommitmentType;
    if (dto.supplierId !== undefined) data.supplierId = dto.supplierId;
    if (dto.reference !== undefined) data.reference = dto.reference;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.value !== undefined) data.value = new Prisma.Decimal(dto.value);
    if (dto.purchaseOrderId !== undefined) data.purchaseOrderId = dto.purchaseOrderId;

    if (dto.items !== undefined) {
      await this.prisma.commitmentItem.deleteMany({ where: { commitmentId: id } });
      await this.prisma.commitmentItem.createMany({
        data: dto.items.map((item) => ({
          commitmentId: id,
          description: item.description,
          costCategory: item.costCategory ?? null,
          quantity:
            item.quantity !== undefined
              ? new Prisma.Decimal(item.quantity)
              : new Prisma.Decimal(1),
          unit: item.unit ?? "lump",
          rate: item.rate !== undefined ? new Prisma.Decimal(item.rate) : null,
          amount: new Prisma.Decimal(item.amount)
        }))
      });
    }

    const updated = await this.prisma.commitment.update({
      where: { id },
      data,
      include: this.commitmentInclude
    });

    await this.audit.write({
      actorId,
      action: "commitment.update",
      entityType: "Commitment",
      entityId: id
    });

    return updated;
  }

  // ── Status transitions ─────────────────────────────────────────────────

  async approveCommitment(id: string, actorId: string) {
    const existing = await this.getCommitment(id);
    if (existing.status !== CommitmentStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT commitments can be approved.");
    }
    const updated = await this.prisma.commitment.update({
      where: { id },
      data: { status: CommitmentStatus.APPROVED },
      include: this.commitmentInclude
    });
    await this.audit.write({
      actorId,
      action: "commitment.approve",
      entityType: "Commitment",
      entityId: id
    });
    return updated;
  }

  async closeCommitment(id: string, actorId: string) {
    const existing = await this.getCommitment(id);
    if (existing.status !== CommitmentStatus.APPROVED) {
      throw new BadRequestException("Only APPROVED commitments can be closed.");
    }
    const updated = await this.prisma.commitment.update({
      where: { id },
      data: { status: CommitmentStatus.CLOSED },
      include: this.commitmentInclude
    });
    await this.audit.write({
      actorId,
      action: "commitment.close",
      entityType: "Commitment",
      entityId: id
    });
    return updated;
  }

  async cancelCommitment(id: string, actorId: string) {
    const existing = await this.getCommitment(id);
    if (
      existing.status === CommitmentStatus.CLOSED ||
      existing.status === CommitmentStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel a commitment in ${existing.status} status.`
      );
    }
    const updated = await this.prisma.commitment.update({
      where: { id },
      data: { status: CommitmentStatus.CANCELLED },
      include: this.commitmentInclude
    });
    await this.audit.write({
      actorId,
      action: "commitment.cancel",
      entityType: "Commitment",
      entityId: id
    });
    return updated;
  }

  // ── Commitment Changes (variations) ────────────────────────────────────

  async addChange(
    commitmentId: string,
    dto: CreateCommitmentChangeDto,
    actorId: string
  ) {
    const commitment = await this.getCommitment(commitmentId);
    if (commitment.status === CommitmentStatus.CANCELLED) {
      throw new BadRequestException("Cannot add a change to a CANCELLED commitment.");
    }

    const change = await this.prisma.commitmentChange.create({
      data: {
        commitmentId,
        reference: dto.reference,
        description: dto.description,
        valueChange: new Prisma.Decimal(dto.valueChange),
        createdById: actorId
      },
      include: {
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    await this.audit.write({
      actorId,
      action: "commitment.change.create",
      entityType: "CommitmentChange",
      entityId: change.id,
      metadata: { commitmentId, valueChange: dto.valueChange }
    });

    return change;
  }

  async approveChange(changeId: string, actorId: string) {
    const change = await this.prisma.commitmentChange.findUnique({
      where: { id: changeId }
    });
    if (!change) throw new NotFoundException("Commitment change not found.");
    if (change.status !== CommitmentChangeStatus.PENDING) {
      throw new BadRequestException("Only PENDING changes can be approved.");
    }

    const updated = await this.prisma.commitmentChange.update({
      where: { id: changeId },
      data: {
        status: CommitmentChangeStatus.APPROVED,
        approvedById: actorId
      },
      include: {
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    await this.audit.write({
      actorId,
      action: "commitment.change.approve",
      entityType: "CommitmentChange",
      entityId: changeId
    });

    return updated;
  }
}
