import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { randomUUID } from "crypto";
import * as mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.js";
import { AiProvidersService } from "../ai-providers/ai-providers.service";
import { sanitiseProviderError } from "../ai-providers/error-sanitiser";
import { PDFJS_STANDARD_FONT_DATA_URL } from "../personas/tools/handlers/drawing-tools.shared";
import { FormsService } from "./forms.service";
import type {
  FormFieldInputDto,
  FormSectionInputDto,
  UpsertFormTemplateDto
} from "./dto/forms.dto";

/**
 * AI build-a-form-from-PDF orchestrator.
 *
 * Accepts an uploaded PDF (or plain-text) inspection sheet / checklist and
 * turns it into a **DRAFT** `FormTemplate`. Never publishes -- a human must
 * open the generated draft in the designer and press publish. That is the
 * only safeguard against a hallucinated field type being enforced on real
 * submissions, so we intentionally short-circuit the ACTIVE default status
 * that `FormsService.createTemplate` uses.
 *
 * Provider selection reuses `AiProvidersService.resolveProviderConfig` -- the
 * same BYOK / company-key path the assist controller uses -- so admins never
 * need to configure a separate document-AI key. If the caller has no key
 * for the configured provider, resolveProviderConfig throws 503 well before
 * we spend a token.
 *
 * FV2-S2: also exposes a three-step preview-import flow:
 *   1. previewImport     -- extract + AI call, hold in TTL store, return proposal
 *   2. getPreviewImport  -- retrieve a held proposal by jobId
 *   3. createFromPreview -- create DRAFT from (possibly edited) proposal
 */
@Injectable()
export class InspectionBuilderService {
  private readonly logger = new Logger(InspectionBuilderService.name);

