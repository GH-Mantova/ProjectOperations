/**
 * AdminImportsModule — wires MIG-2 (TenderTrackerImportService) and
 * MIG-3 (SharepointLegacyCopyService).
 *
 * MIG-3 injects SharePointService from PlatformModule via a bridge adapter
 * (SharePointCopySeamBridge) that satisfies the ISharePointCopySeam interface
 * using only the methods already present on SharePointService.
 * For listFolderChildren / listDestinationFolderChildren (not yet on the
 * seam), the bridge throws SeamExtensionRequiredError at runtime.
 * See sharepoint-legacy-copy.service.ts for the escalation note.
 */

import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { TenderTrackerImportController } from "./tender-tracker-import.controller";
import { TenderTrackerImportService } from "./tender-tracker-import.service";
import {
  SharepointLegacyCopyService,
  SHAREPOINT_COPY_SEAM,
  SeamExtensionRequiredError,
  type ISharePointCopySeam,
  type FolderChildItem,
  type ListFolderChildrenInput,
  type ResolvedConfig,
  type EnsureFolderResult,
  type UploadFileResult,
} from "./sharepoint-legacy-copy.service";
import { SharePointService } from "../platform/sharepoint.service";

/**
 * Bridge adapter that satisfies ISharePointCopySeam using SharePointService.
 * Methods that don't exist on SharePointService throw SeamExtensionRequiredError
 * with clear guidance for the follow-up extension PR (MIG-3.5).
 */
class SharePointCopySeamBridge implements ISharePointCopySeam {
  constructor(private readonly svc: SharePointService) {}

  async getResolvedConfig(): Promise<ResolvedConfig> {
    return this.svc.getResolvedConfig();
  }

  async listFolderChildren(_input: ListFolderChildrenInput): Promise<FolderChildItem[]> {
    throw new SeamExtensionRequiredError("listFolderChildren");
  }

  async downloadFileBytes(input: {
    siteId: string;
    driveId: string;
    fileId: string;
  }): Promise<Buffer> {
    return this.svc.downloadFileBytes(input);
  }

  async listDestinationFolderChildren(
    _input: ListFolderChildrenInput
  ): Promise<FolderChildItem[]> {
    throw new SeamExtensionRequiredError("listDestinationFolderChildren");
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
    SharepointLegacyCopyService,
    {
      provide: SHAREPOINT_COPY_SEAM,
      inject: [SharePointService],
      useFactory: (svc: SharePointService): ISharePointCopySeam =>
        new SharePointCopySeamBridge(svc),
    },
  ],
  exports: [TenderTrackerImportService, SharepointLegacyCopyService],
})
export class AdminImportsModule {}
