import { Test } from "@nestjs/testing";
import type { Response } from "express";
import { HealthController, VersionController } from "./health.controller";
import { HealthService } from "./health.service";
import { PrismaService } from "../prisma/prisma.service";

async function buildController(prismaMock: { $queryRaw: jest.Mock }) {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [HealthService, { provide: PrismaService, useValue: prismaMock }]
  }).compile();

  return moduleRef.get(HealthController);
}

describe("HealthController", () => {
  const originalGitSha = process.env.GIT_SHA;

  afterEach(() => {
    jest.useRealTimers();
    if (originalGitSha === undefined) {
      delete process.env.GIT_SHA;
    } else {
      process.env.GIT_SHA = originalGitSha;
    }
  });

  it("returns ok with db up when the DB probe succeeds", async () => {
    delete process.env.GIT_SHA;
    const controller = await buildController({ $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) });

    const result = await controller.getHealth();

    expect(result.status).toBe("ok");
    expect(result.service).toBe("project-operations-api");
    expect(result.db).toBe("up");
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(result.commit).toBe("unknown");
    expect(typeof result.uptimeSec).toBe("number");
    expect(typeof result.timestamp).toBe("string");
  });

  it("reads the commit from GIT_SHA when present", async () => {
    process.env.GIT_SHA = "abc1234";
    const controller = await buildController({ $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) });

    const result = await controller.getHealth();

    expect(result.commit).toBe("abc1234");
  });

  it("returns degraded with db down when the DB probe rejects", async () => {
    const controller = await buildController({ $queryRaw: jest.fn().mockRejectedValue(new Error("connection refused")) });

    const result = await controller.getHealth();

    expect(result.status).toBe("degraded");
    expect(result.db).toBe("down");
  });

  it("returns degraded when the DB probe hangs past the 2s timeout", async () => {
    jest.useFakeTimers();
    const controller = await buildController({ $queryRaw: jest.fn().mockReturnValue(new Promise(() => undefined)) });

    const resultPromise = controller.getHealth();
    await jest.advanceTimersByTimeAsync(2000);
    const result = await resultPromise;

    expect(result.status).toBe("degraded");
    expect(result.db).toBe("down");
  });

  it("readiness returns the report with no status override when the DB is up", async () => {
    const controller = await buildController({ $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) });
    const res = { status: jest.fn() } as unknown as Response;

    const result = await controller.getReadiness(res);

    expect(result.status).toBe("ok");
    expect(result.db).toBe("up");
    expect(res.status).not.toHaveBeenCalled();
  });

  it("readiness sets 503 with the degraded report when the DB is down", async () => {
    const controller = await buildController({ $queryRaw: jest.fn().mockRejectedValue(new Error("connection refused")) });
    const res = { status: jest.fn() } as unknown as Response;

    const result = await controller.getReadiness(res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(result.status).toBe("degraded");
    expect(result.db).toBe("down");
  });
});

describe("VersionController", () => {
  const originalGitSha = process.env.GIT_SHA;

  afterEach(() => {
    if (originalGitSha === undefined) {
      delete process.env.GIT_SHA;
    } else {
      process.env.GIT_SHA = originalGitSha;
    }
  });

  async function buildVersionController() {
    const moduleRef = await Test.createTestingModule({
      controllers: [VersionController],
      providers: [
        HealthService,
        { provide: PrismaService, useValue: { $queryRaw: jest.fn() } }
      ]
    }).compile();
    return moduleRef.get(VersionController);
  }

  it("reports the GIT_SHA commit and a stable service identity", async () => {
    process.env.GIT_SHA = "deadbee";
    const controller = await buildVersionController();

    const result = controller.getVersion();

    expect(result.service).toBe("project-operations-api");
    expect(result.commit).toBe("deadbee");
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(typeof result.builtAt).toBe("string");
  });

  it("falls back to 'unknown' when GIT_SHA is unset", async () => {
    delete process.env.GIT_SHA;
    const controller = await buildVersionController();

    expect(controller.getVersion().commit).toBe("unknown");
  });
});
