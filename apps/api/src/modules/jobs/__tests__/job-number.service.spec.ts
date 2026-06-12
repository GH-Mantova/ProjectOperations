// G5 — JobNumberService specs for the canonical J{YYMMDD}-{SLUG}-{NNN}
// format (supersedes the PR B05 J-YYYY-NNN year-sequence format).
// Mock Prisma, drive the service directly: count() supplies the per-client
// sequence, findUnique() supplies the collision probe.

import { JobNumberService } from "../job-number.service";
import { brisbaneYYMMDD } from "../../../common/id-format/client-slug";

function makeService(opts: { count?: number; taken?: string[] } = {}) {
  const taken = new Set(opts.taken ?? []);
  const count = jest.fn(async () => opts.count ?? 0);
  const findUnique = jest.fn(async ({ where }: { where: { jobNumber: string } }) =>
    taken.has(where.jobNumber) ? { id: "existing" } : null
  );
  const prisma = { job: { count, findUnique } };
  const service = new JobNumberService(prisma as never);
  return { service, count, findUnique };
}

const TODAY = brisbaneYYMMDD(new Date());

describe("JobNumberService (G5)", () => {
  describe("format", () => {
    it("builds J{YYMMDD}-{SLUG}-{NNN} with zero-padded sequence", () => {
      const { service } = makeService();
      const date = new Date("2026-06-05T02:00:00.000Z");
      expect(service.format(date, "ACME", 1)).toBe("J260605-ACME-001");
      expect(service.format(date, "QLDR", 42)).toBe("J260605-QLDR-042");
      expect(service.format(date, "BRIS", 100)).toBe("J260605-BRIS-100");
    });

    it("does not truncate sequences beyond 999", () => {
      const { service } = makeService();
      const date = new Date("2026-06-05T02:00:00.000Z");
      expect(service.format(date, "ACME", 1000)).toBe("J260605-ACME-1000");
    });
  });

  describe("validate", () => {
    it("returns null for canonical inputs", () => {
      const { service } = makeService();
      expect(service.validate("J260605-ACME-001")).toBeNull();
      expect(service.validate("J260605-QLDR-099")).toBeNull();
      expect(service.validate("J260605-BOB-001")).toBeNull(); // short slug OK
      expect(service.validate("J260605-ACME-001-2")).toBeNull(); // disambiguator
      expect(service.validate("J260605-3DCO-017")).toBeNull(); // digit slug
    });

    it("rejects the legacy J-YYYY-NNN and JOB- formats", () => {
      const { service } = makeService();
      expect(service.validate("J-2026-001")).toContain("not in canonical format");
      expect(service.validate("JOB-2026-001")).toContain("not in canonical format");
    });

    it("rejects unpadded sequences and lowercase slugs", () => {
      const { service } = makeService();
      expect(service.validate("J260605-ACME-1")).toContain("not in canonical format");
      expect(service.validate("J260605-acme-001")).toContain("not in canonical format");
    });

    it("rejects empty / missing input with a 'required' message", () => {
      const { service } = makeService();
      expect(service.validate("")).toBe("Job number is required.");
    });

    it("rejects free-form garbage", () => {
      const { service } = makeService();
      expect(service.validate("not-a-job-number")).toContain("not in canonical format");
      expect(service.validate("J260605ACME001")).toContain("not in canonical format");
    });
  });

  describe("generate", () => {
    it("returns count+1 as the per-client sequence with the client slug", async () => {
      const { service, count } = makeService({ count: 16 });
      const result = await service.generate("client-1", "Acme Infrastructure");
      expect(result.jobNumber).toBe(`J${TODAY}-ACME-017`);
      expect(result.clientSlugSnapshot).toBe("ACME");
      expect(count).toHaveBeenCalledWith({ where: { clientId: "client-1" } });
    });

    it("starts at 001 for a client's first job", async () => {
      const { service } = makeService({ count: 0 });
      const result = await service.generate("client-1", "QLD Roads Authority");
      expect(result.jobNumber).toBe(`J${TODAY}-QLDR-001`);
    });

    it("appends -2 when the candidate collides", async () => {
      const { service } = makeService({ count: 0, taken: [`J${TODAY}-ACME-001`] });
      const result = await service.generate("client-1", "Acme Infrastructure");
      expect(result.jobNumber).toBe(`J${TODAY}-ACME-001-2`);
    });

    it("keeps incrementing the disambiguator until free", async () => {
      const { service } = makeService({
        count: 0,
        taken: [`J${TODAY}-ACME-001`, `J${TODAY}-ACME-001-2`]
      });
      const result = await service.generate("client-1", "Acme Infrastructure");
      expect(result.jobNumber).toBe(`J${TODAY}-ACME-001-3`);
    });

    it("generated numbers pass validate()", async () => {
      const { service } = makeService({ count: 4 });
      const { jobNumber } = await service.generate("client-1", "Brisbane City Council");
      expect(service.validate(jobNumber)).toBeNull();
    });
  });
});
