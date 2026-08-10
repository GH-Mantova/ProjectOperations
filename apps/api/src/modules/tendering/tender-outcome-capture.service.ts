import { Injectable } from "@nestjs/common";
import {
  Prisma,
  TenderOutcome,
  TenderOutcomeReason,
  TenderOutcomeResult
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

// Whitelist of fields the caller may set. Anything else in the payload is
// ignored (unknown keys silently dropped). resultType/reason are validated
// against the Prisma-generated enums so a garbage string can't slip through
// the append into the DB.
export interface RecordTenderOutcomeInput {
  resultType?: TenderOutcomeResult | null;
  reason?: TenderOutcomeReason | null;
  tenderValue?: string | number | null;
  ourPrice?: string | number | null;
  clientId?: string | null;
  scopeSummary?: string | null;
  competitorOrWinner?: string | null;
  notes?: string | null;
}

// Prisma transaction client type — matches the callback signature of
// `prisma.$transaction(async (tx) => …)` and the base PrismaService for
// non-transactional calls.
type TxClient = Prisma.TransactionClient | PrismaService;

const RESULT_VALUES = new Set(Object.values(TenderOutcomeResult) as string[]);
const REASON_VALUES = new Set(Object.values(TenderOutcomeReason) as string[]);

/**
 * WL-1a — Append-only writer of `TenderOutcome` rows.
 *
 * Capture is OPTIONAL at tender close (Marco 2026-08-10): the caller decides
 * whether to hand this service an outcome payload. Once a payload is handed
 * in, the guarantees are:
 *
 * - a brand-new row is created; prior outcomes are never updated or deleted;
 * - if a prior outcome exists for the tender, the new row's `supersedesId`
 *   points at the most recent one, forming an append-only chain;
 * - only whitelisted keys are written and enum values are validated.
 */
@Injectable()
export class TenderOutcomeCaptureService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalise a raw outcome payload: keep only whitelisted keys, coerce
   * blanks/undefineds to null, and validate enum values.
   */
  normalizeOutcome(input: RecordTenderOutcomeInput | null | undefined): RecordTenderOutcomeInput {
    if (!input) return {};

    const resultType =
      input.resultType && RESULT_VALUES.has(String(input.resultType))
        ? (input.resultType as TenderOutcomeResult)
        : null;
    const reason =
      input.reason && REASON_VALUES.has(String(input.reason))
        ? (input.reason as TenderOutcomeReason)
        : null;

    return {
      resultType,
      reason,
      tenderValue: input.tenderValue ?? null,
      ourPrice: input.ourPrice ?? null,
      clientId: input.clientId ?? null,
      scopeSummary: input.scopeSummary ?? null,
      competitorOrWinner: input.competitorOrWinner ?? null,
      notes: input.notes ?? null
    };
  }

  /**
   * Append a new outcome row for the tender. If one already exists, the new
   * row's `supersedesId` links to the most recent prior outcome — the prior
   * row is left completely untouched.
   */
  async recordOutcome(
    tx: TxClient,
    tenderId: string,
    outcome: RecordTenderOutcomeInput | null | undefined,
    recordedById?: string | null
  ): Promise<TenderOutcome> {
    const normalized = this.normalizeOutcome(outcome);

    // Point at the most recent existing outcome for this tender (by
    // recordedAt desc). Because supersedesId is @unique, the row we link
    // to must itself not already be superseded — the tender-scoped ordering
    // guarantees this since prior appends always link the newest row.
    const prior = await tx.tenderOutcome.findFirst({
      where: { tenderId },
      orderBy: { recordedAt: "desc" },
      select: { id: true }
    });

    // outcome_type is NOT NULL on the legacy column; derive a stable label
    // from the structured result when the caller doesn't send one, so we
    // never violate the constraint without needing an extra migration.
    const outcomeType = normalized.resultType ?? "RECORDED";

    return tx.tenderOutcome.create({
      data: {
        tenderId,
        outcomeType,
        notes: normalized.notes ?? null,
        resultType: normalized.resultType ?? null,
        reason: normalized.reason ?? null,
        tenderValue:
          normalized.tenderValue !== null && normalized.tenderValue !== undefined
            ? new Prisma.Decimal(normalized.tenderValue)
            : null,
        ourPrice:
          normalized.ourPrice !== null && normalized.ourPrice !== undefined
            ? new Prisma.Decimal(normalized.ourPrice)
            : null,
        clientId: normalized.clientId ?? null,
        scopeSummary: normalized.scopeSummary ?? null,
        competitorOrWinner: normalized.competitorOrWinner ?? null,
        recordedById: recordedById ?? null,
        supersedesId: prior?.id ?? null
      }
    });
  }
}
