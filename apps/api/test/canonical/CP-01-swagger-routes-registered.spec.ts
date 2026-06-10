import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../../src/app.module";

// Routes already missing an @ApiOperation summary when this canonical check
// was introduced (94 at time of writing — see
// docs/pr-prompts/needs-marco/pr-148-swagger-coverage-gaps.md). Do NOT add to
// this list — fix the decorators instead. Burn-down is Phase 4 of the
// canonical suite (docs/pr-test-audit/2026-06-10/canonical-suite.md).
const KNOWN_GAPS: string[] = [
  "GET /api/v1/tenders/{tenderId}/quotes/{quoteId}/cost-lines",
  "POST /api/v1/tenders/{tenderId}/quotes/{quoteId}/cost-lines",
  "PATCH /api/v1/tenders/{tenderId}/quotes/{quoteId}/cost-lines/{lineId}",
  "DELETE /api/v1/tenders/{tenderId}/quotes/{quoteId}/cost-lines/{lineId}",
  "POST /api/v1/tenders/{tenderId}/quotes/{quoteId}/cost-lines/reorder",
  "GET /api/v1/tenders/{tenderId}/quotes/{quoteId}/provisional-lines",
  "POST /api/v1/tenders/{tenderId}/quotes/{quoteId}/provisional-lines",
  "PATCH /api/v1/tenders/{tenderId}/quotes/{quoteId}/provisional-lines/{lineId}",
  "DELETE /api/v1/tenders/{tenderId}/quotes/{quoteId}/provisional-lines/{lineId}",
  "GET /api/v1/tenders/{tenderId}/quotes/{quoteId}/cost-options",
  "POST /api/v1/tenders/{tenderId}/quotes/{quoteId}/cost-options",
  "PATCH /api/v1/tenders/{tenderId}/quotes/{quoteId}/cost-options/{lineId}",
  "DELETE /api/v1/tenders/{tenderId}/quotes/{quoteId}/cost-options/{lineId}",
  "GET /api/v1/tenders/{tenderId}/quotes/{quoteId}/assumptions",
  "POST /api/v1/tenders/{tenderId}/quotes/{quoteId}/assumptions",
  "PATCH /api/v1/tenders/{tenderId}/quotes/{quoteId}/assumptions/{id}",
  "DELETE /api/v1/tenders/{tenderId}/quotes/{quoteId}/assumptions/{id}",
  "POST /api/v1/tenders/{tenderId}/quotes/{quoteId}/assumptions/copy-from-tender",
  "GET /api/v1/tenders/{tenderId}/quotes/{quoteId}/exclusions",
  "POST /api/v1/tenders/{tenderId}/quotes/{quoteId}/exclusions",
  "PATCH /api/v1/tenders/{tenderId}/quotes/{quoteId}/exclusions/{id}",
  "DELETE /api/v1/tenders/{tenderId}/quotes/{quoteId}/exclusions/{id}",
  "POST /api/v1/tenders/{tenderId}/quotes/{quoteId}/exclusions/copy-from-tender",
  "GET /api/v1/tenders/{tenderId}/quotes/{quoteId}/scope-items",
  "POST /api/v1/tenders/{tenderId}/quotes/{quoteId}/scope-items",
  "PATCH /api/v1/tenders/{tenderId}/quotes/{quoteId}/scope-items/{itemId}",
  "DELETE /api/v1/tenders/{tenderId}/quotes/{quoteId}/scope-items/{itemId}",
  "POST /api/v1/tenders/{tenderId}/quotes/{quoteId}/scope-items/reorder",
  "GET /api/v1/master-data/clients",
  "POST /api/v1/master-data/clients",
  "PATCH /api/v1/master-data/clients/{id}",
  "GET /api/v1/master-data/contacts",
  "POST /api/v1/master-data/contacts",
  "PATCH /api/v1/master-data/contacts/{id}",
  "GET /api/v1/master-data/sites",
  "POST /api/v1/master-data/sites",
  "PATCH /api/v1/master-data/sites/{id}",
  "GET /api/v1/master-data/resource-types",
  "POST /api/v1/master-data/resource-types",
  "PATCH /api/v1/master-data/resource-types/{id}",
  "GET /api/v1/master-data/competencies",
  "POST /api/v1/master-data/competencies",
  "PATCH /api/v1/master-data/competencies/{id}",
  "GET /api/v1/master-data/workers",
  "POST /api/v1/master-data/workers",
  "PATCH /api/v1/master-data/workers/{id}",
  "GET /api/v1/master-data/crews",
  "POST /api/v1/master-data/crews",
  "PATCH /api/v1/master-data/crews/{id}",
  "GET /api/v1/master-data/assets",
  "POST /api/v1/master-data/assets",
  "PATCH /api/v1/master-data/assets/{id}",
  "GET /api/v1/master-data/worker-competencies",
  "POST /api/v1/master-data/worker-competencies",
  "PATCH /api/v1/master-data/worker-competencies/{id}",
  "GET /api/v1/master-data/lookup-values",
  "POST /api/v1/master-data/lookup-values",
  "PATCH /api/v1/master-data/lookup-values/{id}",
  "POST /api/v1/directory/{id}/contacts",
  "PATCH /api/v1/directory/{id}/contacts/{contactId}",
  "DELETE /api/v1/directory/{id}/contacts/{contactId}",
  "POST /api/v1/directory/{id}/licences",
  "PATCH /api/v1/directory/{id}/licences/{licenceId}",
  "DELETE /api/v1/directory/{id}/licences/{licenceId}",
  "POST /api/v1/directory/{id}/insurances",
  "PATCH /api/v1/directory/{id}/insurances/{insuranceId}",
  "DELETE /api/v1/directory/{id}/insurances/{insuranceId}",
  "POST /api/v1/directory/{id}/credit-applications",
  "PATCH /api/v1/directory/{id}/credit-applications/{appId}",
  "POST /api/v1/directory/{id}/documents",
  "PATCH /api/v1/directory/{id}/documents/{docId}",
  "DELETE /api/v1/directory/{id}/documents/{docId}",
  "POST /api/v1/clients/{clientId}/licences",
  "PATCH /api/v1/clients/{clientId}/licences/{licenceId}",
  "DELETE /api/v1/clients/{clientId}/licences/{licenceId}",
  "POST /api/v1/clients/{clientId}/insurances",
  "PATCH /api/v1/clients/{clientId}/insurances/{insuranceId}",
  "DELETE /api/v1/clients/{clientId}/insurances/{insuranceId}",
  "POST /api/v1/clients/{clientId}/credit-applications",
  "PATCH /api/v1/clients/{clientId}/credit-applications/{appId}",
  "GET /api/v1/compliance/workers/{workerProfileId}/qualifications",
  "POST /api/v1/compliance/workers/{workerProfileId}/qualifications",
  "PATCH /api/v1/compliance/workers/{workerProfileId}/qualifications/{qualId}",
  "DELETE /api/v1/compliance/workers/{workerProfileId}/qualifications/{qualId}",
  "GET /api/v1/safety/incidents",
  "POST /api/v1/safety/incidents",
  "GET /api/v1/safety/incidents/{id}",
  "PATCH /api/v1/safety/incidents/{id}",
  "POST /api/v1/safety/incidents/{id}/close",
  "GET /api/v1/safety/hazards",
  "POST /api/v1/safety/hazards",
  "GET /api/v1/safety/hazards/{id}",
  "PATCH /api/v1/safety/hazards/{id}",
  "POST /api/v1/safety/hazards/{id}/close"
];

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
