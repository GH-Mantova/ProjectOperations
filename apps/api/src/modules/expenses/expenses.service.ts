import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional
} from "@nestjs/common";
import { ExpenseStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthorityService } from "../authorization/authority.service";
import { XeroService } from "../xero/xero.service";
import type {
  CreateExpenseDto,
  ListExpensesQueryDto,
  RejectExpenseDto,
  UpdateExpenseDto
} from "./dto/expense.dto";

const EXPENSE_APPROVE_ACTION = "expenses.approve";

/**
 * Business logic for the expense capture + approval spine (D365-parity Tier 1).
 *
 * Numbers follow the EXP-YYYY-NNN format, backed by ExpenseNumberSequence
 * (one row per calendar year, incremented inside a transaction). Approval is
 * routed through AuthorityService.check with the "expenses.approve" key so
 * the Director can configure spend ceilings without touching code.
 *
 * Status transitions:
 *   DRAFT → SUBMITTED (by submitter)
 *   SUBMITTED → APPROVED | REJECTED (by approver holding expenses.approve)
 *   APPROVED → REIMBURSED (by admin/finance)
 *   REJECTED → DRAFT (edit and re-submit)
 *
 * Xero-deepening: on approval, pushBill is called fire-and-forget.
 * The expense approval succeeds regardless of Xero availability.
 */
