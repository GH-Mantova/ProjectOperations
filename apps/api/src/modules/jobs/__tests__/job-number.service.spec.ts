// PR B05 — JobNumberService specs.
// Mirrors the cutting-create-cardid.spec.ts pattern: mock Prisma, drive
// the service directly. Validator branches are pure functions; generator
// uses a mocked upsert that returns sequential `lastNumber` values.

import { JobNumberService } from "../job-number.service";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

function makeService(opts: { upsertImpl?: (...args: unknown[]) => Promise<unknown> } = {}) {
  const upsert: AsyncMock = jest.fn();
  if (opts.upsertImpl) {
    upsert.mockImplementation(opts.upsertImpl);
  }
  const prisma = { jobNumberSequence: { upsert } };
  const service = new JobNumberService(prisma as never);
  return { service, upsert };
}

describe("JobNumberService (PR B05)", () => {
  describe("format", () => {
    it("zero-pads the sequence to 3 digits", () => {
      const { service } = makeService();
      expect(service.format(2026, 1)).toBe("J-2026-001");
      expect(service.format(2026, 42)).toBe("J-2026-042");
      expect(service.format(2026, 100)).toBe("J-2026-100");
    });

    it("does not truncate sequences beyond 999 (call site's problem)", () => {
      const { service } = makeService();
      // We pad to 3 but accept overflow — bigger sequences just emit
      // 4-digit numbers, which the validator will reject. Intentional;
      // the schema's @unique still holds.
      expect(service.format(2026, 1000)).toBe("J-2026-1000");
    });
  });

  describe("validate", () => {
    it("returns null for canonical inputs", () => {
      const { service } = makeService();
      expect(service.validate("J-2026-001")).toBeNull();
      expect(service.validate("J-2025-099")).toBeNull();
      expect(service.validate("J-1999-100")).toBeNull();
    });

    it("rejects the legacy JOB- prefix", () => {
      const { service } = makeService();
      const result = service.validate("JOB-2026-001");
      expect(result).toContain("not in canonical format");
    });

    it("rejects unpadded sequences", () => {
      const { service } = makeService();
      expect(service.validate("J-2026-1")).toContain("not in canonical format");
      expect(service.validate("J-2026-01")).toContain("not in canonical format");
    });

    it("rejects empty / missing input with a 'required' message", () => {
      const { service } = makeService();
      expect(service.validate("")).toBe("Job number is required.");
    });

    it("rejects free-form garbage", () => {
      const { service } = makeService();
      expect(service.validate("not-a-job-number")).toContain("not in canonical format");
      expect(service.validate("J2026001")).toContain("not in canonical format");
    });
  });

  describe("generate", () => {
    it("returns a canonical-format string for the current year", async () => {
      const { service, upsert } = makeService({
        upsertImpl: async () => ({ year: 2026, lastNumber: 1 })
      });
      const result = await service.generate();
      expect(result).toMatch(/^J-\d{4}-\d{3}$/);
      expect(upsert).toHaveBeenCalledTimes(1);
      const upsertArg = upsert.mock.calls[0]?.[0] as {
        where: { year: number };
        update: { lastNumber: { increment: number } };
        create: { year: number; lastNumber: number };
      };
      expect(upsertArg.update.lastNumber.increment).toBe(1);
      expect(upsertArg.create.lastNumber).toBe(1);
    });

    it("uses the row returned by upsert for the sequence portion (sequential calls)", async () => {
      // Simulate two consecutive generates: first returns lastNumber=1,
      // second returns lastNumber=2. Same year for both.
      let counter = 0;
      const { service } = makeService({
        upsertImpl: async () => {
          counter += 1;
          return { year: 2026, lastNumber: counter };
        }
      });
      const first = await service.generate();
      const second = await service.generate();
      expect(first.endsWith("-001")).toBe(true);
      expect(second.endsWith("-002")).toBe(true);
    });
  });
});