  // In-memory preview store: keyed by jobId, expires after TTL_MS.
  // No schema, no migration. Dies with the process.
  private readonly previewStore = new Map<string, PreviewStoreEntry>();
  private readonly TTL_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    private readonly aiProviders: AiProvidersService,
    private readonly forms: FormsService
  ) {}

  // ── Original single-shot route (preserved for backwards compatibility) ──

  /**
   * Build a DRAFT form template from an uploaded document.
   *
   * PDF files are extracted with pdfjs-dist; Word (.docx) files are extracted
   * with mammoth. The extracted text is sent to the caller's configured AI
   * provider as a one-shot chat request that MUST reply with the JSON envelope
   * described in `SYSTEM_PROMPT`. The JSON is parsed, coerced to
   * `UpsertFormTemplateDto`, and handed straight to `FormsService.createTemplate`.
   *
   * Failure modes:
   *  - Empty / corrupt file -> 400 BadRequest.
   *  - Unsupported mimetype -> 400 BadRequest with accepted list.
   *  - Scanned (image-only) PDF with no text layer -> 400 BadRequest with an
   *    "extract text first" hint. This slice deliberately does NOT ship
   *    vision fallback -- that expands blast radius (tokens, provider quirks,
   *    render pipeline) beyond a single 9-file feature.
   *  - AI returns non-JSON / bad schema -> 503 with sanitised message.
   *  - Provider unreachable / no key -> 503 (bubbled from AiProvidersService).
   */
  async buildFromPdf(
    file: Express.Multer.File,
    actorId: string
  ): Promise<{ id: string; name: string; provider: string; fieldCount: number; sectionCount: number }> {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException("Upload a non-empty document.");
    }
    if (!ACCEPTED_MIMETYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Accepted: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document.`
      );
    }

    const extractedText = await this.extractText(file);
    if (extractedText.trim().length < 20) {
      throw new BadRequestException(
        "This PDF has no readable text layer -- it looks like a scan. Run it through OCR first, or paste the content into a new form manually."
      );
    }

    const config = await this.aiProviders.resolveProviderConfig(actorId, "forms");

    this.logger.log(
      `Build-from-PDF start [user=${actorId}, file=${file.originalname}, bytes=${file.size}, chars=${extractedText.length}, provider=${config.providerId}, source=${config.source}]`
    );

    const rawJson = await this.oneShotJson(config, extractedText, file.originalname);
    const parsed = parseAiTemplateJson(rawJson);
    const dto = normaliseToUpsertDto(parsed, file.originalname);

    const created = await this.forms.createTemplate(dto, actorId);
    const versionsCount = created.versions?.length ?? 0;
    const firstVersion = versionsCount > 0 ? created.versions[0] : null;
    const sectionCount = firstVersion?.sections?.length ?? 0;
    const fieldCount = firstVersion?.sections?.reduce(
      (acc: number, s: { fields?: unknown[] }) => acc + (s.fields?.length ?? 0),
      0
    ) ?? 0;

    return {
      id: created.id,
      name: created.name,
      provider: config.providerId,
      fieldCount,
      sectionCount
    };
  }

  // ── FV2-S2: three-step preview-import flow ─────────────────────────────

  /**
   * Step 1: extract text, call the model, coerce -- do NOT create.
   * Returns a jobId + proposal held in memory for 30 minutes.
   */
  async previewImport(
    file: Express.Multer.File,
    actorId: string
  ): Promise<PreviewImportPayload> {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException("Upload a non-empty document.");
    }
    if (!ACCEPTED_MIMETYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${file.mimetype}. Accepted: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document.`
      );
    }

    const extractedText = await this.extractText(file);
    if (extractedText.trim().length < 20) {
      throw new BadRequestException(
        "This PDF has no readable text layer -- it looks like a scan. Run it through OCR first, or paste the content into a new form manually."
      );
    }

    // Count pages in the extracted text
    const pages = (extractedText.match(/^--- Page \d+ ---/gm) ?? []).length || 1;

    const config = await this.aiProviders.resolveProviderConfig(actorId, "forms");

    this.logger.log(
      `Preview-import start [user=${actorId}, file=${file.originalname}, bytes=${file.size}, chars=${extractedText.length}, provider=${config.providerId}]`
    );

    const rawJson = await this.oneShotJson(config, extractedText, file.originalname);
    const parsed = parseAiTemplateJson(rawJson);
    const { dto: proposal, provenance } = normaliseToUpsertDtoWithProvenance(parsed, file.originalname, extractedText);

    const jobId = randomUUID();
    const entry: PreviewStoreEntry = {
      jobId,
      extractedText,
      pages,
      proposal,
      provenance,
      provider: config.providerId,
      expiresAt: Date.now() + this.TTL_MS
    };
    this.previewStore.set(jobId, entry);

    // Schedule cleanup
    setTimeout(() => { this.previewStore.delete(jobId); }, this.TTL_MS);

    return {
      jobId,
      extractedText,
      pages,
      proposal,
      provenance
    };
  }

  /**
   * Step 2: retrieve the held proposal by jobId. Returns 404 when expired.
   */
  getPreviewImport(jobId: string): PreviewImportPayload {
    const entry = this.previewStore.get(jobId);
    if (!entry || Date.now() > entry.expiresAt) {
      this.previewStore.delete(jobId);
      throw new NotFoundException("This extraction has expired. Import the document again.");
    }
    return {
      jobId: entry.jobId,
      extractedText: entry.extractedText,
      pages: entry.pages,
      proposal: entry.proposal,
      provenance: entry.provenance
    };
  }

  /**
   * Step 3: take the reviewer's (possibly edited) UpsertFormTemplateDto,
   * create the DRAFT, and return the template id. Code is honoured as sent;
   * a collision is the existing 409.
   */
  async createFromPreview(
    jobId: string,
    dto: UpsertFormTemplateDto,
    actorId: string
  ): Promise<{ id: string }> {
    // The job entry does not have to still be alive -- the reviewer may have
    // taken longer than 30 min, but as long as they send us a valid DTO we
    // can proceed. The jobId is only used for logging/correlation here.
    const created = await this.forms.createTemplate({ ...dto, status: "DRAFT" }, actorId);
    this.logger.log(
      `Preview-import create [user=${actorId}, jobId=${jobId}, templateId=${created.id}]`
    );
    // Clean up if still present
    this.previewStore.delete(jobId);
    return { id: created.id };
  }

  // ── Private helpers ────────────────────────────────────────────────────

  /**
   * Dispatch text extraction to the appropriate extractor based on mimetype.
   */
  private async extractText(file: Express.Multer.File): Promise<string> {
    if (file.mimetype === MIMETYPE_PDF) {
      return this.extractPdfText(file.buffer, file.originalname);
    }
    if (file.mimetype === MIMETYPE_DOCX) {
      return this.extractDocxText(file.buffer, file.originalname);
    }
    // Should never reach here -- ACCEPTED_MIMETYPES guard above catches this.
    throw new BadRequestException(
      `Unsupported file type: ${file.mimetype}. Accepted: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document.`
    );
  }

  /**
   * Extract raw text from a .docx buffer using mammoth. No pages in a Word
   * document -- we emit a single document marker and cap to MAX_TEXT_CHARS_TO_MODEL.
   */
  private async extractDocxText(bytes: Buffer, filename: string): Promise<string> {
    let result: { value: string };
    try {
      result = await mammoth.extractRawText({ buffer: bytes });
    } catch {
      throw new BadRequestException(`Failed to parse "${filename}". The file may be corrupt.`);
    }
    const text = result.value.trim();
    return (`--- Document ---\n${text}`).slice(0, MAX_TEXT_CHARS_TO_MODEL);
  }

  /**
   * Extract concatenated per-page text from a PDF byte buffer. Uses the
   * same pdfjs-dist configuration as the tender-drawing handlers so we
   * benefit from Mozilla's recommended `isEvalSupported: false` mitigation
   * (Dependabot alerts #14/#15).
   */
  private async extractPdfText(bytes: Buffer, filename: string): Promise<string> {
    let pdf: Awaited<ReturnType<typeof pdfjsLib.getDocument>["promise"]>;
    try {
      pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(bytes),
        isEvalSupported: false,
        useSystemFonts: false,
        standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL
      }).promise;
    } catch {
      throw new BadRequestException(`Failed to parse "${filename}". The file may be corrupt.`);
    }

    type Item = { str?: unknown };
    const perPage: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const text = await page.getTextContent();
      const items = (text.items as Item[])
        .filter((i) => typeof i.str === "string")
        .map((i) => (i.str as string).trim())
        .filter((s) => s.length > 0);
      perPage.push(items.join(" "));
    }
    await pdf.destroy();

    return perPage
      .map((s, i) => `--- Page ${i + 1} ---\n${s}`)
      .join("\n\n")
      .slice(0, MAX_TEXT_CHARS_TO_MODEL);
  }

  /**
   * Runs the streaming chat API in accumulator mode -- same pattern as
   * `AssistController.assist`. Blocks until `done`, returns the full text.
   */
  private async oneShotJson(
    config: Awaited<ReturnType<AiProvidersService["resolveProviderConfig"]>>,
    extractedText: string,
    filename: string
  ): Promise<string> {
    try {
      let text = "";
      for await (const chunk of this.aiProviders.streamChat({
        systemPrompt: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildUserPrompt(filename, extractedText)
          }
        ],
        config
      })) {
        if (chunk.type === "content") {
          text += chunk.text;
        } else if (chunk.type === "error") {
          throw new Error(chunk.error);
        } else if (chunk.type === "done") {
          break;
        }
      }
      return text.trim();
    } catch (err) {
      const sanitised = sanitiseProviderError(err);
      this.logger.error(
        `Build-from-PDF provider error [category=${sanitised.category}]: ${sanitised.logMessage}`
      );
      throw new ServiceUnavailableException(sanitised.userMessage);
    }
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * Per-field provenance metadata returned by preview-import.
 * Review-only; never persisted to FormField.
 */
