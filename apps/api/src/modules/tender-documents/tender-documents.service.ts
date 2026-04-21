import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
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

  async create(tenderId: string, dto: CreateTenderDocumentDto, actorId?: string, file?: Express.Multer.File) {
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

    const uploadName = file?.originalname ?? dto.fileName;
    const uploadMime = file?.mimetype ?? dto.mimeType ?? "application/octet-stream";

    // No-file path (metadata-only links): generate a unique id so two
    // fast requests don't collide on the SharePointFileLink unique index.
    let uploadItemId = `mock-file-${Date.now()}-${randomBytes(4).toString("hex")}`;
    let uploadWebUrl = `https://sharepoint.local/${folder.relativePath}/${uploadName}`;
    let uploadMode: "mock" | "graph" = "mock";
    let uploadETag: string | null = null;

    if (file?.buffer) {
      const uploaded = await this.sharePointService.uploadFile({
        folderId: folder.itemId,
        siteId: folder.siteId,
        driveId: folder.driveId,
        name: uploadName,
        content: file.buffer,
        mimeType: uploadMime
      });
      uploadItemId = uploaded.id;
      uploadWebUrl = uploaded.webUrl;
      uploadETag = uploaded.eTag;
      uploadMode = "graph";
    }

    const fileLink = await this.prisma.sharePointFileLink.create({
      data: {
        folderLinkId: folder.id,
        siteId: folder.siteId,
        driveId: folder.driveId,
        itemId: uploadItemId,
        name: uploadName,
        relativePath: `${folder.relativePath}/${uploadName}`,
        webUrl: uploadWebUrl,
        mimeType: uploadMime,
        sizeBytes: file?.size ?? null,
        linkedEntityType: "Tender",
        linkedEntityId: tenderId,
        metadata: {
          uploadMode,
          eTag: uploadETag
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

  async remove(tenderId: string, documentId: string, actorId?: string) {
    const document = await this.prisma.tenderDocumentLink.findUnique({
      where: { id: documentId },
      include: { fileLink: true }
    });
    if (!document || document.tenderId !== tenderId) {
      throw new NotFoundException("Document not found on this tender.");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.tenderDocumentLink.delete({ where: { id: documentId } });
      if (document.fileLinkId) {
        await tx.documentLink.deleteMany({
          where: {
            fileLinkId: document.fileLinkId,
            linkedEntityType: "Tender",
            linkedEntityId: tenderId
          }
        });
        await tx.sharePointFileLink.delete({ where: { id: document.fileLinkId } }).catch(() => undefined);
      }
    });
    await this.auditService.write({
      actorId,
      action: "tenderdocuments.delete",
      entityType: "TenderDocumentLink",
      entityId: documentId,
      metadata: { tenderId, title: document.title }
    });
    return { id: documentId };
  }

  private slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
}
