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
    subtitle: active.subMode.label,
    body: `${active.persona.displayName} — coming soon. AI integration in next PR.`
  };
}

export function buildActivePersonaUrl(pathname: string, search: string): string {
  return `${pathname}${search ?? ""}`;
}

// ── PR B1.8 — drag + minimise persistence ─────────────────────────────

export type WindowPosition = { x: number; y: number };

export const PERSONA_WINDOW_MARGIN = 8;

/**
 * Clamp a candidate window position so the bubble stays at least
 * PERSONA_WINDOW_MARGIN px inside every viewport edge.
 *
 * `bubbleSize` is the actual rendered width/height of the floating
 * element. `viewport` is the window's innerWidth/innerHeight. Pure —
 * easy to test, called on every drag-move and on window resize.
 */
export function clampWindowPosition(
  candidate: WindowPosition,
  bubbleSize: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = PERSONA_WINDOW_MARGIN
): WindowPosition {
  const maxX = Math.max(margin, viewport.width - bubbleSize.width - margin);
  const maxY = Math.max(margin, viewport.height - bubbleSize.height - margin);
  return {
    x: Math.min(Math.max(candidate.x, margin), maxX),
    y: Math.min(Math.max(candidate.y, margin), maxY)
  };
}

/**
 * localStorage keys for per-persona drag position + minimised state.
 * Persona key is `${slug}:${subMode}` (the same value activePersonaKey
 * returns). Returning null keys signals "do nothing" — callers should
 * skip read/write when no persona is active.
 */
export function personaWindowStorageKeys(personaKey: string | null): {
  position: string;
  minimised: string;
} | null {
  if (!personaKey) return null;
  return {
    position: `persona-window:${personaKey}:position`,
    minimised: `persona-window:${personaKey}:minimised`
  };
}
