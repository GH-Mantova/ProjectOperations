import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import { AiProvidersService } from "../ai-providers/ai-providers.service";
import { sanitiseProviderError } from "../ai-providers/error-sanitiser";

/**
 * One hazard-control pair suggested by the AI for a field answer that
 * describes a hazard. Both fields are human-readable plain text.
 */
export type ControlSuggestion = {
  hazard: string;
  control: string;
};

/**
 * Whether the answers indicate a notifiable incident under the Work Health
 * and Safety Act 2011 (Cth) / Queensland WHS Regulation 2011.
 *
 * `isNotifiable` is true only when the answers clearly indicate a serious
 * injury, dangerous incident, or death. The AI is instructed to default to
 * false when unsure — this payload is advisory only.
 */
export type NotifiableIncidentFlag = {
  isNotifiable: boolean;
  /** One-sentence explanation when isNotifiable is true; empty string otherwise. */
  basis: string;
};

/**
 * Suggestion payload returned by `AiFormFillAssistService.suggest`.
 *
 * All fields are advisory: nothing here triggers a BLOCK, WARN, push action,
 * or approval-chain change. The fill page panel labels every item "AI
 * suggestion" and requires explicit accept/dismiss by the filler/supervisor.
 *
 * Suggest-never-decide is LOCKED (sot/06-active-specs.md §6, AI order 3).
 */
export type FillAssistSuggestion = {
  controlSuggestions: ControlSuggestion[];
  notifiableIncidentFlag: NotifiableIncidentFlag;
  /** One sentence summarising the key safety risk visible in the answers. */
  summary: string;
  /** AI provider that produced this suggestion — for audit/display. */
  provider: string;
};

/**
 * `AiFormFillAssistService` — fill-time AI assist for safety and incident
 * forms (AI order 3 of 4, LOCKED suggest-never-decide).
 *
 * Given the in-progress submission's answers (the caller supplies the relevant
 * hazard/incident field values), calls the AI via the `"forms"` persona scope
 * and returns a suggestion payload.
 *
 * Guardrails (all LOCKED, sot/06-active-specs.md §6):
 *  - Never writes to the submission.
 *  - Never toggles a rule action.
 *  - Never calls the push executor.
 *  - Never returns a BLOCK or WARN outcome.
 *  - All output is labelled "AI suggestion" in the UI.
 *
 * Provider selection reuses `AiProvidersService.resolveProviderConfig` via
 * the `"forms"` persona slug — same BYOK / company-key path the tendering
 * assist and inspection-builder slices already use.
 */
@Injectable()
export class AiFormFillAssistService {
  private readonly logger = new Logger(AiFormFillAssistService.name);

  constructor(private readonly aiProviders: AiProvidersService) {}

  /**
   * Produce hazard-control suggestions and a notifiable-incident flag for
   * the provided in-progress field answers.
   *
   * @param actorId - User.id of the form filler (used for provider key resolution)
   * @param submissionId - ID of the in-progress submission (used in log only)
   * @param answers - hazard/incident-related field values from the draft, as
   *   a map of `{ label: value }` pairs. The caller is responsible for filtering
   *   to relevant fields before calling this method.
   * @returns FillAssistSuggestion — advisory only, no side effects
   * @throws BadRequestException when no answers are provided
   * @throws ServiceUnavailableException when the AI provider is unavailable
   */
  async suggest(
    actorId: string,
    submissionId: string,
    answers: Record<string, unknown>
  ): Promise<FillAssistSuggestion> {
    if (!answers || Object.keys(answers).length === 0) {
      throw new BadRequestException(
        "No field answers provided. Supply at least one hazard or incident answer to get suggestions."
      );
    }

    const config = await this.aiProviders.resolveProviderConfig(actorId, "forms");

    this.logger.log(
      `FillAssist start [user=${actorId}, submission=${submissionId}, fields=${Object.keys(answers).length}, provider=${config.providerId}, source=${config.source}]`
    );

    const rawJson = await this.oneShotJson(config, answers, submissionId);
    const parsed = parseSuggestionJson(rawJson);

    return {
      ...parsed,
      provider: config.providerId
    };
  }

