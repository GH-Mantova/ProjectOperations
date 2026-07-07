import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import {
  Prisma,
  ProcurementLineCategory,
  ProcurementRequestStatus,
  StockMovementType
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthorityService } from "../authorization/authority.service";
import { EmailService } from "../email/email.service";
import { InventoryService } from "../inventory/inventory.service";
import { StockMovementTypeDto } from "../inventory/dto/inventory.dto";
import type {
  CreateProcurementRequestDto,
  IssuePurchaseOrderDto,
  ListProcurementRequestsQueryDto,
  ProcurementLineInputDto,
  SubmitProcurementRequestDto,
  UpdateProcurementRequestDto
} from "./dto/procurement.dto";

const PROCUREMENT_APPROVE_ACTION = "procurement.purchase.approve";
const CONFIG_SINGLETON_ID = "singleton";

// Fallback thresholds used only if ProcurementConfig singleton has not been
// seeded. Real values live in the DB (config-driven, not hardcoded logic).
const FALLBACK_CONFIG = {
  minQuoteThreshold: new Prisma.Decimal(5000),
  requiredQuotesAtMin: 3,
  rfqThreshold: new Prisma.Decimal(20000)
};

/**
 * Business logic for the procurement request → approval → PO / receipt spine
 * (PR-488 slice 1). Extends existing supplier / credit-ledger records —
 * never rewrites them — and routes every over-limit spend through the
 * authority seam (AuthorityService.check). Receipt posts a RECEIVE
 * StockMovement through the inventory layer.
 *
 * Deferred branch (see submitRequest): out-of-allowance / job-budget
 * escalation to Estimator or Director. Left as a marked TODO because the
 * job-budget entity does not yet exist.
 */
