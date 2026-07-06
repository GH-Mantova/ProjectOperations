import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { MasterDataQueryDto } from "./dto/master-data-query.dto";
import {
  UpsertAssetDto,
  UpsertClientDto,
  UpsertCompetencyDto,
  UpsertContactDto,
  UpsertCrewDto,
  UpsertLookupValueDto,
  UpsertResourceTypeDto,
  UpsertSiteDto,
  UpsertWorkerCompetencyDto,
  UpsertWorkerDto
} from "./dto/master-data.dto";

/**
 * Service layer for the master-data module — clients, contacts, sites,
 * resource types, competencies, workers, crews, assets, worker-competencies,
 * and lookup values.
 *
 * Every `upsert*` method writes an entry via {@link AuditService} so that
 * record-level changes are attributable to an actor. List methods share a
 * common pagination helper and accept the same `q` text-search query DTO.
 */
@Injectable()
export class MasterDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  /**
   * Paginated list of clients, with each client's sites and claim-reminder user included.
   *
   * Polymorphic contacts are hydrated in a follow-up query and attached as
   * `client.contacts` so callers that relied on the old Client.contacts reverse
   * relation (before contacts became polymorphic on organisationType/organisationId)
   * keep working unchanged.
   *
   * @param query Pagination + optional `q` substring matched against `name` (case-insensitive).
   */
  async listClients(query: MasterDataQueryDto) {
    const result = await this.paginate(query, () =>
      this.prisma.client.findMany({
        where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : undefined,
        include: { sites: true, claimReminderUser: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { name: "asc" }
      }),
      () =>
        this.prisma.client.count({
          where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : undefined
        })
    );
    // Hydrate polymorphic contacts in a single query so callers that relied on
    // the old Client.contacts reverse relation keep working.
    const clientIds = result.items.map((c) => c.id);
    const contacts = clientIds.length
      ? await this.prisma.contact.findMany({
          where: { organisationType: "CLIENT", organisationId: { in: clientIds } },
          orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }]
        })
      : [];
    const byOrg = new Map<string, typeof contacts>();
    for (const c of contacts) {
      const list = byOrg.get(c.organisationId) ?? [];
      list.push(c);
      byOrg.set(c.organisationId, list);
    }
    result.items = result.items.map((c) => ({ ...c, contacts: byOrg.get(c.id) ?? [] })) as never;
    return result;
  }

  /**
   * Create a client (when `id` is undefined) or update one in place.
   *
   * Enforces unique client `name` and the Xero `paymentTermsDay` / `paymentTermsType`
   * pair invariant (see {@link assertPaymentTermsPair}). Writes an audit entry on success.
   *
   * @param id Client id to update, or `undefined` to create a new client.
   * @param dto Full or partial client payload (PATCH semantics on update).
   * @param actorId User id recorded against the audit entry.
   * @throws ConflictException When another client already uses `dto.name`.
   * @throws BadRequestException When the payment-terms pair is partially specified.
   */
  async upsertClient(id: string | undefined, dto: UpsertClientDto, actorId?: string) {
    await this.ensureUniqueName("client", dto.name, id);
    this.assertPaymentTermsPair(dto);
    const record = id
      ? await this.prisma.client.update({ where: { id }, data: dto })
      : await this.prisma.client.create({ data: dto });
    await this.audit(actorId, id ? "masterdata.client.update" : "masterdata.client.create", "Client", record.id);
    return record;
  }

  /**
   * Paginated list of CLIENT-owned contacts, optionally filtered to one client.
   *
   * Contact is a polymorphic table (organisationType + organisationId); this
   * method scopes to `organisationType = "CLIENT"` and hydrates a small client
   * summary (`id`, `name`, `code`, `status`) onto each row so callers keep the
   * legacy `contact.client` shape. Search matches first/last name (case-insensitive).
   */
  async listContacts(query: MasterDataQueryDto & { clientId?: string }) {
    const searchClause = query.q
      ? [
          { firstName: { contains: query.q, mode: "insensitive" as const } },
          { lastName: { contains: query.q, mode: "insensitive" as const } }
        ]
      : null;
    const where: Record<string, unknown> = { organisationType: "CLIENT" };
    if (query.clientId) where.organisationId = query.clientId;
    if (searchClause) where.OR = searchClause;

    const result = await this.paginate(query, () =>
      this.prisma.contact.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      }),
      () => this.prisma.contact.count({ where })
    );
    // Hydrate client summaries so callers keep the `contact.client` shape.
    const clientIds = Array.from(new Set(result.items.map((c) => c.organisationId)));
    const clients = clientIds.length
      ? await this.prisma.client.findMany({
          where: { id: { in: clientIds } },
          select: { id: true, name: true, code: true, status: true }
        })
      : [];
    const byId = new Map(clients.map((c) => [c.id, c]));
    result.items = result.items.map((c) => ({
      ...c,
      clientId: c.organisationId,
      client: byId.get(c.organisationId) ?? null
    })) as never;
    return result;
  }

  /**
   * Create or update a CLIENT-owned contact and write an audit entry.
   *
   * On create, the contact is anchored to `dto.clientId` via the polymorphic
   * organisationType/organisationId key. The deprecated `dto.position` field
   * is mapped to `role` if `dto.role` is not supplied.
   *
   * `includeInInvoiceEmails` is only written when explicitly present in the
   * DTO so PATCH bodies that omit the key do not overwrite the stored value.
   *
   * @param id Contact id to update, or `undefined` to create a new contact.
   * @param actorId Recorded both as the audit actor and (on create) as `createdById`.
   */
  async upsertContact(id: string | undefined, dto: UpsertContactDto, actorId?: string) {
    const baseData = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.position ?? dto.role ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      mobile: dto.mobile ?? null,
      isPrimary: dto.isPrimary ?? false,
      hasPortalAccess: dto.hasPortalAccess ?? false,
      notes: dto.notes ?? null,
      ...(dto.includeInInvoiceEmails !== undefined
        ? { includeInInvoiceEmails: dto.includeInInvoiceEmails }
        : {})
    };

    if (!id) {
      const record = await this.prisma.contact.create({
        data: {
          ...baseData,
          organisationType: "CLIENT",
          organisationId: dto.clientId,
          createdById: actorId ?? null
        }
      });
      await this.audit(actorId, "masterdata.contact.create", "Contact", record.id);
      return record;
    }

    const record = await this.prisma.contact.update({
      where: { id },
      data: baseData
    });
    await this.audit(actorId, "masterdata.contact.update", "Contact", record.id);
    return record;
  }

  /**
   * Paginated list of sites with each site's owning client included.
   * Search matches `name` (case-insensitive).
   */
  async listSites(query: MasterDataQueryDto) {
    return this.paginate(query, () =>
      this.prisma.site.findMany({
        where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : undefined,
        include: { client: true, _count: { select: { jobs: true } } },
        orderBy: { name: "asc" }
      }),
      () =>
        this.prisma.site.count({
          where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : undefined
        })
    );
  }

  /**
   * Create or update a site. Enforces unique site `name` and writes an audit entry.
   *
   * @param id Site id to update, or `undefined` to create a new site.
   * @throws ConflictException When another site already uses `dto.name`.
   */
  async upsertSite(id: string | undefined, dto: UpsertSiteDto, actorId?: string) {
    await this.ensureUniqueName("site", dto.name, id);
    const record = id
      ? await this.prisma.site.update({ where: { id }, data: dto })
      : await this.prisma.site.create({ data: dto });
    await this.audit(actorId, id ? "masterdata.site.update" : "masterdata.site.create", "Site", record.id);
    return record;
  }

  /**
   * Return one site with its linked tenders (up to 50, newest first) and the
   * de-duplicated projects reached through those tenders, or `null` if the
   * site does not exist.
   *
   * Tenders are matched either by the new `siteId` FK or — for legacy tenders
   * that pre-date the FK — by a case-insensitive substring match of the site's
   * suburb in `tender.notes`. Projects come from `tender.projects` and are
   * unioned across all matching tenders, so the same project appears once even
   * when reachable via multiple tenders.
   *
   * @returns The site augmented with `tenders` and `projects`, or `null` when not found.
   */
  async getSite(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: { client: { select: { id: true, name: true } } }
    });
    if (!site) return null;
    const tenders = await this.prisma.tender.findMany({
      where: {
        OR: [
          { siteId: id },
          ...(site.suburb ? [{ notes: { contains: site.suburb, mode: "insensitive" as const } }] : [])
        ]
      },
      select: {
        id: true,
        tenderNumber: true,
        title: true,
        status: true,
        dueDate: true,
        projects: { select: { id: true, projectNumber: true, name: true, status: true, plannedStartDate: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    const projectsMap = new Map<string, { id: string; projectNumber: string; name: string; status: string; plannedStartDate: Date | null }>();
    for (const t of tenders) {
      for (const p of t.projects) projectsMap.set(p.id, p);
    }
    return {
      ...site,
      tenders: tenders.map((t) => ({ ...t, projects: undefined })),
      projects: Array.from(projectsMap.values())
    };
  }

  /**
   * Delete a site by id, refusing the delete when the site has linked tenders,
   * linked jobs (jobs are "projects" in the delivery domain), or linked form
   * submissions (WHS/compliance evidence — incidents, hazard observations,
   * safety checks — whose audit trail would be broken if the site link were
   * nulled). Returns 409 Conflict with a message listing the blocking entity
   * counts so the caller can unlink/delete them first. No cascade — referential
   * history is preserved.
   *
   * @throws NotFoundException When no site with that id exists.
   * @throws ConflictException When the site has linked tenders, jobs, or form submissions.
   */
  async deleteSite(id: string, actorId?: string): Promise<void> {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: { _count: { select: { tenders: true, jobs: true, formSubmissions: true } } }
    });
    if (!site) throw new NotFoundException(`Site ${id} not found`);

    const blockers: string[] = [];
    if (site._count.tenders > 0) blockers.push(`${site._count.tenders} linked tender(s)`);
    if (site._count.jobs > 0) blockers.push(`${site._count.jobs} linked job(s)`);
    if (site._count.formSubmissions > 0) {
      blockers.push(`${site._count.formSubmissions} linked form submission(s)`);
    }

    if (blockers.length > 0) {
      throw new ConflictException(
        `Cannot delete site: ${blockers.join(", ")}. Unlink or delete those first.`
      );
    }

    await this.prisma.site.delete({ where: { id } });
    await this.audit(actorId, "masterdata.site.delete", "Site", id);
  }

  /**
   * Paginated list of resource types. Search matches `name` (case-insensitive).
   */
  async listResourceTypes(query: MasterDataQueryDto) {
    return this.paginate(query, () =>
      this.prisma.resourceType.findMany({
        where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : undefined,
        orderBy: { name: "asc" }
      }),
      () =>
        this.prisma.resourceType.count({
          where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : undefined
        })
    );
  }

  /**
   * Create or update a resource type and write an audit entry.
   * @param id Resource-type id to update, or `undefined` to create.
   */
  async upsertResourceType(id: string | undefined, dto: UpsertResourceTypeDto, actorId?: string) {
    const record = id
      ? await this.prisma.resourceType.update({ where: { id }, data: dto })
      : await this.prisma.resourceType.create({ data: dto });
    await this.audit(actorId, id ? "masterdata.resource-type.update" : "masterdata.resource-type.create", "ResourceType", record.id);
    return record;
  }

  /**
   * Paginated list of competencies with their worker-competency assignments included.
   * Search matches `name` (case-insensitive).
   */
  async listCompetencies(query: MasterDataQueryDto) {
    return this.paginate(query, () =>
      this.prisma.competency.findMany({
        where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : undefined,
        include: { workerCompetencies: true },
        orderBy: { name: "asc" }
      }),
      () =>
        this.prisma.competency.count({
          where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : undefined
        })
    );
  }

  /**
   * Create or update a competency definition and write an audit entry.
   * @param id Competency id to update, or `undefined` to create.
   */
  async upsertCompetency(id: string | undefined, dto: UpsertCompetencyDto, actorId?: string) {
    const record = id
      ? await this.prisma.competency.update({ where: { id }, data: dto })
      : await this.prisma.competency.create({ data: dto });
    await this.audit(actorId, id ? "masterdata.competency.update" : "masterdata.competency.create", "Competency", record.id);
    return record;
  }

  /**
   * Paginated list of workers with their resource type and competency assignments.
   * Search matches `firstName`, `lastName`, or `employeeCode` (case-insensitive).
   */
  async listWorkers(query: MasterDataQueryDto) {
    return this.paginate(query, () =>
      this.prisma.worker.findMany({
        where: query.q
          ? {
              OR: [
                { firstName: { contains: query.q, mode: "insensitive" } },
                { lastName: { contains: query.q, mode: "insensitive" } },
                { employeeCode: { contains: query.q, mode: "insensitive" } }
              ]
            }
          : undefined,
        include: { resourceType: true, competencies: { include: { competency: true } } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      }),
      () =>
        this.prisma.worker.count({
          where: query.q
            ? {
                OR: [
                  { firstName: { contains: query.q, mode: "insensitive" } },
                  { lastName: { contains: query.q, mode: "insensitive" } },
                  { employeeCode: { contains: query.q, mode: "insensitive" } }
                ]
              }
            : undefined
        })
    );
  }

  /**
   * Create or update a worker record and write an audit entry.
   * @param id Worker id to update, or `undefined` to create.
   */
  async upsertWorker(id: string | undefined, dto: UpsertWorkerDto, actorId?: string) {
    const record = id
      ? await this.prisma.worker.update({ where: { id }, data: dto })
      : await this.prisma.worker.create({ data: dto });
    await this.audit(actorId, id ? "masterdata.worker.update" : "masterdata.worker.create", "Worker", record.id);
    return record;
  }

  /**
   * Paginated list of crews with their members (each `CrewWorker` joined to its `Worker`).
   * Search matches crew `name` (case-insensitive).
   */
  async listCrews(query: MasterDataQueryDto) {
    return this.paginate(query, () =>
      this.prisma.crew.findMany({
        where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : undefined,
        include: { members: { include: { worker: true } } },
        orderBy: { name: "asc" }
      }),
      () =>
        this.prisma.crew.count({
          where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : undefined
        })
    );
  }

  /**
   * Create or update a crew and (optionally) replace its member list wholesale.
   *
   * When `dto.workerIds` is supplied, existing `CrewWorker` rows for this crew
   * are deleted and recreated to match — pass `[]` to remove every member, or
   * omit `workerIds` to leave the membership untouched. Unique-name enforcement
   * only runs on create (renaming an existing crew is allowed). Writes an audit entry.
   *
   * @param id Crew id to update, or `undefined` to create.
   * @throws ConflictException When creating a crew whose `name` already exists.
   */
  async upsertCrew(id: string | undefined, dto: UpsertCrewDto, actorId?: string) {
    if (!id) {
      await this.ensureUniqueName("crew", dto.name);
    }
    const record = id
      ? await this.prisma.crew.update({
          where: { id },
          data: {
            name: dto.name,
            code: dto.code,
            description: dto.description,
            status: dto.status
          }
        })
      : await this.prisma.crew.create({
          data: {
            name: dto.name,
            code: dto.code,
            description: dto.description,
            status: dto.status
          }
        });

    if (dto.workerIds) {
      await this.prisma.crewWorker.deleteMany({ where: { crewId: record.id } });
      if (dto.workerIds.length) {
        await this.prisma.crewWorker.createMany({
          data: dto.workerIds.map((workerId) => ({ crewId: record.id, workerId }))
        });
      }
    }

    await this.audit(actorId, id ? "masterdata.crew.update" : "masterdata.crew.create", "Crew", record.id);
    return record;
  }

  /**
   * Paginated list of assets with their resource type included.
   * Search matches `name` or `assetCode` (case-insensitive).
   */
  async listAssets(query: MasterDataQueryDto) {
    return this.paginate(query, () =>
      this.prisma.asset.findMany({
        where: query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: "insensitive" } },
                { assetCode: { contains: query.q, mode: "insensitive" } }
              ]
            }
          : undefined,
        include: { resourceType: true },
        orderBy: { name: "asc" }
      }),
      () =>
        this.prisma.asset.count({
          where: query.q
            ? {
                OR: [
                  { name: { contains: query.q, mode: "insensitive" } },
                  { assetCode: { contains: query.q, mode: "insensitive" } }
                ]
              }
            : undefined
        })
    );
  }

  /**
   * Create or update an asset and write an audit entry.
   * @param id Asset id to update, or `undefined` to create.
   */
  async upsertAsset(id: string | undefined, dto: UpsertAssetDto, actorId?: string) {
    const record = id
      ? await this.prisma.asset.update({ where: { id }, data: dto })
      : await this.prisma.asset.create({ data: dto });
    await this.audit(actorId, id ? "masterdata.asset.update" : "masterdata.asset.create", "Asset", record.id);
    return record;
  }

  /**
   * Paginated list of worker-competency assignments, newest first.
   * Search matches the joined worker's first/last name or the competency name
   * (case-insensitive).
   */
  async listWorkerCompetencies(query: MasterDataQueryDto) {
    return this.paginate(query, () =>
      this.prisma.workerCompetency.findMany({
        where: query.q
          ? {
              OR: [
                { worker: { firstName: { contains: query.q, mode: "insensitive" } } },
                { worker: { lastName: { contains: query.q, mode: "insensitive" } } },
                { competency: { name: { contains: query.q, mode: "insensitive" } } }
              ]
            }
          : undefined,
        include: { worker: true, competency: true },
        orderBy: { createdAt: "desc" }
      }),
      () =>
        this.prisma.workerCompetency.count({
          where: query.q
            ? {
                OR: [
                  { worker: { firstName: { contains: query.q, mode: "insensitive" } } },
                  { worker: { lastName: { contains: query.q, mode: "insensitive" } } },
                  { competency: { name: { contains: query.q, mode: "insensitive" } } }
                ]
              }
            : undefined
        })
    );
  }

  /**
   * Create or update a worker-competency assignment and write an audit entry.
   *
   * `achievedAt` and `expiresAt` arrive as ISO date strings on the DTO and are
   * coerced to `Date` here so the underlying Prisma timestamp columns receive
   * the correct type.
   *
   * @param id Worker-competency id to update, or `undefined` to create.
   */
  async upsertWorkerCompetency(id: string | undefined, dto: UpsertWorkerCompetencyDto, actorId?: string) {
    const data = {
      workerId: dto.workerId,
      competencyId: dto.competencyId,
      achievedAt: dto.achievedAt ? new Date(dto.achievedAt) : undefined,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      notes: dto.notes
    };

    const record = id
      ? await this.prisma.workerCompetency.update({ where: { id }, data })
      : await this.prisma.workerCompetency.create({ data });
    await this.audit(actorId, id ? "masterdata.worker-competency.update" : "masterdata.worker-competency.create", "WorkerCompetency", record.id);
    return record;
  }

  /**
   * Paginated list of lookup values ordered by `category` then `sortOrder`.
   * Search matches `category`, `key`, or `value` (case-insensitive).
   */
  async listLookupValues(query: MasterDataQueryDto) {
    return this.paginate(query, () =>
      this.prisma.lookupValue.findMany({
        where: query.q
          ? {
              OR: [
                { category: { contains: query.q, mode: "insensitive" } },
                { key: { contains: query.q, mode: "insensitive" } },
                { value: { contains: query.q, mode: "insensitive" } }
              ]
            }
          : undefined,
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }]
      }),
      () =>
        this.prisma.lookupValue.count({
          where: query.q
            ? {
                OR: [
                  { category: { contains: query.q, mode: "insensitive" } },
                  { key: { contains: query.q, mode: "insensitive" } },
                  { value: { contains: query.q, mode: "insensitive" } }
                ]
              }
            : undefined
        })
    );
  }

  /**
   * Create or update a lookup-value row and write an audit entry.
   * @param id Lookup-value id to update, or `undefined` to create.
   */
  async upsertLookupValue(id: string | undefined, dto: UpsertLookupValueDto, actorId?: string) {
    const record = id
      ? await this.prisma.lookupValue.update({ where: { id }, data: dto })
      : await this.prisma.lookupValue.create({ data: dto });
    await this.audit(actorId, id ? "masterdata.lookup.update" : "masterdata.lookup.create", "LookupValue", record.id);
    return record;
  }

  private async paginate<T>(query: MasterDataQueryDto, fetch: () => Promise<T[]>, count: () => Promise<number>) {
    const allItems = await fetch();
    const total = await count();
    const start = (query.page - 1) * query.pageSize;

    return {
      items: allItems.slice(start, start + query.pageSize),
      total,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  private async ensureUniqueName(type: "client" | "site" | "crew", name: string, id?: string) {
    const where = {
      name,
      ...(id ? { NOT: { id } } : {})
    };
    const existing =
      type === "client"
        ? await this.prisma.client.findFirst({ where })
        : type === "site"
          ? await this.prisma.site.findFirst({ where })
          : await this.prisma.crew.findFirst({ where });
    if (existing) {
      throw new ConflictException(`${type} with that name already exists.`);
    }
  }

  private audit(actorId: string | undefined, action: string, entityType: string, entityId: string) {
    return this.auditService.write({ actorId, action, entityType, entityId });
  }

  // Xero alignment (PR-40) — `paymentTermsDay` + `paymentTermsType` are a
  // semantic pair: a day without a type or a type without a day is
  // meaningless. Enforced at the service layer rather than via a CHECK
  // constraint so partial PATCH bodies that touch neither field still pass.
  //
  // We check KEY PRESENCE (`!== undefined`) rather than non-nullness because
  // a PATCH body of `{paymentTermsDay: null}` is an explicit clear that needs
  // to be paired with `paymentTermsType: null` — otherwise Prisma writes the
  // single null and leaves the other half of the pair behind, violating the
  // invariant. Per Codex review on PR #277.
  private assertPaymentTermsPair(dto: {
    paymentTermsDay?: number | null;
    paymentTermsType?: string | null;
  }) {
    const dayInDto = dto.paymentTermsDay !== undefined;
    const typeInDto = dto.paymentTermsType !== undefined;

    // Rule 1: touch both, or neither. Touching only one (even with null) is
    // ambiguous — reject so the caller has to be explicit.
    if (dayInDto !== typeInDto) {
      throw new BadRequestException(
        "paymentTermsDay and paymentTermsType must be set together. Pass both fields (each may be null to clear the pair)."
      );
    }

    // Rule 2: if both keys are present, both must be null (clear) or both
    // must hold meaningful values (set). Mismatched null vs value is the
    // same ambiguity as Rule 1.
    if (dayInDto && typeInDto) {
      const dayMeaningful = dto.paymentTermsDay !== null;
      const typeMeaningful = dto.paymentTermsType !== null && dto.paymentTermsType !== "";
      if (dayMeaningful !== typeMeaningful) {
        throw new BadRequestException(
          "paymentTermsDay and paymentTermsType must be set together (both with values, or both null to clear)."
        );
      }
    }
  }
}
