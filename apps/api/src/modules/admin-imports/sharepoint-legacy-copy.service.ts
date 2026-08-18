/**
 * MIG-3 — SharePoint legacy-folder copy job.
 *
 * For every imported Tender whose title matches /T\d{3,5}/ and that has a
 * SharePointFolderLink destination, this service:
 *   - Locates the legacy SharePoint folder whose name matches that T-number
 *     under the configured legacy root (see TFM-S6).
 *   - Copies each file in the legacy folder to the ERP-created destination
 *     folder via the existing SharePoint seam (download + re-upload).
 *   - Skips files that are already present at the destination (idempotency).
 *
 * Decision references (from docs/plans/tender-tracker-migration-plan.md):
 *   D3  T-number is the idempotency key embedded in Tender.title.
 *   D8  Copy via the EXISTING Graph seam — no new Graph/MSAL client.
 *       escalates: true — Azure environment.
 *   D9  No real folder names or client data in fixtures.
 *
 * TFM-S6 changes:
 *   - legacyTendersRoot (from apps/api/src/config/sharepoint.config.ts) is
 *     separately configurable from the destination tendersRoot.
 *   - The legacy tree is two levels deep: {legacyRoot}/{month}/{T-number folder}.
 *   - listLegacyTenderFolders() walks both levels and returns all tender folders
 *     with their monthFolder label.
 *   - plan() uses listLegacyTenderFolders() instead of single-level path guessing.
 *
 * -------------------------------------------------------------------------
 * SEAM GAP — ESCALATION REQUIRED BEFORE PRODUCTION USE
 * -------------------------------------------------------------------------
 * The existing SharePointAdapter interface does not expose a method to list
 * the children (files) of a folder by path or itemId. The copy job requires
 * this capability to enumerate legacy files before downloading + re-uploading
 * them. A seam extension PR ("MIG-3.5") must add:
 *
 *   listFolderChildren(input: ListFolderChildrenInput): Promise<FolderChildItem[]>
 *
 * to SharePointAdapter, MockSharePointAdapter, and GraphSharePointAdapter
 * (using GET /sites/{siteId}/drives/{driveId}/root:/{path}:/children on
 * Graph). Until that lands, the module wires a `SharePointCopySeamBridge`
 * that throws `SeamExtensionRequiredError` at runtime so the gap is visible
 * immediately rather than silently skipping files.
 *
 * The controller, service, plan/execute types, T-number matching logic,
 * idempotency check, and full test suite are all shipped in this PR so that
 * MIG-3.5 only needs to implement listFolderChildren — no architectural
 * decisions remain.
 * -------------------------------------------------------------------------
 */

import { Injectable, Logger } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// ---------------------------------------------------------------------------
// Seam interface (local to admin-imports)
// ---------------------------------------------------------------------------

/**
 * A file item returned by listing a folder's children.
 * name   — the filename (e.g. "Specs.pdf")
 * fileId — drive item ID, used for download
 * size   — bytes; used for idempotency comparison
 * eTag   — optional; used for idempotency comparison when available
 */
export type FolderChildItem = {
  name: string;
  fileId: string;
  size: number;
  eTag?: string;
};

/**
 * A folder item returned by listing a folder's immediate children.
 * Used by listLegacyTenderFolders() when walking the month-level folders.
 * id     — drive item ID, used to enumerate children in the next level
 * name   — folder name (e.g. "8. Aug" for a month, "T2096 - Cornerstone" for a tender)
 * isFolder — always true for items returned here, but typed for safety
 */
export type LegacyFolderItem = {
  id: string;
  name: string;
  isFolder: boolean;
};

export type ListFolderChildrenInput = {
  siteId: string;
  driveId: string;
  /** Absolute path relative to the drive root, e.g. "Legacy Tenders/T1234" */
  relativePath: string;
};

export type EnsureFolderResult = {
  siteId: string;
  driveId: string;
  itemId: string;
  name: string;
  relativePath: string;
};

export type UploadFileResult = {
  id: string;
  webUrl: string;
  eTag: string;
};

export type ResolvedConfig = {
  mode: string;
  siteId: string;
  driveId: string;
  tendersRoot: string;
};

