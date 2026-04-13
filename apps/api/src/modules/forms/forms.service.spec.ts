import { ConflictException } from "@nestjs/common";
import { FormsService } from "./forms.service";

describe("FormsService", () => {
  it("rejects duplicate form template name or code", async () => {
    const service = new FormsService(
      {
        formTemplate: {
          findFirst: jest.fn().mockResolvedValue({ id: "template-1" })
        }
      } as never,
      { write: jest.fn() } as never
    );

    await expect(
      service.createTemplate(
        {
          name: "Daily Prestart",
          code: "PRESTART",
          sections: [
            {
              title: "Main",
              sectionOrder: 1,
              fields: [
                {
                  fieldKey: "notes",
                  label: "Notes",
                  fieldType: "textarea",
                  fieldOrder: 1
                }
              ]
            }
          ]
        },
        "user-1"
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
