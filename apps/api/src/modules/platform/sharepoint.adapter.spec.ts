import { ConfigService } from "@nestjs/config";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import {
  MockSharePointAdapter,
  SharePointFileNotFoundError
} from "./sharepoint.adapter";

// PR #146 — MockSharePointAdapter now persists bytes locally so
// drawing tools and other consumers have something to read. Tests use
// a per-suite tmpdir to keep runs hermetic and reset between cases.

function buildConfig(storagePath: string): ConfigService {
  return {
    get: <T>(key: string, defaultValue?: T) => {
      if (key === "SHAREPOINT_MOCK_STORAGE_PATH") return storagePath as T;
      return defaultValue;
    }
  } as ConfigService;
}

describe("MockSharePointAdapter", () => {
  let adapter: MockSharePointAdapter;
  let storagePath: string;

  beforeEach(() => {
    storagePath = join(tmpdir(), `sp-mock-${randomBytes(4).toString("hex")}`);
    adapter = new MockSharePointAdapter(buildConfig(storagePath));
  });

  afterEach(async () => {
    await rm(storagePath, { recursive: true, force: true });
  });

  describe("uploadFile + downloadFileBytes round-trip", () => {
    it("persists bytes on upload and retrieves them on download", async () => {
      const content = Buffer.from("hello world", "utf-8");
      const upload = await adapter.uploadFile({
        siteId: "site-1",
        driveId: "drive-1",
        folderId: "folder-1",
        name: "test.pdf",
        content,
        mimeType: "application/pdf"
      });

      const downloaded = await adapter.downloadFileBytes({
        siteId: "site-1",
        driveId: "drive-1",
        fileId: upload.id
      });

      expect(downloaded.equals(content)).toBe(true);
    });

    it("returns a different id on each upload (no collisions)", async () => {
      const u1 = await adapter.uploadFile({
        siteId: "s",
        driveId: "d",
        folderId: "f",
        name: "a.pdf",
        content: Buffer.from("a")
      });
      const u2 = await adapter.uploadFile({
        siteId: "s",
        driveId: "d",
        folderId: "f",
        name: "a.pdf",
        content: Buffer.from("b")
      });
      expect(u1.id).not.toBe(u2.id);
    });

    it("persists multiple files independently", async () => {
      const u1 = await adapter.uploadFile({
        siteId: "s",
        driveId: "d",
        folderId: "f",
        name: "a.pdf",
        content: Buffer.from("aaa")
      });
      const u2 = await adapter.uploadFile({
        siteId: "s",
        driveId: "d",
        folderId: "f",
        name: "b.pdf",
        content: Buffer.from("bbbb")
      });

      const r1 = await adapter.downloadFileBytes({ siteId: "s", driveId: "d", fileId: u1.id });
      const r2 = await adapter.downloadFileBytes({ siteId: "s", driveId: "d", fileId: u2.id });

      expect(r1.toString()).toBe("aaa");
      expect(r2.toString()).toBe("bbbb");
    });
  });

  describe("downloadFileBytes error handling", () => {
    it("throws SharePointFileNotFoundError for a missing fileId", async () => {
      await expect(
        adapter.downloadFileBytes({
          siteId: "s",
          driveId: "d",
          fileId: "nonexistent"
        })
      ).rejects.toBeInstanceOf(SharePointFileNotFoundError);
    });

    it("error carries fileId, siteId, driveId for debugging", async () => {
      try {
        await adapter.downloadFileBytes({
          siteId: "site-x",
          driveId: "drive-y",
          fileId: "id-z"
        });
        throw new Error("expected throw");
      } catch (err) {
        expect(err).toBeInstanceOf(SharePointFileNotFoundError);
        expect((err as SharePointFileNotFoundError).fileId).toBe("id-z");
        expect((err as SharePointFileNotFoundError).siteId).toBe("site-x");
        expect((err as SharePointFileNotFoundError).driveId).toBe("drive-y");
      }
    });
  });

  describe("persistence across instances", () => {
    it("a fresh adapter pointing at the same storage path can read prior uploads", async () => {
      const upload = await adapter.uploadFile({
        siteId: "s",
        driveId: "d",
        folderId: "f",
        name: "test.pdf",
        content: Buffer.from("persistent")
      });

      const adapter2 = new MockSharePointAdapter(buildConfig(storagePath));
      const downloaded = await adapter2.downloadFileBytes({
        siteId: "s",
        driveId: "d",
        fileId: upload.id
      });

      expect(downloaded.toString()).toBe("persistent");
    });
  });

  describe("upload buffer immutability", () => {
    it("does not mutate the input buffer", async () => {
      const content = Buffer.from("original");
      const original = Buffer.from(content);
      await adapter.uploadFile({
        siteId: "s",
        driveId: "d",
        folderId: "f",
        name: "x.pdf",
        content
      });
      expect(content.equals(original)).toBe(true);
    });
  });

  describe("getDownloadUrl unchanged", () => {
    it("still returns the synthetic mock URL (legacy callers)", async () => {
      const url = await adapter.getDownloadUrl({
        siteId: "s",
        driveId: "d",
        fileId: "some-id"
      });
      expect(url).toContain("some-id");
      expect(url).toMatch(/sharepoint\.local\/mock\/download/);
    });
  });
});
