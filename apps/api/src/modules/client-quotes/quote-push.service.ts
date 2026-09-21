import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ScopeRedesignService } from "../tendering/scope-redesign.service";

/**
 * QUOTE_PUSH_BY_DESTINATION_V1 (scopecards-s4a) -- push routes by destination,
 * one row per estimate line across three tables.
 */
export const QUOTE_PUSH_BY_DESTINATION_V1 = "scopecards-s4a";

// Discipline order for group lettering: DEM, CIV, ASB, Other, SUB last.
// Mirrors DISCIPLINE_ORDER in estimate-export.service.ts.
const DISCIPLINE_GROUP_ORDER = ["DEM", "CIV", "ASB", "Other", "SUB"] as const;

// Group names seeded from discipline code.
const DISCIPLINE_GROUP_NAME: Record<string, string> = {
  DEM: "Demolition",
  CIV: "Civil Works",
  ASB: "Asbestos Removal",
  Other: "Other (Provisional Sums, Options, Adjustments)",
  SUB: "Subcontracted Works"
};

// Letters for groups. A-Z should be plenty.
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Source types for each line type.
// scope-item: "scope"
// waste: "waste"
// cutting: "cutting"
// operational: "operational"

export type PushableLine = {
  type: "scope" | "waste" | "cutting" | "operational";
  id: string;
  code: string;
  description: string;
  cardId: string;
  cardCode: string;
  discipline: string;
  quoteDestination: "PRICE" | "PROVISIONAL" | "OPTION" | "INTERNAL";
  price: number;
  priceable: boolean;
  priceReason: string | null;
};

export type GroupChange = {
  code: string;
  label: string;
  name: string;
  prevTotal: number | null;
  nextTotal: number;
};

export type PushChange =
  | { action: "create"; type: string; id: string; description: string; destination: string; price: number }
  | { action: "update"; type: string; id: string; description: string; destination: string; price: number; prevPrice: number; keptDisplayDescription: boolean; keptOverrideAmount: boolean }
  | { action: "move"; type: string; id: string; description: string; fromDestination: string; destination: string; price: number }
  | { action: "withdraw"; type: string; id: string; description: string; prevDestination: string; prevPrice: number }
  | { action: "unchanged"; type: string; id: string; description: string; destination: string; price: number };

export type PushPlan = {
  counts: { create: number; update: number; move: number; withdraw: number; unchanged: number };
  groups: GroupChange[];
  changes: PushChange[];
  fingerprint: string;
  estimateChangedSincePush: boolean;
  quoteStatus: string;
};

