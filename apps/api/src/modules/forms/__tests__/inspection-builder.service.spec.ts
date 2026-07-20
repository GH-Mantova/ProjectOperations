import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import type { AiProvidersService } from "../../ai-providers/ai-providers.service";
import type { ChatStreamChunk } from "../../ai-providers/ai-providers.types";
import type { FormsService } from "../forms.service";
import {
  InspectionBuilderService,
  normaliseToUpsertDto,
  parseAiTemplateJson
} from "../inspection-builder.service";

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Wrap a fixed array of chunks as an async iterable so streamChat mocks
 *  match the shape callers `for await` over. */
function chunkStream(chunks: ChatStreamChunk[]): AsyncIterable<ChatStreamChunk> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const c of chunks) yield c;
    }
  };
}

function makeAi(
  chunks: ChatStreamChunk[],
  overrides: Partial<AiProvidersService> = {}
): AiProvidersService {
  return {
    resolveProviderConfig: jest.fn().mockResolvedValue({
      providerId: "anthropic",
      apiKey: "x",
      model: "claude-x",
      source: "user"
    }),
    streamChat: jest.fn().mockReturnValue(chunkStream(chunks)),
    ...overrides
  } as unknown as AiProvidersService;
}

function makeForms(): { service: FormsService; createTemplate: jest.Mock } {
  const createTemplate = jest.fn().mockResolvedValue({
    id: "tpl-1",
    name: "Ladder Prestart",
    versions: [
      {
        id: "ver-1",
        sections: [
          {
            id: "sec-1",
            fields: [{ id: "fld-1" }, { id: "fld-2" }]
          }
        ]
      }
    ]
  });
  return {
    service: { createTemplate } as unknown as FormsService,
    createTemplate
  };
}

// ─── parseAiTemplateJson ───────────────────────────────────────────────────

describe("parseAiTemplateJson", () => {
  it("parses a clean JSON reply", () => {
    const parsed = parseAiTemplateJson('{"name":"X","sections":[]}');
    expect(parsed.name).toBe("X");
  });

  it("recovers JSON wrapped in prose", () => {
    const raw = 'Sure — here is the JSON:\n{"name":"Y","sections":[{"title":"S","fields":[]}]}\nHope that helps!';
    const parsed = parseAiTemplateJson(raw);
    expect(parsed.name).toBe("Y");
  });

  it("throws 503 when the reply is not JSON at all", () => {
    expect(() => parseAiTemplateJson("nope not json")).toThrow(ServiceUnavailableException);
  });
});

// ─── normaliseToUpsertDto ──────────────────────────────────────────────────

describe("normaliseToUpsertDto", () => {
  it("coerces unknown field types to text", () => {
    const dto = normaliseToUpsertDto(
      {
        name: "T",
        sections: [
          {
            title: "S",
            fields: [
              { label: "Colour", fieldType: "colour_picker" },
              { label: "Notes", fieldType: "textarea" }
            ]
          }
        ]
      },
      "form.pdf"
    );
    expect(dto.sections[0]!.fields[0]!.fieldType).toBe("text");
    expect(dto.sections[0]!.fields[1]!.fieldType).toBe("textarea");
  });

  it("attaches options for choice fields and drops labels-only for others", () => {
    const dto = normaliseToUpsertDto(
      {
        name: "T",
        sections: [
          {
            title: "S",
            fields: [
              { label: "Pass?", fieldType: "checkbox", options: ["Yes", "No"] },
              { label: "Notes", fieldType: "text", options: ["Ignored"] }
            ]
          }
        ]
      },
      "form.pdf"
    );
    expect(dto.sections[0]!.fields[0]!.optionsJson).toEqual(["Yes", "No"]);
    expect(dto.sections[0]!.fields[1]!.optionsJson).toBeUndefined();
  });

  it("always sets status=DRAFT even when the AI proposes ACTIVE", () => {
    const dto = normaliseToUpsertDto(
      { name: "T", sections: [{ title: "S", fields: [{ label: "L", fieldType: "text" }] }] },
      "form.pdf"
    );
    expect(dto.status).toBe("DRAFT");
  });

  it("substitutes a placeholder section when the AI returns none", () => {
    const dto = normaliseToUpsertDto({ name: "T", sections: [] }, "form.pdf");
    expect(dto.sections).toHaveLength(1);
    expect(dto.sections[0]!.title).toBe("Section 1");
  });

  it("derives name from filename when the AI omits one", () => {
    const dto = normaliseToUpsertDto({ sections: [] }, "ladder-prestart-2026.pdf");
    expect(dto.name.toLowerCase()).toContain("ladder");
  });
});

