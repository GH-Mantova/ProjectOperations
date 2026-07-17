import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { InvoiceMatchStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthorityService } from "../authorization/authority.service";
import type {
  ApproveInvoiceVarianceDto,
  CreateVendorInvoiceDto,
  ListVendorInvoicesQueryDto,
  ReconcilePoDto,
  VendorInvoiceLineInputDto
} from "./dto/vendor-invoice.dto";

/** Authority action key for variance approval. */
const VARIANCE_APPROVE_ACTION = "procurement.invoice.variance.approve";

/**
 * Three-way match service (PR-629 slice 3).
 *
 * A VendorInvoice is posted against a PurchaseOrder and immediately
 * matched against the PO lines (ordered) and the goods receipt
 * quantities (received) recorded on the parent ProcurementRequest.
 *
 * Match algorithm per line:
 *   qtyVariance   = billedQty   - receivedQty   (positive = over-billed qty)
 *   priceVariance = billedUnitPrice - orderedUnitPrice  (positive = price increase)
 *
 * Tolerance is read from ProcurementConfig (matchQtyTolerancePct /
 * matchPriceTolerancePct). The fallback is 0 % (exact match required)
 * so the system defaults to strict and is loosened by config.
 *
 * If ALL lines are within tolerance → invoice moves to MATCHED (ready-to-pay).
 * If ANY line exceeds tolerance    → invoice moves to HELD (variance approval
 * required via the AuthorityService seam).
 *
 * Approving a HELD invoice routes through AuthorityService.check the same
 * way the procurement request approval does.
 *
 * ReconcilePo closes the PO once all its invoices are MATCHED or APPROVED,
 * writing a PoReconcileAudit record for the project-close audit.
 *
 * What is NOT done here (deferred by the work order):
 *  - Pushing the matched bill to Xero (Xero-deepening slice).
 *  - Auto-payment — operator initiates payment manually.
 *  - A separate GoodsReceipt model — we read receivedQty from the
 *    ProcurementLine as-supplied by the caller (who reads the RECEIVED
 *    request lines). Future slice can refine.
 */
@Injectable()
export class VendorInvoiceService {
  private readonly logger = new Logger(VendorInvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly authority: AuthorityService
  ) {}

  // ── Reads ──────────────────────────────────────────────────────────────

