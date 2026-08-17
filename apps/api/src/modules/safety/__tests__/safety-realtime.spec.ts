// RT-2: unit coverage for the safety realtime seam. Two concerns:
//   1. The emitter fires strictly AFTER the Prisma write resolves — never
//      before, and never for a create path where validation rejects the
//      input (so a rejected create emits nothing).
//   2. The SSE auth guard rejects missing / invalid / portal / permissionless
//      tokens and admits a valid `safety.view` payload — SSE cannot use the
//      Authorization header (EventSource limitation), so the token comes in
//      via `?token=` and is validated the same way `JwtAuthGuard` does.

import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { MusterAttendeeStatus, MusterEventStatus } from "@prisma/client";
import { firstValueFrom } from "rxjs";
import { take, toArray } from "rxjs/operators";

import { MusterService } from "../muster.service";
import { SafetyRealtimeEmitter } from "../realtime/safety-realtime.emitter";
import { SafetyRealtimeAuthGuard } from "../realtime/safety-realtime.guard";
import { SafetyService } from "../safety.service";

const ACTOR = "user-actor";

// ─── Emit-after-commit ordering ─────────────────────────────────────────────

describe("SafetyService realtime emit", () => {
  function buildService() {
    const callOrder: string[] = [];
    const prisma = {
      safetyIncident: {
        create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
          callOrder.push("prisma.safetyIncident.create");
          return Promise.resolve({ id: "inc-new", ...args.data });
        }),
        findUnique: jest.fn().mockResolvedValue({ id: "inc-1" }),
        update: jest.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) => {
          callOrder.push("prisma.safetyIncident.update");
          return Promise.resolve({ id: args.where.id, ...args.data });
        })
      },
      hazardObservation: {
        create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
          callOrder.push("prisma.hazardObservation.create");
          return Promise.resolve({ id: "haz-new", ...args.data });
        }),
        findUnique: jest.fn().mockResolvedValue({ id: "haz-1" }),
        update: jest.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) => {
          callOrder.push("prisma.hazardObservation.update");
          return Promise.resolve({ id: args.where.id, ...args.data });
        })
      },
      safetyIncidentNumberSequence: {
        upsert: jest.fn().mockResolvedValue({ id: 1, lastNumber: 1 })
      },
      hazardNumberSequence: {
        upsert: jest.fn().mockResolvedValue({ id: 1, lastNumber: 1 })
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null)
      },
      $transaction: jest.fn().mockImplementation((input: unknown) => {
        if (typeof input === "function") {
          return (input as (tx: unknown) => Promise<unknown>)(prisma);
        }
        return Promise.all(input as Array<Promise<unknown>>);
      })
    };
    const notifications = { create: jest.fn().mockResolvedValue({ id: "n-1" }) };
    const email = { sendNotificationEmail: jest.fn().mockResolvedValue(undefined) };
    const realtime = {
      emit: jest.fn().mockImplementation(() => {
        callOrder.push("realtime.emit");
      })
    };
    const service = new SafetyService(
      prisma as never,
      notifications as never,
      email as never,
      realtime as never
    );
    return { service, prisma, realtime, callOrder };
  }

  const incidentInput = () => ({
    incidentDate: "2026-06-01T00:00:00.000Z",
    location: "Depot",
    incidentType: "near_miss",
    severity: "low",
    description: "Reversed without spotter"
  });

  const hazardInput = () => ({
    observationDate: "2026-06-01T00:00:00.000Z",
    location: "Shed",
    hazardType: "electrical",
    riskLevel: "medium",
    description: "Frayed lead"
  });

  it("emits safety.incident.changed strictly after createIncident's Prisma write", async () => {
    const { service, realtime, callOrder } = buildService();
    await service.createIncident(incidentInput(), ACTOR);
    expect(realtime.emit).toHaveBeenCalledWith({ type: "safety.incident.changed" });
    expect(callOrder).toEqual(["prisma.safetyIncident.create", "realtime.emit"]);
  });

  it("emits safety.incident.changed after updateIncident and closeIncident", async () => {
    const { service, realtime } = buildService();
    await service.updateIncident("inc-1", { status: "investigating" });
    await service.closeIncident("inc-1", ACTOR);
    expect(realtime.emit).toHaveBeenNthCalledWith(1, { type: "safety.incident.changed" });
    expect(realtime.emit).toHaveBeenNthCalledWith(2, { type: "safety.incident.changed" });
  });

  it("does NOT emit when createIncident is rejected by validation", async () => {
    const { service, realtime } = buildService();
    await expect(
      service.createIncident({ ...incidentInput(), incidentType: "cosmic" }, ACTOR)
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(realtime.emit).not.toHaveBeenCalled();
  });

  it("emits safety.hazard.changed after createHazard, updateHazard, closeHazard", async () => {
    const { service, realtime, callOrder } = buildService();
    await service.createHazard(hazardInput(), ACTOR);
    await service.updateHazard("haz-1", { location: "New spot" });
    await service.closeHazard("haz-1");
    expect(realtime.emit).toHaveBeenCalledTimes(3);
    for (const call of realtime.emit.mock.calls) {
      expect(call[0]).toEqual({ type: "safety.hazard.changed" });
    }
    expect(callOrder[0]).toBe("prisma.hazardObservation.create");
    expect(callOrder[1]).toBe("realtime.emit");
  });
});

