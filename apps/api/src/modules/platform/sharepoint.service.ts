import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EnsureSharePointFolderDto } from "./dto/sharepoint-folder.dto";
import { InjectSharePointAdapter, SharePointAdapter } from "./sharepoint.adapter";

@Injectable()
export class SharePointService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @InjectSharePointAdapter() private readonly adapter: SharePointAdapter
  ) {}

  getConfiguration() {
    return {
      mode: this.configService.get<string>("SHAREPOINT_MODE", "mock"),
      siteId: this.configService.get<string>("SHAREPOINT_SITE_ID", "project-operations-site"),
      driveId: this.configService.get<string>("SHAREPOINT_LIBRARY_ID", "project-operations-library"),
      rootFolder: this.configService.get<string>("SHAREPOINT_ROOT_FOLDER", "Project Operations")
    };
  }

  async ensureFolder(input: EnsureSharePointFolderDto, actorId?: string) {
    const config = this.getConfiguration();
    const folder = await this.adapter.ensureFolder({
      siteId: config.siteId,
      driveId: config.driveId,
      name: input.name,
      relativePath: input.relativePath
    });

    const record = await this.prisma.sharePointFolderLink.upsert({
      where: {
        siteId_driveId_itemId: {
          siteId: folder.siteId,
          driveId: folder.driveId,
          itemId: folder.itemId
        }
      },
      update: {
        name: folder.name,
        relativePath: folder.relativePath,
        module: input.module,
        linkedEntityType: input.linkedEntityType,
        linkedEntityId: input.linkedEntityId
      },
      create: {
        siteId: folder.siteId,
        driveId: folder.driveId,
        itemId: folder.itemId,
        name: folder.name,
        relativePath: folder.relativePath,
        module: input.module,
        linkedEntityType: input.linkedEntityType,
        linkedEntityId: input.linkedEntityId
      }
    });

    await this.auditService.write({
      actorId,
      action: "sharepoint.folder.ensure",
      entityType: "SharePointFolderLink",
      entityId: record.id,
      metadata: { relativePath: input.relativePath, module: input.module }
    });

    return record;
  }

  listFolders() {
    return this.prisma.sharePointFolderLink.findMany({
      orderBy: [{ module: "asc" }, { relativePath: "asc" }]
    });
  }

  async uploadFile(input: {
    folderId: string;
    siteId: string;
    driveId: string;
    name: string;
    content: Buffer;
    mimeType?: string;
  }) {
    return this.adapter.uploadFile(input);
  }

  async getDownloadUrl(input: { siteId: string; driveId: string; fileId: string }) {
    return this.adapter.getDownloadUrl(input);
  }
}
