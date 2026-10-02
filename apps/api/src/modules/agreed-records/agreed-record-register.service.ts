import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { AgreedRecordStatus, ClaimStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ContractsService } from "../contracts/contracts.service";
import { EmailService } from "../email/email.service";

/**
 * SoR S9a — per-JOB register of Variation Contracts (VC) and Agreed Records
 * (AR), plus the one-way feed of APPROVED items into the EXISTING
 * ProgressClaim via ClaimLineItem.
 *
 * WHY THIS EXISTS
 *   S6 gave VCs SoR-priced lines; S8 gave ARs an office review lane that ends
 *   in APPROVED + totalPricedAmount. Neither had a per-job view, and the AR
 *   side had no way to reach a claim at all: ClaimLineItem could point at a
 *   Variation but not at an AgreedRecord. This slice adds the missing FK
 *   (nullable, additive) and the read/write surface over it.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   * It does not re-price anything. VC lines and AR pricing lines are both
 *     frozen at their snapshot rate; this service only reads the totals those
 *     lanes already computed.
 *   * It does not introduce a parallel claim model. Claims are created by the
 *     existing ContractsService.createClaim; this service appends line items
 *     to whatever claim exists for the contract + month.
 *   * It builds no UI. The register page and its route are S9b.
 *
 * JOB -> CONTRACT
 *   A Job has no contract FK. The spine is Job.survivingProjectId ->
 *   Project -> Project.contract (Contract.projectId is unique), the link
 *   backfilled by 20260707200000_jpm_phasea_links from a shared
 *   source_tender_id. A job with no surviving project, or a project with no
 *   contract, therefore has NO variations — the register still returns its
 *   AR half rather than 404ing, and says so via `contractId: null`.
 *
 * Permissions (enforced at the controller, both pre-existing — no new
 * permission is introduced): `finance.view` to read the register,
 * `finance.manage` to raise a claim. These are the same codes the existing
 * progress-claim surface in ContractsController uses.
 */

/** SOR_CLAIM_ONCE_V1: an item appearing on ANY claim line of this contract, in
 * ANY month, at ANY claim status, is already claimed and must not be billed again.
 * DRAFT counts; partial claiming is out of scope. */
export const SOR_CLAIM_ONCE_V1 = "sor-claim-once-s1";

@Injectable()
export class AgreedRecordRegisterService {
  private readonly logger = new Logger(AgreedRecordRegisterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contracts: ContractsService,
    private readonly email: EmailService,
  ) {}

  // ── Reads ────────────────────────────────────────────────────────────────

  /**
   * Combined per-job register: every VC on the job's contract and every AR on
   * the job, each carrying its SoR version and status. Sorted createdAt desc
   * within each list.
   *
   * SOR_CLAIM_ONCE_V1: each row gains a `claimedOn` field pointing to the
   * EARLIEST claim carrying that item (any month, any status). `isEligible`
   * is false whenever `claimedOn` is non-null.
   */
  async getRegisterForJob(jobId: string): Promise<JobRegister> {
    const contractId = await this.resolveContractId(jobId);

    // Load AR ids for this job so we can query their claim lines when there
    // is no contract (AR-only path).
    const [variations, agreedRecords, claimLines] = await Promise.all([
      contractId
        ? this.prisma.variation.findMany({
            where: { contractId },
            orderBy: { createdAt: "desc" },
            include: {
              // The FIRST SoR line stamps the version for the whole VC (S6).
              sorLines: { orderBy: { createdAt: "asc" }, take: 1 },
            },
          })
        : Promise.resolve([]),
      this.prisma.agreedRecord.findMany({
        where: { jobId },
        orderBy: { createdAt: "desc" },
      }),
      // SOR_CLAIM_ONCE_V1: load every claim line on this contract/AR set that
      // references a variation or agreed record. We need claim.id, claimMonth,
      // and status to populate claimedOn.
      contractId
        ? this.prisma.claimLineItem.findMany({
            where: {
              claim: { contractId },
              OR: [{ variationId: { not: null } }, { agreedRecordId: { not: null } }],
            },
            select: {
              variationId: true,
              agreedRecordId: true,
              claimId: true,
              claim: { select: { claimMonth: true, status: true } },
            },
          })
        : // No contract: query by agreedRecordId IN job's ARs.
          // We do a two-step: first get the AR ids, then the lines.
          // But since we already have agreedRecords above, use them after resolution.
          Promise.resolve(null),
    ]);

    // For the no-contract path, load AR-sourced claim lines separately.
    let resolvedClaimLines: ClaimLineRef[];
    if (claimLines === null) {
      // No contract — query AR lines by AR ids from this job.
      const arIds = agreedRecords.map((ar) => ar.id);
      if (arIds.length > 0) {
        resolvedClaimLines = await this.prisma.claimLineItem.findMany({
          where: {
            agreedRecordId: { in: arIds },
          },
          select: {
            variationId: true,
            agreedRecordId: true,
            claimId: true,
            claim: { select: { claimMonth: true, status: true } },
          },
        });
      } else {
        resolvedClaimLines = [];
      }
    } else {
      resolvedClaimLines = claimLines;
    }

    // Build lookup maps: itemId -> earliest claim line
    const variationClaimMap = buildClaimMap(resolvedClaimLines, "variationId");
    const arClaimMap = buildClaimMap(resolvedClaimLines, "agreedRecordId");

    return {
      jobId,
      contractId,
      variations: variations.map((v) => this.toVariationRow(v, variationClaimMap.get(v.id) ?? null)),
      agreedRecords: agreedRecords.map((ar) => this.toAgreedRecordRow(ar, arClaimMap.get(ar.id) ?? null)),
    };
  }

