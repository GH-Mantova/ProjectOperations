// G5 — TenderNumberService specs for the canonical T{YYMMDD}-{SLUG}-Rev{N}
// format. Mock Prisma: findUnique drives both the collision probe and the
// bumpRevision row lookup; update captures the rename write.
// TFM-S2 — deriveTenderFolderName specs for stable SharePoint folder naming.

import { TenderNumberService, deriveTenderFolderName, sanitiseSharePointName } from "../tender-number.service";
import { brisbaneYYMMDD } from "../../../common/id-format/client-slug";

const TODAY = brisbaneYYMMDD(new Date());

function makeService(opts: {
  taken?: string[];
  tenderRow?: {
    tenderNumber: string;
    revisionNumber: number;
    clientSlugSnapshot: string | null;
    createdAt: Date;
  };
} = {}) {
  const taken = new Set(opts.taken ?? []);
  const findUnique = jest.fn(async ({ where }: { where: { tenderNumber?: string } }) =>
    where.tenderNumber && taken.has(where.tenderNumber) ? { id: "existing" } : null
  );
  const findUniqueOrThrow = jest.fn(async () => {
    if (!opts.tenderRow) throw new Error("not found");
    return opts.tenderRow;
  });
  const update = jest.fn(async ({ data }: { data: unknown }) => data);
  const prisma = { tender: { findUnique, findUniqueOrThrow, update } };
  const service = new TenderNumberService(prisma as never);
  return { service, findUnique, update };
}

describe("TenderNumberService (G5)", () => {
  describe("generate", () => {
    it("builds T{today}-{SLUG}-Rev1 from the primary client name", async () => {
      const { service } = makeService();
      const result = await service.generate("Acme Infrastructure");
      expect(result.tenderNumber).toBe(`T${TODAY}-ACME-Rev1`);
      expect(result.clientSlugSnapshot).toBe("ACME");
      expect(result.revisionNumber).toBe(1);
    });

    it("derives 4-letter slugs per the spec examples", async () => {
      const { service } = makeService();
      expect((await service.generate("QLD Roads Authority")).tenderNumber).toBe(
        `T${TODAY}-QLDR-Rev1`
      );
    });

    it("falls back to XXXX when no client name is available", async () => {
      const { service } = makeService();
      expect((await service.generate(null)).tenderNumber).toBe(`T${TODAY}-XXXX-Rev1`);
      expect((await service.generate("")).clientSlugSnapshot).toBe("XXXX");
    });

    it("appends -2 / -3 on same-day same-client collisions", async () => {
      const { service } = makeService({ taken: [`T${TODAY}-ACME-Rev1`] });
      expect((await service.generate("Acme Infrastructure")).tenderNumber).toBe(
        `T${TODAY}-ACME-Rev1-2`
      );

      const { service: service2 } = makeService({
        taken: [`T${TODAY}-ACME-Rev1`, `T${TODAY}-ACME-Rev1-2`]
      });
      expect((await service2.generate("Acme Infrastructure")).tenderNumber).toBe(
        `T${TODAY}-ACME-Rev1-3`
      );
    });
  });

  describe("bumpRevision", () => {
    it("bumps Rev1 -> Rev2 reusing the original date stamp and slug", async () => {
      const createdAt = new Date("2026-06-04T22:00:00.000Z"); // 2026-06-05 Brisbane
      const { service, update } = makeService({
        tenderRow: {
          tenderNumber: "T260605-ACME-Rev1",
          revisionNumber: 1,
          clientSlugSnapshot: "ACME",
          createdAt
        }
      });
      const result = await service.bumpRevision("tender-1");
      expect(result.tenderNumber).toBe("T260605-ACME-Rev2");
      expect(result.previousTenderNumber).toBe("T260605-ACME-Rev1");
      expect(result.revisionNumber).toBe(2);
      expect(update).toHaveBeenCalledWith({
        where: { id: "tender-1" },
        data: { tenderNumber: "T260605-ACME-Rev2", revisionNumber: 2 }
      });
    });

    it("falls back to XXXX for legacy rows without a slug snapshot", async () => {
      const { service } = makeService({
        tenderRow: {
          tenderNumber: "LEGACY-1",
          revisionNumber: 1,
          clientSlugSnapshot: null,
          createdAt: new Date("2026-06-04T22:00:00.000Z")
        }
      });
      const result = await service.bumpRevision("tender-1");
      expect(result.tenderNumber).toBe("T260605-XXXX-Rev2");
    });
  });

  describe("validate", () => {
    it("accepts canonical numbers including disambiguators", () => {
      const { service } = makeService();
      expect(service.validate("T260605-ACME-Rev1")).toBeNull();
      expect(service.validate("T260605-ACME-Rev12")).toBeNull();
      expect(service.validate("T260605-ACME-Rev1-2")).toBeNull();
      expect(service.validate("T260605-BOB-Rev1")).toBeNull();
    });

    it("rejects legacy formats and garbage", () => {
      const { service } = makeService();
      expect(service.validate("IS-T001")).toContain("not in canonical format");
      expect(service.validate("T260605-acme-Rev1")).toContain("not in canonical format");
      expect(service.validate("")).toBe("Tender number is required.");
    });
  });
});