@Injectable()
export class QuotePushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ScopeRedesignService,
    private readonly auditService: AuditService
  ) {}

  /**
   * Compute the push diff without applying it. Safe for any quote status.
   */
  async plan(tenderId: string, quoteId: string): Promise<PushPlan> {
    const [quote, pushable] = await Promise.all([
      this.prisma.clientQuote.findUnique({
        where: { id: quoteId },
        include: {
          costLines: true,
          provisionalLines: true,
          costOptions: true,
          costGroups: { orderBy: { sortOrder: "asc" } }
        }
      }),
      this.scope.listPushableLines(tenderId)
    ]);
    if (!quote || quote.tenderId !== tenderId) throw new NotFoundException("Quote not found.");

    return this._buildPlan(pushable, quote);
  }

  /**
   * Apply the push in one $transaction. 409 if quote is not DRAFT.
   */
  async apply(tenderId: string, quoteId: string, actorId: string): Promise<PushPlan> {
    // Check status before any DB write.
    const quote = await this.prisma.clientQuote.findUnique({
      where: { id: quoteId },
      include: {
        costLines: true,
        provisionalLines: true,
        costOptions: true,
        costGroups: { orderBy: { sortOrder: "asc" } }
      }
    });
    if (!quote || quote.tenderId !== tenderId) throw new NotFoundException("Quote not found.");

    if (quote.status !== "DRAFT") {
      const sentDate = quote.sentAt
        ? quote.sentAt.toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" })
        : "unknown date";
      throw new ConflictException(
        `This quote was sent on ${sentDate} and cannot be changed by a push. Create a new revision and push into that.`
      );
    }

    const pushable = await this.scope.listPushableLines(tenderId);
    const thePlan = this._buildPlan(pushable, quote);

    await this.prisma.$transaction(async (tx) => {
      // Apply group creates/updates.
      for (const g of thePlan.groups) {
        await tx.quoteCostGroup.upsert({
          where: { quoteId_code: { quoteId, code: g.code } },
          create: {
            quoteId,
            code: g.code,
            label: g.label,
            name: g.name,
            sortOrder: DISCIPLINE_GROUP_ORDER.indexOf(g.code as (typeof DISCIPLINE_GROUP_ORDER)[number])
          },
          update: {}
          // Never update label/name once set -- label is frozen, name is user-editable.
        });
      }

      // Reload groups to get their IDs.
      const groupRows = await tx.quoteCostGroup.findMany({ where: { quoteId } });
      const groupByCode = new Map(groupRows.map((g) => [g.code, g]));

      // Apply per-change mutations.
      for (const change of thePlan.changes) {
        const pushLine = pushable.find((p) => p.type === change.type && p.id === change.id);
        if (!pushLine) continue;

        if (change.action === "create") {
          await this._createRow(tx, quoteId, pushLine, groupByCode, quote);
        } else if (change.action === "update") {
          await this._updateRow(tx, quoteId, pushLine);
        } else if (change.action === "move") {
          await this._deleteExistingRow(tx, quoteId, pushLine, quote);
          await this._createRow(tx, quoteId, pushLine, groupByCode, quote);
        } else if (change.action === "withdraw") {
          await this._deleteExistingRow(tx, quoteId, pushLine, quote);
        }
        // unchanged: do nothing.
      }

      // Stamp the push.
      await tx.clientQuote.update({
        where: { id: quoteId },
        data: {
          pushedAt: new Date(),
          pushedById: actorId,
          pushedFingerprint: thePlan.fingerprint
        }
      });
    });

    // Audit.
    await this.auditService.write({
      actorId,
      action: "quote.push",
      entityType: "ClientQuote",
      entityId: quoteId,
      metadata: {
        tenderId,
        counts: thePlan.counts,
        fingerprint: thePlan.fingerprint
      }
    });

    return thePlan;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private _buildPlan(
    pushable: PushableLine[],
    quote: {
      id: string;
      status: string;
      pushedFingerprint: string | null;
      costLines: Array<{
        id: string;
        groupId: string | null;
        label: string;
        description: string;
        displayDescription: string | null;
        price: Prisma.Decimal;
        overrideAmount: Prisma.Decimal | null;
        isVisible: boolean;
        sourceEstimateLineType: string | null;
        sourceEstimateLineId: string | null;
        sortOrder: number;
      }>;
      provisionalLines: Array<{
        id: string;
        description: string;
        price: Prisma.Decimal;
        sourceEstimateLineType: string | null;
        sourceEstimateLineId: string | null;
        sortOrder: number;
      }>;
      costOptions: Array<{
        id: string;
        label: string;
        description: string;
        price: Prisma.Decimal;
        sourceEstimateLineType: string | null;
        sourceEstimateLineId: string | null;
        sortOrder: number;
      }>;
      costGroups: Array<{
        id: string;
        code: string;
        label: string;
        name: string;
        sortOrder: number;
      }>;
    }
  ): PushPlan {
    const changes: PushChange[] = [];
    const groupsNeeded = new Map<string, { label: string; name: string }>();

    // Index existing pushed rows by (type, sourceId).
    const indexedCostLines = new Map(
      quote.costLines
        .filter((l) => l.sourceEstimateLineType && l.sourceEstimateLineId)
        .map((l) => [`${l.sourceEstimateLineType}:${l.sourceEstimateLineId}`, l])
    );
    const indexedProvLines = new Map(
      quote.provisionalLines
        .filter((l) => l.sourceEstimateLineType && l.sourceEstimateLineId)
        .map((l) => [`${l.sourceEstimateLineType}:${l.sourceEstimateLineId}`, l])
    );
    const indexedOptions = new Map(
      quote.costOptions
        .filter((l) => l.sourceEstimateLineType && l.sourceEstimateLineId)
        .map((l) => [`${l.sourceEstimateLineType}:${l.sourceEstimateLineId}`, l])
    );

    // Determine which disciplines need groups (PRICE-destined lines only).
    const existingGroupCodes = new Set(quote.costGroups.map((g) => g.code));

    for (const line of pushable) {
      if (line.quoteDestination === "INTERNAL") {
        // INTERNAL lines never land on the quote.
        continue;
      }

      const key = `${line.type}:${line.id}`;
      const existingCostLine = indexedCostLines.get(key);
      const existingProvLine = indexedProvLines.get(key);
      const existingOption = indexedOptions.get(key);

      // Determine current table.
      const currentDest = existingCostLine
        ? "PRICE"
        : existingProvLine
          ? "PROVISIONAL"
          : existingOption
            ? "OPTION"
            : null;

      const dest = line.quoteDestination;

      if (dest === "PRICE") {
        // Ensure a group row exists for this discipline.
        if (!existingGroupCodes.has(line.discipline)) {
          const letter = this._nextGroupLetter(groupsNeeded, existingGroupCodes, quote.costGroups);
          groupsNeeded.set(line.discipline, {
            label: letter,
            name: DISCIPLINE_GROUP_NAME[line.discipline] ?? line.discipline
          });
          existingGroupCodes.add(line.discipline);
        }
      }

      if (currentDest === null) {
        // No existing row — create.
        changes.push({
          action: "create",
          type: line.type,
          id: line.id,
          description: line.description,
          destination: dest,
          price: line.price
        });
      } else if (currentDest === dest) {
        // Row is on the right table.
        const existing = existingCostLine ?? existingProvLine ?? existingOption!;
        const existingPrice = toNum(existing.price);
        const priceChanged = Math.abs(existingPrice - line.price) > 0.001;
        const descChanged = existing.description !== line.description;

        if (!priceChanged && !descChanged) {
          changes.push({
            action: "unchanged",
            type: line.type,
            id: line.id,
            description: line.description,
            destination: dest,
            price: line.price
          });
        } else {
          const hasDd = "displayDescription" in existing ? !!(existing as typeof existingCostLine)!.displayDescription : false;
          const hasOa = "overrideAmount" in existing ? (existing as typeof existingCostLine)!.overrideAmount !== null : false;
          changes.push({
            action: "update",
            type: line.type,
            id: line.id,
            description: line.description,
            destination: dest,
            price: line.price,
            prevPrice: existingPrice,
            keptDisplayDescription: hasDd,
            keptOverrideAmount: hasOa
          });
        }
      } else {
        // Row is on the wrong table — move.
        changes.push({
          action: "move",
          type: line.type,
          id: line.id,
          description: line.description,
          fromDestination: currentDest,
          destination: dest,
          price: line.price
        });
      }
    }

    // Withdrawals: rows with pointers whose estimate line is now INTERNAL or gone.
    const pushableKeys = new Set(
      pushable
        .filter((l) => l.quoteDestination !== "INTERNAL")
        .map((l) => `${l.type}:${l.id}`)
    );
    // Also include INTERNAL lines that have existing rows (they were once non-INTERNAL).
    const internalKeys = new Set(
      pushable
        .filter((l) => l.quoteDestination === "INTERNAL")
        .map((l) => `${l.type}:${l.id}`)
    );

    for (const [key, row] of indexedCostLines) {
      if (!pushableKeys.has(key)) {
        changes.push({
          action: "withdraw",
          type: key.split(":")[0],
          id: key.split(":").slice(1).join(":"),
          description: row.description,
          prevDestination: "PRICE",
          prevPrice: toNum(row.price)
        });
      }
    }
    for (const [key, row] of indexedProvLines) {
      if (!pushableKeys.has(key)) {
        changes.push({
          action: "withdraw",
          type: key.split(":")[0],
          id: key.split(":").slice(1).join(":"),
          description: row.description,
          prevDestination: "PROVISIONAL",
          prevPrice: toNum(row.price)
        });
      }
    }
    for (const [key, row] of indexedOptions) {
      if (!pushableKeys.has(key)) {
        changes.push({
          action: "withdraw",
          type: key.split(":")[0],
          id: key.split(":").slice(1).join(":"),
          description: row.description,
          prevDestination: "OPTION",
          prevPrice: toNum(row.price)
        });
      }
    }

    // Build group change list.
    const groupChanges: GroupChange[] = [];
    for (const [code, { label, name }] of groupsNeeded) {
      const existing = quote.costGroups.find((g) => g.code === code);
      // Compute group totals from price lines.
      const priceLinesForDiscipline = pushable.filter(
        (l) => l.discipline === code && l.quoteDestination === "PRICE"
      );
      const nextTotal = priceLinesForDiscipline.reduce((s, l) => s + l.price, 0);
      groupChanges.push({
        code,
        label: existing?.label ?? label,
        name: existing?.name ?? name,
        prevTotal: existing ? null : null, // Computing prev total would need current rows
        nextTotal: round2(nextTotal)
      });
    }

    // Fingerprint: sha256 over pushable lines sorted by type:id:dest:price:description.
    const fpLines = pushable
      .map((l) => `${l.type}:${l.id}:${l.quoteDestination}:${l.price.toFixed(2)}:${l.description}`)
      .sort();
    const fingerprint = createHash("sha256").update(fpLines.join("\n")).digest("hex");

    const estimateChangedSincePush =
      !!quote.pushedFingerprint && fingerprint !== quote.pushedFingerprint;

    const counts = {
      create: changes.filter((c) => c.action === "create").length,
      update: changes.filter((c) => c.action === "update").length,
      move: changes.filter((c) => c.action === "move").length,
      withdraw: changes.filter((c) => c.action === "withdraw").length,
      unchanged: changes.filter((c) => c.action === "unchanged").length
    };

    return {
      counts,
      groups: groupChanges,
      changes,
      fingerprint,
      estimateChangedSincePush,
      quoteStatus: quote.status
    };
  }

  private _nextGroupLetter(
    groupsNeeded: Map<string, unknown>,
    existingGroupCodes: Set<string>,
    existingGroups: Array<{ label: string }>
  ): string {
    const usedLabels = new Set([
      ...existingGroups.map((g) => g.label),
      ...[...groupsNeeded.values()].map((v) => (v as { label: string }).label)
    ]);
    return LETTERS.find((l) => !usedLabels.has(l)) ?? "?";
  }

  private async _createRow(
    tx: Prisma.TransactionClient,
    quoteId: string,
    line: PushableLine,
    groupByCode: Map<string, { id: string; label: string }>,
    quote: { costOptions: Array<{ label: string }> }
  ) {
    const price = toDecimal(line.price);
    const sortOrder = 0; // Will be set by card/row order (simplified for now)

    if (line.quoteDestination === "PRICE") {
      const group = groupByCode.get(line.discipline);
      await tx.quoteCostLine.create({
        data: {
          quoteId,
          groupId: group?.id ?? null,
          label: line.code,
          description: line.description,
          price,
          baseValue: price,
          sortOrder,
          isVisible: line.priceable,
          sourceEstimateLineType: line.type,
          sourceEstimateLineId: line.id
        }
      });
    } else if (line.quoteDestination === "PROVISIONAL") {
      await tx.quoteProvisionalLine.create({
        data: {
          quoteId,
          description: line.description,
          price,
          sortOrder,
          sourceEstimateLineType: line.type,
          sourceEstimateLineId: line.id
        }
      });
    } else if (line.quoteDestination === "OPTION") {
      // Option letter: first letter not used by any QuoteCostOption on this quote.
      const usedOptionLabels = new Set(quote.costOptions.map((o) => o.label));
      const optionLabel = LETTERS.find((l) => !usedOptionLabels.has(l)) ?? "?";
      await tx.quoteCostOption.create({
        data: {
          quoteId,
          label: optionLabel,
          description: line.description,
          price,
          sortOrder,
          sourceEstimateLineType: line.type,
          sourceEstimateLineId: line.id
        }
      });
    }
  }

  private async _updateRow(
    tx: Prisma.TransactionClient,
    quoteId: string,
    line: PushableLine
  ) {
    const price = toDecimal(line.price);
    const key = { sourceEstimateLineType: line.type, sourceEstimateLineId: line.id };

    if (line.quoteDestination === "PRICE") {
      const existing = await tx.quoteCostLine.findFirst({
        where: { quoteId, ...key }
      });
      if (!existing) return;
      // Do NOT overwrite displayDescription, overrideAmount, or isVisible.
      await tx.quoteCostLine.update({
        where: { id: existing.id },
        data: { price, baseValue: price, description: line.description }
      });
    } else if (line.quoteDestination === "PROVISIONAL") {
      const existing = await tx.quoteProvisionalLine.findFirst({
        where: { quoteId, ...key }
      });
      if (!existing) return;
      await tx.quoteProvisionalLine.update({
        where: { id: existing.id },
        data: { price, description: line.description }
      });
    } else if (line.quoteDestination === "OPTION") {
      const existing = await tx.quoteCostOption.findFirst({
        where: { quoteId, ...key }
      });
      if (!existing) return;
      await tx.quoteCostOption.update({
        where: { id: existing.id },
        data: { price, description: line.description }
      });
    }
  }

  private async _deleteExistingRow(
    tx: Prisma.TransactionClient,
    quoteId: string,
    line: PushableLine,
    quote: {
      costLines: Array<{ id: string; sourceEstimateLineType: string | null; sourceEstimateLineId: string | null }>;
      provisionalLines: Array<{ id: string; sourceEstimateLineType: string | null; sourceEstimateLineId: string | null }>;
      costOptions: Array<{ id: string; sourceEstimateLineType: string | null; sourceEstimateLineId: string | null }>;
    }
  ) {
    const type = line.type;
    const id = line.id;

    const costLine = quote.costLines.find(
      (l) => l.sourceEstimateLineType === type && l.sourceEstimateLineId === id
    );
    if (costLine) {
      await tx.quoteCostLine.delete({ where: { id: costLine.id } });
      return;
    }
    const provLine = quote.provisionalLines.find(
      (l) => l.sourceEstimateLineType === type && l.sourceEstimateLineId === id
    );
    if (provLine) {
      await tx.quoteProvisionalLine.delete({ where: { id: provLine.id } });
      return;
    }
    const option = quote.costOptions.find(
      (l) => l.sourceEstimateLineType === type && l.sourceEstimateLineId === id
    );
    if (option) {
      await tx.quoteCostOption.delete({ where: { id: option.id } });
    }
  }
}

// ── Utility ────────────────────────────────────────────────────────────────

function toNum(v: Prisma.Decimal | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number((v as { toString(): string }).toString());
  return Number.isFinite(n) ? n : 0;
}

function toDecimal(v: number): Prisma.Decimal {
  return new Prisma.Decimal(v.toFixed(2));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