  /**
   * The APPROVED-only subset of the register — exactly the rows that are
   * legal to put on a claim, and the payload S9b's UI builds its raise-claim
   * request from.
   *
   * VC: approvedAmount must be set (an approved VC without a dollar figure
   * cannot be claimed). AR: status APPROVED **and both signatures present** —
   * the same two-signature gate S7 enforces at submit time.
   *
   * SOR_CLAIM_ONCE_V1: rows with claimedOn !== null are excluded.
   */
  async getEligibleForClaim(jobId: string): Promise<JobRegister> {
    const register = await this.getRegisterForJob(jobId);
    return {
      ...register,
      variations: register.variations.filter((v) => v.isEligible),
      agreedRecords: register.agreedRecords.filter((ar) => ar.isEligible),
    };
  }

  // ── Write ────────────────────────────────────────────────────────────────

  /**
   * Raise (or append to) the progress claim for this job's contract + month
   * from the selected approved items.
   *
   * Ordering matters and is asserted by the spec: the claim and its line
   * items are written FIRST, and the Director trigger fires only after that
   * write has succeeded. A notification that outran its claim would tell the
   * Director to review something that does not exist yet.
   *
   * Ids that do not pass the approval filter are silently skipped rather than
   * failing the whole request, and are reported back in `skipped` so the
   * caller can show what was left off. If NOTHING survives the filter the
   * call is rejected — writing an empty claim would look like success.
   *
   * SOR_CLAIM_ONCE_V1: items on a line of ANOTHER claim of this contract
   * (any month, any status) are added to `skipped` and never written.
   */
  async raiseClaim(jobId: string, actorId: string, dto: RaiseClaimInput): Promise<RaiseClaimResult> {
    const contractId = await this.resolveContractId(jobId);
    if (!contractId) {
      throw new BadRequestException(
        "This job has no linked contract, so no progress claim can be raised against it.",
      );
    }

    const requestedVariationIds = dedupe(dto.variationIds);
    const requestedAgreedRecordIds = dedupe(dto.agreedRecordIds);
    if (requestedVariationIds.length === 0 && requestedAgreedRecordIds.length === 0) {
      throw new BadRequestException("Select at least one approved variation or agreed record.");
    }

    // APPROVED-only filters, applied in the query so an unapproved id simply
    // does not come back.
    const [variations, agreedRecords] = await Promise.all([
      requestedVariationIds.length
        ? this.prisma.variation.findMany({
            where: {
              id: { in: requestedVariationIds },
              contractId,
              approvedAmount: { not: null },
            },
          })
        : Promise.resolve([]),
      requestedAgreedRecordIds.length
        ? this.prisma.agreedRecord.findMany({
            where: {
              id: { in: requestedAgreedRecordIds },
              jobId,
              status: AgreedRecordStatus.APPROVED,
              workerSignaturePath: { not: null },
              clientRepSignaturePath: { not: null },
            },
          })
        : Promise.resolve([]),
    ]);

    // SOR_CLAIM_ONCE_V1: load every claim line on this contract that references
    // a variation or agreed record (any month, any status — DRAFT counts).
    const existingClaimLines = await this.prisma.claimLineItem.findMany({
      where: {
        claim: { contractId },
        OR: [{ variationId: { not: null } }, { agreedRecordId: { not: null } }],
      },
      select: { variationId: true, agreedRecordId: true, claimId: true },
    });
    const alreadyClaimedVariationIds = new Set(
      existingClaimLines.map((l) => l.variationId).filter((id): id is string => !!id),
    );
    const alreadyClaimedArIds = new Set(
      existingClaimLines.map((l) => l.agreedRecordId).filter((id): id is string => !!id),
    );

    const includedVariationIds = new Set(variations.map((v) => v.id));
    const includedAgreedRecordIds = new Set(agreedRecords.map((ar) => ar.id));
    const skipped: string[] = [
      ...requestedVariationIds.filter((id) => !includedVariationIds.has(id)),
      ...requestedAgreedRecordIds.filter((id) => !includedAgreedRecordIds.has(id)),
    ];

    // SOR_CLAIM_ONCE_V1: drop any requested id that is already on a claim line
    // for this contract. Add to skipped.
    const approvedVariations = variations.filter((v) => {
      if (alreadyClaimedVariationIds.has(v.id)) {
        skipped.push(v.id);
        return false;
      }
      return true;
    });
    const approvedAgreedRecords = agreedRecords.filter((ar) => {
      if (alreadyClaimedArIds.has(ar.id)) {
        skipped.push(ar.id);
        return false;
      }
      return true;
    });

    if (approvedVariations.length === 0 && approvedAgreedRecords.length === 0) {
      throw new BadRequestException(
        "None of the selected items are claimable — a variation needs an approved amount, an agreed record must be APPROVED with both signatures, and neither may already be on a previous claim.",
      );
    }

    // 1. Ensure a claim exists for this contract + month.
    const claimMonth = startOfMonth(new Date(dto.claimMonth));
    if (Number.isNaN(claimMonth.getTime())) {
      throw new BadRequestException("claimMonth is not a valid date.");
    }
    const existing = await this.prisma.progressClaim.findFirst({
      where: { contractId, claimMonth },
      include: { lineItems: true },
    });
    let claimId: string;
    let alreadyOnClaim: { variationIds: Set<string>; agreedRecordIds: Set<string> };
    let createdClaim: boolean;

    if (existing) {
      if (existing.status !== ClaimStatus.DRAFT) {
        throw new BadRequestException(
          "The claim for this month is no longer a draft, so items cannot be added to it.",
        );
      }
      claimId = existing.id;
      createdClaim = false;
      alreadyOnClaim = collectSources(existing.lineItems);
    } else {
      // ContractsService.createClaim seeds the claim from the tender scope
      // AND from every approved variation not already claimed, so the VC we
      // were asked to add may arrive on the claim already — collectSources
      // below is what stops us writing it twice.
      const created = await this.contracts.createClaim(contractId, actorId, {
        claimMonth: claimMonth.toISOString(),
      });
      claimId = created.id;
      createdClaim = true;
      alreadyOnClaim = collectSources(created.lineItems ?? []);
    }

    // 2. Append one line per included item that is not already on the claim.
    const maxSort = await this.prisma.claimLineItem.findFirst({
      where: { claimId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    let sortOrder = (maxSort?.sortOrder ?? -1) + 1;

    const creates: Prisma.ClaimLineItemCreateManyInput[] = [];
    for (const v of approvedVariations) {
      if (alreadyOnClaim.variationIds.has(v.id)) continue;
      const amount = v.approvedAmount ?? new Prisma.Decimal(0);
      creates.push({
        claimId,
        discipline: "Variation",
        description: `VAR ${v.variationNumber} — ${v.description}`.slice(0, 500),
        contractValue: amount,
        previouslyClaimed: new Prisma.Decimal(0),
        thisClaimPct: new Prisma.Decimal(100),
        thisClaimAmount: amount,
        variationId: v.id,
        sortOrder: sortOrder++,
      });
    }
    for (const ar of approvedAgreedRecords) {
      if (alreadyOnClaim.agreedRecordIds.has(ar.id)) continue;
      const amount = ar.totalPricedAmount ?? new Prisma.Decimal(0);
      creates.push({
        claimId,
        discipline: "Agreed Record",
        description: `AR ${ar.recordNumber} — ${ar.description}`.slice(0, 500),
        contractValue: amount,
        previouslyClaimed: new Prisma.Decimal(0),
        thisClaimPct: new Prisma.Decimal(100),
        thisClaimAmount: amount,
        agreedRecordId: ar.id,
        sortOrder: sortOrder++,
      });
    }

    if (creates.length > 0) {
      await this.prisma.claimLineItem.createMany({ data: creates });
    }

    // 3. Recompute the claim total from ALL its lines (ours and the ones
    //    createClaim seeded), mirroring ContractsService.addClaimItem.
    const allItems = await this.prisma.claimLineItem.findMany({ where: { claimId } });
    const total = allItems.reduce((sum, li) => sum + Number(li.thisClaimAmount), 0);
    await this.prisma.progressClaim.update({
      where: { id: claimId },
      data: { totalClaimed: new Prisma.Decimal(total.toFixed(2)) },
    });

    // 4. ONLY NOW tell the Director. Fire-and-forget: a mail failure must not
    //    roll back a written claim.
    this.fireClaimReadyNotification({
      claimId,
      linesAdded: creates.length,
      total,
    });

    return {
      claimId,
      createdClaim,
      contractId,
      linesAdded: creates.length,
      variationLinesAdded: creates.filter((c) => !!c.variationId).length,
      agreedRecordLinesAdded: creates.filter((c) => !!c.agreedRecordId).length,
      totalClaimed: total.toFixed(2),
      skipped,
    };
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /**
   * Job -> surviving Project -> Contract. Returns null (not a throw) when the
   * job is not linked to a contract; the register is still useful with only
   * its AR half. Throws only when the job itself does not exist.
   */
  private async resolveContractId(jobId: string): Promise<string | null> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        survivingProject: { select: { contract: { select: { id: true } } } },
      },
    });
    if (!job) throw new NotFoundException("Job not found.");
    return job.survivingProject?.contract?.id ?? null;
  }

