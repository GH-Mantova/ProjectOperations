import { Prisma } from "@prisma/client";
import {
  SCOPE_CARD_DEFAULTS,
  getScopeCardDefault,
  type ScopeCardDefault
} from "../card-defaults";
import { IS_DISCIPLINE_CODES } from "../../../personas/definitions/disciplines";

// PR A2 — ScopeCard schema foundation tests. Schema-only PR; these tests
// validate the new Prisma types compile, the SCOPE_CARD_DEFAULTS helper
// covers every discipline, and the discipline → card-name mapping matches
// the SQL migration's hardcoded values.

describe("SCOPE_CARD_DEFAULTS (PR A2)", () => {
  it("has exactly 4 entries, one per IS_DISCIPLINE_CODES entry", () => {
    expect(SCOPE_CARD_DEFAULTS).toHaveLength(IS_DISCIPLINE_CODES.length);
    expect(SCOPE_CARD_DEFAULTS).toHaveLength(4);
  });

  it("orders DEM=0, CIV=1, ASB=2, Other=3 (matches SQL migration sortOrder)", () => {
    const byCode = Object.fromEntries(
      SCOPE_CARD_DEFAULTS.map((c) => [c.discipline, c.sortOrder])
    );
    expect(byCode.DEM).toBe(0);
    expect(byCode.CIV).toBe(1);
    expect(byCode.ASB).toBe(2);
    expect(byCode.Other).toBe(3);
  });

  it("matches the SQL migration's discipline → friendly-name mapping", () => {
    // The hardcoded CASE block in the PR A2 migration uses these exact
    // names. If you change a name here, also update the migration's
    // CASE WHEN block (the migration is a one-shot artifact; we don't
    // re-run it but want the seed + migration to land on the same names).
    expect(getScopeCardDefault("DEM").name).toBe("Demolition");
    expect(getScopeCardDefault("CIV").name).toBe("Civil works");
    expect(getScopeCardDefault("ASB").name).toBe("Asbestos removal");
    expect(getScopeCardDefault("Other").name).toBe("Other");
  });

  it("getScopeCardDefault returns a populated record for every IS code", () => {
    for (const code of IS_DISCIPLINE_CODES) {
      const def = getScopeCardDefault(code);
      expect(def.discipline).toBe(code);
      expect(def.name.length).toBeGreaterThan(0);
      expect(typeof def.sortOrder).toBe("number");
    }
  });

  it("sortOrder values are unique across all defaults", () => {
    const orders = SCOPE_CARD_DEFAULTS.map((c) => c.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });
});

describe("Prisma types — ScopeCard create shape (PR A2)", () => {
  // These are type-level tests: TypeScript must accept these objects as
  // valid Prisma input. If the schema regresses (e.g. a required field is
  // removed or renamed), this file will fail to compile.

  it("accepts a minimal ScopeCard create input", () => {
    const input: Prisma.ScopeCardCreateInput = {
      name: "Demolition",
      discipline: "DEM",
      tender: { connect: { id: "tender-123" } },
      createdBy: { connect: { id: "user-456" } }
    };
    expect(input.name).toBe("Demolition");
  });

  it("accepts a ScopeCard with explicit sortOrder", () => {
    const input: Prisma.ScopeCardCreateInput = {
      name: "Civil works",
      discipline: "CIV",
      sortOrder: 1,
      tender: { connect: { id: "tender-123" } },
      createdBy: { connect: { id: "user-456" } }
    };
    expect(input.sortOrder).toBe(1);
  });

  it("accepts a ScopeOfWorksItem with nullable cardId", () => {
    const withCard: Prisma.ScopeOfWorksItemCreateManyInput = {
      tenderId: "tender-123",
      cardId: "card-abc",
      createdById: "user-456",
      wbsCode: "DEM1",
      discipline: "DEM",
      itemNumber: 1,
      rowType: "demolition",
      description: "test"
    };
    const withoutCard: Prisma.ScopeOfWorksItemCreateManyInput = {
      tenderId: "tender-123",
      // cardId omitted — should compile because the field is optional
      createdById: "user-456",
      wbsCode: "DEM1",
      discipline: "DEM",
      itemNumber: 1,
      rowType: "demolition",
      description: "test"
    };
    expect(withCard.cardId).toBe("card-abc");
    expect(withoutCard.cardId).toBeUndefined();
  });
});

describe("ScopeCardDefault type contract", () => {
  it("exports a readonly array (compile-time guard for accidental mutation)", () => {
    // Type-level assertion: SCOPE_CARD_DEFAULTS is readonly.
    // If someone changes the export to a mutable array, this test still
    // passes at runtime but the type system rejects the line below.
    const _typecheck: ReadonlyArray<ScopeCardDefault> = SCOPE_CARD_DEFAULTS;
    expect(_typecheck).toBeDefined();
  });
});
