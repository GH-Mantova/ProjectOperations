import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../../app.module";

// Permission-matrix suite — live role × endpoint authorization checks against a
// seeded database. The full expected-behaviour contract (every route) lives in
// docs/security/permission-matrix.md; this spec asserts the high-value route
// groups (tenders CRUD, quotes, users admin, roles/permissions admin, master
// data writes, archive) plus one cheap deny per long-tail module.
//
// Requires `pnpm seed` (admin@projectops.local + viewer@projectops.local,
// Password123!). CI seeds before `pnpm test:api:serial`.
//
// Status semantics:
// - "pass"  → guards admitted the request: any status except 401/403.
//             Write rows use empty bodies (validation 400) or non-existent ids
//             (404) so a passing request never mutates seeded data.
// - 200/403 → exact status expected.
// - anon    → every guarded row must 401 without a token.

type Method = "get" | "post" | "patch" | "delete";

interface MatrixRow {
  group: string;
  method: Method;
  /** Path under /api/v1. Function form defers seeded-id resolution to test time. */
  path: string | (() => string);
  permission: string;
  body?: Record<string, unknown>;
  /** Expected outcome for the Viewer role (17 seeded `.view` permissions, nothing else). */
  viewer: 200 | 403 | "pass";
  /** When true, also assert the Admin role passes both guards. */
  admin?: boolean;
}

const MISSING = "pm-missing-id";

let seededTenderId = MISSING;

const ROWS: MatrixRow[] = [
  // ── Tenders CRUD ──────────────────────────────────────────────────────────
  { group: "tenders", method: "get", path: "/tenders", permission: "tenders.view", viewer: 200, admin: true },
  { group: "tenders", method: "post", path: "/tenders", permission: "tenders.manage", body: {}, viewer: 403, admin: true },
  { group: "tenders", method: "patch", path: `/tenders/${MISSING}`, permission: "tenders.manage", body: {}, viewer: 403, admin: true },
  { group: "tenders", method: "delete", path: `/tenders/${MISSING}`, permission: "tenders.manage", viewer: 403, admin: true },
  { group: "tenders", method: "patch", path: `/tenders/${MISSING}/status`, permission: "tenders.manage", body: {}, viewer: 403, admin: true },

  // ── Client quotes ─────────────────────────────────────────────────────────
  { group: "quotes", method: "get", path: () => `/tenders/${seededTenderId}/quotes`, permission: "tenders.view", viewer: "pass", admin: true },
  { group: "quotes", method: "post", path: () => `/tenders/${seededTenderId}/quotes`, permission: "tenders.manage", body: {}, viewer: 403, admin: true },
  { group: "quotes", method: "patch", path: () => `/tenders/${seededTenderId}/quotes/${MISSING}`, permission: "tenders.manage", body: {}, viewer: 403, admin: true },
  { group: "quotes", method: "delete", path: () => `/tenders/${seededTenderId}/quotes/${MISSING}`, permission: "tenders.manage", viewer: 403, admin: true },

  // ── Users admin ───────────────────────────────────────────────────────────
  { group: "users", method: "get", path: "/users", permission: "users.view", viewer: 200, admin: true },
  { group: "users", method: "post", path: "/users", permission: "users.create", body: {}, viewer: 403, admin: true },
  { group: "users", method: "patch", path: `/users/${MISSING}`, permission: "users.update", body: {}, viewer: 403, admin: true },
  { group: "users", method: "get", path: "/admin/users", permission: "(service tier check)", viewer: 403, admin: true },
  { group: "users", method: "patch", path: `/admin/users/${MISSING}`, permission: "(service tier check)", body: {}, viewer: 403, admin: true },

  // ── Roles / permissions admin ─────────────────────────────────────────────
  { group: "roles", method: "get", path: "/roles", permission: "roles.view", viewer: 200, admin: true },
  { group: "roles", method: "post", path: "/roles", permission: "roles.create", body: {}, viewer: 403, admin: true },
  { group: "roles", method: "patch", path: `/roles/${MISSING}`, permission: "roles.update", body: {}, viewer: 403, admin: true },
  { group: "roles", method: "get", path: "/permissions", permission: "permissions.view", viewer: 200, admin: true },

  // ── Master data writes ────────────────────────────────────────────────────
  { group: "master-data", method: "get", path: "/master-data/clients", permission: "masterdata.view", viewer: 200, admin: true },
  { group: "master-data", method: "post", path: "/master-data/clients", permission: "masterdata.manage", body: {}, viewer: 403, admin: true },
  { group: "master-data", method: "patch", path: `/master-data/sites/${MISSING}`, permission: "masterdata.manage", body: {}, viewer: 403, admin: true },
  { group: "master-data", method: "delete", path: `/master-data/sites/${MISSING}`, permission: "masterdata.manage", viewer: 403, admin: true },

  // ── Archive ───────────────────────────────────────────────────────────────
  { group: "archive", method: "get", path: "/archive", permission: "jobs.view", viewer: 200, admin: true },
  { group: "archive", method: "get", path: `/archive/${MISSING}/export`, permission: "jobs.view", viewer: "pass", admin: true },

  // ── Long tail: one deny per module (viewer + anon only) ───────────────────
  { group: "long-tail", method: "post", path: "/jobs", permission: "jobs.manage", body: {}, viewer: 403 },
  { group: "long-tail", method: "post", path: "/scheduler/shifts", permission: "scheduler.manage", body: {}, viewer: 403 },
  { group: "long-tail", method: "post", path: "/contracts", permission: "finance.manage", body: {}, viewer: 403 },
  { group: "long-tail", method: "post", path: "/workers", permission: "resources.manage", body: {}, viewer: 403 },
  { group: "long-tail", method: "post", path: "/directory", permission: "directory.manage", body: {}, viewer: 403 },
  { group: "long-tail", method: "post", path: "/assets", permission: "assets.manage", body: {}, viewer: 403 },
  { group: "long-tail", method: "post", path: "/maintenance/plans", permission: "maintenance.manage", body: {}, viewer: 403 },
  { group: "long-tail", method: "post", path: "/safety/incidents", permission: "safety.manage", body: {}, viewer: 403 },
  { group: "long-tail", method: "post", path: "/forms/templates", permission: "forms.manage", body: {}, viewer: 403 },
  { group: "long-tail", method: "post", path: "/estimate-rates/labour", permission: "estimates.admin", body: {}, viewer: 403 },
  { group: "long-tail", method: "post", path: "/projects", permission: "projects.admin", body: {}, viewer: 403 },
  // PR-217 F2 fix: next-number preview was previously open to any authenticated
  // user (missed PermissionsGuard decorator). Now gated by projects.view.
  // Viewer's 17 seeded view codes intentionally exclude projects.view, so 403.
  { group: "projects", method: "get", path: "/projects/next-number", permission: "projects.view", viewer: 403, admin: true },
  { group: "long-tail", method: "patch", path: `/tenders/${MISSING}/award`, permission: "tenderconversion.manage", body: {}, viewer: 403 },
  { group: "long-tail", method: "get", path: "/admin/settings/notifications", permission: "platform.admin", viewer: 403 },
  { group: "long-tail", method: "post", path: "/documents", permission: "documents.manage", body: {}, viewer: 403 },
  { group: "long-tail", method: "post", path: "/dashboards", permission: "dashboards.manage", body: {}, viewer: 403 },
  { group: "long-tail", method: "post", path: "/notifications", permission: "notifications.manage", body: {}, viewer: 403 },
  { group: "long-tail", method: "post", path: "/sharepoint/folders/ensure", permission: "sharepoint.manage", body: {}, viewer: 403 },
  { group: "long-tail", method: "post", path: "/compliance/alerts/send-now", permission: "compliance.admin", body: {}, viewer: 403 },
  { group: "long-tail", method: "post", path: "/xero/disconnect", permission: "platform.admin", body: {}, viewer: 403 },
  // Viewer is narrowed to 17 explicit .view codes by seed-initial-services —
  // audit.view is deliberately NOT among them.
  { group: "long-tail", method: "get", path: "/audit-logs", permission: "audit.view", viewer: 403 },
];

