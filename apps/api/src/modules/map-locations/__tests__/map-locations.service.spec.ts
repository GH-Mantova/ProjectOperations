import { ConflictException } from "@nestjs/common";
import { MapLocationsService } from "../map-locations.service";

// ---------------------------------------------------------------------------
// TIP-ID-S2 — first tests this module has ever had.
//
// The fixtures below copy the REAL cell shape, not a convenient one: cells are
// keyed by RateColumn id, exactly as
// apps/api/prisma/migrations/20260713140000_seed_baseline_rate_tables/
// migration.sql inserts them ({"rt-wst-t-c-facility":"BMI Acacia Ridge", ...})
// and as upsertTable in seed-initial-services.ts rewrites them. A test built on
// bare `cells.facility` would pass while proving nothing about production rows.
//
// The "Map location" RateColumn is present in one fixture and absent in
// another, because it exists only in the TypeScript seed (TIP-ID-S1) and in no
// migration — a migrate-only database genuinely does not have it.
// ---------------------------------------------------------------------------

type Cells = Record<string, unknown>;

function tonneRow(id: string, facility: string, extra: Cells = {}) {
  return {
    id,
    isActive: true,
    cells: {
      "rt-wst-t-c-facility": facility,
      "rt-wst-t-c-type": "Concrete — clean",
      "rt-wst-t-c-group": "Rubble",
      "rt-wst-t-c-ton": 70,
      "rt-wst-t-c-load": 0,
      ...extra
    } as Cells
  };
}

function makeTables(opts: { withMapColumn?: boolean; rows?: ReturnType<typeof tonneRow>[] } = {}) {
  const withMapColumn = opts.withMapColumn ?? true;
  return [
    {
      id: "rt-wst-t",
      slug: "waste-per-tonne",
      columns: [
        { id: "rt-wst-t-c-facility", name: "Facility" },
        { id: "rt-wst-t-c-type", name: "Waste type" },
        { id: "rt-wst-t-c-group", name: "Group" },
        { id: "rt-wst-t-c-ton", name: "Rate per tonne" },
        { id: "rt-wst-t-c-load", name: "Rate per load" },
        ...(withMapColumn ? [{ id: "rt-wst-t-c-mapLocationId", name: "Map location" }] : [])
      ],
      rows: opts.rows ?? [
        tonneRow("rr-wst-t-bmi-hendra-concrete-clean", "BMI Hendra"),
        tonneRow("rr-wst-t-cleanaway-concrete-clean", "Cleanaway")
      ]
    }
  ];
}

function makePrisma(opts: {
  existing?: Record<string, unknown> | null;
  tables?: ReturnType<typeof makeTables>;
  wasteRateCount?: number;
} = {}) {
  const tables = opts.tables ?? makeTables();
  const prisma: Record<string, any> = {
    mapLocation: {
      findUnique: jest.fn().mockResolvedValue(opts.existing ?? null),
      update: jest.fn().mockImplementation(async ({ where, data }: any) => ({
        ...(opts.existing ?? {}),
        ...data,
        id: where.id
      })),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: "ml-new", ...data }))
    },
    estimateWasteRate: { count: jest.fn().mockResolvedValue(opts.wasteRateCount ?? 0) },
    rateTable: { findMany: jest.fn().mockResolvedValue(tables) },
    rateRow: { update: jest.fn().mockResolvedValue({}) }
  };
  prisma.$transaction = jest.fn(async (cb: any) => cb(prisma));
  return prisma;
}

const TIP_HENDRA = {
  id: "ml-hendra",
  name: "BMI Hendra",
  kind: "TIP",
  facility: null,
  isActive: true
};

