import { PrismaClient } from "@prisma/client";
import { ClientStatsService } from "../client-stats.service";

// OWN-1 concurrency proof: two simultaneous outcome recordings must both land.
// Previously tendering.service did a read-modify-write in JS, so if two
// AWARDED/LOST status flips ran in parallel they could read the same
// pre-increment values and one increment would be lost. ClientStatsService
// uses a single UPDATE ... SET col = col + delta statement, so this test
// must show tenderCount == 2 after Promise.all of two "first-count" calls.
//
// Requires a live Postgres reachable via DATABASE_URL — runs under
// `pnpm test:api:serial` where other DB-touching specs live.

jest.setTimeout(60_000);

describe("OWN-1 ClientStatsService — atomic increment under concurrency", () => {
  let prisma: PrismaClient;
  let service: ClientStatsService;
  let clientId: string;
  const tenderIds: string[] = [];
  const createdClientIds: string[] = [];
  const createdTenderIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient();
    service = new ClientStatsService(prisma as never);

    // Zero-counter client dedicated to this test.
    const client = await prisma.client.create({
      data: {
        name: `OWN1-concurrency-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        winCount: 0,
        tenderCount: 0,
        winRate: 0
      }
    });
    clientId = client.id;
    createdClientIds.push(client.id);

    // Two distinct tenders both linked to the same client — simulates
    // two "first-count" outcome flips racing each other.
    for (let i = 0; i < 2; i++) {
      const tender = await prisma.tender.create({
        data: {
          tenderNumber: `OWN1-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
          title: `OWN-1 concurrency ${i}`,
          status: "DRAFT",
          tenderClients: {
            create: { clientId }
          }
        }
      });
      tenderIds.push(tender.id);
      createdTenderIds.push(tender.id);
    }
  });

  afterAll(async () => {
    // Clean up so re-runs stay green. Delete tenderClients via tender cascade
    // if configured, otherwise fall back to explicit deletes.
    await prisma.tenderClient
      .deleteMany({ where: { tenderId: { in: createdTenderIds } } })
      .catch(() => undefined);
    await prisma.tender.deleteMany({ where: { id: { in: createdTenderIds } } });
    await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
    await prisma.$disconnect();
  });

  it("two concurrent first-count recordings both increment tenderCount (no lost update)", async () => {
    await Promise.all([
      service.recordTenderOutcome(tenderIds[0], { isWin: false, mode: "first-count" }),
      service.recordTenderOutcome(tenderIds[1], { isWin: true, mode: "first-count" })
    ]);

    const client = await prisma.client.findUniqueOrThrow({
      where: { id: clientId },
      select: { tenderCount: true, winCount: true, winRate: true }
    });

    // Both first-count outcomes landed: tenderCount = 2, winCount = 1 (only
    // tenderIds[1] was a win), winRate = 50.00.
    expect(client.tenderCount).toBe(2);
    expect(client.winCount).toBe(1);
    expect(Number(client.winRate)).toBe(50);
  });

  it("two concurrent win-flips both increment winCount (no lost update)", async () => {
    // Start from tenderCount=2 / winCount=1 state left by the previous test,
    // then fire two concurrent win-flips against the two tenders. winCount
    // must go 1 -> 3; if the SQL weren't atomic one increment would be lost
    // and winCount would land at 2.
    await Promise.all([
      service.recordTenderOutcome(tenderIds[0], { isWin: true, mode: "win-flip" }),
      service.recordTenderOutcome(tenderIds[1], { isWin: true, mode: "win-flip" })
    ]);

    const client = await prisma.client.findUniqueOrThrow({
      where: { id: clientId },
      select: { tenderCount: true, winCount: true, winRate: true }
    });

    expect(client.tenderCount).toBe(2);
    expect(client.winCount).toBe(3);
    // winRate = round(3 * 100 / 2, 2) = 150.00 — kept even though > 100 since
    // it mirrors the pre-existing formula. The point of the test is atomicity.
    expect(Number(client.winRate)).toBe(150);
  });
});