  private toVariationRow(v: VariationWithFirstSorLine, claimedOn: ClaimedOn | null): VariationRow {
    return {
      kind: "VARIATION",
      id: v.id,
      number: v.variationNumber,
      description: v.description,
      status: v.status,
      sorVersion: v.sorLines[0]?.sorVersion ?? null,
      amount: v.approvedAmount?.toFixed(2) ?? v.pricedAmount?.toFixed(2) ?? null,
      isEligible: v.approvedAmount !== null && claimedOn === null,
      claimedOn,
      createdAt: v.createdAt,
    };
  }

  private toAgreedRecordRow(ar: AgreedRecordRowSource, claimedOn: ClaimedOn | null): AgreedRecordRow {
    const workerSigned = !!ar.workerSignaturePath;
    const clientRepSigned = !!ar.clientRepSignaturePath;
    return {
      kind: "AGREED_RECORD",
      id: ar.id,
      number: ar.recordNumber,
      description: ar.description,
      status: ar.status,
      sorVersion: ar.sorVersion ?? null,
      amount: ar.totalPricedAmount?.toFixed(2) ?? null,
      workerSigned,
      clientRepSigned,
      isEligible: ar.status === AgreedRecordStatus.APPROVED && workerSigned && clientRepSigned && claimedOn === null,
      claimedOn,
      createdAt: ar.createdAt,
    };
  }

