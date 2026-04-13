import { Test } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";

describe("HealthController", () => {
  it("returns a basic health response", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService]
    }).compile();

    const controller = moduleRef.get(HealthController);
    const result = controller.getHealth();

    expect(result.status).toBe("ok");
    expect(result.service).toBe("project-operations-api");
    expect(result.timestamp).toBeDefined();
  });
});
