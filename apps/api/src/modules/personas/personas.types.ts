/**
 * label   — short human-readable UI label (rendered in persona window
 *           subtitle, dropdowns, badges). One line, no markdown.
 * description — system prompt block sent to the model. May contain
 *           markdown headers, multi-line prose, policy directives.
 *           NEVER render directly in the UI.
 */
export interface PersonaSubMode {
  name: string;
  label: string;
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
