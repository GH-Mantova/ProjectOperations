import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EnsureSharePointFolderDto } from "./dto/sharepoint-folder.dto";
import { InjectSharePointAdapter } from "./sharepoint.adapter";
import type { SharePointAdapter, FolderChildItem } from "./sharepoint.adapter";
import { DOCUMENT_CATEGORIES, TENDER_FOLDER_STRUCTURE, flattenFolderPaths } from "../tender-documents/tender-document-categories";
import type { DocumentCategory } from "../tender-documents/tender-document-categories";
import { SharePointFolderMappingsService } from "./sharepoint-folder-mappings.service";
import { deriveTenderFolderName, sanitiseSharePointName } from "../tendering/tender-number.service";

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
    @InjectSharePointAdapter() private readonly adapter: SharePointAdapter,
    // Optional so existing unit tests that construct the service directly
    // (without the DI container) keep compiling — they pass `undefined`
    // and getResolvedConfig falls back to the env var, which is the
    // pre-mapping behaviour. Nest wires the real service in production.
    @Optional() private readonly folderMappings?: SharePointFolderMappingsService
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
    // DB mapping wins; env var is the deprecation-window fallback so
    // deploys without a folder_mappings row (fresh QA envs, older tests)
    // still resolve the historic path.
    const tendersRoot = (await this.folderMappings?.getFolderPath("TENDER").catch(() => null)) ??
      this.configService.get<string>(
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
  // commits. Creates `{tendersRoot}/{folderName}/` plus one subfolder
  // per canonical document category, walking the parent chain first
  // because Graph's ensureFolder requires intermediate folders to
  // pre-exist.
  //
  // TFM-S2: folder name is derived from projectName (stable across revision
  // bumps) via deriveTenderFolderName. Pass site.name for the fallback.
  //
  // TFM-S4: uses TENDER_FOLDER_STRUCTURE (hierarchical) instead of the flat
  // DOCUMENT_CATEGORIES list. After the base structure, iterates tenderClients
  // and creates Quotes/{ClientName}/ for each. If no clients, still ensures
  // the parent Quotes/ folder.
  //
  // Best-effort: per-category failures are logged and swallowed so a
  // single Graph hiccup does not strand a fresh tender. Uploads later
  // re-ensure the specific category folder they need.
  //
  // TFM-S5: returns a provisioning result instead of void. Accumulates
  // per-path failures so the caller can persist them to the DB.
  async ensureTenderFolderStructure(
    tender: {
      id: string;
      tenderNumber: string;
      projectName?: string | null;
      site?: { name?: string | null } | null;
      tenderClients?: Array<{ client: { name: string } }> | null;
    },
    actorId?: string
  ): Promise<{ status: "ok" | "partial" | "failed"; failures: Array<{ path: string; message: string }> }> {
    const config = await this.getResolvedConfig();
    const rootSegments = config.tendersRoot.split("/").filter(Boolean);
    const folderName = deriveTenderFolderName(tender);
    const tenderRelativePath = `${config.tendersRoot}/${folderName}`;

    // Root parent chain must succeed: a failed parent means nothing else can
    // proceed, so we return "failed" immediately rather than accumulating.
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
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `ensureTenderFolderStructure: failed to ensure parent '${accumulated}' for tender ${tender.tenderNumber}: ${message}`
        );
        return { status: "failed", failures: [{ path: accumulated, message }] };
      }
    }

    try {
      await this.ensureFolder(
        {
          name: folderName,
          relativePath: tenderRelativePath,
          module: "tendering",
          linkedEntityType: "Tender",
          linkedEntityId: tender.id
        },
        actorId
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `ensureTenderFolderStructure: failed to ensure tender folder '${tenderRelativePath}' for ${tender.tenderNumber}: ${message}`
      );
      return { status: "failed", failures: [{ path: tenderRelativePath, message }] };
    }

    // TFM-S4: walk the hierarchical TENDER_FOLDER_STRUCTURE rather than the
    // flat DOCUMENT_CATEGORIES list. flattenFolderPaths returns paths in
    // depth-first order so parents are always ensured before children.
    // TFM-S5: accumulate failures instead of swallowing them.
    const failures: Array<{ path: string; message: string }> = [];
    let successCount = 0;

    const allPaths = flattenFolderPaths(TENDER_FOLDER_STRUCTURE);
    for (const categoryPath of allPaths) {
      const segments = categoryPath.split("/");
      const name = segments[segments.length - 1];
      try {
        await this.ensureFolder(
          {
            name,
            relativePath: `${tenderRelativePath}/${categoryPath}`,
            module: "tendering",
            linkedEntityType: "Tender",
            linkedEntityId: tender.id
          },
          actorId
        );
        successCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ path: categoryPath, message });
        this.logger.warn(
          `ensureTenderFolderStructure: failed to create ${categoryPath}: ${message}`
        );
      }
    }

    // TFM-S4: ensure per-client Quotes subfolders. If tenderClients is empty,
    // still ensure the parent Quotes/ folder so uploads can land there.
    const clients = tender.tenderClients ?? [];
    if (clients.length === 0) {
      try {
        await this.ensureFolder(
          {
            name: "Quotes",
            relativePath: `${tenderRelativePath}/Quotes`,
            module: "tendering",
            linkedEntityType: "Tender",
            linkedEntityId: tender.id
          },
          actorId
        );
        successCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push({ path: "Quotes", message });
        this.logger.warn(
          `ensureTenderFolderStructure: failed to create Quotes: ${message}`
        );
      }
    } else {
      for (const tc of clients) {
        try {
          await this.ensureTenderQuoteClientFolder(tender.id, tc.client.name, actorId);
          successCount++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          failures.push({ path: `Quotes/${tc.client.name}`, message });
          this.logger.warn(
            `ensureTenderFolderStructure: failed to create Quotes/${tc.client.name}: ${message}`
          );
        }
      }
    }

    if (failures.length === 0) {
      return { status: "ok", failures: [] };
    }
    return {
      status: successCount > 0 ? "partial" : "failed",
      failures
    };
  }

  // PR-64 — Ensure a specific tender/category subfolder exists and
  // return its link record. Called by tender-document uploads to route
  // files into the matching subfolder, falling back to creating the
  // folder lazily if the tender was created before PR-64 (or if the
  // ensureTenderFolderStructure call partially failed at create time).
  //
  // TFM-S2: uses deriveTenderFolderName so the path is stable across
  // revision bumps — pre-revision uploads continue routing to the same
  // folder rather than a freshly created stub.
  //
  // TFM-S4: `category` now accepts a slash-separated path like
  // "1. Plans, Scopes & Specs/01. Drawings". Each segment is ensured in
  // order under the tender's root folder. A single-segment call is unchanged.
  async ensureTenderCategoryFolder(
    tender: {
      id: string;
      tenderNumber: string;
      projectName?: string | null;
      site?: { name?: string | null } | null;
    },
    category: string,
    actorId?: string
  ) {
    const config = await this.getResolvedConfig();
    const folderName = deriveTenderFolderName(tender);
    const tenderRoot = `${config.tendersRoot}/${folderName}`;
    const segments = category.split("/").filter(Boolean);

    let lastRecord: Awaited<ReturnType<typeof this.ensureFolder>> | null = null;
    let accumulatedPath = tenderRoot;

    for (const segment of segments) {
      accumulatedPath = `${accumulatedPath}/${segment}`;
      lastRecord = await this.ensureFolder(
        {
          name: segment,
          relativePath: accumulatedPath,
          module: "tendering",
          linkedEntityType: "Tender",
          linkedEntityId: tender.id
        },
        actorId
      );
    }

    // Fallback: if category was empty (shouldn't happen), ensure the tender root.
    if (!lastRecord) {
      lastRecord = await this.ensureFolder(
        {
          name: folderName,
          relativePath: tenderRoot,
          module: "tendering",
          linkedEntityType: "Tender",
          linkedEntityId: tender.id
        },
        actorId
      );
    }

    return lastRecord;
  }

  // TFM-S4 — Ensure a per-client subfolder under `Quotes/` for the given
  // tender. Creates:
  //   {tendersRoot}/{tenderFolderName}/Quotes/{sanitisedClientName}/
  //
  // Returns the folder id and relative path of the created/confirmed
  // client subfolder. Reuses the S2 sanitiseSharePointName helper for
  // the client segment so names that would be rejected by Graph are
  // cleaned the same way as the tender folder name itself.
  async ensureTenderQuoteClientFolder(
    tenderId: string,
    clientName: string,
    actorId?: string
  ) {
    const tender = await this.prisma.tender.findUniqueOrThrow({
      where: { id: tenderId },
      select: {
        id: true,
        tenderNumber: true,
        projectName: true,
        site: { select: { name: true } }
      }
    });
    const config = await this.getResolvedConfig();
    const folderName = deriveTenderFolderName(tender);
    const tenderRoot = `${config.tendersRoot}/${folderName}`;

    // Ensure the parent Quotes/ folder first.
    await this.ensureFolder(
      {
        name: "Quotes",
        relativePath: `${tenderRoot}/Quotes`,
        module: "tendering",
        linkedEntityType: "Tender",
        linkedEntityId: tenderId
      },
      actorId
    );

    const sanitised = sanitiseSharePointName(clientName);
    const clientFolderPath = `${tenderRoot}/Quotes/${sanitised}`;
    const record = await this.ensureFolder(
      {
        name: sanitised,
        relativePath: clientFolderPath,
        module: "tendering",
        linkedEntityType: "Tender",
        linkedEntityId: tenderId
      },
      actorId
    );

    return { folderId: record.itemId, folderPath: clientFolderPath, record };
  }

  // TFM-S1 (MIG-3.5) — Pass-through to the adapter's listFolderChildren.
  // MIG-3's SharepointLegacyCopyService calls this via the seam bridge.
  async listFolderChildren(
    siteId: string,
    driveId: string,
    itemId: string,
  ): Promise<FolderChildItem[]> {
    return this.adapter.listFolderChildren(siteId, driveId, itemId);
  }

  // TFM-S1 — Path-based variant for callers that have a relative path rather
  // than a drive item ID (e.g. the MIG-3 legacy copy seam bridge).
  async listFolderChildrenByPath(
    siteId: string,
    driveId: string,
    relativePath: string,
  ): Promise<FolderChildItem[]> {
    return this.adapter.listFolderChildrenByPath(siteId, driveId, relativePath);
  }

  // TFM-S7 — Read-only existence probe for the destination-side guard.
  // Returns false on a legitimate NotFound; rethrows on transport/auth errors.
  // Thin wrapper over the adapter method of the same name.
  async folderExists(
    siteId: string,
    driveId: string,
    relativePath: string,
  ): Promise<boolean> {
    return this.adapter.folderExists({ siteId, driveId, relativePath });
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