  /**
   * Fire the Director claim-ready notification through the existing
   * NotificationTriggerConfig seam. Never throws — email is a side effect and
   * the claim is already committed by the time we get here.
   *
   * The `progress_claim.ready_for_director` row is seeded by the S9a
   * migration; recipients are the Admin role (there is no Director role) and
   * are re-configurable from Admin Settings without a deploy.
   */
  private fireClaimReadyNotification(opts: { claimId: string; linesAdded: number; total: number }) {
    const body =
      `A progress claim is ready for Director review. ` +
      `${opts.linesAdded} approved item(s) were added; the claim now totals $${opts.total.toFixed(2)}.`;
    this.email
      .sendNotificationEmail({
        trigger: CLAIM_READY_TRIGGER,
        subject: "Progress claim ready — Director review",
        html: `<p>${body}</p>`,
        text: body,
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`notification ${CLAIM_READY_TRIGGER} failed: ${msg}`);
      });
  }
}

export const CLAIM_READY_TRIGGER = "progress_claim.ready_for_director";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RaiseClaimInput {
  claimMonth: string;
  variationIds: string[];
  agreedRecordIds: string[];
}

export interface RaiseClaimResult {
  claimId: string;
  createdClaim: boolean;
  contractId: string;
  linesAdded: number;
  variationLinesAdded: number;
  agreedRecordLinesAdded: number;
  totalClaimed: string;
  skipped: string[];
}

