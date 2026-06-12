import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { brisbaneYYMMDD, clientSlug, FALLBACK_SLUG } from "../../common/id-format/client-slug";

/**
 * Generates canonical tender numbers in the format T{YYMMDD}-{SLUG}-Rev{N}
 * (pilot G5 — Marco-confirmed spec; tender numbers are server-generated
 * and no longer caller-supplied on create).
 *
 *   YYMMDD — tender creation date in Australia/Brisbane local time
 *   SLUG   — 4-letter uppercase slug from the primary client's company
 *            name, snapshotted on the Tender row (clientSlugSnapshot);
 *            XXXX when the tender has no linked client at creation
 *   Rev{N} — revision number, starts at Rev1; bumped via the
 *            "Mark as new revision" action (POST /tenders/:id/bump-revision)
 *
 * Collisions (same client, same day, both Rev1) get a -2 / -3
 * disambiguator suffix: T260605-ACME-Rev1, T260605-ACME-Rev1-2.
 */
@Injectable()
export class TenderNumberService {
  static readonly TENDER_NUMBER_REGEX = /^T\d{6}-[A-Z0-9]{1,4}-Rev\d+(-\d+)?$/;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a canonical Rev1 tender number for the given primary client
   * name (empty/undefined name falls back to the XXXX slug).
   */
  async generate(
    clientName: string | null | undefined,
    now: Date = new Date()
  ): Promise<{ tenderNumber: string; clientSlugSnapshot: string; revisionNumber: number }> {
    const slug = clientSlug(clientName ?? "") || FALLBACK_SLUG;
    const candidate = `T${brisbaneYYMMDD(now)}-${slug}-Rev1`;
    return {
      tenderNumber: await this.ensureUnique(candidate),
      clientSlugSnapshot: slug,
      revisionNumber: 1
    };
  }

  /**
   * Bumps the revision of an existing tender — only the visible identifier
   * changes; the row id stays stable. Reuses the original creation date
   * stamp and slug snapshot so only Rev{N} moves.
   */
  async bumpRevision(tenderId: string): Promise<{
    tenderNumber: string;
    previousTenderNumber: string;
    revisionNumber: number;
  }> {
    const tender = await this.prisma.tender.findUniqueOrThrow({
      where: { id: tenderId },
      select: { tenderNumber: true, revisionNumber: true, clientSlugSnapshot: true, createdAt: true }
    });
    const newRev = tender.revisionNumber + 1;
    const slug = tender.clientSlugSnapshot || FALLBACK_SLUG;
    const candidate = `T${brisbaneYYMMDD(tender.createdAt)}-${slug}-Rev${newRev}`;
    const unique = await this.ensureUnique(candidate);
    await this.prisma.tender.update({
      where: { id: tenderId },
      data: { tenderNumber: unique, revisionNumber: newRev }
    });
    return {
      tenderNumber: unique,
      previousTenderNumber: tender.tenderNumber,
      revisionNumber: newRev
    };
  }

  validate(tenderNumber: string): string | null {
    if (!tenderNumber) return "Tender number is required.";
    if (!TenderNumberService.TENDER_NUMBER_REGEX.test(tenderNumber)) {
      return `Tender number "${tenderNumber}" is not in canonical format TYYMMDD-SLUG-RevN.`;
    }
    return null;
  }

  private async ensureUnique(candidate: string): Promise<string> {
    let proposed = candidate;
    let suffix = 1;
    while (
      await this.prisma.tender.findUnique({ where: { tenderNumber: proposed }, select: { id: true } })
    ) {
      suffix += 1;
      proposed = `${candidate}-${suffix}`;
    }
    return proposed;
  }
}
