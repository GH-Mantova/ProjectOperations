// RT-2 — SafetyRealtimeEmitter unit + emit-after-commit tests.
//
// The emitter itself is a small in-memory SSE registry (mirrors
// SchedulerPresenceRegistry). The critical safety-net these tests provide is
// that SafetyService and MusterService only fire the emitter AFTER their
// respective Prisma write resolves — an incident that fails to persist must
// not push a "safety.incident.changed" to viewers.

import { MusterAttendeeStatus, MusterEventStatus } from "@prisma/client";
import type { Response } from "express";
import { MusterService } from "../muster.service";
import { SafetyService } from "../safety.service";
import { SafetyRealtimeEmitter } from "../realtime/safety-realtime.emitter";

const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

// ─── Registry ───────────────────────────────────────────────────────────────

describe("SafetyRealtimeEmitter", () => {
  function fakeResponse(): { res: Response; writes: string[] } {
    const writes: string[] = [];
    const res = {
      writableEnded: false,
      write: (chunk: string) => {
        writes.push(chunk);
        return true;
      }
    } as unknown as Response;
    return { res, writes };
  }

  it("allocates monotonically increasing connection ids", () => {
    const emitter = new SafetyRealtimeEmitter();
    expect(emitter.allocateId()).toBe("sf-1");
    expect(emitter.allocateId()).toBe("sf-2");
  });

  it("broadcasts SSE-framed events to every registered connection", () => {
    const emitter = new SafetyRealtimeEmitter();
    const a = fakeResponse();
    const b = fakeResponse();
    emitter.register({ connectionId: "sf-1", response: a.res });
    emitter.register({ connectionId: "sf-2", response: b.res });

    emitter.incidentChanged({ id: "inc-1", action: "create" });

    const expected =
      'event: safety.incident.changed\ndata: {"id":"inc-1","action":"create"}\n\n';
    expect(a.writes).toEqual([expected]);
    expect(b.writes).toEqual([expected]);
  });

  it("skips connections whose response is already closed", () => {
    const emitter = new SafetyRealtimeEmitter();
    const closed = fakeResponse();
    (closed.res as unknown as { writableEnded: boolean }).writableEnded = true;
    emitter.register({ connectionId: "sf-1", response: closed.res });

    emitter.hazardChanged({ id: "haz-1", action: "close" });
    expect(closed.writes).toEqual([]);
  });

  it("removes an unregistered connection so later broadcasts skip it", () => {
    const emitter = new SafetyRealtimeEmitter();
    const a = fakeResponse();
    emitter.register({ connectionId: "sf-1", response: a.res });
    emitter.unregister("sf-1");

    emitter.musterChanged({ siteId: "site-1", action: "start" });
    expect(a.writes).toEqual([]);
    expect(emitter.count).toBe(0);
  });

  it("frames muster events with siteId so clients can filter to a single site", () => {
    const emitter = new SafetyRealtimeEmitter();
    const a = fakeResponse();
    emitter.register({ connectionId: "sf-1", response: a.res });

    emitter.musterChanged({ siteId: "site-42", eventId: "me-1", action: "check" });
    expect(a.writes[0]).toContain('"siteId":"site-42"');
    expect(a.writes[0]).toContain('event: safety.muster.changed');
  });
});

// ─── Emit after commit — SafetyService ─────────────────────────────────────

describe("SafetyService emits after DB commit", () => {
  function build() {
    const created = { id: "inc-new" };
    const prisma: Record<string, unknown> = {
      safetyIncident: {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: "inc-1" }),
        count: jest.fn(),
        create: jest.fn().mockResolvedValue(created),
        update: jest.fn().mockResolvedValue({ id: "inc-1", status: "closed" }),
        groupBy: jest.fn()
      },
      hazardObservation: {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: "haz-1" }),
        count: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "haz-new" }),
        update: jest.fn().mockResolvedValue({ id: "haz-1", status: "closed" }),
        groupBy: jest.fn()
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
    const notifications = { create: jest.fn().mockResolvedValue({ id: "n" }) };
    const email = { sendNotificationEmail: jest.fn().mockResolvedValue(undefined) };
    const realtime = new SafetyRealtimeEmitter();
    const spyIncident = jest.spyOn(realtime, "incidentChanged");
    const spyHazard = jest.spyOn(realtime, "hazardChanged");

    const service = new SafetyService(
      prisma as never,
      notifications as never,
      email as never,
      realtime
    );
    return { service, prisma, spyIncident, spyHazard };
  }

  it("fires safety.incident.changed AFTER the incident create resolves", async () => {
    const { service, prisma, spyIncident } = build();
    const createMock = (prisma.safetyIncident as { create: jest.Mock }).create;

    // Order guard: spy must not have been called until create resolves.
    let createSettled = false;
    createMock.mockImplementationOnce(async () => {
      await flushAsync();
      createSettled = true;
      return { id: "inc-new" };
    });
    spyIncident.mockImplementationOnce(() => {
      expect(createSettled).toBe(true);
    });

    await service.createIncident(
      {
        incidentDate: "2026-06-01T00:00:00.000Z",
        location: "yard",
        incidentType: "near_miss",
        severity: "low",
        description: "d"
      },
      "actor"
    );

    expect(spyIncident).toHaveBeenCalledWith({ id: "inc-new", action: "create" });
  });

  it("fires safety.hazard.changed AFTER the hazard create resolves", async () => {
    const { service, spyHazard } = build();

    await service.createHazard(
      {
        observationDate: "2026-06-01T00:00:00.000Z",
        location: "shed",
        hazardType: "electrical",
        riskLevel: "medium",
        description: "d"
      },
      "actor"
    );

    expect(spyHazard).toHaveBeenCalledWith({ id: "haz-new", action: "create" });
  });

  it("fires safety.incident.changed on close AFTER the update resolves", async () => {
    const { service, spyIncident } = build();
    await service.closeIncident("inc-1", "actor");
    expect(spyIncident).toHaveBeenLastCalledWith({ id: "inc-1", action: "close" });
  });

  it("fires safety.hazard.changed on close AFTER the update resolves", async () => {
    const { service, spyHazard } = build();
    await service.closeHazard("haz-1");
    expect(spyHazard).toHaveBeenLastCalledWith({ id: "haz-1", action: "close" });
  });
});

