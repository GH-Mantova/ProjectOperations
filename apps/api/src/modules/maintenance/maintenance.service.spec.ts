import { ConflictException } from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service";

describe("MaintenanceService", () => {
  it("rejects no-op asset status updates", async () => {
    const service = new MaintenanceService(
      {
        asset: {
          findUnique: jest.fn().mockResolvedValue({ id: "asset-1", status: "AVAILABLE" })
        }
      } as never,
      { write: jest.fn() } as never
    );

    await expect(
      service.updateAssetStatus("asset-1", { status: "AVAILABLE" }, "user-1")
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
