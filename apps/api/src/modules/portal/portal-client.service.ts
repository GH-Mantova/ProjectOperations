import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PortalClientService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(clientId: string) {
    const [activeProjects, openQuotes, recentDocuments, client] = await Promise.all([
      this.prisma.project.count({
        where: { clientId, status: { not: "CLOSED" } }
      }),
      this.prisma.clientQuote.count({
        where: { clientId, status: "SENT" }
      }),
      this.prisma.tenderDocumentLink.count({
        where: { project: { clientId } }
      }),
      this.prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true, name: true, code: true }
      })
    ]);

    if (!client) throw new NotFoundException("Client not found.");

    return {
      client,
      counts: { activeProjects, openQuotes, recentDocuments }
    };
  }

  listProjects(clientId: string) {
    return this.prisma.project.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        projectNumber: true,
        name: true,
        status: true,
        siteAddressLine1: true,
        siteAddressSuburb: true,
        siteAddressState: true,
        siteAddressPostcode: true,
        contractValue: true,
        proposedStartDate: true,
        actualStartDate: true,
        practicalCompletionDate: true,
        plannedStartDate: true,
        plannedEndDate: true,
        createdAt: true
      }
    });
  }

  async getProject(clientId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, clientId },
      include: {
        ganttTasks: {
          orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }],
          select: {
            id: true,
            title: true,
            discipline: true,
            startDate: true,
            endDate: true,
            progress: true,
            colour: true
          }
        },
        milestones: {
          select: { id: true, name: true, plannedDate: true, actualDate: true, status: true }
        }
      }
    });

    if (!project) throw new NotFoundException("Project not found.");
    return project;
  }

  listJobs(clientId: string) {
    return this.prisma.job.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        jobNumber: true,
        name: true,
        description: true,
        status: true,
        createdAt: true
      }
    });
  }

  listQuotes(clientId: string) {
    return this.prisma.clientQuote.findMany({
      where: { clientId, status: { in: ["SENT", "SUPERSEDED"] } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        quoteRef: true,
        revision: true,
        status: true,
        sentAt: true,
        createdAt: true,
        tender: { select: { id: true, tenderNumber: true, title: true } }
      }
    });
  }

  listDocuments(clientId: string) {
    return this.prisma.tenderDocumentLink.findMany({
      where: { project: { clientId } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        category: true,
        title: true,
        description: true,
        createdAt: true,
        project: { select: { id: true, projectNumber: true, name: true } }
      }
    });
  }

  async getAccount(portalUserId: string) {
    const user = await this.prisma.clientPortalUser.findUnique({
      where: { id: portalUserId },
      include: { client: { select: { id: true, name: true, code: true, email: true, phone: true } } }
    });
    if (!user) throw new NotFoundException("Portal user not found.");
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      lastLoginAt: user.lastLoginAt,
      client: user.client
    };
  }
}
