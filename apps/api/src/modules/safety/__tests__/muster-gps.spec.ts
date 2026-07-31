// GPS-A3: mandatory GPS on muster attendee check-off. The checker's live
// GPS reading attaches to the ATTENDEE's WorkerLocationLog row so the muster
// audit answers "was this worker at the muster point?" — the checker's phone
// coords are the geo evidence for that fact.

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { MusterAttendeeStatus, MusterEventStatus, Prisma } from "@prisma/client";
import { MusterService } from "../muster.service";

const ATTENDEE_ID = "att-1";
const WORKER_ID = "wp-99";
const ACTOR_ID = "user-actor";

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma: Record<string, unknown> = {
    musterAttendee: {
      findUnique: jest.fn().mockResolvedValue({
        id: ATTENDEE_ID,
        workerProfileId: WORKER_ID,
        musterEvent: { status: MusterEventStatus.ACTIVE }
      }),
      update: jest.fn().mockImplementation((args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: args.where.id, ...args.data })
      )
    },
    workerLocationLog: {
      create: jest.fn().mockResolvedValue({ id: "log-1" })
    },
    ...overrides
  };
  const service = new MusterService(prisma as never);
  return { service, prisma };
}

describe("MusterService.checkAttendee — GPS-A3", () => {
  it("writes a WorkerLocationLog row tied to the attendee on ACCOUNTED", async () => {
    const { service, prisma } = buildService();
    await service.checkAttendee(
      ATTENDEE_ID,
      { status: MusterAttendeeStatus.ACCOUNTED, lat: -37.81, lng: 144.96, accuracy: 12 },
      ACTOR_ID
    );

    const log = (prisma.workerLocationLog as { create: jest.Mock }).create;
    expect(log).toHaveBeenCalledTimes(1);
    const arg = log.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data).toMatchObject({
      workerProfileId: WORKER_ID,
      eventType: "muster"
    });
    expect(arg.data.latitude).toEqual(new Prisma.Decimal(-37.81));
    expect(arg.data.longitude).toEqual(new Prisma.Decimal(144.96));
    expect(arg.data.accuracy).toEqual(new Prisma.Decimal(12));
  });

  it("logs on MISSING just as it does on ACCOUNTED", async () => {
    const { service, prisma } = buildService();
    await service.checkAttendee(
      ATTENDEE_ID,
      { status: MusterAttendeeStatus.MISSING, lat: 0, lng: 0 },
      ACTOR_ID
    );
    expect((prisma.workerLocationLog as { create: jest.Mock }).create).toHaveBeenCalledTimes(1);
  });

  it("still rejects when the parent event is not ACTIVE — and does NOT log", async () => {
    const { service, prisma } = buildService({
      musterAttendee: {
        findUnique: jest.fn().mockResolvedValue({
          id: ATTENDEE_ID,
          workerProfileId: WORKER_ID,
          musterEvent: { status: MusterEventStatus.COMPLETED }
        }),
        update: jest.fn()
      }
    });
    await expect(
      service.checkAttendee(
        ATTENDEE_ID,
        { status: MusterAttendeeStatus.ACCOUNTED, lat: 0, lng: 0 },
        ACTOR_ID
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((prisma.workerLocationLog as { create: jest.Mock }).create).not.toHaveBeenCalled();
  });

  it("rejects when the attendee does not exist", async () => {
    const { service } = buildService({
      musterAttendee: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn()
      }
    });
    await expect(
      service.checkAttendee(
        ATTENDEE_ID,
        { status: MusterAttendeeStatus.ACCOUNTED, lat: 0, lng: 0 },
        ACTOR_ID
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