/** Pointer to the earliest claim that carries this item. */
export interface ClaimedOn {
  claimId: string;
  claimMonth: string;
  claimStatus: string;
}

export interface VariationRow {
  kind: "VARIATION";
  id: string;
  number: string;
  description: string;
  status: string;
  sorVersion: string | null;
  amount: string | null;
  isEligible: boolean;
  claimedOn: ClaimedOn | null;
  createdAt: Date;
}

export interface AgreedRecordRow {
  kind: "AGREED_RECORD";
  id: string;
  number: string;
  description: string;
  status: string;
  sorVersion: string | null;
  amount: string | null;
  workerSigned: boolean;
  clientRepSigned: boolean;
  isEligible: boolean;
  claimedOn: ClaimedOn | null;
  createdAt: Date;
}

export interface JobRegister {
  jobId: string;
  contractId: string | null;
  variations: VariationRow[];
  agreedRecords: AgreedRecordRow[];
}

type VariationWithFirstSorLine = {
  id: string;
  variationNumber: string;
  description: string;
  status: string;
  approvedAmount: Prisma.Decimal | null;
  pricedAmount: Prisma.Decimal | null;
  createdAt: Date;
  sorLines: { sorVersion: string }[];
};

type AgreedRecordRowSource = {
  id: string;
  recordNumber: string;
  description: string;
  status: AgreedRecordStatus;
  sorVersion: string | null;
  totalPricedAmount: Prisma.Decimal | null;
  workerSignaturePath: string | null;
  clientRepSignaturePath: string | null;
  createdAt: Date;
};

/** A raw row from the claimLineItem query used to build claimedOn maps. */
type ClaimLineRef = {
  variationId: string | null;
  agreedRecordId: string | null;
  claimId: string;
  claim: { claimMonth: Date; status: string };
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** UTC start-of-month, matching ContractsService's private helper exactly. */
function startOfMonth(d: Date): Date {
  if (Number.isNaN(d.getTime())) return d;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function dedupe(ids: string[] | undefined): string[] {
  return Array.from(new Set(ids ?? []));
}

/** Which VC / AR sources a claim's existing line items already carry. */
function collectSources(lineItems: { variationId?: string | null; agreedRecordId?: string | null }[]) {
  return {
    variationIds: new Set(
      lineItems.map((li) => li.variationId).filter((id): id is string => !!id),
    ),
    agreedRecordIds: new Set(
      lineItems.map((li) => li.agreedRecordId).filter((id): id is string => !!id),
    ),
  };
}

/**
 * SOR_CLAIM_ONCE_V1: Build a map from itemId -> earliest ClaimedOn.
 * "Earliest" = sort by claimMonth asc, break ties by claimId asc.
 */
function buildClaimMap(lines: ClaimLineRef[], field: "variationId" | "agreedRecordId"): Map<string, ClaimedOn> {
  const map = new Map<string, ClaimedOn>();
  // Sort once: claimMonth asc, then claimId asc for tie-break.
  const sorted = [...lines].sort((a, b) => {
    const diff = a.claim.claimMonth.getTime() - b.claim.claimMonth.getTime();
    if (diff !== 0) return diff;
    return a.claimId.localeCompare(b.claimId);
  });
  for (const line of sorted) {
    const itemId = line[field];
    if (!itemId) continue;
    if (!map.has(itemId)) {
      map.set(itemId, {
        claimId: line.claimId,
        claimMonth: line.claim.claimMonth.toISOString(),
        claimStatus: line.claim.status,
      });
    }
  }
  return map;
}
