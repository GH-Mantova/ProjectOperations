import { ConflictException, Injectable } from "@nestjs/common";
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

@Injectable()
export class MasterDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async listClients(query: MasterDataQueryDto) {
    return this.paginate(query, () =>
      this.prisma.client.findMany({
        where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : undefined,
        include: { contacts: true, sites: true },
        orderBy: { name: "asc" }
      }),
      () =>
        this.prisma.client.count({
          where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : undefined
        })
    );
  }

  async upsertClient(id: string | undefined, dto: UpsertClientDto, actorId?: string) {
    await this.ensureUniqueName("client", dto.name, id);
    const record = id
      ? await this.prisma.client.update({ where: { id }, data: dto })
      : await this.prisma.client.create({ data: dto });
    await this.audit(actorId, id ? "masterdata.client.update" : "masterdata.client.create", "Client", record.id);
    return record;
  }

  async listContacts(query: MasterDataQueryDto) {
    return this.paginate(query, () =>
      this.prisma.contact.findMany({
        where: query.q
          ? {
              OR: [
                { firstName: { contains: query.q, mode: "insensitive" } },
                { lastName: { contains: query.q, mode: "insensitive" } }
              ]
            }
          : undefined,
        include: { client: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      }),
      () =>
        this.prisma.contact.count({
          where: query.q
            ? {
                OR: [
                  { firstName: { contains: query.q, mode: "insensitive" } },
                  { lastName: { contains: query.q, mode: "insensitive" } }
                ]
              }
            : undefined
        })
    );
  }

  async upsertContact(id: string | undefined, dto: UpsertContactDto, actorId?: string) {
    const record = id
      ? await this.prisma.contact.update({ where: { id }, data: dto })
      : await this.prisma.contact.create({ data: dto });
    await this.audit(actorId, id ? "masterdata.contact.update" : "masterdata.contact.create", "Contact", record.id);
    return record;
  }

  async listSites(query: MasterDataQueryDto) {
    return this.paginate(query, () =>
      this.prisma.site.findMany({
        where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : undefined,
        include: { client: true },
        orderBy: { name: "asc" }
      }),
      () =>
        this.prisma.site.count({
          where: query.q ? { name: { contains: query.q, mode: "insensitive" } } : undefined
        })
    );
  }

  async upsertSite(id: string | undefined, dto: UpsertSiteDto, actorId?: string) {
    await this.ensureUniqueName("site", dto.name, id);
    const record = id
      ? await this.prisma.site.update({ where: { id }, data: dto })
      : await this.prisma.site.create({ data: dto });
    await this.audit(actorId, id ? "masterdata.site.update" : "masterdata.site.create", "Site", record.id);
    return record;
  }

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

  async upsertResourceType(id: string | undefined, dto: UpsertResourceTypeDto, actorId?: string) {
    const record = id
      ? await this.prisma.resourceType.update({ where: { id }, data: dto })
      : await this.prisma.resourceType.create({ data: dto });
    await this.audit(actorId, id ? "masterdata.resource-type.update" : "masterdata.resource-type.create", "ResourceType", record.id);
    return record;
  }

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

  async upsertCompetency(id: string | undefined, dto: UpsertCompetencyDto, actorId?: string) {
    const record = id
      ? await this.prisma.competency.update({ where: { id }, data: dto })
      : await this.prisma.competency.create({ data: dto });
    await this.audit(actorId, id ? "masterdata.competency.update" : "masterdata.competency.create", "Competency", record.id);
    return record;
  }

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

  async upsertWorker(id: string | undefined, dto: UpsertWorkerDto, actorId?: string) {
    const record = id
      ? await this.prisma.worker.update({ where: { id }, data: dto })
      : await this.prisma.worker.create({ data: dto });
    await this.audit(actorId, id ? "masterdata.worker.update" : "masterdata.worker.create", "Worker", record.id);
    return record;
  }

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

  async upsertAsset(id: string | undefined, dto: UpsertAssetDto, actorId?: string) {
    const record = id
      ? await this.prisma.asset.update({ where: { id }, data: dto })
      : await this.prisma.asset.create({ data: dto });
    await this.audit(actorId, id ? "masterdata.asset.update" : "masterdata.asset.create", "Asset", record.id);
    return record;
  }

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
}
