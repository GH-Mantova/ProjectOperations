import { PrismaClient } from "@prisma/client";

/**
 * feat/quote-estimate-traceability — round-trip test for the new
 * ClientQuote.sourceTenderEstimateId FK and the polymorphic
 * QuoteCostLine.{sourceEstimateLineType, sourceEstimateLineId} pointer.
 *
 * Uses the real database. All rows are prefixed ZZTEST-TRACE- and cleaned
 * up before + after.
 */

jest.setTimeout(60_000);

describe("Quote → Estimate traceability round-trip", () => {
  const prisma = new PrismaClient();

  async function cleanup(): Promise<void> {
    await prisma.quoteCostLine.deleteMany({
      where: { quote: { quoteRef: { startsWith: "ZZTEST-TRACE-" } } }
    });
    await prisma.clientQuote.deleteMany({
      where: { quoteRef: { startsWith: "ZZTEST-TRACE-" } }
    });
    await prisma.tenderEstimate.deleteMany({
      where: { tender: { tenderNumber: { startsWith: "ZZTEST-TRACE-" } } }
    });
    await prisma.tender.deleteMany({
      where: { tenderNumber: { startsWith: "ZZTEST-TRACE-" } }
    });
    await prisma.client.deleteMany({ where: { name: "ZZTEST-TRACE Client" } });
    await prisma.user.deleteMany({
      where: { email: "zztest-trace@projectops.local" }
    });
  }

  beforeAll(cleanup);
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("persists and reads back both traceability pointers, and SetNull on estimate delete", async () => {
    const user = await prisma.user.create({
      data: {
        email: "zztest-trace@projectops.local",
        firstName: "ZZTEST",
        lastName: "Trace",
        passwordHash: "not-a-login"
      }
    });
    const client = await prisma.client.create({ data: { name: "ZZTEST-TRACE Client" } });
    const tender = await prisma.tender.create({
      data: { tenderNumber: "ZZTEST-TRACE-T", title: "Trace", status: "DRAFT" }
    });
    const estimate = await prisma.tenderEstimate.create({
      data: {
        tenderId: tender.id,
        items: {
          create: [
            {
              code: "DEM",
              title: "Demolition",
              labourLines: {
                create: [{ role: "Labourer", qty: "1", days: "1", rate: "50.00" }]
              }
            }
          ]
        }
      },
      include: { items: { include: { labourLines: true } } }
    });
    const labourLineId = estimate.items[0]!.labourLines[0]!.id;

    // Create the quote with the top-level FK set and a cost line with the
    // polymorphic pointer set.
    const quote = await prisma.clientQuote.create({
      data: {
        tenderId: tender.id,
        clientId: client.id,
        quoteRef: "ZZTEST-TRACE-Q1",
        createdById: user.id,
        status: "DRAFT",
        sourceTenderEstimateId: estimate.id,
        costLines: {
          create: [
            {
              label: "Demo",
              description: "Internal demolition",
              price: "0.00",
              baseValue: "0.00",
              sourceEstimateLineType: "EstimateLabourLine",
              sourceEstimateLineId: labourLineId
            },
            {
              label: "Bare",
              description: "no traceability",
              price: "0.00",
              baseValue: "0.00"
            }
          ]
        }
      },
      include: { costLines: { orderBy: { label: "asc" } } }
    });

    expect(quote.sourceTenderEstimateId).toBe(estimate.id);
    const tracedLine = quote.costLines.find((l) => l.label === "Demo")!;
    const bareLine = quote.costLines.find((l) => l.label === "Bare")!;
    expect(tracedLine.sourceEstimateLineType).toBe("EstimateLabourLine");
    expect(tracedLine.sourceEstimateLineId).toBe(labourLineId);
    expect(bareLine.sourceEstimateLineType).toBeNull();
    expect(bareLine.sourceEstimateLineId).toBeNull();

    // Read via the relation to confirm the FK is traversable.
    const withEstimate = await prisma.clientQuote.findUnique({
      where: { id: quote.id },
      include: { sourceTenderEstimate: true }
    });
    expect(withEstimate?.sourceTenderEstimate?.id).toBe(estimate.id);

    // Delete the estimate. onDelete: SetNull should clear the pointer but
    // keep the quote. The polymorphic per-line pointer is opaque (no FK)
    // and stays populated — the badge will now dangle, which is fine for
    // read-only traceability.
    await prisma.tenderEstimate.delete({ where: { id: estimate.id } });
    const afterDelete = await prisma.clientQuote.findUnique({
      where: { id: quote.id },
      include: { costLines: true }
    });
    expect(afterDelete).not.toBeNull();
    expect(afterDelete!.sourceTenderEstimateId).toBeNull();
  });
});
