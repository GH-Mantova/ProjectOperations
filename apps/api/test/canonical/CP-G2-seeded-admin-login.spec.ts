import request from "supertest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../../src/app.module";

describe("Canonical CP-G2 — seeded admin can authenticate", () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Assumes the DB has been seeded with `pnpm seed` before this test runs.
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /api/v1/auth/login with seeded admin credentials returns a JWT", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: "admin@projectops.local",
        password: "Password123!"
      });

    expect([200, 201]).toContain(res.status);
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.accessToken.split(".").length).toBe(3);
    expect(res.body.user?.email).toBe("admin@projectops.local");
  });

  it("POST /api/v1/auth/login with wrong password returns 401", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: "admin@projectops.local",
        password: "wrong-password"
      });

    expect(res.status).toBe(401);
  });
});
