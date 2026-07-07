export type FormLayout = "classic" | "card";

export const CARD_BREAKPOINT_PX = 768;

/**
 * Effective layout for the fill page (locked, forms-engine-v2 §1.2, §10 Q8):
 * below 768px the fill page always renders Card mode; above the breakpoint
 * the per-form override wins over the default.
 */
export function resolveEffectiveLayout(input: {
  templateLayout?: FormLayout | null | undefined;
  viewportWidth: number;
}): FormLayout {
  if (input.viewportWidth < CARD_BREAKPOINT_PX) return "card";
  return input.templateLayout === "card" ? "card" : "classic";
}

/**
 * Read the layout key out of the free-form template.settings blob without
 * coercing unknown shapes.
 */
export function readTemplateLayout(settings: unknown): FormLayout | null {
  if (!settings || typeof settings !== "object") return null;
  const raw = (settings as { layout?: unknown }).layout;
  return raw === "card" || raw === "classic" ? raw : null;
}
