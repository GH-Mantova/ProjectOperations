import { BadRequestException } from "@nestjs/common";
import { TenderFolderBackfillService, normaliseTNumber } from "./tender-folder-backfill.service";

type TenderRow = { id: string; tenderNumber: string | null; title: string };

function buildService(tenders: TenderRow[]) {
  const ensureTenderFolderStructure = jest.fn().mockResolvedValue(undefined);
  const prisma = {
    tender: {
      findFirst: jest.fn(async ({ where }: { where: { title: { startsWith: string } } }) => {
        const prefix = where.title.startsWith;
        const found = tenders.find((t) => t.title.startsWith(prefix));
        return found
          ? { id: found.id, tenderNumber: found.tenderNumber, title: found.title }
          : null;
      }),
    },
  };
  const sharePoint = { ensureTenderFolderStructure };
  const svc = new TenderFolderBackfillService(prisma as never, sharePoint as never);
  return { svc, ensureTenderFolderStructure };
}

describe("TenderFolderBackfillService", () => {
  const tenders: TenderRow[] = [
    { id: "id-1532", tenderNumber: "T250122-ACCE-Rev1", title: "T1532 - Noosa Blue Pool Area" },
    { id: "id-2091", tenderNumber: "T260813-JMAC-Rev1", title: "T2091 - JMAC - Munruben Depot" },
    { id: "id-nonum", tenderNumber: null, title: "T1999 - Missing Number" },
  ];

  it("dry-run resolves the mapping without creating folders", async () => {
    const { svc, ensureTenderFolderStructure } = buildService(tenders);
    const report = await svc.backfill(["T1532", "T2091"], "actor-1", true);
    expect(report.dryRun).toBe(true);
    expect(report.matched).toBe(2);
    expect(report.created).toBe(0);
    expect(ensureTenderFolderStructure).not.toHaveBeenCalled();
    expect(report.results.map((r) => [r.tNumber, r.tenderNumber, r.status])).toEqual([
      ["T1532", "T250122-ACCE-Rev1", "would-create"],
      ["T2091", "T260813-JMAC-Rev1", "would-create"],
    ]);
  });

  it("commit creates folders via ensureTenderFolderStructure", async () => {
    const { svc, ensureTenderFolderStructure } = buildService(tenders);
    const report = await svc.backfill(["T1532"], "actor-1", false);
    expect(report.created).toBe(1);
    expect(ensureTenderFolderStructure).toHaveBeenCalledWith(
      { id: "id-1532", tenderNumber: "T250122-ACCE-Rev1" },
      "actor-1"
    );
    expect(report.results[0].status).toBe("created");
  });

  it("records tenders that are not found", async () => {
    const { svc, ensureTenderFolderStructure } = buildService(tenders);
    const report = await svc.backfill(["T9999"], "actor-1", false);
    expect(report.notFound).toBe(1);
    expect(report.matched).toBe(0);
    expect(report.results[0].status).toBe("no-tender");
    expect(ensureTenderFolderStructure).not.toHaveBeenCalled();
  });

  it("does not match T153 against T1532 (precise startsWith)", async () => {
    const { svc } = buildService(tenders);
    const report = await svc.backfill(["T153"], "actor-1", true);
    expect(report.results[0].status).toBe("no-tender");
  });

  it("flags matched tenders that have no tenderNumber", async () => {
    const { svc, ensureTenderFolderStructure } = buildService(tenders);
    const report = await svc.backfill(["T1999"], "actor-1", false);
    expect(report.matched).toBe(1);
    expect(report.errors).toBe(1);
    expect(report.results[0].status).toBe("no-tender-number");
    expect(ensureTenderFolderStructure).not.toHaveBeenCalled();
  });

  it("de-duplicates and normalises T-numbers", async () => {
    const { svc } = buildService(tenders);
    const report = await svc.backfill([" t1532 ", "T1532", "T 1532"], "actor-1", true);
    expect(report.requested).toBe(1);
    expect(report.matched).toBe(1);
  });

  it("throws when no valid T-numbers are supplied", async () => {
    const { svc } = buildService(tenders);
    await expect(svc.backfill([" ", ""], "actor-1", true)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("normaliseTNumber strips whitespace and uppercases", () => {
    expect(normaliseTNumber(" t 1532 ")).toBe("T1532");
  });
});