describe("MusterService realtime emit", () => {
  function buildService(overrides: Record<string, unknown> = {}) {
    const callOrder: string[] = [];
    const prisma: Record<string, unknown> = {
      site: { findUnique: jest.fn().mockResolvedValue({ id: "site-x" }) },
      musterEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue({
          id: "evt-1",
          status: MusterEventStatus.ACTIVE,
          siteId: "site-x"
        }),
        create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
          callOrder.push("prisma.musterEvent.create");
          return Promise.resolve({ id: "evt-new", ...args.data });
        }),
        update: jest.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) => {
          callOrder.push("prisma.musterEvent.update");
          return Promise.resolve({ id: args.where.id, ...args.data });
        })
      },
      musterAttendee: {
        findUnique: jest.fn().mockResolvedValue({
          id: "att-1",
          workerProfileId: "wp-1",
          musterEvent: { status: MusterEventStatus.ACTIVE, siteId: "site-x" }
        }),
        update: jest.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) => {
          callOrder.push("prisma.musterAttendee.update");
          return Promise.resolve({ id: args.where.id, ...args.data });
        }),
        createMany: jest.fn().mockResolvedValue({ count: 0 })
      },
      siteAttendance: { findMany: jest.fn().mockResolvedValue([]) },
      workerLocationLog: { create: jest.fn().mockResolvedValue({ id: "log-1" }) },
      $transaction: jest.fn().mockImplementation((input: unknown) => {
        if (typeof input === "function") {
          return (input as (tx: unknown) => Promise<unknown>)(prisma);
        }
        return Promise.all(input as Array<Promise<unknown>>);
      }),
      ...overrides
    };
    const realtime = {
      emit: jest.fn().mockImplementation(() => {
        callOrder.push("realtime.emit");
      })
    };
    const service = new MusterService(prisma as never, realtime as never);
    return { service, prisma, realtime, callOrder };
  }

  it("emits safety.muster.changed after startMuster with the site scope", async () => {
    const { service, realtime, callOrder } = buildService();
    await service.startMuster("site-x", ACTOR);
    expect(realtime.emit).toHaveBeenCalledWith({
      type: "safety.muster.changed",
      siteId: "site-x"
    });
    // Emit must land after the transaction has produced the event row.
    expect(callOrder.indexOf("realtime.emit")).toBeGreaterThan(
      callOrder.indexOf("prisma.musterEvent.create")
    );
  });

  it("emits safety.muster.changed after a successful attendee check-off", async () => {
    const { service, realtime, callOrder } = buildService();
    await service.checkAttendee(
      "att-1",
      { status: MusterAttendeeStatus.ACCOUNTED, lat: 0, lng: 0 },
      ACTOR
    );
    expect(realtime.emit).toHaveBeenCalledWith({
      type: "safety.muster.changed",
      siteId: "site-x"
    });
    expect(callOrder).toEqual(["prisma.musterAttendee.update", "realtime.emit"]);
  });

  it("emits safety.muster.changed after completeMuster and cancelMuster", async () => {
    const { service, realtime } = buildService();
    await service.completeMuster("evt-1", ACTOR);
    expect(realtime.emit).toHaveBeenLastCalledWith({
      type: "safety.muster.changed",
      siteId: "site-x"
    });

    const cancelled = buildService();
    await cancelled.service.cancelMuster("evt-1", ACTOR);
    expect(cancelled.realtime.emit).toHaveBeenLastCalledWith({
      type: "safety.muster.changed",
      siteId: "site-x"
    });
  });

  it("does NOT emit when checkAttendee is rejected because the event is not ACTIVE", async () => {
    const { service, realtime } = buildService({
      musterAttendee: {
        findUnique: jest.fn().mockResolvedValue({
          id: "att-1",
          workerProfileId: "wp-1",
          musterEvent: { status: MusterEventStatus.COMPLETED, siteId: "site-x" }
        }),
        update: jest.fn()
      }
    });
    await expect(
      service.checkAttendee(
        "att-1",
        { status: MusterAttendeeStatus.ACCOUNTED, lat: 0, lng: 0 },
        ACTOR
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(realtime.emit).not.toHaveBeenCalled();
  });
});

