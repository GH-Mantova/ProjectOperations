import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AccountLifecycleStatus, AccountSource, AccountType, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * CRM-1: AccountsService — Account spine management + Client-360 read-only
 * roll-ups. Aggregates an Account's contacts and read-only roll-ups of the
 * transactional owners (tenders/jobs/contracts) WITHOUT editing them.
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

    return {
      ...account,
      rollUps: {
        contacts,
        tenders: tenders.map((tc) => tc.tender),
        jobs
      }
    };
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
