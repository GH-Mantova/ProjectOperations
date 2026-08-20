import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import { AiProvidersService } from "../ai-providers/ai-providers.service";
import { sanitiseProviderError } from "../ai-providers/error-sanitiser";
import type { FieldRule } from "@project-ops/config/forms-rule-definition";

/**
 * A minimal field descriptor passed to `AiRuleDraftService.draftRule`.
 * Only the data the AI needs to reference field names is included.
 */
export type RuleDraftField = {
  fieldKey: string;
  label: string;
  fieldType: string;
};

/**
 * `AiRuleDraftService` -- AI rule-drafting bar (AI order 2, rules half).
 *
 * Given a plain-language description of a desired rule (e.g. "when the
 * worker marks a hazard as critical, require a supervisor signature and warn
 * before submit") plus the current form's field list, returns a drafted
 * `FieldRule`-shaped object for the rules builder to render.
 *
 * Guardrails (ALL LOCKED, sot/06-active-specs.md section 6):
 *  - The returned tree is NEVER persisted or enabled by this service.
 *  - It is a draft returned to the caller for human review in the builder UI.
 *  - The human must click "Save rules" in the existing builder for anything
 *    to be stored. This service has no FormsService dependency by design.
 *  - All output is labelled "AI suggestion" by the calling UI component.
 */
@Injectable()
export class AiRuleDraftService {
  private readonly logger = new Logger(AiRuleDraftService.name);

  constructor(private readonly aiProviders: AiProvidersService) {}

  /**
   * Produce a drafted `FieldRule` from a plain-language description.
   *
   * @param actorId - User.id of the requesting user (used for provider key resolution)
   * @param ruleDescription - Plain-language description of the desired rule
   * @param fields - The current form's field list (key, label, type) for the AI to reference
   * @returns A `FieldRule`-shaped draft -- never saved or enabled by this service
   * @throws BadRequestException when description or fields are missing/empty
   * @throws ServiceUnavailableException when the AI provider is unavailable
   */
  async draftRule(
    actorId: string,
    ruleDescription: string,
    fields: RuleDraftField[]
  ): Promise<FieldRule> {
    const trimmed = (ruleDescription ?? "").trim();
    if (trimmed.length < 5) {
      throw new BadRequestException(
        "Provide a description of the rule you want to draft (e.g. \"when hazard severity is Critical, require supervisor sign-off\")."
      );
    }
    if (trimmed.length > 1000) {
      throw new BadRequestException(
        "Rule description is too long. Keep it under 1000 characters."
      );
    }
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new BadRequestException(
        "A field list is required so the AI can reference your form's fields by key."
      );
    }

    const config = await this.aiProviders.resolveProviderConfig(actorId, "forms");

    this.logger.log(
      `Rule-draft start [user=${actorId}, descriptionLen=${trimmed.length}, fieldCount=${fields.length}, provider=${config.providerId}, source=${config.source}]`
    );

    const rawJson = await this.oneShotJson(config, trimmed, fields);
    return parseRuleDraftJson(rawJson);
  }

  /**
   * Runs a one-shot (non-streaming) AI call, accumulating the full text.
   * Same pattern as InspectionBuilderService.oneShotJson and AiFormFillAssistService.oneShotJson.
   */
  private async oneShotJson(
    config: Awaited<ReturnType<AiProvidersService["resolveProviderConfig"]>>,
    ruleDescription: string,
    fields: RuleDraftField[]
  ): Promise<string> {
    try {
      let text = "";
      for await (const chunk of this.aiProviders.streamChat({
        systemPrompt: RULE_DRAFT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildUserPrompt(ruleDescription, fields)
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
        `Rule-draft provider error [category=${sanitised.category}]: ${sanitised.logMessage}`
      );
      throw new ServiceUnavailableException(sanitised.userMessage);
    }
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

const RULE_DRAFT_SYSTEM_PROMPT = [
  "You draft condition/action rules for a safety and compliance forms engine.",
  "",
  "Reply with ONE JSON object and nothing else -- no markdown, no ``` fences, no commentary.",
  "The object MUST match this FieldRule shape:",
  "",
  "{",
  '  "trigger": "on_change|on_load|on_submit",',
  '  "conditionGroup": {',
  '    "logic": "AND",',
  '    "conditions": [',
  "      {",
  '        "fieldKey": "field_key_from_the_list",',
  '        "operator": "equals|not_equals|contains|not_contains|greater_than|less_than|between|is_empty|is_not_empty|is_one_of|is_not_one_of",',
  '        "value": "comparison value"',
  "      }",
  "    ]",
  "  },",
  '  "actions": [',
  "    {",
  '      "type": "show|hide|require|unrequire|set_value|clear_value|lock|unlock|warn|block|send_notification|create_record",',
  '      "target": "target_field_key (for show/hide/require/unrequire/set_value/clear_value/lock/unlock)",',
  '      "warnMessage": "Message shown to the submitter (for warn actions only)",',
  '      "blockMessage": "Message blocking submit (for block actions only)"',
  "    }",
  "  ]",
  "}",
  "",
  "Rules:",
  "- Use ONLY fieldKey values from the field list provided by the user. Never invent fieldKeys.",
  "- Choose `trigger` based on intent: on_change for field-interaction rules, on_submit for submit-gates, on_load for initial state.",
  "- For multi-condition rules, nest conditions in `conditionGroup` using AND / OR logic.",
  "- `warn` and `block` are only meaningful on on_submit triggers.",
  "- `target` is only needed for UI-effect actions (show/hide/require/unrequire/set_value/clear_value/lock/unlock).",
  "- Output a DRAFT only. It is never saved automatically -- a human reviews and saves it.",
  "- If the description is too vague to produce a useful rule, produce a sensible best-guess scaffold",
  "  with empty string conditions that the human can fill in."
].join("\n");

function buildUserPrompt(ruleDescription: string, fields: RuleDraftField[]): string {
  const fieldLines = fields
    .map((f) => `  - fieldKey: "${f.fieldKey}", label: "${f.label}", type: ${f.fieldType}`)
    .join("\n");
  return [
    "Rule description:",
    ruleDescription,
    "",
    "Available form fields (use ONLY these fieldKey values):",
    fieldLines,
    "",
    "Return the drafted FieldRule JSON now."
  ].join("\n");
}

// ── Response parser ────────────────────────────────────────────────────────────

/**
 * Parse the AI's FieldRule JSON. Tries strict parse first; falls back to
 * extracting the first `{ ... }` block (mirrors parseAiTemplateJson pattern).
 * Coerces missing/invalid fields to safe defaults so the builder always
 * receives a valid FieldRule scaffold rather than crashing.
 */
function parseRuleDraftJson(raw: string): FieldRule {
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
        "The AI assistant returned an unreadable rule draft. Please try again."
      );
    }
  }

  return coerceFieldRule(parsed as Record<string, unknown>);
}

