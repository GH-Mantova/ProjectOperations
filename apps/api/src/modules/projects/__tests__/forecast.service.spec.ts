import { NotFoundException } from "@nestjs/common";
import { ExpenseStatus, InvoiceMatchStatus, Prisma } from "@prisma/client";
import { ForecastService } from "../forecast.service";

// ─── helpers ───────────────────────────────────────────────────────────────

function decimal(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

// ─── Prisma stub builder ────────────────────────────────────────────────────

function buildPrismaMock() {
  return {
    job: {
      findUnique: jest.fn()
    },
    vendorInvoice: {
      findMany: jest.fn().mockResolvedValue([])
    },
    expense: {
      findMany: jest.fn().mockResolvedValue([])
    }
  };
}

// ─── CommitmentService stub ─────────────────────────────────────────────────

function buildCommitmentStub(committedTotal: Prisma.Decimal = decimal(0)) {
  return {
    getJobBudgetSummary: jest.fn().mockResolvedValue({
      jobId: "job-1",
      committedTotal,
      approvedTotal: decimal(0),
      commitments: []
    })
  };
}

// ─── Service factory ────────────────────────────────────────────────────────

function buildService(
  prismaMock = buildPrismaMock(),
  commitmentStub = buildCommitmentStub()
) {
  const service = new ForecastService(prismaMock as never, commitmentStub as never);
  return { service, prisma: prismaMock, commitment: commitmentStub };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("ForecastService.getJobCostToComplete", () => {
  it("returns correct FAC and variance when job has survivingProject, committed, invoiced, and expenses", async () => {
    const prismaMock = buildPrismaMock();
    // Job linked to a project with budget $100,000
    prismaMock.job.findUnique.mockResolvedValueOnce({
      id: "job-1",
      survivingProject: { id: "proj-1", budget: decimal("100000") }
    });
    // Two invoices totalling $30,000
    prismaMock.vendorInvoice.findMany.mockResolvedValueOnce([
      { invoicedTotal: decimal("20000") },
      { invoicedTotal: decimal("10000") }
    ]);
    // One approved expense of $5,000
    prismaMock.expense.findMany.mockResolvedValueOnce([{ amount: decimal("5000") }]);

    // Committed total $60,000
    const commitmentStub = buildCommitmentStub(decimal("60000"));
    const { service } = buildService(prismaMock, commitmentStub);

    const result = await service.getJobCostToComplete("job-1");

    // actualInvoiced = 30000, actualExpenses = 5000
    // actualToDate = 35000
    // remainingCommitted = max(0, 60000 - 30000) = 30000
    // forecastAtCompletion = 35000 + 30000 = 65000
    // variance = 100000 - 65000 = 35000
    // variancePct = 35000 / 100000 * 100 = 35.00
    expect(result.budgetSource).toBe("project");
    expect(result.budget).toBe("100000");
    expect(result.committed).toBe("60000");
    expect(result.actualInvoiced).toBe("30000");
    expect(result.actualExpenses).toBe("5000");
    expect(result.actualToDate).toBe("35000");
    expect(result.remainingCommitted).toBe("30000");
    expect(result.forecastAtCompletion).toBe("65000");
    expect(result.variance).toBe("35000");
    expect(result.variancePct).toBe("35.00");
  });

  it("returns budgetSource unset and null variancePct when job has no survivingProject", async () => {
    const prismaMock = buildPrismaMock();
    prismaMock.job.findUnique.mockResolvedValueOnce({
      id: "job-2",
      survivingProject: null
    });
    // No invoices, no expenses, no committed
    const { service } = buildService(prismaMock);

    const result = await service.getJobCostToComplete("job-2");

    expect(result.budgetSource).toBe("unset");
    expect(result.budget).toBe("0");
    expect(result.variancePct).toBeNull();
    // FAC = 0 + 0 = 0, variance = 0 - 0 = 0
    expect(result.forecastAtCompletion).toBe("0");
    expect(result.variance).toBe("0");
  });

  it("clamps remainingCommitted to 0 when actual invoiced exceeds committed", async () => {
    const prismaMock = buildPrismaMock();
    prismaMock.job.findUnique.mockResolvedValueOnce({
      id: "job-3",
      survivingProject: { id: "proj-3", budget: decimal("200000") }
    });
    // Invoiced $80,000 — more than committed $50,000
    prismaMock.vendorInvoice.findMany.mockResolvedValueOnce([{ invoicedTotal: decimal("80000") }]);
    prismaMock.expense.findMany.mockResolvedValueOnce([]);

    const commitmentStub = buildCommitmentStub(decimal("50000"));
    const { service } = buildService(prismaMock, commitmentStub);

    const result = await service.getJobCostToComplete("job-3");

    // remainingCommitted = max(0, 50000 - 80000) = 0
    expect(result.remainingCommitted).toBe("0");
    // forecastAtCompletion = 80000 + 0 = 80000
    expect(result.forecastAtCompletion).toBe("80000");
  });

  it("throws NotFoundException when job does not exist", async () => {
    const prismaMock = buildPrismaMock();
    prismaMock.job.findUnique.mockResolvedValueOnce(null);
    const { service } = buildService(prismaMock);

    await expect(service.getJobCostToComplete("missing-job")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("verifies Prisma where clause passes correct matchStatus filter to vendorInvoice.findMany", async () => {
    const prismaMock = buildPrismaMock();
    prismaMock.job.findUnique.mockResolvedValueOnce({
      id: "job-4",
      survivingProject: null
    });
    const { service } = buildService(prismaMock);

    await service.getJobCostToComplete("job-4");

    expect(prismaMock.vendorInvoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          matchStatus: { in: [InvoiceMatchStatus.MATCHED, InvoiceMatchStatus.APPROVED] }
        })
      })
    );
    expect(prismaMock.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ jobId: "job-4", status: ExpenseStatus.APPROVED })
      })
    );
  });
});
