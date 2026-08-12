import {
  RulesEngineService,
  type Condition,
  type ConditionGroup,
  type SystemCondition,
  type SystemAction,
  type SystemActionDeps
} from "./rules-engine.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { SystemContextSnapshot } from "./system-context-resolver.service";

// PrismaService is only consumed by checkComplianceGates and system-action
// helpers. We stub it with a thin mock so the pure evaluation paths can run
// without a real DB connection.

function makeService(qualifications: Array<{ qualType: string; expiryDate: Date | null }> = []) {
  const prismaMock = {
    workerProfile: {
      findUnique: jest.fn().mockResolvedValue({
        id: "worker-1",
        internalUserId: "user-1",
        qualifications
      })
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null)
    },
    formApproval: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "approval-1" }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 })
    }
  } as unknown as PrismaService;
  const notifMock = {
    create: jest.fn().mockResolvedValue(undefined)
  };
  const emailMock = {
    sendNotificationEmail: jest.fn().mockResolvedValue(undefined)
  };
  return new RulesEngineService(
    prismaMock,
    notifMock as never,
    emailMock as never
  );
}

/** Minimal snapshot fixture for system-context condition tests. */
function makeSnapshot(overrides?: Partial<SystemContextSnapshot>): SystemContextSnapshot {
  return {
    resolvedAt: new Date().toISOString(),
    assetReadings: [],
    competencies: [],
    site: null,
    weather: null,
    timesheetHours7d: null,
    fillerRole: null,
    ...overrides
  };
}

/** Minimal deps stub for executeSystemActions. */
function makeDeps(overrides?: Partial<SystemActionDeps>): SystemActionDeps {
  return {
    notifications: { create: jest.fn().mockResolvedValue(undefined) } as never,
    email: { sendNotificationEmail: jest.fn().mockResolvedValue(undefined) } as never,
    compliance: { createDeadlineTask: jest.fn().mockResolvedValue("task-1") } as never,
    pushExecutor: { executePushes: jest.fn().mockResolvedValue(undefined) } as never,
    ...overrides
  };
}

describe("RulesEngineService — evaluateConditionGroup", () => {
  const svc = makeService();

  it("AND group with both true is true", () => {
    const group: ConditionGroup = {
      logic: "AND",
      conditions: [
        { fieldKey: "a", operator: "equals", value: 1 } as Condition,
        { fieldKey: "b", operator: "equals", value: 2 } as Condition
      ]
    };
    expect(svc.evaluateConditionGroup(group, { a: 1, b: 2 })).toBe(true);
  });

  it("AND group with one false is false", () => {
    const group: ConditionGroup = {
      logic: "AND",
      conditions: [
        { fieldKey: "a", operator: "equals", value: 1 } as Condition,
        { fieldKey: "b", operator: "equals", value: 99 } as Condition
      ]
    };
    expect(svc.evaluateConditionGroup(group, { a: 1, b: 2 })).toBe(false);
  });

  it("OR group with one true is true", () => {
    const group: ConditionGroup = {
      logic: "OR",
      conditions: [
        { fieldKey: "a", operator: "equals", value: 99 } as Condition,
        { fieldKey: "b", operator: "equals", value: 2 } as Condition
      ]
    };
    expect(svc.evaluateConditionGroup(group, { a: 1, b: 2 })).toBe(true);
  });

  it("OR group with both false is false", () => {
    const group: ConditionGroup = {
      logic: "OR",
      conditions: [
        { fieldKey: "a", operator: "equals", value: 99 } as Condition,
        { fieldKey: "b", operator: "equals", value: 99 } as Condition
      ]
    };
    expect(svc.evaluateConditionGroup(group, { a: 1, b: 2 })).toBe(false);
  });

  it("nested A AND (B OR C)", () => {
    const group: ConditionGroup = {
      logic: "AND",
      conditions: [
        { fieldKey: "a", operator: "equals", value: 1 } as Condition,
        {
          logic: "OR",
          conditions: [
            { fieldKey: "b", operator: "equals", value: 99 } as Condition,
            { fieldKey: "c", operator: "equals", value: 3 } as Condition
          ]
        } as ConditionGroup
      ]
    };
    expect(svc.evaluateConditionGroup(group, { a: 1, b: 2, c: 3 })).toBe(true);
    expect(svc.evaluateConditionGroup(group, { a: 1, b: 2, c: 99 })).toBe(false);
  });

  it("empty group is true (no constraint)", () => {
    expect(svc.evaluateConditionGroup({ logic: "AND", conditions: [] }, {})).toBe(true);
  });

  it("operator coverage", () => {
    const v = { n: 5, s: "hello world", arr: ["a", "b"], blank: "", missing: undefined };
    const cases: Array<[Condition, boolean]> = [
      [{ fieldKey: "n", operator: "equals", value: 5 }, true],
      [{ fieldKey: "n", operator: "not_equals", value: 4 }, true],
      [{ fieldKey: "s", operator: "contains", value: "world" }, true],
      [{ fieldKey: "s", operator: "not_contains", value: "zzz" }, true],
      [{ fieldKey: "n", operator: "greater_than", value: 1 }, true],
      [{ fieldKey: "n", operator: "less_than", value: 10 }, true],
      [{ fieldKey: "n", operator: "between", value: 1, value2: 10 }, true],
      [{ fieldKey: "n", operator: "between", value: 100, value2: 200 }, false],
      [{ fieldKey: "blank", operator: "is_empty" }, true],
      [{ fieldKey: "n", operator: "is_not_empty" }, true],
      [{ fieldKey: "missing", operator: "is_empty" }, true],
      [{ fieldKey: "arr", operator: "contains", value: "a" }, true],
      [{ fieldKey: "n", operator: "is_one_of", value: [1, 5, 10] }, true],
      [{ fieldKey: "n", operator: "is_not_one_of", value: [2, 3, 4] }, true]
    ];
    for (const [cond, expected] of cases) {
      expect(svc.evaluateCondition(cond, v as never)).toBe(expected);
    }
  });
});