describe("MapLocationsService — TIP facility links waste rate rows (TIP-ID-S2)", () => {
  test("setting a TIP's facility writes the id onto the matching waste rows", async () => {
    const prisma = makePrisma({ existing: TIP_HENDRA });
    const svc = new MapLocationsService(prisma as never);

    await svc.update("ml-hendra", { facility: "BMI Hendra" });

    expect(prisma.rateRow.update).toHaveBeenCalledTimes(1);
    const call = prisma.rateRow.update.mock.calls[0][0];
    expect(call.where).toStrictEqual({ id: "rr-wst-t-bmi-hendra-concrete-clean" });

    // Every original cell survives, and the id lands under BOTH the canonical
    // column-id key every reader uses and the bare key S1's
    // resolveWasteFacility() reads. Asserted with toStrictEqual so an absent
    // key cannot pass as an undefined one.
    expect(call.data.cells).toStrictEqual({
      "rt-wst-t-c-facility": "BMI Hendra",
      "rt-wst-t-c-type": "Concrete — clean",
      "rt-wst-t-c-group": "Rubble",
      "rt-wst-t-c-ton": 70,
      "rt-wst-t-c-load": 0,
      "rt-wst-t-c-mapLocationId": "ml-hendra",
      mapLocationId: "ml-hendra"
    });
    expect(Object.keys(call.data.cells)).toContain("rt-wst-t-c-mapLocationId");
    expect(Object.keys(call.data.cells)).toContain("mapLocationId");

    // …and it happened inside the same transaction as the MapLocation update.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.mapLocation.update).toHaveBeenCalledTimes(1);
  });

  test("the non-matching row is left completely alone — exact match only", async () => {
    const prisma = makePrisma({ existing: TIP_HENDRA });
    const svc = new MapLocationsService(prisma as never);

    await svc.update("ml-hendra", { facility: "BMI Hendra" });

    const touched = prisma.rateRow.update.mock.calls.map((c: any[]) => c[0].where.id);
    expect(touched).toStrictEqual(["rr-wst-t-bmi-hendra-concrete-clean"]);
    expect(touched).not.toContain("rr-wst-t-cleanaway-concrete-clean");
  });

  test("a near miss is never guessed at — case and whitespace differences do not match", async () => {
    const prisma = makePrisma({ existing: TIP_HENDRA });
    const svc = new MapLocationsService(prisma as never);

    await svc.update("ml-hendra", { facility: "bmi hendra" });

    expect(prisma.rateRow.update).not.toHaveBeenCalled();
  });

  test("the facility string is trimmed on both sides before comparing", async () => {
    const prisma = makePrisma({ existing: TIP_HENDRA });
    const svc = new MapLocationsService(prisma as never);

    await svc.update("ml-hendra", { facility: "  BMI Hendra  " });

    expect(prisma.rateRow.update).toHaveBeenCalledTimes(1);
    expect(prisma.rateRow.update.mock.calls[0][0].data.cells).toHaveProperty(
      "rt-wst-t-c-mapLocationId",
      "ml-hendra"
    );
  });

  test("changing a TIP's facility while rate rows exist still throws the 409 — the rename guard is untouched", async () => {
    const prisma = makePrisma({
      existing: { ...TIP_HENDRA, facility: "BMI Hendra" },
      wasteRateCount: 3
    });
    const svc = new MapLocationsService(prisma as never);

    await expect(svc.update("ml-hendra", { facility: "BMI Hendra North" })).rejects.toBeInstanceOf(
      ConflictException
    );
    await expect(svc.update("ml-hendra", { facility: "BMI Hendra North" })).rejects.toThrow(
      /Cannot rename facility from "BMI Hendra"/
    );

    // Refused before anything was written — neither the location nor the rows.
    expect(prisma.mapLocation.update).not.toHaveBeenCalled();
    expect(prisma.rateRow.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("a non-TIP location writes nothing to the waste rate rows", async () => {
    const prisma = makePrisma({
      existing: { id: "ml-poi", name: "Depot", kind: "POI", facility: null, isActive: true }
    });
    const svc = new MapLocationsService(prisma as never);

    await svc.update("ml-poi", { facility: "BMI Hendra" });

    expect(prisma.mapLocation.update).toHaveBeenCalledTimes(1);
    expect(prisma.rateTable.findMany).not.toHaveBeenCalled();
    expect(prisma.rateRow.update).not.toHaveBeenCalled();
  });

  test("saving the same facility twice is a no-op the second time", async () => {
    const prisma = makePrisma({
      existing: { ...TIP_HENDRA, facility: "BMI Hendra" },
      tables: makeTables({
        rows: [
          tonneRow("rr-wst-t-bmi-hendra-concrete-clean", "BMI Hendra", {
            "rt-wst-t-c-mapLocationId": "ml-hendra",
            mapLocationId: "ml-hendra"
          })
        ]
      })
    });
    const svc = new MapLocationsService(prisma as never);

    await svc.update("ml-hendra", { facility: "BMI Hendra" });

    expect(prisma.rateRow.update).not.toHaveBeenCalled();
  });

  test("a row already pointing at a DIFFERENT location is left alone, not re-pointed", async () => {
    const prisma = makePrisma({
      existing: TIP_HENDRA,
      tables: makeTables({
        rows: [
          tonneRow("rr-wst-t-bmi-hendra-concrete-clean", "BMI Hendra", {
            "rt-wst-t-c-mapLocationId": "ml-somewhere-else",
            mapLocationId: "ml-somewhere-else"
          })
        ]
      })
    });
    const svc = new MapLocationsService(prisma as never);

    await svc.update("ml-hendra", { facility: "BMI Hendra" });

    // A stale id is evidence (S1 surfaces it as `dangling`). Only the backfill
    // script's --force may re-decide it.
    expect(prisma.rateRow.update).not.toHaveBeenCalled();
  });

  test("a database with no 'Map location' column still gets the id, under the key the seed would stamp", async () => {
    const prisma = makePrisma({
      existing: TIP_HENDRA,
      tables: makeTables({ withMapColumn: false })
    });
    const svc = new MapLocationsService(prisma as never);

    await svc.update("ml-hendra", { facility: "BMI Hendra" });

    expect(prisma.rateRow.update).toHaveBeenCalledTimes(1);
    const cells = prisma.rateRow.update.mock.calls[0][0].data.cells;
    expect(cells).toHaveProperty("rt-wst-t-c-mapLocationId", "ml-hendra");
    expect(cells).toHaveProperty("mapLocationId", "ml-hendra");
  });

  test("clearing a TIP's facility unlinks nothing — removing an id is not this path's decision", async () => {
    const prisma = makePrisma({ existing: { ...TIP_HENDRA, facility: null } });
    const svc = new MapLocationsService(prisma as never);

    await svc.update("ml-hendra", { facility: null });

    expect(prisma.mapLocation.update).toHaveBeenCalledTimes(1);
    expect(prisma.rateRow.update).not.toHaveBeenCalled();
  });

  test("creating a TIP with a facility adopts the rows that already use that string", async () => {
    const prisma = makePrisma();
    const svc = new MapLocationsService(prisma as never);

    await svc.create({
      name: "BMI Hendra",
      kind: "TIP",
      addressLine1: "1 Tip Rd",
      suburb: "Hendra",
      state: "QLD",
      postcode: "4011",
      facility: "BMI Hendra"
    });

    expect(prisma.rateRow.update).toHaveBeenCalledTimes(1);
    expect(prisma.rateRow.update.mock.calls[0][0].data.cells).toHaveProperty(
      "rt-wst-t-c-mapLocationId",
      "ml-new"
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test("creating a POI with a facility string links nothing", async () => {
    const prisma = makePrisma();
    const svc = new MapLocationsService(prisma as never);

    await svc.create({
      name: "Depot",
      kind: "POI",
      addressLine1: "2 Depot St",
      suburb: "Hendra",
      state: "QLD",
      postcode: "4011",
      facility: "BMI Hendra"
    });

    expect(prisma.rateTable.findMany).not.toHaveBeenCalled();
    expect(prisma.rateRow.update).not.toHaveBeenCalled();
  });
});
