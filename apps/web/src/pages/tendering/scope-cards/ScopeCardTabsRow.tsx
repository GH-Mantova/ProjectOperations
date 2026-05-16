import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ScopeCardTab } from "./ScopeCardTab";
import { ScopeCardCreateTab } from "./ScopeCardCreateTab";
import type { ScopeCard } from "./useScopeCards";

// PR B1.5 — horizontal tab row with @dnd-kit sortable. Pointer activation
// constraint `distance: 8` matters: without it every click on a tab
// triggers drag-mode and prevents normal click-to-select.

type SortableTabProps = {
  card: ScopeCard;
  active: boolean;
  onSelect: () => void;
  onRename: (newName: string) => Promise<void>;
  onDelete: () => Promise<void>;
};

function SortableTab(props: SortableTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.card.id
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <ScopeCardTab {...props} isDragging={isDragging} />
    </div>
  );
}

type Props = {
  cards: ScopeCard[];
  activeCardId: string | null;
  onSelectCard: (cardId: string) => void;
  onCreateCard: (name: string, discipline: string) => Promise<void>;
  onRenameCard: (cardId: string, name: string) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onReorder: (cardIds: string[]) => Promise<void>;
};

export function ScopeCardTabsRow({
  cards,
  activeCardId,
  onSelectCard,
  onCreateCard,
  onRenameCard,
  onDeleteCard,
  onReorder
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = cards.findIndex((c) => c.id === active.id);
      const newIndex = cards.findIndex((c) => c.id === over.id);
      if (oldIndex >= 0 && newIndex >= 0) {
        const newOrder = arrayMove(cards, oldIndex, newIndex).map((c) => c.id);
        void onReorder(newOrder);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={cards.map((c) => c.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div
          style={{
            display: "flex",
            gap: 4,
            alignItems: "flex-end",
            borderBottom: "1px solid var(--border, #e5e7eb)",
            marginBottom: 16,
            flexWrap: "wrap"
          }}
        >
          {cards.map((card) => (
            <SortableTab
              key={card.id}
              card={card}
              active={card.id === activeCardId}
              onSelect={() => onSelectCard(card.id)}
              onRename={(name) => onRenameCard(card.id, name)}
              onDelete={() => onDeleteCard(card.id)}
            />
          ))}
          <ScopeCardCreateTab onCreate={onCreateCard} />
        </div>
      </SortableContext>
    </DndContext>
  );
}
