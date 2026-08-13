/**
 * MIG-3.1 - Tender folder backfill.
 *
 * The estimating-tracker migration created 534 Tender rows but did NOT create
 * their SharePoint folders (ensureTenderFolderStructure is only wired into
 * TenderingService.create/.duplicate). This service backfills those folders
 * for a supplied list of legacy T-numbers, reusing the exact same
 * SharePointService.ensureTenderFolderStructure path as normal tender
 * creation - so folders are created in SharePoint AND registered in the ERP
 * database (SharePointFolderLink) with the canonical document-category
 * subfolders.
 *
 * It also returns the legacy T-number -> canonical tenderNumber mapping, which
 * doubles as the manifest for the subsequent legacy-content copy.
 *
 * Idempotent: ensureTenderFolderStructure upserts folder links, so re-running
 * is safe. dryRun=true resolves the mapping without creating anything.
 */

import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SharePointService } from "../platform/sharepoint.service";

export type BackfillStatus = "created" | "would-create" | "no-tender" | "no-tender-number" | "error";

export interface BackfillResultRow {
  tNumber: string;
  tenderId: string | null;
  tenderNumber: string | null;
  status: BackfillStatus;
  reason?: string;
}

export interface TenderFolderBackfillReport {
  dryRun: boolean;
  requested: number;
  matched: number;
  created: number;
  notFound: number;
  errors: number;
  results: BackfillResultRow[];
}

/** Normalise a legacy T-number: trim, uppercase, strip internal whitespace. */
export function normaliseTNumber(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

@Injectable()
export class TenderFolderBackfillService {
  private readonly logger = new Logger(TenderFolderBackfillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sharePoint: SharePointService
  ) {}

  async backfill(
    tNumbersRaw: string[],
    actorId: string,
    dryRun: boolean
  ): Promise<TenderFolderBackfillReport> {
    // De-duplicate + normalise while preserving first-seen order.
    const seen = new Set<string>();
    const tNumbers: string[] = [];
    for (const raw of tNumbersRaw ?? []) {
      const t = normaliseTNumber(raw);
      if (t && !seen.has(t)) {
        seen.add(t);
        tNumbers.push(t);
      }
    }
    if (tNumbers.length === 0) {
      throw new BadRequestException("No valid T-numbers supplied.");
    }

    const results: BackfillResultRow[] = [];
    let matched = 0;
    let created = 0;
    let notFound = 0;
    let errors = 0;

    for (const tNumber of tNumbers) {
      // Precise match: title starts with "T#### " (trailing space) so "T153"
      // never matches "T1532 - ...". Mirrors the tender-tracker importer.
      const tender = await this.prisma.tender.findFirst({
        where: { title: { startsWith: `${tNumber} ` } },
        select: { id: true, tenderNumber: true, title: true },
      });

      if (!tender) {
        notFound++;
        results.push({ tNumber, tenderId: null, tenderNumber: null, status: "no-tender" });
        continue;
      }

      matched++;

      if (!tender.tenderNumber) {
        errors++;
        results.push({
          tNumber,
          tenderId: tender.id,
          tenderNumber: null,
          status: "no-tender-number",
          reason: "Tender has no tenderNumber; run the tender-number backfill first.",
        });
        continue;
      }

      if (dryRun) {
        results.push({
          tNumber,
          tenderId: tender.id,
          tenderNumber: tender.tenderNumber,
          status: "would-create",
        });
        continue;
      }

      try {
        await this.sharePoint.ensureTenderFolderStructure(
          { id: tender.id, tenderNumber: tender.tenderNumber },
          actorId
        );
        created++;
        results.push({
          tNumber,
          tenderId: tender.id,
          tenderNumber: tender.tenderNumber,
          status: "created",
        });
      } catch (err) {
        errors++;
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `backfill(): ensureTenderFolderStructure failed for ${tNumber} (${tender.tenderNumber}): ${reason}`
        );
        results.push({
          tNumber,
          tenderId: tender.id,
          tenderNumber: tender.tenderNumber,
          status: "error",
          reason,
        });
      }
    }

    this.logger.log(
      `backfill(): dryRun=${dryRun} requested=${tNumbers.length} matched=${matched} created=${created} notFound=${notFound} errors=${errors}`
    );

    return { dryRun, requested: tNumbers.length, matched, created, notFound, errors, results };
  }
}