// ---------------------------------------------------------------------------
// TFM-S2: deriveTenderFolderName + sanitiseSharePointName
// ---------------------------------------------------------------------------

describe("sanitiseSharePointName (TFM-S2)", () => {
  it("strips Graph-rejected characters", () => {
    // Stripping the rejected characters leaves runs of whitespace behind, and
    // sanitiseSharePointName collapses them — so the result is a single space,
    // not the gaps the removed characters used to occupy. The sibling test
    // below asserts the collapse rule directly; this expectation must agree
    // with it or the two tests contradict each other.
    expect(sanitiseSharePointName('Hello ~ " # % & * : < > ? / \\ { | } World')).toBe(
      "Hello World"
    );
  });

  it("collapses multiple whitespace runs to a single space", () => {
    expect(sanitiseSharePointName("Foo   Bar\t\tBaz")).toBe("Foo Bar Baz");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitiseSharePointName("  trimmed  ")).toBe("trimmed");
  });

  it("caps output at 90 characters", () => {
    const long = "A".repeat(100);
    expect(sanitiseSharePointName(long)).toHaveLength(90);
  });

  it("returns empty string when input is only rejected chars", () => {
    expect(sanitiseSharePointName('~"#%&*:<>?/\\{|}')).toBe("");
  });
});

describe("deriveTenderFolderName (TFM-S2)", () => {
  it("returns T{date} - {projectName} when projectName is set", () => {
    const result = deriveTenderFolderName({
      tenderNumber: "T260817-ACME-Rev1",
      projectName: "Northshore",
      site: { name: "Some Site" }
    });
    expect(result).toBe("T260817 - Northshore");
  });

  it("falls back to site.name when projectName is null", () => {
    const result = deriveTenderFolderName({
      tenderNumber: "T260817-ACME-Rev1",
      projectName: null,
      site: { name: "Coastal Road" }
    });
    expect(result).toBe("T260817 - Coastal Road");
  });

  it("falls back to T-number when both projectName and site.name are null/empty", () => {
    const result = deriveTenderFolderName({
      tenderNumber: "T260817-ACME-Rev1",
      projectName: null,
      site: null
    });
    expect(result).toBe("T260817");
  });

  it("falls back to T-number when site.name is empty string", () => {
    const result = deriveTenderFolderName({
      tenderNumber: "T260817-ACME-Rev1",
      projectName: "",
      site: { name: "" }
    });
    expect(result).toBe("T260817");
  });

  it("strips Graph-rejected chars from the project name", () => {
    const result = deriveTenderFolderName({
      tenderNumber: "T260817-ACME-Rev1",
      projectName: "North*shore: Phase<2>",
      site: null
    });
    expect(result).toBe("T260817 - Northshore Phase2");
  });

  it("stranding-fix invariant: returns the SAME value before and after revision bump when projectName is unchanged", () => {
    const tender = {
      projectName: "Northshore",
      site: { name: "Some Site" }
    };
    const beforeRevision = deriveTenderFolderName({
      tenderNumber: "T260817-ACME-Rev1",
      ...tender
    });
    const afterRevision = deriveTenderFolderName({
      tenderNumber: "T260817-ACME-Rev2",
      ...tender
    });
    expect(beforeRevision).toBe(afterRevision);
    expect(beforeRevision).toBe("T260817 - Northshore");
  });

  it("resolves same-day collision by appending (2), (3), ...", () => {
    const tender = { tenderNumber: "T260817-ACME-Rev1", projectName: "Northshore", site: null };
    expect(deriveTenderFolderName(tender, [])).toBe("T260817 - Northshore");
    expect(deriveTenderFolderName(tender, ["T260817 - Northshore"])).toBe(
      "T260817 - Northshore (2)"
    );
    expect(
      deriveTenderFolderName(tender, ["T260817 - Northshore", "T260817 - Northshore (2)"])
    ).toBe("T260817 - Northshore (3)");
  });

  it("handles no site property at all (undefined)", () => {
    const result = deriveTenderFolderName({ tenderNumber: "T260817-ACME-Rev1" });
    expect(result).toBe("T260817");
  });
});