describe("RulesEngineService — validateValues", () => {
  const svc = makeService();

  it("required field empty → error", () => {
    const tpl = {
      sections: [
        {
          fields: [
            { fieldKey: "name", label: "Name", isRequired: true, fieldType: "short_text" }
          ]
        }
      ]
    };
    const result = svc.validateValues(tpl, {});
    expect(result.valid).toBe(false);
    expect(result.errors.name).toMatch(/required/i);
  });

  it("required field filled → pass", () => {
    const tpl = {
      sections: [
        {
          fields: [{ fieldKey: "name", label: "Name", isRequired: true, fieldType: "short_text" }]
        }
      ]
    };
    expect(svc.validateValues(tpl, { name: "Marco" }).valid).toBe(true);
  });

  it("email validation rejects invalid value", () => {
    const tpl = {
      sections: [
        {
          fields: [{ fieldKey: "e", label: "Email", isRequired: false, fieldType: "email" }]
        }
      ]
    };
    expect(svc.validateValues(tpl, { e: "not-an-email" }).valid).toBe(false);
    expect(svc.validateValues(tpl, { e: "good@example.com" }).valid).toBe(true);
  });

  it("number min/max custom validations", () => {
    const tpl = {
      sections: [
        {
          fields: [
            {
              fieldKey: "n",
              label: "Quantity",
              isRequired: false,
              fieldType: "number",
              validations: [
                { type: "min", value: 1, message: "Quantity must be at least 1." },
                { type: "max", value: 100 }
              ]
            }
          ]
        }
      ]
    };
    expect(svc.validateValues(tpl, { n: 5 }).valid).toBe(true);
    expect(svc.validateValues(tpl, { n: 0 }).errors.n).toBe("Quantity must be at least 1.");
    expect(svc.validateValues(tpl, { n: 200 }).errors.n).toBeDefined();
  });

  it("conditional required: condition met + empty → error", () => {
    const tpl = {
      sections: [
        {
          fields: [
            { fieldKey: "trigger", label: "Trigger", isRequired: false, fieldType: "toggle" },
            {
              fieldKey: "details",
              label: "Details",
              isRequired: false,
              fieldType: "long_text",
              conditions: [
                {
                  trigger: "on_change",
                  conditionGroup: {
                    logic: "AND",
                    conditions: [{ fieldKey: "trigger", operator: "equals", value: true }]
                  },
                  actions: [{ type: "require" }]
                }
              ]
            }
          ]
        }
      ]
    };
    expect(svc.validateValues(tpl, { trigger: true }).errors.details).toBeDefined();
    expect(svc.validateValues(tpl, { trigger: false }).valid).toBe(true);
    expect(svc.validateValues(tpl, { trigger: true, details: "..." }).valid).toBe(true);
  });
});

