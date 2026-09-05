import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AccountLifecycleStatus, AccountSource, AccountType, Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * CRM-S4: Per-client row returned by the link-preview endpoint.
 * All fields come from cached Client columns — no extra aggregation query.
 */
export type ClientLinkPreviewRow = {
  clientId: string;
  name: string;
  tenderCount: number;
  wonCount: number;
  lastTenderAt: Date | null;
  existingAccountId: string | null;
};

export type CreateAccountInput = {
  clientId?: string | null;
  lifecycleStatus?: AccountLifecycleStatus;
  accountType?: AccountType;
  source?: AccountSource;
  ownerId?: string | null;
  notes?: string | null;
};

export type UpdateAccountInput = Partial<CreateAccountInput>;

export type ArchiveAccountInput = {
  actorId: string;
};

export type ListAccountsQuery = {
  lifecycleStatus?: AccountLifecycleStatus;
  ownerId?: string;
  search?: string;
  includeArchived?: boolean;
  page?: number;
  limit?: number;
};

// NAV-2: summary DTO for the Accounts index page.
export type AccountSummary = {
  id: string;
  name: string;
  abn: string | null;
  type: string;
  lifecycle: "PROSPECT" | "ACTIVE" | "PAST";
  owner: { id: string; firstName: string; lastName: string } | null;
  winRate: number | null;
  openOpportunitiesCount: number;
  lastContactedAt: Date | null;
  goingCold: boolean;
  contactState: ContactState;
};

// Opportunity stages that count as "open" for the summary.
const OPEN_OPPORTUNITY_STAGES = ["new", "qualified", "quoting", "open"] as const;

/**
 * CRM_COLD_V3 — the ONE contact-state contract, shared by the accounts summary
 * (KPI tile) and the relationships going-cold list. Two contracts ago the tile
 * used 14 days and treated null as NOT cold while the list used 30 days and
 * treated null as cold, so the tile read 0 while the list below it showed 9
 * rows off the same data. One constant, one rule, both surfaces.
 *
 * Marco's decisions:
 *   - 2026-09-01: default threshold is 60 days, user-selectable at the
 *     Relationships going-cold panel (via ?thresholdDays=).
 *   - 2026-09-04: never-contacted is its OWN state, not the coldest one.
 *     "Cold" means was warm, went quiet. An account nobody has contacted yet
 *     is a relationship that has not STARTED — a different job for the
 *     estimator, so a different number. This retired the null-is-cold rule:
 *     with no contact ever logged that rule made all 175 accounts cold and the
 *     tile read "Going cold 175" out of 175, which is a number nobody reads.
 *
 * DO NOT introduce a second threshold or a second null-rule anywhere in the
 * CRM. If a caller wants a different threshold it must pass it in explicitly.
 */
export const CRM_COLD_V3 = {
  THRESHOLD_DAYS: 60 as number
} as const;

/**
 * The four states an account's contact history can be in. Exactly one applies,
 * and they are tested in the order deriveContactState checks them.
 */
export type ContactState = "PAST" | "NEVER_CONTACTED" | "COLD" | "IN_CONTACT";

/**
 * Derives the contact state for an account. CRM_COLD_V3 contract, in order:
 *
 *   lifecycle === "PAST"                        -> "PAST"
 *   lastContactedAt === null                    -> "NEVER_CONTACTED"
 *   older than CRM_COLD_V3.THRESHOLD_DAYS       -> "COLD"
 *   otherwise                                   -> "IN_CONTACT"
 *
 * The threshold boundary is STRICT: an account contacted exactly
 * THRESHOLD_DAYS ago is still "IN_CONTACT"; at THRESHOLD_DAYS plus one
 * millisecond it is "COLD".
 *
 * `nowMs` is an OPTIONAL injected clock, defaulting to the real wall clock.
 * Every existing caller is unaffected. It exists so the boundary can be
 * asserted against a FIXED instant: a spec that pins `lastContactedAt` to a
 * literal date while the function reads `Date.now()` is a time bomb that goes
 * green in CI and turns red, permanently, on a date nobody chose.
 */
