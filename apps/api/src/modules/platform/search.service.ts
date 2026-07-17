import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RegisterSearchEntryDto } from "./dto/register-search-entry.dto";

export type RelevanceResult = {
  entityType: "Job" | "Tender" | "Client" | "Contact" | "Contract" | "Asset";
  entityId: string;
  title: string;
  subtitle?: string | null;
  url: string;
};

// Entity-to-permission map. A user without the permission never sees results
// from that entity — the search must not become a permission bypass.
const ENTITY_PERMISSIONS: Record<RelevanceResult["entityType"], string> = {
  Job: "jobs.view",
  Tender: "tenders.view",
  Client: "directory.view",
  Contact: "directory.view",
  Contract: "finance.view",
  Asset: "assets.view"
};

const PER_ENTITY_LIMIT = 5;
const MIN_QUERY_LENGTH = 2;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  register(input: RegisterSearchEntryDto) {
    return this.prisma.searchEntry.upsert({
      where: {
        id: `${input.entityType}:${input.entityId}`
      },
      update: {
        title: input.title,
        subtitle: input.subtitle,
        body: input.body,
        module: input.module,
        url: input.url
      },
      create: {
        id: `${input.entityType}:${input.entityId}`,
        entityType: input.entityType,
        entityId: input.entityId,
        title: input.title,
        subtitle: input.subtitle,
        body: input.body,
        module: input.module,
        url: input.url
      }
    });
  }

  search(query?: string) {
    return this.prisma.searchEntry.findMany({
      where: query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { subtitle: { contains: query, mode: "insensitive" } },
              { body: { contains: query, mode: "insensitive" } },
              { module: { contains: query, mode: "insensitive" } }
            ]
          }
        : undefined,
      orderBy: [{ module: "asc" }, { title: "asc" }],
      take: 25
    });
  }

  // D365-parity relevance search across live entity tables. Unlike search()
  // above (which reads a registered index), this hits the source tables so
  // freshly-created rows show up immediately. Permission-filtered per entity.
  async searchRelevance(query: string, permissions: string[]): Promise<RelevanceResult[]> {
    const q = query?.trim();
    if (!q || q.length < MIN_QUERY_LENGTH) return [];
    const has = (perm: string) => permissions.includes(perm);
    const allow = (entity: RelevanceResult["entityType"]) => has(ENTITY_PERMISSIONS[entity]);

    const insensitive = { contains: q, mode: "insensitive" as const };
    const results: RelevanceResult[] = [];

    if (allow("Job")) {
      const jobs = await this.prisma.job.findMany({
        where: {
          OR: [
            { name: insensitive },
            { jobNumber: insensitive },
            { description: insensitive }
          ]
        },
        select: { id: true, name: true, jobNumber: true, status: true },
        take: PER_ENTITY_LIMIT,
        orderBy: { updatedAt: "desc" }
      });
      for (const j of jobs) {
        results.push({
          entityType: "Job",
          entityId: j.id,
          title: j.name,
          subtitle: `${j.jobNumber} • ${j.status}`,
          url: `/jobs?highlight=${encodeURIComponent(j.id)}`
        });
      }
    }

    if (allow("Tender")) {
      const tenders = await this.prisma.tender.findMany({
        where: {
          OR: [
            { title: insensitive },
            { tenderNumber: insensitive },
            { description: insensitive }
          ]
        },
        select: { id: true, title: true, tenderNumber: true, status: true },
        take: PER_ENTITY_LIMIT,
        orderBy: { updatedAt: "desc" }
      });
      for (const t of tenders) {
        results.push({
          entityType: "Tender",
          entityId: t.id,
          title: t.title,
          subtitle: `${t.tenderNumber} • ${t.status}`,
          url: `/tenders?highlight=${encodeURIComponent(t.id)}`
        });
      }
    }

    if (allow("Client")) {
      const clients = await this.prisma.client.findMany({
        where: {
          OR: [
            { name: insensitive },
            { code: insensitive },
            { tradingName: insensitive },
            { email: insensitive }
          ]
        },
        select: { id: true, name: true, code: true, status: true },
        take: PER_ENTITY_LIMIT,
        orderBy: { name: "asc" }
      });
      for (const c of clients) {
        results.push({
          entityType: "Client",
          entityId: c.id,
          title: c.name,
          subtitle: c.code ? `${c.code} • ${c.status}` : c.status,
          url: `/master-data?tab=clients&highlight=${encodeURIComponent(c.id)}`
        });
      }
    }

    if (allow("Contact")) {
      const contacts = await this.prisma.contact.findMany({
        where: {
          isActive: true,
          OR: [
            { firstName: insensitive },
            { lastName: insensitive },
            { email: insensitive },
            { phone: insensitive },
            { mobile: insensitive }
          ]
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true
        },
        take: PER_ENTITY_LIMIT,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      });
      for (const c of contacts) {
        const name = `${c.firstName} ${c.lastName}`.trim();
        const subtitleParts = [c.role, c.email].filter(Boolean);
        results.push({
          entityType: "Contact",
          entityId: c.id,
          title: name || (c.email ?? "Contact"),
          subtitle: subtitleParts.join(" • ") || null,
          url: `/directory/contacts?highlight=${encodeURIComponent(c.id)}`
        });
      }
    }

    if (allow("Contract")) {
      const contracts = await this.prisma.contract.findMany({
        where: {
          OR: [
            { contractNumber: insensitive },
            { notes: insensitive }
          ]
        },
        select: { id: true, contractNumber: true, status: true },
        take: PER_ENTITY_LIMIT,
        orderBy: { updatedAt: "desc" }
      });
      for (const c of contracts) {
        results.push({
          entityType: "Contract",
          entityId: c.id,
          title: c.contractNumber,
          subtitle: String(c.status),
          url: `/contracts?highlight=${encodeURIComponent(c.id)}`
        });
      }
    }

    if (allow("Asset")) {
      const assets = await this.prisma.asset.findMany({
        where: {
          OR: [
            { name: insensitive },
            { assetCode: insensitive },
            { serialNumber: insensitive },
            { barcode: insensitive }
          ]
        },
        select: {
          id: true,
          name: true,
          assetCode: true,
          status: true,
          currentLocation: true
        },
        take: PER_ENTITY_LIMIT,
        orderBy: { name: "asc" }
      });
      for (const a of assets) {
        results.push({
          entityType: "Asset",
          entityId: a.id,
          title: a.name,
          subtitle: `${a.assetCode} • ${a.status}${a.currentLocation ? ` • ${a.currentLocation}` : ""}`,
          url: `/assets?highlight=${encodeURIComponent(a.id)}`
        });
      }
    }

    return results;
  }
}
