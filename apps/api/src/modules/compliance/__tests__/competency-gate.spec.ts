import { checkCompetencyGate } from "../competency-gate";

const TODAY = new Date("2026-06-01T00:00:00.000Z");
const daysFromToday = (n: number): Date => new Date(TODAY.getTime() + n * 24 * 60 * 60 * 1000);

describe("checkCompetencyGate (pure helper, roadmap §7)", () => {
  it("allows when worker holds every required qual, all unexpired", () => {
    const result = checkCompetencyGate(
      [
        { qualType: "asbestos_b", expiryDate: daysFromToday(180) },
        { qualType: "white_card", expiryDate: daysFromToday(365) }
      ],
      ["asbestos_b", "white_card"],
      TODAY
    );
    expect(result).toEqual({
      allowed: true,
      missing: [],
      expired: [],
      expiringSoon: []
    });
  });

  it("blocks and reports a missing required qual", () => {
    const result = checkCompetencyGate(
      [{ qualType: "white_card", expiryDate: daysFromToday(365) }],
      ["asbestos_b", "white_card"],
      TODAY
    );
    expect(result.allowed).toBe(false);
    expect(result.missing).toEqual(["asbestos_b"]);
    expect(result.expired).toEqual([]);
    expect(result.expiringSoon).toEqual([]);
  });

  it("blocks when a required qual is held but expired", () => {
    const result = checkCompetencyGate(
      [
        { qualType: "asbestos_b", expiryDate: daysFromToday(-10) },
        { qualType: "white_card", expiryDate: daysFromToday(365) }
      ],
      ["asbestos_b", "white_card"],
      TODAY
    );
    expect(result.allowed).toBe(false);
    expect(result.missing).toEqual([]);
    expect(result.expired).toEqual(["asbestos_b"]);
    expect(result.expiringSoon).toEqual([]);
  });

  it("still allows when a required qual expires within 30 days, but flags it as expiringSoon", () => {
    const result = checkCompetencyGate(
      [
        { qualType: "asbestos_b", expiryDate: daysFromToday(15) },
        { qualType: "white_card", expiryDate: daysFromToday(365) }
      ],
      ["asbestos_b", "white_card"],
      TODAY
    );
    expect(result.allowed).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.expired).toEqual([]);
    expect(result.expiringSoon).toEqual(["asbestos_b"]);
  });

  it("treats a revoked qual as missing", () => {
    const result = checkCompetencyGate(
      [
        { qualType: "asbestos_b", expiryDate: daysFromToday(180), status: "revoked" },
        { qualType: "white_card", expiryDate: daysFromToday(365) }
      ],
      ["asbestos_b", "white_card"],
      TODAY
    );
    expect(result.allowed).toBe(false);
    expect(result.missing).toEqual(["asbestos_b"]);
    expect(result.expired).toEqual([]);
  });

  it("treats withdrawn and suspended quals as missing too", () => {
    const result = checkCompetencyGate(
      [
        { qualType: "asbestos_b", expiryDate: daysFromToday(180), status: "withdrawn" },
        { qualType: "white_card", expiryDate: daysFromToday(365), status: "suspended" }
      ],
      ["asbestos_b", "white_card"],
      TODAY
    );
    expect(result.allowed).toBe(false);
    expect(result.missing).toEqual(["asbestos_b", "white_card"]);
  });

  it("allows when the required list is empty", () => {
    const result = checkCompetencyGate(
      [{ qualType: "asbestos_b", expiryDate: daysFromToday(180) }],
      [],
      TODAY
    );
    expect(result).toEqual({
      allowed: true,
      missing: [],
      expired: [],
      expiringSoon: []
    });
  });

  it("treats expiryDate=null as never-expires", () => {
    const result = checkCompetencyGate(
      [
        { qualType: "white_card", expiryDate: null },
        { qualType: "first_aid", expiryDate: daysFromToday(60) }
      ],
      ["white_card", "first_aid"],
      TODAY
    );
    expect(result.allowed).toBe(true);
    expect(result.expiringSoon).toEqual([]);
  });

  it("treats explicit status='active' the same as unset status", () => {
    const result = checkCompetencyGate(
      [{ qualType: "asbestos_b", expiryDate: daysFromToday(60), status: "active" }],
      ["asbestos_b"],
      TODAY
    );
    expect(result.allowed).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("uses the latest-expiring active qual when the worker has multiple of the same type", () => {
    // Older expired copy + newer active copy of the same qual → counts as held.
    const result = checkCompetencyGate(
      [
        { qualType: "asbestos_b", expiryDate: daysFromToday(-30) },
        { qualType: "asbestos_b", expiryDate: daysFromToday(180) }
      ],
      ["asbestos_b"],
      TODAY
    );
    expect(result.allowed).toBe(true);
    expect(result.expired).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it("a never-expiring copy supersedes an expired copy of the same type", () => {
    const result = checkCompetencyGate(
      [
        { qualType: "white_card", expiryDate: daysFromToday(-30) },
        { qualType: "white_card", expiryDate: null }
      ],
      ["white_card"],
      TODAY
    );
    expect(result.allowed).toBe(true);
    expect(result.expired).toEqual([]);
  });

  it("revoked copy does not count even if a non-revoked expired copy exists for the same type", () => {
    const result = checkCompetencyGate(
      [
        { qualType: "asbestos_b", expiryDate: daysFromToday(180), status: "revoked" },
        { qualType: "asbestos_b", expiryDate: daysFromToday(-10) }
      ],
      ["asbestos_b"],
      TODAY
    );
    expect(result.allowed).toBe(false);
    expect(result.expired).toEqual(["asbestos_b"]);
    expect(result.missing).toEqual([]);
  });

  it("de-duplicates the required list so a doubled code is not double-reported", () => {
    const result = checkCompetencyGate(
      [{ qualType: "white_card", expiryDate: daysFromToday(365) }],
      ["asbestos_b", "asbestos_b", "white_card"],
      TODAY
    );
    expect(result.missing).toEqual(["asbestos_b"]);
  });

  it("expiry exactly today counts as expired (boundary)", () => {
    const result = checkCompetencyGate(
      [{ qualType: "asbestos_b", expiryDate: new Date(TODAY.getTime() - 1) }],
      ["asbestos_b"],
      TODAY
    );
    expect(result.expired).toEqual(["asbestos_b"]);
  });

  it("expiry exactly +30 days counts as expiringSoon, not expired (boundary)", () => {
    const result = checkCompetencyGate(
      [{ qualType: "asbestos_b", expiryDate: daysFromToday(30) }],
      ["asbestos_b"],
      TODAY
    );
    expect(result.allowed).toBe(true);
    expect(result.expiringSoon).toEqual(["asbestos_b"]);
    expect(result.expired).toEqual([]);
  });

  it("expiry exactly +31 days is fully active (not expiringSoon)", () => {
    const result = checkCompetencyGate(
      [{ qualType: "asbestos_b", expiryDate: daysFromToday(31) }],
      ["asbestos_b"],
      TODAY
    );
    expect(result.allowed).toBe(true);
    expect(result.expiringSoon).toEqual([]);
  });

  it("treats null workerQualifications as empty list", () => {
    const result = checkCompetencyGate(null, ["asbestos_b"]);
    expect(result.allowed).toBe(false);
    expect(result.missing).toEqual(["asbestos_b"]);
  });

  it("treats null requiredQualTypes as empty list (vacuously allowed)", () => {
    const result = checkCompetencyGate([], null);
    expect(result.allowed).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("does not mutate the inputs", () => {
    const exp = daysFromToday(180);
    const workerQuals = [{ qualType: "asbestos_b", expiryDate: exp }];
    const required = ["asbestos_b", "white_card"];
    const snapshotQuals = workerQuals.map((q) => ({ ...q }));
    const snapshotRequired = [...required];
    checkCompetencyGate(workerQuals, required, TODAY);
    expect(workerQuals).toEqual(snapshotQuals);
    expect(required).toEqual(snapshotRequired);
  });
});
