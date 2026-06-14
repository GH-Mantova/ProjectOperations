import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";
import { ApiExceptionFilter } from "../../common/filters/api-exception.filter";
import {
  AUTH_THROTTLE_ERROR_MESSAGE,
  authThrottleLoginLimit,
  authThrottleTracker,
  authThrottleTtlMs
} from "./auth-throttle.config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

const THROTTLE_ENV = ["AUTH_THROTTLE_LIMIT", "AUTH_THROTTLE_TTL", "AUTH_THROTTLE_REFRESH_LIMIT"] as const;

describe("Auth throttling", () => {
  let app: INestApplication;
  const originalEnv: Partial<Record<(typeof THROTTLE_ENV)[number], string | undefined>> = {};

  const authService = {
    login: jest.fn().mockResolvedValue({ accessToken: "a", refreshToken: "r", user: { id: "user-1" } }),
    refresh: jest.fn().mockResolvedValue({ accessToken: "a", refreshToken: "r", user: { id: "user-1" } }),
    loginWithEntra: jest.fn(),
    loginWithSso: jest.fn(),
    resetPassword: jest.fn(),
    getLoginConfiguration: jest.fn().mockReturnValue({ mode: "local" }),
    me: jest.fn()
  };

  beforeAll(async () => {
    for (const key of THROTTLE_ENV) {
      originalEnv[key] = process.env[key];
    }
    process.env.AUTH_THROTTLE_LIMIT = "3";
    process.env.AUTH_THROTTLE_TTL = "60";
    process.env.AUTH_THROTTLE_REFRESH_LIMIT = "5";

    const moduleRef = await Test.createTestingModule({
      imports: [
        // Mirrors the ThrottlerModule registration in AuthModule.
        ThrottlerModule.forRoot({
          throttlers: [{ ttl: authThrottleTtlMs, limit: authThrottleLoginLimit }],
          errorMessage: AUTH_THROTTLE_ERROR_MESSAGE,
          getTracker: (req) => authThrottleTracker(req)
        })
      ],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
        { provide: ConfigService, useValue: { get: (_: string, fallback?: unknown) => fallback } }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    for (const key of THROTTLE_ENV) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
    await app.close();
  });

  it("returns 429 with Retry-After and the API error shape once the login limit is exceeded", async () => {
    const credentials = { email: "admin@projectops.local", password: "Password123!" };

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await request(app.getHttpServer()).post("/auth/login").send(credentials).expect(201);
    }

    const blocked = await request(app.getHttpServer()).post("/auth/login").send(credentials).expect(429);

    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
    expect(blocked.body).toMatchObject({
      statusCode: 429,
      message: AUTH_THROTTLE_ERROR_MESSAGE
    });
    expect(blocked.body.path).toBe("/auth/login");
    expect(authService.login).toHaveBeenCalledTimes(3);
  });

  it("keeps refresh on its own bucket — unaffected by an exhausted login bucket", async () => {
    // The login bucket is already exhausted by the previous test.
    await request(app.getHttpServer()).post("/auth/login").send({ email: "a@b.c", password: "x" }).expect(429);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({ refreshToken: "refresh-token-value" })
        .expect(201);
    }

    const blocked = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: "refresh-token-value" })
      .expect(429);
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("does not throttle GET /auth/config", async () => {
    for (let attempt = 1; attempt <= 10; attempt += 1) {
      await request(app.getHttpServer()).get("/auth/config").expect(200);
    }
  });
});