/**
 * Local seam interface — only the capabilities MIG-3 needs from SharePoint.
 * Injected via SHAREPOINT_COPY_SEAM token so tests can provide a full mock
 * and the module can wire the bridge adapter (see admin-imports.module.ts).
 */
export interface ISharePointCopySeam {
  getResolvedConfig(): Promise<ResolvedConfig>;
  /**
   * List the immediate file children of the folder at `relativePath`.
   * Returns [] if the folder is empty or does not exist (no-throw for
   * "folder not found" — the service treats that as "no legacy folder").
   *
   * NOTE: This method is NOT yet present on SharePointAdapter.
   * Until the seam extension lands, the bridge throws SeamExtensionRequiredError.
   */
  listFolderChildren(input: ListFolderChildrenInput): Promise<FolderChildItem[]>;
  /**
   * List ALL immediate children (files AND folders) of the folder identified
   * by its drive item ID. Returns [] when the folder is empty or absent.
   * Used by listLegacyTenderFolders() to walk month folders and tender folders
   * one level at a time using stable item IDs rather than constructed paths.
   */
  listFolderItemsById(siteId: string, driveId: string, itemId: string): Promise<LegacyFolderItem[]>;
  /**
   * Resolve the drive item ID for a folder identified by its path relative to
   * the drive root. Returns null when the folder does not exist.
   * Used to resolve legacyTendersRoot once at bootstrap.
   */
  resolveItemIdByPath(siteId: string, driveId: string, relativePath: string): Promise<string | null>;
  /**
   * Download the raw bytes of a file by its drive item ID.
   */
  downloadFileBytes(input: {
    siteId: string;
    driveId: string;
    fileId: string;
  }): Promise<Buffer>;
  /**
   * List the immediate file children of the DESTINATION folder so the
   * service can check for already-present files (idempotency).
   * Same seam extension requirement as listFolderChildren.
   */
  listDestinationFolderChildren(input: ListFolderChildrenInput): Promise<FolderChildItem[]>;
  /**
   * Upload a file into the folder identified by `folderId`.
   */
  uploadFile(input: {
    siteId: string;
    driveId: string;
    folderId: string;
    name: string;
    content: Buffer;
    mimeType?: string;
  }): Promise<UploadFileResult>;
}

export const SHAREPOINT_COPY_SEAM = Symbol("SHAREPOINT_COPY_SEAM");
export const InjectSharePointCopySeam = () => Inject(SHAREPOINT_COPY_SEAM);

/**
 * Injection token for the legacy tenders root path.
 * Populated in admin-imports.module.ts from legacyTendersRoot config constant.
 */
export const LEGACY_TENDERS_ROOT_PATH = Symbol("LEGACY_TENDERS_ROOT_PATH");

// ---------------------------------------------------------------------------
// Report types
// ---------------------------------------------------------------------------

export interface MatchCandidate {
  /** ERP Tender id */
  tenderId: string;
  /** Tender title (e.g. "T1234 — Bridge Upgrade") */
  tenderTitle: string;
  /** Extracted T-number (e.g. "T1234") */
  tNumber: string;
  /** Relative path of the located legacy SharePoint folder */
  legacyFolderPath: string;
  /** Relative path of the ERP destination folder */
  destinationFolderPath: string;
  /** Destination folder drive item ID */
  destinationFolderItemId: string;
  /** Number of files found in the legacy folder */
  legacyFileCount: number;
}

export interface LegacyCopyPlan {
  /** Match candidates (legacy folder found, destination folder known) */
  matched: MatchCandidate[];
  /** Tenders with a T-number but no matching legacy folder */
  unmatchedTenders: Array<{ tenderId: string; tNumber: string; tenderTitle: string }>;
  /** Legacy T-number folders that do not match any imported tender title */
  unmatchedLegacyFolders: Array<{ tNumber: string; legacyFolderPath: string }>;
  /** Tenders whose title has no T-number (silently ignored) */
  noTNumberCount: number;
  /** Tenders with a T-number but no SharePointFolderLink destination */
  noDestination: Array<{ tenderId: string; tNumber: string; tenderTitle: string }>;
}

export interface FileCopyResult {
  name: string;
  outcome: "copied" | "skipped" | "error";
  reason?: string;
}

export interface MatchExecutionResult {
  tenderId: string;
  tNumber: string;
  files: FileCopyResult[];
  copied: number;
  alreadyPresent: number;
  errors: number;
}

