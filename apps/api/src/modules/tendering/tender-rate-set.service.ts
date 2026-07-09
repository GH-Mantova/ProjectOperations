import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { RateResolverService } from "../rates/rate-resolver.service";

@Injectable()
export class TenderRateSetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly resolver: RateResolverService
  ) {}

  /**
   * Snapshot the resolved rate set for a tender. Idempotent: existing
   * entries with a user override keep the override and refresh nothing;
   * entries with no override refresh their `originalValue` to the current
   * resolved value; new resolved rates are added; entries no longer in
   * the resolved set are left in place (in case the user is still using
   * them). Returns the full set + entries.
   */
  async lock(tenderId: string, actorId: string, sourceLabel?: string | null) {
    await this.ensureTenderExists(tenderId);
    const resolved = await this.resolver.enumerateRateSet();

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const set = await tx.tenderRateSet.upsert({
        where: { tenderId },
        create: {
          tenderId,
          lockedAt: now,
          lockedById: actorId,
          sourceLabel: sourceLabel?.trim() || null
        },
        update: {
          lockedAt: now,
          lockedById: actorId,
          sourceLabel: sourceLabel === undefined ? undefined : sourceLabel?.trim() || null
        }
      });

      const existing = await tx.tenderRateEntry.findMany({
        where: { tenderRateSetId: set.id }
      });
      const existingByKey = new Map(existing.map((e) => [e.key, e]));

      for (const entry of resolved) {
        const current = existingByKey.get(entry.key);
        if (!current) {
          await tx.tenderRateEntry.create({
            data: {
              tenderRateSetId: set.id,
              key: entry.key,
              rateTableId: entry.rateTableId,
              rateTableSlug: entry.rateTableSlug,
              label: entry.label,
              unit: entry.unit,
              originalValue: new Prisma.Decimal(entry.value)
            }
          });
        } else if (current.overrideValue === null || current.overrideValue === undefined) {
          await tx.tenderRateEntry.update({
            where: { id: current.id },
            data: {
              label: entry.label,
              unit: entry.unit,
              rateTableId: entry.rateTableId,
              rateTableSlug: entry.rateTableSlug,
              originalValue: new Prisma.Decimal(entry.value)
            }
          });
        }
      }

      await tx.tender.update({
        where: { id: tenderId },
        data: { ratesSnapshotAt: now }
      });

      await this.audit.write({
        actorId,
        action: "tenders.rate-set.lock",
        entityType: "TenderRateSet",
        entityId: set.id,
        metadata: { tenderId, entryCount: resolved.length }
      });

      return this.hydrate(tx, tenderId);
    });
  }

  async get(tenderId: string) {
    await this.ensureTenderExists(tenderId);
    return this.hydrate(this.prisma, tenderId);
  }

  async updateEntry(
    tenderId: string,
    entryId: string,
    overrideValue: number | null,
    actorId: string
  ) {
    const set = await this.prisma.tenderRateSet.findUnique({
      where: { tenderId },
      select: { id: true }
    });
    if (!set) throw new NotFoundException("Rates are not locked for this tender.");

    const entry = await this.prisma.tenderRateEntry.findUnique({ where: { id: entryId } });
    if (!entry || entry.tenderRateSetId !== set.id) {
      throw new NotFoundException("Rate entry not found on this tender.");
    }

    if (overrideValue !== null) {
      if (!Number.isFinite(overrideValue) || overrideValue < 0) {
        throw new BadRequestException("Override value must be a non-negative number.");
      }
    }

    const updated = await this.prisma.tenderRateEntry.update({
      where: { id: entryId },
      data: {
        overrideValue: overrideValue === null ? null : new Prisma.Decimal(overrideValue)
      }
    });

    await this.audit.write({
      actorId,
      action: overrideValue === null ? "tenders.rate-set.entry.revert" : "tenders.rate-set.entry.update",
      entityType: "TenderRateEntry",
      entityId: updated.id,
      metadata: { tenderId, key: updated.key }
    });

    return this.serializeEntry(updated);
  }

  async unlock(tenderId: string, actorId: string) {
    const set = await this.prisma.tenderRateSet.findUnique({
      where: { tenderId },
      select: { id: true }
    });
    if (!set) return { unlocked: false };

    await this.prisma.$transaction([
      this.prisma.tenderRateSet.delete({ where: { id: set.id } }),
      this.prisma.tender.update({
        where: { id: tenderId },
        data: { ratesSnapshotAt: null }
      })
    ]);

    await this.audit.write({
      actorId,
      action: "tenders.rate-set.unlock",
      entityType: "TenderRateSet",
      entityId: set.id,
      metadata: { tenderId }
    });

    return { unlocked: true };
  }

  private async hydrate(
    client: PrismaService | Prisma.TransactionClient,
    tenderId: string
  ) {
    const set = await client.tenderRateSet.findUnique({
      where: { tenderId },
      include: {
        lockedBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
    if (!set) return null;

    const entries = await client.tenderRateEntry.findMany({
      where: { tenderRateSetId: set.id },
      orderBy: [{ rateTableSlug: "asc" }, { label: "asc" }]
    });

    type SerializedEntry = ReturnType<TenderRateSetService["serializeEntry"]>;
    const groups = new Map<
      string,
      {
        rateTableId: string | null;
        rateTableSlug: string | null;
        tableName: string;
        entries: SerializedEntry[];
      }
    >();
    for (const entry of entries) {
      const groupKey = entry.rateTableId ?? entry.rateTableSlug ?? "_other";
      const existing = groups.get(groupKey);
      const serialized = this.serializeEntry(entry);
      if (existing) {
        existing.entries.push(serialized);
      } else {
        const tableName = entry.label.split(" — ")[0]?.split(" (")[0] ?? "Rates";
        groups.set(groupKey, {
          rateTableId: entry.rateTableId,
          rateTableSlug: entry.rateTableSlug,
          tableName,
          entries: [serialized]
        });
      }
    }

    return {
      id: set.id,
      tenderId: set.tenderId,
      lockedAt: set.lockedAt.toISOString(),
      lockedBy: set.lockedBy
        ? {
            id: set.lockedBy.id,
            firstName: set.lockedBy.firstName,
            lastName: set.lockedBy.lastName
          }
        : null,
      sourceLabel: set.sourceLabel,
      groups: Array.from(groups.values())
    };
  }

  private serializeEntry(entry: {
    id: string;
    key: string;
    label: string;
    unit: string | null;
    rateTableId: string | null;
    rateTableSlug: string | null;
    originalValue: Prisma.Decimal;
    overrideValue: Prisma.Decimal | null;
  }) {
    return {
      id: entry.id,
      key: entry.key,
      label: entry.label,
      unit: entry.unit,
      rateTableId: entry.rateTableId,
      rateTableSlug: entry.rateTableSlug,
      originalValue: entry.originalValue.toString(),
      overrideValue: entry.overrideValue === null ? null : entry.overrideValue.toString(),
      effectiveValue: (entry.overrideValue ?? entry.originalValue).toString(),
      overridden: entry.overrideValue !== null
    };
  }

  private async ensureTenderExists(tenderId: string) {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true }
    });
    if (!tender) throw new NotFoundException("Tender not found.");
  }
}
