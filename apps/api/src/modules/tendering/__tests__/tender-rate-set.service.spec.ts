import { NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { TenderRateSetService } from "../tender-rate-set.service";

type Row = {
  id: string;
  key: string;
  label: string;
  unit: string | null;
  rateTableId: string | null;
  rateTableSlug: string | null;
  originalValue: Prisma.Decimal;
  overrideValue: Prisma.Decimal | null;
  tenderRateSetId: string;
};

function makeEntry(key: string, original: number, override: number | null = null): Row {
  return {
    id: `entry-${key}`,
    key,
    label: `Rate ${key}`,
    unit: "hr",
    rateTableId: "t-1",
    rateTableSlug: "custom",
    originalValue: new Prisma.Decimal(original),
    overrideValue: override === null ? null : new Prisma.Decimal(override),
    tenderRateSetId: "set-1"
  };
}

type ColumnDef = { id: string; name: string; role: "KEY" | "VALUE"; unit: string | null; sortOrder: number };
type TableDef = { id: string; name: string; columns: ColumnDef[] };
type RowDef = { id: string; cells: Record<string, unknown> };

function buildMocks(opts: {
  tenderExists?: boolean;
  existingSet?: { id: string; tenderId: string } | null;
  existingEntries?: Row[];
  resolverEntries?: Array<{
    key: string;
    rateTableId: string;
    rateTableSlug: string;
    label: string;
    unit: string | null;
    value: number;
  }>;
  rateTables?: TableDef[];
  rateRows?: RowDef[];
}) {
  const state = {
    entries: [...(opts.existingEntries ?? [])],
    set: opts.existingSet ?? null as { id: string; tenderId: string } | null
  };

  const tenderFindUnique = jest.fn(async () =>
    opts.tenderExists === false ? null : { id: "tender-1" }
  );
  const setFindUnique = jest.fn(async () =>
    state.set
      ? {
          ...state.set,
          lockedAt: new Date("2026-07-08T00:00:00Z"),
          sourceLabel: null,
          lockedBy: null
        }
      : null
  );
  const setUpsert = jest.fn(async ({ create }: { create: { tenderId: string } }) => {
    state.set = state.set ?? { id: "set-1", tenderId: create.tenderId };
    return state.set;
  });
  const setDelete = jest.fn(async () => {
    state.set = null;
    state.entries = [];
    return {};
  });
  const entryFindMany = jest.fn(async () => state.entries);
  const entryCreate = jest.fn(
    async ({ data }: { data: { key: string; originalValue: Prisma.Decimal; label: string; unit: string | null; rateTableId: string | null; rateTableSlug: string | null } }) => {
      const row = {
        id: `entry-${data.key}`,
        key: data.key,
        label: data.label,
        unit: data.unit,
        rateTableId: data.rateTableId,
        rateTableSlug: data.rateTableSlug,
        originalValue: data.originalValue,
        overrideValue: null,
        tenderRateSetId: "set-1"
      };
      state.entries.push(row);
      return row;
    }
  );
  const entryUpdate = jest.fn(
    async ({
      where,
      data
    }: {
      where: { id: string };
      data: Partial<Row>;
    }) => {
      const idx = state.entries.findIndex((e) => e.id === where.id);
      if (idx === -1) throw new Error("not found");
      const merged = { ...state.entries[idx], ...data };
      state.entries[idx] = merged;
      return merged;
    }
  );
  const entryFindUnique = jest.fn(async ({ where }: { where: { id: string } }) =>
    state.entries.find((e) => e.id === where.id) ?? null
  );
  const tenderUpdate = jest.fn(async () => ({ id: "tender-1" }));

  const tableStore = opts.rateTables ?? [];
  const rowStore = opts.rateRows ?? [];
  const rateTableFindMany = jest.fn(
    async ({ where, include }: { where: { id: { in: string[] } }; include?: { columns?: { where?: { role?: { in: string[] } } } } }) => {
      const ids = new Set(where.id.in);
      const roleFilter = include?.columns?.where?.role?.in;
      return tableStore
        .filter((t) => ids.has(t.id))
        .map((t) => ({
          ...t,
          columns: roleFilter ? t.columns.filter((c) => roleFilter.includes(c.role)) : t.columns
        }));
    }
  );
  const rateRowFindMany = jest.fn(async ({ where }: { where: { id: { in: string[] } } }) => {
    const ids = new Set(where.id.in);
    return rowStore.filter((r) => ids.has(r.id));
  });

  const tx = {
    tenderRateSet: { upsert: setUpsert, findUnique: setFindUnique, delete: setDelete },
    tenderRateEntry: {
      findMany: entryFindMany,
      create: entryCreate,
      update: entryUpdate,
      findUnique: entryFindUnique
    },
    tender: { update: tenderUpdate },
    rateTable: { findMany: rateTableFindMany },
    rateRow: { findMany: rateRowFindMany }
  };

  const prisma = {
    ...tx,
    tender: { findUnique: tenderFindUnique, update: tenderUpdate },
    rateTable: { findMany: rateTableFindMany },
    rateRow: { findMany: rateRowFindMany },
    $transaction: jest.fn(async (arg: unknown) => {
      if (typeof arg === "function") return (arg as (client: typeof tx) => Promise<unknown>)(tx);
      return [];
    })
  };

  const resolver = {
    enumerateRateSet: jest.fn(async () => opts.resolverEntries ?? [])
  };

  const audit = { write: jest.fn().mockResolvedValue({}) };

  return {
    prisma,
    audit,
    resolver,
    mocks: {
      tenderFindUnique,
      setFindUnique,
      setUpsert,
      setDelete,
      entryFindMany,
      entryCreate,
      entryUpdate,
      entryFindUnique,
      tenderUpdate,
      rateTableFindMany,
      rateRowFindMany
    },
    state
  };
}

function makeService(mocks: ReturnType<typeof buildMocks>) {
  return new TenderRateSetService(
    mocks.prisma as never,
    mocks.audit as never,
    mocks.resolver as never
  );
}

describe("TenderRateSetService", () => {
  it("lock: creates one entry per resolved rate and stamps ratesSnapshotAt", async () => {
    const m = buildMocks({
      resolverEntries: [
        { key: "t-1:r-1:c-val", rateTableId: "t-1", rateTableSlug: "custom", label: "L", unit: "hr", value: 100 },
        { key: "t-1:r-2:c-val", rateTableId: "t-1", rateTableSlug: "custom", label: "L2", unit: "hr", value: 200 }
      ]
    });
    const svc = makeService(m);
    const result = await svc.lock("tender-1", "user-1");

    expect(m.mocks.entryCreate).toHaveBeenCalledTimes(2);
    expect(m.mocks.tenderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ ratesSnapshotAt: expect.any(Date) }) })
    );
    expect(result).not.toBeNull();
    expect(result?.groups[0].entries).toHaveLength(2);
  });

  it("re-lock: preserves overrides and refreshes originalValue on non-overridden entries", async () => {
    const existing = [
      makeEntry("t-1:r-1:c-val", 100, 999), // overridden
      makeEntry("t-1:r-2:c-val", 200, null) // not overridden
    ];
    const m = buildMocks({
      existingSet: { id: "set-1", tenderId: "tender-1" },
      existingEntries: existing,
      resolverEntries: [
        { key: "t-1:r-1:c-val", rateTableId: "t-1", rateTableSlug: "custom", label: "L", unit: "hr", value: 150 },
        { key: "t-1:r-2:c-val", rateTableId: "t-1", rateTableSlug: "custom", label: "L2", unit: "hr", value: 250 }
      ]
    });
    const svc = makeService(m);
    await svc.lock("tender-1", "user-1");

    // Overridden entry: no update should touch it
    const overriddenUpdateCalls = m.mocks.entryUpdate.mock.calls.filter(
      (c) => (c[0] as { where: { id: string } }).where.id === "entry-t-1:r-1:c-val"
    );
    expect(overriddenUpdateCalls).toHaveLength(0);

    // Non-overridden: originalValue refreshed to 250
    const nonOverriddenUpdate = m.mocks.entryUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "entry-t-1:r-2:c-val"
    );
    expect(nonOverriddenUpdate).toBeDefined();
    const patch = (nonOverriddenUpdate?.[0] as { data: { originalValue: Prisma.Decimal } }).data;
    expect(patch.originalValue.toString()).toBe("250");

    // Confirm override is preserved in state
    const stillOverridden = m.state.entries.find((e) => e.key === "t-1:r-1:c-val");
    expect(stillOverridden?.overrideValue?.toString()).toBe("999");
  });

  it("updateEntry: sets and clears overrideValue", async () => {
    const m = buildMocks({
      existingSet: { id: "set-1", tenderId: "tender-1" },
      existingEntries: [makeEntry("t-1:r-1:c-val", 100)]
    });
    const svc = makeService(m);
    const set = await svc.updateEntry("tender-1", "entry-t-1:r-1:c-val", 175, "user-1");
    expect(set.overrideValue).toBe("175");
    expect(set.effectiveValue).toBe("175");
    expect(set.overridden).toBe(true);

    const cleared = await svc.updateEntry("tender-1", "entry-t-1:r-1:c-val", null, "user-1");
    expect(cleared.overrideValue).toBeNull();
    expect(cleared.effectiveValue).toBe("100");
    expect(cleared.overridden).toBe(false);
  });

  it("updateEntry: 404 when the tender has no rate set", async () => {
    const m = buildMocks({ existingSet: null });
    const svc = makeService(m);
    await expect(
      svc.updateEntry("tender-1", "entry-x", 10, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("unlock: deletes the set and clears ratesSnapshotAt", async () => {
    const m = buildMocks({
      existingSet: { id: "set-1", tenderId: "tender-1" },
      existingEntries: [makeEntry("t-1:r-1:c-val", 100)]
    });
    const svc = makeService(m);
    const out = await svc.unlock("tender-1", "user-1");
    expect(out).toEqual({ unlocked: true });
    expect(m.mocks.setDelete).toHaveBeenCalled();
  });

  it("unlock: no-op when there is no set", async () => {
    const m = buildMocks({ existingSet: null });
    const svc = makeService(m);
    const out = await svc.unlock("tender-1", "user-1");
    expect(out).toEqual({ unlocked: false });
  });

  it("get: exposes keyColumns/keyValues per group with a single KEY column", async () => {
    const existing: Row[] = [
      {
        id: "entry-a",
        key: "table-core:row-100:col-value",
        label: "Core-hole rates — 100 (Rate per hole)",
        unit: "hole",
        rateTableId: "table-core",
        rateTableSlug: "core-hole",
        originalValue: new Prisma.Decimal(2.55),
        overrideValue: null,
        tenderRateSetId: "set-1"
      },
      {
        id: "entry-b",
        key: "table-core:row-125:col-value",
        label: "Core-hole rates — 125 (Rate per hole)",
        unit: "hole",
        rateTableId: "table-core",
        rateTableSlug: "core-hole",
        originalValue: new Prisma.Decimal(2.75),
        overrideValue: null,
        tenderRateSetId: "set-1"
      }
    ];
    const m = buildMocks({
      existingSet: { id: "set-1", tenderId: "tender-1" },
      existingEntries: existing,
      rateTables: [
        {
          id: "table-core",
          name: "Core-hole rates",
          columns: [
            { id: "col-size", name: "Size (mm)", role: "KEY", unit: null, sortOrder: 0 },
            { id: "col-value", name: "Rate per hole", role: "VALUE", unit: "hole", sortOrder: 1 }
          ]
        }
      ],
      rateRows: [
        { id: "row-100", cells: { "col-size": 100, "col-value": 2.55 } },
        { id: "row-125", cells: { "col-size": 125, "col-value": 2.75 } }
      ]
    });
    const svc = makeService(m);
    const result = await svc.get("tender-1");
    expect(result?.groups).toHaveLength(1);
    const group = result!.groups[0];
    expect(group.tableName).toBe("Core-hole rates");
    expect(group.keyColumns).toEqual([{ name: "Size (mm)", unit: null }]);
    expect(group.valueColumnLabel).toBe("Rate per hole");
    expect(group.entries.map((e) => e.keyValues)).toEqual([["100"], ["125"]]);
  });

  it("get: exposes multi-KEY columns in sortOrder", async () => {
    const existing: Row[] = [
      {
        id: "entry-cut",
        key: "table-cut:row-1:col-value",
        label: "Cutting rates — Concrete saw · Ground · Reinforced · 200 (Rate per m)",
        unit: "m",
        rateTableId: "table-cut",
        rateTableSlug: "cutting",
        originalValue: new Prisma.Decimal(50),
        overrideValue: null,
        tenderRateSetId: "set-1"
      }
    ];
    const m = buildMocks({
      existingSet: { id: "set-1", tenderId: "tender-1" },
      existingEntries: existing,
      rateTables: [
        {
          id: "table-cut",
          name: "Cutting rates",
          columns: [
            { id: "col-equip", name: "Equipment", role: "KEY", unit: null, sortOrder: 0 },
            { id: "col-elev", name: "Elevation", role: "KEY", unit: null, sortOrder: 1 },
            { id: "col-mat", name: "Material", role: "KEY", unit: null, sortOrder: 2 },
            { id: "col-depth", name: "Depth", role: "KEY", unit: "mm", sortOrder: 3 },
            { id: "col-value", name: "Rate per m", role: "VALUE", unit: "m", sortOrder: 4 }
          ]
        }
      ],
      rateRows: [
        {
          id: "row-1",
          cells: {
            "col-equip": "Concrete saw",
            "col-elev": "Ground",
            "col-mat": "Reinforced",
            "col-depth": 200,
            "col-value": 50
          }
        }
      ]
    });
    const svc = makeService(m);
    const result = await svc.get("tender-1");
    const group = result!.groups[0];
    expect(group.keyColumns).toEqual([
      { name: "Equipment", unit: null },
      { name: "Elevation", unit: null },
      { name: "Material", unit: null },
      { name: "Depth", unit: "mm" }
    ]);
    expect(group.entries[0].keyValues).toEqual(["Concrete saw", "Ground", "Reinforced", "200"]);
  });

  it("get: legacy entries with no rateTableId yield empty keyColumns/keyValues", async () => {
    const existing: Row[] = [
      {
        id: "entry-legacy",
        key: "legacy:row-x:col-y",
        label: "Legacy labour — day (rate)",
        unit: "day",
        rateTableId: null,
        rateTableSlug: null,
        originalValue: new Prisma.Decimal(500),
        overrideValue: null,
        tenderRateSetId: "set-1"
      }
    ];
    const m = buildMocks({
      existingSet: { id: "set-1", tenderId: "tender-1" },
      existingEntries: existing
    });
    const svc = makeService(m);
    const result = await svc.get("tender-1");
    const group = result!.groups[0];
    expect(group.keyColumns).toEqual([]);
    expect(group.valueColumnLabel).toBeNull();
    expect(group.entries[0].keyValues).toEqual([]);
    // Fallback tableName still derived from the label
    expect(group.tableName).toBe("Legacy labour");
  });
});
