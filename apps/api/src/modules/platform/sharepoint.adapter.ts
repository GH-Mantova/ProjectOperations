import { Injectable } from "@nestjs/common";

export type EnsureFolderInput = {
  siteId: string;
  driveId: string;
  name: string;
  relativePath: string;
};

@Injectable()
export class MockSharePointAdapter {
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
