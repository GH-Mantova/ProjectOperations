import { PrismaClient } from "@prisma/client";
import type {
  ConditionOperator,
  FieldRule,
  RuleActionType,
} from "@project-ops/config/forms-rule-definition";

/**
 * Gate A — FormRule.definition contract correctness (F-2c)
 *
 * After the F-2c contract drop (this PR), the five legacy flat columns
 * (sourceFieldKey, targetFieldKey, operator, comparisonValue, effect) are
 * gone. FormRule.definition is the single source of truth.
 *
 * This suite:
 *   1. Seeds a form_rules row with a correctly-shaped definition JSON.
 *   2. Asserts the stored definition passes the FieldRule contract validator.
 *   3. Negative controls: proves the validator can reject uppercase operator
 *      and action type (instrument is not a tautology).
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

describe("FormRule.definition — Gate A contract correctness (F-2c)", () => {
  const prisma = new PrismaClient();

  const TEMPLATE_CODE = "ZZTEST-GATE-A-BACKFILL";

  let versionId: string;
  let ruleId: string;

  // Canonical definition seeded directly (legacy columns no longer exist after F-2c).
  const SEED_DEFINITION = {
    trigger: "on_change",
    conditionGroup: {
      logic: "AND",
      conditions: [{ fieldKey: "hazard_type", operator: "equals", value: "chemical" }],
    },
    actions: [{ type: "show", target: "hazard_detail" }],
  };

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

    // Seed a definition-only row (F-2c: legacy flat columns have been dropped).
    const rule = await prisma.formRule.create({
      data: {
        versionId,
        definition: SEED_DEFINITION,
      },
    });
    ruleId = rule.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  // ── Positive: definition is stored and contract-valid ──────────────────────

  it("stores definition (not NULL)", async () => {
    const row = await prisma.formRule.findUniqueOrThrow({ where: { id: ruleId } });
    expect(row.definition).not.toBeNull();
  });

  it("produces trigger:on_change", async () => {
    const row = await prisma.formRule.findUniqueOrThrow({ where: { id: ruleId } });
    const def = row.definition as Record<string, unknown>;
    expect(def["trigger"]).toBe("on_change");
  });

  it("stores lowercase operator (canonical ConditionOperator)", async () => {
    const row = await prisma.formRule.findUniqueOrThrow({ where: { id: ruleId } });
    const def = row.definition as unknown as FieldRule;
    const condition = def.conditionGroup.conditions[0] as { operator: ConditionOperator };
    expect(condition.operator).toBe("equals");
  });

  it("stores lowercase action type (canonical RuleActionType)", async () => {
    const row = await prisma.formRule.findUniqueOrThrow({ where: { id: ruleId } });
    const def = row.definition as unknown as FieldRule;
    const action = def.actions[0] as { type: RuleActionType };
    expect(action.type).toBe("show");
  });

  it("passes full FieldRule contract validation", async () => {
    const row = await prisma.formRule.findUniqueOrThrow({ where: { id: ruleId } });
    const result = validateFieldRule(row.definition);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("preserves fieldKey and value in the stored definition", async () => {
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

  // ── Negative controls: validator MUST reject invalid shapes ────────────────
  // This proves the instrument can fail — a gate that never fails is not a gate.

  it("negative control — validator rejects an uppercase operator ('EQUALS')", () => {
    const invalidDefinition: unknown = {
      trigger: "on_change",
      conditionGroup: {
        logic: "AND",
        conditions: [
          {
            fieldKey: "hazard_type",
            operator: "EQUALS",
            value: "chemical",
          },
        ],
      },
      actions: [{ type: "show", target: "hazard_detail" }],
    };

    const result = validateFieldRule(invalidDefinition);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("EQUALS"))).toBe(true);
  });

  it("negative control — validator rejects an uppercase action type ('SHOW')", () => {
    const invalidDefinition: unknown = {
      trigger: "on_change",
      conditionGroup: {
        logic: "AND",
        conditions: [
          { fieldKey: "hazard_type", operator: "equals", value: "chemical" },
        ],
      },
      actions: [
        {
          type: "SHOW",
          target: "hazard_detail",
        },
      ],
    };

    const result = validateFieldRule(invalidDefinition);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("SHOW"))).toBe(true);
  });
});