const VALID_TRIGGERS = new Set(["on_change", "on_load", "on_submit"]);
const VALID_OPERATORS = new Set([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "greater_than",
  "less_than",
  "between",
  "is_empty",
  "is_not_empty",
  "is_one_of",
  "is_not_one_of"
]);
const VALID_ACTION_TYPES = new Set([
  "show",
  "hide",
  "require",
  "unrequire",
  "set_value",
  "clear_value",
  "lock",
  "unlock",
  "jump_to_section",
  "submit_form",
  "send_notification",
  "create_record",
  "add_repeating_row",
  "remove_repeating_row",
  "warn",
  "block"
]);

function coerceFieldRule(obj: Record<string, unknown>): FieldRule {
  const rawTrigger = typeof obj.trigger === "string" ? obj.trigger : "on_submit";
  const trigger = (VALID_TRIGGERS.has(rawTrigger) ? rawTrigger : "on_submit") as FieldRule["trigger"];

  const conditionGroup = coerceConditionGroup(
    obj.conditionGroup as Record<string, unknown> | undefined
  );

  const rawActions = Array.isArray(obj.actions) ? obj.actions : [];
  const actions = rawActions
    .filter((a): a is Record<string, unknown> => a !== null && typeof a === "object")
    .map(coerceAction)
    .filter((a): a is FieldRule["actions"][number] => a !== null);

  return { trigger, conditionGroup, actions };
}

function coerceConditionGroup(
  obj: Record<string, unknown> | undefined
): import("@project-ops/config/forms-rule-definition").ConditionGroup {
  if (!obj || typeof obj !== "object") {
    return { logic: "AND", conditions: [] };
  }
  const logic = obj.logic === "OR" ? "OR" : "AND";
  const rawConditions = Array.isArray(obj.conditions) ? obj.conditions : [];
  const conditions = rawConditions
    .filter((c) => c !== null && typeof c === "object")
    .map((c) => coerceConditionOrGroup(c as Record<string, unknown>))
    .filter(Boolean) as import("@project-ops/config/forms-rule-definition").ConditionGroup["conditions"];
  return { logic, conditions };
}

function coerceConditionOrGroup(
  obj: Record<string, unknown>
): import("@project-ops/config/forms-rule-definition").Condition | import("@project-ops/config/forms-rule-definition").ConditionGroup | null {
  // It's a nested group if it has a `conditions` array
  if (Array.isArray(obj.conditions)) {
    return coerceConditionGroup(obj);
  }
  // Otherwise treat as a leaf Condition
  const fieldKey = typeof obj.fieldKey === "string" ? obj.fieldKey.trim() : "";
  if (fieldKey.length === 0) return null;
  const rawOp = typeof obj.operator === "string" ? obj.operator : "equals";
  const operator = (VALID_OPERATORS.has(rawOp) ? rawOp : "equals") as import("@project-ops/config/forms-rule-definition").ConditionOperator;
  return { fieldKey, operator, value: obj.value ?? "" };
}

function coerceAction(
  obj: Record<string, unknown>
): FieldRule["actions"][number] | null {
  const rawType = typeof obj.type === "string" ? obj.type : "";
  if (!VALID_ACTION_TYPES.has(rawType)) return null;
  const type = rawType as FieldRule["actions"][number]["type"];
  const action: FieldRule["actions"][number] = { type };
  if (typeof obj.target === "string" && obj.target.trim().length > 0) {
    action.target = obj.target.trim();
  }
  if (typeof obj.value !== "undefined") {
    action.value = obj.value;
  }
  if (type === "warn" && typeof obj.warnMessage === "string") {
    action.warnMessage = obj.warnMessage.trim();
  }
  if (type === "block" && typeof obj.blockMessage === "string") {
    action.blockMessage = obj.blockMessage.trim();
  }
  return action;
}