export type FieldProvenance = {
  /** Estimated confidence 0-1. */
  confidence: number;
  /** Which PDF page the field label was found on (1-based). */
  sourcePage: number | null;
  /** Which line within the page (1-based, approximate). */
  sourceLine: number | null;
  /** The raw source text the label was derived from. */
  sourceText: string | null;
  /**
   * The field type the model proposed, when coerceField rewrote it to text.
   * Null when the proposed type was already in the allow-list.
   */
  coercedFrom: string | null;
};

/** Flat map: fieldKey -> FieldProvenance. Sections are keyed by sectionIdx. */
export type ProvenanceMap = Record<string, FieldProvenance>;

/** Payload returned by preview-import step 1 and 2. */
export type PreviewImportPayload = {
  jobId: string;
  extractedText: string;
  pages: number;
  proposal: UpsertFormTemplateDto;
  provenance: ProvenanceMap;
};

type PreviewStoreEntry = PreviewImportPayload & {
  provider: string;
  expiresAt: number;
};

// ── Constants ──────────────────────────────────────────────────────────────

const MIMETYPE_PDF = "application/pdf";
const MIMETYPE_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Mimetypes accepted by `buildFromPdf` / the multer filter on the controller. */
export const ACCEPTED_MIMETYPES: ReadonlySet<string> = new Set([
  MIMETYPE_PDF,
  MIMETYPE_DOCX
]);