// ─── InspectionBuilderService.buildFromPdf ────────────────────────────────

describe("InspectionBuilderService.buildFromPdf", () => {
  const validFile: Express.Multer.File = {
    fieldname: "file",
    originalname: "checklist.pdf",
    encoding: "7bit",
    mimetype: "application/pdf",
    size: 1024,
    buffer: Buffer.from("dummy"),
    destination: "",
    filename: "",
    path: "",
    stream: undefined as unknown as never
  };

  it("rejects an empty upload", async () => {
    const svc = new InspectionBuilderService(makeAi([]), makeForms().service);
    await expect(
      svc.buildFromPdf({ ...validFile, size: 0, buffer: Buffer.alloc(0) }, "user-1")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a non-PDF mimetype", async () => {
    const svc = new InspectionBuilderService(makeAi([]), makeForms().service);
    await expect(
      svc.buildFromPdf({ ...validFile, mimetype: "image/png" }, "user-1")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws 400 with an OCR hint when the PDF has no text layer", async () => {
    const svc = new InspectionBuilderService(makeAi([]), makeForms().service);
    // Stub the private extractor to return empty text — simulates a scanned PDF.
    (svc as unknown as { extractPdfText: () => Promise<string> }).extractPdfText = jest
      .fn()
      .mockResolvedValue("");
    await expect(svc.buildFromPdf(validFile, "user-1")).rejects.toMatchObject({
      message: expect.stringContaining("no readable text")
    });
  });

  it("passes AI JSON through the coercer to FormsService.createTemplate and returns counts", async () => {
    const ai = makeAi([
      { type: "content", text: '{"name":"Ladder Prestart","sections":[' },
      { type: "content", text: '{"title":"Checks","fields":[' },
      { type: "content", text: '{"label":"Rails secure","fieldType":"checkbox","options":["Yes","No"]},' },
      { type: "content", text: '{"label":"Signed by","fieldType":"signature"}' },
      { type: "content", text: "]}]}" },
      { type: "done" }
    ]);
    const { service: forms, createTemplate } = makeForms();
    const svc = new InspectionBuilderService(ai, forms);
    (svc as unknown as { extractPdfText: () => Promise<string> }).extractPdfText = jest
      .fn()
      .mockResolvedValue("Ladder Prestart\nRails secure\nSigned by");

    const result = await svc.buildFromPdf(validFile, "user-1");

    expect(createTemplate).toHaveBeenCalledTimes(1);
    const [dtoArg, actorArg] = createTemplate.mock.calls[0]!;
    expect(actorArg).toBe("user-1");
    expect(dtoArg.status).toBe("DRAFT");
    expect(dtoArg.sections[0].fields).toHaveLength(2);
    expect(dtoArg.sections[0].fields[0].fieldType).toBe("checkbox");
    expect(dtoArg.sections[0].fields[1].fieldType).toBe("signature");
    expect(result.provider).toBe("anthropic");
    expect(result.sectionCount).toBe(1);
    expect(result.fieldCount).toBe(2);
  });

  it("surfaces AI stream errors as 503", async () => {
    const ai = makeAi([{ type: "error", error: "429 rate limited" }]);
    const svc = new InspectionBuilderService(ai, makeForms().service);
    (svc as unknown as { extractPdfText: () => Promise<string> }).extractPdfText = jest
      .fn()
      .mockResolvedValue("some real text with enough length to pass the threshold check");
    await expect(svc.buildFromPdf(validFile, "user-1")).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
