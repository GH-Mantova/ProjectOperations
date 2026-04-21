import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TenderClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async addClient(tenderId: string, clientId: string) {
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
      data: { tenderId, clientId }
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
    await this.prisma.tenderClient.delete({ where: { id: existing.id } });
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
      include: {
        contacts: {
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { firstName: true, lastName: true, email: true }
        }
      },
      take: 10,
      orderBy: { name: "asc" }
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      contactName: c.contacts[0]
        ? `${c.contacts[0].firstName} ${c.contacts[0].lastName}`.trim()
        : null
    }));
  }

  private async requireTender(tenderId: string) {
    const t = await this.prisma.tender.findUnique({ where: { id: tenderId }, select: { id: true } });
    if (!t) throw new NotFoundException("Tender not found.");
    return t;
  }
}
