import { ConflictException } from "@nestjs/common";
import { AssetsService } from "./assets.service";

describe("AssetsService", () => {
  it("rejects duplicate asset category names", async () => {
    const service = new AssetsService(
      {
        assetCategory: {
          findFirst: jest.fn().mockResolvedValue({ id: "category-1" })
        }
      } as never,
      { write: jest.fn() } as never
    );

    await expect(
      service.upsertCategory(undefined, { name: "Plant" }, "user-1")
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