export function deriveContactState(
  lifecycle: string,
  lastContactedAt: Date | null,
  nowMs: number = Date.now()
): ContactState {
  if (lifecycle === "PAST") return "PAST";
  if (!lastContactedAt) return "NEVER_CONTACTED";
  const diffMs = nowMs - lastContactedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > CRM_COLD_V3.THRESHOLD_DAYS ? "COLD" : "IN_CONTACT";
}

/**
 * Boolean convenience wrapper over deriveContactState, so callers that only
 * want the flag do not re-derive the rule.
 *
 * CHANGED 2026-09-04: this returns FALSE for a null `lastContactedAt` where it
 * returned TRUE before. That is Marco's ruling landing, not a regression — a
 * never-contacted account is now "NEVER_CONTACTED", a state of its own, and is
 * counted separately rather than reported as cold.
 */
export function deriveGoingCold(
  lifecycle: string,
  lastContactedAt: Date | null,
  nowMs: number = Date.now()
): boolean {
  return deriveContactState(lifecycle, lastContactedAt, nowMs) === "COLD";
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * CRM-1: AccountsService — Account spine management + Client-360 read-only
 * roll-ups. Aggregates an Account's contacts and read-only roll-ups of the
 * transactional owners (tenders/jobs) WITHOUT editing them.
 *
 * CRM-S6 extends this with contracts, opportunities, relationshipNotes and
 * comms threads anchored to the account — all read-only.
 *
 * Ownership rule (from the CRM plan):
 *   CRM owns: organisation/relationship layer, contacts, lead/opp state.
 *   Transactional modules own: Tender, Job, Contract. CRM surfaces them
 *   read-only; NEVER writes into them.
 */
@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD ────────────────────────────────────────────────────────────────────

  async createAccount(input: CreateAccountInput) {
    if (input.clientId) await this.requireClient(input.clientId);
    if (input.ownerId) await this.requireUser(input.ownerId);

    return this.prisma.account.create({
      data: {
        clientId: input.clientId ?? null,
        lifecycleStatus: input.lifecycleStatus ?? "PROSPECT",
        accountType: input.accountType ?? "CLIENT",
        source: input.source ?? "OTHER",
        ownerId: input.ownerId ?? null,
        notes: input.notes ?? null
      },
      include: this.accountInclude()
    });
  }

  /**
   * CRM-S3: Idempotently ensure a PROSPECT Account exists for the given Client.
   *
   * If an Account already wraps this Client (clientId is `@unique` on Account),
   * the existing row is returned unchanged — no second row is created, no field
   * is overwritten. Safe to call on every client-create path.
   *
   * Accepts an optional Prisma transaction client so the account creation can
   * be atomically committed alongside the parent Client row.
   *
   * @param clientId - The Client id to wrap.
   * @param tx - Optional interactive transaction client.
   * @returns The existing or newly-created Account row (id only).
   */
  async ensureAccountForClient(
    clientId: string,
    tx?: Prisma.TransactionClient | PrismaClient
  ): Promise<{ id: string }> {
    const db = tx ?? this.prisma;

    // Idempotence: return the existing account if one already wraps this client.
    const existing = await db.account.findUnique({
      where: { clientId },
      select: { id: true }
    });
    if (existing) return existing;

    const created = await db.account.create({
      data: {
        clientId,
        lifecycleStatus: "PROSPECT",
        accountType: "CLIENT",
        source: "OTHER"
      },
      select: { id: true }
    });
    return created;
  }

  async listAccounts(query: ListAccountsQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));

    const where: Prisma.AccountWhereInput = {};
    if (query.lifecycleStatus) where.lifecycleStatus = query.lifecycleStatus;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (!query.includeArchived) where.archivedAt = null;
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.client = {
        name: { contains: term, mode: "insensitive" }
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        include: this.accountInclude()
      }),
      this.prisma.account.count({ where })
    ]);

    return { items, total, page, limit };
  }

  async getAccount(id: string) {
    const row = await this.prisma.account.findUnique({
      where: { id },
      include: this.accountInclude()
    });
    if (!row) throw new NotFoundException(`Account ${id} not found.`);
    return row;
  }

  async updateAccount(id: string, input: UpdateAccountInput) {
    const existing = await this.prisma.account.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Account ${id} not found.`);
    if (input.clientId) await this.requireClient(input.clientId);
    if (input.ownerId) await this.requireUser(input.ownerId);

    const data: Prisma.AccountUpdateInput = {};
    if (input.lifecycleStatus !== undefined) data.lifecycleStatus = input.lifecycleStatus;
    if (input.accountType !== undefined) data.accountType = input.accountType;
    if (input.source !== undefined) data.source = input.source;
    if (input.notes !== undefined) data.notes = input.notes ?? null;
    if (input.clientId !== undefined) {
      data.client = input.clientId
        ? { connect: { id: input.clientId } }
        : { disconnect: true };
    }
    if (input.ownerId !== undefined) {
      data.owner = input.ownerId
        ? { connect: { id: input.ownerId } }
        : { disconnect: true };
    }

    return this.prisma.account.update({
      where: { id },
      data,
      include: this.accountInclude()
    });
  }

  async archiveAccount(id: string, input: ArchiveAccountInput) {
    const existing = await this.prisma.account.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Account ${id} not found.`);
    if (existing.archivedAt) {
      throw new BadRequestException(`Account ${id} is already archived.`);
    }
    if (!input.actorId) throw new BadRequestException("actorId is required.");
    await this.requireUser(input.actorId);

    return this.prisma.account.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        archivedBy: { connect: { id: input.actorId } }
      },
      include: this.accountInclude()
    });
  }

  async unarchiveAccount(id: string) {
    const existing = await this.prisma.account.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Account ${id} not found.`);
    if (!existing.archivedAt) {
      throw new BadRequestException(`Account ${id} is not archived.`);
    }

    return this.prisma.account.update({
      where: { id },
      data: {
        archivedAt: null,
        archivedById: null
      },
      include: this.accountInclude()
    });
  }

  // ── Client-360 view ─────────────────────────────────────────────────────────

  /**
   * Client-360: aggregates the Account with its linked Client, contacts,
   * and read-only roll-ups from the transactional modules.
   *
   * NEVER writes into Tender, Job, or Contract — read-only surface only.
   */
  async getAccount360(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: {
        ...this.accountInclude(),
        client: {
          select: {
            id: true,
            name: true,
            code: true,
            tradingName: true,
            abn: true,
            acn: true,
            email: true,
            phone: true,
            website: true,
            physicalAddress: true,
            physicalSuburb: true,
            physicalState: true,
            physicalPostcode: true,
            industry: true,
            winCount: true,
            tenderCount: true,
            winRate: true,
            lastTenderAt: true,
            lastWonAt: true,
            isActive: true,
            onHold: true,
            onHoldReason: true
          }
        }
      }
    });
    if (!account) throw new NotFoundException(`Account ${id} not found.`);

    // Read-only roll-ups: contacts linked to the client
    const contacts = account.clientId
      ? await this.prisma.contact.findMany({
          where: { organisationType: "CLIENT", organisationId: account.clientId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            email: true,
            phone: true,
            mobile: true,
            isPrimary: true,
            isAccountsContact: true,
            isActive: true
          },
          orderBy: [{ isPrimary: "desc" }, { firstName: "asc" }]
        })
      : [];

    // Read-only roll-up: recent tenders for this client (via TenderClient join)
    const tenders = account.clientId
      ? await this.prisma.tenderClient.findMany({
          where: { clientId: account.clientId },
          select: {
            tender: {
              select: {
                id: true,
                tenderNumber: true,
                title: true,
                status: true,
                dueDate: true,
                createdAt: true
              }
            }
          },
          orderBy: { tender: { createdAt: "desc" } },
          take: 20
        })
      : [];

    // Read-only roll-up: recent jobs for this client
    const jobs = account.clientId
      ? await this.prisma.job.findMany({
          where: { clientId: account.clientId },
          select: {
            id: true,
            jobNumber: true,
            name: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: "desc" },
          take: 20
        })
      : [];

    // Uncapped total of tenders linked to this client (for cap disclosure in the UI)
    const tenderTotal = account.clientId
      ? await this.prisma.tenderClient.count({ where: { clientId: account.clientId } })
      : 0;

    // CRM-S6: Read-only roll-up — contracts for this client (via Project join)
    const contracts = await this.rollUpContracts(account.clientId);

    // CRM-S6: Read-only roll-up — opportunities directly linked to this account
    const opportunities = await this.prisma.opportunity.findMany({
      where: { accountId: account.id },
      select: {
        id: true,
        title: true,
        stage: true,
        probability: true,
        estimatedValue: true,
        expectedCloseDate: true,
        wonAt: true,
        lostAt: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    // CRM-S6: Read-only roll-up — relationship notes filed against this account
    const relationshipNotes = await this.prisma.relationshipNote.findMany({
      where: { accountId: account.id },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, firstName: true, lastName: true } },
        contact: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    // CRM-S6: Read-only roll-up — comms threads anchored to this account.
    // CommThread uses a polymorphic (entityType, entityId) anchor — no direct
    // FK to Account — so we query from the accounts side via those two columns.
    const commThreads = await this.prisma.commThread.findMany({
      where: { entityType: "ACCOUNT", entityId: account.id, archivedAt: null },
      select: {
        id: true,
        subject: true,
        createdAt: true,
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        messages: {
          select: { id: true, body: true, createdAt: true },
          orderBy: { createdAt: "asc" },
          take: 1
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    return {
      ...account,
      rollUps: {
        contacts,
        tenders: tenders.map((tc) => tc.tender),
        tenderTotal,
        jobs,
        contracts,
        opportunities,
        relationshipNotes,
        commThreads
      }
    };
  }

  /**
   * CRM-S6: Rolls up Contract rows for a given clientId.
   *
   * Contracts are owned by the Project → Contract chain; they carry no direct
   * FK to Account or Client. We traverse: clientId → Project (clientId) →
   * Contract.  Read-only; never writes.
   *
   * Returns [] (never undefined) when clientId is null or no contracts exist.
   */
  async rollUpContracts(clientId: string | null) {
    if (!clientId) return [];

    return this.prisma.contract.findMany({
      where: {
        project: { clientId }
      },
      select: {
        id: true,
        contractNumber: true,
        contractValue: true,
        status: true,
        startDate: true,
        endDate: true,
        archivedAt: true,
        createdAt: true,
        project: {
          select: {
            id: true,
            projectNumber: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  // ── CRM-S4: Link-preview — per-client stats for the review screen ────────────

  /**
   * CRM-S4: Returns one row per active Client, carrying the cached tender stats
   * and the existingAccountId (null if the client has no Account yet).
   *
   * Used by AccountLinkPreview so Marco can review and correct the proposed
   * lifecycle before committing. NEVER writes any row.
   *
   * All numeric values come from the Client cached columns (tenderCount,
   * winCount, lastTenderAt) — no aggregation at query time.
   */
  async listClientLinkPreview(): Promise<ClientLinkPreviewRow[]> {
    const clients = await this.prisma.client.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        tenderCount: true,
        winCount: true,
        lastTenderAt: true,
        account: {
          select: { id: true }
        }
      }
    });

    return clients.map((c) => ({
      clientId: c.id,
      name: c.name,
      tenderCount: c.tenderCount,
      wonCount: c.winCount,
      lastTenderAt: c.lastTenderAt,
      existingAccountId: c.account?.id ?? null
    }));
  }

  // ── NAV-2: Accounts index summary list ──────────────────────────────────────

  /**
   * Returns a flat summary list for the Accounts index page (NAV-2).
   * Each row carries: id, name (from linked client or "Unnamed"), type,
   * lifecycle, winRate (from Client.winRate cached field), open opportunity
   * count, lastContactedAt (max of Contact.lastContactedAt + RelationshipNote
   * createdAt for the account), and goingCold flag.
   *
   * Read-only. No schema change.
   */
  async listAccountSummaries(): Promise<AccountSummary[]> {
    // Fetch all non-archived accounts with the fields needed to compute summaries.
    const accounts = await this.prisma.account.findMany({
      where: { archivedAt: null },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        lifecycleStatus: true,
        accountType: true,
        client: {
          select: {
            name: true,
            abn: true,
            winRate: true
          }
        },
        // CRM_ACCOUNTS_LIST_V2: owner added for the Owner column.
        owner: {
          select: { id: true, firstName: true, lastName: true }
        },
        // Count open opportunities directly on the account.
        _count: {
          select: {
            opportunities: {
              where: { stage: { in: [...OPEN_OPPORTUNITY_STAGES] } }
            }
          }
        },
        // Contacts linked to this account — we need the max lastContactedAt.
        contacts: {
          select: { lastContactedAt: true },
          where: { lastContactedAt: { not: null } }
        },
        // Relationship notes filed against this account — we need the max createdAt.
        relationshipNotes: {
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    return accounts.map((acct) => {
      // winRate from the Client model's cached numeric field.
      let winRate: number | null = null;
      if (acct.client?.winRate != null) {
        // Prisma returns Decimal as an object; coerce to number.
        const raw = acct.client.winRate;
        const num = typeof raw === "object" && raw !== null && "toNumber" in raw
          ? (raw as { toNumber(): number }).toNumber()
          : Number(raw);
        winRate = Number.isFinite(num) ? num : null;
      }

      // Compute lastContactedAt = max(contact.lastContactedAt, latestNote.createdAt).
      let lastContactedAt: Date | null = null;
      for (const c of acct.contacts) {
        if (c.lastContactedAt && (!lastContactedAt || c.lastContactedAt > lastContactedAt)) {
          lastContactedAt = c.lastContactedAt;
        }
      }
      const latestNote = acct.relationshipNotes[0];
      if (latestNote && (!lastContactedAt || latestNote.createdAt > lastContactedAt)) {
        lastContactedAt = latestNote.createdAt;
      }

      // CRM_COLD_V3: derive ONCE, then serve both shapes from it. The row
      // keeps `goingCold` for consumers that only want the flag and gains
      // `contactState` so the tile can count never-contacted separately.
      const contactState = deriveContactState(acct.lifecycleStatus, lastContactedAt);

      return {
        id: acct.id,
        name: acct.client?.name ?? "Unnamed",
        abn: acct.client?.abn ?? null,
        type: acct.accountType,
        lifecycle: acct.lifecycleStatus as "PROSPECT" | "ACTIVE" | "PAST",
        owner: acct.owner ?? null,
        winRate,
        openOpportunitiesCount: acct._count.opportunities,
        lastContactedAt,
        goingCold: contactState === "COLD",
        contactState
      };
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private accountInclude() {
    return {
      client: { select: { id: true, name: true, code: true, isActive: true } },
      owner: { select: { id: true, firstName: true, lastName: true } },
      archivedBy: { select: { id: true, firstName: true, lastName: true } }
    } satisfies Prisma.AccountInclude;
  }

  private async requireClient(id: string) {
    const row = await this.prisma.client.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`Client ${id} not found.`);
  }

  private async requireUser(id: string) {
    const row = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`User ${id} not found.`);
  }
}