// Cap the text handed to the model. 40k chars ~= 10-12k tokens on Anthropic
// tokenisers -- comfortably inside the 8k output allowance the assist path
// already uses, and enough for a dense multi-page checklist.
const MAX_TEXT_CHARS_TO_MODEL = 40_000;

// The prompt asks for a bounded JSON envelope with a fixed set of allowed
// field types. Anything outside this set is coerced to `text` in
// normaliseToUpsertDto so a hallucinated `signature_pad` (etc.) can't
// break the designer, which only draws the types below.
const ALLOWED_FIELD_TYPES: ReadonlySet<string> = new Set([
  "text",
  "textarea",
  "number",
  "date",
  "time",
  "email",
  "phone",
  "address",
  "multiple_choice",
  "checkbox",
  "radio",
  "rating",
  "scale",
  "signature",
  "image_capture",
  "heading",
  "paragraph"
]);

const CHOICE_FIELD_TYPES: ReadonlySet<string> = new Set([
  "multiple_choice",
  "checkbox",
  "radio"
]);

// Kept intentionally short and prescriptive -- the model must reply with a
// single JSON object matching the schema. No markdown fences, no prose.
// If the model refuses or wraps the JSON, the parser tries a best-effort
// substring extract before giving up.
const SYSTEM_PROMPT = [
  "You convert paper inspection sheets, checklists, and safety forms into a structured JSON schema for the ProjectOperations forms engine.",
  "",
  "Reply with ONE JSON object and nothing else -- no markdown, no ``` fences, no commentary. The object MUST match this shape:",
  "",
  "{",
  '  "name": "Short human-readable form name (max 80 chars).",',
  '  "description": "One-sentence summary of what the form captures. Optional.",',
  '  "sections": [',
  "    {",
  '      "title": "Section heading exactly as it appears on the source.",',
  '      "fields": [',
  "        {",
  '          "label": "Question / field label as written on the source.",',
  '          "fieldType": "text|textarea|number|date|time|email|phone|address|multiple_choice|checkbox|radio|rating|scale|signature|image_capture|heading|paragraph",',
  '          "isRequired": true,',
  '          "helpText": "Optional guidance text if the source clarifies expectations.",',
  '          "options": ["Yes","No","N/A"],',
  '          "confidence": 0.9,',
  '          "sourcePage": 1,',
  '          "sourceLine": 5,',
  '          "sourceText": "The exact text from the source document."',
  "        }",
  "      ]",
  "    }",
  "  ]",
  "}",
  "",
  "Rules:",
  "- Preserve the source order of sections and fields.",
  "- Use `checkbox` for yes/no or pass/fail items with 2-3 fixed options -- populate `options`.",
  "- Use `multiple_choice` when the source lists more than 3 mutually-exclusive answers.",
  "- Use `signature` for any sign-off / name-and-signature line.",
  "- Use `heading` for section subtitles and `paragraph` for standing instructions or terms text.",
  "- Never invent fields that aren't on the source. If a section is empty, omit it.",
  "- Skip page numbers, headers/footers, and revision-history tables -- they are not form fields.",
  "- If unsure of a field type, default to `text`.",
  "- Populate confidence (0-1), sourcePage, sourceLine, and sourceText for every field."
].join("\n");

