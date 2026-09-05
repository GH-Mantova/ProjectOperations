import { NotesField } from "../../../components";
import type { ScopeItem } from "../ScopeQuantitiesTable";

// ── SCOPE_WBS_ACTIONS_V1 — the Comment expandable ────────────────────────
//
// A note against the WBS item. This is a RELOCATION too, though a smaller one:
// the textarea used to be nailed under the Description input on every single
// row of every single item, which is how a card of ten items came to show ten
// permanently-open note boxes nobody had asked for. It is the SAME field —
// ScopeOfWorksItem.notes, written through the same PATCH — now reached from
// `+ Add comment` and closed until it is.
//
// No new column, no DTO change: `notes` has been on the item (and on the
// update DTO) since PR B1.7, and NotesField is the shared control the cutting
// and waste subtables already use, so an expanded note still opens into the
// same modal it always did.

/** The placeholder the mock-up carries on the comment box. */
export const WBS_COMMENT_PLACEHOLDER =
  "Note against this WBS item — rolls into the card summary, and can be ticked through to the quote or the handover.";

/** Item fields the comment is read from. */
type CommentSource = Pick<ScopeItem, "notes">;

/**
 * True when the item actually carries a comment.
 *
 * Whitespace is not a comment: `notes` is a nullable text column and a box the
 * estimator opened, tabbed out of and left alone can come back as "" or " ".
 * The actions column would otherwise show a tick against nothing.
 */
export function hasComment(item: CommentSource): boolean {
  return typeof item.notes === "string" && item.notes.trim().length > 0;
}

/** The actions-column count for `+ Add comment` — one comment, or none. */
export function commentCount(item: CommentSource): number {
  return hasComment(item) ? 1 : 0;
}

export type WbsCommentBlockProps = {
  item: ScopeItem;
  isAi: boolean;
  onPatch: (body: Record<string, unknown>) => void;
};

/**
 * SCOPE_WBS_ACTIONS_V1 — the item's comment.
 *
 * Rendered ONLY when the estimator has opened it from the actions column; the
 * caller owns that state and it starts closed.
 */
export function WbsCommentBlock({ item, isAi, onPatch }: WbsCommentBlockProps) {
  return (
    <div
      data-testid="wbs-comment-block"
      style={{
        border: "1px solid var(--border-default, #e5e7eb)",
        borderRadius: 6,
        padding: 8,
        background: "var(--surface-muted, #FAFAFA)",
        maxWidth: 720
      }}
    >
      <NotesField
        label={`Comment on ${item.wbsCode}`}
        value={item.notes}
        onSave={(v) => onPatch({ notes: v })}
        disabled={isAi}
        placeholder={WBS_COMMENT_PLACEHOLDER}
      />
    </div>
  );
}
