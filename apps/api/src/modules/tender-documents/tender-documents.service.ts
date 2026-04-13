import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SharePointService } from "../platform/sharepoint.service";
import { CreateTenderDocumentDto } from "./dto/tender-document.dto";

@Injectable()
export class TenderDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly sharePointService: SharePointService
  ) {}

  async list(tenderId: string) {
    return this.prisma.tenderDocumentLink.findMany({
      where: { tenderId },
      include: {
        folderLink: true,
        fileLink: true
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async create(tenderId: string, dto: CreateTenderDocumentDto, actorId?: string) {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId }
    });

    if (!tender) {
      throw new NotFoundException("Tender not found.");
    }

    const folderPath = `Project Operations/Tendering/${tender.tenderNumber}_${this.slugify(tender.title)}`;
    const folder = await this.sharePointService.ensureFolder(
      {
        name: tender.title,
        relativePath: folderPath,
        module: "tendering",
        linkedEntityType: "Tender",
        linkedEntityId: tenderId
      },
      actorId
    );

    const fileLink = await this.prisma.sharePointFileLink.create({
      data: {
        folderLinkId: folder.id,
        siteId: folder.siteId,
        driveId: folder.driveId,
        itemId: `mock-file-${Date.now()}`,
        name: dto.fileName,
        relativePath: `${folder.relativePath}/${dto.fileName}`,
        webUrl: `https://sharepoint.local/${folder.relativePath}/${dto.fileName}`,
        mimeType: dto.mimeType ?? "application/octet-stream",
        linkedEntityType: "Tender",
        linkedEntityId: tenderId,
        metadata: {
          uploadMode: "mock"
        }
      }
    });

    const document = await this.prisma.tenderDocumentLink.create({
      data: {
        tenderId,
        category: dto.category,
        title: dto.title,
        description: dto.description,
        folderLinkId: folder.id,
        fileLinkId: fileLink.id
      },
      include: {
        folderLink: true,
        fileLink: true
      }
    });

    await this.prisma.documentLink.create({
      data: {
        linkedEntityType: "Tender",
        linkedEntityId: tenderId,
        module: "tendering",
        category: dto.category,
        title: dto.title,
        description: dto.description,
        folderLinkId: folder.id,
        fileLinkId: fileLink.id
      }
    });

    await this.auditService.write({
      actorId,
      action: "tenderdocuments.create",
      entityType: "TenderDocumentLink",
      entityId: document.id,
      metadata: {
        tenderId,
        category: dto.category,
        fileName: dto.fileName
      }
    });

    return document;
  }

  private slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
}
