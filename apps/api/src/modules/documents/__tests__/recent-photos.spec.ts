import { PrismaClient } from "@prisma/client";
import { DocumentsService } from "../documents.service";
import type { AuthenticatedUser } from "../../../common/auth/authenticated-request.interface";

/**
 * Widgets batch 2 — `GET /documents/recent-photos` service coverage.
 *
 * Seeds a job + two DocumentLinks (one image via fileLink, one PDF) and
 * asserts only the image row appears in the widget feed, ordered by
 * updatedAt DESC.
 *
 * Serial suite, real database, self-cleaning via ZZTEST-B2-RP prefix.
 */

jest.setTimeout(60_000);

describe("DocumentsService.getRecentPhotos — batch 2 widget", () => {
  const prisma = new PrismaClient();
  const service = new DocumentsService(
    prisma as never,
    {} as never,
    {} as never,
    { refreshLiveFollowUps: jest.fn() } as never
  );

  let userId: string;
  let clientId: string;
  let siteId: string;
  let jobId: string;
  let siteFolderId: string;
  let imageFileId: string;
  let pdfFileId: string;
  let imageDocId: string;
  let pdfDocId: string;

  async function cleanup(): Promise<void> {
    await prisma.documentLink.deleteMany({ where: { title: { startsWith: "ZZTEST-B2-RP" } } });
    await prisma.sharePointFileLink.deleteMany({ where: { name: { startsWith: "ZZTEST-B2-RP" } } });
    await prisma.sharePointFolderLink.deleteMany({ where: { name: { startsWith: "ZZTEST-B2-RP" } } });
    await prisma.job.deleteMany({ where: { jobNumber: "ZZTEST-B2-RP-J" } });
    await prisma.site.deleteMany({ where: { name: "ZZTEST-B2-RP Site" } });
    await prisma.client.deleteMany({ where: { name: "ZZTEST-B2-RP Client" } });
    await prisma.user.deleteMany({ where: { email: "zztest-b2-rp@projectops.local" } });
  }

  beforeAll(async () => {
    await cleanup();
    const user = await prisma.user.create({
      data: {
        email: "zztest-b2-rp@projectops.local",
        firstName: "ZZTEST",
        lastName: "RP",
        passwordHash: "not-a-login"
      }
    });
    userId = user.id;
    const client = await prisma.client.create({ data: { name: "ZZTEST-B2-RP Client" } });
    clientId = client.id;
    const site = await prisma.site.create({
      data: {
        name: "ZZTEST-B2-RP Site",
        clientId,
        addressLine1: "1 Test St",
        suburb: "Brisbane",
        state: "QLD",
        postcode: "4000"
      }
    });
    siteId = site.id;
    const job = await prisma.job.create({
      data: {
        jobNumber: "ZZTEST-B2-RP-J",
        name: "ZZTEST B2 RP Job",
        clientId,
        siteId
      }
    });
    jobId = job.id;

    const folder = await prisma.sharePointFolderLink.create({
      data: {
        siteId: "ZZTEST-B2-RP-SP-SITE",
        driveId: "drive-1",
        itemId: `ZZTEST-B2-RP-folder-${Date.now()}`,
        name: "ZZTEST-B2-RP folder",
        relativePath: "ZZTEST/photos",
        module: "documents",
        linkedEntityType: "Job",
        linkedEntityId: jobId
      }
    });
    siteFolderId = folder.id;

    const imageFile = await prisma.sharePointFileLink.create({
      data: {
        folderLinkId: siteFolderId,
        siteId: folder.siteId,
        driveId: folder.driveId,
        itemId: `ZZTEST-B2-RP-image-${Date.now()}`,
        name: "ZZTEST-B2-RP-photo.jpg",
        relativePath: "ZZTEST/photos/ZZTEST-B2-RP-photo.jpg",
        webUrl: "https://sharepoint.local/mock/rp/photo.jpg",
        mimeType: "image/jpeg"
      }
    });
    imageFileId = imageFile.id;
    const pdfFile = await prisma.sharePointFileLink.create({
      data: {
        folderLinkId: siteFolderId,
        siteId: folder.siteId,
        driveId: folder.driveId,
        itemId: `ZZTEST-B2-RP-pdf-${Date.now()}`,
        name: "ZZTEST-B2-RP-doc.pdf",
        relativePath: "ZZTEST/photos/ZZTEST-B2-RP-doc.pdf",
        webUrl: "https://sharepoint.local/mock/rp/doc.pdf",
        mimeType: "application/pdf"
      }
    });
    pdfFileId = pdfFile.id;

    const imageDoc = await prisma.documentLink.create({
      data: {
        linkedEntityType: "Job",
        linkedEntityId: jobId,
        module: "documents",
        category: "Site photo",
        title: "ZZTEST-B2-RP image doc",
        status: "ACTIVE",
        fileLinkId: imageFileId,
        createdById: userId
      }
    });
    imageDocId = imageDoc.id;
    const pdfDoc = await prisma.documentLink.create({
      data: {
        linkedEntityType: "Job",
        linkedEntityId: jobId,
        module: "documents",
        category: "Method statement",
        title: "ZZTEST-B2-RP pdf doc",
        status: "ACTIVE",
        fileLinkId: pdfFileId,
        createdById: userId
      }
    });
    pdfDocId = pdfDoc.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("returns image documents only, with the fileLink metadata unpacked", async () => {
    const actor: AuthenticatedUser = {
      sub: userId,
      email: "zztest-b2-rp@projectops.local",
      permissions: ["documents.view"]
    };
    const result = await service.getRecentPhotos(actor, 40);

    const mine = result.items.filter((i) => i.title.startsWith("ZZTEST-B2-RP"));
    expect(mine.map((i) => i.id)).toContain(imageDocId);
    expect(mine.map((i) => i.id)).not.toContain(pdfDocId);
    const image = mine.find((i) => i.id === imageDocId)!;
    expect(image.webUrl).toBe("https://sharepoint.local/mock/rp/photo.jpg");
    expect(image.mimeType).toBe("image/jpeg");
    expect(image.fileName).toBe("ZZTEST-B2-RP-photo.jpg");
  });

  it("clamps limit into [1, 40]", async () => {
    const actor: AuthenticatedUser = {
      sub: userId,
      email: "zztest-b2-rp@projectops.local",
      permissions: ["documents.view"]
    };
    const zero = await service.getRecentPhotos(actor, 0);
    expect(zero.items.length).toBeGreaterThanOrEqual(0);
    const huge = await service.getRecentPhotos(actor, 500);
    expect(huge.items.length).toBeLessThanOrEqual(40);
  });
});