// ─── Emitter observable plumbing ────────────────────────────────────────────

describe("SafetyRealtimeEmitter observable", () => {
  it("delivers emitted events to subscribers as SSE MessageEvents", async () => {
    const emitter = new SafetyRealtimeEmitter();
    const collected = firstValueFrom(
      emitter.stream().pipe(take(2), toArray())
    );
    // Push after subscribe — Subject is hot, no replay.
    setImmediate(() => {
      emitter.emit({ type: "safety.incident.changed" });
      emitter.emit({ type: "safety.muster.changed", siteId: "site-x" });
    });
    const events = await collected;
    expect(events).toEqual([
      { type: "safety.incident.changed", data: { type: "safety.incident.changed" } },
      {
        type: "safety.muster.changed",
        data: { type: "safety.muster.changed", siteId: "site-x" }
      }
    ]);
  });
});

// ─── SSE auth guard (query-token) ───────────────────────────────────────────

describe("SafetyRealtimeAuthGuard", () => {
  function ctx(query: Record<string, unknown>) {
    const req: Record<string, unknown> = { query };
    return {
      switchToHttp: () => ({ getRequest: () => req })
    } as never;
  }

  function build(jwt: Partial<JwtService>, cfgGet?: (key: string, fallback: string) => string) {
    const config = {
      get: cfgGet ?? ((_key: string, fallback: string) => fallback)
    } as unknown as ConfigService;
    return new SafetyRealtimeAuthGuard(jwt as JwtService, config);
  }

  it("rejects a request with no token", async () => {
    const guard = build({ verifyAsync: jest.fn() });
    await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects an invalid / expired token", async () => {
    const guard = build({ verifyAsync: jest.fn().mockRejectedValue(new Error("bad sig")) });
    await expect(guard.canActivate(ctx({ token: "nope" }))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("rejects a portal token even if it verifies", async () => {
    const guard = build({
      verifyAsync: jest
        .fn()
        .mockResolvedValue({ sub: "u", email: "u@x", permissions: ["safety.view"], type: "portal" })
    });
    await expect(guard.canActivate(ctx({ token: "portal-tok" }))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("rejects a valid token missing safety.view", async () => {
    const guard = build({
      verifyAsync: jest
        .fn()
        .mockResolvedValue({ sub: "u", email: "u@x", permissions: ["projects.view"] })
    });
    await expect(guard.canActivate(ctx({ token: "t" }))).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("admits a valid token holding safety.view", async () => {
    const guard = build({
      verifyAsync: jest
        .fn()
        .mockResolvedValue({ sub: "u", email: "u@x", permissions: ["safety.view"] })
    });
    await expect(guard.canActivate(ctx({ token: "t" }))).resolves.toBe(true);
  });

  it("admits a superuser without checking permissions", async () => {
    const guard = build({
      verifyAsync: jest
        .fn()
        .mockResolvedValue({ sub: "u", email: "u@x", permissions: [], isSuperUser: true })
    });
    await expect(guard.canActivate(ctx({ token: "t" }))).resolves.toBe(true);
  });
});
