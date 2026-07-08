import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../../app.module";

// Regression for the /workers/:id vs /workers/leaves (and /workers/unavailability)
// route-order shadowing. Two controllers mount on the same @Controller("workers")
// base path; if WorkersController (@Get(":id")) registers before
// WorkerAvailabilityController (@Get("leaves"), @Get("unavailability")), Express
// matches the wildcard first and returns 404 "Worker not found." for both
// single-segment static routes. Fixed in workers.module.ts by listing
// WorkerAvailabilityController first.
//
// This spec asserts the STATIC routes reach their intended handler (200 with an
// array body) rather than the getById 404. It fails against the previous
// controller order and passes with the fix.

describe("Workers route order — static routes must not be shadowed by /workers/:id", () => {
  let app: INestApplication;
  let adminToken: string;

  const login = async (email: string) => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password: "Password123!" });
    expect([200, 201]).toContain(res.status);
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    adminToken = await login("admin@projectops.local");
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /workers/leaves returns 200 with an array (not 404 from getById)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/workers/leaves")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body?.message).not.toBe("Worker not found.");
  });

  it("GET /workers/unavailability returns 200 with an array (not 404 from getById)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/workers/unavailability")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body?.message).not.toBe("Worker not found.");
  });

  it("GET /workers/availability/overlay is not affected (two-segment path)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/workers/availability/overlay")
      .query({ from: "2026-07-01T00:00:00.000Z", to: "2026-07-31T23:59:59.000Z" })
      .set("Authorization", `Bearer ${adminToken}`);

    // Handler admits the request — accept 200 or 400 (validation) but never 404
    // via the getById wildcard, which would be the shadowing failure mode.
    expect(res.status).not.toBe(404);
  });

  it("GET /workers/:id still works for a genuine unknown id (404 body semantics preserved)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/workers/route-order-guard-nonexistent-id")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body?.message).toBe("Worker not found.");
  });
});