function buildUserPrompt(filename: string, extractedText: string): string {
  return [
    `Source file: ${filename}`,
    "",
    "Extracted text (page markers included):",
    "---",
    extractedText,
    "---",
    "",
    "Return the JSON envelope now."
  ].join("\n");
}

// ── JSON parsing / coercion ───────────────────────────────────────────────

type AiField = {
  label?: unknown;
  fieldType?: unknown;
  isRequired?: unknown;
  helpText?: unknown;
  placeholder?: unknown;
  options?: unknown;
  // Provenance fields (S2 extension)
  confidence?: unknown;
  sourcePage?: unknown;
  sourceLine?: unknown;
  sourceText?: unknown;
};

type AiSection = {
  title?: unknown;
  description?: unknown;
  fields?: unknown;
};

type AiTemplateEnvelope = {
  name?: unknown;
  description?: unknown;
  sections?: unknown;
};

/**
 * Parse the AI's reply. Tries strict JSON first; if that fails, falls back
 * to extracting the first `{ ... }` block from a possibly-wrapped response
 * (e.g. the model prefixed a "Here is the JSON:" sentence).
 */
export function parseAiTemplateJson(raw: string): AiTemplateEnvelope {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as AiTemplateEnvelope;
  } catch {
    // Best-effort fallback: locate the outermost { ... } span.
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first !== -1 && last > first) {
      const slice = trimmed.slice(first, last + 1);
      try {
        return JSON.parse(slice) as AiTemplateEnvelope;
      } catch {
        // fall through
      }
    }
    throw new ServiceUnavailableException(
      "The AI did not return a parseable JSON schema. Try again or import a different document."
    );
  }
}

/**
 * Coerce the AI envelope into a valid `UpsertFormTemplateDto`. Always
 * returns status=DRAFT so the caller can review before publish; sanitises
 * field types against the designer's allow-list; auto-generates stable
 * `fieldKey` values and a unique `code`.
 */
export function normaliseToUpsertDto(
  envelope: AiTemplateEnvelope,
  filename: string
): UpsertFormTemplateDto {
  return normaliseToUpsertDtoWithProvenance(envelope, filename, "").dto;
}

/**
 * Provenance-aware variant used by the preview-import flow.
 * Returns both the DTO and a ProvenanceMap keyed by fieldKey.
 */
export function normaliseToUpsertDtoWithProvenance(
  envelope: AiTemplateEnvelope,
  filename: string,
  _extractedText: string
): { dto: UpsertFormTemplateDto; provenance: ProvenanceMap } {
  const suggestedName = typeof envelope.name === "string" && envelope.name.trim().length > 0
    ? envelope.name.trim().slice(0, 80)
    : deriveNameFromFilename(filename);

  const description = typeof envelope.description === "string" && envelope.description.trim().length > 0
    ? envelope.description.trim()
    : undefined;

  const aiSections: AiSection[] = Array.isArray(envelope.sections)
    ? (envelope.sections as AiSection[])
    : [];

  const provenance: ProvenanceMap = {};

  const sections: FormSectionInputDto[] = aiSections
    .map((section, sectionIdx) => {
      const title = typeof section.title === "string" && section.title.trim().length > 0
        ? section.title.trim()
        : `Section ${sectionIdx + 1}`;
      const descriptionText = typeof section.description === "string"
        ? section.description.trim()
        : undefined;

      const aiFields: AiField[] = Array.isArray(section.fields)
        ? (section.fields as AiField[])
        : [];

      const fields: FormFieldInputDto[] = [];
      for (let fieldIdx = 0; fieldIdx < aiFields.length; fieldIdx++) {
        const aiField = aiFields[fieldIdx]!;
        const result = coerceFieldWithProvenance(aiField, sectionIdx, fieldIdx);
        if (result !== null) {
          fields.push(result.field);
          provenance[result.field.fieldKey] = result.prov;
        }
      }

      return {
        title,
        description: descriptionText && descriptionText.length > 0 ? descriptionText : undefined,
        sectionOrder: sectionIdx + 1,
        fields
      };
    })
    .filter((s) => s.fields.length > 0 || s.title.length > 0);

  // ArrayMinSize(1) on the DTO -- supply an empty placeholder section
  // if the AI returned nothing usable, so the human can start from scratch
  // rather than getting a 400.
  const finalSections: FormSectionInputDto[] = sections.length > 0
    ? sections
    : [{ title: "Section 1", sectionOrder: 1, fields: [] }];

  return {
    dto: {
      name: suggestedName,
      code: deriveTemplateCode(suggestedName),
      description,
      status: "DRAFT",
      geolocationEnabled: false,
      associationScopes: [],
      sections: finalSections
    },
    provenance
  };
}

