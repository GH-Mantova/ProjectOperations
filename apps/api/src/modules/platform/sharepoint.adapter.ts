import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join, resolve } from "node:path";

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

export type DownloadFileBytesInput = {
  siteId: string;
  driveId: string;
  fileId: string;
};

export interface SharePointAdapter {
  ensureFolder(input: EnsureFolderInput): Promise<EnsureFolderResult>;
  uploadFile(input: UploadFileInput): Promise<UploadFileResult>;
  getDownloadUrl(input: { siteId: string; driveId: string; fileId: string }): Promise<string>;
  // PR #146 — added to support drawing tools and any future feature
  // that needs to read uploaded file bytes (asbestos register reading,
  // document preview, AI document analysis, etc.). Throws
  // SharePointFileNotFoundError if fileId doesn't exist.
  downloadFileBytes(input: DownloadFileBytesInput): Promise<Buffer>;
}

// Typed error so callers can distinguish "file legitimately doesn't
// exist" (e.g. orphan TenderDocumentLink whose bytes were never
// persisted) from generic transient storage failures. Drawing tool
// handlers use this to produce a specific user-facing message
// instead of a generic "Failed to fetch drawing from storage".
export class SharePointFileNotFoundError extends Error {
  constructor(
    public readonly fileId: string,
    public readonly siteId: string,
    public readonly driveId: string
  ) {
    super(`SharePoint file not found: ${fileId} (site=${siteId}, drive=${driveId})`);
    this.name = "SharePointFileNotFoundError";
  }
}

export const SHAREPOINT_ADAPTER = Symbol("SHAREPOINT_ADAPTER");

export const InjectSharePointAdapter = () => Inject(SHAREPOINT_ADAPTER);

// Mock storage location. Default is `.local-storage/sharepoint-mock`
// relative to cwd. Both `pnpm --filter @project-ops/api dev` and
// `pnpm --filter @project-ops/api seed` cd into apps/api before
// running, so this resolves to apps/api/.local-storage/sharepoint-mock
// in practice. The .gitignore pattern matches `**/.local-storage/`
// to cover both that path and any other cwd a future caller picks.
// Configurable via SHAREPOINT_MOCK_STORAGE_PATH for tests (which set
// os.tmpdir-based paths to keep test runs isolated). Bytes are keyed
// by upload id — same id returned from uploadFile is the lookup key
// for downloadFileBytes.
const DEFAULT_MOCK_STORAGE_PATH = resolve(
  process.cwd(),
  ".local-storage/sharepoint-mock"
);

export function resolveMockStoragePath(configService?: ConfigService): string {
  return (
    configService?.get<string>("SHAREPOINT_MOCK_STORAGE_PATH") ?? DEFAULT_MOCK_STORAGE_PATH
  );
}

@Injectable()
export class MockSharePointAdapter implements SharePointAdapter {
  private readonly storagePath: string;

  constructor(private readonly configService: ConfigService) {
    this.storagePath = resolveMockStoragePath(configService);
  }

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
    // Real SharePoint assigns a fresh drive-item id on every upload, so
    // the mock must do the same — otherwise we hit the SharePointFileLink
    // @@unique([siteId, driveId, itemId]) constraint on the second
    // upload.
    const id = `mock-file-${randomBytes(8).toString("hex")}`;

    // PR #146 — actually persist bytes. mkdir with recursive:true is a
    // no-op when the directory already exists. Bytes are keyed by id;
    // filename is just the id (we don't preserve the original
    // extension because callers retrieve by id and metadata lives in
    // the DB).
    await mkdir(this.storagePath, { recursive: true });
    await writeFile(join(this.storagePath, id), input.content);

    return {
      id,
      webUrl: `https://sharepoint.local/mock/${input.folderId}/${input.name}`,
      eTag: `"mock-${Date.now()}"`
    };
  }

  async getDownloadUrl(input: { siteId: string; driveId: string; fileId: string }): Promise<string> {
    return `https://sharepoint.local/mock/download/${input.fileId}`;
  }

  async downloadFileBytes(input: DownloadFileBytesInput): Promise<Buffer> {
    const targetPath = join(this.storagePath, input.fileId);
    try {
      await access(targetPath, fsConstants.R_OK);
    } catch {
      throw new SharePointFileNotFoundError(input.fileId, input.siteId, input.driveId);
    }
    return readFile(targetPath);
  }
}
