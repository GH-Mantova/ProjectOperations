import request, { Response } from "supertest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../../src/app.module";

// Table-driven response-shape checks for key GET endpoints, run as the seeded
// admin against a seeded DB. This table is the extension point for the
// canonical suite: future PRs APPEND rows to SHAPE_TABLE (or add a follow-up
// request inside an existing row's assert) instead of writing new spec files.
// Keep one row per endpoint; resolve dynamic ids inside the assert function.

interface ShapeRow {
  name: string;
  path: string;
  assert: (res: Response, ctx: { get: (path: string) => Promise<Response> }) => Promise<void> | void;
}

const SHAPE_TABLE: ShapeRow[] = [
  {
    name: "Sites list returns paginated items (seed has 8 sites)",
    path: "/api/v1/master-data/sites",
    assert: (res) => {
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      expect(typeof res.body.total).toBe("number");
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    }
  },
  {
    name: "Site documents rollup returns { items, total } and accepts skip/take",
    path: "/api/v1/master-data/sites",
    assert: async (res, ctx) => {
      expect(res.status).toBe(200);
      const siteId = res.body.items[0]?.id as string | undefined;
      expect(typeof siteId).toBe("string");
      // Rollup endpoint lives in the documents module (PR #343), not master-data.
      const rollup = await ctx.get(`/api/v1/documents/sites/${siteId}/documents?skip=0&take=10`);
      expect(rollup.status).toBe(200);
      expect(Array.isArray(rollup.body.items)).toBe(true);
      expect(typeof rollup.body.total).toBe("number");
    }
  },
  {
    name: "Clients list returns at least one seeded client",
    path: "/api/v1/master-data/clients",
    assert: (res) => {
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    }
  },
  {
    name: "Tenders list contains the seeded T260520-ACME-Rev1 tender",
    path: "/api/v1/tenders?q=T260520-ACME-Rev1",
    assert: (res) => {
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      const numbers = res.body.items.map((t: { tenderNumber: string }) => t.tenderNumber);
      expect(numbers).toContain("T260520-ACME-Rev1");
    }
  },
  {
    name: "Jobs list uses canonical J{YYMMDD}-{SLUG}-{NNN} job numbers (G5, supersedes F1E-01 / PR #339)",
    path: "/api/v1/jobs",
    assert: (res) => {
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      const offenders = res.body.items
        .map((j: { jobNumber: string }) => j.jobNumber)
        .filter((n: string) => !/^J\d{6}-[A-Z0-9]{1,4}-\d{3,}(-\d+)?$/.test(n));
      expect(offenders).toEqual([]);
    }
  },
  {
    name: "Tenders list uses canonical T{YYMMDD}-{SLUG}-Rev{N} tender numbers (G5)",
    path: "/api/v1/tenders?page=1&pageSize=100",
    assert: (res) => {
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      const offenders = res.body.items
        .map((t: { tenderNumber: string }) => t.tenderNumber)
        .filter((n: string) => !/^T\d{6}-[A-Z0-9]{1,4}-Rev\d+(-\d+)?$/.test(n));
      expect(offenders).toEqual([]);
    }
  }
];

describe("Canonical CP-21 — GET endpoints return their expected JSON shape", () => {
  let app: INestApplication;
  let accessToken: string;

  const get = async (path: string) =>
    request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);

  beforeAll(async () => {
    // Assumes the DB has been seeded with `pnpm seed` before this test runs.
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const login = await request(app.getHttpServer()).post("/api/v1/auth/login").send({
      email: "admin@projectops.local",
      password: "Password123!"
    });
    expect([200, 201]).toContain(login.status);
    accessToken = login.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(SHAPE_TABLE)("$name", async ({ path, assert }) => {
    const res = await get(path);
    await assert(res, { get: async (p) => get(p) });
  });
});
