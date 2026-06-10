import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EnsureSharePointFolderDto } from "./dto/sharepoint-folder.dto";
import { InjectSharePointAdapter } from "./sharepoint.adapter";
import type { SharePointAdapter } from "./sharepoint.adapter";
import { DOCUMENT_CATEGORIES } from "../tender-documents/tender-document-categories";
import type { DocumentCategory } from "../tender-documents/tender-document-categories";

// PR-64 — Runtime-resolved SharePoint coordinates. `getResolvedConfig`
// returns these, lazy-resolving siteId/driveId from
// SHAREPOINT_SITE_HOSTNAME / SHAREPOINT_SITE_PATH / SHAREPOINT_LIBRARY_NAME
// when the legacy SHAREPOINT_SITE_ID / SHAREPOINT_LIBRARY_ID overrides are
// not present. Cached on first successful resolve.
export type ResolvedSharePointConfig = {
  mode: string;
  siteId: string;
  driveId: string;
  tendersRoot: string;
};

@Injectable()
export class SharePointService {
  private readonly logger = new Logger(SharePointService.name);
  // Promise rather than plain values so concurrent first-callers share a
  // single resolution attempt. Reset to null on failure so the next call
  // retries instead of replaying the cached error.
  private resolvedConfig: Promise<ResolvedSharePointConfig> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @InjectSharePointAdapter() private readonly adapter: SharePointAdapter
  ) {}

  // Env-snapshot for the admin UI and tests. Does NOT perform Graph
  // resolution — callers that need the actually-used siteId/driveId pair
  // should use getResolvedConfig().
  getConfiguration() {
    return {
      mode: this.configService.get<string>("SHAREPOINT_MODE", "mock"),
      siteId: this.configService.get<string>("SHAREPOINT_SITE_ID", "project-operations-site"),
      driveId: this.configService.get<string>("SHAREPOINT_LIBRARY_ID", "project-operations-library"),
      rootFolder: this.configService.get<string>("SHAREPOINT_ROOT_FOLDER", "Project Operations")
    };
  }

  // PR-64 — Lazy-resolved coordinates. Prefers explicit SHAREPOINT_SITE_ID
  // / SHAREPOINT_LIBRARY_ID env vars when set (back-compat with existing
  // deployments). Otherwise calls Graph via the adapter to resolve from
  // SHAREPOINT_SITE_HOSTNAME / SHAREPOINT_SITE_PATH / SHAREPOINT_LIBRARY_NAME.
  // Mock adapter returns deterministic synthetic IDs so dev / test paths
  // never hit Graph.
  async getResolvedConfig(): Promise<ResolvedSharePointConfig> {
    if (!this.resolvedConfig) {
      this.resolvedConfig = this.computeResolvedConfig().catch((err) => {
        this.resolvedConfig = null;
        throw err;
      });
    }
    return this.resolvedConfig;
  }

  private async computeResolvedConfig(): Promise<ResolvedSharePointConfig> {
    const mode = this.configService.get<string>("SHAREPOINT_MODE", "mock");
    const explicitSiteId = this.configService.get<string>("SHAREPOINT_SITE_ID");
    const explicitDriveId = this.configService.get<string>("SHAREPOINT_LIBRARY_ID");
    const tendersRoot = this.configService.get<string>(
      "SHAREPOINT_TENDERS_ROOT",
      "Project Operations/Tenders"
    );

    // Back-compat: explicit IDs win over hostname/path resolution. Lets
    // existing deployments keep their SHAREPOINT_SITE_ID/LIBRARY_ID env
    // vars without touching anything else.
    if (explicitSiteId && explicitDriveId) {
      return { mode, siteId: explicitSiteId, driveId: explicitDriveId, tendersRoot };
    }

    const hostname = this.configService.get<string>("SHAREPOINT_SITE_HOSTNAME");
    const sitePath = this.configService.get<string>("SHAREPOINT_SITE_PATH");
    const libraryName = this.configService.get<string>("SHAREPOINT_LIBRARY_NAME");

    // Mock mode without resolver vars: fall back to the legacy default
    // synthetic IDs so existing tests / dev seed runs keep working.
    if (mode !== "live" && mode !== "graph" && (!hostname || !sitePath || !libraryName)) {
      return {
        mode,
        siteId: explicitSiteId ?? "project-operations-site",
        driveId: explicitDriveId ?? "project-operations-library",
        tendersRoot
      };
    }

    if (!hostname || !sitePath || !libraryName) {
      throw new Error(
        "SharePoint live mode requires SHAREPOINT_SITE_HOSTNAME, SHAREPOINT_SITE_PATH, and SHAREPOINT_LIBRARY_NAME (or the legacy SHAREPOINT_SITE_ID + SHAREPOINT_LIBRARY_ID overrides)."
      );
    }

    const siteId = explicitSiteId ?? (await this.adapter.resolveSiteId({ hostname, sitePath }));
    const driveId =
      explicitDriveId ?? (await this.adapter.resolveDriveId({ siteId, libraryName }));
    return { mode, siteId, driveId, tendersRoot };
  }

  async ensureFolder(input: EnsureSharePointFolderDto, actorId?: string) {
    const config = await this.getResolvedConfig();
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

  // PR-64 — Ensure the full per-tender folder structure exists. Called
  // from TenderingService.create / .duplicate after the tender row
  // commits. Creates `{tendersRoot}/{tenderNumber}/` plus one subfolder
  // per canonical document category, walking the parent chain first
  // because Graph's ensureFolder requires intermediate folders to
  // pre-exist.
  //
  // Best-effort: per-category failures are logged and swallowed so a
  // single Graph hiccup does not strand a fresh tender. Uploads later
  // re-ensure the specific category folder they need.
  async ensureTenderFolderStructure(
    tender: { id: string; tenderNumber: string },
    actorId?: string
  ): Promise<void> {
    const config = await this.getResolvedConfig();
    const rootSegments = config.tendersRoot.split("/").filter(Boolean);
    const tenderRelativePath = `${config.tendersRoot}/${tender.tenderNumber}`;

    let accumulated = "";
    for (const segment of rootSegments) {
      accumulated = accumulated ? `${accumulated}/${segment}` : segment;
      try {
        await this.ensureFolder(
          {
            name: segment,
            relativePath: accumulated,
            module: "sharepoint-bootstrap"
          },
          actorId
        );
      } catch (err) {
        this.logger.warn(
          `ensureTenderFolderStructure: failed to ensure parent '${accumulated}' for tender ${tender.tenderNumber}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
        return;
      }
    }

    try {
      await this.ensureFolder(
        {
          name: tender.tenderNumber,
          relativePath: tenderRelativePath,
          module: "tendering",
          linkedEntityType: "Tender",
          linkedEntityId: tender.id
        },
        actorId
      );
    } catch (err) {
      this.logger.warn(
        `ensureTenderFolderStructure: failed to ensure tender folder '${tenderRelativePath}' for ${tender.tenderNumber}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return;
    }

    for (const category of DOCUMENT_CATEGORIES) {
      try {
        await this.ensureFolder(
          {
            name: category,
            relativePath: `${tenderRelativePath}/${category}`,
            module: "tendering",
            linkedEntityType: "Tender",
            linkedEntityId: tender.id
          },
          actorId
        );
      } catch (err) {
        this.logger.warn(
          `ensureTenderFolderStructure: failed to ensure category folder '${category}' for tender ${tender.tenderNumber}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  }

  // PR-64 — Ensure a specific tender/category subfolder exists and
  // return its link record. Called by tender-document uploads to route
  // files into the matching subfolder, falling back to creating the
  // folder lazily if the tender was created before PR-64 (or if the
  // ensureTenderFolderStructure call partially failed at create time).
  async ensureTenderCategoryFolder(
    tender: { id: string; tenderNumber: string },
    category: DocumentCategory,
    actorId?: string
  ) {
    const config = await this.getResolvedConfig();
    const relativePath = `${config.tendersRoot}/${tender.tenderNumber}/${category}`;
    return this.ensureFolder(
      {
        name: category,
        relativePath,
        module: "tendering",
        linkedEntityType: "Tender",
        linkedEntityId: tender.id
      },
      actorId
    );
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

  // PR #146 — read raw file bytes via the configured adapter. Audits
  // every read because file content can be sensitive (drawings, hazmat
  // reports, contracts), and the AI model now reads on behalf of users
  // — having an audit trail of what the assistant accessed matters for
  // compliance. Audit metadata records sizeBytes only; never the
  // content itself.
  async downloadFileBytes(
    input: { siteId: string; driveId: string; fileId: string },
    actorId?: string
  ): Promise<Buffer> {
    const result = await this.adapter.downloadFileBytes(input);
    await this.auditService.write({
      actorId,
      action: "sharepoint.file.download",
      entityType: "SharePointFileLink",
      entityId: input.fileId,
      metadata: {
        siteId: input.siteId,
        driveId: input.driveId,
        sizeBytes: result.length
      }
    });
    return result;
  }

  // Probe the configured adapter so the Admin Settings → Platform UI can
  // verify SharePoint credentials before any real upload happens. Mock mode
  // returns a synthetic OK; live mode performs a benign ensureFolder against
  // the configured root and surfaces any auth/network failure.
  async testConnection(): Promise<{ connected: boolean; mode: string; message?: string }> {
    const envConfig = this.getConfiguration();
    if (envConfig.mode === "mock") {
      return { connected: true, mode: "mock", message: "Mock SharePoint adapter — no live API call performed." };
    }
    try {
      const config = await this.getResolvedConfig();
      const probePath = `${config.tendersRoot}/__connection_probe__`;
      await this.adapter.ensureFolder({
        siteId: config.siteId,
        driveId: config.driveId,
        name: "__connection_probe__",
        relativePath: probePath
      });
      return { connected: true, mode: config.mode };
    } catch (err) {
      return {
        connected: false,
        mode: envConfig.mode,
        message: err instanceof Error ? err.message : "SharePoint connection failed."
      };
    }
  }
}
