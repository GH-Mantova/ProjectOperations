import type { ActivePersona } from "./types";

export type PanelContent = {
  title: string;
  subtitle: string;
  body: string;
};

// Each navigation to a different sub-mode resets the panel to closed.
// We compute a stable key from the active persona; when it changes, callers
// re-derive their open/closed state.
export function activePersonaKey(active: ActivePersona | null): string | null {
  if (!active) return null;
  return `${active.persona.slug}:${active.subMode.name}`;
}

export function buttonLabel(active: ActivePersona | null): string {
  return active?.persona.displayName ?? "";
}

export function panelContent(active: ActivePersona | null): PanelContent | null {
  if (!active) return null;
  return {
    title: active.persona.displayName,
    subtitle: active.subMode.description,
    body: `${active.persona.displayName} — coming soon. AI integration in next PR.`
  };
}

export function buildActivePersonaUrl(pathname: string, search: string): string {
  return `${pathname}${search ?? ""}`;
}
