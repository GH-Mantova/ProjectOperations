import { Inject, Injectable } from "@nestjs/common";

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
    const id = `mock-file-${Buffer.from(`${input.folderId}:${input.name}`).toString("hex").slice(0, 12)}`;
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
