// GPS-A3: mandatory GPS on site sign-in/out. Every successful call — even
// the idempotent no-op sign-in when an open attendance already exists —
// writes a WorkerLocationLog row so the audit trail says "the button was
// pressed at this position". Class-level DTO validation is exercised by
// e2e; here we cover the service persistence contract.

import { Prisma } from "@prisma/client";
import { SitesService } from "../sites.service";

const WORKER_ID = "wp-1";
const USER_ID = "user-1";
const SITE_ID = "site-1";

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma: Record<string, unknown> = {
    workerProfile: {
      findUnique: jest.fn().mockResolvedValue({ id: WORKER_ID, internalUserId: USER_ID })
    },
    site: {
      findUnique: jest.fn().mockResolvedValue({ id: SITE_ID })
    },
    siteAttendance: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "att-new", ...args.data })
      ),
      update: jest.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: args.where.id, ...args.data })
      )
    },
    workerLocationLog: {
      create: jest.fn().mockResolvedValue({ id: "log-1" })
    },
    ...overrides
  };
  const service = new SitesService(prisma as never);
  return { service, prisma };
}

describe("SitesService — GPS-A3 mandatory location logging", () => {
  it("writes a WorkerLocationLog row on sign-in with the captured coords", async () => {
    const { service, prisma } = buildService();
    await service.signIn(USER_ID, {
      siteId: SITE_ID,
      lat: -37.81,
      lng: 144.96,
      accuracy: 8.5
    });

    const log = (prisma.workerLocationLog as { create: jest.Mock }).create;
    expect(log).toHaveBeenCalledTimes(1);
    const arg = log.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data).toMatchObject({
      workerProfileId: WORKER_ID,
      eventType: "site_attendance"
    });
    expect(arg.data.latitude).toEqual(new Prisma.Decimal(-37.81));
    expect(arg.data.longitude).toEqual(new Prisma.Decimal(144.96));
    expect(arg.data.accuracy).toEqual(new Prisma.Decimal(8.5));
  });

  it("still logs on sign-in when an open attendance already exists (idempotent no-op case)", async () => {
    const { service, prisma } = buildService({
      siteAttendance: {
        findFirst: jest.fn().mockResolvedValue({ id: "att-open", siteId: SITE_ID, workerProfileId: WORKER_ID, signedOutAt: null }),
        create: jest.fn(),
        update: jest.fn()
      }
    });
    await service.signIn(USER_ID, {
      siteId: SITE_ID,
      lat: 0,
      lng: 0
    });
    expect((prisma.workerLocationLog as { create: jest.Mock }).create).toHaveBeenCalledTimes(1);
  });

  it("writes a WorkerLocationLog row on sign-out with omitted accuracy => null", async () => {
    const { service, prisma } = buildService({
      siteAttendance: {
        findFirst: jest.fn().mockResolvedValue({ id: "att-open", notes: null }),
        update: jest.fn().mockResolvedValue({ id: "att-open" })
      }
    });
    await service.signOut(USER_ID, {
      lat: -37.8,
      lng: 144.95
    });

    const log = (prisma.workerLocationLog as { create: jest.Mock }).create;
    expect(log).toHaveBeenCalledTimes(1);
    const arg = log.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.eventType).toBe("site_attendance");
    expect(arg.data.accuracy).toBeNull();
  });

  it("logs on sign-out even when there is no open attendance (no-op response)", async () => {
    const { service, prisma } = buildService({
      siteAttendance: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn()
      }
    });
    const result = await service.signOut(USER_ID, { lat: 0, lng: 0 });
    expect(result).toBeNull();
    // The button-press fact still gets logged.
    expect((prisma.workerLocationLog as { create: jest.Mock }).create).toHaveBeenCalledTimes(1);
  });
});
