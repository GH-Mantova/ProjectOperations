import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../../app.module";

// Perimeter check for /workers/leave-requests/*.
//
// The manager approvals surface hits three protected routes:
//   GET   /workers/leave-requests/pending
//   GET   /workers/leave-requests/org-chart
//   PATCH /workers/leave-requests/:id/decide
//
// All three are declared with @RequirePermissions("workers.manage") on
// leave-request.controller.ts. This spec locks the gate: the viewer seed
// user (viewer@projectops.local, viewer role) must receive 403 on each
// route, and the admin seed user must NOT.
//
// The web page reads this gate via a NoAccess render before it fetches, but
// defence-in-depth (SoT law) requires the server to reject too.

describe("LeaveRequest controller — workers.manage perimeter", () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;

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
    viewerToken = await login("viewer@projectops.local");
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /workers/leave-requests/pending returns 403 for a viewer without workers.manage", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/workers/leave-requests/pending")
      .set("Authorization", `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });

  it("GET /workers/leave-requests/org-chart returns 403 for a viewer without workers.manage", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/workers/leave-requests/org-chart")
      .set("Authorization", `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
  });

  it("PATCH /workers/leave-requests/:id/decide returns 403 for a viewer without workers.manage", async () => {
    const res = await request(app.getHttpServer())
      .patch("/api/v1/workers/leave-requests/perm-guard-nonexistent/decide")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ decision: "APPROVED" });

    // The guard must reject before the handler runs — so we expect 403,
    // NOT the 404 the service would emit if the id lookup were reached.
    expect(res.status).toBe(403);
  });

  it("GET /workers/leave-requests/pending returns 200 for an admin (holds workers.manage)", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/workers/leave-requests/pending")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