function coerceFieldWithProvenance(
  field: AiField,
  sectionIdx: number,
  fieldIdx: number
): { field: FormFieldInputDto; prov: FieldProvenance } | null {
  const label = typeof field.label === "string" ? field.label.trim() : "";
  if (label.length === 0) return null;

  const rawType = typeof field.fieldType === "string" ? field.fieldType.trim() : "text";
  const isCoerced = !ALLOWED_FIELD_TYPES.has(rawType);
  const fieldType = isCoerced ? "text" : rawType;

  const fieldKey = deriveFieldKey(label, sectionIdx, fieldIdx);
  const helpText = typeof field.helpText === "string" && field.helpText.trim().length > 0
    ? field.helpText.trim()
    : undefined;
  const placeholder = typeof field.placeholder === "string" && field.placeholder.trim().length > 0
    ? field.placeholder.trim()
    : undefined;
  const isRequired = field.isRequired === true;

  const dto: FormFieldInputDto = {
    fieldKey,
    label: label.slice(0, 200),
    fieldType,
    fieldOrder: fieldIdx + 1,
    isRequired,
    placeholder,
    helpText
  };

  if (CHOICE_FIELD_TYPES.has(fieldType) && Array.isArray(field.options)) {
    const options = (field.options as unknown[])
      .filter((o): o is string => typeof o === "string" && o.trim().length > 0)
      .map((o) => o.trim())
      .slice(0, 50);
    if (options.length > 0) {
      dto.optionsJson = options;
    }
  }

  const prov: FieldProvenance = {
    confidence: typeof field.confidence === "number"
      ? Math.min(1, Math.max(0, field.confidence))
      : 0.5,
    sourcePage: typeof field.sourcePage === "number" ? field.sourcePage : null,
    sourceLine: typeof field.sourceLine === "number" ? field.sourceLine : null,
    sourceText: typeof field.sourceText === "string" ? field.sourceText.trim() : null,
    coercedFrom: isCoerced ? rawType : null
  };

  return { field: dto, prov };
}

// Kept for backwards compat with the old coerceField call path used by
// normaliseToUpsertDto (which now delegates through normaliseToUpsertDtoWithProvenance).
// This function is no longer called directly but is referenced by unit tests
// through normaliseToUpsertDto.

function deriveNameFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const clean = base.length > 0 ? base : "Imported form";
  return clean.slice(0, 80);
}

/**
 * Derive a URL-safe uppercase code with a short randomiser. The FormsService
 * layer enforces uniqueness at the DB level and 409s on collision -- the
 * randomiser makes that extraordinarily unlikely in practice so the user
 * doesn't have to keep retrying with slightly different filenames.
 */
function deriveTemplateCode(name: string): string {
  const stem = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "IMPORTED";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${stem}-AI-${suffix}`;
}

function deriveFieldKey(label: string, sectionIdx: number, fieldIdx: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const stem = slug.length > 0 ? slug : "field";
  return `${stem}_${sectionIdx + 1}_${fieldIdx + 1}`;
}
