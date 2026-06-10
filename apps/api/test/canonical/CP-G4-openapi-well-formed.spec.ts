import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../../src/app.module";

// Mirrors the Swagger config in src/bootstrap/create-app.ts. Kept in sync by
// hand on purpose — extracting it would mean touching production code, which
// the canonical suite does not do.
function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Project Operations Platform API")
    .setDescription("Foundation API for the Project Operations Platform.")
    .setVersion("0.1.0")
    .build();
  return SwaggerModule.createDocument(app, config);
}

function collectRefs(node: unknown, refs: string[]): void {
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, refs);
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string") refs.push(value);
      else collectRefs(value, refs);
    }
  }
}

describe("Canonical CP-G4 — generated OpenAPI document is well-formed", () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
    document = buildSwaggerDocument(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("declares an OpenAPI 3.x version", () => {
    expect(typeof document.openapi).toBe("string");
    expect(document.openapi.startsWith("3.")).toBe(true);
  });

  it("has a non-empty info.title", () => {
    expect(typeof document.info.title).toBe("string");
    expect(document.info.title.length).toBeGreaterThan(0);
  });

  it("registers a substantial number of paths (> 50)", () => {
    expect(Object.keys(document.paths).length).toBeGreaterThan(50);
  });

  it("is JSON-serializable without cycles", () => {
    expect(() => JSON.parse(JSON.stringify(document))).not.toThrow();
  });

  it("every $ref points into #/components/ and resolves to a declared schema", () => {
    const serialized = JSON.parse(JSON.stringify(document)) as OpenAPIObject;
    const refs: string[] = [];
    collectRefs(serialized, refs);
    expect(refs.length).toBeGreaterThan(0);

    const schemas = serialized.components?.schemas ?? {};
    const unresolved: string[] = [];
    for (const ref of refs) {
      expect(ref).toMatch(/^#\/components\//);
      const schemaMatch = ref.match(/^#\/components\/schemas\/(.+)$/);
      if (schemaMatch && !(schemaMatch[1] in schemas)) unresolved.push(ref);
    }
    expect(unresolved).toEqual([]);
  });
});
