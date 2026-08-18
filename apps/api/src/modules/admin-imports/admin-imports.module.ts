/**
 * AdminImportsModule — wires MIG-2 (TenderTrackerImportService) and
 * MIG-3 (SharepointLegacyCopyService).
 *
 * MIG-3 injects SharePointService from PlatformModule via a bridge adapter
 * (SharePointCopySeamBridge) that satisfies the ISharePointCopySeam interface.
 * TFM-S1 (MIG-3.5) added listFolderChildren / listFolderChildrenByPath to
 * SharePointService, so the bridge now delegates to those methods and no
 * longer throws SeamExtensionRequiredError.
 *
 * TFM-S6: LEGACY_TENDERS_ROOT_PATH is injected from legacyTendersRoot
 * (apps/api/src/config/sharepoint.config.ts) so the legacy copy service can
 * walk the two-level month/tender tree independently of the destination root.
 */

import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { TenderTrackerImportController } from "./tender-tracker-import.controller";
import { TenderTrackerImportService } from "./tender-tracker-import.service";
import {
  SharepointLegacyCopyService,
  SHAREPOINT_COPY_SEAM,
  LEGACY_TENDERS_ROOT_PATH,
  type ISharePointCopySeam,
  type FolderChildItem,
  type LegacyFolderItem,
  type ListFolderChildrenInput,
  type ResolvedConfig,
  type UploadFileResult,
} from "./sharepoint-legacy-copy.service";
import { SharePointService } from "../platform/sharepoint.service";
import type { FolderChildItem as AdapterFolderChildItem } from "../platform/sharepoint.adapter";
import { TenderNumberService } from "../tendering/tender-number.service";
import { TenderFolderBackfillService } from "./tender-folder-backfill.service";
import { legacyTendersRoot } from "../../config/sharepoint.config";

// Map the adapter's FolderChildItem shape (id/name/isFolder/size/webUrl)
// to the copy seam's FolderChildItem shape (name/fileId/size/eTag).
// Only file children (isFolder=false) are relevant for the copy job.
function mapAdapterChildren(items: AdapterFolderChildItem[]): FolderChildItem[] {
  return items
    .filter((item) => !item.isFolder)
    .map((item) => ({
      name: item.name,
      fileId: item.id,
      size: item.size ?? 0,
    }));
}

// Map the adapter's FolderChildItem shape to LegacyFolderItem (used for the
// two-level walk in listLegacyTenderFolders — includes both files and folders).
function mapAdapterItemsToLegacyFolderItems(items: AdapterFolderChildItem[]): LegacyFolderItem[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    isFolder: item.isFolder,
  }));
}

/**
 * Bridge adapter that satisfies ISharePointCopySeam using SharePointService.
 * TFM-S1 wired listFolderChildren / listFolderChildrenByPath on the service,
 * so both listing methods now delegate rather than throwing.
 * TFM-S6 adds listFolderItemsById and resolveItemIdByPath for the two-level
 * month/tender walk on the legacy tree.
 */
class SharePointCopySeamBridge implements ISharePointCopySeam {
  constructor(private readonly svc: SharePointService) {}

  async getResolvedConfig(): Promise<ResolvedConfig> {
    return this.svc.getResolvedConfig();
  }

  async listFolderChildren(input: ListFolderChildrenInput): Promise<FolderChildItem[]> {
    const items = await this.svc.listFolderChildrenByPath(
      input.siteId,
      input.driveId,
      input.relativePath,
    );
    return mapAdapterChildren(items);
  }

  async listFolderItemsById(
    siteId: string,
    driveId: string,
    itemId: string,
  ): Promise<LegacyFolderItem[]> {
    const items = await this.svc.listFolderChildren(siteId, driveId, itemId);
    return mapAdapterItemsToLegacyFolderItems(items);
  }

  async resolveItemIdByPath(
    siteId: string,
    driveId: string,
    relativePath: string,
  ): Promise<string | null> {
    // Use listFolderChildrenByPath on the PARENT to find the item ID for the
    // target path. This avoids needing a dedicated resolvePath adapter method.
    // We split the path into parent + leaf, list the parent's children, and
    // find the leaf by name.
    const lastSlash = relativePath.lastIndexOf("/");
    if (lastSlash === -1) {
      // Top-level folder — list drive root children and find by name.
      const rootChildren = await this.svc.listFolderChildrenByPath(siteId, driveId, "");
      const found = rootChildren.find((c) => c.name === relativePath && c.isFolder);
      return found?.id ?? null;
    }

    const parentPath = relativePath.slice(0, lastSlash);
    const leafName = relativePath.slice(lastSlash + 1);

    let parentChildren: AdapterFolderChildItem[];
    try {
      parentChildren = await this.svc.listFolderChildrenByPath(siteId, driveId, parentPath);
    } catch {
      return null;
    }

    const found = parentChildren.find((c) => c.name === leafName && c.isFolder);
    return found?.id ?? null;
  }

  async downloadFileBytes(input: {
    siteId: string;
    driveId: string;
    fileId: string;
  }): Promise<Buffer> {
    return this.svc.downloadFileBytes(input);
  }

  async listDestinationFolderChildren(
    input: ListFolderChildrenInput
  ): Promise<FolderChildItem[]> {
    const items = await this.svc.listFolderChildrenByPath(
      input.siteId,
      input.driveId,
      input.relativePath,
    );
    return mapAdapterChildren(items);
  }

  async uploadFile(input: {
    siteId: string;
    driveId: string;
    folderId: string;
    name: string;
    content: Buffer;
    mimeType?: string;
  }): Promise<UploadFileResult> {
    return this.svc.uploadFile(input);
  }
}

@Module({
  imports: [PlatformModule],
  controllers: [TenderTrackerImportController],
  providers: [
    TenderTrackerImportService,
    TenderNumberService,
    SharepointLegacyCopyService,
    TenderFolderBackfillService,
    {
      provide: SHAREPOINT_COPY_SEAM,
      inject: [SharePointService],
      useFactory: (svc: SharePointService): ISharePointCopySeam =>
        new SharePointCopySeamBridge(svc),
    },
    {
      provide: LEGACY_TENDERS_ROOT_PATH,
      useValue: legacyTendersRoot,
    },
  ],
  exports: [TenderTrackerImportService, SharepointLegacyCopyService, TenderFolderBackfillService],
})
export class AdminImportsModule {}
