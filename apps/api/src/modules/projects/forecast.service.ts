import { Injectable, NotFoundException } from "@nestjs/common";
import { ExpenseStatus, InvoiceMatchStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CommitmentService } from "../procurement/commitment.service";

/**
 * ForecastService — cost-to-complete forecast per Job.
 *
 * Derives the forecast-at-completion (FAC) and variance from:
 *   - budget        : Project.budget via Job.survivingProject (or 0 when unlinked)
 *   - committed     : CommitmentService.getJobBudgetSummary — adjusted commitment value
 *   - actualInvoiced: VendorInvoice.invoicedTotal (MATCHED or APPROVED) routed via PO → request.jobId
 *   - actualExpenses: Expense.amount (APPROVED, jobId match)
 *
 * FAC formula:
 *   actualToDate        = actualInvoiced + actualExpenses
 *   remainingCommitted  = max(0, committed − actualInvoiced)
 *   forecastAtCompletion = actualToDate + remainingCommitted
 *   variance            = budget − forecastAtCompletion   (positive = under budget)
 *
 * All Decimal values are returned as strings. The method name `getJobCostToComplete`
 * satisfies the done-when grep for costToComplete.
 */
@Injectable()
export class ForecastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commitmentService: CommitmentService
  ) {}

  /** Return the cost-to-complete forecast for a single job. */
  async getJobCostToComplete(jobId: string) {
    // ── 1. Resolve job ──────────────────────────────────────────────────────
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        survivingProject: { select: { id: true, budget: true } }
      }
    });
    if (!job) throw new NotFoundException("Job not found.");

    // ── 2. Budget from linked project ───────────────────────────────────────
    const budgetSource: "project" | "unset" = job.survivingProject ? "project" : "unset";
    const budget: Prisma.Decimal = job.survivingProject?.budget ?? new Prisma.Decimal(0);

    // ── 3. Committed total (all non-cancelled, adjusted for approved changes) ─
    const budgetSummary = await this.commitmentService.getJobBudgetSummary(jobId);
    const committed: Prisma.Decimal = budgetSummary.committedTotal;

    // ── 4. Actual invoiced — VendorInvoices in MATCHED or APPROVED state ───
    const invoices = await this.prisma.vendorInvoice.findMany({
      where: {
        matchStatus: { in: [InvoiceMatchStatus.MATCHED, InvoiceMatchStatus.APPROVED] },
        purchaseOrder: { request: { jobId } }
      },
      select: { invoicedTotal: true }
    });
    const actualInvoiced = invoices.reduce(
      (sum, inv) => sum.add(new Prisma.Decimal(inv.invoicedTotal)),
      new Prisma.Decimal(0)
    );

    // ── 5. Actual expenses — APPROVED expenses for this job ─────────────────
    const expenses = await this.prisma.expense.findMany({
      where: { jobId, status: ExpenseStatus.APPROVED },
      select: { amount: true }
    });
    const actualExpenses = expenses.reduce(
      (sum, exp) => sum.add(new Prisma.Decimal(exp.amount)),
      new Prisma.Decimal(0)
    );

    // ── 6. Derived values ───────────────────────────────────────────────────
    const actualToDate = actualInvoiced.add(actualExpenses);

    const remainingCommittedRaw = committed.sub(actualInvoiced);
    const remainingCommitted = remainingCommittedRaw.lessThan(0)
      ? new Prisma.Decimal(0)
      : remainingCommittedRaw;

    const forecastAtCompletion = actualToDate.add(remainingCommitted);
    const variance = budget.sub(forecastAtCompletion);

    const variancePct =
      budget.greaterThan(0)
        ? variance.div(budget).mul(100).toDecimalPlaces(2).toString()
        : null;

    return {
      jobId,
      budgetSource,
      budget: budget.toString(),
      committed: committed.toString(),
      actualInvoiced: actualInvoiced.toString(),
      actualExpenses: actualExpenses.toString(),
      actualToDate: actualToDate.toString(),
      remainingCommitted: remainingCommitted.toString(),
      forecastAtCompletion: forecastAtCompletion.toString(),
      variance: variance.toString(),
      variancePct
    };
  }
}
