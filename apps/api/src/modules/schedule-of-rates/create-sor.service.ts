/**
 * @module create-sor.service
 * S4 — Create Schedule of Rates service (rate-hub-sor-integration-plan.md §S4).
 */
import {
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Prisma, SorCategory, SorPeriodHalf, SorRateSourceType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SorSourceMarkupService } from "./sor-source-markup.service";

// ── DTOs ──────────────────────────────────────────────────────────────────────

export type CreateSorLineDto = {
  name: string;
  category: SorCategory;
  unit?: string | null;
  baseRate: number;
  sourceType: "INTERNAL" | "SUBBIE" | "SUPPLIER" | "MANUAL";
  sourceRateRowId?: string | null;
  sourceSubRateId?: string | null;
  markupPct?: number | null;
};

export type CreateSorDto = {
  year: number;
  half: SorPeriodHalf;
  startDate: string; // ISO date string
  expiryDate: string; // ISO date string
  label: string;
  lines: CreateSorLineDto[];
};

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * S4 — Create Schedule of Rates wizard service.
 *
 * Validates year+half uniqueness, creates the SorPeriod, creates all SorRate
 * rows (with source linkage per the S3 pattern), resolves the effective rate
 * for each line via SorSourceMarkupService, writes a single audit log entry,
 * and returns the full period including its rates.
 */
@Injectable()
export class CreateSorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sorMarkup: SorSourceMarkupService,
  ) {}

  async createSorPeriod(dto: CreateSorDto, actorId: string) {
    // Validate uniqueness before writing anything
    const existing = await this.prisma.sorPeriod.findUnique({
      where: { year_half: { year: dto.year, half: dto.half } },
    });
    if (existing) {
      throw new ConflictException(
        `A SorPeriod for ${dto.year} ${dto.half} already exists (id: ${existing.id}).`,
      );
    }

    // All writes inside a transaction so a line-create failure rolls back the period.
    const period = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sorPeriod.create({
        data: {
          year: dto.year,
          half: dto.half,
          startDate: new Date(dto.startDate),
          expiryDate: new Date(dto.expiryDate),
          label: dto.label,
          status: "ACTIVE",
        },
      });

      // Create each SorRate line.
      for (const line of dto.lines) {
        const sourceType = line.sourceType as SorRateSourceType;

        // resolveEffectiveRate needs a partial SorRate-like object.
        // base rate goes in as ordinary; period has no category markups yet
        // (set after creation via the category-markups endpoint if needed).
        // Per-line markupPct override is applied when present.
        const tempSorRate = {
          category: line.category,
          ordinary: new Prisma.Decimal(line.baseRate),
          markupPct: line.markupPct != null ? new Prisma.Decimal(line.markupPct) : null,
        };
        const effectiveRate = this.sorMarkup.resolveEffectiveRate(
          tempSorRate,
          {}, // no period-level markups at create time; per-line wins or base is used
        );

        await tx.sorRate.create({
          data: {
            periodId: created.id,
            category: line.category,
            name: line.name,
            unit: line.unit ?? null,
            ordinary: new Prisma.Decimal(effectiveRate || line.baseRate),
            isReference: false,
            active: true,
            sortOrder: 0,
            sourceType,
            sourceRateRowId:
              sourceType === SorRateSourceType.INTERNAL
                ? (line.sourceRateRowId ?? null)
                : null,
            sourceSubRateId:
              sourceType === SorRateSourceType.SUBBIE ||
              sourceType === SorRateSourceType.SUPPLIER
                ? (line.sourceSubRateId ?? null)
                : null,
            markupPct:
              line.markupPct != null
                ? new Prisma.Decimal(line.markupPct)
                : null,
          },
        });
      }

      return created;
    });

    // Append a single audit entry after the transaction commits.
    await this.audit.write({
      actorId,
      action: "sor.period.create-wizard",
      entityType: "SorPeriod",
      entityId: period.id,
      metadata: {
        year: dto.year,
        half: dto.half,
        label: dto.label,
        lineCount: dto.lines.length,
      },
    });

    // Return full period + rates so the caller can redirect with the new id.
    return this.prisma.sorPeriod.findUniqueOrThrow({
      where: { id: period.id },
      include: {
        rates: {
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
    });
  }
}
