import { SchedulerPresenceRegistry } from "../scheduler-presence.registry";

/**
 * RT-3 — Unit tests for the SchedulerPresenceRegistry.
 *
 * Tests the in-memory connection lifecycle: register, unregister,
 * and broadcast behaviour. The SSE Response objects are mocked
 * with writeable-stream stand-ins so no real HTTP context is needed.
 */

function makeMockResponse() {
  const written: string[] = [];
  return {
    writableEnded: false,
    write: jest.fn((chunk: string) => {
      written.push(chunk);
      return true;
    }),
    _written: written
  };
}

describe("SchedulerPresenceRegistry", () => {
  describe("register / unregister", () => {
    it("starts with no connections", () => {
      const registry = new SchedulerPresenceRegistry();
      expect(registry.count).toBe(0);
      expect(registry.roster).toHaveLength(0);
    });

    it("increments count when a connection is registered", () => {
      const registry = new SchedulerPresenceRegistry();
      const res = makeMockResponse();
      registry.register({
        connectionId: registry.allocateId(),
        userId: "u-1",
        name: "alice",
        response: res as never
      });
      expect(registry.count).toBe(1);
    });

    it("decrements count when a connection is unregistered", () => {
      const registry = new SchedulerPresenceRegistry();
      const connId = registry.allocateId();
      registry.register({
        connectionId: connId,
        userId: "u-1",
        name: "alice",
        response: makeMockResponse() as never
      });
      expect(registry.count).toBe(1);
      registry.unregister(connId);
      expect(registry.count).toBe(0);
    });

    it("returns correct roster with multiple connections", () => {
      const registry = new SchedulerPresenceRegistry();
      const idA = registry.allocateId();
      const idB = registry.allocateId();
      registry.register({
        connectionId: idA,
        userId: "u-1",
        name: "alice",
        response: makeMockResponse() as never
      });
      registry.register({
        connectionId: idB,
        userId: "u-2",
        name: "bob",
        response: makeMockResponse() as never
      });
      const roster = registry.roster;
      expect(roster).toHaveLength(2);
      expect(roster.map((r) => r.name)).toEqual(expect.arrayContaining(["alice", "bob"]));
    });

    it("unregistering an unknown id is a no-op", () => {
      const registry = new SchedulerPresenceRegistry();
      expect(() => registry.unregister("does-not-exist")).not.toThrow();
      expect(registry.count).toBe(0);
    });
  });

  describe("broadcast", () => {
    it("sends a formatted SSE event to all live connections", () => {
      const registry = new SchedulerPresenceRegistry();
      const resA = makeMockResponse();
      const resB = makeMockResponse();

      registry.register({
        connectionId: registry.allocateId(),
        userId: "u-1",
        name: "alice",
        response: resA as never
      });
      registry.register({
        connectionId: registry.allocateId(),
        userId: "u-2",
        name: "bob",
        response: resB as never
      });

      // Clear the presence-broadcast writes that happened on register.
      resA.write.mockClear();
      resB.write.mockClear();

      registry.broadcast("test.event", { hello: "world" });

      expect(resA.write).toHaveBeenCalledTimes(1);
      expect(resB.write).toHaveBeenCalledTimes(1);

      const payloadA = resA.write.mock.calls[0]![0] as string;
      expect(payloadA).toContain("event: test.event");
      expect(payloadA).toContain('"hello":"world"');
      expect(payloadA).toMatch(/\n\n$/);
    });

    it("skips connections whose response is already ended", () => {
      const registry = new SchedulerPresenceRegistry();
      const resA = makeMockResponse();
      const resB = { ...makeMockResponse(), writableEnded: true };

      registry.register({
        connectionId: registry.allocateId(),
        userId: "u-1",
        name: "alice",
        response: resA as never
      });
      registry.register({
        connectionId: registry.allocateId(),
        userId: "u-2",
        name: "bob",
        response: resB as never
      });

      resA.write.mockClear();
      resB.write.mockClear();

      registry.broadcast("test.skip", { x: 1 });

      expect(resA.write).toHaveBeenCalledTimes(1);
      expect(resB.write).not.toHaveBeenCalled();
    });
  });

  describe("broadcastPresence", () => {
    it("pushes a scheduler.presence event with count and roster after each register", () => {
      const registry = new SchedulerPresenceRegistry();
      const res = makeMockResponse();
      const connId = registry.allocateId();

      registry.register({
        connectionId: connId,
        userId: "u-1",
        name: "alice",
        response: res as never
      });

      // The last write should be the presence event from register().
      const lastCall = res.write.mock.calls[res.write.mock.calls.length - 1]![0] as string;
      expect(lastCall).toContain("event: scheduler.presence");
      const parsed = JSON.parse(lastCall.match(/data: (.+)/)?.[1] ?? "{}") as {
        count: number;
        roster: { name: string }[];
      };
      expect(parsed.count).toBe(1);
      expect(parsed.roster[0]!.name).toBe("alice");
    });

    it("pushes a scheduler.presence event with decremented count after unregister", () => {
      const registry = new SchedulerPresenceRegistry();
      const resA = makeMockResponse();
      const resB = makeMockResponse();
      const idA = registry.allocateId();
      const idB = registry.allocateId();

      registry.register({
        connectionId: idA,
        userId: "u-1",
        name: "alice",
        response: resA as never
      });
      registry.register({
        connectionId: idB,
        userId: "u-2",
        name: "bob",
        response: resB as never
      });

      resA.write.mockClear();
      resB.write.mockClear();

      registry.unregister(idB);

      // After unregister(idB), only resA should be notified (resB is gone).
      expect(resA.write).toHaveBeenCalledTimes(1);
      const call = resA.write.mock.calls[0]![0] as string;
      const parsed = JSON.parse(call.match(/data: (.+)/)?.[1] ?? "{}") as { count: number };
      expect(parsed.count).toBe(1);
    });
  });

  describe("broadcastAllocationChanged", () => {
    it("pushes a scheduler.allocation.changed event with the correct payload", () => {
      const registry = new SchedulerPresenceRegistry();
      const res = makeMockResponse();
      registry.register({
        connectionId: registry.allocateId(),
        userId: "u-1",
        name: "alice",
        response: res as never
      });

      res.write.mockClear();

      registry.broadcastAllocationChanged({
        changedBy: { userId: "u-2", name: "bob" },
        projectId: "proj-1",
        date: "2026-09-01",
        targetType: "WORKER",
        action: "upsert"
      });

      expect(res.write).toHaveBeenCalledTimes(1);
      const payload = res.write.mock.calls[0]![0] as string;
      expect(payload).toContain("event: scheduler.allocation.changed");
      const data = JSON.parse(payload.match(/data: (.+)/)?.[1] ?? "{}") as {
        changedBy: { name: string };
        projectId: string;
        action: string;
      };
      expect(data.changedBy.name).toBe("bob");
      expect(data.projectId).toBe("proj-1");
      expect(data.action).toBe("upsert");
    });
  });
});
