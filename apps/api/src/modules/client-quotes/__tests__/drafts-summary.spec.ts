import { PrismaClient } from "@prisma/client";
import { ClientQuotesService } from "../client-quotes.service";

/**
 * Widgets batch 2 — `GET /client-quotes/drafts-summary` service coverage.
 *
 * Seeds a tender + client + two DRAFT quotes (with cost lines) plus one
 * SENT quote (must be excluded) and asserts totals + top-N ordering by
 * value DESC.
 *
 * Serial suite, real database, self-cleaning via ZZTEST-B2-DS prefix.
 */

jest.setTimeout(60_000);

describe("ClientQuotesService.getDraftsSummary — batch 2 widget", () => {
  const prisma = new PrismaClient();
  const service = new ClientQuotesService(prisma as never, {} as never, {} as never);

  let tenderId: string;
  let clientId: string;
  let userId: string;
  let draftAId: string;
  let draftBId: string;
  let sentId: string;

  async function cleanup(): Promise<void> {
    await prisma.quoteCostLine.deleteMany({
      where: { quote: { quoteRef: { startsWith: "ZZTEST-B2-DS-" } } }
    });
    await prisma.clientQuote.deleteMany({
      where: { quoteRef: { startsWith: "ZZTEST-B2-DS-" } }
    });
    await prisma.tender.deleteMany({ where: { tenderNumber: "ZZTEST-B2-DS-T" } });
    await prisma.client.deleteMany({ where: { name: "ZZTEST-B2-DS Client" } });
    await prisma.user.deleteMany({ where: { email: "zztest-b2-ds@projectops.local" } });
  }

  beforeAll(async () => {
    await cleanup();
    const user = await prisma.user.create({
      data: {
        email: "zztest-b2-ds@projectops.local",
        firstName: "ZZTEST",
        lastName: "DS",
        passwordHash: "not-a-login"
      }
    });
    userId = user.id;
    const client = await prisma.client.create({ data: { name: "ZZTEST-B2-DS Client" } });
    clientId = client.id;
    const tender = await prisma.tender.create({
      data: {
        tenderNumber: "ZZTEST-B2-DS-T",
        title: "ZZTEST B2 DS Tender",
        status: "DRAFT",
        siteId: "site-unassigned"
      }
    });
    tenderId = tender.id;

    const draftA = await prisma.clientQuote.create({
      data: {
        tenderId,
        clientId,
        quoteRef: "ZZTEST-B2-DS-A",
        createdById: userId,
        status: "DRAFT",
        costLines: {
          create: [
            { label: "L1", description: "Line 1", price: "1000.00", baseValue: "1000.00" },
            { label: "L2", description: "Line 2", price: "500.00", baseValue: "500.00" }
          ]
        }
      }
    });
    draftAId = draftA.id;
    const draftB = await prisma.clientQuote.create({
      data: {
        tenderId,
        clientId,
        quoteRef: "ZZTEST-B2-DS-B",
        revision: 2,
        createdById: userId,
        status: "DRAFT",
        costLines: {
          create: [{ label: "L1", description: "Line 1", price: "3000.00", baseValue: "3000.00" }]
        }
      }
    });
    draftBId = draftB.id;
    const sent = await prisma.clientQuote.create({
      data: {
        tenderId,
        clientId,
        quoteRef: "ZZTEST-B2-DS-SENT",
        revision: 3,
        createdById: userId,
        status: "SENT",
        costLines: {
          create: [{ label: "L1", description: "Line 1", price: "9999.00", baseValue: "9999.00" }]
        }
      }
    });
    sentId = sent.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("aggregates DRAFT rows only, sums cost-line prices, and orders top-N by value DESC", async () => {
    const result = await service.getDraftsSummary(5);
    const mine = result.items.filter((i) => i.tenderId === tenderId);

    expect(mine).toHaveLength(2);
    // Draft B ($3000) should lead Draft A ($1500)
    expect(mine[0].id).toBe(draftBId);
    expect(mine[0].value).toBe(3000);
    expect(mine[1].id).toBe(draftAId);
    expect(mine[1].value).toBe(1500);
    // SENT row must not appear
    expect(result.items.find((i) => i.id === sentId)).toBeUndefined();
  });

  it("clamps limit into [1, 20]", async () => {
    const zero = await service.getDraftsSummary(0);
    expect(zero.items.length).toBeGreaterThanOrEqual(1);
    const huge = await service.getDraftsSummary(500);
    expect(huge.items.length).toBeLessThanOrEqual(20);
  });
});
