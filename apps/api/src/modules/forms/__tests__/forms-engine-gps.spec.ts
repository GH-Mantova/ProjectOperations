// GPS-A3: authenticated submitForm hard-blocks when the template requires
// geolocation and no lat/lng is supplied. Public-link submissions run
// through a different service (PublicLinkService.publicSubmit) and are
// exempt by design — not covered here.

import { BadRequestException } from "@nestjs/common";
import { FormsEngineService } from "../forms-engine.service";

const SUB_ID = "sub-1";
const USER_ID = "user-1";
const VERSION_ID = "ver-1";

function buildEngine(overrides: {
  geolocationEnabled: boolean;
} = { geolocationEnabled: true }) {
  const submission = {
    id: SUB_ID,
    submittedById: USER_ID,
    status: "draft",
    templateVersionId: VERSION_ID
  };
  const version = {
    id: VERSION_ID,
    template: {
      id: "tpl-1",
      name: "Test template",
      category: "safety",
      settings: {},
      geolocationEnabled: overrides.geolocationEnabled
    },
    sections: []
  };
  const prisma = {
    formSubmission: {
      findUnique: jest.fn().mockResolvedValue(submission)
    },
    formTemplateVersion: {
      findUnique: jest.fn().mockResolvedValue(version)
    }
  };
  const rules = {} as never;
  const notifications = {} as never;
  const audit = {} as never;
  const engine = new FormsEngineService(prisma as never, rules, notifications, audit);
  return { engine, prisma };
}

describe("FormsEngineService.submitForm — GPS-A3 mandatory location", () => {
  it("throws BadRequestException when the template requires geolocation and gpsLat is missing", async () => {
    const { engine } = buildEngine({ geolocationEnabled: true });
    await expect(engine.submitForm(SUB_ID, USER_ID)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("throws BadRequestException when only gpsLng is supplied", async () => {
    const { engine } = buildEngine({ geolocationEnabled: true });
    await expect(
      engine.submitForm(SUB_ID, USER_ID, undefined, 144.96)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does NOT throw the GPS-mandatory error when geolocationEnabled is false (falls through to normal pipeline)", async () => {
    // With geolocation off we should NOT hit the 400 branch. The call fails
    // deeper in the pipeline (no rules/notifications/audit mocks) — that's
    // fine, we just care the error is NOT the mandatory-GPS BadRequestException
    // from A3.
    const { engine } = buildEngine({ geolocationEnabled: false });
    let threw: unknown = null;
    try {
      await engine.submitForm(SUB_ID, USER_ID);
    } catch (err) {
      threw = err;
    }
    expect(threw).not.toBeNull();
    const isMandatoryGpsError =
      threw instanceof BadRequestException &&
      (threw as BadRequestException).message.includes("This form requires location");
    expect(isMandatoryGpsError).toBe(false);
  });
});
