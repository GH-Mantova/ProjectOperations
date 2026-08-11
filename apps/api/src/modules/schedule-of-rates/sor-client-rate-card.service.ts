import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, SorCategory } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

// ─── Input types ─────────────────────────────────────────────────────────────

export type AddClientRateEntryInput = {
  /** Id of the master SorRate being overridden. Null for fresh additions. */
  sorRateId?: string | null;
  category: SorCategory;
  /** Position (labour) or name/item (plant/waste/sub). */
  position: string;
  class?: string | null;
  unit?: string | null;
  ordinary?: number | null;
  oneAndHalf?: number | null;
  double?: number | null;
};

export type EditClientRateEntryInput = {
  position?: string;
  class?: string | null;
  unit?: string | null;
  ordinary?: number | null;
  oneAndHalf?: number | null;
  double?: number | null;
};

// ─── Merged row type (returned by listEntries) ────────────────────────────────

export type MergedRateRow = {
  /** Entry id — either the SorClientRateEntry id (override/addition) or a synthetic "master:<rateId>" string. */
  id: string;
  /** The master SorRate id, if applicable. Null for fresh client additions. */
  sorRateId: string | null;
  /** The SorClientRateEntry id, if one exists for this row. Null for untouched master rows. */
  entryId: string | null;
  category: SorCategory;
  position: string;
  class: string | null;
  unit: string | null;
  ordinary: string | null;
  oneAndHalf: string | null;
  double: string | null;
  /**
   * "master" — untouched master row (no client entry).
   * "override" — master row with client-applied value change.
   * "added" — fresh client addition (no master row).
   * "removed" — master row soft-removed by client.
   */
  rowKind: "master" | "override" | "added" | "removed";
};

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * SoR S3 — per-client rate card.
 *
 * A SorClientRateCard holds the delta (overrides + additions + removals) on
 * top of a master SorPeriod catalog for a specific client.
 *
 * listEntries() merges master rows with client overrides/removals so the UI
 * gets a single, sorted merged view — analogous to TenderRateSet hydration.
 *
 * Every mutation appends a SorChangeLogEntry so the audit trail stays intact.
 */
