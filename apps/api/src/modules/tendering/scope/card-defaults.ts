/**
 * Default ScopeCard attributes per discipline (PR A2, 2026-05-16).
 *
 * Used by:
 *   - prisma/seed.ts to create the initial 4 cards per tender
 *   - PR A2's data-migration SQL hardcodes the same mapping (kept in
 *     sync manually — the migration is a one-shot historical artifact)
 *
 * The discipline → card-name mapping uses the friendly labels also seen
 * in IS_DISCIPLINE_LABELS (apps/api/src/modules/personas/definitions/disciplines.ts),
 * but card names are not the same surface — users can rename cards
 * freely in the UI after PR B1 ships. These defaults only apply at
 * tender creation / migration / seed time.
 */

import { IS_DISCIPLINE_CODES, type IsDisciplineCode } from "../../personas/definitions/disciplines";

/**
 * Default attributes for the first ScopeCard created per discipline:
 * discipline code, friendly card name, sort position, and cardNumber.
 */
export type ScopeCardDefault = {
  discipline: IsDisciplineCode;
  name: string;
  sortOrder: number;
  cardNumber: number;
};

// PR B1 — cardNumber=1 for every default because the seed creates the
// first card per discipline. Code that creates additional cards in the
// same (tender, discipline) computes cardNumber dynamically via
// MAX(card_number) + 1 in ScopeOfWorksService.createCard().
/**
 * The four default scope cards (DEM, CIV, ASB, Other) created per
 * tender at seed / migration / tender-creation time.
 *
 * cardNumber is always 1 here — additional cards in the same
 * (tender, discipline) get MAX(card_number) + 1 at creation time.
 */
export const SCOPE_CARD_DEFAULTS: readonly ScopeCardDefault[] = [
  { discipline: "DEM", name: "Demolition", sortOrder: 0, cardNumber: 1 },
  { discipline: "CIV", name: "Civil works", sortOrder: 1, cardNumber: 1 },
  { discipline: "ASB", name: "Asbestos removal", sortOrder: 2, cardNumber: 1 },
  { discipline: "Other", name: "Other", sortOrder: 3, cardNumber: 1 }
] as const;

/**
 * Returns the default card attributes for a discipline. Throws on
 * unknown discipline so callers can't silently miss a new code added
 * to IS_DISCIPLINE_CODES without updating this map.
 */
export function getScopeCardDefault(discipline: IsDisciplineCode): ScopeCardDefault {
  const found = SCOPE_CARD_DEFAULTS.find((c) => c.discipline === discipline);
  if (!found) {
    throw new Error(
      `getScopeCardDefault: no card default for discipline "${discipline}". ` +
        `Add an entry to SCOPE_CARD_DEFAULTS in card-defaults.ts.`
    );
  }
  return found;
}

// Compile-time guard: ensure every discipline in IS_DISCIPLINE_CODES has a
// default. If this throws at import time in a test/dev environment, a new
// discipline was added without updating SCOPE_CARD_DEFAULTS.
for (const code of IS_DISCIPLINE_CODES) {
  getScopeCardDefault(code);
}
