// settings-search.ts
// SLICE 3 (settings-home-plan.md §4 SLICE 3).
//
// Pure search module — no dependencies, no fuzzy matching, plain substring.
// D44: search covers item.label, item.description, and each tab.label +
//      tab.description.  A tab hit produces a result deep-linked via
//      ?tab=<id>.  Locked vs open state is preserved in each result so the
//      UI can render greyed cards with a Request access button (D45/D46).

import {
  partitionSettingsNavItems,
  type SettingsNavItem,
} from "../../components/SettingsShell";
import type { SafeUser } from "../../auth/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────

export type SearchResult = {
  /** The nav item that matched. */
  item: SettingsNavItem;
  /**
   * The href to navigate to.
   * - If the match was on the item itself (label/description): equals item.to.
   * - If the match was on a tab: equals `${item.to}?tab=${tab.id}`.
   */
  href: string;
  /** True when the user cannot access this item (drives the locked card UI). */
  locked: boolean;
  /** The tab that matched, or undefined if the match was on the item itself. */
  matchedTab?: { id: string; label: string; description: string };
};

// ── Core search function ───────────────────────────────────────────────────

/**
 * Search settings items for a query string.
 *
 * @param sections    Array of nav sections (or a flat item list — callers may
 *                    pass SECTIONS directly; this function flattens internally).
 * @param user        The signed-in user, used to determine locked/open state.
 * @param query       The raw query string from the search input.
 * @returns           An array of results in encounter order (not ranked).
 *                    Returns an empty array for an empty/whitespace-only query.
 */
export function searchSettings(
  sections: Array<{ items: SettingsNavItem[] }>,
  user: SafeUser | null,
  query: string
): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const lower = trimmed.toLowerCase();

  // Build a flat item list and resolve locked/open state once.
  const allItems = sections.flatMap((s) => s.items);
  const { open, locked } = partitionSettingsNavItems(allItems, user);
  const openSet = new Set(open.map((i) => i.to));

  const results: SearchResult[] = [];
  // Track items we have already emitted to avoid duplicate entries.
  const emittedItemTo = new Set<string>();

  for (const item of allItems) {
    const isLocked = !openSet.has(item.to);

    // 1. Item-level match: label or description.
    const itemMatches =
      item.label.toLowerCase().includes(lower) ||
      item.description.toLowerCase().includes(lower);

    if (itemMatches && !emittedItemTo.has(item.to)) {
      emittedItemTo.add(item.to);
      results.push({ item, href: item.to, locked: isLocked });
    }

    // 2. Tab-level match: each tab's label or description.
    //    A tab match emits a result even if the item itself already matched,
    //    so the user gets the direct deep-link.  However we only emit one
    //    result per tab (label match and description match count as one).
    for (const tab of item.tabs ?? []) {
      const tabMatches =
        tab.label.toLowerCase().includes(lower) ||
        tab.description.toLowerCase().includes(lower);

      if (tabMatches) {
        results.push({
          item,
          href: `${item.to}?tab=${tab.id}`,
          locked: isLocked,
          matchedTab: tab
        });
      }
    }
  }

  return results;
}