@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly authority: AuthorityService,
    private readonly email: EmailService,
    private readonly inventory: InventoryService
  ) {}

  // ── Reads ──────────────────────────────────────────────────────────────

  async listRequests(query: ListProcurementRequestsQueryDto) {
    const where: Prisma.ProcurementRequestWhereInput = {
      ...(query.status ? { status: query.status as ProcurementRequestStatus } : {})
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.procurementRequest.findMany({
        where,
        include: { lines: true, purchaseOrders: true },
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: query.pageSize
      }),
      this.prisma.procurementRequest.count({ where })
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getRequest(id: string) {
    const request = await this.prisma.procurementRequest.findUnique({
      where: { id },
      include: { lines: true, purchaseOrders: true }
    });
    if (!request) throw new NotFoundException("Procurement request not found.");
    return request;
  }

  // ── Draft / Edit ───────────────────────────────────────────────────────

  async createRequest(dto: CreateProcurementRequestDto, actorId: string) {
    const reference = await this.nextReference();
    const totals = this.computeLineTotals(dto.lines);

    const created = await this.prisma.procurementRequest.create({
      data: {
        reference,
        originUserId: actorId,
        originDepartment: dto.originDepartment ?? null,
        jobId: dto.jobId ?? null,
        supplierId: dto.supplierId ?? null,
        notes: dto.notes ?? null,
        lines: { create: totals.rows }
      },
      include: { lines: true, purchaseOrders: true }
    });

    await this.audit.write({
      actorId,
      action: "procurement.request.create",
      entityType: "ProcurementRequest",
      entityId: created.id
    });

    return created;
  }

  async updateRequest(id: string, dto: UpdateProcurementRequestDto, actorId: string) {
    const existing = await this.getRequest(id);
    if (existing.status !== ProcurementRequestStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT requests can be edited.");
    }

    const data: Prisma.ProcurementRequestUpdateInput = {};
    if (dto.originDepartment !== undefined) data.originDepartment = dto.originDepartment;
    if (dto.jobId !== undefined) data.jobId = dto.jobId;
    if (dto.supplierId !== undefined) data.supplierId = dto.supplierId;
    if (dto.notes !== undefined) data.notes = dto.notes;

    if (dto.lines) {
      const totals = this.computeLineTotals(dto.lines);
      await this.prisma.procurementLine.deleteMany({ where: { requestId: id } });
      await this.prisma.procurementLine.createMany({
        data: totals.rows.map((row) => ({ ...row, requestId: id }))
      });
    }

    const updated = await this.prisma.procurementRequest.update({
      where: { id },
      data,
      include: { lines: true, purchaseOrders: true }
    });

    await this.audit.write({
      actorId,
      action: "procurement.request.update",
      entityType: "ProcurementRequest",
      entityId: id
    });

    return updated;
  }

  async cancelRequest(id: string, actorId: string) {
    const existing = await this.getRequest(id);
    if (
      existing.status === ProcurementRequestStatus.RECEIVED ||
      existing.status === ProcurementRequestStatus.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel a request in ${existing.status} status.`
      );
    }

    const updated = await this.prisma.procurementRequest.update({
      where: { id },
      data: {
        status: ProcurementRequestStatus.CANCELLED,
        cancelledAt: new Date()
      },
      include: { lines: true, purchaseOrders: true }
    });

    await this.audit.write({
      actorId,
      action: "procurement.request.cancel",
      entityType: "ProcurementRequest",
      entityId: id
    });

    return updated;
  }

  // ── Submit / Approve ───────────────────────────────────────────────────

  /**
   * Submit a DRAFT for approval routing.
   *
   * Sourcing gate: the value-band thresholds live on `ProcurementConfig`
   * (seed data). If the request total meets or exceeds `minQuoteThreshold`
   * the submitter must supply `quoteEvidenceRef` — the reference proving
   * the required number of quotes (3 by default) has been collected.
   *
   * Approval routing: delegates to AuthorityService.check with the summed
   * total. Under-limit or no-rule matches auto-approve (open ceiling);
   * over-limit sets SUBMITTED with `requiresEscalation` and, where the
   * matching rule names one, `approverUserId`.
   *
   * TODO — Out-of-allowance / job-budget branch:
   *   Once Job carries an approved budget + committed-spend rollup, an
   *   over-budget request must escalate to the project's Estimator (and
   *   Director on further breach), independent of the authority seam. This
   *   is deferred; the hook sits here so consumers see the shape of the
   *   coming change.
   */
  async submitRequest(id: string, dto: SubmitProcurementRequestDto, actorId: string) {
    const existing = await this.getRequest(id);
    if (existing.status !== ProcurementRequestStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT requests can be submitted.");
    }
    if (existing.lines.length === 0) {
      throw new BadRequestException("Request has no lines.");
    }

    const config = await this.loadConfig();
    const total = existing.lines.reduce(
      (sum, line) =>
        sum.add(
          line.lineTotal
            ? new Prisma.Decimal(line.lineTotal)
            : new Prisma.Decimal(0)
        ),
      new Prisma.Decimal(0)
    );

    const quoteEvidenceRef = dto.quoteEvidenceRef ?? existing.quoteEvidenceRef ?? null;
    if (total.gte(config.minQuoteThreshold) && !quoteEvidenceRef) {
      throw new BadRequestException(
        `Sourcing gate: totals at or above ${config.minQuoteThreshold.toString()} require quote evidence — attach the ${config.requiredQuotesAtMin}-quote pack (or the RFQ reference above ${config.rfqThreshold.toString()}) and resubmit.`
      );
    }

    const decision = await this.authority.check({
      userId: actorId,
      action: PROCUREMENT_APPROVE_ACTION,
      amount: Number(total)
    });

    const nowStatus = decision.allowed
      ? ProcurementRequestStatus.APPROVED
      : ProcurementRequestStatus.SUBMITTED;

    const updated = await this.prisma.procurementRequest.update({
      where: { id },
      data: {
        status: nowStatus,
        submittedAt: new Date(),
        approvedAt: decision.allowed ? new Date() : null,
        approverUserId: decision.escalateToUserId ?? null,
        requiresEscalation: decision.requiresEscalation,
        authorityRuleId: decision.matchedRuleId ?? null,
        quoteEvidenceRef
      },
      include: { lines: true, purchaseOrders: true }
    });

    if (decision.requiresEscalation && decision.escalateToUserId) {
      await this.notifyApprover(decision.escalateToUserId, updated.reference, total);
    }

    await this.audit.write({
      actorId,
      action: "procurement.request.submit",
      entityType: "ProcurementRequest",
      entityId: id,
      metadata: {
        total: total.toString(),
        allowed: decision.allowed,
        requiresEscalation: decision.requiresEscalation,
        matchedRuleId: decision.matchedRuleId ?? null
      }
    });

    return updated;
  }

  async approveRequest(id: string, actorId: string) {
    const existing = await this.getRequest(id);
    if (existing.status !== ProcurementRequestStatus.SUBMITTED) {
      throw new BadRequestException("Only SUBMITTED requests can be approved.");
    }

    const updated = await this.prisma.procurementRequest.update({
      where: { id },
      data: {
        status: ProcurementRequestStatus.APPROVED,
        approvedAt: new Date(),
        approverUserId: actorId,
        requiresEscalation: false
      },
      include: { lines: true, purchaseOrders: true }
    });

    await this.audit.write({
      actorId,
      action: "procurement.request.approve",
      entityType: "ProcurementRequest",
      entityId: id
    });

    return updated;
  }

  // ── Issue PO ───────────────────────────────────────────────────────────

  async issuePurchaseOrder(id: string, dto: IssuePurchaseOrderDto, actorId: string) {
    const existing = await this.getRequest(id);
    if (existing.status !== ProcurementRequestStatus.APPROVED) {
      throw new BadRequestException(
        "Only APPROVED requests can be issued as a purchase order."
      );
    }
    if (!existing.supplierId) {
      throw new BadRequestException(
        "Set a supplier on the request before issuing a purchase order."
      );
    }

    const supplier = await this.prisma.subcontractorSupplier.findUnique({
      where: { id: existing.supplierId },
      select: { id: true, name: true, email: true }
    });
    if (!supplier) throw new NotFoundException("Supplier not found.");

    const poNumber = await this.nextPurchaseOrderNumber();

    const po = await this.prisma.purchaseOrder.create({
      data: {
        requestId: id,
        poNumber,
        issuedToSupplierId: supplier.id,
        issuedByUserId: actorId,
        documentRef: dto.documentRef ?? null
      }
    });

    // Email is a side-effect — never let a mail failure roll back the PO.
    let emailedAt: Date | null = null;
    if (supplier.email) {
      try {
        const provider = await this.email.resolveProvider();
        const subject = `Purchase Order ${poNumber} — ${existing.reference}`;
        const bodyText = this.buildPoEmailText(existing.reference, poNumber, supplier.name);
        const bodyHtml = this.buildPoEmailHtml(existing.reference, poNumber, supplier.name);
        await provider.sendMail({
          to: [supplier.email],
          subject,
          html: bodyHtml,
          text: bodyText
        });
        emailedAt = new Date();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`PO ${poNumber} email failed: ${msg}`);
      }
    }

    await this.prisma.procurementRequest.update({
      where: { id },
      data: {
        status: ProcurementRequestStatus.ISSUED,
        issuedAt: new Date()
      }
    });

    if (emailedAt) {
      await this.prisma.purchaseOrder.update({
        where: { id: po.id },
        data: { emailSentAt: emailedAt }
      });
    }

    await this.audit.write({
      actorId,
      action: "procurement.po.issue",
      entityType: "PurchaseOrder",
      entityId: po.id,
      metadata: { poNumber, supplierId: supplier.id, requestId: id }
    });

    return this.getRequest(id);
  }

  // ── Receive ────────────────────────────────────────────────────────────

  /**
   * Post a receipt against an ISSUED request. Every line with a
   * `stockItemId` produces a RECEIVE StockMovement through the inventory
   * layer (which handles the atomic on-hand update + its own audit trail).
   */
  async receiveRequest(id: string, actorId: string) {
    const existing = await this.getRequest(id);
    if (existing.status !== ProcurementRequestStatus.ISSUED) {
      throw new BadRequestException(
        "Only ISSUED requests can be marked as received."
      );
    }

    for (const line of existing.lines) {
      if (!line.stockItemId) continue;
      await this.inventory.postMovement(
        line.stockItemId,
        {
          type: StockMovementTypeDto.RECEIVE,
          quantity: Number(line.quantity),
          refType: "ProcurementRequest",
          refId: id,
          reason: `Receipt for ${existing.reference}`
        },
        actorId
      );
    }

    const updated = await this.prisma.procurementRequest.update({
      where: { id },
      data: {
        status: ProcurementRequestStatus.RECEIVED,
        receivedAt: new Date()
      },
      include: { lines: true, purchaseOrders: true }
    });

    await this.audit.write({
      actorId,
      action: "procurement.request.receive",
      entityType: "ProcurementRequest",
      entityId: id
    });

    return updated;
  }

  // ── Config ─────────────────────────────────────────────────────────────

  /** Sourcing thresholds. Returns the seeded singleton or safe defaults. */
  async loadConfig() {
    const row = await this.prisma.procurementConfig.findUnique({
      where: { id: CONFIG_SINGLETON_ID }
    });
    if (!row) return FALLBACK_CONFIG;
    return {
      minQuoteThreshold: new Prisma.Decimal(row.minQuoteThreshold),
      requiredQuotesAtMin: row.requiredQuotesAtMin,
      rfqThreshold: new Prisma.Decimal(row.rfqThreshold)
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private computeLineTotals(lines: ProcurementLineInputDto[]) {
    const rows = lines.map((line) => {
      const quantity = new Prisma.Decimal(line.quantity);
      const unitPrice =
        line.unitPrice !== undefined ? new Prisma.Decimal(line.unitPrice) : null;
      const lineTotal = unitPrice ? quantity.mul(unitPrice) : null;
      return {
        description: line.description,
        category: line.category as ProcurementLineCategory,
        stockItemId: line.stockItemId ?? null,
        quantity,
        unit: line.unit,
        unitPrice,
        lineTotal
      };
    });
    return { rows };
  }

  private async nextReference(): Promise<string> {
    const count = await this.prisma.procurementRequest.count();
    return `PR-${String(count + 1).padStart(6, "0")}`;
  }

  private async nextPurchaseOrderNumber(): Promise<string> {
    const count = await this.prisma.purchaseOrder.count();
    const candidate = `PO-${String(count + 1).padStart(6, "0")}`;
    const clash = await this.prisma.purchaseOrder.findUnique({
      where: { poNumber: candidate }
    });
    if (clash) {
      throw new ConflictException(
        "Purchase order number clash — retry the issue action."
      );
    }
    return candidate;
  }

  private async notifyApprover(
    approverUserId: string,
    reference: string,
    total: Prisma.Decimal
  ) {
    try {
      await this.prisma.notification.create({
        data: {
          userId: approverUserId,
          title: `Procurement approval required: ${reference}`,
          body: `Request ${reference} totalling $${total.toFixed(2)} exceeds your delegated limit and needs your approval.`,
          severity: "info",
          linkUrl: `/procurement/${reference}`
        }
      });
    } catch (err) {
      // Notification is best-effort — never break the submit path.
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`approver notification failed: ${msg}`);
    }
  }

  private buildPoEmailText(reference: string, poNumber: string, supplierName: string) {
    return [
      `Hi ${supplierName},`,
      "",
      `Please find attached Purchase Order ${poNumber} against our procurement request ${reference}.`,
      "",
      "Reply to this email if you need any clarification.",
      "",
      "Initial Services"
    ].join("\n");
  }

  private buildPoEmailHtml(reference: string, poNumber: string, supplierName: string) {
    return `<p>Hi ${escapeHtml(supplierName)},</p>
<p>Please find attached Purchase Order <strong>${escapeHtml(poNumber)}</strong> against our procurement request ${escapeHtml(reference)}.</p>
<p>Reply to this email if you need any clarification.</p>
<p>Initial Services</p>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
