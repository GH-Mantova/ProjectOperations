import request from "supertest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../../src/app.module";

// Table-driven permission boundary tests. Run against a seeded DB with the
// viewer@projectops.local user (Viewer role — all .view, nothing else).
//
// DENY table  — viewer JWT must receive 403 (guard rejects, not auth failure).
// ALLOW table — viewer JWT must receive 200 (proves 403s come from permission
//               checks, not a broken account or expired token).
//
// Extension point: future PRs append rows to the tables, not new spec files.

interface DenyRow {
  name: string;
  method: "DELETE" | "POST" | "PATCH" | "GET";
  path: string | (() => string);
  body?: Record<string, unknown>;
  permission: string;
}

interface AllowRow {
  name: string;
  path: string | (() => string);
}

describe("Canonical CP-18 — user without permission gets 403", () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;
  let seededSiteId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const adminRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "admin@projectops.local", password: "Password123!" });
    expect([200, 201]).toContain(adminRes.status);
    adminToken = adminRes.body.accessToken as string;

    const viewerRes = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "viewer@projectops.local", password: "Password123!" });
    expect([200, 201]).toContain(viewerRes.status);
    viewerToken = viewerRes.body.accessToken as string;

    // Resolve a real site id via admin JWT so the DELETE path is concrete.
    const sitesRes = await request(app.getHttpServer())
      .get("/api/v1/master-data/sites")
      .set("Authorization", `Bearer ${adminToken}`);
    seededSiteId = (sitesRes.body.items?.[0]?.id as string | undefined) ?? "unknown";
  });

  afterAll(async () => {
    await app.close();
  });

  // ── DENY TABLE ──────────────────────────────────────────────────────────────
  // Viewer must receive 403. 403 fires before any DB mutation, so these are safe.

  const DENY_TABLE: DenyRow[] = [
    {
      name: "DELETE /master-data/sites/:id — masterdata.manage required",
      method: "DELETE",
      // Path resolved at test time via seededSiteId — 403 fires before deletion.
      path: () => `/api/v1/master-data/sites/${seededSiteId}`,
      permission: "masterdata.manage"
    },
    {
      name: "POST /tenders — tenders.manage required",
      method: "POST",
      path: "/api/v1/tenders",
      body: { name: "CP-18 probe tender", status: "DRAFT" },
      permission: "tenders.manage"
    },
    {
      name: "GET /admin/settings/notifications — platform.admin required",
      method: "GET",
      path: "/api/v1/admin/settings/notifications",
      permission: "platform.admin"
    }
  ];

  it.each(DENY_TABLE)("DENY: $name", async ({ method, path, body }) => {
    const resolvedPath = typeof path === "function" ? path() : path;
    const req = request(app.getHttpServer())
      [method.toLowerCase() as "delete" | "post" | "get"](resolvedPath)
      .set("Authorization", `Bearer ${viewerToken}`);

    if (body) req.send(body);

    const res = await req;

    // 403 = permission check fired on a valid JWT. If this fails with 401, the
    // guard is mis-ordered (auth check supersedes permission check on a valid
    // token) — that is a real finding; escalate pr-150-guard-returns-401.md.
    expect(res.status).toBe(403);
  });

  // ── ALLOW TABLE ─────────────────────────────────────────────────────────────
  // Viewer must receive 200 — confirms .view permissions are correctly granted.

  const ALLOW_TABLE: AllowRow[] = [
    { name: "GET /master-data/sites — masterdata.view granted", path: "/api/v1/master-data/sites" },
    { name: "GET /tenders — tenders.view granted", path: "/api/v1/tenders" }
  ];

  it.each(ALLOW_TABLE)("ALLOW: $name", async ({ path }) => {
    const resolvedPath = typeof path === "function" ? path() : path;
    const res = await request(app.getHttpServer())
      .get(resolvedPath)
      .set("Authorization", `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
  });

  // ── DOCUMENTS ACCESS (F2-02, partial) ───────────────────────────────────────
  // Viewer has documents.view — the site-documents rollup must return 200.
  // The full F2-02 finding (filtering for users LACKING documents.view) is parked.

  it("ALLOW: GET /documents/sites/:id/documents — documents.view granted to viewer", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/documents/sites/${seededSiteId}/documents?skip=0&take=10`)
      .set("Authorization", `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe("number");
  });

  test.todo(
    "F2-02: user lacking documents.view sees filtered rollup (parked — needs a no-docs-view user fixture)"
  );
});