describe("RulesEngineService — checkComplianceGates", () => {
  it("asbestos category + valid asbestos_b qualification → passes", async () => {
    const svc = makeService([
      { qualType: "asbestos_b", expiryDate: new Date("2099-01-01") }
    ]);
    const result = await svc.checkComplianceGates(
      { category: "asbestos" },
      "user-1"
    );
    expect(result.passed).toBe(true);
  });

  it("asbestos category + no qualification → fails with message", async () => {
    const svc = makeService([]);
    const result = await svc.checkComplianceGates(
      { category: "asbestos" },
      "user-1"
    );
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toMatch(/asbestos/i);
  });

  it("asbestos category + expired qualification → fails", async () => {
    const svc = makeService([
      { qualType: "asbestos_a", expiryDate: new Date("2000-01-01") }
    ]);
    const result = await svc.checkComplianceGates(
      { category: "asbestos" },
      "user-1"
    );
    expect(result.passed).toBe(false);
  });

  it("non-asbestos category → no gate applies", async () => {
    const svc = makeService([]);
    const result = await svc.checkComplianceGates({ category: "daily" }, "user-1");
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });
});

describe("RulesEngineService — collectOnSubmitActions", () => {
  const svc = makeService();

  it("returns matching on_submit actions only when conditions hold", () => {
    const tpl = {
      sections: [
        {
          fields: [
            {
              actions: [
                {
                  trigger: "on_submit",
                  conditionGroup: {
                    logic: "AND",
                    conditions: [{ fieldKey: "severity", operator: "equals", value: "critical" }]
                  },
                  actions: [
                    {
                      type: "send_notification",
                      notificationTarget: "safety.admin",
                      notificationMessage: "Critical incident reported"
                    }
                  ]
                },
                {
                  trigger: "on_change",
                  conditionGroup: { logic: "AND", conditions: [] },
                  actions: [{ type: "show", target: "details" }]
                }
              ]
            }
          ]
        }
      ]
    };
    const collected = svc.collectOnSubmitActions(tpl, { severity: "critical" });
    expect(collected).toHaveLength(1);
    expect(collected[0].type).toBe("send_notification");

    const noMatch = svc.collectOnSubmitActions(tpl, { severity: "low" });
    expect(noMatch).toHaveLength(0);
  });
});

// ── System-context condition evaluation ────────────────────────────────────

