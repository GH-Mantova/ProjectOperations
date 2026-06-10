import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../../src/app.module";

// Routes already missing an @ApiOperation summary when this canonical check
// was introduced (94 at time of writing — see
// docs/pr-prompts/needs-marco/pr-148-swagger-coverage-gaps.md). Do NOT add to
// this list — fix the decorators instead. Burn-down is Phase 4 of the
// canonical suite (docs/pr-test-audit/2026-06-10/canonical-suite.md).
const KNOWN_GAPS: string[] = [];

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Project Operations Platform API")
    .setDescription("Foundation API for the Project Operations Platform.")
    .setVersion("0.1.0")
    .build();
  return SwaggerModule.createDocument(app, config);
}

describe("Canonical CP-01 — Swagger registers controller routes with decorators", () => {
  let app: INestApplication;
  let document: OpenAPIObject;
  let prefix: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
    document = buildSwaggerDocument(app);

    // Path keys may or may not include the global prefix depending on Swagger
    // config — derive it from the health route instead of assuming.
    const healthKey = Object.keys(document.paths).find((p) => p.endsWith("/health"));
    if (!healthKey) throw new Error("Could not locate /health in document.paths to derive prefix");
    prefix = healthKey.slice(0, -"/health".length);
  });

  afterAll(async () => {
    await app.close();
  });

  it("every operation has a non-empty summary and at least one response (no NEW gaps)", () => {
    const gaps: string[] = [];
    for (const [path, pathItem] of Object.entries(document.paths)) {
      for (const method of HTTP_METHODS) {
        const operation = pathItem[method];
        if (!operation) continue;
        const hasSummary = typeof operation.summary === "string" && operation.summary.trim().length > 0;
        const hasResponses = Object.keys(operation.responses ?? {}).length > 0;
        if (!hasSummary || !hasResponses) gaps.push(`${method.toUpperCase()} ${path}`);
      }
    }
    const newGaps = gaps.filter((gap) => !KNOWN_GAPS.includes(gap));
    expect(newGaps).toEqual([]);

    // Stale allowlist entries mean a gap was fixed — remove them from KNOWN_GAPS.
    const staleAllowlist = KNOWN_GAPS.filter((gap) => !gaps.includes(gap));
    expect(staleAllowlist).toEqual([]);
  });

  describe("fixture-driven recent routes exist in document.paths", () => {
    const fixtures: Array<{ method: (typeof HTTP_METHODS)[number]; path: string }> = [
      { method: "get", path: "/master-data/sites/{id}" },
      { method: "delete", path: "/master-data/sites/{id}" },
      // Documents rollup lives in the documents module, not master-data (PR #343).
      { method: "get", path: "/documents/sites/{siteId}/documents" },
      { method: "get", path: "/tenders/{tenderId}/entries" },
      { method: "post", path: "/tenders/{tenderId}/entries" },
      { method: "patch", path: "/tenders/{tenderId}/entries/{entryId}" },
      { method: "delete", path: "/tenders/{tenderId}/entries/{entryId}" }
    ];

    it.each(fixtures)("$method $path is registered", ({ method, path }) => {
      const pathItem = document.paths[`${prefix}${path}`];
      expect(pathItem).toBeDefined();
      expect(pathItem[method]).toBeDefined();
    });
  });
});