interface MatrixCase {
  name: string;
  method: Method;
  path: string | (() => string);
  body?: Record<string, unknown>;
  who: "admin" | "viewer" | "anon";
  expected: 200 | 401 | 403 | "pass";
}

const CASES: MatrixCase[] = ROWS.flatMap((row) => {
  const label = `${row.group}: ${row.method.toUpperCase()} ${typeof row.path === "string" ? row.path : "(seeded path)"} [${row.permission}]`;
  const cases: MatrixCase[] = [
    { name: `${label} — anon → 401`, method: row.method, path: row.path, body: row.body, who: "anon", expected: 401 },
    { name: `${label} — viewer → ${row.viewer}`, method: row.method, path: row.path, body: row.body, who: "viewer", expected: row.viewer }
  ];
  if (row.admin) {
    cases.push({ name: `${label} — admin → pass`, method: row.method, path: row.path, body: row.body, who: "admin", expected: "pass" });
  }
  return cases;
});

describe("Permission matrix — role × endpoint authorization", () => {
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

    const tendersRes = await request(app.getHttpServer())
      .get("/api/v1/tenders")
      .set("Authorization", `Bearer ${adminToken}`);
    const tenders = (tendersRes.body.items ?? tendersRes.body) as Array<{ id: string }>;
    seededTenderId = tenders?.[0]?.id ?? MISSING;
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(CASES)("$name", async ({ method, path, body, who, expected }) => {
    const resolvedPath = `/api/v1${typeof path === "function" ? path() : path}`;
    let req = request(app.getHttpServer())[method](resolvedPath);
    if (who === "admin") req = req.set("Authorization", `Bearer ${adminToken}`);
    if (who === "viewer") req = req.set("Authorization", `Bearer ${viewerToken}`);
    if (body !== undefined) req = req.send(body);

    const res = await req;

    if (expected === "pass") {
      // Guards admitted the request — 400/404 from pipes/handlers is fine,
      // 401/403 means the matrix expectation is broken.
      expect([401, 403]).not.toContain(res.status);
    } else {
      expect(res.status).toBe(expected);
    }
  });

  // ── KNOWN-FAIL cells (see docs/pr-prompts/needs-marco/pr-188-authz-findings.md F1) ──
  // Global lists creation is open to any authenticated user (JwtAuthGuard only,
  // no PermissionsGuard). Asserting the read-only-Viewer expectation (403) would
  // fail today AND mutate the seeded DB, so these stay skipped until Marco
  // decides whether creation should be permission-gated.

  it.skip("KNOWN-FAIL F1: POST /lists — viewer expected 403, currently 201 (creates a global list)", () => {
    /* intentionally skipped — see pr-188-authz-findings.md */
  });

  it.skip("KNOWN-FAIL F1: POST /lists/:slug/items — viewer expected 403, currently 201 (adds an item)", () => {
    /* intentionally skipped — see pr-188-authz-findings.md */
  });
});