@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly authority: AuthorityService,
    // Optional so that the module can boot without Xero configured.
    // When present, a bill is pushed to Xero on every expense approval.
    @Optional() private readonly xeroService: XeroService | null
  ) {}

  // ── Reads ──────────────────────────────────────────────────────────────

  async listExpenses(query: ListExpensesQueryDto) {
    const where: Prisma.ExpenseWhereInput = {};
    if (query.status) where.status = query.status as ExpenseStatus;
    if (query.submittedById) where.submittedById = query.submittedById;
    if (query.projectId) where.projectId = query.projectId;
    if (query.jobId) where.jobId = query.jobId;

    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        include: {
          submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          project: { select: { id: true, projectNumber: true, name: true } },
          job: { select: { id: true, jobNumber: true } }
        },
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: query.pageSize
      }),
      this.prisma.expense.count({ where })
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getExpense(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        project: { select: { id: true, projectNumber: true, name: true } },
        job: { select: { id: true, jobNumber: true } },
        receiptDocument: { select: { id: true, title: true, category: true } }
      }
    });
    if (!expense) throw new NotFoundException("Expense not found.");
    return expense;
  }

  // ── DRAFT / Edit ───────────────────────────────────────────────────────

  async createExpense(dto: CreateExpenseDto, actorId: string) {
    const number = await this.nextExpenseNumber();

    const expense = await this.prisma.expense.create({
      data: {
        number,
        submittedById: actorId,
        projectId: dto.projectId ?? null,
        jobId: dto.jobId ?? null,
        category: dto.category,
        description: dto.description,
        spentOn: new Date(dto.spentOn),
        amount: new Prisma.Decimal(dto.amount),
        gst: dto.gst !== undefined ? new Prisma.Decimal(dto.gst) : null,
        paymentMethod: dto.paymentMethod ?? null,
        receiptDocumentId: dto.receiptDocumentId ?? null,
        notes: dto.notes ?? null,
        status: ExpenseStatus.DRAFT
      },
      include: {
        submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });

    await this.audit.write({
      actorId,
      action: "expense.create",
      entityType: "Expense",
      entityId: expense.id,
      metadata: { number: expense.number, amount: dto.amount }
    });

    return expense;
  }

  async updateExpense(id: string, dto: UpdateExpenseDto, actorId: string) {
    const existing = await this.requireExpense(id);
    if (existing.status !== ExpenseStatus.DRAFT && existing.status !== ExpenseStatus.REJECTED) {
      throw new BadRequestException(
        "Only DRAFT or REJECTED expenses can be edited."
      );
    }

    const data: Prisma.ExpenseUpdateInput = {};
    if (dto.projectId !== undefined) {
      data.project = dto.projectId ? { connect: { id: dto.projectId } } : { disconnect: true };
    }
    if (dto.jobId !== undefined) {
      data.job = dto.jobId ? { connect: { id: dto.jobId } } : { disconnect: true };
    }
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.spentOn !== undefined) data.spentOn = new Date(dto.spentOn);
    if (dto.amount !== undefined) data.amount = new Prisma.Decimal(dto.amount);
    if (dto.gst !== undefined) data.gst = new Prisma.Decimal(dto.gst);
    if (dto.paymentMethod !== undefined) data.paymentMethod = dto.paymentMethod;
    if (dto.receiptDocumentId !== undefined) {
      data.receiptDocument = dto.receiptDocumentId
        ? { connect: { id: dto.receiptDocumentId } }
        : { disconnect: true };
    }
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.prisma.expense.update({
      where: { id },
      data,
      include: {
        submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });

    await this.audit.write({
      actorId,
      action: "expense.update",
      entityType: "Expense",
      entityId: id
    });

    return updated;
  }

  // ── Status transitions ─────────────────────────────────────────────────

  async submitExpense(id: string, actorId: string) {
    const existing = await this.requireExpense(id);
    if (existing.submittedById !== actorId) {
      throw new ForbiddenException("Only the expense submitter can submit it.");
    }
    if (existing.status !== ExpenseStatus.DRAFT && existing.status !== ExpenseStatus.REJECTED) {
      throw new BadRequestException(
        `Cannot submit an expense in ${existing.status} status. Only DRAFT or REJECTED expenses can be submitted.`
      );
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: { status: ExpenseStatus.SUBMITTED, rejectionReason: null }
    });

    await this.audit.write({
      actorId,
      action: "expense.submit",
      entityType: "Expense",
      entityId: id
    });

    return updated;
  }

  async approveExpense(id: string, actorId: string) {
    const existing = await this.requireExpense(id);
    if (existing.status !== ExpenseStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot approve an expense in ${existing.status} status. Only SUBMITTED expenses can be approved.`
      );
    }

    // Route through the authority seam — the Director configures the ceiling.
    const decision = await this.authority.check({
      userId: actorId,
      action: EXPENSE_APPROVE_ACTION,
      amount: Number(existing.amount)
    });

    if (!decision.allowed) {
      throw new ForbiddenException(
        decision.escalateToUserId
          ? `This expense amount exceeds your approval authority. Please escalate to the configured approver (${decision.escalateToUserId}).`
          : "This expense amount exceeds your approval authority."
      );
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        status: ExpenseStatus.APPROVED,
        approvedById: actorId,
        approvedAt: new Date(),
        rejectionReason: null
      }
    });

    await this.audit.write({
      actorId,
      action: "expense.approve",
      entityType: "Expense",
      entityId: id,
      metadata: { amount: existing.amount?.toString() ?? null }
    });

    // Xero-deepening: fire-and-forget bill push after approval.
    // The expense record is already saved — Xero failure does NOT roll back the
    // approval. Failed pushes are queued in XeroSyncLog (pending_retry) and
    // retried automatically by XeroService.replayFailedBillPushes.
    if (this.xeroService) {
      void this.xeroService.pushBill(id, actorId).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `approveExpense: Xero pushBill failed for expense ${id}: ${message} ` +
            "(expense approval not affected)"
        );
      });
    }

    return updated;
  }

  async rejectExpense(id: string, dto: RejectExpenseDto, actorId: string) {
    const existing = await this.requireExpense(id);
    if (existing.status !== ExpenseStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot reject an expense in ${existing.status} status. Only SUBMITTED expenses can be rejected.`
      );
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        status: ExpenseStatus.REJECTED,
        rejectionReason: dto.rejectionReason
      }
    });

    await this.audit.write({
      actorId,
      action: "expense.reject",
      entityType: "Expense",
      entityId: id,
      metadata: { rejectionReason: dto.rejectionReason }
    });

    return updated;
  }

  async reimburseExpense(id: string, actorId: string) {
    const existing = await this.requireExpense(id);
    if (existing.status !== ExpenseStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot mark an expense as REIMBURSED in ${existing.status} status. Only APPROVED expenses can be reimbursed.`
      );
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: { status: ExpenseStatus.REIMBURSED }
    });

    await this.audit.write({
      actorId,
      action: "expense.reimburse",
      entityType: "Expense",
      entityId: id
    });

    return updated;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async requireExpense(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException("Expense not found.");
    return expense;
  }

  /**
   * Generate the next EXP-YYYY-NNN reference. Uses a per-year row in
   * ExpenseNumberSequence, incremented atomically inside a transaction to
   * prevent gaps or duplicates under concurrent load.
   */
  private async nextExpenseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.expenseNumberSequence.upsert({
        where: { year },
        create: { year, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } }
      });
      return `EXP-${year}-${String(row.lastNumber).padStart(3, "0")}`;
    });
  }
}