export interface LegacyCopyExecutionReport {
  matchesAttempted: number;
  matchResults: MatchExecutionResult[];
  totalCopied: number;
  totalAlreadyPresent: number;
  totalErrors: number;
  /** Tenders skipped because plan produced no match */
  unmatchedTenderCount: number;
  /** Tenders skipped because no SharePointFolderLink destination */
  noDestinationCount: number;
}

// ---------------------------------------------------------------------------
// T-number extraction
// ---------------------------------------------------------------------------

const T_NUMBER_REGEX = /\bT(\d{3,5})\b/;

/** Extracts "T####" from a tender title, or null if none. */
export function extractTNumber(title: string): string | null {
  const match = T_NUMBER_REGEX.exec(title);
  return match ? `T${match[1]}` : null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class SharepointLegacyCopyService {
  private readonly logger = new Logger(SharepointLegacyCopyService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectSharePointCopySeam() private readonly sharepoint: ISharePointCopySeam,
    @Inject(LEGACY_TENDERS_ROOT_PATH) private readonly legacyRootPath: string
  ) {}

  // -------------------------------------------------------------------------
  // listLegacyTenderFolders() — two-level walk of the legacy tree
  // -------------------------------------------------------------------------

  /**
   * Enumerate all tender folders in the legacy tree by walking two levels:
   *   {legacyRootPath}/{month}/{tender folder}
   *
   * Month folders that contain non-folder files are walked without error
   * and the files are skipped. Returns every discovered tender folder with
   * its monthFolder label.
   *
   * The legacy root's item ID is resolved on first call via
   * resolveItemIdByPath; subsequent calls reuse the cached ID.
   */
  async listLegacyTenderFolders(): Promise<
    Array<{ id: string; name: string; monthFolder: string }>
  > {
    const config = await this.sharepoint.getResolvedConfig();

    // Resolve the legacy root item ID once (first call or after an error).
    const rootItemId = await this.sharepoint.resolveItemIdByPath(
      config.siteId,
      config.driveId,
      this.legacyRootPath
    );

    if (!rootItemId) {
      this.logger.warn(
        `listLegacyTenderFolders: legacy root "${this.legacyRootPath}" not found — returning empty list`
      );
      return [];
    }

    const monthFolders = await this.sharepoint.listFolderItemsById(
      config.siteId,
      config.driveId,
      rootItemId
    );

    const tenders: Array<{ id: string; name: string; monthFolder: string }> = [];

    for (const month of monthFolders.filter((m) => m.isFolder)) {
      const children = await this.sharepoint.listFolderItemsById(
        config.siteId,
        config.driveId,
        month.id
      );
      for (const child of children.filter((c) => c.isFolder)) {
        tenders.push({ id: child.id, name: child.name, monthFolder: month.name });
      }
    }

    return tenders;
  }

  // -------------------------------------------------------------------------
  // plan() — dry-run: enumerate matches, no writes
  // -------------------------------------------------------------------------

  async plan(): Promise<LegacyCopyPlan> {
    const config = await this.sharepoint.getResolvedConfig();

    // Load all tenders
    const tenders = await this.prisma.tender.findMany({
      select: {
        id: true,
        title: true,
        tenderNumber: true,
      },
    });

    // Load all SharePointFolderLinks that belong to Tenders
    const folderLinks = await this.prisma.sharePointFolderLink.findMany({
      where: { linkedEntityType: "Tender" },
      select: {
        linkedEntityId: true,
        itemId: true,
        relativePath: true,
        siteId: true,
        driveId: true,
      },
    });

    // Build lookup: tenderId → folder link
    const folderLinkByTenderId = new Map(
      folderLinks
        .filter((fl) => fl.linkedEntityId !== null)
        .map((fl) => [fl.linkedEntityId as string, fl])
    );

    const matched: MatchCandidate[] = [];
    const unmatchedTenders: LegacyCopyPlan["unmatchedTenders"] = [];
    const noDestination: LegacyCopyPlan["noDestination"] = [];
    let noTNumberCount = 0;

    // Build a set of all T-numbers that have imported tenders (for reverse lookup)
    const importedTNumbers = new Map<string, (typeof tenders)[0]>();

    for (const tender of tenders) {
      const tNum = extractTNumber(tender.title);
      if (!tNum) {
        noTNumberCount++;
        continue;
      }
      importedTNumbers.set(tNum, tender);
    }

    // Enumerate all legacy tender folders via the two-level walk (TFM-S6).
    // Build a lookup: T-number → { id, name, monthFolder } for fast matching.
    let legacyFoldersByTNumber: Map<
      string,
      { id: string; name: string; monthFolder: string }
    >;
    try {
      const allLegacyFolders = await this.listLegacyTenderFolders();
      legacyFoldersByTNumber = new Map();
      for (const folder of allLegacyFolders) {
        const tNum = extractTNumber(folder.name);
        if (tNum) {
          legacyFoldersByTNumber.set(tNum, folder);
        }
      }
    } catch (err) {
      if (err instanceof SeamExtensionRequiredError) throw err;
      throw err;
    }

    // For each T-number-bearing tender, try to find its legacy folder
    for (const [tNum, tender] of importedTNumbers) {
      const destinationLink = folderLinkByTenderId.get(tender.id);
      if (!destinationLink) {
        noDestination.push({
          tenderId: tender.id,
          tNumber: tNum,
          tenderTitle: tender.title,
        });
        continue;
      }

      const legacyFolder = legacyFoldersByTNumber.get(tNum);
      if (!legacyFolder) {
        unmatchedTenders.push({
          tenderId: tender.id,
          tNumber: tNum,
          tenderTitle: tender.title,
        });
        continue;
      }

      // Legacy folder path is two levels deep: root/month/folder
      const legacyFolderPath = `${this.legacyRootPath}/${legacyFolder.monthFolder}/${legacyFolder.name}`;

      let legacyChildren: FolderChildItem[] = [];
      try {
        legacyChildren = await this.sharepoint.listFolderChildren({
          siteId: config.siteId,
          driveId: config.driveId,
          relativePath: legacyFolderPath,
        });
      } catch (err) {
        if (err instanceof SeamExtensionRequiredError) {
          throw err;
        }
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `plan(): failed to list legacy folder ${legacyFolderPath}: ${msg}`
        );
        unmatchedTenders.push({
          tenderId: tender.id,
          tNumber: tNum,
          tenderTitle: tender.title,
        });
        continue;
      }

      matched.push({
        tenderId: tender.id,
        tenderTitle: tender.title,
        tNumber: tNum,
        legacyFolderPath,
        destinationFolderPath: destinationLink.relativePath,
        destinationFolderItemId: destinationLink.itemId,
        legacyFileCount: legacyChildren.length,
      });
    }

    // Build unmatchedLegacyFolders: legacy T-number folders not matched to any imported tender
    const unmatchedLegacyFolders: LegacyCopyPlan["unmatchedLegacyFolders"] = [];
    for (const [tNum, folder] of legacyFoldersByTNumber) {
      if (!importedTNumbers.has(tNum)) {
        unmatchedLegacyFolders.push({
          tNumber: tNum,
          legacyFolderPath: `${this.legacyRootPath}/${folder.monthFolder}/${folder.name}`,
        });
      }
    }

    this.logger.log(
      `plan(): matched=${matched.length} unmatchedTenders=${unmatchedTenders.length} noDestination=${noDestination.length} noTNumber=${noTNumberCount} unmatchedLegacy=${unmatchedLegacyFolders.length}`
    );

    return {
      matched,
      unmatchedTenders,
      unmatchedLegacyFolders,
      noTNumberCount,
      noDestination,
    };
  }

  // -------------------------------------------------------------------------
  // execute() — commit: copy files, skip already-present (idempotent)
  // -------------------------------------------------------------------------

  async execute(): Promise<LegacyCopyExecutionReport> {
    const plan = await this.plan();
    const config = await this.sharepoint.getResolvedConfig();

    const matchResults: MatchExecutionResult[] = [];
    let totalCopied = 0;
    let totalAlreadyPresent = 0;
    let totalErrors = 0;

    for (const candidate of plan.matched) {
      const result = await this.copyMatchCandidate(candidate, config);
      matchResults.push(result);
      totalCopied += result.copied;
      totalAlreadyPresent += result.alreadyPresent;
      totalErrors += result.errors;
    }

    this.logger.log(
      `execute(): matched=${plan.matched.length} copied=${totalCopied} alreadyPresent=${totalAlreadyPresent} errors=${totalErrors}`
    );

    return {
      matchesAttempted: plan.matched.length,
      matchResults,
      totalCopied,
      totalAlreadyPresent,
      totalErrors,
      unmatchedTenderCount: plan.unmatchedTenders.length,
      noDestinationCount: plan.noDestination.length,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async copyMatchCandidate(
    candidate: MatchCandidate,
    config: ResolvedConfig
  ): Promise<MatchExecutionResult> {
    const files: FileCopyResult[] = [];
    let copied = 0;
    let alreadyPresent = 0;
    let errors = 0;

    // Enumerate legacy files
    let legacyChildren: FolderChildItem[] = [];
    try {
      legacyChildren = await this.sharepoint.listFolderChildren({
        siteId: config.siteId,
        driveId: config.driveId,
        relativePath: candidate.legacyFolderPath,
      });
    } catch (err) {
      if (err instanceof SeamExtensionRequiredError) throw err;
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `execute(): failed to list legacy folder ${candidate.legacyFolderPath}: ${reason}`
      );
      files.push({ name: "(list-failed)", outcome: "error", reason });
      errors++;
      return { tenderId: candidate.tenderId, tNumber: candidate.tNumber, files, copied, alreadyPresent, errors };
    }

    // Enumerate destination files for idempotency check
    let destChildren: FolderChildItem[] = [];
    try {
      destChildren = await this.sharepoint.listDestinationFolderChildren({
        siteId: config.siteId,
        driveId: config.driveId,
        relativePath: candidate.destinationFolderPath,
      });
    } catch (err) {
      if (err instanceof SeamExtensionRequiredError) throw err;
      // Non-fatal: if we can't list dest, assume empty and copy everything
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `execute(): failed to list destination folder ${candidate.destinationFolderPath}, assuming empty: ${reason}`
      );
    }

    // Build a lookup of existing destination files by name+size for idempotency
    const destByNameAndSize = new Map<string, FolderChildItem>();
    for (const df of destChildren) {
      destByNameAndSize.set(`${df.name}::${df.size}`, df);
    }

    for (const legacy of legacyChildren) {
      const idempotencyKey = `${legacy.name}::${legacy.size}`;
      if (destByNameAndSize.has(idempotencyKey)) {
        files.push({ name: legacy.name, outcome: "skipped", reason: "already present" });
        alreadyPresent++;
        continue;
      }

      try {
        const bytes = await this.sharepoint.downloadFileBytes({
          siteId: config.siteId,
          driveId: config.driveId,
          fileId: legacy.fileId,
        });
        await this.sharepoint.uploadFile({
          siteId: config.siteId,
          driveId: config.driveId,
          folderId: candidate.destinationFolderItemId,
          name: legacy.name,
          content: bytes,
        });
        files.push({ name: legacy.name, outcome: "copied" });
        copied++;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `execute(): failed to copy file ${legacy.name} for ${candidate.tNumber}: ${reason}`
        );
        files.push({ name: legacy.name, outcome: "error", reason });
        errors++;
      }
    }

    return { tenderId: candidate.tenderId, tNumber: candidate.tNumber, files, copied, alreadyPresent, errors };
  }
}

// ---------------------------------------------------------------------------
// SeamExtensionRequiredError
// ---------------------------------------------------------------------------

/**
 * Thrown at runtime when the SharePoint seam bridge is called for a method
 * that does not yet exist on SharePointService/SharePointAdapter.
 *
 * To resolve: implement `listFolderChildren` on SharePointAdapter,
 * MockSharePointAdapter, GraphSharePointAdapter, and expose it on
 * SharePointService. See PR body for the MIG-3.5 escalation note.
 */
export class SeamExtensionRequiredError extends Error {
  constructor(method: string) {
    super(
      `SharePoint seam extension required: '${method}' is not yet available on SharePointAdapter. ` +
        `A follow-up PR (MIG-3.5) must add listFolderChildren to the adapter interface and both ` +
        `implementations (MockSharePointAdapter, GraphSharePointAdapter) before this job can run ` +
        `against a live SharePoint drive. See the MIG-3 PR body for details.`
    );
    this.name = "SeamExtensionRequiredError";
  }
}
