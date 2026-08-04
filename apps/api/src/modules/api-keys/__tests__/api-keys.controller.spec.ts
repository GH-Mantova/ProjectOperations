import { ApiKeysController } from "../api-keys.controller";
import type { ApiKeysService } from "../api-keys.service";

function makeActor(overrides: Partial<{ sub: string; isSuperUser: boolean; permissions: string[] }> = {}) {
  return {
    sub: overrides.sub ?? "actor-1",
    email: "actor@test",
    permissions: overrides.permissions ?? ["platform.admin"],
    isSuperUser: overrides.isSuperUser ?? true
  };
}

function buildController() {
  const service = {
    listCredentials: jest.fn(async () => []),
    createCredential: jest.fn(async () => ({ id: "c1", hasKey: true })),
    updateCredential: jest.fn(async () => ({ id: "c1", hasKey: true })),
    deleteCredential: jest.fn(async () => ({ ok: true as const })),
    reorderCredentials: jest.fn(async () => ({ ok: true as const })),
    testCredential: jest.fn(async () => ({ ok: true as const })),
    listTypes: jest.fn(async () => []),
    createType: jest.fn(async () => ({ id: "t1", name: "n", description: null, systemKind: null, credentialCount: 0 })),
    updateType: jest.fn(async () => ({ id: "t1", name: "n", description: null, systemKind: null, credentialCount: 0 })),
    deleteType: jest.fn(async () => ({ ok: true as const }))
  } as unknown as ApiKeysService & Record<string, jest.Mock>;
  const controller = new ApiKeysController(service);
  return { controller, service };
}

describe("ApiKeysController — routing + defaults", () => {
  it("GET /credentials defaults scope=company when omitted", async () => {
    const { controller, service } = buildController();
    await controller.listCredentials(makeActor(), undefined);
    expect(service.listCredentials).toHaveBeenCalledWith("company", expect.any(Object));
  });

  it("GET /credentials passes scope=user through untouched", async () => {
    const { controller, service } = buildController();
    await controller.listCredentials(makeActor(), "user");
    expect(service.listCredentials).toHaveBeenCalledWith("user", expect.any(Object));
  });

  it("GET /credentials rejects unknown scope", async () => {
    const { controller } = buildController();
    await expect(controller.listCredentials(makeActor(), "root")).rejects.toBeDefined();
  });

  it("POST /credentials delegates to service.createCredential", async () => {
    const { controller, service } = buildController();
    const dto = {
      name: "n",
      typeId: "t",
      scope: "company" as const,
      key: "k"
    };
    await controller.createCredential(makeActor(), dto);
    expect(service.createCredential).toHaveBeenCalledWith(dto, expect.any(Object));
  });

  it("POST /credentials/reorder rejects non-array ids", async () => {
    const { controller } = buildController();
    await expect(
      controller.reorderCredentials(makeActor(), { ids: "not-array" as unknown as string[] })
    ).rejects.toBeDefined();
  });

  it("POST /credentials/:id/test delegates to service.testCredential", async () => {
    const { controller, service } = buildController();
    await controller.testCredential(makeActor(), "c1");
    expect(service.testCredential).toHaveBeenCalledWith("c1", expect.any(Object));
  });

  it("GET /types has no permission gate at the controller layer (service handles it)", async () => {
    const { controller, service } = buildController();
    await controller.listTypes();
    expect(service.listTypes).toHaveBeenCalled();
  });
});
