import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, SorRateSourceType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SOR_FIGURE_COLUMN_NAMES } from "./sor-source-markup.service";

// ── Terminal tender statuses ──────────────────────────────────────────────────
// Mirrors TERMINAL_STATUSES in apps/api/src/modules/tendering/capacity.service.ts ~10.
// That constant is not exported, so we declare the same five locally with a citation.
const TERMINAL_STATUSES = [
  "AWARDED",
  "CONTRACT_ISSUED",
  "CONVERTED",
  "LOST",
  "WITHDRAWN",
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type SorFigures = {
  ordinary: number | null;
  oneAndHalf: number | null;
  double: number | null;
};

type FigureField = "ordinary" | "oneAndHalf" | "double";

type FigurePreview = {
  field: FigureField;
  current: number | null;
  proposed: number | null;
  lands: boolean;
  hubColumnName?: string;
  cellsKey?: string;
  reason?: string;
};

type FutureLock = {
  tenderId: string;
  tenderNumber: string | null;
  title: string | null;
  status: string;
  wouldLockToday: number | null;
  willLockAfter: number | null;
};

type FrozenRecord =
  | {
      mechanism: "TenderRateEntry";
      tenderRateSetId: string;
      tenderId: string;
      key: string;
      value: number | null;
      lockedAt: Date;
      lockedBy: string | null;
    }
  | {
      mechanism: "JobSorSnapshotRate";
      snapshotId: string;
      jobId: string | null;
      tenderId: string | null;
      ordinary: number | null;
      oneAndHalf: number | null;
      double: number | null;
    }
  | {
      mechanism: "SorClientRateEntry";
      entryId: string;
      cardId: string;
      position: string;
      ordinary: number | null;
      oneAndHalf: number | null;
      double: number | null;
    };

export type PushBackPreview = {
  line: {
    id: string;
    name: string;
    class: string | null;
    unit: string | null;
    category: string;
    periodId: string;
    periodStatus: string;
    sourceType: string;
    ordinary: number | null;
    oneAndHalf: number | null;
    double: number | null;
  };
  target:
    | {
        model: "RateRow";
        rateTableId: string;
        rateTableSlug: string;
        rateRowId: string;
      }
    | {
        model: "SubcontractorRate";
        subRateId: string;
        vendorName: string;
        discipline: string;
        unit: string;
      };
  figures: FigurePreview[];
  landingCount: number;
  nothingToPush: boolean;
  futureLocks: FutureLock[];
  futureLocksReason?: string;
  frozen: FrozenRecord[];
};

export type PushBackResult = {
  landed: string[];
  futureLockCount: number;
  frozenCount: number;
  targetModel: "RateRow" | "SubcontractorRate";
  targetId: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve a Decimal-or-null field to a plain number or null. */
function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build a figures[] array for an INTERNAL line.
 * `columns` is the list of RateColumn rows on the hub table.
 * `cells` is the raw JSON cells object keyed by RateColumn.id.
 */
function buildInternalFigures(
  line: { ordinary: unknown; oneAndHalf: unknown; double: unknown },
  columns: { id: string; name: string }[],
  cells: Record<string, unknown>,
): FigurePreview[] {
  const keyByNameLower: Record<string, string> = {};
  for (const col of columns) {
    keyByNameLower[col.name.toLowerCase()] = col.id;
  }

  const figures: FigurePreview[] = [];

  for (const field of ["ordinary", "oneAndHalf", "double"] as const) {
    const proposed = toNum(line[field]);
    const names = SOR_FIGURE_COLUMN_NAMES[field];
    // Find the first matching column name in the hub table.
    let matchedColId: string | undefined;
    let matchedColName: string | undefined;
    for (const name of names) {
      const id = keyByNameLower[name.toLowerCase()];
      if (id) {
        matchedColId = id;
        matchedColName = name;
        break;
      }
    }

    if (!matchedColId) {
      figures.push({
        field,
        current: null,
        proposed,
        lands: false,
        reason: "No matching column in hub table",
      });
      continue;
    }

    const current = toNum(cells[matchedColId] ?? null);
    figures.push({
      field,
      current,
      proposed,
      lands: proposed != null,
      hubColumnName: matchedColName,
      cellsKey: matchedColId,
    });
  }

  return figures;
}

/** Build figures[] for a vendor (SUBBIE/SUPPLIER) line. */
function buildVendorFigures(
  line: { ordinary: unknown; oneAndHalf: unknown; double: unknown },
  currentRate: number | null,
): FigurePreview[] {
  return [
    {
      field: "ordinary" as const,
      current: currentRate,
      proposed: toNum(line.ordinary),
      lands: toNum(line.ordinary) != null,
      hubColumnName: "rate",
    },
    {
      field: "oneAndHalf" as const,
      current: null,
      proposed: toNum(line.oneAndHalf),
      lands: false,
      reason: "no such column on SubcontractorRate",
    },
    {
      field: "double" as const,
      current: null,
      proposed: toNum(line.double),
      lands: false,
      reason: "no such column on SubcontractorRate",
    },
  ];
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SorPushBackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Refusal checks (shared by preview and push) ───────────────────────────

  private async loadAndValidateLine(sorRateId: string) {
    const rate = await this.prisma.sorRate.findUnique({
      where: { id: sorRateId },
      include: { period: true },
    });
    if (!rate) throw new NotFoundException(`SorRate ${sorRateId} not found`);
    if (rate.sourceType === SorRateSourceType.MANUAL) {
      throw new BadRequestException(
        "No hub anchor — promote the line first",
      );
    }
    if (
      rate.sourceType !== SorRateSourceType.INTERNAL &&
      rate.sourceType !== SorRateSourceType.SUBBIE &&
      rate.sourceType !== SorRateSourceType.SUPPLIER
    ) {
      throw new BadRequestException(
        `Cannot push back a line with sourceType=${rate.sourceType}`,
      );
    }
    if (rate.sourceType === SorRateSourceType.INTERNAL && !rate.sourceRateRowId) {
      throw new BadRequestException(
        "No hub anchor — promote the line first",
      );
    }
    if (
      (rate.sourceType === SorRateSourceType.SUBBIE ||
        rate.sourceType === SorRateSourceType.SUPPLIER) &&
      !rate.sourceSubRateId
    ) {
      throw new BadRequestException(
        "No hub anchor — promote the line first",
      );
    }
    if (rate.period.status !== "ACTIVE") {
      throw new ForbiddenException(
        `Period "${rate.period.label}" is ${rate.period.status} — push-back is only allowed on ACTIVE periods`,
      );
    }
    return rate;
  }

  // ── getPreview ────────────────────────────────────────────────────────────

  async getPreview(sorRateId: string, _actorId: string): Promise<PushBackPreview> {
    const rate = await this.loadAndValidateLine(sorRateId);

    const lineFigures = {
      ordinary: toNum(rate.ordinary),
      oneAndHalf: toNum(rate.oneAndHalf),
      double: toNum(rate.double),
    };

    if (rate.sourceType === SorRateSourceType.INTERNAL) {
      return this._previewInternal(rate, lineFigures);
    }
    return this._previewVendor(rate, lineFigures);
  }

  private async _previewInternal(
    rate: Awaited<ReturnType<typeof this.loadAndValidateLine>>,
    lineFigures: { ordinary: number | null; oneAndHalf: number | null; double: number | null },
  ): Promise<PushBackPreview> {
    const rateRowId = rate.sourceRateRowId!;

    const rateRow = await this.prisma.rateRow.findUnique({
      where: { id: rateRowId },
      include: {
        rateTable: {
          include: { columns: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    if (!rateRow) {
      throw new NotFoundException(
        `RateRow ${rateRowId} not found — the hub link is broken`,
      );
    }

    const table = rateRow.rateTable;
    const cells = (rateRow.cells as Record<string, unknown> | null) ?? {};
    const figures = buildInternalFigures(lineFigures, table.columns, cells);
    const landingFigures = figures.filter((f) => f.lands);
    const landingCount = landingFigures.length;

    const nothingToPush =
      landingCount > 0 &&
      landingFigures.every((f) => f.proposed === f.current);

    // futureLocks: tenders with no TenderRateSet and non-terminal status.
    // Skipped for reference tables (enumerateRateSet skips them).
    let futureLocks: FutureLock[] = [];
    let futureLocksReason: string | undefined;

    if (table.isReference) {
      futureLocksReason =
        "Target table is a reference table — no tender locks rates from reference tables";
    } else {
      futureLocks = await this._futureLocks(lineFigures);
    }

    // frozen: records that already hold this rate and are untouched.
    const frozen = await this._frozenInternal(
      table.id,
      rateRowId,
      rate.id,
    );

    return {
      line: {
        id: rate.id,
        name: rate.name,
        class: rate.class,
        unit: rate.unit,
        category: rate.category,
        periodId: rate.periodId,
        periodStatus: rate.period.status,
        sourceType: rate.sourceType,
        ordinary: lineFigures.ordinary,
        oneAndHalf: lineFigures.oneAndHalf,
        double: lineFigures.double,
      },
      target: {
        model: "RateRow",
        rateTableId: table.id,
        rateTableSlug: table.slug,
        rateRowId,
      },
      figures,
      landingCount,
      nothingToPush,
      futureLocks,
      ...(futureLocksReason ? { futureLocksReason } : {}),
      frozen,
    };
  }

  private async _previewVendor(
    rate: Awaited<ReturnType<typeof this.loadAndValidateLine>>,
    lineFigures: { ordinary: number | null; oneAndHalf: number | null; double: number | null },
  ): Promise<PushBackPreview> {
    const subRateId = rate.sourceSubRateId!;

    const subRate = await this.prisma.subcontractorRate.findUnique({
      where: { id: subRateId },
      include: { subcontractorSupplier: true },
    });
    if (!subRate) {
      throw new NotFoundException(
        `SubcontractorRate ${subRateId} not found — the hub link is broken`,
      );
    }

    const currentRate = toNum(subRate.rate);
    const figures = buildVendorFigures(lineFigures, currentRate);
    const landingFigures = figures.filter((f) => f.lands);
    const landingCount = landingFigures.length;
    const nothingToPush =
      landingCount > 0 &&
      landingFigures.every((f) => f.proposed === f.current);

    // Vendor rows are outside the keyspace a TenderRateSet lock enumerates.
    const futureLocksReason =
      "Vendor lines are not in the TenderRateSet keyspace — future locks will pick up rates from their own subbie quotes";

    // frozen: snapshot rates and client rate entries (no TenderRateEntry for vendor rows).
    const frozen = await this._frozenVendor(rate.id);

    return {
      line: {
        id: rate.id,
        name: rate.name,
        class: rate.class,
        unit: rate.unit,
        category: rate.category,
        periodId: rate.periodId,
        periodStatus: rate.period.status,
        sourceType: rate.sourceType,
        ordinary: lineFigures.ordinary,
        oneAndHalf: lineFigures.oneAndHalf,
        double: lineFigures.double,
      },
      target: {
        model: "SubcontractorRate",
        subRateId,
        vendorName: subRate.subcontractorSupplier.name,
        discipline: subRate.discipline,
        unit: subRate.unit,
      },
      figures,
      landingCount,
      nothingToPush,
      futureLocks: [],
      futureLocksReason,
      frozen,
    };
  }

  private async _futureLocks(lineFigures: {
    ordinary: number | null;
    oneAndHalf: number | null;
    double: number | null;
  }): Promise<FutureLock[]> {
    const tenders = await this.prisma.tender.findMany({
      where: {
        tenderRateSet: null,
        status: { notIn: [...TERMINAL_STATUSES] },
      },
      select: {
        id: true,
        tenderNumber: true,
        title: true,
        status: true,
      },
    });

    return tenders.map((t) => ({
      tenderId: t.id,
      tenderNumber: t.tenderNumber ?? null,
      title: t.title ?? null,
      status: t.status,
      wouldLockToday: lineFigures.ordinary,
      willLockAfter: lineFigures.ordinary,
    }));
  }

  private async _frozenInternal(
    rateTableId: string,
    rateRowId: string,
    sorRateId: string,
  ): Promise<FrozenRecord[]> {
    const keyPrefix = `${rateTableId}:${rateRowId}:`;

    // TenderRateEntry rows whose key starts with this prefix.
    const entries = await this.prisma.tenderRateEntry.findMany({
      where: {
        key: { startsWith: keyPrefix },
      },
      include: {
        rateSet: {
          select: { id: true, tenderId: true, lockedAt: true, lockedById: true },
        },
      },
    });

    const snapshotRates = await this.prisma.jobSorSnapshotRate.findMany({
      where: { sourceRateId: sorRateId },
      include: {
        snapshot: { select: { id: true, jobId: true, tenderId: true } },
      },
    });

    const clientEntries = await this.prisma.sorClientRateEntry.findMany({
      where: { sorRateId },
      select: {
        id: true,
        cardId: true,
        position: true,
        ordinary: true,
        oneAndHalf: true,
        double: true,
      },
    });

    const frozen: FrozenRecord[] = [];

    for (const e of entries) {
      frozen.push({
        mechanism: "TenderRateEntry",
        tenderRateSetId: e.tenderRateSetId,
        tenderId: e.rateSet.tenderId,
        key: e.key,
        value: toNum(e.overrideValue ?? e.originalValue),
        lockedAt: e.rateSet.lockedAt,
        lockedBy: e.rateSet.lockedById,
      });
    }

    for (const sr of snapshotRates) {
      frozen.push({
        mechanism: "JobSorSnapshotRate",
        snapshotId: sr.snapshotId,
        jobId: sr.snapshot.jobId,
        tenderId: sr.snapshot.tenderId,
        ordinary: toNum(sr.ordinary),
        oneAndHalf: toNum(sr.oneAndHalf),
        double: toNum(sr.double),
      });
    }

    for (const ce of clientEntries) {
      frozen.push({
        mechanism: "SorClientRateEntry",
        entryId: ce.id,
        cardId: ce.cardId,
        position: ce.position,
        ordinary: toNum(ce.ordinary),
        oneAndHalf: toNum(ce.oneAndHalf),
        double: toNum(ce.double),
      });
    }

    return frozen;
  }

  private async _frozenVendor(sorRateId: string): Promise<FrozenRecord[]> {
    const snapshotRates = await this.prisma.jobSorSnapshotRate.findMany({
      where: { sourceRateId: sorRateId },
      include: {
        snapshot: { select: { id: true, jobId: true, tenderId: true } },
      },
    });

    const clientEntries = await this.prisma.sorClientRateEntry.findMany({
      where: { sorRateId },
      select: {
        id: true,
        cardId: true,
        position: true,
        ordinary: true,
        oneAndHalf: true,
        double: true,
      },
    });

    const frozen: FrozenRecord[] = [];

    for (const sr of snapshotRates) {
      frozen.push({
        mechanism: "JobSorSnapshotRate",
        snapshotId: sr.snapshotId,
        jobId: sr.snapshot.jobId,
        tenderId: sr.snapshot.tenderId,
        ordinary: toNum(sr.ordinary),
        oneAndHalf: toNum(sr.oneAndHalf),
        double: toNum(sr.double),
      });
    }

    for (const ce of clientEntries) {
      frozen.push({
        mechanism: "SorClientRateEntry",
        entryId: ce.id,
        cardId: ce.cardId,
        position: ce.position,
        ordinary: toNum(ce.ordinary),
        oneAndHalf: toNum(ce.oneAndHalf),
        double: toNum(ce.double),
      });
    }

    return frozen;
  }

  // ── pushBack ──────────────────────────────────────────────────────────────

  async pushBack(
    sorRateId: string,
    actorId: string,
    expected: SorFigures,
  ): Promise<PushBackResult> {
    const rate = await this.loadAndValidateLine(sorRateId);

    // Check that expected matches the current live figures.
    const liveOrd = toNum(rate.ordinary);
    const liveHalf = toNum(rate.oneAndHalf);
    const liveDbl = toNum(rate.double);

    if (
      expected.ordinary !== liveOrd ||
      expected.oneAndHalf !== liveHalf ||
      expected.double !== liveDbl
    ) {
      throw new ConflictException(
        "Line changed since the preview was opened - reopen it",
      );
    }

    if (rate.sourceType === SorRateSourceType.INTERNAL) {
      return this._pushInternal(rate, actorId, expected);
    }
    return this._pushVendor(rate, actorId, expected);
  }

  private async _pushInternal(
    rate: Awaited<ReturnType<typeof this.loadAndValidateLine>>,
    actorId: string,
    figures: SorFigures,
  ): Promise<PushBackResult> {
    const rateRowId = rate.sourceRateRowId!;

    const rateRow = await this.prisma.rateRow.findUnique({
      where: { id: rateRowId },
      include: {
        rateTable: {
          include: { columns: { orderBy: { sortOrder: "asc" } } },
        },
      },
    });
    if (!rateRow) {
      throw new NotFoundException(`RateRow ${rateRowId} not found`);
    }

    const table = rateRow.rateTable;
    const cells = (rateRow.cells as Record<string, unknown> | null) ?? {};
    const figurePreviews = buildInternalFigures(figures, table.columns, cells);
    const landingFigures = figurePreviews.filter((f) => f.lands);

    if (landingFigures.length === 0) {
      throw new ConflictException(
        "Nothing to push - all landing figures already equal the hub",
      );
    }

    const nothingToPush = landingFigures.every(
      (f) => f.proposed === f.current,
    );
    if (nothingToPush) {
      throw new ConflictException(
        "Nothing to push - all landing figures already equal the hub",
      );
    }

    // Build the updated cells object, replacing only the landing column keys.
    const updatedCells: Record<string, unknown> = { ...cells };
    for (const fig of landingFigures) {
      if (fig.cellsKey && fig.proposed != null) {
        updatedCells[fig.cellsKey] = fig.proposed;
      }
    }

    // Compute frozen / future counts before the transaction (read-only).
    const frozenRecords = await this._frozenInternal(table.id, rateRowId, rate.id);
    const futureLockTenders = table.isReference
      ? []
      : await this._futureLocks(figures);

    const changeLogEntries: Prisma.SorChangeLogEntryCreateManyInput[] =
      landingFigures.map((fig) => ({
        periodId: rate.periodId,
        rateId: rate.id,
        field: `hub.${fig.field}`,
        oldValue: fig.current != null ? String(fig.current) : null,
        newValue: fig.proposed != null ? String(fig.proposed) : null,
        changedById: actorId,
      }));

    // CRITICAL: update the SAME rateRow.id — never create a new row.
    // The row id is the guarantee: TenderRateEntry keys are `${tableId}:${rowId}:${colId}`,
    // so changing the id would cause every locked tender to miss the snapshot key and
    // fall back to the live (just-pushed) value — defeating the frozen guarantee.
    await this.prisma.$transaction([
      this.prisma.rateRow.update({
        where: { id: rateRowId },
        data: {
          cells: updatedCells as Prisma.InputJsonValue,
          updatedById: actorId,
        },
      }),
      this.prisma.sorChangeLogEntry.createMany({ data: changeLogEntries }),
    ]);

    await this.audit.write({
      action: "sor.rate.push-back",
      entityType: "SorRate",
      entityId: rate.id,
      actorId,
      metadata: {
        targetModel: "RateRow",
        targetId: rateRowId,
        figures: {
          ordinary: figures.ordinary,
          oneAndHalf: figures.oneAndHalf,
          double: figures.double,
        },
        landed: landingFigures.map((f) => f.field),
        futureLockCount: futureLockTenders.length,
        frozenCount: frozenRecords.length,
      },
    });

    return {
      landed: landingFigures.map((f) => f.field),
      futureLockCount: futureLockTenders.length,
      frozenCount: frozenRecords.length,
      targetModel: "RateRow",
      targetId: rateRowId,
    };
  }

  private async _pushVendor(
    rate: Awaited<ReturnType<typeof this.loadAndValidateLine>>,
    actorId: string,
    figures: SorFigures,
  ): Promise<PushBackResult> {
    const oldSubRateId = rate.sourceSubRateId!;

    const oldSubRate = await this.prisma.subcontractorRate.findUnique({
      where: { id: oldSubRateId },
    });
    if (!oldSubRate) {
      throw new NotFoundException(
        `SubcontractorRate ${oldSubRateId} not found`,
      );
    }

    // nothingToPush check.
    const currentRate = toNum(oldSubRate.rate);
    if (figures.ordinary === currentRate) {
      throw new ConflictException(
        "Nothing to push - all landing figures already equal the hub",
      );
    }

    if (figures.ordinary == null) {
      throw new ConflictException(
        "Nothing to push - all landing figures already equal the hub",
      );
    }

    const frozenRecords = await this._frozenVendor(rate.id);

    // Vendor supersede: create a new SubcontractorRate, deactivate old, repoint all SorRates.
    // All inside one $transaction.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let newSubRateId!: string;

    await this.prisma.$transaction(async (tx) => {
      // Create new SubcontractorRate.
      const newSubRate = await tx.subcontractorRate.create({
        data: {
          subcontractorSupplierId: oldSubRate.subcontractorSupplierId,
          discipline: oldSubRate.discipline,
          unit: oldSubRate.unit,
          rate: figures.ordinary!,
          validFrom: oldSubRate.validFrom ?? null,
          notes: oldSubRate.notes ?? null,
          isActive: true,
          createdById: actorId,
        },
      });
      newSubRateId = newSubRate.id;

      // Deactivate the old SubcontractorRate.
      await tx.subcontractorRate.update({
        where: { id: oldSubRateId },
        data: { isActive: false, validTo: today },
      });

      // Repoint every SorRate whose sourceSubRateId is the old row (any period).
      await tx.sorRate.updateMany({
        where: { sourceSubRateId: oldSubRateId },
        data: { sourceSubRateId: newSubRate.id },
      });

      // Append one change-log entry.
      await tx.sorChangeLogEntry.create({
        data: {
          periodId: rate.periodId,
          rateId: rate.id,
          field: "hub.ordinary",
          oldValue: currentRate != null ? String(currentRate) : null,
          newValue: String(figures.ordinary),
          changedById: actorId,
        },
      });
    });

    await this.audit.write({
      action: "sor.rate.push-back",
      entityType: "SorRate",
      entityId: rate.id,
      actorId,
      metadata: {
        targetModel: "SubcontractorRate",
        targetId: newSubRateId,
        figures: {
          ordinary: figures.ordinary,
          oneAndHalf: figures.oneAndHalf,
          double: figures.double,
        },
        landed: ["ordinary"],
        futureLockCount: 0,
        frozenCount: frozenRecords.length,
      },
    });

    return {
      landed: ["ordinary"],
      futureLockCount: 0,
      frozenCount: frozenRecords.length,
      targetModel: "SubcontractorRate",
      targetId: newSubRateId,
    };
  }

  // ── getHubFigures ─────────────────────────────────────────────────────────

  /**
   * For every non-MANUAL line in the given period, return the hub target's
   * current figures keyed by sorRateId. Used by S6b's drift-line display.
   *
   * One query per target model (INTERNAL: one rateRow.findMany batched via
   * a Map; VENDOR: one subcontractorRate.findMany).
   */
  async getHubFigures(periodId: string): Promise<
    Record<
      string,
      {
        model: "RateRow" | "SubcontractorRate";
        figures: { ordinary?: number; oneAndHalf?: number; double?: number };
        missing: FigureField[];
      }
    >
  > {
    const lines = await this.prisma.sorRate.findMany({
      where: {
        periodId,
        sourceType: { not: SorRateSourceType.MANUAL },
      },
      select: {
        id: true,
        sourceType: true,
        sourceRateRowId: true,
        sourceSubRateId: true,
      },
    });

    const internalLines = lines.filter(
      (l) =>
        l.sourceType === SorRateSourceType.INTERNAL && l.sourceRateRowId,
    );
    const vendorLines = lines.filter(
      (l) =>
        (l.sourceType === SorRateSourceType.SUBBIE ||
          l.sourceType === SorRateSourceType.SUPPLIER) &&
        l.sourceSubRateId,
    );

    // One query for all referenced RateRows.
    const rateRowIds = [
      ...new Set(internalLines.map((l) => l.sourceRateRowId!)),
    ];
    const rateRows = await this.prisma.rateRow.findMany({
      where: { id: { in: rateRowIds } },
      include: {
        rateTable: { include: { columns: { orderBy: { sortOrder: "asc" } } } },
      },
    });
    const rateRowMap = new Map(rateRows.map((r) => [r.id, r]));

    // One query for all referenced SubcontractorRates.
    const subRateIds = [
      ...new Set(vendorLines.map((l) => l.sourceSubRateId!)),
    ];
    const subRates = await this.prisma.subcontractorRate.findMany({
      where: { id: { in: subRateIds } },
      select: { id: true, rate: true },
    });
    const subRateMap = new Map(subRates.map((r) => [r.id, r]));

    const result: Record<
      string,
      {
        model: "RateRow" | "SubcontractorRate";
        figures: { ordinary?: number; oneAndHalf?: number; double?: number };
        missing: FigureField[];
      }
    > = {};

    for (const line of internalLines) {
      const rr = rateRowMap.get(line.sourceRateRowId!);
      if (!rr) continue;
      const cells = (rr.cells as Record<string, unknown> | null) ?? {};
      const cols = rr.rateTable.columns;
      const figs = buildInternalFigures({ ordinary: null, oneAndHalf: null, double: null }, cols, cells);
      const figures: { ordinary?: number; oneAndHalf?: number; double?: number } = {};
      const missing: FigureField[] = [];
      for (const fig of figs) {
        if (!fig.lands || fig.current == null) {
          missing.push(fig.field);
        } else {
          figures[fig.field] = fig.current;
        }
      }
      result[line.id] = { model: "RateRow", figures, missing };
    }

    for (const line of vendorLines) {
      const sr = subRateMap.get(line.sourceSubRateId!);
      if (!sr) continue;
      const rate = toNum(sr.rate);
      result[line.id] = {
        model: "SubcontractorRate",
        figures: rate != null ? { ordinary: rate } : {},
        missing: rate != null
          ? ["oneAndHalf", "double"]
          : ["ordinary", "oneAndHalf", "double"],
      };
    }

    return result;
  }
}