// ─── Emit after commit — MusterService ─────────────────────────────────────

describe("MusterService emits after DB commit", () => {
  const ATTENDEE_ID = "att-1";
  const EVENT_ID = "me-1";
  const SITE_ID = "site-1";
  const WORKER_ID = "wp-1";
  const ACTOR = "user-actor";

  function build() {
    const prisma: Record<string, unknown> = {
      site: { findUnique: jest.fn().mockResolvedValue({ id: SITE_ID }) },
      musterEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue({
          id: EVENT_ID,
          status: MusterEventStatus.ACTIVE,
          siteId: SITE_ID
        }),
        create: jest.fn().mockResolvedValue({ id: EVENT_ID, siteId: SITE_ID }),
        update: jest.fn().mockResolvedValue({ id: EVENT_ID })
      },
      siteAttendance: { findMany: jest.fn().mockResolvedValue([]) },
      musterAttendee: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({
          id: ATTENDEE_ID,
          workerProfileId: WORKER_ID,
          musterEventId: EVENT_ID,
          musterEvent: { status: MusterEventStatus.ACTIVE, siteId: SITE_ID }
        }),
        update: jest.fn().mockResolvedValue({ id: ATTENDEE_ID })
      },
      workerLocationLog: { create: jest.fn().mockResolvedValue({ id: "log-1" }) },
      $transaction: jest.fn().mockImplementation(async (input: unknown) => {
        if (typeof input === "function") {
          return (input as (tx: unknown) => Promise<unknown>)(prisma);
        }
        return Promise.all(input as Array<Promise<unknown>>);
      })
    };
    const realtime = new SafetyRealtimeEmitter();
    const spy = jest.spyOn(realtime, "musterChanged");
    const service = new MusterService(prisma as never, realtime);
    return { service, prisma, spy };
  }

  it("fires safety.muster.changed on start AFTER the event create resolves", async () => {
    const { service, spy } = build();
    await service.startMuster(SITE_ID, ACTOR);
    expect(spy).toHaveBeenCalledWith({
      siteId: SITE_ID,
      eventId: EVENT_ID,
      action: "start"
    });
  });

  it("fires safety.muster.changed on attendee check AFTER the update resolves", async () => {
    const { service, prisma, spy } = build();
    const updateMock = (prisma.musterAttendee as { update: jest.Mock }).update;

    let updateSettled = false;
    updateMock.mockImplementationOnce(async () => {
      await flushAsync();
      updateSettled = true;
      return { id: ATTENDEE_ID };
    });
    spy.mockImplementationOnce(() => {
      expect(updateSettled).toBe(true);
    });

    await service.checkAttendee(
      ATTENDEE_ID,
      { status: MusterAttendeeStatus.ACCOUNTED, lat: 0, lng: 0 },
      ACTOR
    );
    expect(spy).toHaveBeenCalledWith({
      siteId: SITE_ID,
      eventId: EVENT_ID,
      action: "check"
    });
  });

  it("fires safety.muster.changed on complete AFTER the update resolves", async () => {
    const { service, spy } = build();
    await service.completeMuster(EVENT_ID, ACTOR);
    expect(spy).toHaveBeenLastCalledWith({
      siteId: SITE_ID,
      eventId: EVENT_ID,
      action: "complete"
    });
  });

  it("fires safety.muster.changed on cancel AFTER the update resolves", async () => {
    const { service, spy } = build();
    await service.cancelMuster(EVENT_ID, ACTOR);
    expect(spy).toHaveBeenLastCalledWith({
      siteId: SITE_ID,
      eventId: EVENT_ID,
      action: "cancel"
    });
  });
});