describe("RulesEngineService — evaluateSystemCondition", () => {
  const svc = makeService();

  it("role_equals: matches when fillerRole equals value", () => {
    const snapshot = makeSnapshot({ fillerRole: "supervisor" });
    const cond: SystemCondition = { systemType: "role_equals", value: "supervisor" };
    expect(svc.evaluateSystemCondition(cond, snapshot)).toBe(true);
  });

  it("role_equals: no match on different role", () => {
    const snapshot = makeSnapshot({ fillerRole: "worker" });
    const cond: SystemCondition = { systemType: "role_equals", value: "supervisor" };
    expect(svc.evaluateSystemCondition(cond, snapshot)).toBe(false);
  });

  it("role_equals: null fillerRole returns false", () => {
    const snapshot = makeSnapshot({ fillerRole: null });
    const cond: SystemCondition = { systemType: "role_equals", value: "supervisor" };
    expect(svc.evaluateSystemCondition(cond, snapshot)).toBe(false);
  });

  it("timesheet_hours_7d_above: fires when hours exceed threshold", () => {
    const snapshot = makeSnapshot({ timesheetHours7d: 50 });
    const cond: SystemCondition = { systemType: "timesheet_hours_7d_above", value: 40 };
    expect(svc.evaluateSystemCondition(cond, snapshot)).toBe(true);
  });

  it("timesheet_hours_7d_above: false when hours below threshold", () => {
    const snapshot = makeSnapshot({ timesheetHours7d: 30 });
    const cond: SystemCondition = { systemType: "timesheet_hours_7d_above", value: 40 };
    expect(svc.evaluateSystemCondition(cond, snapshot)).toBe(false);
  });

  it("timesheet_hours_7d_above: false when timesheetHours7d is null", () => {
    const snapshot = makeSnapshot({ timesheetHours7d: null });
    const cond: SystemCondition = { systemType: "timesheet_hours_7d_above", value: 40 };
    expect(svc.evaluateSystemCondition(cond, snapshot)).toBe(false);
  });

  it("competency_expired: true when any competency is expired", () => {
    const snapshot = makeSnapshot({
      competencies: [
        {
          competencyId: "c1",
          competencyName: "First Aid",
          competencyCode: null,
          achievedAt: null,
          expiresAt: new Date("2000-01-01"),
          isExpired: true
        }
      ]
    });
    const cond: SystemCondition = { systemType: "competency_expired" };
    expect(svc.evaluateSystemCondition(cond, snapshot)).toBe(true);
  });

  it("competency_expired: false when no competencies are expired", () => {
    const snapshot = makeSnapshot({
      competencies: [
        {
          competencyId: "c1",
          competencyName: "First Aid",
          competencyCode: null,
          achievedAt: null,
          expiresAt: new Date("2099-01-01"),
          isExpired: false
        }
      ]
    });
    const cond: SystemCondition = { systemType: "competency_expired" };
    expect(svc.evaluateSystemCondition(cond, snapshot)).toBe(false);
  });

  it("competency_expiring_within_days: fires for a competency expiring inside window", () => {
    const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
    const snapshot = makeSnapshot({
      competencies: [
        {
          competencyId: "c1",
          competencyName: "First Aid",
          competencyCode: null,
          achievedAt: null,
          expiresAt: soon,
          isExpired: false
        }
      ]
    });
    const cond: SystemCondition = {
      systemType: "competency_expiring_within_days",
      value: 7
    };
    expect(svc.evaluateSystemCondition(cond, snapshot)).toBe(true);
  });

  it("competency_expiring_within_days: false when outside window", () => {
    const distant = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days out
    const snapshot = makeSnapshot({
      competencies: [
        {
          competencyId: "c1",
          competencyName: "First Aid",
          competencyCode: null,
          achievedAt: null,
          expiresAt: distant,
          isExpired: false
        }
      ]
    });
    const cond: SystemCondition = {
      systemType: "competency_expiring_within_days",
      value: 7
    };
    expect(svc.evaluateSystemCondition(cond, snapshot)).toBe(false);
  });

  it("weather_temperature_above: fires when temp exceeds threshold", () => {
    const snapshot = makeSnapshot({
      weather: {
        unavailable: false,
        site: { id: "s1", name: "Site", postcode: null, suburb: null, state: null },
        current: { temperatureC: 38, windKph: null, weatherCode: null, observedAt: new Date().toISOString() },
        forecast: [],
        cachedAt: new Date().toISOString(),
        source: "open-meteo"
      }
    });
    const cond: SystemCondition = { systemType: "weather_temperature_above", value: 35 };
    expect(svc.evaluateSystemCondition(cond, snapshot)).toBe(true);
  });

  it("weather_temperature_above: false when weather unavailable", () => {
    const snapshot = makeSnapshot({
      weather: {
        unavailable: true,
        site: { id: "s1", name: "Site", postcode: null, suburb: null, state: null },
        reason: "no address"
      }
    });
    const cond: SystemCondition = { systemType: "weather_temperature_above", value: 35 };
    expect(svc.evaluateSystemCondition(cond, snapshot)).toBe(false);
  });

  it("asset_reading_km_above: false when currentKm is null (schema gap)", () => {
    const snapshot = makeSnapshot({
      assetReadings: [
        { assetId: "a1", assetCode: "T-001", assetName: "Truck", currentKm: null, currentHours: null }
      ]
    });
    const cond: SystemCondition = { systemType: "asset_reading_km_above", assetId: "a1", value: 100 };
    expect(svc.evaluateSystemCondition(cond, snapshot)).toBe(false);
  });

  it("site_attribute_equals: matches state", () => {
    const snapshot = makeSnapshot({
      site: {
        siteId: "s1",
        name: "Site A",
        suburb: "Brisbane",
        state: "QLD",
        postcode: "4000",
        centreLat: null,
        centreLng: null
      }
    });
    const cond: SystemCondition = { systemType: "site_attribute_equals", attributeKey: "state", value: "QLD" };
    expect(svc.evaluateSystemCondition(cond, snapshot)).toBe(true);
  });

  it("unknown system condition type returns false without throwing", () => {
    const snapshot = makeSnapshot();
    const cond = { systemType: "unknown_type" } as unknown as SystemCondition;
    expect(() => svc.evaluateSystemCondition(cond, snapshot)).not.toThrow();
    expect(svc.evaluateSystemCondition(cond, snapshot)).toBe(false);
  });
});