  /**
   * Runs a one-shot (non-streaming) AI call, accumulating the full text.
   * Same pattern as InspectionBuilderService.oneShotJson.
   */
  private async oneShotJson(
    config: Awaited<ReturnType<AiProvidersService["resolveProviderConfig"]>>,
    answers: Record<string, unknown>,
    submissionId: string
  ): Promise<string> {
    try {
      let text = "";
      for await (const chunk of this.aiProviders.streamChat({
        systemPrompt: FILL_ASSIST_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildUserPrompt(answers)
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
        `FillAssist provider error [submission=${submissionId}, category=${sanitised.category}]: ${sanitised.logMessage}`
      );
      throw new ServiceUnavailableException(sanitised.userMessage);
    }
  }
}

// ── System prompt ────────────────────────────────────────────────────────────

// Kept intentionally prescriptive. The model must reply with a single JSON
// object matching the schema — no prose, no fences.
// Mirrors the inspection-builder prompt style for consistency.
const FILL_ASSIST_SYSTEM_PROMPT = [
  "You are a safety advisor assisting a construction worker filling in a WHS form.",
  "",
  "Reply with ONE JSON object and nothing else — no markdown, no ``` fences, no commentary:",
  "",
  "{",
  '  "controlSuggestions": [',
  '    { "hazard": "brief hazard label", "control": "suggested control measure" }',
  "  ],",
  '  "notifiableIncidentFlag": {',
  '    "isNotifiable": false,',
  '    "basis": ""',
  "  },",
  '  "summary": "One sentence summarising the key safety risk in the answers."',
  "}",
  "",
  "Rules:",
  "- Provide at most 5 control suggestions. Base them ONLY on the answers provided.",
  "- Never invent hazards or scenarios not present in the field answers.",
  "- `isNotifiable` is true ONLY when answers clearly describe a serious injury,",
  "  dangerous incident, or death as defined by the WHS Act 2011 (Cth) or",
  "  Queensland WHS Regulation 2011. When uncertain, set false — do not guess.",
  "- If no hazard or incident content is present, return empty controlSuggestions",
  "  and isNotifiable: false.",
  "- All output is advisory only. Never suggest blocking or preventing a submission.",
  "- Keep language plain and direct — these are construction workers, not lawyers.",
  "- `basis` is a one-sentence WHS Act reference only when isNotifiable is true;",
  "  otherwise an empty string."
].join("\n");

// ── User prompt builder ───────────────────────────────────────────────────────

function buildUserPrompt(answers: Record<string, unknown>): string {
  const lines: string[] = ["In-progress form field answers:"];
  for (const [label, value] of Object.entries(answers)) {
    const displayValue =
      value === null || value === undefined
        ? "(no answer)"
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
    lines.push(`  ${label}: ${displayValue}`);
  }
  lines.push("");
  lines.push("Return the JSON suggestion payload now.");
  return lines.join("\n");
}

// ── Response parser ────────────────────────────────────────────────────────────

/**
 * Parse the AI's suggestion JSON. Tries strict parse first; falls back to
 * extracting the first `{ … }` block (mirrors parseAiTemplateJson pattern
 * from inspection-builder.service.ts).
 */
function parseSuggestionJson(raw: string): Omit<FillAssistSuggestion, "provider"> {
  const trimmed = raw.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first !== -1 && last > first) {
      try {
        parsed = JSON.parse(trimmed.slice(first, last + 1));
      } catch {
        // fall through
      }
    }
    if (!parsed) {
      throw new ServiceUnavailableException(
        "The AI assistant returned an unreadable response. Please try again."
      );
    }
  }

  return coerceSuggestion(parsed as Record<string, unknown>);
}

function coerceSuggestion(
  obj: Record<string, unknown>
): Omit<FillAssistSuggestion, "provider"> {
  // controlSuggestions
  const rawSuggestions = Array.isArray(obj.controlSuggestions) ? obj.controlSuggestions : [];
  const controlSuggestions: ControlSuggestion[] = rawSuggestions
    .filter(
      (s): s is { hazard?: unknown; control?: unknown } =>
        s !== null && typeof s === "object"
    )
    .map((s) => ({
      hazard: typeof s.hazard === "string" ? s.hazard.trim() : "",
      control: typeof s.control === "string" ? s.control.trim() : ""
    }))
    .filter((s) => s.hazard.length > 0 && s.control.length > 0)
    .slice(0, 5);

  // notifiableIncidentFlag
  const rawFlag =
    obj.notifiableIncidentFlag !== null &&
    typeof obj.notifiableIncidentFlag === "object"
      ? (obj.notifiableIncidentFlag as Record<string, unknown>)
      : {};
  const notifiableIncidentFlag: NotifiableIncidentFlag = {
    isNotifiable: rawFlag.isNotifiable === true,
    basis:
      typeof rawFlag.basis === "string" && rawFlag.isNotifiable === true
        ? rawFlag.basis.trim()
        : ""
  };

  // summary
  const summary =
    typeof obj.summary === "string" && obj.summary.trim().length > 0
      ? obj.summary.trim()
      : "";

  return { controlSuggestions, notifiableIncidentFlag, summary };
}
