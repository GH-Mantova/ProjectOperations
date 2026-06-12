import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../email/email.service";
import { SharePointService } from "../platform/sharepoint.service";
import { TenderNumberService } from "./tender-number.service";
import { clientSlug, FALLBACK_SLUG } from "../../common/id-format/client-slug";
import { QuickEditDto, TenderQueryDto, TenderSortField } from "./dto/tender-query.dto";
import {
  CreateTenderActivityDto,
  CreateTenderClarificationDto,
  CreateTenderFollowUpDto,
  CreateTenderNoteDto,
  UpdateTenderActivityDto,
  UpsertTenderDto
} from "./dto/tender.dto";
import {
  CreateTenderFilterPresetDto,
  UpdateTenderFilterPresetDto
} from "./dto/tender-filter-preset.dto";

const tenderInclude = {
  estimator: {
    select: {
      id: true,
      firstName: true,
      lastName: true
    }
  },
  tenderClients: {
    include: {
      client: true,
      contact: true,
      jobConversion: {
        include: {
          job: {
            select: {
              id: true,
              jobNumber: true,
              name: true,
              status: true
            }
          }
        }
      }
    }
  },
  tenderNotes: {
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  },
  clarifications: true,
  pricingSnapshots: true,
  followUps: {
    include: {
      assignedUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      }
    }
  },
  outcomes: true
  ,
  tenderDocuments: {
    include: {
      folderLink: true,
      fileLink: true
    }
  },
  sourceJob: {
    select: {
      id: true,
      jobNumber: true,
      name: true,
      status: true
    }
  }
} as const;

/**
 * Core tendering domain service: tender CRUD, status lifecycle, filter
 * presets, activities (notes/clarifications/follow-ups), CSV import,
 * and duplication.
 *
 * Cross-cutting behaviour: every mutation writes an AuditService entry;
 * status transitions pin submittedAt/wonAt/lostAt + ratesSnapshotAt and
 * drive per-client win/tender scoring (guarded by tenderScoreCounted);
 * create/duplicate provision SharePoint folders best-effort; the first
 * SUBMITTED transition fires a detached notification email.
 */
@Injectable()
export class TenderingService {
  private readonly logger = new Logger(TenderingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly email: EmailService,
    // PR-64 — auto-provisions the per-tender SharePoint folder structure
    // (1. Operations/1. Tenders/{tenderNumber}/{category}) on create
    // and duplicate. Provided by PlatformModule, already imported above.
    private readonly sharePoint: SharePointService,
    private readonly tenderNumberService: TenderNumberService
  ) {}