@Injectable()
export class SorClientRateCardService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Card management ───────────────────────────────────────────────────────

  /**
   * List all client rate cards for a given period.
   * Includes the client name for display.
   */
  async listCardsForPeriod(sorPeriodId: string) {
    const period = await this.prisma.sorPeriod.findUnique({ where: { id: sorPeriodId } });
    if (!period) throw new NotFoundException(`SorPeriod ${sorPeriodId} not found`);

    return this.prisma.sorClientRateCard.findMany({
      where: { sorPeriodId },
      include: {
        client: { select: { id: true, name: true, code: true } },
        _count: { select: { entries: true } }
      },
      orderBy: { client: { name: "asc" } }
    });
  }

  /**
   * List all client rate cards for a given client (across all periods).
   */
  async listCardsForClient(clientId: string) {
    return this.prisma.sorClientRateCard.findMany({
      where: { clientId },
      include: {
        sorPeriod: { select: { id: true, year: true, half: true, label: true, status: true } },
        _count: { select: { entries: true } }
      },
      orderBy: [{ sorPeriod: { year: "desc" } }, { sorPeriod: { half: "asc" } }]
    });
  }

  /**
   * Get or create a client rate card for the given client + period.
   * Returns { card, created }.
   */
  async getOrCreateCard(clientId: string, sorPeriodId: string, actorId?: string) {
    // Verify both exist
    const [client, period] = await Promise.all([
      this.prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } }),
      this.prisma.sorPeriod.findUnique({ where: { id: sorPeriodId }, select: { id: true, label: true } })
    ]);
    if (!client) throw new NotFoundException(`Client ${clientId} not found`);
    if (!period) throw new NotFoundException(`SorPeriod ${sorPeriodId} not found`);

    const existing = await this.prisma.sorClientRateCard.findUnique({
      where: { clientId_sorPeriodId: { clientId, sorPeriodId } }
    });
    if (existing) return { card: existing, created: false };

    const card = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sorClientRateCard.create({
        data: { clientId, sorPeriodId, status: "ACTIVE" }
      });

      await tx.sorChangeLogEntry.create({
        data: {
          periodId: sorPeriodId,
          rateId: null,
          field: "client-card-created",
          oldValue: null,
          newValue: JSON.stringify({ cardId: created.id, clientId, clientName: client.name }),
          changedById: actorId ?? null
        }
      });

      return created;
    });

    return { card, created: true };
  }

  // ── Merged view ───────────────────────────────────────────────────────────

  /**
   * Produce the merged view of master rates + client overrides for a card.
   * Order: master sort-order, then additions at the end within each category.
   */
  async listEntries(cardId: string): Promise<{ card: { id: string; clientId: string; sorPeriodId: string; status: string }; rows: MergedRateRow[] }> {
    const card = await this.prisma.sorClientRateCard.findUnique({
      where: { id: cardId },
      select: { id: true, clientId: true, sorPeriodId: true, status: true }
    });
    if (!card) throw new NotFoundException(`SorClientRateCard ${cardId} not found`);

    // Load master rates (active) + all client entries for this card
    const [masterRates, clientEntries] = await Promise.all([
      this.prisma.sorRate.findMany({
        where: { periodId: card.sorPeriodId, active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
      }),
      this.prisma.sorClientRateEntry.findMany({
        where: { cardId },
        orderBy: { createdAt: "asc" }
      })
    ]);

    // Index client entries by sorRateId (for overrides/removals) and gather fresh additions
    const entryBySorRateId = new Map<string, (typeof clientEntries)[0]>();
    const freshAdditions: (typeof clientEntries)[0][] = [];

    for (const entry of clientEntries) {
      if (entry.sorRateId) {
        entryBySorRateId.set(entry.sorRateId, entry);
      } else {
        freshAdditions.push(entry);
      }
    }

    const rows: MergedRateRow[] = [];

    // Master rows — check if client overrode or removed each
    for (const rate of masterRates) {
      const clientEntry = entryBySorRateId.get(rate.id);

      if (!clientEntry) {
        // Untouched master row
        rows.push({
          id: `master:${rate.id}`,
          sorRateId: rate.id,
          entryId: null,
          category: rate.category,
          position: rate.name,
          class: rate.class,
          unit: rate.unit,
          ordinary: rate.ordinary?.toString() ?? null,
          oneAndHalf: rate.oneAndHalf?.toString() ?? null,
          double: rate.double?.toString() ?? null,
          rowKind: "master"
        });
      } else if (clientEntry.isRemoved) {
        rows.push({
          id: clientEntry.id,
          sorRateId: rate.id,
          entryId: clientEntry.id,
          category: rate.category,
          position: clientEntry.position,
          class: clientEntry.class,
          unit: clientEntry.unit,
          ordinary: clientEntry.ordinary?.toString() ?? null,
          oneAndHalf: clientEntry.oneAndHalf?.toString() ?? null,
          double: clientEntry.double?.toString() ?? null,
          rowKind: "removed"
        });
      } else {
        rows.push({
          id: clientEntry.id,
          sorRateId: rate.id,
          entryId: clientEntry.id,
          category: clientEntry.category,
          position: clientEntry.position,
          class: clientEntry.class,
          unit: clientEntry.unit,
          ordinary: clientEntry.ordinary?.toString() ?? null,
          oneAndHalf: clientEntry.oneAndHalf?.toString() ?? null,
          double: clientEntry.double?.toString() ?? null,
          rowKind: "override"
        });
      }
    }

    // Fresh client additions (no master row)
    for (const entry of freshAdditions) {
      rows.push({
        id: entry.id,
        sorRateId: null,
        entryId: entry.id,
        category: entry.category,
        position: entry.position,
        class: entry.class,
        unit: entry.unit,
        ordinary: entry.ordinary?.toString() ?? null,
        oneAndHalf: entry.oneAndHalf?.toString() ?? null,
        double: entry.double?.toString() ?? null,
        rowKind: "added"
      });
    }

    return { card, rows };
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  /**
   * Add a fresh entry or create an override for a master rate.
   * If sorRateId is provided, creates an override for that master rate.
   * If sorRateId is null/undefined, creates a fresh client-only addition.
   */
  async addEntry(cardId: string, input: AddClientRateEntryInput, actorId?: string) {
    const card = await this.prisma.sorClientRateCard.findUnique({
      where: { id: cardId },
      select: { id: true, sorPeriodId: true }
    });
    if (!card) throw new NotFoundException(`SorClientRateCard ${cardId} not found`);

    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.sorClientRateEntry.create({
        data: {
          cardId,
          sorRateId: input.sorRateId ?? null,
          category: input.category,
          position: input.position,
          class: input.class ?? null,
          unit: input.unit ?? null,
          ordinary: input.ordinary != null ? new Prisma.Decimal(input.ordinary) : null,
          oneAndHalf: input.oneAndHalf != null ? new Prisma.Decimal(input.oneAndHalf) : null,
          double: input.double != null ? new Prisma.Decimal(input.double) : null,
          isOverride: !!input.sorRateId,
          isRemoved: false
        }
      });

      await tx.sorChangeLogEntry.create({
        data: {
          periodId: card.sorPeriodId,
          rateId: input.sorRateId ?? null,
          field: input.sorRateId ? "client-entry-override" : "client-entry-added",
          oldValue: null,
          newValue: JSON.stringify({
            cardId,
            entryId: created.id,
            position: created.position,
            category: created.category,
            ordinary: created.ordinary?.toString() ?? null
          }),
          changedById: actorId ?? null
        }
      });

      return created;
    });

    return entry;
  }

  /**
   * Edit an existing client rate entry. Creates the override flag if not already set.
   */
  async editEntry(entryId: string, input: EditClientRateEntryInput, actorId?: string) {
    const existing = await this.prisma.sorClientRateEntry.findUnique({ where: { id: entryId } });
    if (!existing) throw new NotFoundException(`SorClientRateEntry ${entryId} not found`);

    const card = await this.prisma.sorClientRateCard.findUnique({
      where: { id: existing.cardId },
      select: { id: true, sorPeriodId: true }
    });
    if (!card) throw new NotFoundException(`SorClientRateCard ${existing.cardId} not found`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = { isOverride: true };

      if (input.position !== undefined) updateData["position"] = input.position;
      if (input.class !== undefined) updateData["class"] = input.class;
      if (input.unit !== undefined) updateData["unit"] = input.unit;
      if (input.ordinary !== undefined) {
        updateData["ordinary"] = input.ordinary != null ? new Prisma.Decimal(input.ordinary) : null;
      }
      if (input.oneAndHalf !== undefined) {
        updateData["oneAndHalf"] = input.oneAndHalf != null ? new Prisma.Decimal(input.oneAndHalf) : null;
      }
      if (input.double !== undefined) {
        updateData["double"] = input.double != null ? new Prisma.Decimal(input.double) : null;
      }

      const result = await tx.sorClientRateEntry.update({
        where: { id: entryId },
        data: updateData
      });

      await tx.sorChangeLogEntry.create({
        data: {
          periodId: card.sorPeriodId,
          rateId: existing.sorRateId ?? null,
          field: "client-entry-edited",
          oldValue: JSON.stringify({
            position: existing.position,
            ordinary: existing.ordinary?.toString() ?? null
          }),
          newValue: JSON.stringify({
            position: result.position,
            ordinary: result.ordinary?.toString() ?? null
          }),
          changedById: actorId ?? null
        }
      });

      return result;
    });

    return updated;
  }

  /**
   * Soft-remove a master rate from a client card.
   * If a client entry already exists for this master rate, marks it isRemoved=true.
   * If no entry exists yet, creates one with isRemoved=true.
   */
  async removeEntry(cardId: string, sorRateId: string, actorId?: string) {
    const card = await this.prisma.sorClientRateCard.findUnique({
      where: { id: cardId },
      select: { id: true, sorPeriodId: true }
    });
    if (!card) throw new NotFoundException(`SorClientRateCard ${cardId} not found`);

    // Verify the master rate exists and belongs to the card's period
    const masterRate = await this.prisma.sorRate.findUnique({ where: { id: sorRateId } });
    if (!masterRate || masterRate.periodId !== card.sorPeriodId) {
      throw new NotFoundException(`SorRate ${sorRateId} not found in this period`);
    }

    return this.prisma.$transaction(async (tx) => {
      const existingEntry = await tx.sorClientRateEntry.findFirst({
        where: { cardId, sorRateId }
      });

      let entry;
      if (existingEntry) {
        entry = await tx.sorClientRateEntry.update({
          where: { id: existingEntry.id },
          data: { isRemoved: true }
        });
      } else {
        entry = await tx.sorClientRateEntry.create({
          data: {
            cardId,
            sorRateId,
            category: masterRate.category,
            position: masterRate.name,
            class: masterRate.class ?? null,
            unit: masterRate.unit ?? null,
            ordinary: masterRate.ordinary ?? null,
            oneAndHalf: masterRate.oneAndHalf ?? null,
            double: masterRate.double ?? null,
            isOverride: false,
            isRemoved: true
          }
        });
      }

      await tx.sorChangeLogEntry.create({
        data: {
          periodId: card.sorPeriodId,
          rateId: sorRateId,
          field: "client-entry-removed",
          oldValue: JSON.stringify({ position: masterRate.name }),
          newValue: null,
          changedById: actorId ?? null
        }
      });

      return entry;
    });
  }

  /**
   * Remove a fresh client addition (a SorClientRateEntry with no sorRateId).
   */
  async removeFreshEntry(entryId: string, actorId?: string) {
    const existing = await this.prisma.sorClientRateEntry.findUnique({ where: { id: entryId } });
    if (!existing) throw new NotFoundException(`SorClientRateEntry ${entryId} not found`);

    const card = await this.prisma.sorClientRateCard.findUnique({
      where: { id: existing.cardId },
      select: { id: true, sorPeriodId: true }
    });
    if (!card) throw new NotFoundException(`SorClientRateCard ${existing.cardId} not found`);

    return this.prisma.$transaction(async (tx) => {
      await tx.sorClientRateEntry.delete({ where: { id: entryId } });

      await tx.sorChangeLogEntry.create({
        data: {
          periodId: card.sorPeriodId,
          rateId: null,
          field: "client-entry-deleted",
          oldValue: JSON.stringify({ entryId, position: existing.position }),
          newValue: null,
          changedById: actorId ?? null
        }
      });

      return { deleted: true };
    });
  }

  /**
   * Reset a client rate card to default: delete all SorClientRateEntry rows
   * for this card (drops all overrides, removals, and additions) while keeping
   * the SorClientRateCard row itself.
   */
  async resetToDefault(cardId: string, actorId?: string) {
    const card = await this.prisma.sorClientRateCard.findUnique({
      where: { id: cardId },
      select: { id: true, sorPeriodId: true, clientId: true }
    });
    if (!card) throw new NotFoundException(`SorClientRateCard ${cardId} not found`);

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.sorClientRateEntry.deleteMany({ where: { cardId } });

      await tx.sorChangeLogEntry.create({
        data: {
          periodId: card.sorPeriodId,
          rateId: null,
          field: "client-card-reset",
          oldValue: JSON.stringify({ deletedEntries: deleted.count }),
          newValue: JSON.stringify({ cardId, status: "reset-to-master" }),
          changedById: actorId ?? null
        }
      });

      return { reset: true, deletedEntries: deleted.count };
    });
  }
}
