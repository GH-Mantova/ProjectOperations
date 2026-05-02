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
}

export interface PersonaRouteMatch {
  persona: PersonaDefinition;
  subMode: PersonaSubMode;
}
