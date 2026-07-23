import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class TenderClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async addClient(tenderId: string, clientId: string, relationshipType?: string) {
    await this.requireTender(tenderId);
    const client = await this.prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) throw new NotFoundException("Client not found.");
    const existing = await this.prisma.tenderClient.findFirst({
      where: { tenderId, clientId }
    });
    if (existing) {
      throw new ConflictException("Client is already linked to this tender.");
    }
    await this.prisma.tenderClient.create({
      data: {
        tenderId,
        clientId,
        ...(relationshipType ? { relationshipType } : {})
      }
    });
    return this.listClients(tenderId);
  }

  async removeClient(tenderId: string, clientId: string) {
    await this.requireTender(tenderId);
    const existing = await this.prisma.tenderClient.findFirst({ where: { tenderId, clientId } });
    if (!existing) throw new NotFoundException("Client is not linked to this tender.");
    const remaining = await this.prisma.tenderClient.count({ where: { tenderId } });
    if (remaining <= 1) {
      throw new BadRequestException("A tender must have at least one client.");
    }
    // TenderClient → JobConversion is onDelete: Cascade in schema.prisma. If
    // this client has already been converted to a Job, a raw delete would
    // silently drop the JobConversion row (and any TenderClientPackage
    // rows) that ties the tender to the resulting Job. Refuse instead.
    const conversion = await this.prisma.jobConversion.findUnique({
      where: { tenderClientId: existing.id },
      select: { id: true }
    });
    if (conversion) {
      throw new BadRequestException(
        "This client has been converted to a job and cannot be removed from the tender."
      );
    }
    await this.prisma.tenderClient.delete({ where: { id: existing.id } });
    await this.audit.write({
      action: "tenders.client.remove",
      entityType: "TenderClient",
      entityId: existing.id,
      metadata: { tenderId, clientId }
    });
    return this.listClients(tenderId);
  }

  async listClients(tenderId: string) {
    await this.requireTender(tenderId);
    return this.prisma.tenderClient.findMany({
      where: { tenderId },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } }
      },
      orderBy: { id: "asc" }
    });
  }

  async searchClients(q: string) {
    const term = q?.trim() ?? "";
    if (term.length < 1) return [];
    const rows = await this.prisma.client.findMany({
      where: {
        status: "ACTIVE",
        name: { contains: term, mode: "insensitive" }
      },
      take: 10,
      orderBy: { name: "asc" }
    });
    // Contacts are now polymorphic — fetch the first per matched client in a
    // single batched query.
    const clientIds = rows.map((c) => c.id);
    const primaryContacts = clientIds.length
      ? await this.prisma.contact.findMany({
          where: {
            organisationType: "CLIENT",
            organisationId: { in: clientIds },
            isActive: true
          },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
        })
      : [];
    const byClient = new Map<string, (typeof primaryContacts)[number]>();
    for (const c of primaryContacts) {
      if (!byClient.has(c.organisationId)) byClient.set(c.organisationId, c);
    }
    return rows.map((c) => {
      const contact = byClient.get(c.id);
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        contactName: contact ? `${contact.firstName} ${contact.lastName}`.trim() : null
      };
    });
  }

  private async requireTender(tenderId: string) {
    const t = await this.prisma.tender.findUnique({ where: { id: tenderId }, select: { id: true } });
    if (!t) throw new NotFoundException("Tender not found.");
    return t;
  }
}
