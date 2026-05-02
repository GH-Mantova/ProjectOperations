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

export function findPersonaForRoute(currentRoute: string): PersonaRouteMatch | null {
  let best: { match: PersonaRouteMatch; score: number } | null = null;

  for (const persona of PERSONAS) {
    if (!rootMatches(persona.rootRoutePattern, currentRoute)) continue;

    let bestSubMode: PersonaSubMode | null = null;
    let bestScore = -1;
    for (const subMode of persona.subModes) {
      if (!patternMatches(subMode.routePattern, currentRoute)) continue;
      const score = specificity(subMode.routePattern);
      if (score > bestScore) {
        bestScore = score;
        bestSubMode = subMode;
      }
    }

    if (bestSubMode) {
      const score = bestScore;
      if (best === null || score > best.score) {
        best = { match: { persona, subMode: bestSubMode }, score };
      }
    }
  }

  return best ? best.match : null;
}
