import { PrismaClient } from "@prisma/client";
import { SEEDED_DEFAULT_TENANT_ID } from "../../../common/tenancy/tenant.constants";

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
    await prisma.quoteCostGroup.deleteMany({
      where: { quote: { quoteRef: { startsWith: "ZZTEST-TRACE-" } } }
    });
    await prisma.quoteCostLine.deleteMany({
      where: { quote: { quoteRef: { startsWith: "ZZTEST-TRACE-" } } }
    });
    await prisma.quoteProvisionalLine.deleteMany({
      where: { quote: { quoteRef: { startsWith: "ZZTEST-TRACE-" } } }
    });
    await prisma.quoteCostOption.deleteMany({
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
      where: { email: { in: [
        "zztest-trace@projectops.local",
        "zztest-trace-s4a@projectops.local",
        "zztest-trace-grp@projectops.local"
      ] } }
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
      data: { tenantId: SEEDED_DEFAULT_TENANT_ID, tenderNumber: "ZZTEST-TRACE-T", title: "Trace", status: "DRAFT", siteId: "site-unassigned" }
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

  // QUOTE_PUSH_BY_DESTINATION_V1 (scopecards-s4a) -- source pointers on
  // provisional lines and cost options survive round-trip.
  it("persists sourceEstimateLineType/Id on QuoteProvisionalLine and QuoteCostOption", async () => {
    const user = await prisma.user.create({
      data: {
        email: "zztest-trace-s4a@projectops.local",
        firstName: "ZZTEST",
        lastName: "TraceS4a",
        passwordHash: "not-a-login"
      }
    });
    const client = await prisma.client.create({ data: { name: "ZZTEST-TRACE Client" } });
    const tender = await prisma.tender.create({
      data: {
        tenantId: SEEDED_DEFAULT_TENANT_ID,
        tenderNumber: "ZZTEST-TRACE-S4A",
        title: "S4a trace",
        status: "DRAFT",
        siteId: "site-unassigned"
      }
    });

    const quote = await prisma.clientQuote.create({
      data: {
        tenderId: tender.id,
        clientId: client.id,
        quoteRef: "ZZTEST-TRACE-S4A-Q1",
        createdById: user.id,
        status: "DRAFT",
        provisionalLines: {
          create: [
            {
              description: "Provisional allowance",
              price: "5000.00",
              sourceEstimateLineType: "waste",
              sourceEstimateLineId: "wi-test-99"
            }
          ]
        },
        costOptions: {
          create: [
            {
              label: "X",
              description: "Optional upgrade",
              price: "12000.00",
              sourceEstimateLineType: "cutting",
              sourceEstimateLineId: "ci-test-77"
            }
          ]
        }
      },
      include: {
        provisionalLines: true,
        costOptions: true
      }
    });

    const provLine = quote.provisionalLines[0]!;
    expect(provLine.sourceEstimateLineType).toBe("waste");
    expect(provLine.sourceEstimateLineId).toBe("wi-test-99");

    const option = quote.costOptions[0]!;
    expect(option.sourceEstimateLineType).toBe("cutting");
    expect(option.sourceEstimateLineId).toBe("ci-test-77");
  });

  // QUOTE_PUSH_BY_DESTINATION_V1 (scopecards-s4a) -- QuoteCostGroup schema
  // round-trip: create a group row, assign a cost line to it, read back.
  it("creates a QuoteCostGroup and assigns cost lines via groupId FK", async () => {
    const user = await prisma.user.create({
      data: {
        email: "zztest-trace-grp@projectops.local",
        firstName: "ZZTEST",
        lastName: "TraceGrp",
        passwordHash: "not-a-login"
      }
    });
    const client = await prisma.client.create({ data: { name: "ZZTEST-TRACE Client" } });
    const tender = await prisma.tender.create({
      data: {
        tenantId: SEEDED_DEFAULT_TENANT_ID,
        tenderNumber: "ZZTEST-TRACE-GRP",
        title: "Group trace",
        status: "DRAFT",
        siteId: "site-unassigned"
      }
    });

    const quote = await prisma.clientQuote.create({
      data: {
        tenderId: tender.id,
        clientId: client.id,
        quoteRef: "ZZTEST-TRACE-GRP-Q1",
        createdById: user.id,
        status: "DRAFT"
      }
    });

    const group = await prisma.quoteCostGroup.create({
      data: {
        quoteId: quote.id,
        code: "DEM",
        label: "A",
        name: "Demolition",
        printMode: "ITEMISED",
        sortOrder: 0
      }
    });

    await prisma.quoteCostLine.create({
      data: {
        quoteId: quote.id,
        groupId: group.id,
        label: "A1",
        description: "Strip out level 1",
        price: "8000.00",
        baseValue: "8000.00"
      }
    });

    const readBack = await prisma.clientQuote.findUnique({
      where: { id: quote.id },
      include: {
        costGroups: true,
        costLines: { include: { group: true } }
      }
    });

    expect(readBack?.costGroups.length).toBe(1);
    expect(readBack?.costGroups[0].code).toBe("DEM");
    expect(readBack?.costGroups[0].label).toBe("A");
    expect(readBack?.costGroups[0].printMode).toBe("ITEMISED");

    const costLine = readBack?.costLines[0]!;
    expect(costLine.groupId).toBe(group.id);
    expect(costLine.group?.code).toBe("DEM");
  });
});
