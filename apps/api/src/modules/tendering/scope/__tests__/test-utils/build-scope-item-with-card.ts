import type { IsDisciplineCode } from "../../../../personas/definitions/disciplines";
import { getScopeCardDefault } from "../../card-defaults";

export type ScopeItemWithCardOptions = {
  tenderId?: string;
  discipline?: IsDisciplineCode;
  cardId?: string;
  cardName?: string;
  id?: string;
  wbsCode?: string;
  rowType?: string;
  description?: string;
  itemNumber?: number;
  status?: string;
  [key: string]: unknown;
};

/**
 * Build a paired { card, item } mock for tests post-PR-A2.5.
 *
 * After A2.5 drops `ScopeOfWorksItem.discipline`, reading discipline from
 * a scope item requires the joined card. Tests that mock ScopeOfWorksItem
 * MUST also provide the card relation, or `item.card.discipline` will
 * be undefined.
 *
 * Usage:
 *   const { card, item } = buildScopeItemWithCard({ discipline: "DEM" });
 *   // card.discipline === "DEM", card.name === "Demolition" (per defaults)
 *   // item.cardId === card.id, item.card === card (deep-linked)
 */
export function buildScopeItemWithCard(opts: ScopeItemWithCardOptions = {}) {
  const discipline: IsDisciplineCode = opts.discipline ?? "DEM";
  const tenderId = opts.tenderId ?? "test-tender-1";
  const defaults = getScopeCardDefault(discipline);

  const card = {
    id: opts.cardId ?? `${tenderId}-card-${discipline}`,
    tenderId,
    name: opts.cardName ?? defaults.name,
    discipline,
    sortOrder: defaults.sortOrder,
    createdById: "test-user-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z")
  };

  const item = {
    id: opts.id ?? `test-item-${Math.random().toString(36).slice(2, 9)}`,
    tenderId,
    cardId: card.id,
    card,
    wbsCode: opts.wbsCode ?? `${discipline}1`,
    itemNumber: opts.itemNumber ?? 1,
    rowType: opts.rowType ?? "demolition",
    description: opts.description ?? "Test scope item",
    status: opts.status ?? "confirmed",
    aiProposed: false,
    aiConfidence: null,
    aiSourceRef: null,
    sortOrder: 0,
    notes: null,
    createdById: "test-user-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...opts
  };

  return { card, item };
}
