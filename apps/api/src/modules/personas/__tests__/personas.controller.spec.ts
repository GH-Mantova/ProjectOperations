import { PersonasController } from "../personas.controller";
import { PersonasService } from "../personas.service";

type AuthLike = { sub?: string; permissions?: string[]; isSuperUser?: boolean };

function buildController(): PersonasController {
  const service = new PersonasService({} as never);
  return new PersonasController(service);
}

describe("PersonasController.activeForRoute", () => {
  const tendering = (sub: string) => ({
    persona: {
      slug: "tendering",
      displayName: "Tendering Assistant",
      description: expect.any(String) as unknown as string
    },
    subMode: { name: sub, description: expect.any(String) as unknown as string }
  });

  it("returns persona for matching route + permitted user", async () => {
    const controller = buildController();
    const actor: AuthLike = { sub: "user-1", permissions: ["ai.persona.tendering"] };
    const result = await controller.activeForRoute("/tenders/pipeline", actor as never);
    expect(result).toEqual(tendering("pipeline"));
  });

  it("returns persona for matching route + Super User (permission bypassed)", async () => {
    const controller = buildController();
    const actor: AuthLike = { sub: "user-sean", permissions: [], isSuperUser: true };
    const result = await controller.activeForRoute("/tenders/123?detail=scope", actor as never);
    expect(result).toEqual(tendering("scope"));
  });

  it("returns null for matching route + unpermitted user (graceful, not 403)", async () => {
    const controller = buildController();
    const actor: AuthLike = { sub: "user-amy", permissions: ["finance.view"] };
    const result = await controller.activeForRoute("/tenders/pipeline", actor as never);
    expect(result).toBeNull();
  });

  it("returns null for non-matching route", async () => {
    const controller = buildController();
    const actor: AuthLike = { sub: "user-1", permissions: ["ai.persona.tendering"] };
    const result = await controller.activeForRoute("/dashboards", actor as never);
    expect(result).toBeNull();
  });

  it("returns null when the url query param is missing", async () => {
    const controller = buildController();
    const actor: AuthLike = { sub: "user-1", permissions: ["ai.persona.tendering"] };
    const result = await controller.activeForRoute(undefined, actor as never);
    expect(result).toBeNull();
  });

  it("returns null when the url query param is an empty string", async () => {
    const controller = buildController();
    const actor: AuthLike = { sub: "user-1", permissions: ["ai.persona.tendering"] };
    const result = await controller.activeForRoute("", actor as never);
    expect(result).toBeNull();
  });
});
