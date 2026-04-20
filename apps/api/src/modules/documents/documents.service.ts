import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../platform/notifications.service";
import { SharePointService } from "../platform/sharepoint.service";
import {
  CreateDocumentDto,
  CreateDocumentVersionDto,
  DocumentsQueryDto
} from "./dto/documents.dto";

const documentInclude = {
  folderLink: true,
  fileLink: true,
  tags: {
    orderBy: { tag: "asc" }
  },
  accessRules: {
    orderBy: { createdAt: "asc" }
  },
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true
    }
  },
  updatedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true
    }
  }
} as const;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly sharePointService: SharePointService,
    private readonly notificationsService: NotificationsService
  ) {}

  async list(query: DocumentsQueryDto, actor: AuthenticatedUser) {
    const where: Prisma.DocumentLinkWhereInput = {
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: "insensitive" } },
              { description: { contains: query.q, mode: "insensitive" } },
              { fileLink: { is: { name: { contains: query.q, mode: "insensitive" } } } }
            ]
          }
        : {}),
      ...(query.linkedEntityType ? { linkedEntityType: query.linkedEntityType } : {}),
      ...(query.linkedEntityId ? { linkedEntityId: query.linkedEntityId } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.module ? { module: query.module } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.tag
        ? {
            tags: {
              some: {
                tag: { contains: query.tag, mode: "insensitive" }
              }
            }
          }
        : {})
    };

    const roleNames = await this.getActorRoles(actor.sub);
    const items = await this.prisma.documentLink.findMany({
      where,
      include: documentInclude,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
    });

    const visibleItems = items.filter((item) => this.canAccessDocument(item, actor.permissions, roleNames, "view"));
    const start = (query.page - 1) * query.pageSize;
    const pagedItems = visibleItems.slice(start, start + query.pageSize);

    return {
      items: await Promise.all(pagedItems.map((item) => this.enrichDocument(item))),
      total: visibleItems.length,
      page: query.page,
      pageSize: query.pageSize
    };
  }

  async listForEntity(linkedEntityType: string, linkedEntityId: string, actor: AuthenticatedUser) {
    const response = await this.list(
      {
        page: 1,
        pageSize: 100,
        linkedEntityType,
        linkedEntityId
      },
      actor
    );

    return response.items;
  }

  async getById(id: string, actor: AuthenticatedUser) {
    const roleNames = await this.getActorRoles(actor.sub);
    const document = await this.requireDocument(id);

    if (!this.canAccessDocument(document, actor.permissions, roleNames, "view")) {
      throw new ForbiddenException("You do not have access to this document.");
    }

    const versions = await this.prisma.documentLink.findMany({
      where: {
        OR: [
          { id: document.id },
          ...(document.documentFamilyKey ? [{ documentFamilyKey: document.documentFamilyKey }] : [])
        ]
      },
      include: {
        fileLink: true
      },
      orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }]
    });

    return {
      ...(await this.enrichDocument(document)),
      versions: versions.map((version) => ({
        id: version.id,
        title: version.title,
        versionNumber: version.versionNumber,
        versionLabel: version.versionLabel,
        isCurrentVersion: version.isCurrentVersion,
        createdAt: version.createdAt,
        fileLink: version.fileLink
      }))
    };
  }

  async getOpenLink(id: string, actor: AuthenticatedUser) {
    const roleNames = await this.getActorRoles(actor.sub);
    const document = await this.requireDocument(id);

    if (!this.canAccessDocument(document, actor.permissions, roleNames, "open")) {
      throw new ForbiddenException("You do not have access to open this document.");
    }

    return {
      url: document.fileLink?.webUrl ?? null,
      fileName: document.fileLink?.name ?? null
    };
  }

  async getDownloadLink(id: string, actor: AuthenticatedUser) {
    const roleNames = await this.getActorRoles(actor.sub);
    const document = await this.requireDocument(id);

    if (!this.canAccessDocument(document, actor.permissions, roleNames, "download")) {
      throw new ForbiddenException("You do not have access to download this document.");
    }

    return {
      url: document.fileLink?.webUrl ?? null,
      fileName: document.fileLink?.name ?? null
    };
  }

  async create(dto: CreateDocumentDto, actor: AuthenticatedUser, file?: Express.Multer.File) {
    await this.resolveEntityContext(dto.linkedEntityType, dto.linkedEntityId);

    const previousVersion = dto.versionOfDocumentId
      ? await this.requireDocument(dto.versionOfDocumentId)
      : null;

    if (previousVersion && (previousVersion.linkedEntityType !== dto.linkedEntityType || previousVersion.linkedEntityId !== dto.linkedEntityId)) {
      throw new ForbiddenException("Document versions must stay linked to the same entity.");
    }

    const folder = await this.ensureEntityFolder(dto.linkedEntityType, dto.linkedEntityId, actor.sub);
    const familyKey = previousVersion?.documentFamilyKey ?? previousVersion?.id ?? dto.documentFamilyKey ?? randomUUID();
    const versionNumber = previousVersion ? previousVersion.versionNumber + 1 : 1;
    const uploadName = file?.originalname ?? dto.fileName;
    const uploadMime = file?.mimetype ?? dto.mimeType ?? "application/octet-stream";

    let uploadItemId = `mock-file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
        versionLabel: dto.versionLabel ?? `v${versionNumber}`,
        versionNumber,
        linkedEntityType: dto.linkedEntityType,
        linkedEntityId: dto.linkedEntityId,
        metadata: {
          uploadMode,
          eTag: uploadETag,
          notes: dto.notes ?? null
        }
      }
    });

    const created = await this.prisma.$transaction(async (tx) => {
      if (previousVersion) {
        await tx.documentLink.update({
          where: { id: previousVersion.id },
          data: {
            isCurrentVersion: false,
            supersededAt: new Date(),
            updatedById: actor.sub
          }
        });
      }

      const document = await tx.documentLink.create({
        data: {
          linkedEntityType: dto.linkedEntityType,
          linkedEntityId: dto.linkedEntityId,
          module: this.moduleForEntity(dto.linkedEntityType),
          category: dto.category,
          status: dto.status ?? "ACTIVE",
          title: dto.title,
          description: dto.description ?? null,
          versionLabel: dto.versionLabel ?? `v${versionNumber}`,
          versionNumber,
          documentFamilyKey: familyKey,
          isCurrentVersion: true,
          folderLinkId: folder.id,
          fileLinkId: fileLink.id,
          createdById: actor.sub,
          updatedById: actor.sub,
          metadata: {
            notes: dto.notes ?? null
          },
          tags: {
            create: (dto.tags ?? []).map((tag) => ({ tag }))
          },
          accessRules: {
            create: (dto.accessRules ?? []).map((rule) => ({
              accessType: rule.accessType,
              roleName: rule.roleName ?? null,
              permissionCode: rule.permissionCode ?? null,
              canView: rule.canView ?? true,
              canDownload: rule.canDownload ?? true,
              canOpenLink: rule.canOpenLink ?? true
            }))
          }
        },
        include: documentInclude
      });

      await tx.searchEntry.create({
        data: {
          entityType: "DocumentLink",
          entityId: document.id,
          title: document.title,
          subtitle: `${document.linkedEntityType} / ${document.category}`,
          body: document.description ?? document.fileLink?.name ?? "Document link",
          module: "documents",
          url: "/documents",
          metadata: {
            linkedEntityType: document.linkedEntityType,
            linkedEntityId: document.linkedEntityId
          }
        }
      });

      return document;
    });

    await this.auditService.write({
      actorId: actor.sub,
      action: "documents.create",
      entityType: "DocumentLink",
      entityId: created.id,
      metadata: {
        linkedEntityType: dto.linkedEntityType,
        linkedEntityId: dto.linkedEntityId,
        category: dto.category,
        fileName: dto.fileName,
        versionNumber
      }
    });
    await this.notificationsService.refreshLiveFollowUps(actor.sub);

    return this.getById(created.id, actor);
  }

  async createVersion(id: string, dto: CreateDocumentVersionDto, actor: AuthenticatedUser, file?: Express.Multer.File) {
    const existing = await this.requireDocument(id);

    return this.create(
      {
        linkedEntityType: existing.linkedEntityType,
        linkedEntityId: existing.linkedEntityId,
        category: existing.category,
        title: existing.title,
        description: existing.description ?? undefined,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        status: existing.status,
        versionLabel: dto.versionLabel,
        versionOfDocumentId: existing.id,
        documentFamilyKey: existing.documentFamilyKey ?? existing.id,
        tags: dto.tags ?? existing.tags.map((tag) => tag.tag),
        notes: dto.notes,
        accessRules: existing.accessRules.map((rule) => ({
          accessType: rule.accessType,
          roleName: rule.roleName ?? undefined,
          permissionCode: rule.permissionCode ?? undefined,
          canView: rule.canView,
          canDownload: rule.canDownload,
          canOpenLink: rule.canOpenLink
        }))
      },
      actor,
      file
    );
  }

  private async requireDocument(id: string) {
    const document = await this.prisma.documentLink.findUnique({
      where: { id },
      include: documentInclude
    });

    if (!document) {
      throw new NotFoundException("Document not found.");
    }

    return document;
  }

  private async getActorRoles(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    return (user?.userRoles ?? []).map((item) => item.role.name);
  }

  private canAccessDocument(
    document: Awaited<ReturnType<DocumentsService["requireDocument"]>>,
    permissions: string[],
    roleNames: string[],
    mode: "view" | "download" | "open"
  ) {
    if (!document.accessRules.length) {
      return true;
    }

    return document.accessRules.some((rule) => {
      const modeAllowed =
        mode === "view"
          ? rule.canView
          : mode === "download"
            ? rule.canDownload
            : rule.canOpenLink;

      if (!modeAllowed) {
        return false;
      }

      if (rule.accessType === "AUTHENTICATED") {
        return true;
      }

      if (rule.accessType === "ROLE" && rule.roleName) {
        return roleNames.includes(rule.roleName);
      }

      if (rule.accessType === "PERMISSION" && rule.permissionCode) {
        return permissions.includes(rule.permissionCode);
      }

      return false;
    });
  }

  private async enrichDocument(
    document: Awaited<ReturnType<DocumentsService["requireDocument"]>>
  ) {
    const entitySummary = await this.resolveEntitySummary(document.linkedEntityType, document.linkedEntityId);

    return {
      ...document,
      entitySummary
    };
  }

  private async resolveEntityContext(linkedEntityType: string, linkedEntityId: string) {
    switch (linkedEntityType) {
      case "Job": {
        const job = await this.prisma.job.findUnique({ where: { id: linkedEntityId } });
        if (!job) throw new NotFoundException("Linked job not found.");
        return job;
      }
      case "Asset": {
        const asset = await this.prisma.asset.findUnique({ where: { id: linkedEntityId } });
        if (!asset) throw new NotFoundException("Linked asset not found.");
        return asset;
      }
      case "FormSubmission": {
        const submission = await this.prisma.formSubmission.findUnique({
          where: { id: linkedEntityId },
          include: {
            templateVersion: {
              include: {
                template: true
              }
            }
          }
        });
        if (!submission) throw new NotFoundException("Linked form submission not found.");
        return submission;
      }
      case "Tender": {
        const tender = await this.prisma.tender.findUnique({ where: { id: linkedEntityId } });
        if (!tender) throw new NotFoundException("Linked tender not found.");
        return tender;
      }
      default:
        throw new NotFoundException("Unsupported linked entity type.");
    }
  }

  private async ensureEntityFolder(linkedEntityType: string, linkedEntityId: string, actorId?: string) {
    const entity = await this.resolveEntityContext(linkedEntityType, linkedEntityId);

    if (linkedEntityType === "Job") {
      const job = entity as { jobNumber: string; name: string };
      return this.sharePointService.ensureFolder(
        {
          name: job.name,
          relativePath: `Project Operations/Jobs/${job.jobNumber}_${this.slugify(job.name)}/Documents`,
          module: "documents",
          linkedEntityType,
          linkedEntityId
        },
        actorId
      );
    }

    if (linkedEntityType === "Asset") {
      const asset = entity as { assetCode: string; name: string };
      return this.sharePointService.ensureFolder(
        {
          name: asset.name,
          relativePath: `Project Operations/Assets/${asset.assetCode}_${this.slugify(asset.name)}/Documents`,
          module: "documents",
          linkedEntityType,
          linkedEntityId
        },
        actorId
      );
    }

    if (linkedEntityType === "FormSubmission") {
      const submission = entity as { id: string; templateVersion: { template: { code: string } } };
      return this.sharePointService.ensureFolder(
        {
          name: submission.templateVersion.template.code,
          relativePath: `Project Operations/Forms/${submission.templateVersion.template.code}_${submission.id}/Documents`,
          module: "documents",
          linkedEntityType,
          linkedEntityId
        },
        actorId
      );
    }

    const tender = entity as { tenderNumber: string; title: string };
    return this.sharePointService.ensureFolder(
      {
        name: tender.title,
        relativePath: `Project Operations/Tendering/${tender.tenderNumber}_${this.slugify(tender.title)}/Documents`,
        module: "documents",
        linkedEntityType,
        linkedEntityId
      },
      actorId
    );
  }

  private async resolveEntitySummary(linkedEntityType: string, linkedEntityId: string) {
    if (linkedEntityType === "Job") {
      const job = await this.prisma.job.findUnique({
        where: { id: linkedEntityId },
        select: { id: true, jobNumber: true, name: true, status: true }
      });
      return job ? { title: `${job.jobNumber} - ${job.name}`, status: job.status } : null;
    }

    if (linkedEntityType === "Asset") {
      const asset = await this.prisma.asset.findUnique({
        where: { id: linkedEntityId },
        select: { id: true, assetCode: true, name: true, status: true }
      });
      return asset ? { title: `${asset.assetCode} - ${asset.name}`, status: asset.status } : null;
    }

    if (linkedEntityType === "FormSubmission") {
      const submission = await this.prisma.formSubmission.findUnique({
        where: { id: linkedEntityId },
        include: {
          templateVersion: {
            include: {
              template: true
            }
          }
        }
      });
      return submission
        ? {
            title: `${submission.templateVersion.template.code} submission`,
            status: submission.status
          }
        : null;
    }

    if (linkedEntityType === "Tender") {
      const tender = await this.prisma.tender.findUnique({
        where: { id: linkedEntityId },
        select: { id: true, tenderNumber: true, title: true, status: true }
      });
      return tender ? { title: `${tender.tenderNumber} - ${tender.title}`, status: tender.status } : null;
    }

    return null;
  }

  private moduleForEntity(linkedEntityType: string) {
    switch (linkedEntityType) {
      case "Job":
        return "jobs";
      case "Asset":
        return "assets";
      case "FormSubmission":
        return "forms";
      case "Tender":
        return "tendering";
      default:
        return "documents";
    }
  }

  private slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }
}
