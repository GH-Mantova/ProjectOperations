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

export interface SharePointAdapter {
  ensureFolder(input: EnsureFolderInput): Promise<EnsureFolderResult>;
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
}