// ── System action execution ────────────────────────────────────────────────

describe("RulesEngineService — executeSystemActions", () => {
  const svc = makeService();
  const submission = {
    id: "sub-1",
    submittedById: "user-1",
    context: { supervisorId: "user-sup" }
  };

  it("alert action: calls notifications.create for resolved recipients", async () => {
    const deps = makeDeps();
    const actions: SystemAction[] = [
      {
        type: "alert",
        alertTargets: ["supervisor"],
        alertMessage: "Alert for {field_a}",
        alertSubject: "Test alert"
      }
    ];
    const snapshot = makeSnapshot();
    await svc.executeSystemActions(actions, submission, { field_a: "value-X" }, snapshot, deps);
    // Supervisor id is in context; notification should fire
    expect((deps.notifications.create as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-sup" }),
      "user-1"
    );
  });

  it("alert action with no targets: skips without error", async () => {
    const deps = makeDeps();
    const actions: SystemAction[] = [{ type: "alert", alertTargets: [] }];
    const snapshot = makeSnapshot();
    await expect(
      svc.executeSystemActions(actions, submission, {}, snapshot, deps)
    ).resolves.not.toThrow();
    expect((deps.notifications.create as jest.Mock)).not.toHaveBeenCalled();
  });

  it("deadline_task action: calls compliance.createDeadlineTask", async () => {
    const deps = makeDeps();
    const actions: SystemAction[] = [
      {
        type: "deadline_task",
        deadlineTaskTitle: "WorkSafe 24h report",
        deadlineHours: 24,
        deadlineAssignToRole: "supervisor"
      }
    ];
    const snapshot = makeSnapshot();
    await svc.executeSystemActions(actions, submission, {}, snapshot, deps);
    expect((deps.compliance.createDeadlineTask as jest.Mock)).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: "sub-1",
        title: "WorkSafe 24h report",
        deadlineHours: 24,
        assignedToId: "user-sup"
      })
    );
  });

  it("push action: calls pushExecutor.executePushes", async () => {
    const deps = makeDeps();
    const actions: SystemAction[] = [
      { type: "push", pushBindingId: "binding-1" }
    ];
    const snapshot = makeSnapshot();
    await svc.executeSystemActions(actions, submission, {}, snapshot, deps);
    expect((deps.pushExecutor.executePushes as jest.Mock)).toHaveBeenCalledWith("sub-1", "submit");
  });

  it("approval_chain_modify insert: calls formApproval.create", async () => {
    const prismaMock = {
      workerProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
      formApproval: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "approval-new" }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    } as unknown as import("../../prisma/prisma.service").PrismaService;
    const notifMock = { create: jest.fn().mockResolvedValue(undefined) };
    const emailMock = { sendNotificationEmail: jest.fn().mockResolvedValue(undefined) };
    const localSvc = new RulesEngineService(prismaMock, notifMock as never, emailMock as never);

    const deps = makeDeps();
    const actions: SystemAction[] = [
      {
        type: "approval_chain_modify",
        approvalStep: { op: "insert", stepNumber: 2, assignToRole: "manager", dueHours: 48 }
      }
    ];
    await localSvc.executeSystemActions(actions, submission, {}, makeSnapshot(), deps);
    expect(prismaMock.formApproval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ submissionId: "sub-1", stepNumber: 2 })
      })
    );
  });

  it("unknown action type is logged and does not throw", async () => {
    const deps = makeDeps();
    const actions = [{ type: "unknown_action" }] as unknown as SystemAction[];
    const snapshot = makeSnapshot();
    await expect(
      svc.executeSystemActions(actions, submission, {}, snapshot, deps)
    ).resolves.not.toThrow();
  });
});
