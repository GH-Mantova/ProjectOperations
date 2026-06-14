import request from "supertest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../../src/app.module";

describe("Canonical CP-G1 — /health liveness", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/health returns 200 with enriched body", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      service: "project-operations-api",
      db: "up"
    });
    expect(typeof res.body.version).toBe("string");
    expect(typeof res.body.commit).toBe("string");
    expect(typeof res.body.uptimeSec).toBe("number");
    expect(typeof res.body.timestamp).toBe("string");
  });

  it("GET /api/v1/health/ready returns 200 when the database is reachable", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/health/ready");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", db: "up" });
  });
});
