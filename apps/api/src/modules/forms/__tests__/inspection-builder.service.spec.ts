import { BadRequestException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { AiProvidersService } from "../../ai-providers/ai-providers.service";
import type { ChatStreamChunk } from "../../ai-providers/ai-providers.types";
import type { FormsService } from "../forms.service";
import {
  InspectionBuilderService,
  normaliseToUpsertDto,
  normaliseToUpsertDtoWithProvenance,
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
    const raw = 'Sure -- here is the JSON:\n{"name":"Y","sections":[{"title":"S","fields":[]}]}\nHope that helps!';
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

// ─── normaliseToUpsertDtoWithProvenance ────────────────────────────────────

describe("normaliseToUpsertDtoWithProvenance", () => {
  it("records coercedFrom when the model proposes an unknown type", () => {
    const { dto, provenance } = normaliseToUpsertDtoWithProvenance(
      {
        name: "T",
        sections: [
          {
            title: "S",
            fields: [
              { label: "Colour", fieldType: "colour_picker", confidence: 0.8, sourcePage: 1, sourceLine: 3, sourceText: "Colour field" },
              { label: "Notes", fieldType: "textarea", confidence: 0.95 }
            ]
          }
        ]
      },
      "form.pdf",
      "--- Page 1 ---\nColour field\nNotes"
    );
    expect(dto.sections[0]!.fields[0]!.fieldType).toBe("text");
    expect(dto.sections[0]!.fields[1]!.fieldType).toBe("textarea");

    const colourKey = dto.sections[0]!.fields[0]!.fieldKey;
    const notesKey = dto.sections[0]!.fields[1]!.fieldKey;
    expect(provenance[colourKey]!.coercedFrom).toBe("colour_picker");
    expect(provenance[notesKey]!.coercedFrom).toBeNull();
    expect(provenance[colourKey]!.confidence).toBe(0.8);
    expect(provenance[colourKey]!.sourcePage).toBe(1);
  });

  it("defaults confidence to 0.5 when model omits it", () => {
    const { provenance } = normaliseToUpsertDtoWithProvenance(
      { name: "T", sections: [{ title: "S", fields: [{ label: "F", fieldType: "text" }] }] },
      "form.pdf",
      ""
    );
    const keys = Object.keys(provenance);
    expect(keys).toHaveLength(1);
    expect(provenance[keys[0]!]!.confidence).toBe(0.5);
  });

  it("clamps confidence above 1 to 1", () => {
    const { provenance } = normaliseToUpsertDtoWithProvenance(
      { name: "T", sections: [{ title: "S", fields: [{ label: "F", fieldType: "text", confidence: 1.5 }] }] },
      "form.pdf",
      ""
    );
    const keys = Object.keys(provenance);
    expect(provenance[keys[0]!]!.confidence).toBe(1);
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

  const validDocxFile: Express.Multer.File = {
    ...validFile,
    originalname: "checklist.docx",
    mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  };

  it("rejects an empty upload", async () => {
    const svc = new InspectionBuilderService(makeAi([]), makeForms().service);
    await expect(
      svc.buildFromPdf({ ...validFile, size: 0, buffer: Buffer.alloc(0) }, "user-1")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an unsupported mimetype", async () => {
    const svc = new InspectionBuilderService(makeAi([]), makeForms().service);
    await expect(
      svc.buildFromPdf({ ...validFile, mimetype: "image/png" }, "user-1")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("throws 400 with an OCR hint when the PDF has no text layer", async () => {
    const svc = new InspectionBuilderService(makeAi([]), makeForms().service);
    // Stub the private extractor to return empty text -- simulates a scanned PDF.
    (svc as unknown as { extractText: () => Promise<string> }).extractText = jest
      .fn()
      .mockResolvedValue("");
    await expect(svc.buildFromPdf(validFile, "user-1")).rejects.toMatchObject({
      message: expect.stringContaining("no readable text")
    });
  });

  it("resolves the AI provider config against the 'forms' scope", async () => {
    const ai = makeAi([
      { type: "content", text: '{"name":"Test","sections":[]}' },
      { type: "done" }
    ]);
    const { service: forms } = makeForms();
    const svc = new InspectionBuilderService(ai, forms);
    (svc as unknown as { extractText: () => Promise<string> }).extractText = jest
      .fn()
      .mockResolvedValue("enough text to pass the threshold check here");

    await svc.buildFromPdf(validFile, "user-1");

    expect(ai.resolveProviderConfig).toHaveBeenCalledWith("user-1", "forms");
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
    (svc as unknown as { extractText: () => Promise<string> }).extractText = jest
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

  it("accepts a Word (.docx) file and routes extraction through mammoth", async () => {
    const ai = makeAi([
      { type: "content", text: '{"name":"Word Form","sections":[{"title":"S","fields":[{"label":"Item","fieldType":"text"}]}]}' },
      { type: "done" }
    ]);
    const { service: forms, createTemplate } = makeForms();
    const svc = new InspectionBuilderService(ai, forms);
    (svc as unknown as { extractDocxText: () => Promise<string> }).extractDocxText = jest
      .fn()
      .mockResolvedValue("--- Document ---\nItem description with enough text for threshold");

    const result = await svc.buildFromPdf(validDocxFile, "user-1");

    expect(createTemplate).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe("anthropic");
  });

  it("surfaces AI stream errors as 503", async () => {
    const ai = makeAi([{ type: "error", error: "429 rate limited" }]);
    const svc = new InspectionBuilderService(ai, makeForms().service);
    (svc as unknown as { extractText: () => Promise<string> }).extractText = jest
      .fn()
      .mockResolvedValue("some real text with enough length to pass the threshold check");
    await expect(svc.buildFromPdf(validFile, "user-1")).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});

// ─── InspectionBuilderService.previewImport ───────────────────────────────

describe("InspectionBuilderService.previewImport", () => {
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

  it("returns jobId, extractedText, pages, proposal, and provenance -- does NOT call createTemplate", async () => {
    const ai = makeAi([
      { type: "content", text: '{"name":"Safety Check","sections":[{"title":"Checks","fields":[{"label":"Rails OK","fieldType":"checkbox","options":["Yes","No"],"confidence":0.9,"sourcePage":1,"sourceLine":2,"sourceText":"Rails OK"}]}]}' },
      { type: "done" }
    ]);
    const { service: forms, createTemplate } = makeForms();
    const svc = new InspectionBuilderService(ai, forms);
    (svc as unknown as { extractText: () => Promise<string> }).extractText = jest
      .fn()
      .mockResolvedValue("--- Page 1 ---\nRails OK: yes/no");

    const result = await svc.previewImport(validFile, "user-1");

    expect(createTemplate).not.toHaveBeenCalled();
    expect(result.jobId).toBeTruthy();
    expect(result.extractedText).toContain("Rails OK");
    expect(result.pages).toBe(1);
    expect(result.proposal.status).toBe("DRAFT");
    expect(result.proposal.sections[0]!.fields[0]!.fieldType).toBe("checkbox");
    expect(Object.keys(result.provenance)).toHaveLength(1);
  });

  it("rejects empty file", async () => {
    const svc = new InspectionBuilderService(makeAi([]), makeForms().service);
    await expect(
      svc.previewImport({ ...validFile, size: 0, buffer: Buffer.alloc(0) }, "user-1")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("records coercedFrom in provenance for unknown field types", async () => {
    const ai = makeAi([
      { type: "content", text: '{"name":"T","sections":[{"title":"S","fields":[{"label":"Rating","fieldType":"star_picker","confidence":0.7}]}]}' },
      { type: "done" }
    ]);
    const svc = new InspectionBuilderService(ai, makeForms().service);
    (svc as unknown as { extractText: () => Promise<string> }).extractText = jest
      .fn()
      .mockResolvedValue("Rating: 1-5 star scale");

    const result = await svc.previewImport(validFile, "user-1");
    const prov = Object.values(result.provenance)[0]!;
    expect(prov.coercedFrom).toBe("star_picker");
    expect(result.proposal.sections[0]!.fields[0]!.fieldType).toBe("text");
  });
});

// ─── InspectionBuilderService.getPreviewImport ────────────────────────────

describe("InspectionBuilderService.getPreviewImport", () => {
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

  it("returns the same payload as previewImport when within TTL", async () => {
    const ai = makeAi([
      { type: "content", text: '{"name":"T","sections":[{"title":"S","fields":[{"label":"F","fieldType":"text"}]}]}' },
      { type: "done" }
    ]);
    const svc = new InspectionBuilderService(ai, makeForms().service);
    (svc as unknown as { extractText: () => Promise<string> }).extractText = jest
      .fn()
      .mockResolvedValue("--- Page 1 ---\nsome text field content here");

    const preview = await svc.previewImport(validFile, "user-1");
    const retrieved = svc.getPreviewImport(preview.jobId);

    expect(retrieved.jobId).toBe(preview.jobId);
    expect(retrieved.extractedText).toBe(preview.extractedText);
  });

  it("throws 404 for an unknown jobId", () => {
    const svc = new InspectionBuilderService(makeAi([]), makeForms().service);
    expect(() => svc.getPreviewImport("no-such-job")).toThrow(NotFoundException);
  });
});

// ─── InspectionBuilderService.createFromPreview ───────────────────────────

describe("InspectionBuilderService.createFromPreview", () => {
  it("calls createTemplate with status forced to DRAFT and returns id", async () => {
    const { service: forms, createTemplate } = makeForms();
    const svc = new InspectionBuilderService(makeAi([]), forms);

    const dto = normaliseToUpsertDto(
      { name: "T", sections: [{ title: "S", fields: [{ label: "F", fieldType: "text" }] }] },
      "form.pdf"
    );
    // Simulate reviewer changing status (should be overridden)
    const editedDto = { ...dto, status: "ACTIVE" };

    const result = await svc.createFromPreview("fake-job-id", editedDto, "user-1");

    expect(createTemplate).toHaveBeenCalledTimes(1);
    const [dtoArg] = createTemplate.mock.calls[0]!;
    expect(dtoArg.status).toBe("DRAFT");
    expect(result.id).toBe("tpl-1");
  });
});
