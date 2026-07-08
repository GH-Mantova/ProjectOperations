import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../../app.module";

// Generic route-shadowing guard. Boots the full AppModule and walks the live
// Express router to detect any parameterized route that swallows a later static
// sibling. Registration order == Express match priority, so if an earlier
// `/foo/:id` matches a later `/foo/bar`, the request never reaches the intended
// handler.
//
// The workers.module.ts reorder (WorkerAvailabilityController before
// WorkersController) fixed the concrete instance that surfaced in PR #503's
// dashboard widgets #2 (Who's away) and #3 (Leave pending). This spec is the
// "never again" — any NEW shadowing added anywhere in the API will fail
// test:api:serial before it hits production.
//
// If the guard surfaces pre-existing offenders elsewhere in the API on a first
// green run, they are added to KNOWN_SHADOWED (append-only-with-justification)
// and listed in docs/pr-prompts/needs-marco/route-shadowing-findings.md.

// Express 5 exposes each route layer's compiled matcher as an array of
// `(path: string) => false | { params, path }` functions. Registration order
// is preserved on `router.stack`.
type Matcher = (input: string) => false | { path: string };

interface RouteEntry {
  method: string;
  path: string;
  matchers: Matcher[];
  index: number;
}

function isParameterized(path: string): boolean {
  return /:\w/.test(path);
}

function collectRoutes(app: INestApplication): RouteEntry[] {
  const instance = app.getHttpAdapter().getInstance() as {
    _router?: { stack: unknown[] };
    router?: { stack: unknown[] };
  };
  const rootStack = instance.router?.stack ?? instance._router?.stack;
  if (!rootStack) {
    throw new Error(
      "route-shadowing guard: unable to locate Express router stack on the Nest HTTP adapter"
    );
  }

  const routes: RouteEntry[] = [];
  let index = 0;

  const walk = (stack: unknown[]): void => {
    for (const raw of stack) {
      const layer = raw as {
        route?: {
          path: string | string[];
          methods?: Record<string, boolean>;
          stack?: Array<{ method?: string }>;
        };
        matchers?: Matcher[];
        name?: string;
        handle?: { stack?: unknown[] };
      };
      if (layer.route && layer.matchers && layer.matchers.length > 0) {
        const paths = Array.isArray(layer.route.path)
          ? layer.route.path
          : [layer.route.path];
        const methods = layer.route.methods
          ? Object.keys(layer.route.methods).filter((m) => layer.route!.methods![m])
          : (layer.route.stack ?? [])
              .map((h) => h.method)
              .filter((m): m is string => typeof m === "string");
        for (const p of paths) {
          for (const m of methods) {
            routes.push({
              method: m.toLowerCase(),
              path: p,
              matchers: layer.matchers,
              index: index++
            });
          }
        }
      } else if (layer.name === "router" && layer.handle?.stack) {
        walk(layer.handle.stack);
      }
    }
  };

  walk(rootStack);
  return routes;
}

// Baseline of pre-existing shadowed routes, keyed by `"<METHOD> <path>"`.
// After the workers reorder this MUST be empty. If any pre-existing offender
// surfaces, add it here with a justification comment and list it in
// docs/pr-prompts/needs-marco/route-shadowing-findings.md.
const KNOWN_SHADOWED = new Set<string>([]);

describe("Route shadowing guard — parameterized routes must not shadow later static siblings", () => {
  let app: INestApplication;
  let routes: RouteEntry[];

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();

    routes = collectRoutes(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("enumerates at least one route (sanity: router introspection succeeded)", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it("no earlier :param route swallows a later static sibling (per HTTP method)", () => {
    const shadowed: string[] = [];

    const byMethod = new Map<string, RouteEntry[]>();
    for (const r of routes) {
      if (!byMethod.has(r.method)) byMethod.set(r.method, []);
      byMethod.get(r.method)!.push(r);
    }

    for (const [, group] of byMethod) {
      group.sort((a, b) => a.index - b.index);
      for (let i = 0; i < group.length; i++) {
        const earlier = group[i];
        if (!isParameterized(earlier.path)) continue;
        for (let j = i + 1; j < group.length; j++) {
          const later = group[j];
          if (earlier.path === later.path) continue;
          // Only flag when a STATIC later sibling is being swallowed by an
          // earlier :param route. Two parameterized routes with overlapping
          // shapes are benign — Express falls through to the next handler.
          if (isParameterized(later.path)) continue;
          const match = earlier.matchers[0](later.path);
          if (match === false) continue;
          const key = `${later.method.toUpperCase()} ${later.path}`;
          if (KNOWN_SHADOWED.has(key)) continue;
          shadowed.push(
            `${key} is shadowed by earlier ${earlier.method.toUpperCase()} ${earlier.path}`
          );
        }
      }
    }

    expect(shadowed).toEqual([]);
  });
});
