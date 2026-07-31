import { ForbiddenException } from "@nestjs/common";
import { TimelineController } from "./timeline.controller";

// The controller looks up a required permission per entity type. If the
// map lookup returned undefined the old code silently allowed the request;
// these tests pin the fail-closed behaviour so a future entity type added
// without a mapping cannot slip through.
describe("TimelineController.ensureViewer", () => {
  const controller = new TimelineController({} as never);
  const ensureViewer = (entityType: string, user: unknown) =>
    (controller as unknown as { ensureViewer: (t: string, u: unknown) => void }).ensureViewer(
      entityType,
      user
    );

  it("throws Forbidden for an entity type with no mapping (fail-closed)", () => {
    const user = { sub: "u1", isSuperUser: false, permissions: ["jobs.view"] };
    expect(() => ensureViewer("MysteryEntity", user)).toThrow(ForbiddenException);
  });

  it("still allows super-users through an unmapped entity type", () => {
    const user = { sub: "u1", isSuperUser: true, permissions: [] };
    expect(() => ensureViewer("MysteryEntity", user)).not.toThrow();
  });

  it("allows a caller who has the mapped permission for a known entity type", () => {
    const user = { sub: "u1", isSuperUser: false, permissions: ["jobs.view"] };
    expect(() => ensureViewer("Job", user)).not.toThrow();
  });

  it("throws Forbidden for a known entity type when the caller lacks the mapped permission", () => {
    const user = { sub: "u1", isSuperUser: false, permissions: [] };
    expect(() => ensureViewer("Job", user)).toThrow(ForbiddenException);
    expect(() => ensureViewer("Tender", user)).toThrow(ForbiddenException);
    expect(() => ensureViewer("Client", user)).toThrow(ForbiddenException);
    expect(() => ensureViewer("Contact", user)).toThrow(ForbiddenException);
  });
});
