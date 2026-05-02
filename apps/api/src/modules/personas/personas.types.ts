export interface PersonaSubMode {
  name: string;
  routePattern: string;
  description: string;
  toolSlots: string[];
}

export interface PersonaDefinition {
  slug: string;
  displayName: string;
  description: string;
  rootRoutePattern: string;
  subModes: PersonaSubMode[];
  permissionRequired: string;
  // Literal paths under rootRoutePattern that must not match this persona
  // even though sub-mode patterns would otherwise capture them. Exact-match
  // (with trailing-slash tolerance), not prefix or pattern.
  excludedRoutes?: string[];
}

export interface PersonaRouteMatch {
  persona: PersonaDefinition;
  subMode: PersonaSubMode;
}
