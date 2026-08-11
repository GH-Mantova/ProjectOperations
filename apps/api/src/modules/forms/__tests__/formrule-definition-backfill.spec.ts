import { PrismaClient } from "@prisma/client";
import type {
  ConditionOperator,
  FieldRule,
  RuleActionType,
} from "@project-ops/config/forms-rule-definition";

/**
 * Gate A — FormRule.definition backfill correctness (pipeline-correctness-gates SLICE 2)
 *
 * Closes the #923 class: the migration backfill for FormRule.definition used
 * `lower(operator)` and `lower(effect)` to normalise legacy UPPERCASE flat
 * columns. Before 23dcf30b the backfill omitted `lower()` so the produced JSONB
 * contained `"operator":"EQUALS"` which is not a member of ConditionOperator.
 *
 * This suite:
 *   1. Seeds a legacy-shape form_rules row with UPPERCASE operator + effect,
 *      definition NULL.
 *   2. Runs the IDENTICAL backfill UPDATE the migration applies.
 *   3. Asserts the produced definition is contract-valid (lowercase operator,
 *      lowercase action type, correct FieldRule shape).
 *   3b. Negative control: proves the validator CAN reject an uppercase operator
 *       so the gate is a proven instrument and not a tautology.
 *
 * Serial suite, real Postgres, self-cleaning via ZZTEST- code prefix.
 */

jest.setTimeout(60_000);

// ── Canonical validator ──────────────────────────────────────────────────────

const VALID_OPERATORS = new Set<string>([
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
  "is_not_one_of",
  "has_any_entry_where",
  "entry_count",
  "column_total",
]);

const VALID_ACTION_TYPES = new Set<string>([
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
  "block",
]);

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that a plain object conforms to the FieldRule contract.
 * Uses the canonical sets above (which mirror ConditionOperator and
 * RuleActionType in @project-ops/config/forms-rule-definition) so any
 * drift between the migration output and the canonical types will be caught.
 */
