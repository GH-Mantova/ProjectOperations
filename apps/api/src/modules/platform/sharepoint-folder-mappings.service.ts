import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SharePointMappingEntityType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { InjectSharePointAdapter, type SharePointAdapter } from "./sharepoint.adapter";

// Which folder each entity's documents live in — DATA, not env vars.
// Before: SHAREPOINT_TENDERS_ROOT was an env var; adding a new entity
// mapping meant an Azure portal trip AND a code change per env var.
// After: mappings live in the DB; a super-user edits `folderPath` from
// the admin UI and the change takes effect immediately.
//
// Credentials (AZURE_*) stay in env vars. Business config (folder paths)
// lives in the database. See PR body for why.

// Env-var fallback default matches the shipped .env.example, so a brand-new
// DB with an empty mappings table still resolves the historic path instead
// of throwing. Migration seeds the mappings that describe today's live
// SharePoint, so this only triggers in tests or dev DBs seeded before
// this feature.
export const LEGACY_TENDERS_ROOT_DEFAULT = "Project Operations/Tenders";

type FallbackFn = (entityType: SharePointMappingEntityType) => string | null;

@Injectable()
export class SharePointFolderMappingsService {
  private readonly logger = new Logger(SharePointFolderMappingsService.name);

  // Simple in-memory cache keyed by entity type. Cleared on every write
  // (updatePath) so the admin edits a path and the very next tender
  // upload routes to the new folder — no restart, no TTL to wait out.
  private readonly cache = new Map<SharePointMappingEntityType, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    @InjectSharePointAdapter() private readonly adapter: SharePointAdapter
  ) {}

  list() {
    return this.prisma.sharePointFolderMapping.findMany({
      orderBy: { entityType: "asc" }
    });
  }

  // DB → env-var fallback (TENDER only, during the deprecation window)
  // → hard default. Env fallback lets old deployments keep working while
  // the DB path is proven in prod; the follow-up PR removes it.
  async getFolderPath(entityType: SharePointMappingEntityType): Promise<string> {
    const cached = this.cache.get(entityType);
    if (cached) return cached;

    const mapping = await this.prisma.sharePointFolderMapping.findUnique({
      where: { entityType }
    });

    if (mapping && mapping.isActive) {
      this.cache.set(entityType, mapping.folderPath);
      return mapping.folderPath;
    }

    const fallback = this.fallbackForType(entityType);
    if (fallback) {
      this.logger.warn(
        `SharePoint folder mapping for ${entityType} missing — using env fallback "${fallback}". Add a mapping in Admin → Platform.`
      );
      return fallback;
    }

    throw new NotFoundException(
      `No SharePoint folder mapping configured for ${entityType}. Add one in Admin → Platform → SharePoint folder mappings.`
    );
  }

  private fallbackForType: FallbackFn = (entityType) => {
    if (entityType === "TENDER") {
      return this.configService.get<string>("SHAREPOINT_TENDERS_ROOT") ?? LEGACY_TENDERS_ROOT_DEFAULT;
    }
    // JOB and any future types have no env-var fallback — they must
    // be configured in the DB. The migration seeds JOB at install
    // time, so this branch only fires if a DB row was deleted.
    return null;
  };

  // Validate → persist → invalidate cache → audit. In that order:
  // validation is cheap and refuses bad input before we touch state;
  // cache invalidation is after persistence so a failed write leaves
  // the old value visible; audit is last so the row survives even if
  // audit write hiccups.
  async updatePath(
    entityType: SharePointMappingEntityType,
    input: { folderPath: string; siteId: string; driveId: string },
    actorId?: string
  ) {
    const trimmed = input.folderPath.trim();
    if (!trimmed) {
      throw new BadRequestException("folderPath must not be empty.");
    }
    if (trimmed.startsWith("/") || trimmed.endsWith("/")) {
      throw new BadRequestException("folderPath must not start or end with '/'.");
    }
    if (trimmed.includes("//")) {
      throw new BadRequestException("folderPath must not contain '//'.");
    }

    // Validate against Graph. Save is REJECTED if the folder does not
    // exist — a typo'd path that silently creates a new tree is how
    // documents end up somewhere nobody looks (sot/01 §6, failure
    // honesty). "Create it" is a separate, explicit action.
    const exists = await this.adapter.folderExists({
      siteId: input.siteId,
      driveId: input.driveId,
      relativePath: trimmed
    });
    if (!exists) {
      throw new BadRequestException(
        `Folder "${trimmed}" was not found in the configured SharePoint library. Check the path, or create the folder in SharePoint first.`
      );
    }

    const existing = await this.prisma.sharePointFolderMapping.findUnique({
      where: { entityType }
    });

    const record = existing
      ? await this.prisma.sharePointFolderMapping.update({
          where: { entityType },
          data: {
            folderPath: trimmed,
            updatedById: actorId ?? null
          }
        })
      : await this.prisma.sharePointFolderMapping.create({
          data: {
            entityType,
            folderPath: trimmed,
            createdById: actorId ?? null,
            updatedById: actorId ?? null
          }
        });

    // Any tender/job upload that resolves the folder path after this
    // point re-reads the DB. Otherwise the admin edits the path,
    // nothing changes, and nobody knows why (PR body §4).
    this.cache.delete(entityType);

    await this.auditService.write({
      actorId,
      action: "sharepoint.folder-mapping.update",
      entityType: "SharePointFolderMapping",
      entityId: record.id,
      metadata: {
        entityType,
        previousPath: existing?.folderPath ?? null,
        newPath: trimmed
      }
    });

    return record;
  }

  // Test helper — resets the in-memory cache so specs can exercise the
  // DB-read path deterministically.
  invalidateCache(): void {
    this.cache.clear();
  }
}
