import { Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";

export type EnsureFolderInput = {
  siteId: string;
  driveId: string;
  name: string;
  relativePath: string;
};

export type EnsureFolderResult = {
  siteId: string;
  driveId: string;
  itemId: string;
  name: string;
  relativePath: string;
};

export type UploadFileInput = {
  siteId: string;
  driveId: string;
  folderId: string;
  name: string;
  content: Buffer;
  mimeType?: string;
};

export type UploadFileResult = {
  id: string;
  webUrl: string;
  eTag: string;
};

export interface SharePointAdapter {
  ensureFolder(input: EnsureFolderInput): Promise<EnsureFolderResult>;
  uploadFile(input: UploadFileInput): Promise<UploadFileResult>;
  getDownloadUrl(input: { siteId: string; driveId: string; fileId: string }): Promise<string>;
}

export const SHAREPOINT_ADAPTER = Symbol("SHAREPOINT_ADAPTER");

export const InjectSharePointAdapter = () => Inject(SHAREPOINT_ADAPTER);

@Injectable()
export class MockSharePointAdapter implements SharePointAdapter {
  async ensureFolder(input: EnsureFolderInput) {
    return {
      siteId: input.siteId,
      driveId: input.driveId,
      itemId: `mock-folder-${Buffer.from(input.relativePath).toString("hex").slice(0, 12)}`,
      name: input.name,
      relativePath: input.relativePath
    };
  }

  async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    // Real SharePoint assigns a fresh drive-item id on every upload, so the
    // mock must do the same — otherwise we hit the SharePointFileLink
    // @@unique([siteId, driveId, itemId]) constraint on the second upload.
    // (The old hex-slice scheme captured only the first 6 bytes of
    // "mock-folder-…:filename", which were always "mock-f", so every mock
    // upload across every folder produced the same id and collided.)
    const id = `mock-file-${randomBytes(8).toString("hex")}`;
    return {
      id,
      webUrl: `https://sharepoint.local/mock/${input.folderId}/${input.name}`,
      eTag: `"mock-${Date.now()}"`
    };
  }

  async getDownloadUrl(input: { siteId: string; driveId: string; fileId: string }): Promise<string> {
    return `https://sharepoint.local/mock/download/${input.fileId}`;
  }
}
