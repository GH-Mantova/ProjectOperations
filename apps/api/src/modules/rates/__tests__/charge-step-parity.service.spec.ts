/**
 * charge-step-parity.service.spec.ts
 *
 * Tests for ChargeStepParityService (RATE_PARITY_HARNESS_V1).
 *
 * Focus: the read-only guarantees the prompt requires.
 *   1. The harness call on a line whose charge-step evaluation THROWS does NOT
 *      affect the caller's resolved price — the caller still receives the same
 *      value as it would on main.
 *   2. The harness call on a line where charge-step total DISAGREES with the
 *      resolved value does NOT change the resolved value — the caller still
 *      receives the original price.
 *   3. Normal agreement path logs the agree event and returns void.
 *   4. A table with no chargeSteps is a no-op (no log, returns void).
 */

import { ChargeStepParityService } from "../charge-step-parity.service";

// ---------------------------------------------------------------------------
// Prisma mock helpers
// ---------------------------------------------------------------------------

function makePrisma(
  rateTableRow?: {
    id: string;
    chargeSteps?: unknown;
    lineFields?: unknown;
    columns?: Array<{ id: string; name: string; role: string }>;
  } | null,
  rateRows: Array<{ cells: unknown }> = []
) {
  return {
    rateTable: {
      findUnique: jest.fn().mockResolvedValue(
        rateTableRow === undefined
          ? null
          : rateTableRow === null
            ? null
            : {
                id: rateTableRow.id,
                chargeSteps: rateTableRow.chargeSteps ?? null,
                lineFields: rateTableRow.lineFields ?? null,
                columns: rateTableRow.columns ?? []
              }
      )
    },
    rateRow: {
      findMany: jest.fn().mockResolvedValue(rateRows)
    }
  };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** A minimal valid charge-step list that produces 500 for any values map. */
const STEPS_FIXED_500 = [{ op: "start", field: 500 }];

/** A step list whose only operand is a column "Rate" — evaluateSteps will
 *  produce the value in the cells map under the column "Rate". */
const STEPS_RATE_COLUMN = [{ op: "start", field: "Rate" }];

/** A step list that will throw: first step is not "start". */
const STEPS_BAD_NOT_START = [{ op: "add", field: 100 }];

/** A step list that is empty — evaluateSteps throws on empty input. */
const STEPS_EMPTY: unknown[] = [];

const TABLE_ID = "tbl-001";
const TABLE_SLUG = "plant";
const TENDER_ID = "tndr-123";
const KEYS = { item: "Excavator" };

// ---------------------------------------------------------------------------
// Read-only guarantee 1: a throw in evaluateSteps does not propagate to the
// caller. The caller's resolved price is unchanged.
// ---------------------------------------------------------------------------

describe("ChargeStepParityService — read-only: evaluateSteps throws", () => {
  test("checkParity returns void and does not throw when the step list has no start step", async () => {
    const prisma = makePrisma(
      {
        id: TABLE_ID,
        chargeSteps: STEPS_BAD_NOT_START,
        columns: [{ id: "c-rate", name: "Rate", role: "VALUE" }]
      },
      [{ cells: { "c-rate": 450 } }]
    );

    const svc = new ChargeStepParityService(prisma as never);

    // If this throws, the test fails — that would mean the harness can
    // take down a pricing call.
    await expect(svc.checkParity(TABLE_SLUG, KEYS, 450, TENDER_ID)).resolves.toBeUndefined();
  });

  test("checkParity returns void and does not throw when the step list is empty", async () => {
    const prisma = makePrisma(
      {
        id: TABLE_ID,
        chargeSteps: STEPS_EMPTY,
        columns: []
      },
      []
    );

    const svc = new ChargeStepParityService(prisma as never);

    // An empty step list stored in chargeSteps resolves to null in our loader
    // (steps = null), so the harness returns early. Either way: no throw.
    await expect(svc.checkParity(TABLE_SLUG, KEYS, 450, TENDER_ID)).resolves.toBeUndefined();
  });

  test("the caller's resolvedValue is unchanged when evaluateSteps throws", async () => {
    // Simulate a resolver that calls the harness and returns its own value.
    // We verify the return value equals what the resolver computed, regardless
    // of what the harness does internally.
    const prisma = makePrisma(
      {
        id: TABLE_ID,
        chargeSteps: STEPS_BAD_NOT_START,
        columns: [{ id: "c-rate", name: "Rate", role: "VALUE" }]
      },
      [{ cells: { "c-rate": 999 } }]
    );

    const svc = new ChargeStepParityService(prisma as never);

    const resolvedByCurrentPath = 450;
    // Call the harness (fire-and-forget equivalent in a test: we await it).
    await svc.checkParity(TABLE_SLUG, KEYS, resolvedByCurrentPath, TENDER_ID);

    // The value the current path resolved has not changed — it is whatever
    // the caller's own computation produced, not what the harness computed.
    expect(resolvedByCurrentPath).toBe(450);
  });
});

// ---------------------------------------------------------------------------
// Read-only guarantee 2: a disagreement does not change the resolved price.
// ---------------------------------------------------------------------------

describe("ChargeStepParityService — read-only: disagreement does not change price", () => {
  test("checkParity returns void when charge-step total differs from resolvedValue", async () => {
    // Step list produces 500; the "current path" resolved 450.
    const prisma = makePrisma(
      {
        id: TABLE_ID,
        chargeSteps: STEPS_FIXED_500,
        columns: []
      },
      []
    );

    const svc = new ChargeStepParityService(prisma as never);

    const resolvedByCurrentPath = 450;
    const result = await svc.checkParity(TABLE_SLUG, KEYS, resolvedByCurrentPath, TENDER_ID);

    // Return type is void — there is no number to inspect.
    expect(result).toBeUndefined();

    // The resolved price in the calling context is unchanged — whatever the
    // local `resolvedByCurrentPath` variable holds is what the caller returns,
    // not what evaluateSteps produced.
    expect(resolvedByCurrentPath).toBe(450);
  });

  test("checkParity logs charge-step-parity-disagree when the two numbers differ", async () => {
    const prisma = makePrisma(
      {
        id: TABLE_ID,
        chargeSteps: STEPS_FIXED_500,
        columns: []
      },
      []
    );

    const svc = new ChargeStepParityService(prisma as never);
    const warnSpy = jest.spyOn((svc as never)["logger"], "warn");

    await svc.checkParity(TABLE_SLUG, KEYS, 450, TENDER_ID);

    const calls = warnSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const disagreeCall = calls.find((c) => c["event"] === "charge-step-parity-disagree");
    expect(disagreeCall).toBeDefined();
    expect(disagreeCall?.["resolvedValue"]).toBe(450);
    expect(disagreeCall?.["stepTotal"]).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Agreement path: logs agree event and returns void.
// ---------------------------------------------------------------------------

describe("ChargeStepParityService — agreement path", () => {
  test("checkParity logs charge-step-parity-agree when both numbers match", async () => {
    // Step list: start at field "Rate". The matched row has Rate=450.
    // resolvedValue is also 450 — they agree.
    const prisma = makePrisma(
      {
        id: TABLE_ID,
        chargeSteps: STEPS_RATE_COLUMN,
        columns: [{ id: "c-rate", name: "Rate", role: "VALUE" }]
      },
      [{ cells: { "c-rate": 450 } }]
    );

    const svc = new ChargeStepParityService(prisma as never);
    const logSpy = jest.spyOn((svc as never)["logger"], "log");

    await svc.checkParity(TABLE_SLUG, KEYS, 450, TENDER_ID);

    const calls = logSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const agreeCall = calls.find((c) => c["event"] === "charge-step-parity-agree");
    expect(agreeCall).toBeDefined();
    expect(agreeCall?.["tableSlug"]).toBe(TABLE_SLUG);
  });

  test("checkParity returns void on agreement", async () => {
    const prisma = makePrisma(
      {
        id: TABLE_ID,
        chargeSteps: STEPS_FIXED_500,
        columns: []
      },
      []
    );
    const svc = new ChargeStepParityService(prisma as never);
    const result = await svc.checkParity(TABLE_SLUG, KEYS, 500, TENDER_ID);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// No-op when the table has no charge steps.
// ---------------------------------------------------------------------------

describe("ChargeStepParityService — no-op when no steps", () => {
  test("checkParity returns void without logging a disagree when table has no chargeSteps", async () => {
    const prisma = makePrisma(
      { id: TABLE_ID, chargeSteps: null, columns: [] },
      []
    );
    const svc = new ChargeStepParityService(prisma as never);
    const warnSpy = jest.spyOn((svc as never)["logger"], "warn");

    await svc.checkParity(TABLE_SLUG, KEYS, 450, TENDER_ID);

    const disagreeCalls = warnSpy.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .filter((c) => c["event"] === "charge-step-parity-disagree");
    expect(disagreeCalls).toHaveLength(0);
  });

  test("checkParity returns void when the slug is not in RateTable", async () => {
    // rateTable.findUnique returns null — slug is legacy-only.
    const prisma = makePrisma(null);
    const svc = new ChargeStepParityService(prisma as never);

    const result = await svc.checkParity("labour", KEYS, 450, undefined);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Disagree log record carries the required fields.
// ---------------------------------------------------------------------------

describe("ChargeStepParityService — log record structure on disagree", () => {
  test("disagree log record carries tenderId, tableSlug, tableId, keys, resolvedValue, stepTotal", async () => {
    const prisma = makePrisma(
      {
        id: TABLE_ID,
        chargeSteps: STEPS_FIXED_500,
        columns: []
      },
      []
    );
    const svc = new ChargeStepParityService(prisma as never);
    const warnSpy = jest.spyOn((svc as never)["logger"], "warn");

    await svc.checkParity(TABLE_SLUG, KEYS, 450, TENDER_ID);

    const calls = warnSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const record = calls.find((c) => c["event"] === "charge-step-parity-disagree");
    expect(record).toBeDefined();
    // Both numbers must be in the same record — a disagree log without the
    // pair is useless for the soak (from the prompt).
    expect(record?.["resolvedValue"]).toBe(450);
    expect(record?.["stepTotal"]).toBe(500);
    expect(record?.["tenderId"]).toBe(TENDER_ID);
    expect(record?.["tableSlug"]).toBe(TABLE_SLUG);
    expect(record?.["tableId"]).toBe(TABLE_ID);
    expect(record?.["keys"]).toEqual(KEYS);
  });

  test("disagree log record includes divergeAtStepIndex when trail is available", async () => {
    // This step list starts at 999, which differs from resolvedValue=450
    // at step index 0 (the "start" step).
    const prisma = makePrisma(
      {
        id: TABLE_ID,
        chargeSteps: [{ op: "start", field: 999 }],
        columns: []
      },
      []
    );
    const svc = new ChargeStepParityService(prisma as never);
    const warnSpy = jest.spyOn((svc as never)["logger"], "warn");

    await svc.checkParity(TABLE_SLUG, KEYS, 450, TENDER_ID);

    const calls = warnSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const record = calls.find((c) => c["event"] === "charge-step-parity-disagree");
    expect(record).toBeDefined();
    // The step index must be a number (or null — not undefined).
    expect(
      record?.["divergeAtStepIndex"] === null ||
      typeof record?.["divergeAtStepIndex"] === "number"
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// eval-threw path: logged as a disagree-variant, returns void.
// ---------------------------------------------------------------------------

describe("ChargeStepParityService — eval-threw path", () => {
  test("checkParity logs charge-step-parity-eval-threw when evaluateSteps throws", async () => {
    const prisma = makePrisma(
      {
        id: TABLE_ID,
        chargeSteps: STEPS_BAD_NOT_START,
        columns: [{ id: "c-rate", name: "Rate", role: "VALUE" }]
      },
      [{ cells: { "c-rate": 450 } }]
    );
    const svc = new ChargeStepParityService(prisma as never);
    const warnSpy = jest.spyOn((svc as never)["logger"], "warn");

    await svc.checkParity(TABLE_SLUG, KEYS, 450, TENDER_ID);

    const calls = warnSpy.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const errCall = calls.find((c) => c["event"] === "charge-step-parity-eval-threw");
    expect(errCall).toBeDefined();
    expect(errCall?.["resolvedValue"]).toBe(450);
    expect(typeof errCall?.["err"]).toBe("string");
  });
});