function validateFieldRule(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (raw === null || typeof raw !== "object") {
    errors.push("definition is not an object");
    return { valid: false, errors };
  }

  const rule = raw as Record<string, unknown>;

  // trigger
  const validTriggers = ["on_change", "on_load", "on_submit"];
  if (!validTriggers.includes(rule["trigger"] as string)) {
    errors.push(`invalid trigger: ${String(rule["trigger"])}`);
  }

  // conditionGroup
  const cg = rule["conditionGroup"];
  if (!cg || typeof cg !== "object") {
    errors.push("missing conditionGroup");
  } else {
    const group = cg as Record<string, unknown>;
    if (group["logic"] !== "AND" && group["logic"] !== "OR") {
      errors.push(`invalid conditionGroup.logic: ${String(group["logic"])}`);
    }
    if (!Array.isArray(group["conditions"])) {
      errors.push("conditionGroup.conditions must be an array");
    } else {
      for (let i = 0; i < group["conditions"].length; i++) {
        const cond = group["conditions"][i] as Record<string, unknown>;
        if (typeof cond["fieldKey"] !== "string" || cond["fieldKey"] === "") {
          errors.push(`conditions[${i}].fieldKey missing`);
        }
        const op = cond["operator"];
        if (typeof op !== "string" || !VALID_OPERATORS.has(op)) {
          errors.push(
            `conditions[${i}].operator is not a valid ConditionOperator: ${String(op)}`
          );
        }
      }
    }
  }

  // actions
  if (!Array.isArray(rule["actions"])) {
    errors.push("actions must be an array");
  } else {
    for (let i = 0; i < rule["actions"].length; i++) {
      const action = (rule["actions"] as Record<string, unknown>[])[i];
      const type = action["type"];
      if (typeof type !== "string" || !VALID_ACTION_TYPES.has(type)) {
        errors.push(
          `actions[${i}].type is not a valid RuleActionType: ${String(type)}`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("FormRule.definition backfill — Gate A contract correctness", () => {
  const prisma = new PrismaClient();

  const TEMPLATE_CODE = "ZZTEST-GATE-A-BACKFILL";

  let versionId: string;
  let ruleId: string;

  async function cleanup(): Promise<void> {
    await prisma.formRule.deleteMany({
      where: { version: { template: { code: TEMPLATE_CODE } } },
    });
    await prisma.formTemplateVersion.deleteMany({
      where: { template: { code: TEMPLATE_CODE } },
    });
    await prisma.formTemplate.deleteMany({
      where: { code: TEMPLATE_CODE },
    });
  }

  beforeAll(async () => {
    await cleanup();

    // Create the minimal FormTemplate + FormTemplateVersion that FormRule
    // requires (FK: form_rules.version_id → form_template_versions.id).
    const template = await prisma.formTemplate.create({
      data: {
        name: "ZZTEST Gate-A Backfill",
        code: TEMPLATE_CODE,
        status: "ACTIVE",
      },
    });
    const version = await prisma.formTemplateVersion.create({
      data: { templateId: template.id, versionNumber: 1, status: "ACTIVE" },
    });
    versionId = version.id;

    // Seed a LEGACY-shape row: UPPERCASE operator + effect, definition NULL.
    // This is the exact state rows would be in before the F-2a migration ran.
    const rule = await prisma.formRule.create({
      data: {
        versionId,
        sourceFieldKey: "hazard_type",
        targetFieldKey: "hazard_detail",
        operator: "EQUALS",   // uppercase — the pre-fix bug
        comparisonValue: "chemical",
        effect: "SHOW",       // uppercase
        definition: undefined, // NULL — backfill pending
      },
    });
    ruleId = rule.id;

    // Run the EXACT backfill SQL from migration 20260804_fv2_formrule_expand.
    // We scope it to our test row by id so we don't touch real data.
    await prisma.$executeRawUnsafe(`
      UPDATE "form_rules"
      SET "definition" = jsonb_build_object(
        'trigger', 'on_change',
        'conditionGroup', jsonb_build_object(
          'logic', 'AND',
          'conditions', jsonb_build_array(
            jsonb_build_object(
              'fieldKey', source_field_key,
              'operator', lower(operator),
              'value',    comparison_value
            )
          )
        ),
        'actions', jsonb_build_array(
          jsonb_build_object(
            'type',   lower(effect),
            'target', target_field_key
          )
        )
      )
      WHERE id = '${ruleId}' AND "definition" IS NULL
    `);
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  // ── Positive: backfill produces a contract-valid FieldRule ─────────────────

  it("populates definition (not NULL) after the backfill", async () => {
    const row = await prisma.formRule.findUniqueOrThrow({ where: { id: ruleId } });
    expect(row.definition).not.toBeNull();
  });

  it("produces trigger:on_change", async () => {
    const row = await prisma.formRule.findUniqueOrThrow({ where: { id: ruleId } });
    const def = row.definition as Record<string, unknown>;
    expect(def["trigger"]).toBe("on_change");
  });

  it("lowercases the operator — 'EQUALS' becomes 'equals' (canonical ConditionOperator)", async () => {
    const row = await prisma.formRule.findUniqueOrThrow({ where: { id: ruleId } });
    const def = row.definition as unknown as FieldRule;
    const condition = def.conditionGroup.conditions[0] as { operator: ConditionOperator };
    expect(condition.operator).toBe("equals");
    // Belt-and-braces: confirm uppercase form is gone
    expect(condition.operator).not.toBe("EQUALS");
  });

  it("lowercases the action type — 'SHOW' becomes 'show' (canonical RuleActionType)", async () => {
    const row = await prisma.formRule.findUniqueOrThrow({ where: { id: ruleId } });
    const def = row.definition as unknown as FieldRule;
    const action = def.actions[0] as { type: RuleActionType };
    expect(action.type).toBe("show");
    expect(action.type).not.toBe("SHOW");
  });

  it("passes full FieldRule contract validation", async () => {
    const row = await prisma.formRule.findUniqueOrThrow({ where: { id: ruleId } });
    const result = validateFieldRule(row.definition);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("preserves the fieldKey and comparison value from legacy columns", async () => {
    const row = await prisma.formRule.findUniqueOrThrow({ where: { id: ruleId } });
    const def = row.definition as unknown as FieldRule;
    const condition = def.conditionGroup.conditions[0] as {
      fieldKey: string;
      operator: ConditionOperator;
      value: unknown;
    };
    expect(condition.fieldKey).toBe("hazard_type");
    expect(condition.value).toBe("chemical");
    const action = def.actions[0] as { type: RuleActionType; target: string };
    expect(action.target).toBe("hazard_detail");
  });

  // ── 3b. Negative control: validator MUST reject uppercase operator ──────────
  // This proves the instrument can fail — a gate that never fails is not a gate.

  it("negative control — validator rejects an uppercase operator (pre-fix 'EQUALS')", () => {
    const preFixDefinition: unknown = {
      trigger: "on_change",
      conditionGroup: {
        logic: "AND",
        conditions: [
          {
            fieldKey: "hazard_type",
            operator: "EQUALS", // uppercase — the bug that existed before 23dcf30b
            value: "chemical",
          },
        ],
      },
      actions: [{ type: "show", target: "hazard_detail" }],
    };

    const result = validateFieldRule(preFixDefinition);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("EQUALS"))).toBe(true);
  });

  it("negative control — validator rejects an uppercase action type (pre-fix 'SHOW')", () => {
    const preFixDefinition: unknown = {
      trigger: "on_change",
      conditionGroup: {
        logic: "AND",
        conditions: [
          { fieldKey: "hazard_type", operator: "equals", value: "chemical" },
        ],
      },
      actions: [
        {
          type: "SHOW", // uppercase — would have been produced without lower(effect)
          target: "hazard_detail",
        },
      ],
    };

    const result = validateFieldRule(preFixDefinition);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("SHOW"))).toBe(true);
  });
});