  async listInvoices(poId: string, query: ListVendorInvoicesQueryDto) {
    await this.loadPo(poId);
    const where: Prisma.VendorInvoiceWhereInput = {
      purchaseOrderId: poId,
      ...(query.status ? { matchStatus: query.status as InvoiceMatchStatus } : {})
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.vendorInvoice.findMany({
        where,
        include: { lines: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: query.pageSize
      }),
      this.prisma.vendorInvoice.count({ where })
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getInvoice(id: string) {
    const inv = await this.prisma.vendorInvoice.findUnique({
      where: { id },
      include: { lines: true }
    });
    if (!inv) throw new NotFoundException("Vendor invoice not found.");
    return inv;
  }

  async getPoReconcileAudit(poId: string) {
    await this.loadPo(poId);
    const audit = await this.prisma.poReconcileAudit.findUnique({
      where: { purchaseOrderId: poId }
    });
    if (!audit) throw new NotFoundException("No reconcile audit for this PO.");
    return audit;
  }

  // ── Create + Match ─────────────────────────────────────────────────────

  /**
   * Post a vendor invoice against a PurchaseOrder and run the 3-way match.
   *
   * Steps:
   * 1. Validate: PO must exist; no duplicate invoice number on this PO.
   * 2. Load tolerance from ProcurementConfig.
   * 3. Build line records, computing variance flags.
   * 4. Determine overall match status (MATCHED / HELD).
   * 5. Persist VendorInvoice + lines in a single transaction.
   * 6. Write audit trail.
   */
  async createInvoice(
    poId: string,
    dto: CreateVendorInvoiceDto,
    actorId: string
  ) {
    const po = await this.loadPo(poId);

    // Duplicate guard
    const existing = await this.prisma.vendorInvoice.findUnique({
      where: {
        purchaseOrderId_invoiceNumber: {
          purchaseOrderId: poId,
          invoiceNumber: dto.invoiceNumber
        }
      }
    });
    if (existing) {
      throw new ConflictException(
        `Invoice ${dto.invoiceNumber} already posted against PO ${po.poNumber}.`
      );
    }

    const { qtyTolerancePct, priceTolerancePct } = await this.loadTolerances();

    // Compute line records with variance flags
    const lineData = this.buildLineRecords(dto.lines, qtyTolerancePct, priceTolerancePct);
    const invoicedTotal = lineData.reduce(
      (sum, l) => sum.add(l.billedLineTotal),
      new Prisma.Decimal(0)
    );

    const allWithinTolerance = lineData.every((l) => l.withinTolerance);
    const matchStatus: InvoiceMatchStatus = allWithinTolerance
      ? InvoiceMatchStatus.MATCHED
      : InvoiceMatchStatus.HELD;

    const invoice = await this.prisma.vendorInvoice.create({
      data: {
        purchaseOrderId: poId,
        invoiceNumber: dto.invoiceNumber,
        supplierId: po.issuedToSupplierId,
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        currencyCode: dto.currencyCode ?? "AUD",
        invoicedTotal,
        matchStatus,
        notes: dto.notes ?? null,
        createdById: actorId,
        lines: {
          create: lineData
        }
      },
      include: { lines: true }
    });

    await this.audit.write({
      actorId,
      action: "procurement.invoice.create",
      entityType: "VendorInvoice",
      entityId: invoice.id,
      metadata: {
        poId,
        poNumber: po.poNumber,
        invoiceNumber: dto.invoiceNumber,
        invoicedTotal: invoicedTotal.toString(),
        matchStatus,
        linesWithVariance: lineData.filter((l) => !l.withinTolerance).length
      }
    });

    this.logger.log(
      `VendorInvoice ${invoice.id} posted against PO ${po.poNumber}: ${matchStatus}`
    );

    return invoice;
  }

  // ── Variance Approval ──────────────────────────────────────────────────

  /**
   * Approve a HELD invoice's variance via the AuthorityService seam.
   * The seam is called with the net variance amount; the rule set decides
   * whether the acting user has authority to approve.
   */
  async approveVariance(
    id: string,
    dto: ApproveInvoiceVarianceDto,
    actorId: string
  ) {
    const invoice = await this.getInvoice(id);
    if (invoice.matchStatus !== InvoiceMatchStatus.HELD) {
      throw new BadRequestException(
        `Only HELD invoices can be variance-approved (current: ${invoice.matchStatus}).`
      );
    }

    // Load PO to compute the PO total for the variance amount
    const po = await this.loadPo(invoice.purchaseOrderId);
    const poTotal = await this.computePoTotal(po.requestId);
    const varianceAmount = Number(invoice.invoicedTotal) - Number(poTotal);

    const decision = await this.authority.check({
      userId: actorId,
      action: VARIANCE_APPROVE_ACTION,
      amount: Math.abs(varianceAmount)
    });

    if (!decision.allowed) {
      throw new BadRequestException(
        "You do not have authority to approve this invoice variance. " +
          "Escalate to the designated approver."
      );
    }

    const updated = await this.prisma.vendorInvoice.update({
      where: { id },
      data: {
        matchStatus: InvoiceMatchStatus.APPROVED,
        approvedById: actorId,
        approvedAt: new Date(),
        authorityRuleId: decision.matchedRuleId ?? null,
        notes: dto.notes
          ? invoice.notes
            ? `${invoice.notes}\n${dto.notes}`
            : dto.notes
          : invoice.notes
      },
      include: { lines: true }
    });

    await this.audit.write({
      actorId,
      action: "procurement.invoice.variance.approve",
      entityType: "VendorInvoice",
      entityId: id,
      metadata: {
        varianceAmount,
        authorityRuleId: decision.matchedRuleId ?? null
      }
    });

    return updated;
  }

  // ── Reconcile / Close ──────────────────────────────────────────────────

  /**
   * Close-reconcile a PurchaseOrder once all its invoices are MATCHED or
   * APPROVED. Writes a PoReconcileAudit record for the project-close audit.
   *
   * Guards:
   * - At least one invoice must exist.
   * - No invoice in PENDING or HELD state (unresolved).
   * - No existing reconcile audit (idempotent guard).
   */
  async reconcilePo(poId: string, dto: ReconcilePoDto, actorId: string) {
    const po = await this.loadPo(poId);

    const existingAudit = await this.prisma.poReconcileAudit.findUnique({
      where: { purchaseOrderId: poId }
    });
    if (existingAudit) {
      throw new ConflictException(`PO ${po.poNumber} has already been reconciled.`);
    }

    const invoices = await this.prisma.vendorInvoice.findMany({
      where: { purchaseOrderId: poId }
    });
    if (invoices.length === 0) {
      throw new BadRequestException(
        `No invoices posted against PO ${po.poNumber}. Post at least one invoice before reconciling.`
      );
    }

    const unresolved = invoices.filter(
      (inv) =>
        inv.matchStatus === InvoiceMatchStatus.PENDING ||
        inv.matchStatus === InvoiceMatchStatus.HELD
    );
    if (unresolved.length > 0) {
      throw new BadRequestException(
        `Cannot reconcile — ${unresolved.length} invoice(s) are still PENDING or HELD. ` +
          "Resolve all variances first."
      );
    }

    const poTotal = await this.computePoTotal(po.requestId);
    const invoicedTotal = invoices.reduce(
      (sum, inv) => sum.add(inv.invoicedTotal),
      new Prisma.Decimal(0)
    );
    const netVariance = invoicedTotal.sub(poTotal);

    const reconcileAudit = await this.prisma.poReconcileAudit.create({
      data: {
        purchaseOrderId: poId,
        reconciledById: actorId,
        reconciledAt: new Date(),
        poTotal,
        invoicedTotal,
        netVariance,
        notes: dto.notes ?? null
      }
    });

    await this.audit.write({
      actorId,
      action: "procurement.po.reconcile",
      entityType: "PoReconcileAudit",
      entityId: reconcileAudit.id,
      metadata: {
        poId,
        poNumber: po.poNumber,
        poTotal: poTotal.toString(),
        invoicedTotal: invoicedTotal.toString(),
        netVariance: netVariance.toString(),
        invoiceCount: invoices.length
      }
    });

    this.logger.log(
      `PO ${po.poNumber} reconciled by ${actorId}: ` +
        `poTotal=${poTotal}, invoicedTotal=${invoicedTotal}, variance=${netVariance}`
    );

    return reconcileAudit;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async loadPo(poId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new NotFoundException("Purchase order not found.");
    return po;
  }

  /**
   * Read tolerance percentages from ProcurementConfig (config-driven,
   * not hard-coded). Falls back to 0 (exact match) if the config singleton
   * has not been seeded or the columns are null — 0 means exact match
   * required, which is the strictest (safest) default.
   */
  private async loadTolerances(): Promise<{
    qtyTolerancePct: number;
    priceTolerancePct: number;
  }> {
    const cfg = await this.prisma.procurementConfig.findUnique({
      where: { id: "singleton" }
    });
    return {
      qtyTolerancePct: Number(cfg?.matchQtyTolerancePct ?? 0),
      priceTolerancePct: Number(cfg?.matchPriceTolerancePct ?? 0)
    };
  }

  /**
   * Compute the PO value from the parent ProcurementRequest lines.
   * Uses the sum of lineTotal on the lines; lines without a unitPrice
   * contribute zero (same as the request service).
   */
  private async computePoTotal(requestId: string): Promise<Prisma.Decimal> {
    const lines = await this.prisma.procurementLine.findMany({
      where: { requestId },
      select: { lineTotal: true }
    });
    return lines.reduce(
      (sum, l) => sum.add(l.lineTotal ? new Prisma.Decimal(l.lineTotal) : new Prisma.Decimal(0)),
      new Prisma.Decimal(0)
    );
  }

  /**
   * Build the array of line create-payloads for a VendorInvoice, computing
   * variance flags against the supplied tolerance percentages.
   */
  private buildLineRecords(
    lines: VendorInvoiceLineInputDto[],
    qtyTolerancePct: number,
    priceTolerancePct: number
  ) {
    return lines.map((line) => {
      const billedQty = new Prisma.Decimal(line.billedQty);
      const billedUnitPrice = new Prisma.Decimal(line.billedUnitPrice);
      const billedLineTotal = billedQty.mul(billedUnitPrice);

      const orderedQty = line.orderedQty !== undefined ? new Prisma.Decimal(line.orderedQty) : null;
      const receivedQty =
        line.receivedQty !== undefined ? new Prisma.Decimal(line.receivedQty) : null;
      const orderedUnitPrice =
        line.orderedUnitPrice !== undefined ? new Prisma.Decimal(line.orderedUnitPrice) : null;

      // Qty variance relative to received quantity (the "goods" side).
      const qtyVariance =
        receivedQty !== null ? billedQty.sub(receivedQty) : null;

      // Price variance.
      const priceVariance =
        orderedUnitPrice !== null ? billedUnitPrice.sub(orderedUnitPrice) : null;

      // Within tolerance check: both qty and price must be within their bands.
      const qtyWithin = this.withinTolerance(qtyVariance, receivedQty, qtyTolerancePct);
      const priceWithin = this.withinTolerance(
        priceVariance,
        orderedUnitPrice,
        priceTolerancePct
      );
      const withinTolerance = qtyWithin && priceWithin;

      return {
        procurementLineId: line.procurementLineId ?? null,
        description: line.description,
        orderedQty,
        receivedQty,
        billedQty,
        orderedUnitPrice,
        billedUnitPrice,
        billedLineTotal,
        qtyVariance,
        priceVariance,
        withinTolerance
      };
    });
  }

  /**
   * Returns true if |variance| ≤ tolerancePct% of baseValue, OR if either
   * value is null (no reference to compare against → treated as within tolerance
   * so extra-charge lines do not block an otherwise-clean invoice).
   */
  private withinTolerance(
    variance: Prisma.Decimal | null,
    baseValue: Prisma.Decimal | null,
    tolerancePct: number
  ): boolean {
    if (variance === null || baseValue === null) return true;
    if (baseValue.isZero()) return variance.isZero();
    const absVariance = variance.abs();
    const allowed = baseValue.abs().mul(tolerancePct).div(100);
    return absVariance.lte(allowed);
  }
}
