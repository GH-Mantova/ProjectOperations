import { ConflictException } from "@nestjs/common";
import { ResourcesService } from "./resources.service";

describe("ResourcesService", () => {
  it("rejects duplicate role suitability for the same worker/role", async () => {
    const service = new ResourcesService(
      {
        workerRoleSuitability: {
          findFirst: jest.fn().mockResolvedValue({ id: "existing" })
        }
      } as never,
      { write: jest.fn() } as never
    );

    await expect(
      service.upsertWorkerRoleSuitability(undefined, { workerId: "worker-1", roleLabel: "Leading Hand" }, "user-1")
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
