import { BadRequestException } from "@nestjs/common";
import { PlatformConfigController } from "./platform-config.controller";
import type { PlatformConfigService } from "./platform-config.service";

type MockService = {
  status: jest.Mock;
  setModel: jest.Mock;
  setPreferredProvider: jest.Mock;
};

function makeService(overrides: Partial<MockService> = {}): MockService {
  return {
    status: jest.fn().mockResolvedValue({ preferredProvider: null, activeProvider: null }),
    setModel: jest.fn().mockResolvedValue(undefined),
    setPreferredProvider: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

const ACTOR = { sub: "user-1" };

function makeController(svc: MockService): PlatformConfigController {
  return new PlatformConfigController(svc as unknown as PlatformConfigService);
}

describe("PlatformConfigController.update", () => {
  it("rejects anthropicApiKey with 400 pointing at the correct endpoint", async () => {
    const controller = makeController(makeService());

    await expect(
      controller.update({ anthropicApiKey: "sk-ant-test" } as never, ACTOR)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects geminiApiKey with 400", async () => {
    const controller = makeController(makeService());
    await expect(
      controller.update({ geminiApiKey: "AIzaTest" } as never, ACTOR)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects groqApiKey with 400", async () => {
    const controller = makeController(makeService());
    await expect(
      controller.update({ groqApiKey: "gsk_test" } as never, ACTOR)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects openaiApiKey with 400", async () => {
    const controller = makeController(makeService());
    await expect(
      controller.update({ openaiApiKey: "sk-test" } as never, ACTOR)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("error message names the rejected field(s) and references /ai-settings/company/keys", async () => {
    const controller = makeController(makeService());
    let caught: BadRequestException | null = null;
    try {
      await controller.update({ anthropicApiKey: "sk-ant-test", groqApiKey: "gsk_test" } as never, ACTOR);
    } catch (err) {
      caught = err as BadRequestException;
    }
    expect(caught).not.toBeNull();
    const message = (caught!.getResponse() as { message: string }).message;
    expect(message).toContain("anthropicApiKey");
    expect(message).toContain("groqApiKey");
    expect(message).toContain("/ai-settings/company/keys");
  });

  it("allows model and preferredProvider updates without an API key", async () => {
    const svc = makeService();
    const controller = makeController(svc);
    await controller.update(
      { anthropicModel: "claude-haiku-4-5-20251001", preferredProvider: "anthropic" } as never,
      ACTOR
    );
    expect(svc.setModel).toHaveBeenCalledWith("anthropic", "claude-haiku-4-5-20251001", ACTOR.sub);
    expect(svc.setPreferredProvider).toHaveBeenCalledWith("anthropic", ACTOR.sub);
  });

  it("maps preferredProvider=auto to null", async () => {
    const svc = makeService();
    const controller = makeController(svc);
    await controller.update({ preferredProvider: "auto" } as never, ACTOR);
    expect(svc.setPreferredProvider).toHaveBeenCalledWith(null, ACTOR.sub);
  });
});
