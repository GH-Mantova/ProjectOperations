import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import { AiProvidersService } from "../ai-providers/ai-providers.service";
import { sanitiseProviderError } from "../ai-providers/error-sanitiser";
import {
  parseAiTemplateJson,
  normaliseToUpsertDto
} from "./inspection-builder.service";
import { FormsService } from "./forms.service";

/**
 * `AiFormDescribeService` -- describe-to-generate draft template (AI order 2).
 *
 * Accepts a plain-language description (e.g. "a working-at-heights permit with
 * 2-stage sign-off") and produces a DRAFT `FormTemplate` using the same JSON
 * envelope shape, JSON parser, and coercion helpers already used by
 * `InspectionBuilderService` -- no duplication of the parser.
 *
 * Like the PDF import path:
 *  - The template is always created in DRAFT status.
 *  - Publishing is a separate, human-driven step in the designer.
 *  - Provider selection uses `AiProvidersService.resolveProviderConfig` via the
 *    `"forms"` persona scope (same BYOK / company-key path).
 *
 * Guardrail (LOCKED, sot/06-active-specs.md section 6, AI order 2):
 *  - Never publishes a template autonomously.
 *  - All output is advisory / draft; a human must open the designer and publish.
 */
@Injectable()
export class AiFormDescribeService {
  private readonly logger = new Logger(AiFormDescribeService.name);

  constructor(
    private readonly aiProviders: AiProvidersService,
    private readonly forms: FormsService
  ) {}

  /**
   * Generate a DRAFT form template from a plain-language description.
   *
   * @param actorId - User.id of the requesting user (used for provider key resolution)
   * @param description - Free-text description of the form to generate
   * @returns id, name, provider, fieldCount, sectionCount of the created draft
   * @throws BadRequestException when description is empty
   * @throws ServiceUnavailableException when the AI provider is unavailable
   */
  async buildFromDescription(
    actorId: string,
    description: string
  ): Promise<{ id: string; name: string; provider: string; fieldCount: number; sectionCount: number }> {
    const trimmed = (description ?? "").trim();
    if (trimmed.length < 5) {
      throw new BadRequestException(
        "Provide at least a brief description of the form you want to generate (e.g. \"a working-at-heights permit with 2-stage sign-off\")."
      );
    }
    if (trimmed.length > 2000) {
      throw new BadRequestException(
        "Description is too long. Keep it under 2000 characters and describe the form's purpose, key sections, and any sign-off requirements."
      );
    }

    const config = await this.aiProviders.resolveProviderConfig(actorId, "forms");

    this.logger.log(
      `Describe-to-generate start [user=${actorId}, descriptionLen=${trimmed.length}, provider=${config.providerId}, source=${config.source}]`
    );

    const rawJson = await this.oneShotJson(config, trimmed);
    const parsed = parseAiTemplateJson(rawJson);
    const dto = normaliseToUpsertDto(parsed, trimmed.slice(0, 40));

    const created = await this.forms.createTemplate(dto, actorId);
    const versionsCount = created.versions?.length ?? 0;
    const firstVersion = versionsCount > 0 ? created.versions[0] : null;
    const sectionCount = firstVersion?.sections?.length ?? 0;
    const fieldCount =
      firstVersion?.sections?.reduce(
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

  /**
   * Runs a one-shot (non-streaming) AI call, accumulating the full text.
   * Same pattern as InspectionBuilderService.oneShotJson.
   */
  private async oneShotJson(
    config: Awaited<ReturnType<AiProvidersService["resolveProviderConfig"]>>,
    description: string
  ): Promise<string> {
    try {
      let text = "";
      for await (const chunk of this.aiProviders.streamChat({
        systemPrompt: DESCRIBE_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildUserPrompt(description)
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
        `Describe-to-generate provider error [category=${sanitised.category}]: ${sanitised.logMessage}`
      );
      throw new ServiceUnavailableException(sanitised.userMessage);
    }
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

// Mirrors the inspection-builder system prompt shape. The model must reply with
// a single JSON object -- no prose, no fences. Coercion of any unknown field
// types is handled in normaliseToUpsertDto (reused from the import path).
const DESCRIBE_SYSTEM_PROMPT = [
  "You design safety and compliance forms for an Australian construction company.",
  "Given a plain-language description, produce a complete form template in JSON.",
  "",
  "Reply with ONE JSON object and nothing else -- no markdown, no ``` fences, no commentary. The object MUST match this shape:",
  "",
  "{",
  '  "name": "Short human-readable form name (max 80 chars).",',
  '  "description": "One-sentence summary of what the form captures.",',
  '  "sections": [',
  "    {",
  '      "title": "Section heading.",',
  '      "fields": [',
  "        {",
  '          "label": "Question / field label.",',
  '          "fieldType": "text|textarea|number|date|time|email|phone|address|multiple_choice|checkbox|radio|rating|scale|signature|image_capture|heading|paragraph",',
  '          "isRequired": true,',
  '          "helpText": "Optional guidance text.",',
  '          "options": ["Yes","No","N/A"]',
  "        }",
  "      ]",
  "    }",
  "  ]",
  "}",
  "",
  "Rules:",
  "- Include all sections and fields needed to fulfil the described purpose.",
  "- Every sign-off or approval step gets a `signature` field.",
  "- Multi-stage sign-off means multiple sequential signature fields, each labelled with its stage.",
  "- Use `checkbox` for yes/no or pass/fail items (2-3 options) -- populate `options`.",
  "- Use `multiple_choice` when listing more than 3 mutually-exclusive answers.",
  "- Use `heading` for section subtitles and `paragraph` for standing instructions.",
  "- Australian WHS / safety context: default permit forms must include hazard identification,",
  "  risk controls, and at least one site supervisor sign-off.",
  "- Keep field labels plain and direct -- these are construction workers, not lawyers.",
  "- If unsure of a field type, default to `text`."
].join("\n");

function buildUserPrompt(description: string): string {
  return [
    "Form description:",
    description,
    "",
    "Return the JSON template now."
  ].join("\n");
}