  /**
   * List tenders with filters, search, and sort.
   *
   * Default sort (no sortBy) is dueDate ascending then createdAt
   * descending. The probability filter maps Hot ≥70, Warm 30-69, Cold <30.
   *
   * @param query - paging, search, filter, and sort options
   * @returns { items, total, page, pageSize }
   */
  async list(query: TenderQueryDto) {
    const where = this.buildTenderWhere(query);
    const orderBy = this.buildTenderOrderBy(query.sortBy, query.sortDir);
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tender.findMany({
        where,
        include: tenderInclude,
        orderBy,
        skip,
        take: query.pageSize
      }),
      this.prisma.tender.count({ where })
    ]);

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  private buildTenderWhere(query: TenderQueryDto): Prisma.TenderWhereInput | undefined {
    const clauses: Prisma.TenderWhereInput[] = [];

    if (query.q) {
      clauses.push({
        OR: [
          { tenderNumber: { contains: query.q, mode: "insensitive" } },
          { title: { contains: query.q, mode: "insensitive" } },
          { tenderClients: { some: { client: { name: { contains: query.q, mode: "insensitive" } } } } }
        ]
      });
    }

    if (query.status?.length) {
      clauses.push({ status: { in: query.status } });
    }

    if (query.estimatorId) {
      clauses.push({ estimatorUserId: query.estimatorId });
    }

    if (query.clientId) {
      clauses.push({ tenderClients: { some: { clientId: query.clientId } } });
    }

    if (query.discipline) {
      clauses.push({ scopeItems: { some: { card: { discipline: query.discipline } } } });
    }

    if (query.valueMin || query.valueMax) {
      const valueFilter: Prisma.DecimalFilter = {};
      if (query.valueMin) valueFilter.gte = new Prisma.Decimal(query.valueMin);
      if (query.valueMax) valueFilter.lte = new Prisma.Decimal(query.valueMax);
      clauses.push({ estimatedValue: valueFilter });
    }

    if (query.dueDateFrom || query.dueDateTo) {
      const due: Prisma.DateTimeFilter = {};
      if (query.dueDateFrom) due.gte = new Date(query.dueDateFrom);
      if (query.dueDateTo) due.lte = new Date(query.dueDateTo);
      clauses.push({ dueDate: due });
    }

    if (query.probability) {
      const bucket = query.probability.toLowerCase();
      if (bucket === "hot") clauses.push({ probability: { gte: 70 } });
      else if (bucket === "warm") clauses.push({ probability: { gte: 30, lt: 70 } });
      else if (bucket === "cold") clauses.push({ probability: { lt: 30 } });
    }

    if (!clauses.length) return undefined;
    return clauses.length === 1 ? clauses[0] : { AND: clauses };
  }

  private buildTenderOrderBy(
    sortBy: TenderSortField | undefined,
    sortDir: "asc" | "desc" | undefined
  ): Prisma.TenderOrderByWithRelationInput | Prisma.TenderOrderByWithRelationInput[] {
    const dir = sortDir === "asc" ? "asc" : "desc";
    switch (sortBy) {
      case "tenderNumber":
        return { tenderNumber: dir };
      case "name":
      case "title":
        return { title: dir };
      case "value":
      case "estimatedValue":
        return { estimatedValue: dir };
      case "dueDate":
        return { dueDate: dir };
      case "createdAt":
        return { createdAt: dir };
      case "updatedAt":
        return { updatedAt: dir };
      case "status":
        return { status: dir };
      case "probability":
        return { probability: dir };
      default:
        return [{ dueDate: "asc" }, { createdAt: "desc" }];
    }
  }

  /**
   * Bulk update the status of up to 50 tenders in a single transaction.
   *
   * Applies the same lifecycle-date pinning as updateStatus (submittedAt,
   * wonAt, lostAt, ratesSnapshotAt) and updates client win/tender scores
   * outside the transaction. Writes one audit entry for the whole batch.
   *
   * @param tenderIds - up to 50 tender ids (duplicates de-duped)
   * @param status - target status applied to every tender
   * @returns { updated: count, tenders: [{ id, tenderNumber, status }] }
   * @throws BadRequestException when tenderIds is empty or exceeds 50
   * @throws NotFoundException when any id does not exist
   */
  async bulkUpdateStatus(tenderIds: string[], status: string, actorId?: string) {
    if (!tenderIds.length) {
      throw new BadRequestException("tenderIds must not be empty.");
    }
    if (tenderIds.length > 50) {
      throw new BadRequestException("A maximum of 50 tenders can be updated in one batch.");
    }
    const uniqueIds = Array.from(new Set(tenderIds));

    const existing = await this.prisma.tender.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, status: true, submittedAt: true, ratesSnapshotAt: true, wonAt: true, lostAt: true, tenderScoreCounted: true }
    });
    const missing = uniqueIds.filter((id) => !existing.some((tender) => tender.id === id));
    if (missing.length) {
      throw new NotFoundException(`Tenders not found: ${missing.join(", ")}`);
    }

    const now = new Date();
    const isWon = status === "AWARDED" || status === "CONTRACT_ISSUED" || status === "CONVERTED";
    const isScorable = isWon || status === "SUBMITTED" || status === "LOST";

    const updated = await this.prisma.$transaction(
      existing.map((tender) => {
        const data: Prisma.TenderUpdateInput = { status };
        if (status === "SUBMITTED" && !tender.submittedAt) {
          data.submittedAt = now;
          if (!tender.ratesSnapshotAt) data.ratesSnapshotAt = now;
        }
        if (isWon && !tender.wonAt) {
          data.wonAt = now;
          if (!tender.submittedAt) {
            data.submittedAt = now;
            if (!tender.ratesSnapshotAt) data.ratesSnapshotAt = now;
          }
        }
        if (status === "LOST" && !tender.lostAt) {
          data.lostAt = now;
          if (!tender.submittedAt) {
            data.submittedAt = now;
            if (!tender.ratesSnapshotAt) data.ratesSnapshotAt = now;
          }
        }
        if (isScorable && !tender.tenderScoreCounted) {
          data.tenderScoreCounted = true;
        }
        return this.prisma.tender.update({
          where: { id: tender.id },
          data,
          select: { id: true, tenderNumber: true, status: true }
        });
      })
    );

    // Client scoring — update outside the main transaction (same pattern as updateStatus).
    for (const tender of existing) {
      if (isScorable && !tender.tenderScoreCounted) {
        await this.updateClientScores(tender.id, isWon);
      } else if (isWon && tender.tenderScoreCounted) {
        await this.bumpWinCount(tender.id);
      }
    }

    await this.auditService.write({
      actorId,
      action: "tenders.bulk-status.update",
      entityType: "Tender",
      entityId: uniqueIds.join(","),
      metadata: { count: updated.length, status }
    });

    return {
      updated: updated.length,
      tenders: updated
    };
  }

  /**
   * Patch a limited set of tender fields and log a single change-summary note.
   *
   * Only fields that actually differ are written. If nothing changed,
   * returns the current detail without writing a note or audit entry.
   *
   * @param dto - any of status, probability, dueDate, value, assignedEstimatorId (writes legacy estimator relation), description, notes
   * @returns the full tender detail after the write
   * @throws NotFoundException when the tender does not exist
   */
  async quickEdit(id: string, dto: QuickEditDto, actorId?: string) {
    const existing = await this.prisma.tender.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Tender not found.");
    }

    const data: Prisma.TenderUpdateInput = {};
    const changed: string[] = [];

    if (dto.status !== undefined && dto.status !== existing.status) {
      data.status = dto.status;
      changed.push(`status: ${existing.status} → ${dto.status}`);
    }
    if (dto.probability !== undefined && dto.probability !== existing.probability) {
      data.probability = dto.probability;
      changed.push(`probability: ${existing.probability ?? "—"} → ${dto.probability ?? "—"}`);
    }
    if (dto.dueDate !== undefined) {
      const next = dto.dueDate ? new Date(dto.dueDate) : null;
      const existingIso = existing.dueDate?.toISOString() ?? null;
      const nextIso = next?.toISOString() ?? null;
      if (existingIso !== nextIso) {
        data.dueDate = next;
        changed.push(`dueDate: ${existingIso ?? "—"} → ${nextIso ?? "—"}`);
      }
    }
    if (dto.value !== undefined) {
      const next = dto.value ? new Prisma.Decimal(dto.value) : null;
      const existingNum = existing.estimatedValue ? existing.estimatedValue.toString() : null;
      const nextNum = next ? next.toString() : null;
      if (existingNum !== nextNum) {
        data.estimatedValue = next;
        changed.push(`value: ${existingNum ?? "—"} → ${nextNum ?? "—"}`);
      }
    }
    if (dto.assignedEstimatorId !== undefined) {
      if (dto.assignedEstimatorId && dto.assignedEstimatorId !== existing.estimatorUserId) {
        data.estimator = { connect: { id: dto.assignedEstimatorId } };
        changed.push(`estimator: ${existing.estimatorUserId ?? "—"} → ${dto.assignedEstimatorId}`);
      } else if (dto.assignedEstimatorId === null && existing.estimatorUserId) {
        data.estimator = { disconnect: true };
        changed.push(`estimator: ${existing.estimatorUserId} → —`);
      }
    }
    if (dto.description !== undefined && (dto.description ?? null) !== (existing.description ?? null)) {
      data.description = dto.description;
      changed.push("description");
    }
    if (dto.notes !== undefined && (dto.notes ?? null) !== (existing.notes ?? null)) {
      data.notes = dto.notes;
      changed.push("notes");
    }

    if (!changed.length) {
      return this.getById(id);
    }

    await this.prisma.tender.update({ where: { id }, data });

    let actorLabel = "Someone";
    if (actorId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { firstName: true, lastName: true }
      });
      if (actor) actorLabel = `${actor.firstName} ${actor.lastName}`;
    }

    await this.prisma.tenderNote.create({
      data: {
        tenderId: id,
        authorUserId: actorId,
        body: `Quick edit by ${actorLabel}: ${changed.join("; ")}`
      }
    });

    await this.auditService.write({
      actorId,
      action: "tenders.quick-edit",
      entityType: "Tender",
      entityId: id,
      metadata: { changed }
    });

    return this.getById(id);
  }

  // §5A.3 — Team panel writes here. Distinct from the legacy `estimatorUserId`
  // (TenderEstimator relation): that field represents the historical
  // estimator-of-record, while `assignedEstimatorId` is the team-level
  // assignment used by the new Team panel. Pass `null` to clear.
  /**
   * Assign (or clear) the team-level estimator on a tender.
   *
   * Writes an audit entry recording the previous and new assignee.
   *
   * @param userId - user to assign, or null to clear the assignment
   * @returns the updated tender (no relations included)
   * @throws NotFoundException when the tender or assignee user does not exist
   */
  async setAssignedEstimator(tenderId: string, userId: string | null, actorId?: string) {
    const existing = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true, assignedEstimatorId: true }
    });
    if (!existing) throw new NotFoundException("Tender not found.");

    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) throw new NotFoundException("Assignee user not found.");
    }

    const updated = await this.prisma.tender.update({
      where: { id: tenderId },
      data: {
        assignedEstimator: userId ? { connect: { id: userId } } : { disconnect: true }
      }
    });

    await this.auditService.write({
      actorId,
      action: "tenders.assigned-estimator.update",
      entityType: "Tender",
      entityId: tenderId,
      metadata: {
        previousAssignedEstimatorId: existing.assignedEstimatorId,
        assignedEstimatorId: userId
      }
    });

    return updated;
  }

  /**
   * List saved filter presets for a user, default-first then by name.
   *
   * @returns the user's TenderFilterPreset rows
   */
  async listFilterPresets(userId: string) {
    return this.prisma.tenderFilterPreset.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }]
    });
  }

  /**
   * Save a filter preset for a user.
   *
   * If isDefault is set, any existing default preset for the user is
   * cleared first.
   *
   * @param dto - preset name, filters JSON, and optional isDefault flag
   * @returns the created preset
   * @throws ConflictException when a preset with the same name already exists for the user
   */
  async createFilterPreset(userId: string, dto: CreateTenderFilterPresetDto) {
    if (dto.isDefault) {
      await this.prisma.tenderFilterPreset.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false }
      });
    }
    try {
      return await this.prisma.tenderFilterPreset.create({
        data: {
          userId,
          name: dto.name,
          filters: dto.filters as Prisma.InputJsonValue,
          isDefault: dto.isDefault ?? false
        }
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("A preset with this name already exists.");
      }
      throw err;
    }
  }

  /**
   * Update a saved filter preset owned by the user.
   *
   * Promoting a preset to default demotes any other default first.
   *
   * @param dto - partial name / filters / isDefault changes
   * @returns the updated preset
   * @throws NotFoundException when the preset does not exist or belongs to another user
   * @throws ConflictException when renaming collides with an existing preset name
   */
  async updateFilterPreset(userId: string, id: string, dto: UpdateTenderFilterPresetDto) {
    const existing = await this.prisma.tenderFilterPreset.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new NotFoundException("Filter preset not found.");
    }
    if (dto.isDefault === true && !existing.isDefault) {
      await this.prisma.tenderFilterPreset.updateMany({
        where: { userId, isDefault: true, NOT: { id } },
        data: { isDefault: false }
      });
    }
    try {
      return await this.prisma.tenderFilterPreset.update({
        where: { id },
        data: {
          name: dto.name ?? undefined,
          filters: dto.filters !== undefined ? (dto.filters as Prisma.InputJsonValue) : undefined,
          isDefault: dto.isDefault !== undefined ? dto.isDefault : undefined
        }
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("A preset with this name already exists.");
      }
      throw err;
    }
  }

  /**
   * Delete a saved filter preset owned by the user.
   *
   * @returns { id } of the deleted preset
   * @throws NotFoundException when the preset does not exist or belongs to another user
   */
  async deleteFilterPreset(userId: string, id: string) {
    const existing = await this.prisma.tenderFilterPreset.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new NotFoundException("Filter preset not found.");
    }
    await this.prisma.tenderFilterPreset.delete({ where: { id } });
    return { id };
  }

  /**
   * Get a tender with the full relation set (clients, notes,
   * clarifications, snapshots, follow-ups, outcomes, documents, source job).
   *
   * @returns the tender detail
   * @throws NotFoundException when the tender does not exist
   */
  async getById(id: string) {
    const tender = await this.prisma.tender.findUnique({
      where: { id },
      include: tenderInclude
    });

    if (!tender) {
      throw new NotFoundException("Tender not found.");
    }

    return tender;
  }

  /**
   * Hard-delete a tender; related records are removed by DB cascade.
   *
   * Writes the audit entry (with cascade counts) BEFORE the delete so
   * the metadata survives the row removal.
   *
   * @returns { id, tenderNumber, cascadedCounts }
   * @throws NotFoundException when the tender does not exist
   */
  async delete(id: string, actorId: string) {
    const tender = await this.prisma.tender.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            clientQuotes: true,
            scopeItems: true,
            scopeCards: true,
            tenderDocuments: true,
            estimateExports: true,
            tenderClients: true,
            tenderNotes: true,
            clarifications: true
          }
        }
      }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    await this.auditService.write({
      actorId,
      action: "tenders.delete",
      entityType: "Tender",
      entityId: id,
      metadata: {
        tenderNumber: tender.tenderNumber,
        title: tender.title,
        status: tender.status,
        cascadedCounts: tender._count
      }
    });

    await this.prisma.tender.delete({ where: { id } });

    return {
      id,
      tenderNumber: tender.tenderNumber,
      cascadedCounts: tender._count
    };
  }

  /**
   * Return cascade counts so the UI can show what a delete will remove.
   *
   * @returns tender summary fields plus _count of related records
   * @throws NotFoundException when the tender does not exist
   */
  async deletePreflight(id: string) {
    const tender = await this.prisma.tender.findUnique({
      where: { id },
      select: {
        id: true,
        tenderNumber: true,
        title: true,
        status: true,
        _count: {
          select: {
            clientQuotes: true,
            scopeItems: true,
            scopeCards: true,
            tenderDocuments: true,
            estimateExports: true,
            tenderClients: true
          }
        }
      }
    });
    if (!tender) throw new NotFoundException("Tender not found.");
    return tender;
  }

  /**
   * Create a tender with optional nested clients, notes, clarifications,
   * pricing snapshots, follow-ups, and outcomes.
   *
   * G5 — tender numbers are server-generated (T{YYMMDD}-{SLUG}-Rev{N});
   * any caller-supplied tenderNumber is ignored except for the CSV import
   * path, which passes `preserveSuppliedNumber` to keep historical numbers
   * from the imported register.
   *
   * Writes an audit entry and provisions the per-tender SharePoint
   * folder structure best-effort (a Graph failure never rolls back the row).
   *
   * @param dto - full tender payload
   * @param options - preserveSuppliedNumber keeps dto.tenderNumber (CSV import path)
   * @returns the created tender with all relations
   * @throws ConflictException when a preserved supplied tender number already exists
   * @throws BadRequestException when more than one client is marked awarded
   */
  async create(
    dto: UpsertTenderDto,
    actorId?: string,
    options?: { preserveSuppliedNumber?: boolean }
  ) {
    this.validateAwardedClients(dto.tenderClients ?? []);

    const primaryClientName = await this.resolvePrimaryClientName(dto.tenderClients ?? []);

    let numbering: { tenderNumber: string; clientSlugSnapshot: string; revisionNumber: number };
    const supplied = dto.tenderNumber?.trim();
    if (options?.preserveSuppliedNumber && supplied) {
      await this.ensureUniqueTenderNumber(supplied);
      numbering = {
        tenderNumber: supplied,
        clientSlugSnapshot: clientSlug(primaryClientName ?? "") || FALLBACK_SLUG,
        revisionNumber: 1
      };
    } else {
      numbering = await this.tenderNumberService.generate(primaryClientName);
    }

    const tender = await this.prisma.tender.create({
      data: {
        ...this.toTenderCreateInput(dto, actorId),
        tenderNumber: numbering.tenderNumber,
        revisionNumber: numbering.revisionNumber,
        clientSlugSnapshot: numbering.clientSlugSnapshot
      },
      include: tenderInclude
    });

    await this.auditService.write({
      actorId,
      action: "tenders.create",
      entityType: "Tender",
      entityId: tender.id,
      metadata: { tenderNumber: tender.tenderNumber }
    });

    await this.provisionTenderFolders(tender, actorId);

    return tender;
  }

  /**
   * Duplicate a tender: copies fields and client links, resets lifecycle.
   *
   * The copy gets status DRAFT, a fresh canonical tender number
   * (T{YYMMDD}-{SLUG}-Rev1 stamped with today's date and derived from the
   * source's primary client), "(copy)" title suffix,
   * isAwarded/contractIssued reset to false, and
   * fresh SharePoint folders. Notes, clarifications, snapshots,
   * follow-ups, and outcomes are NOT copied.
   *
   * @returns the newly created tender with all relations
   * @throws NotFoundException when the source tender does not exist
   */
  async duplicate(id: string, actorId?: string) {
    const source = await this.prisma.tender.findUnique({
      where: { id },
      include: {
        tenderClients: true
      }
    });
    if (!source) {
      throw new NotFoundException("Tender not found.");
    }

    // G5 — duplicates get a fresh canonical number (today's date stamp, Rev1)
    // derived from the source tender's primary client.
    const primaryClientName = await this.resolvePrimaryClientName(
      source.tenderClients.map((item) => ({
        clientId: item.clientId,
        relationshipType: item.relationshipType ?? undefined
      }))
    );
    const numbering = await this.tenderNumberService.generate(primaryClientName);

    const tender = await this.prisma.tender.create({
      data: {
        tenderNumber: numbering.tenderNumber,
        revisionNumber: numbering.revisionNumber,
        clientSlugSnapshot: numbering.clientSlugSnapshot,
        title: `${source.title} (copy)`,
        description: source.description,
        status: "DRAFT",
        dueDate: source.dueDate ?? undefined,
        proposedStartDate: source.proposedStartDate ?? undefined,
        leadTimeDays: source.leadTimeDays ?? undefined,
        probability: source.probability ?? undefined,
        estimatedValue: source.estimatedValue ?? undefined,
        notes: source.notes,
        estimator: source.estimatorUserId ? { connect: { id: source.estimatorUserId } } : undefined,
        tenderClients: source.tenderClients.length
          ? {
              create: source.tenderClients.map((item) => ({
                client: { connect: { id: item.clientId } },
                contact: item.contactId ? { connect: { id: item.contactId } } : undefined,
                isAwarded: false,
                contractIssued: false,
                relationshipType: item.relationshipType,
                notes: item.notes
              }))
            }
          : undefined
      },
      include: tenderInclude
    });

    await this.auditService.write({
      actorId,
      action: "tenders.duplicate",
      entityType: "Tender",
      entityId: tender.id,
      metadata: { sourceTenderId: id, tenderNumber: tender.tenderNumber }
    });

    await this.provisionTenderFolders(tender, actorId);

    return tender;
  }

  // PR-64 — best-effort SharePoint folder provisioning on tender create
  // / duplicate. Wraps SharePointService.ensureTenderFolderStructure so a
  // Graph outage or misconfigured site can never roll back the tender
  // row that was already committed. Uploads later re-ensure the specific
  // category folder they need, so missed folders self-heal on first use.
  private async provisionTenderFolders(
    tender: { id: string; tenderNumber: string },
    actorId?: string
  ): Promise<void> {
    try {
      await this.sharePoint.ensureTenderFolderStructure(tender, actorId);
    } catch (err) {
      this.logger.warn(
        `Tender folder provisioning failed for ${tender.tenderNumber}: ${
          err instanceof Error ? err.message : String(err)
        }. Folders will be created lazily on first upload.`
      );
    }
  }

  /**
   * Resolves the primary client's company name from a tender-clients input
   * list: the first entry whose relationshipType contains "primary"
   * (case-insensitive — seeds use "PRIMARY", compliance smoke uses
   * "Primary Bidder"), else the first entry. Null when the list is empty.
   */
  private async resolvePrimaryClientName(
    tenderClients: Array<{ clientId: string; relationshipType?: string }>
  ): Promise<string | null> {
    if (!tenderClients.length) return null;
    const primary =
      tenderClients.find((item) => /primary/i.test(item.relationshipType ?? "")) ?? tenderClients[0];
    const client = await this.prisma.client.findUnique({
      where: { id: primary.clientId },
      select: { name: true }
    });
    return client?.name ?? null;
  }

  /**
   * G5 — "Mark as new revision": bumps Rev{N} on the tender number (row id
   * stays stable; date stamp and slug are reused from creation). Writes a
   * TENDER_REVISION_BUMPED-style audit entry with old/new numbers.
   */
  async bumpRevision(id: string, reason: string | undefined, actorId?: string) {
    await this.ensureTenderExists(id);
    const result = await this.tenderNumberService.bumpRevision(id);

    await this.auditService.write({
      actorId,
      action: "tenders.bump-revision",
      entityType: "Tender",
      entityId: id,
      metadata: {
        oldNumber: result.previousTenderNumber,
        newNumber: result.tenderNumber,
        revisionNumber: result.revisionNumber,
        reason: reason ?? null
      }
    });

    return this.getById(id);
  }

  /**
   * Update only the tender status, driving the lifecycle side effects.
   *
   * First SUBMITTED pins submittedAt + ratesSnapshotAt; first win
   * (AWARDED/CONTRACT_ISSUED/CONVERTED) pins wonAt; first LOST pins
   * lostAt (each backfills submittedAt if missing). Updates client
   * win/tender scores once per tender (tenderScoreCounted guard) and
   * fires a detached email on the first SUBMITTED transition.
   *
   * @returns the updated tender with relations
   * @throws NotFoundException when the tender does not exist
   */
  async updateStatus(id: string, status: string, actorId?: string) {
    const existing = await this.prisma.tender.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Tender not found.");
    }
    const now = new Date();
    const data: Prisma.TenderUpdateInput = { status };
    // First transition to SUBMITTED pins submittedAt AND freezes the rate
    // snapshot timestamp — the Quote tab uses this to display "Rates as of
    // [date]" and rates admin can warn if the library moves afterwards.
    if (status === "SUBMITTED" && !existing.submittedAt) {
      data.submittedAt = now;
      if (!existing.ratesSnapshotAt) data.ratesSnapshotAt = now;
    }
    if ((status === "AWARDED" || status === "CONTRACT_ISSUED" || status === "CONVERTED") && !existing.wonAt) {
      data.wonAt = now;
      if (!existing.submittedAt) {
        data.submittedAt = now;
        if (!existing.ratesSnapshotAt) data.ratesSnapshotAt = now;
      }
    }
    if (status === "LOST" && !existing.lostAt) {
      data.lostAt = now;
      if (!existing.submittedAt) {
        data.submittedAt = now;
        if (!existing.ratesSnapshotAt) data.ratesSnapshotAt = now;
      }
    }
    const tender = await this.prisma.tender.update({
      where: { id },
      data,
      include: tenderInclude
    });
    await this.auditService.write({
      actorId,
      action: "tenders.status.update",
      entityType: "Tender",
      entityId: id,
      metadata: { from: existing.status, to: status }
    });

    // Client scoring — SUBMITTED/AWARDED/LOST all count as a tender the
    // client considered. Each linked client is updated once (flag on the
    // Tender prevents double-counting when status flips back and forth).
    const isWon = status === "AWARDED" || status === "CONTRACT_ISSUED" || status === "CONVERTED";
    const isScorable = isWon || status === "SUBMITTED" || status === "LOST";
    if (isScorable && !existing.tenderScoreCounted) {
      await this.updateClientScores(id, isWon);
      await this.prisma.tender.update({
        where: { id },
        data: { tenderScoreCounted: true }
      });
    } else if (isWon && existing.tenderScoreCounted) {
      // Tender was previously submitted/lost (tenderCount incremented) and
      // is now being won — bump winCount without double-counting tenderCount.
      await this.bumpWinCount(id);
    }

    // Fire-and-forget email for the SUBMITTED transition only. sendNotificationEmail
    // already swallows errors internally but the Promise is still detached here
    // so a slow SMTP never blocks the write path.
    if (status === "SUBMITTED" && existing.status !== "SUBMITTED") {
      const clientName = tender.tenderClients[0]?.client?.name ?? "(no client)";
      const value = tender.estimatedValue ? `$${Number(tender.estimatedValue).toLocaleString("en-AU")}` : "TBA";
      void this.email.sendNotificationEmail({
        trigger: "tender.submitted",
        subject: `Tender submitted — ${tender.tenderNumber} ${tender.title}`,
        html: `<p>Tender <strong>${tender.tenderNumber} — ${tender.title}</strong> has been submitted.</p><p>Client: ${clientName}</p><p>Estimated value: ${value}</p>`,
        text: `Tender ${tender.tenderNumber} — ${tender.title} submitted. Client: ${clientName}. Value: ${value}.`
      });
    }

    return tender;
  }

  /**
   * Update only the probability of a tender; writes an audit entry.
   *
   * @param probability - 0-100, or null to clear
   * @returns the updated tender with relations
   * @throws NotFoundException when the tender does not exist
   */
  async updateProbability(id: string, probability: number | null, actorId?: string) {
    const existing = await this.prisma.tender.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Tender not found.");
    }
    const tender = await this.prisma.tender.update({
      where: { id },
      data: { probability },
      include: tenderInclude
    });
    await this.auditService.write({
      actorId,
      action: "tenders.probability.update",
      entityType: "Tender",
      entityId: id,
      metadata: { from: existing.probability, to: probability }
    });
    return tender;
  }

  /**
   * Full upsert-style update of a tender.
   *
   * Replace semantics: ALL nested collections (clients, notes,
   * clarifications, pricing snapshots, follow-ups, outcomes) are
   * deleted and re-created from the payload inside one transaction —
   * omitting a collection clears it.
   *
   * Tender numbers are immutable here: any tenderNumber in the payload is
   * ignored — renames happen only via the bump-revision action.
   *
   * @param dto - full tender payload (same shape as create)
   * @returns the updated tender with relations
   * @throws NotFoundException when the tender does not exist
   * @throws BadRequestException when more than one client is marked awarded
   */
  async update(id: string, dto: UpsertTenderDto, actorId?: string) {
    const existing = await this.prisma.tender.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Tender not found.");
    }

    // G5 — tender numbers are immutable through update; renames happen only
    // via the bump-revision action. Any tenderNumber in the payload is ignored.
    this.validateAwardedClients(dto.tenderClients ?? []);

    await this.prisma.$transaction(async (tx) => {
      await tx.tender.update({
        where: { id },
        data: this.toTenderUpdateInput(dto)
      });

      await tx.tenderClient.deleteMany({ where: { tenderId: id } });
      await tx.tenderNote.deleteMany({ where: { tenderId: id } });
      await tx.tenderClarification.deleteMany({ where: { tenderId: id } });
      await tx.tenderPricingSnapshot.deleteMany({ where: { tenderId: id } });
      await tx.tenderFollowUp.deleteMany({ where: { tenderId: id } });
      await tx.tenderOutcome.deleteMany({ where: { tenderId: id } });

      if (dto.tenderClients?.length) {
        await tx.tenderClient.createMany({
          data: dto.tenderClients.map((item) => ({
            tenderId: id,
            clientId: item.clientId,
            contactId: item.contactId,
            isAwarded: item.isAwarded ?? false,
            relationshipType: item.relationshipType,
            notes: item.notes
          }))
        });
      }

      for (const note of dto.tenderNotes ?? []) {
        await tx.tenderNote.create({
          data: {
            tenderId: id,
            authorUserId: actorId,
            body: note.body
          }
        });
      }

      if (dto.clarifications?.length) {
        await tx.tenderClarification.createMany({
          data: dto.clarifications.map((item) => ({
            tenderId: id,
            subject: item.subject,
            response: item.response,
            status: item.status ?? "OPEN",
            dueDate: item.dueDate ? new Date(item.dueDate) : null
          }))
        });
      }

      if (dto.pricingSnapshots?.length) {
        await tx.tenderPricingSnapshot.createMany({
          data: dto.pricingSnapshots.map((item) => ({
            tenderId: id,
            versionLabel: item.versionLabel,
            estimatedValue: item.estimatedValue ? new Prisma.Decimal(item.estimatedValue) : null,
            marginPercent: item.marginPercent ? new Prisma.Decimal(item.marginPercent) : null,
            assumptions: item.assumptions
          }))
        });
      }

      if (dto.followUps?.length) {
        await tx.tenderFollowUp.createMany({
          data: dto.followUps.map((item) => ({
            tenderId: id,
            dueAt: new Date(item.dueAt),
            status: item.status ?? "OPEN",
            details: item.details,
            assignedUserId: item.assignedUserId
          }))
        });
      }

      if (dto.outcomes?.length) {
        await tx.tenderOutcome.createMany({
          data: dto.outcomes.map((item) => ({
            tenderId: id,
            outcomeType: item.outcomeType,
            notes: item.notes
          }))
        });
      }

    });

    const tender = await this.getById(id);

    await this.auditService.write({
      actorId,
      action: "tenders.update",
      entityType: "Tender",
      entityId: id,
      metadata: { tenderNumber: tender.tenderNumber }
    });

    return tender;
  }

  /**
   * Add a tender note (legacy write path; also used by addActivity).
   *
   * @returns the full tender detail after the write
   * @throws NotFoundException when the tender does not exist
   */
  async addNote(tenderId: string, dto: CreateTenderNoteDto, actorId?: string) {
    await this.ensureTenderExists(tenderId);

    await this.prisma.tenderNote.create({
      data: {
        tenderId,
        authorUserId: actorId,
        body: dto.body
      }
    });

    await this.auditService.write({
      actorId,
      action: "tenders.note.create",
      entityType: "Tender",
      entityId: tenderId,
      metadata: { bodyLength: dto.body.length }
    });

    return this.getById(tenderId);
  }

  /**
   * Add a tender clarification (legacy write path; also used by addActivity).
   *
   * @returns the full tender detail after the write
   * @throws NotFoundException when the tender does not exist
   */
  async addClarification(tenderId: string, dto: CreateTenderClarificationDto, actorId?: string) {
    await this.ensureTenderExists(tenderId);

    await this.prisma.tenderClarification.create({
      data: {
        tenderId,
        subject: dto.subject,
        response: dto.response,
        status: dto.status ?? "OPEN",
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null
      }
    });

    await this.auditService.write({
      actorId,
      action: "tenders.clarification.create",
      entityType: "Tender",
      entityId: tenderId,
      metadata: { subject: dto.subject }
    });

    return this.getById(tenderId);
  }

  /**
   * Add a tender follow-up (legacy write path; also used by addActivity).
   *
   * @returns the full tender detail after the write
   * @throws NotFoundException when the tender does not exist
   */
  async addFollowUp(tenderId: string, dto: CreateTenderFollowUpDto, actorId?: string) {
    await this.ensureTenderExists(tenderId);

    await this.prisma.tenderFollowUp.create({
      data: {
        tenderId,
        dueAt: new Date(dto.dueAt),
        details: dto.details,
        status: dto.status ?? "OPEN",
        assignedUserId: dto.assignedUserId
      }
    });

    await this.auditService.write({
      actorId,
      action: "tenders.followup.create",
      entityType: "Tender",
      entityId: tenderId,
      metadata: { details: dto.details }
    });

    return this.getById(tenderId);
  }

  /**
   * List the unified activity feed for a tender.
   *
   * Merges notes, clarifications, and follow-ups into one normalised
   * shape, sorted newest-first by dueAt/updatedAt/createdAt.
   *
   * @returns activity rows with composite ids ("note:{id}", "clarification:{id}", "follow-up:{id}")
   * @throws NotFoundException when the tender does not exist
   */
  async listActivities(tenderId: string) {
    const tender = await this.getById(tenderId);
    return this.mapTenderActivities(tender);
  }

  /**
   * Create a unified tender activity, routed by activityType.
   *
   * NOTE/INTERNAL_NOTE → tender note; CLARIFICATION → clarification;
   * FOLLOW_UP/CALL/MEETING/SUBMISSION_TASK/TASK → follow-up (requires
   * dueAt).
   *
   * @returns the full tender detail after the write
   * @throws BadRequestException when the type is unsupported or a follow-up type lacks dueAt
   * @throws NotFoundException when the tender does not exist
   */
  async addActivity(tenderId: string, dto: CreateTenderActivityDto, actorId?: string) {
    const normalizedType = dto.activityType.toUpperCase();

    if (normalizedType === "NOTE" || normalizedType === "INTERNAL_NOTE") {
      return this.addNote(
        tenderId,
        {
          body: dto.details?.trim() ? `${dto.title}\n\n${dto.details}` : dto.title
        },
        actorId
      );
    }

    if (normalizedType === "CLARIFICATION") {
      return this.addClarification(
        tenderId,
        {
          subject: dto.title,
          response: dto.details,
          status: dto.status ?? "OPEN",
          dueDate: dto.dueAt
        },
        actorId
      );
    }

    const followUpTypes = new Set(["FOLLOW_UP", "FOLLOW-UP", "CALL", "MEETING", "SUBMISSION_TASK", "TASK"]);
    if (followUpTypes.has(normalizedType)) {
      if (!dto.dueAt) {
        throw new BadRequestException("Tender activities of this type require a due date.");
      }

      return this.addFollowUp(
        tenderId,
        {
          dueAt: dto.dueAt,
          details: dto.details?.trim() ? `${dto.title}: ${dto.details}` : dto.title,
          status: dto.status ?? "OPEN",
          assignedUserId: dto.assignedUserId
        },
        actorId
      );
    }

    throw new BadRequestException("Unsupported tender activity type.");
  }

  /**
   * Update a clarification or follow-up activity in place.
   *
   * Note activities cannot be updated. Empty-string dueAt clears a
   * clarification due date; empty-string assignedUserId clears a
   * follow-up assignee.
   *
   * @param activityId - composite "{type}:{sourceId}" identifier
   * @returns the full tender detail after the write
   * @throws BadRequestException when the id is malformed or the type is not updatable
   * @throws NotFoundException when the tender does not exist
   */
  async updateActivity(tenderId: string, activityId: string, dto: UpdateTenderActivityDto, actorId?: string) {
    await this.ensureTenderExists(tenderId);

    const [activityType, sourceId] = activityId.split(":");
    if (!activityType || !sourceId) {
      throw new BadRequestException("Invalid tender activity identifier.");
    }

    if (activityType === "clarification") {
      await this.prisma.tenderClarification.update({
        where: { id: sourceId },
        data: {
          subject: dto.title,
          response: dto.details,
          status: dto.status,
          dueDate: dto.dueAt ? new Date(dto.dueAt) : dto.dueAt === "" ? null : undefined
        }
      });

      await this.auditService.write({
        actorId,
        action: "tenders.clarification.update",
        entityType: "Tender",
        entityId: tenderId,
        metadata: { activityId }
      });

      return this.getById(tenderId);
    }

    if (activityType === "follow-up") {
      await this.prisma.tenderFollowUp.update({
        where: { id: sourceId },
        data: {
          details: dto.details?.trim() ? dto.details : dto.title,
          status: dto.status,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          assignedUserId: dto.assignedUserId === "" ? null : dto.assignedUserId
        }
      });

      await this.auditService.write({
        actorId,
        action: "tenders.followup.update",
        entityType: "Tender",
        entityId: tenderId,
        metadata: { activityId }
      });

      return this.getById(tenderId);
    }

    throw new BadRequestException("This tender activity type cannot be updated yet.");
  }

  /**
   * Preview tender import rows from CSV text without writing anything.
   *
   * A row is valid when it has a tender number + title and the number
   * does not already exist (case-insensitive).
   *
   * @param csvText - header row + data rows; naive comma split (no quoted-field support)
   * @returns { totalRows, rows: [{ rowNumber, tenderNumber, title, clientNames, status, duplicate, valid }] }
   */
  async previewImport(csvText: string) {
    const rows = this.parseImportCsv(csvText);
    const existingNumbers = await this.findExistingTenderNumbers(rows.map((row) => row.tenderNumber).filter(Boolean));

    return {
      totalRows: rows.length,
      rows: rows.map((row, index) => ({
        rowNumber: index + 1,
        tenderNumber: row.tenderNumber,
        title: row.title,
        clientNames: row.clientNames,
        status: row.status ?? "DRAFT",
        duplicate: existingNumbers.has((row.tenderNumber ?? "").toLowerCase()),
        valid: Boolean(row.tenderNumber && row.title) && !existingNumbers.has((row.tenderNumber ?? "").toLowerCase())
      }))
    };
  }

  /**
   * Create tenders from CSV text via the standard create() path
   * (audit entries + SharePoint folders per row).
   *
   * Rows missing a number/title, duplicating an existing number, or
   * matching no linked clients are skipped with a reason instead of
   * failing the batch.
   *
   * @param csvText - header row + data rows; naive comma split (no quoted-field support)
   * @returns { createdCount, createdIds, skipped: [{ tenderNumber, reason }] }
   */
  async commitImport(csvText: string, actorId?: string) {
    const rows = this.parseImportCsv(csvText);
    const createdIds: string[] = [];
    const skipped: Array<{ tenderNumber: string; reason: string }> = [];
    const existingNumbers = await this.findExistingTenderNumbers(rows.map((row) => row.tenderNumber).filter(Boolean));

    for (const row of rows) {
      if (!row.tenderNumber || !row.title) {
        skipped.push({ tenderNumber: row.tenderNumber || "(missing)", reason: "Missing tender number or title" });
        continue;
      }

      if (existingNumbers.has(row.tenderNumber.toLowerCase())) {
        skipped.push({ tenderNumber: row.tenderNumber, reason: "Tender number already exists" });
        continue;
      }

      const clientIds = await this.lookupClientIds(row.clientNames);
      if (!clientIds.length) {
        skipped.push({ tenderNumber: row.tenderNumber, reason: "No matching linked clients found" });
        continue;
      }

      const tender = await this.create(
        {
          // CSV import keeps historical register numbers (preserveSuppliedNumber).
          tenderNumber: row.tenderNumber,
          title: row.title,
          description: row.description,
          status: row.status ?? "DRAFT",
          probability: row.probability ? Number(row.probability) : undefined,
          estimatedValue: row.estimatedValue,
          dueDate: row.dueDate,
          proposedStartDate: row.proposedStartDate,
          leadTimeDays: row.leadTimeDays ? Number(row.leadTimeDays) : undefined,
          estimatorUserId: row.estimatorUserId,
          tenderClients: clientIds.map((clientId, index) => ({
            clientId,
            isAwarded: index === 0 && row.awardedClientName
              ? row.awardedClientName.toLowerCase() === row.clientNames[index]?.toLowerCase()
              : false
          })),
          tenderNotes: row.initialNote ? [{ body: row.initialNote }] : undefined,
          followUps: row.followUpDetails && row.followUpDueAt
            ? [{ details: row.followUpDetails, dueAt: row.followUpDueAt, status: "OPEN" }]
            : undefined
        },
        actorId,
        { preserveSuppliedNumber: true }
      );

      createdIds.push(tender.id);
      existingNumbers.add(row.tenderNumber.toLowerCase());
    }

    return {
      createdCount: createdIds.length,
      createdIds,
      skipped
    };
  }

  // Client scoring — increment winCount/tenderCount across every client
  // linked to the tender. Called exactly once per tender (Tender.tenderScoreCounted).
  private async updateClientScores(tenderId: string, isWin: boolean) {
    const links = await this.prisma.tenderClient.findMany({
      where: { tenderId },
      select: { clientId: true }
    });
    if (links.length === 0) return;
    const now = new Date();
    for (const link of links) {
      const client = await this.prisma.client.findUnique({
        where: { id: link.clientId },
        select: { winCount: true, tenderCount: true }
      });
      if (!client) continue;
      const nextTenderCount = client.tenderCount + 1;
      const nextWinCount = client.winCount + (isWin ? 1 : 0);
      const nextWinRate =
        nextTenderCount > 0 ? Number(((nextWinCount / nextTenderCount) * 100).toFixed(2)) : 0;
      await this.prisma.client.update({
        where: { id: link.clientId },
        data: {
          tenderCount: nextTenderCount,
          winCount: nextWinCount,
          winRate: nextWinRate,
          lastTenderAt: now,
          lastWonAt: isWin ? now : undefined
        }
      });
    }
  }

  // Tender previously counted as a loss/submission and is now being won —
  // tenderCount stays put but winCount goes up.
  private async bumpWinCount(tenderId: string) {
    const links = await this.prisma.tenderClient.findMany({
      where: { tenderId },
      select: { clientId: true }
    });
    const now = new Date();
    for (const link of links) {
      const client = await this.prisma.client.findUnique({
        where: { id: link.clientId },
        select: { winCount: true, tenderCount: true }
      });
      if (!client) continue;
      const nextWinCount = client.winCount + 1;
      const nextWinRate =
        client.tenderCount > 0 ? Number(((nextWinCount / client.tenderCount) * 100).toFixed(2)) : 0;
      await this.prisma.client.update({
        where: { id: link.clientId },
        data: { winCount: nextWinCount, winRate: nextWinRate, lastWonAt: now }
      });
    }
  }

  private async ensureUniqueTenderNumber(tenderNumber: string, ignoreId?: string) {
    const existing = await this.prisma.tender.findFirst({
      where: {
        tenderNumber,
        ...(ignoreId ? { NOT: { id: ignoreId } } : {})
      }
    });

    if (existing) {
      throw new ConflictException("Tender number already exists.");
    }
  }

  private validateAwardedClients(tenderClients: NonNullable<UpsertTenderDto["tenderClients"]>) {
    const awarded = tenderClients.filter((item) => item.isAwarded);
    if (awarded.length > 1) {
      throw new BadRequestException("Only one tender client can be marked as awarded.");
    }
  }

  private async ensureTenderExists(tenderId: string) {
    const tender = await this.prisma.tender.findUnique({ where: { id: tenderId }, select: { id: true } });
    if (!tender) {
      throw new NotFoundException("Tender not found.");
    }
  }

  private parseImportCsv(csvText: string) {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return [];
    }

    const headers = lines[0].split(",").map((item) => item.trim());
    return lines.slice(1).map((line) => {
      const values = line.split(",").map((item) => item.trim());
      const record = headers.reduce<Record<string, string>>((accumulator, header, index) => {
        accumulator[header] = values[index] ?? "";
        return accumulator;
      }, {});

      return {
        tenderNumber: record.tenderNumber,
        title: record.title,
        description: record.description,
        status: record.status,
        probability: record.probability,
        estimatedValue: record.estimatedValue,
        dueDate: record.dueDate,
        proposedStartDate: record.proposedStartDate,
        leadTimeDays: record.leadTimeDays,
        clientNames: record.clientNames ? record.clientNames.split("|").map((item) => item.trim()).filter(Boolean) : [],
        awardedClientName: record.awardedClientName,
        estimatorUserId: record.estimatorUserId,
        initialNote: record.initialNote,
        followUpDetails: record.followUpDetails,
        followUpDueAt: record.followUpDueAt
      };
    });
  }

  private async lookupClientIds(clientNames: string[]) {
    const clientIds: string[] = [];

    for (const clientName of clientNames) {
      const client = await this.prisma.client.findFirst({
        where: {
          name: {
            equals: clientName,
            mode: "insensitive"
          }
        },
        select: { id: true }
      });

      if (client) {
        clientIds.push(client.id);
      }
    }

    return clientIds;
  }

  private async findExistingTenderNumbers(tenderNumbers: string[]) {
    if (!tenderNumbers.length) {
      return new Set<string>();
    }

    const existing = await this.prisma.tender.findMany({
      where: {
        tenderNumber: {
          in: tenderNumbers
        }
      },
      select: {
        tenderNumber: true
      }
    });

    return new Set(existing.map((item) => item.tenderNumber.toLowerCase()));
  }

  private toTenderCreateInput(
    dto: UpsertTenderDto,
    actorId?: string
  ): Omit<Prisma.TenderCreateInput, "tenderNumber"> {
    return {
      title: dto.title,
      description: dto.description,
      status: dto.status ?? "DRAFT",
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      proposedStartDate: dto.proposedStartDate ? new Date(dto.proposedStartDate) : undefined,
      leadTimeDays: dto.leadTimeDays,
      probability: dto.probability,
      estimatedValue: dto.estimatedValue ? new Prisma.Decimal(dto.estimatedValue) : undefined,
      notes: dto.notes,
      estimator: dto.estimatorUserId ? { connect: { id: dto.estimatorUserId } } : undefined,
      tenderClients: dto.tenderClients?.length
        ? {
            create: dto.tenderClients.map((item) => ({
              client: { connect: { id: item.clientId } },
              contact: item.contactId ? { connect: { id: item.contactId } } : undefined,
              isAwarded: item.isAwarded ?? false,
              relationshipType: item.relationshipType,
              notes: item.notes
            }))
          }
        : undefined,
      tenderNotes: dto.tenderNotes?.length
        ? {
            create: dto.tenderNotes.map((item) => ({
              body: item.body,
              author: actorId ? { connect: { id: actorId } } : undefined
            }))
          }
        : undefined,
      clarifications: dto.clarifications?.length
        ? {
            create: dto.clarifications.map((item) => ({
              subject: item.subject,
              response: item.response,
              status: item.status ?? "OPEN",
              dueDate: item.dueDate ? new Date(item.dueDate) : undefined
            }))
          }
        : undefined,
      pricingSnapshots: dto.pricingSnapshots?.length
        ? {
            create: dto.pricingSnapshots.map((item) => ({
              versionLabel: item.versionLabel,
              estimatedValue: item.estimatedValue ? new Prisma.Decimal(item.estimatedValue) : undefined,
              marginPercent: item.marginPercent ? new Prisma.Decimal(item.marginPercent) : undefined,
              assumptions: item.assumptions
            }))
          }
        : undefined,
      followUps: dto.followUps?.length
        ? {
            create: dto.followUps.map((item) => ({
              dueAt: new Date(item.dueAt),
              status: item.status ?? "OPEN",
              details: item.details,
              assignedUser: item.assignedUserId ? { connect: { id: item.assignedUserId } } : undefined
            }))
          }
        : undefined,
      outcomes: dto.outcomes?.length
        ? {
            create: dto.outcomes.map((item) => ({
              outcomeType: item.outcomeType,
              notes: item.notes
            }))
          }
        : undefined,
    };
  }

  private toTenderUpdateInput(dto: UpsertTenderDto): Prisma.TenderUpdateInput {
    return {
      title: dto.title,
      description: dto.description,
      status: dto.status ?? "DRAFT",
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      proposedStartDate: dto.proposedStartDate ? new Date(dto.proposedStartDate) : null,
      leadTimeDays: dto.leadTimeDays ?? null,
      probability: dto.probability ?? null,
      estimatedValue: dto.estimatedValue ? new Prisma.Decimal(dto.estimatedValue) : null,
      notes: dto.notes ?? null,
      estimator: dto.estimatorUserId ? { connect: { id: dto.estimatorUserId } } : { disconnect: true }
    };
  }

  private mapTenderActivities(tender: Awaited<ReturnType<TenderingService["getById"]>>) {
    return [
      ...tender.tenderNotes.map((item) => ({
        id: `note:${item.id}`,
        sourceId: item.id,
        activityType: "NOTE",
        title: item.body.split("\n")[0] ?? item.body,
        details: item.body,
        status: "RECORDED",
        dueAt: null,
        completedAt: item.createdAt,
        createdAt: item.createdAt,
        updatedAt: item.createdAt,
        assignedUser: item.author
          ? {
              id: item.author.id,
              firstName: item.author.firstName,
              lastName: item.author.lastName
            }
          : null
      })),
      ...tender.clarifications.map((item) => ({
        id: `clarification:${item.id}`,
        sourceId: item.id,
        activityType: "CLARIFICATION",
        title: item.subject,
        details: item.response ?? item.subject,
        status: item.status,
        dueAt: item.dueDate,
        completedAt: item.status === "CLOSED" ? item.updatedAt : null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        assignedUser: null
      })),
      ...tender.followUps.map((item) => ({
        id: `follow-up:${item.id}`,
        sourceId: item.id,
        activityType: "FOLLOW_UP",
        title: item.details,
        details: item.details,
        status: item.status,
        dueAt: item.dueAt,
        completedAt: item.status === "DONE" ? item.updatedAt : null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        assignedUser: item.assignedUser
          ? {
              id: item.assignedUser.id,
              firstName: item.assignedUser.firstName,
              lastName: item.assignedUser.lastName
            }
          : null
      }))
    ].sort((left, right) => {
      const leftTime = new Date(left.dueAt ?? left.updatedAt ?? left.createdAt).getTime();
      const rightTime = new Date(right.dueAt ?? right.updatedAt ?? right.createdAt).getTime();
      return rightTime - leftTime;
    });
  }
}
