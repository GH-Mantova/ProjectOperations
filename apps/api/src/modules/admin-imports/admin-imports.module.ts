/**
 * AdminImportsModule — wires MIG-2 (TenderTrackerImportService) and
 * MIG-3 (SharepointLegacyCopyService).
 *
 * MIG-3 injects SharePointService from PlatformModule via a bridge adapter
 * (SharePointCopySeamBridge) that satisfies the ISharePointCopySeam interface.
 * TFM-S1 (MIG-3.5) added listFolderChildren / listFolderChildrenByPath to
 * SharePointService, so the bridge now delegates to those methods and no
 * longer throws SeamExtensionRequiredError.
 */

import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { TenderTrackerImportController } from "./tender-tracker-import.controller";
import { TenderTrackerImportService } from "./tender-tracker-import.service";
import {
  SharepointLegacyCopyService,
  SHAREPOINT_COPY_SEAM,
  type ISharePointCopySeam,
  type FolderChildItem,
  type ListFolderChildrenInput,
  type ResolvedConfig,
  type UploadFileResult,
} from "./sharepoint-legacy-copy.service";
import { SharePointService } from "../platform/sharepoint.service";
import type { FolderChildItem as AdapterFolderChildItem } from "../platform/sharepoint.adapter";
import { TenderNumberService } from "../tendering/tender-number.service";
import { TenderFolderBackfillService } from "./tender-folder-backfill.service";

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

/**
 * Bridge adapter that satisfies ISharePointCopySeam using SharePointService.
 * TFM-S1 wired listFolderChildren / listFolderChildrenByPath on the service,
 * so both listing methods now delegate rather than throwing.
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
  ],
  exports: [TenderTrackerImportService, SharepointLegacyCopyService, TenderFolderBackfillService],
})
export class AdminImportsModule {}
