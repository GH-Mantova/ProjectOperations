import { ScopeCardTab } from "./ScopeCardTab";
import { ScopeCardCreateTab } from "./ScopeCardCreateTab";
import { DISCIPLINE_CODES, DISCIPLINE_LABELS } from "./utils/card-display";
import { cardsInDiscipline, disciplinesWithCards } from "./utils/discipline-rollup";
import type { ScopeCard } from "./useScopeCards";

// SCOPE_DISCIPLINE_STACK_V1 — one tab per DISCIPLINE that has at least one
// card, replacing PR B1.5's one-tab-per-card strip.
//
// The strip lost its @dnd-kit sortable wrapper along with the card tabs.
// Dragging a discipline is meaningless — the codes have a canonical order
// (DISCIPLINE_CODES, re-exported from constants/disciplines.ts, the single
// source of truth; no second list is built here). Card order still matters,
// because cards in a discipline are the stages of one job in sequence, so
// the reorder affordance moved onto the card headers in the stack, where
// what is being reordered is visible while you reorder it.

type Props = {
  cards: ScopeCard[];
  /** Discipline code of the visible tab, e.g. "DEM". */
  activeDiscipline: string | null;
  onSelectDiscipline: (discipline: string) => void;
  onCreateCard: (name: string, discipline: string) => Promise<void>;
};

export function ScopeCardTabsRow({
  cards,
  activeDiscipline,
  onSelectDiscipline,
  onCreateCard
}: Props) {
  const disciplines = disciplinesWithCards(cards, DISCIPLINE_CODES);

  return (
    <div
      role="group"
      aria-label="Scope disciplines"
      style={{
        display: "flex",
        gap: 4,
        alignItems: "flex-end",
        borderBottom: "1px solid var(--border-default)",
        marginBottom: 16,
        flexWrap: "wrap"
      }}
    >
      {disciplines.map((code) => {
        const inDiscipline = cardsInDiscipline(cards, code);
        return (
          <ScopeCardTab
            key={code}
            code={code}
            label={DISCIPLINE_LABELS[code] ?? code}
            cardCount={inDiscipline.length}
            itemCount={inDiscipline.reduce((sum, c) => sum + c.itemCount, 0)}
            active={code === activeDiscipline}
            onSelect={() => onSelectDiscipline(code)}
          />
        );
      })}
      <ScopeCardCreateTab onCreate={onCreateCard} />
    </div>
  );
}
