import { Injectable } from "@nestjs/common";
import {
  AccountLifecycleStatus,
  OpportunityStage,
  Prisma,
  TenderOutcomeResult
} from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

// ── Constants ────────────────────────────────────────────────────────────────

const OPEN_STAGES: OpportunityStage[] = ["open", "new", "qualified", "quoting"];

const DEFAULT_STALLED_DAYS = 14;

export type WinRateGroupBy = "client" | "sector" | "source" | "estimator";

// ── Types ────────────────────────────────────────────────────────────────────

export type PipelineByStageRow = {
  stage: OpportunityStage;
  count: number;
  grossValue: number;
  weightedValue: number;
};

export type WinRateRow = {
  key: string;
  label: string;
  won: number;
  lost: number;
  noBid: number;
  total: number;
  winRate: number;
  wonValue: number;
};

export type StalledOpportunityRow = {
  id: string;
  title: string;
  stage: OpportunityStage;
  clientId: string;
  clientName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  estimatedValue: number;
  weightedValue: number;
  nextActionAt: string | null;
  updatedAt: string;
  daysSinceUpdate: number;
};

export type RelationshipCoverageSummary = {
  totalAccounts: number;
  activeAccounts: number;
  prospectAccounts: number;
  pastAccounts: number;
  accountsWithPrimaryContact: number;
  accountsWithoutPrimaryContact: number;
  primaryContactCoverageRate: number;
};

export type PipelineDashboardResponse = {
  byStage: {
    buckets: PipelineByStageRow[];
    totals: { count: number; grossValue: number; weightedValue: number };
  };
  winRates: {
    byClient: WinRateRow[];
    bySector: WinRateRow[];
    bySource: WinRateRow[];
    byEstimator: WinRateRow[];
  };
  stalled: {
    thresholdDays: number;
    items: StalledOpportunityRow[];
    count: number;
  };
  relationshipCoverage: RelationshipCoverageSummary;
};

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * CRM-6: PipelineDashboardService — read/aggregation ONLY over the existing
 * win/loss capture (TenderOutcome) and Opportunity/Account roll-ups. This
 * slice never writes into the transactional owners.
 */
