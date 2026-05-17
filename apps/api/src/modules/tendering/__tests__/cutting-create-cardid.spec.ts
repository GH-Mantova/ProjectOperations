// PR B4b.1 — defensive specs for the cutting-row cardId contract.
//
// P2a (Codex): createCuttingItem persisted `dto.cardId ?? null`, which
//   preserved an empty string and would fail the scope_cards FK with a
//   500. These specs prove that empty-string and whitespace-only
//   cardId values are normalized to null BEFORE the FK validation
//   runs, so the row is persisted as cardless instead of crashing.
//
// P2b (Codex): UpdateCuttingItemDto previously declared `cardId` for a
//   re-parenting feature that was never wired into the service. The
//   final test in this file is a compile-time guard that fails the
//   build if cardId is ever re-added to the update DTO without the
//   service handler being wired up at the same time.

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ScopeRedesignService } from "../scope-redesign.service";
import type { UpdateCuttingItemDto } from "../scope-redesign.controller";

type AsyncMock = jest.Mock<Promise<unknown>, unknown[]>;

function buildPrismaMock(opts: {
  cardLookupResult?: { id: string } | null;
} = {}) {
  const tenderFindUnique: AsyncMock = jest.fn(async () => ({ id: "tender-1" }));
  // `scopeCard.findFirst` is the FK validation lookup. We track its
  // call count so the empty-string spec can assert it was NOT called.
  const scopeCardFindFirst: AsyncMock = jest.fn(async () =>
    opts.cardLookupResult === undefined ? { id: "card-1" } : opts.cardLookupResult
  );
  const cuttingCreate: AsyncMock = jest.fn(async (args: unknown) => {
    const data = ((args as { data?: Record<string, unknown> })?.data ?? {}) as Record<string, unknown>;
    return { id: "cut-1", ...data, otherRate: null };
  });

  const prisma = {
    tender: { findUnique: tenderFindUnique },
    scopeCard: { findFirst: scopeCardFindFirst },
    cuttingSheetItem: { create: cuttingCreate },
    // pricedCuttingData reads cutting + core-hole rate tables; an
    // itemType=other-rate with no otherRateId short-circuits to all
    // nulls, so we don't need to mock those tables for these tests.
    cuttingOtherRate: { findUnique: jest.fn(async () => null) },
    estimateCuttingRate: { findFirst: jest.fn(async () => null) },
    estimateCoreHoleRate: { findFirst: jest.fn(async () => null) }
  };

  return { prisma, mocks: { scopeCardFindFirst, cuttingCreate } };
}

function makeDto(overrides: Record<string, unknown> = {}) {
  // Minimal valid manual create — other-rate with no rate ID resolves
  // to a no-op pricing path (returns null rates + null lineTotal).
  // Keeps the spec focused on the cardId contract.
  return {
    wbsRef: "DEM1.1",
    itemType: "other-rate" as const,
    ...overrides
  };
}

describe("ScopeRedesignService.createCuttingItem — cardId contract (PR B4b.1)", () => {
  it("empty-string cardId rejects with 400 (B-followup — was normalised-to-null pre-NOT NULL)", async () => {
    // PR B-followup: cardId is now schema-required (NOT NULL). The
    // B4b.1 "normalize empty-string to null and persist as cardless"
    // path is no longer valid — Prisma would reject the insert.
    // Instead we throw a controlled 400 at the service boundary so
    // the user sees a clean error, not a 500-via-FK or a 500-via
    // database-constraint.
    const { prisma, mocks } = buildPrismaMock();
    const svc = new ScopeRedesignService(prisma as never);
    await expect(
      svc.createCuttingItem("tender-1", "user-1", makeDto({ cardId: "" }))
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.scopeCardFindFirst).not.toHaveBeenCalled();
    expect(mocks.cuttingCreate).not.toHaveBeenCalled();
  });

  it("whitespace-only cardId also rejects with 400 (B-followup)", async () => {
    const { prisma, mocks } = buildPrismaMock();
    const svc = new ScopeRedesignService(prisma as never);
    await expect(
      svc.createCuttingItem("tender-1", "user-1", makeDto({ cardId: "   " }))
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.scopeCardFindFirst).not.toHaveBeenCalled();
    expect(mocks.cuttingCreate).not.toHaveBeenCalled();
  });

  it("missing cardId (undefined) rejects with 400 (B-followup — schema is NOT NULL)", async () => {
    const { prisma, mocks } = buildPrismaMock();
    const svc = new ScopeRedesignService(prisma as never);
    await expect(
      svc.createCuttingItem("tender-1", "user-1", makeDto({}))
    ).rejects.toThrow(/cardId is required/);
    expect(mocks.scopeCardFindFirst).not.toHaveBeenCalled();
    expect(mocks.cuttingCreate).not.toHaveBeenCalled();
  });

  it("real cardId still validates against scope_cards (B4b regression)", async () => {
    const { prisma, mocks } = buildPrismaMock({
      cardLookupResult: { id: "real-card-uuid" }
    });
    const svc = new ScopeRedesignService(prisma as never);
    await svc.createCuttingItem(
      "tender-1",
      "user-1",
      makeDto({ cardId: "real-card-uuid" })
    );
    expect(mocks.scopeCardFindFirst).toHaveBeenCalledTimes(1);
    const findArgs = (mocks.scopeCardFindFirst.mock.calls[0]?.[0] ?? {}) as {
      where?: { id?: string; tenderId?: string };
    };
    expect(findArgs.where?.id).toBe("real-card-uuid");
    expect(findArgs.where?.tenderId).toBe("tender-1");
    const data = (mocks.cuttingCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data.cardId).toBe("real-card-uuid");
  });

  it("non-existent cardId still 404s (B4b regression)", async () => {
    const { prisma, mocks } = buildPrismaMock({ cardLookupResult: null });
    const svc = new ScopeRedesignService(prisma as never);
    await expect(
      svc.createCuttingItem(
        "tender-1",
        "user-1",
        makeDto({ cardId: "missing-card-uuid" })
      )
    ).rejects.toBeInstanceOf(NotFoundException);
    // Row must NOT have been created.
    expect(mocks.cuttingCreate).not.toHaveBeenCalled();
  });
});

describe("UpdateCuttingItemDto — cardId contract guard (PR B4b.1)", () => {
  it("does not declare cardId (P2b — silent-no-op prevention)", () => {
    // Compile-time guard: if cardId is ever re-added to
    // UpdateCuttingItemDto without the service handler being wired
    // up in the same PR, the @ts-expect-error below fails and this
    // build fails. The runtime assertion is a tautology — the real
    // test is the directive above the assignment.
    // @ts-expect-error — cardId removed in B4b.1; do not re-add unless
    // updateCuttingItem reads it.
    const _check: UpdateCuttingItemDto = { cardId: "x" };
    void _check;
    expect(true).toBe(true);
  });
});
