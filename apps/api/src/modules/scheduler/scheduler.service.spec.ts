import { SchedulerService } from "./scheduler.service";

describe("SchedulerService", () => {
  it("adds an amber conflict when a shift has partial assignments", async () => {
    const createMany = jest.fn();
    const service = new SchedulerService(
      {
        shift: {
          findUnique: jest.fn().mockResolvedValue({
            id: "shift-1",
            startAt: new Date("2026-04-28T06:00:00.000Z"),
            endAt: new Date("2026-04-28T14:00:00.000Z"),
            roleRequirements: [],
            workerAssignments: [],
            assetAssignments: []
          })
        },
        schedulingConflict: {
          deleteMany: jest.fn(),
          createMany
        }
      } as never,
      { write: jest.fn() } as never
    );

    await service["refreshConflicts"]("shift-1");

    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          shiftId: "shift-1",
          severity: "AMBER",
          code: "PARTIAL_ASSIGNMENT"
        })
      ]
    });
  });
});
