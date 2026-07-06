import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// OWN-1 (docs/architecture/module-ownership-ia-map.md §1 Client row + §7 Q4):
// single writer of record for the Client win/loss counters (winCount, tenderCount,
// winRate, lastWonAt, lastTenderAt). Every increment routes through
// recordTenderOutcome, which uses a single UPDATE ... SET col = col + delta
// statement so concurrent outcome recordings cannot lose an increment.
// Do NOT write these columns from anywhere else — grep for winCount/tenderCount
// under apps/api/src should only return this file and Read queries.
@Injectable()
export class ClientStatsService {
  constructor(private readonly prisma: PrismaService) {}

  // Record a tender's outcome against every client linked to it.
  //
  // `mode`:
  //   - "first-count": tender wasn't scored before. tenderCount += 1;
  //     winCount += 1 iff isWin. lastTenderAt := now. lastWonAt := now iff isWin.
  //   - "win-flip": tender was already counted as SUBMITTED/LOST and is now
  //     being awarded. winCount += 1. lastWonAt := now. tenderCount untouched.
  //
  // Concurrency guarantee: each client row is updated with a single SQL UPDATE
  // that references the current column values inside the statement, so two
  // simultaneous calls both take effect (no read-modify-write in JS = no lost
  // update). Serial spec: client-stats.concurrency.spec.ts.
  async recordTenderOutcome(
    tenderId: string,
    opts: { isWin: boolean; mode: "first-count" | "win-flip" }
  ): Promise<void> {
    const links = await this.prisma.tenderClient.findMany({
      where: { tenderId },
      select: { clientId: true }
    });
    if (links.length === 0) return;

    const tenderDelta = opts.mode === "first-count" ? 1 : 0;
    const winDelta = opts.isWin ? 1 : 0;
    const now = new Date();

    for (const link of links) {
      await this.incrementClient(link.clientId, tenderDelta, winDelta, now);
    }
  }

  private async incrementClient(
    clientId: string,
    tenderDelta: number,
    winDelta: number,
    now: Date
  ): Promise<void> {
    // Single atomic UPDATE. win_rate is derived inside the statement from the
    // post-increment values so it's always consistent with the counters.
    await this.prisma.$executeRaw`
      UPDATE clients
      SET
        tender_count = tender_count + ${tenderDelta}::int,
        win_count = win_count + ${winDelta}::int,
        win_rate = CASE
          WHEN (tender_count + ${tenderDelta}::int) > 0
          THEN ROUND(
            ((win_count + ${winDelta}::int)::numeric * 100)
            / (tender_count + ${tenderDelta}::int),
            2
          )
          ELSE 0
        END,
        last_tender_at = CASE
          WHEN ${tenderDelta}::int > 0 THEN ${now}
          ELSE last_tender_at
        END,
        last_won_at = CASE
          WHEN ${winDelta}::int > 0 THEN ${now}
          ELSE last_won_at
        END,
        updated_at = ${now}
      WHERE id = ${clientId}
    `;
  }
}
