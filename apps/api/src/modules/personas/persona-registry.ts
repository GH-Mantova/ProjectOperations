import type { PersonaDefinition, PersonaRouteMatch, PersonaSubMode } from "./personas.types";
import { tenderingPersona } from "./definitions/tendering.persona";

const PERSONAS: readonly PersonaDefinition[] = Object.freeze([tenderingPersona]);

export function getAllPersonas(): readonly PersonaDefinition[] {
  return PERSONAS;
}

export function getPersonaBySlug(slug: string): PersonaDefinition | undefined {
  return PERSONAS.find((p) => p.slug === slug);
}

// Strip query string + hash, normalise trailing slash (except for root "/")
function normaliseRoute(route: string): string {
  const queryless = route.split("?", 1)[0]!.split("#", 1)[0]!;
  if (queryless === "/" || queryless === "") return queryless || "/";
  return queryless.endsWith("/") ? queryless.slice(0, -1) : queryless;
}

// Match a route pattern (with :param placeholders) against a concrete path.
// Returns true if it matches — does not extract params (we don't need them here).
function patternMatches(pattern: string, path: string): boolean {
  const normalisedPattern = normaliseRoute(pattern);
  const normalisedPath = normaliseRoute(path);

  const patternParts = normalisedPattern.split("/").filter((p) => p.length > 0);
  const pathParts = normalisedPath.split("/").filter((p) => p.length > 0);

  if (patternParts.length !== pathParts.length) return false;

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i]!;
    const pathPart = pathParts[i]!;
    if (patternPart.startsWith(":")) {
      // Param matches any single non-empty segment
      if (pathPart.length === 0) return false;
      continue;
    }
    if (patternPart !== pathPart) return false;
  }
  return true;
}

// "Specificity" for picking the best match when multiple sub-modes match a route.
// Longer patterns win; when same length, fewer :params wins.
function specificity(pattern: string): number {
  const parts = pattern.split("/").filter((p) => p.length > 0);
  const literalCount = parts.filter((p) => !p.startsWith(":")).length;
  return parts.length * 100 + literalCount;
}

function rootMatches(pattern: string, path: string): boolean {
  // Root pattern is a prefix match: "/tenders" matches "/tenders" and any "/tenders/..."
  const normalisedPattern = normaliseRoute(pattern);
  const normalisedPath = normaliseRoute(path);
  if (normalisedPath === normalisedPattern) return true;
  return normalisedPath.startsWith(normalisedPattern + "/");
}

// Exact-match check (trailing-slash tolerant) for excluded routes. Operates
// on the bare pathname — query string is stripped before this is called —
// so adding `?detail=...` cannot bypass the exclusion.
function isExcludedRoute(routes: string[] | undefined, barePath: string): boolean {
  if (!routes || routes.length === 0) return false;
  const normalised = normaliseRoute(barePath);
  return routes.some((excluded) => normaliseRoute(excluded) === normalised);
}

// Treat the `detail` query param as if it were the next path segment when
// matching. This is how Tendering's tab-based sub-modes are represented in the
// URL: TenderDetailPage uses `/tenders/:id?detail=scope` rather than a real
// nested route. The matcher itself stays path-based; we just rewrite the input
// here so `?detail=scope` looks like `/scope` to the existing logic.
function buildMatchablePath(url: string): { path: string; queryDetail: string | null } {
  const queryStart = url.indexOf("?");
  if (queryStart === -1) {
    return { path: url, queryDetail: null };
  }
  const path = url.slice(0, queryStart);
  const queryString = url.slice(queryStart + 1);
  const params = new URLSearchParams(queryString);
  const detail = params.get("detail");
  if (!detail) {
    return { path, queryDetail: null };
  }
  const trimmed = path.replace(/\/$/, "");
  return { path: `${trimmed}/${detail}`, queryDetail: detail };
}

export function findPersonaForRoute(currentRoute: string): PersonaRouteMatch | null {
  const { path: matchPath, queryDetail } = buildMatchablePath(currentRoute);
  const queryStart = currentRoute.indexOf("?");
  const barePath = queryStart === -1 ? currentRoute : currentRoute.slice(0, queryStart);

  const tryMatch = (candidate: string): PersonaRouteMatch | null => {
    let best: { match: PersonaRouteMatch; score: number } | null = null;
    for (const persona of PERSONAS) {
      // Exclusions are checked against the bare pathname so a query string
      // (e.g. ?detail=foo) cannot bypass them.
      if (isExcludedRoute(persona.excludedRoutes, barePath)) continue;
      if (!rootMatches(persona.rootRoutePattern, candidate)) continue;

      let bestSubMode: PersonaSubMode | null = null;
      let bestScore = -1;
      for (const subMode of persona.subModes) {
        if (!patternMatches(subMode.routePattern, candidate)) continue;
        const score = specificity(subMode.routePattern);
        if (score > bestScore) {
          bestScore = score;
          bestSubMode = subMode;
        }
      }

      if (bestSubMode) {
        if (best === null || bestScore > best.score) {
          best = { match: { persona, subMode: bestSubMode }, score: bestScore };
        }
      }
    }
    return best ? best.match : null;
  };

  const primary = tryMatch(matchPath);
  if (primary) return primary;

  // Fallback: when the detail param doesn't map to any sub-mode (e.g. a
  // future tab name not yet registered, or a typo), fall back to matching
  // the bare path so the persona still activates with its base sub-mode.
  if (queryDetail !== null) {
    return tryMatch(barePath);
  }

  return null;
}
