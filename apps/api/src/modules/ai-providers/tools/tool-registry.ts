import { proposeScopeItemsTool } from "./propose-scope-items.tool";
import type { ToolDefinition } from "./types";

// Sub-mode keys are "<personaSlug>.<subMode>". Future sub-mode tools
// register here; one tool per registry entry today, but the value type
// is an array so a sub-mode can offer multiple tools later.
export const TOOLS_BY_SUB_MODE: Record<string, ToolDefinition[]> = {
  "tendering.scope": [proposeScopeItemsTool]
  // future: 'tendering.estimate': [...], 'tendering.quote': [...]
};

export function getToolsForSubMode(subModeKey: string): ToolDefinition[] {
  return TOOLS_BY_SUB_MODE[subModeKey] ?? [];
}

export function buildSubModeKey(personaSlug: string, subMode: string | undefined | null): string {
  if (!subMode) return personaSlug;
  return `${personaSlug}.${subMode}`;
}