@Injectable()
export class PipelineDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(query?: {
    stalledDays?: number;
    ownerId?: string;
  }): Promise<PipelineDashboardResponse> {
    const stalledDays = clampDays(query?.stalledDays, DEFAULT_STALLED_DAYS);
    const ownerId = query?.ownerId;

    const [byStage, byClient, bySector, bySource, byEstimator, stalled, coverage] =
      await Promise.all([
        this.getPipelineByStage({ ownerId }),
        this.getWinRates({ groupBy: "client" }),
        this.getWinRates({ groupBy: "sector" }),
        this.getWinRates({ groupBy: "source" }),
        this.getWinRates({ groupBy: "estimator" }),
        this.getStalledOpportunities({ thresholdDays: stalledDays, ownerId }),
        this.getRelationshipCoverage()
      ]);

    return {
      byStage,
      winRates: { byClient, bySector, bySource, byEstimator },
      stalled: { thresholdDays: stalledDays, items: stalled, count: stalled.length },
      relationshipCoverage: coverage
    };
  }

  // ── Pipeline by stage ──────────────────────────────────────────────────────

  async getPipelineByStage(query: { ownerId?: string }) {
    const where: Prisma.OpportunityWhereInput = { stage: { in: OPEN_STAGES } };
    if (query.ownerId) where.ownerId = query.ownerId;

    const rows = await this.prisma.opportunity.findMany({
      where,
      select: { stage: true, probability: true, estimatedValue: true }
    });

    const bucketMap = new Map<OpportunityStage, PipelineByStageRow>();
    for (const stage of OPEN_STAGES) {
      bucketMap.set(stage, { stage, count: 0, grossValue: 0, weightedValue: 0 });
    }

    let totalGross = 0;
    let totalWeighted = 0;
    for (const row of rows) {
      const bucket = bucketMap.get(row.stage);
      if (!bucket) continue;
      const value = row.estimatedValue ? Number(row.estimatedValue) : 0;
      const weighted = (value * row.probability) / 100;
      bucket.count += 1;
      bucket.grossValue += value;
      bucket.weightedValue += weighted;
      totalGross += value;
      totalWeighted += weighted;
    }

    return {
      buckets: Array.from(bucketMap.values()),
      totals: { count: rows.length, grossValue: totalGross, weightedValue: totalWeighted }
    };
  }

  // ── Win rates ──────────────────────────────────────────────────────────────

  /**
   * Win rate cuts sourced from TenderOutcome (WL-1a) — the canonical win/loss
   * capture. Only the latest outcome per tender is counted so a corrected
   * outcome (superseded chain) does not double-count.
   *
   * Sector = Client.industry (nullable). Estimator = Tender.estimator.
   */
  async getWinRates(query: { groupBy: WinRateGroupBy }): Promise<WinRateRow[]> {
    const outcomes = await this.prisma.tenderOutcome.findMany({
      where: { supersededBy: null, resultType: { not: null } },
      select: {
        resultType: true,
        tenderValue: true,
        ourPrice: true,
        client: { select: { id: true, name: true, industry: true } },
        tender: {
          select: {
            id: true,
            estimator: { select: { id: true, firstName: true, lastName: true } }
          }
        }
      }
    });

    const opportunitySources =
      query.groupBy === "source"
        ? await this.prisma.opportunity.findMany({
            where: { convertedTenderId: { not: null } },
            select: { convertedTenderId: true, source: true }
          })
        : [];
    const sourceByTenderId = new Map<string, string>();
    for (const row of opportunitySources) {
      if (row.convertedTenderId) sourceByTenderId.set(row.convertedTenderId, row.source);
    }

    const groups = new Map<string, WinRateRow>();
    for (const o of outcomes) {
      const cut = pickWinRateCut(query.groupBy, o, sourceByTenderId);
      if (!cut) continue;
      const bucket =
        groups.get(cut.key) ??
        ({
          key: cut.key,
          label: cut.label,
          won: 0,
          lost: 0,
          noBid: 0,
          total: 0,
          winRate: 0,
          wonValue: 0
        } satisfies WinRateRow);

      if (o.resultType === "WON") {
        bucket.won += 1;
        bucket.wonValue += toNumber(o.tenderValue ?? o.ourPrice);
      } else if (o.resultType === "LOST") {
        bucket.lost += 1;
      } else if (o.resultType === "NO_BID") {
        bucket.noBid += 1;
      }
      // WON + LOST count toward the win rate denominator; NO_BID does not.
      bucket.total = bucket.won + bucket.lost;
      bucket.winRate = bucket.total > 0 ? bucket.won / bucket.total : 0;
      groups.set(cut.key, bucket);
    }

    return Array.from(groups.values()).sort((a, b) => {
      const diff = b.won + b.lost + b.noBid - (a.won + a.lost + a.noBid);
      if (diff !== 0) return diff;
      return a.label.localeCompare(b.label);
    });
  }

  // ── Stalled opportunities ──────────────────────────────────────────────────

  /**
   * A stalled opportunity is an OPEN opportunity that either has an overdue
   * `nextActionAt` OR no scheduled next action and has not been updated in
   * `thresholdDays`. Read-only flagging — no state change.
   */
  async getStalledOpportunities(query: {
    thresholdDays?: number;
    ownerId?: string;
  }): Promise<StalledOpportunityRow[]> {
    const thresholdDays = clampDays(query.thresholdDays, DEFAULT_STALLED_DAYS);
    const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);
    const now = new Date();

    const where: Prisma.OpportunityWhereInput = {
      stage: { in: OPEN_STAGES },
      OR: [
        { nextActionAt: { lt: now } },
        { AND: [{ nextActionAt: null }, { updatedAt: { lt: cutoff } }] }
      ]
    };
    if (query.ownerId) where.ownerId = query.ownerId;

    const rows = await this.prisma.opportunity.findMany({
      where,
      select: {
        id: true,
        title: true,
        stage: true,
        probability: true,
        estimatedValue: true,
        nextActionAt: true,
        updatedAt: true,
        clientId: true,
        client: { select: { id: true, name: true } },
        ownerId: true,
        owner: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: [{ nextActionAt: { sort: "asc", nulls: "last" } }, { updatedAt: "asc" }],
      take: 100
    });

    return rows.map((r) => {
      const value = r.estimatedValue ? Number(r.estimatedValue) : 0;
      const weighted = (value * r.probability) / 100;
      const daysSinceUpdate = Math.floor(
        (now.getTime() - new Date(r.updatedAt).getTime()) / (24 * 60 * 60 * 1000)
      );
      return {
        id: r.id,
        title: r.title,
        stage: r.stage,
        clientId: r.clientId,
        clientName: r.client?.name ?? null,
        ownerId: r.ownerId,
        ownerName: r.owner
          ? `${r.owner.firstName} ${r.owner.lastName}`.trim()
          : null,
        estimatedValue: value,
        weightedValue: weighted,
        nextActionAt: r.nextActionAt ? r.nextActionAt.toISOString() : null,
        updatedAt: new Date(r.updatedAt).toISOString(),
        daysSinceUpdate
      };
    });
  }

  // ── Relationship coverage ──────────────────────────────────────────────────

  /**
   * Coverage: for non-archived Accounts wrapping a Client, how many have at
   * least one active primary contact. Feeds the "who don't we own a primary
   * relationship at?" surface. Contacts live on Client (organisationType +
   * organisationId) — CRM-2 will add contact-on-Account directly.
   */
  async getRelationshipCoverage(): Promise<RelationshipCoverageSummary> {
    const accounts = await this.prisma.account.findMany({
      where: { archivedAt: null },
      select: { id: true, lifecycleStatus: true, clientId: true }
    });

    const clientIds = accounts
      .map((a) => a.clientId)
      .filter((id): id is string => Boolean(id));
    const primaryContacts = clientIds.length
      ? await this.prisma.contact.findMany({
          where: {
            organisationType: "CLIENT",
            organisationId: { in: clientIds },
            isPrimary: true,
            isActive: true
          },
          select: { organisationId: true }
        })
      : [];
    const clientsWithPrimary = new Set(primaryContacts.map((c) => c.organisationId));

    let active = 0;
    let prospect = 0;
    let past = 0;
    let withPrimary = 0;
    for (const a of accounts) {
      if (a.lifecycleStatus === ("ACTIVE" as AccountLifecycleStatus)) active += 1;
      else if (a.lifecycleStatus === ("PROSPECT" as AccountLifecycleStatus)) prospect += 1;
      else if (a.lifecycleStatus === ("PAST" as AccountLifecycleStatus)) past += 1;
      if (a.clientId && clientsWithPrimary.has(a.clientId)) withPrimary += 1;
    }

    const total = accounts.length;
    return {
      totalAccounts: total,
      activeAccounts: active,
      prospectAccounts: prospect,
      pastAccounts: past,
      accountsWithPrimaryContact: withPrimary,
      accountsWithoutPrimaryContact: total - withPrimary,
      primaryContactCoverageRate: total > 0 ? withPrimary / total : 0
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type OutcomeRow = {
  resultType: TenderOutcomeResult | null;
  tenderValue: Prisma.Decimal | null;
  ourPrice: Prisma.Decimal | null;
  client: { id: string; name: string; industry: string | null } | null;
  tender: {
    id: string;
    estimator: { id: string; firstName: string; lastName: string } | null;
  } | null;
};

function pickWinRateCut(
  groupBy: WinRateGroupBy,
  outcome: OutcomeRow,
  sourceByTenderId: Map<string, string>
): { key: string; label: string } | null {
  switch (groupBy) {
    case "client": {
      if (!outcome.client) return { key: "__unknown_client__", label: "Unknown client" };
      return { key: outcome.client.id, label: outcome.client.name };
    }
    case "sector": {
      const industry = outcome.client?.industry?.trim();
      if (!industry) return { key: "__unknown_sector__", label: "Unknown sector" };
      return { key: industry.toLowerCase(), label: industry };
    }
    case "estimator": {
      const est = outcome.tender?.estimator;
      if (!est) return { key: "__unknown_estimator__", label: "Unassigned" };
      return { key: est.id, label: `${est.firstName} ${est.lastName}`.trim() };
    }
    case "source": {
      const tid = outcome.tender?.id;
      const source = tid ? sourceByTenderId.get(tid) : undefined;
      if (!source) return { key: "__unknown_source__", label: "Unknown source" };
      return { key: source, label: source.replace(/_/g, " ") };
    }
  }
}

function toNumber(v: Prisma.Decimal | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampDays(value: number | undefined, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(365, n);
}
