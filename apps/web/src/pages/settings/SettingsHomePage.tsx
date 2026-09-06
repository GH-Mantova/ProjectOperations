import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth, type SafeUser } from "../../auth/AuthContext";
import { SECTIONS, partitionSettingsNavItems, type SettingsNavItem } from "../../components/SettingsShell";
import { searchSettings, type SearchResult } from "./settings-search";

// SettingsHomePage -- SLICE 2 (settings-home-plan.md).
// SLICE 3 adds a search input at the top; non-empty query renders search
//   results instead of the full home view.  Results respect the flat/grouped
//   toggle and preserve the locked card UI (D44/D45/D46).
//
// D43: flat view by default; Grouped toggle switches to section headings.
// D45: locked items are shown greyed with a lock icon and Request access button.
// D46: locked items always appear at the bottom under a "Needs access -- N" divider,
//      in BOTH flat and grouped views. Header count reads open items only.
//
// SETTINGS_HOME_S1 (pr-settings-home-s1-cards-tabs-counts) builds the card
// surface the approved mock-up shows and the page never had:
//   * every card carries its description, its route (or the permission it
//     needs) in a monospace line, and one chip per declared tab;
//   * a counts line under the search box reading
//     "N settings you can open - N tabs - N need access", every figure
//     COMPUTED from the permission-filtered nav items.  Nothing here may be
//     a literal: see computeSettingsCounts below and its tests;
//   * the flat half of the view toggle is now named "All items" and is the
//     default, matching the mock-up;
//   * a search hit on a tab highlights that tab's chip, using the matchedTab
//     that searchSettings already reports rather than re-deriving the match.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

// ── Presentation tokens (mirror the approved mock-up) ─────────────────────

const CARD_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  padding: "14px 16px 13px",
  borderRadius: 12,
  border: "1px solid var(--border, #e5e7eb)",
  background: "var(--surface, #fff)",
  color: "var(--text-primary)"
};

const LOCKED_CARD_STYLE: React.CSSProperties = {
  ...CARD_STYLE,
  borderStyle: "dashed",
  background: "var(--surface-2, #fafaf9)"
};

const GRID_STYLE: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fill, minmax(268px, 1fr))"
};

const MONO_LINE_STYLE: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.72rem",
  color: "var(--text-muted)",
  overflowWrap: "anywhere"
};

const CHIP_STYLE: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.69rem",
  lineHeight: 1.5,
  padding: "2px 8px",
  borderRadius: 999,
  background: "var(--surface-2, #f1f3f2)",
  border: "1px solid transparent",
  color: "var(--text-muted)",
  textDecoration: "none"
};

const CHIP_HIT_STYLE: React.CSSProperties = {
  ...CHIP_STYLE,
  background: "var(--accent, #feaa6d)",
  border: "1px solid var(--accent-strong, #e8914f)",
  color: "#000",
  fontWeight: 600
};

const COUNT_FIGURE_STYLE: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontWeight: 500,
  fontVariantNumeric: "tabular-nums",
  color: "var(--text-primary)"
};

const SECTION_HEADING_STYLE: React.CSSProperties = {
  margin: 0,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  fontSize: "0.75rem",
  letterSpacing: "0.05em"
};

// ── Pure helpers (exported so the no-jsdom suite can prove them) ──────────

export function permissionLabel(item: SettingsNavItem): string {
  if (item.superUserOnly) return "super-user";
  if (item.requiresPermission) return item.requiresPermission;
  if (item.requiresAnyPermission && item.requiresAnyPermission.length > 0) {
    return item.requiresAnyPermission.join(" or ");
  }
  return "unknown";
}

export function slugFromTo(to: string): string {
  // "/settings/administration/users" -> "administration-users"
  // "/admin/schedule-of-rates"       -> "admin-schedule-of-rates"
  return to.replace(/^\/(settings\/?)?/, "").replace(/\//g, "-") || "root";
}

/**
 * The monospace line under a card's description: the route it opens, or the
 * permission the user is missing.  Exactly the two states the mock-up draws.
 */
export function routeLineLabel(item: SettingsNavItem, locked: boolean): string {
  return locked ? `needs ${permissionLabel(item)}` : item.to;
}

export type SettingsCounts = {
  open: number;
  tabs: number;
  needAccess: number;
};

/**
 * The three figures on the counts line, derived from the live nav data and
 * the signed-in user.
 *
 * NOTHING HERE IS A LITERAL.  `open` and `needAccess` come from
 * partitionSettingsNavItems, and `tabs` is the sum of the declared tabs on
 * the items the user can actually open — so adding, removing or re-gating a
 * page in settings-nav-items.ts moves these numbers with no edit here.
 * Marco ruled 2026-09-01 that a number copied from a mock-up is a lie the
 * page tells about itself.
 */
export function computeSettingsCounts(
  sections: Array<{ items: SettingsNavItem[] }>,
  user: SafeUser | null
): SettingsCounts {
  const allItems = sections.flatMap((s) => s.items);
  const { open, locked } = partitionSettingsNavItems(allItems, user);
  const tabs = open.reduce((sum, item) => sum + (item.tabs?.length ?? 0), 0);
  return { open: open.length, tabs, needAccess: locked.length };
}

/** The counts line as a single string, for tests and for screen readers. */
export function formatCountsLine(counts: SettingsCounts): string {
  return `${counts.open} settings you can open · ${counts.tabs} tabs · ${counts.needAccess} need access`;
}

export type CardMatch = {
  item: SettingsNavItem;
  /** Where the card's title links to. */
  href: string;
  locked: boolean;
  /** Ids of the tabs whose chip should be highlighted. */
  matchedTabIds: string[];
};

/**
 * searchSettings emits one result per match, so an item whose label AND two
 * of whose tabs match produces three results.  The card surface wants one
 * card per item with the matching chips flagged, so fold the results here
 * rather than re-running the match in the page: `matchedTab` is already the
 * authoritative answer to "which field matched".
 */
export function collapseSearchResults(results: SearchResult[]): CardMatch[] {
  const byTo = new Map<string, CardMatch>();
  const order: string[] = [];
  for (const result of results) {
    let card = byTo.get(result.item.to);
    if (!card) {
      card = {
        item: result.item,
        href: result.item.to,
        locked: result.locked,
        matchedTabIds: []
      };
      byTo.set(result.item.to, card);
      order.push(result.item.to);
    }
    if (result.matchedTab && !card.matchedTabIds.includes(result.matchedTab.id)) {
      card.matchedTabIds.push(result.matchedTab.id);
    }
  }
  return order.map((to) => byTo.get(to)!);
}

export type HighlightSegment = { text: string; hit: boolean };

/**
 * Split `text` into matched / unmatched runs for the active query, so the
 * card can wrap the matched runs in <mark> the way the mock-up does.
 * An empty query yields the whole string as a single unmatched run.
 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [{ text, hit: false }];
  const haystack = text.toLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (;;) {
    const found = haystack.indexOf(needle, cursor);
    if (found < 0) break;
    if (found > cursor) segments.push({ text: text.slice(cursor, found), hit: false });
    segments.push({ text: text.slice(found, found + needle.length), hit: true });
    cursor = found + needle.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false });
  return segments.length > 0 ? segments : [{ text, hit: false }];
}

// ── Small presentational pieces ───────────────────────────────────────────

function Highlighted({ text, query }: { text: string; query: string }) {
  const segments = highlightSegments(text, query);
  return (
    <>
      {segments.map((segment, i) =>
        segment.hit ? (
          <mark key={i} style={{ background: "var(--accent-soft, #fde2c7)", color: "inherit", borderRadius: 2, padding: "0 1px" }}>
            {segment.text}
          </mark>
        ) : (
          <span key={i}>{segment.text}</span>
        )
      )}
    </>
  );
}

function LockGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
      style={{ flex: "none", opacity: 0.55 }}
    >
      <rect x="4" y="10.5" width="16" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}

function ExternalBadge() {
  return (
    <span
      style={{
        fontSize: "0.6rem",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        fontWeight: 600,
        color: "var(--brand, #005b61)",
        background: "var(--brand-soft, #e6f0f1)",
        borderRadius: 999,
        padding: "2px 7px"
      }}
    >
      Elsewhere
    </span>
  );
}

/**
 * One chip per declared tab.  A card whose tabs array is empty renders NO
 * chip row at all — not an empty container.
 */
function TabChips({
  item,
  locked,
  query,
  matchedTabIds
}: {
  item: SettingsNavItem;
  locked: boolean;
  query: string;
  matchedTabIds: string[];
}) {
  const tabs = item.tabs ?? [];
  if (tabs.length === 0) return null;
  const slug = slugFromTo(item.to);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }} data-testid={`settings-home-tabs-${slug}`}>
      {tabs.map((tab) => {
        const hit = matchedTabIds.includes(tab.id);
        const style = hit ? CHIP_HIT_STYLE : CHIP_STYLE;
        const testId = `settings-home-tab-${slug}-${tab.id}`;
        const body = <Highlighted text={tab.label} query={query} />;
        return locked ? (
          <span key={tab.id} data-testid={testId} data-tab-hit={hit ? "true" : undefined} style={style} title={tab.description}>
            {body}
          </span>
        ) : (
          <Link
            key={tab.id}
            to={`${item.to}?tab=${tab.id}`}
            data-testid={testId}
            data-tab-hit={hit ? "true" : undefined}
            style={style}
            title={tab.description}
          >
            {body}
          </Link>
        );
      })}
    </div>
  );
}

type RequestState = "idle" | "loading" | "done" | "error";

function LockedCard({
  item,
  query,
  matchedTabIds,
  authFetch
}: {
  item: SettingsNavItem;
  query: string;
  matchedTabIds: string[];
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}) {
  const [reqState, setReqState] = useState<RequestState>("idle");
  const slug = slugFromTo(item.to);
  const permCode = permissionLabel(item);

  async function handleRequestAccess() {
    setReqState("loading");
    try {
      // POST to /settings/request-access with the resource and permission code.
      // NOTE: The /auth/request-access endpoint only handles unregistered Entra
      // users (it expects an idToken). For logged-in users requesting a permission
      // upgrade, a dedicated authenticated endpoint is needed and is not yet
      // implemented. This call will return 404 until that endpoint is added.
      // Track: settings-home-plan.md section 3.7 (API gap).
      const res = await authFetch(`${API_BASE_URL}/settings/request-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: item.to, permission: permCode })
      });
      if (res.ok) {
        setReqState("done");
      } else {
        setReqState("error");
      }
    } catch {
      setReqState("error");
    }
  }

  return (
    <li
      data-testid={`settings-home-locked-${slug}`}
      style={{ ...LOCKED_CARD_STYLE, color: "var(--text-muted)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <LockGlyph />
        <span style={{ fontWeight: 600, fontSize: "0.94rem" }}>
          <Highlighted text={item.label} query={query} />
        </span>
        {item.external ? <ExternalBadge /> : null}
      </div>
      <p style={{ margin: 0, fontSize: "0.8rem", lineHeight: 1.45, color: "var(--text-muted)" }}>
        <Highlighted text={item.description} query={query} />
      </p>
      <span
        data-testid={`settings-home-needs-${slug}`}
        style={{ ...MONO_LINE_STYLE, color: "var(--color-warning, #b45309)" }}
      >
        {routeLineLabel(item, true)}
      </span>
      <TabChips item={item} locked query={query} matchedTabIds={matchedTabIds} />
      {reqState === "idle" || reqState === "loading" ? (
        <button
          type="button"
          data-testid={`settings-home-request-access-${slug}`}
          disabled={reqState === "loading"}
          onClick={() => void handleRequestAccess()}
          style={{
            alignSelf: "flex-start",
            marginTop: 3,
            padding: "5px 11px",
            fontSize: "0.75rem",
            fontWeight: 600,
            borderRadius: 6,
            border: "1px solid var(--brand, #005b61)",
            background: "transparent",
            cursor: reqState === "loading" ? "wait" : "pointer",
            color: "var(--brand, #005b61)"
          }}
        >
          {reqState === "loading" ? "Requesting..." : "Request access"}
        </button>
      ) : reqState === "done" ? (
        <span style={{ fontSize: "0.8rem", color: "var(--color-success, #16a34a)" }}>Requested</span>
      ) : (
        <span style={{ fontSize: "0.8rem", color: "var(--color-error, #dc2626)" }}>
          Failed to send request. Please try again.
        </span>
      )}
    </li>
  );
}

function OpenCard({
  item,
  href,
  query,
  matchedTabIds
}: {
  item: SettingsNavItem;
  href?: string;
  query: string;
  matchedTabIds: string[];
}) {
  const slug = slugFromTo(item.to);
  return (
    <li style={CARD_STYLE}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Link
          to={href ?? item.to}
          data-testid={`settings-home-open-${slug}`}
          style={{
            fontWeight: 600,
            fontSize: "0.94rem",
            color: "var(--text-primary)",
            textDecoration: "none"
          }}
        >
          <Highlighted text={item.label} query={query} />
        </Link>
        {item.external ? <ExternalBadge /> : null}
      </div>
      <p style={{ margin: 0, fontSize: "0.8rem", lineHeight: 1.45, color: "var(--text-muted)" }}>
        <Highlighted text={item.description} query={query} />
      </p>
      <span data-testid={`settings-home-route-${slug}`} style={MONO_LINE_STYLE}>
        {routeLineLabel(item, false)}
      </span>
      <TabChips item={item} locked={false} query={query} matchedTabIds={matchedTabIds} />
    </li>
  );
}

function CardFor({
  card,
  query,
  authFetch
}: {
  card: CardMatch;
  query: string;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}) {
  return card.locked ? (
    <LockedCard
      item={card.item}
      query={query}
      matchedTabIds={card.matchedTabIds}
      authFetch={authFetch}
    />
  ) : (
    <OpenCard item={card.item} href={card.href} query={query} matchedTabIds={card.matchedTabIds} />
  );
}

function LockedDivider({ count }: { count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ ...SECTION_HEADING_STYLE, fontWeight: 700, whiteSpace: "nowrap" }}>
        Needs access &mdash; {count}
      </span>
      <span style={{ height: 1, flex: 1, background: "var(--border, #e5e7eb)" }} />
    </div>
  );
}

// ── The card surface ──────────────────────────────────────────────────────

function CardSurface({
  openCards,
  lockedCards,
  grouped,
  query,
  authFetch
}: {
  openCards: CardMatch[];
  lockedCards: CardMatch[];
  grouped: boolean;
  query: string;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}) {
  // The mock-up keeps the locked section visible even when nothing the user
  // can open matches, so the empty notice replaces only the open half.
  const emptyOpen = query.length > 0 && openCards.length === 0;

  const groups = grouped
    ? SECTIONS.map((section) => {
        const sectionTos = new Set(section.items.map((i) => i.to));
        return { id: section.id, label: section.label, cards: openCards.filter((c) => sectionTos.has(c.item.to)) };
      }).filter((g) => g.cards.length > 0)
    : [{ id: "all", label: null as string | null, cards: openCards }].filter(
        (g) => g.cards.length > 0
      );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {emptyOpen && (
        <p
          data-testid="settings-home-search-empty"
          style={{
            border: "1px dashed var(--border, #e5e7eb)",
            borderRadius: 12,
            padding: 22,
            textAlign: "center",
            color: "var(--text-muted)",
            margin: 0
          }}
        >
          {`Nothing you can open matches "${query}".`}
        </p>
      )}

      {groups.map((group) => (
        <div key={group.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {group.label !== null && (
            <h3 className="s7-type-label" style={SECTION_HEADING_STYLE}>
              {group.label}
            </h3>
          )}
          <ul style={GRID_STYLE}>
            {group.cards.map((card) => (
              <CardFor key={card.item.to} card={card} query={query} authFetch={authFetch} />
            ))}
          </ul>
        </div>
      ))}

      {lockedCards.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <LockedDivider count={lockedCards.length} />
          <ul style={GRID_STYLE}>
            {lockedCards.map((card) => (
              <CardFor key={card.item.to} card={card} query={query} authFetch={authFetch} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Page content (pure props — no context, so it renders under SSR) ───────

export function SettingsHomeContent({
  user,
  authFetch,
  initialQuery = "",
  initialGrouped = false
}: {
  user: SafeUser | null;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  /**
   * Seed the search box / view toggle.  The page never passes these — they
   * exist so the suite can render a searched or grouped surface with
   * renderToStaticMarkup, which cannot type into an input.
   */
  initialQuery?: string;
  initialGrouped?: boolean;
}) {
  // "All items" is the default view (D43, and the mock-up): grouped === false.
  const [grouped, setGrouped] = useState(initialGrouped);
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  const counts = computeSettingsCounts(SECTIONS, user);

  const trimmedQuery = searchQuery.trim();

  // With a query, the cards ARE the search results (folded to one per item so
  // a tab hit lights up its chip instead of spawning a duplicate card).
  // Without one, every item the user can see is a card.
  const cards: CardMatch[] = trimmedQuery
    ? collapseSearchResults(searchSettings(SECTIONS, user, trimmedQuery))
    : SECTIONS.flatMap((section) => {
        const { open, locked } = partitionSettingsNavItems(section.items, user);
        return [
          ...open.map((item) => ({ item, href: item.to, locked: false, matchedTabIds: [] as string[] })),
          ...locked.map((item) => ({ item, href: item.to, locked: true, matchedTabIds: [] as string[] }))
        ];
      });

  const openCards = cards.filter((c) => !c.locked);
  const lockedCards = cards.filter((c) => c.locked);

  const segButton = (on: boolean): React.CSSProperties => ({
    padding: "9px 14px",
    border: 0,
    background: on ? "var(--accent, #feaa6d)" : "transparent",
    color: on ? "#000" : "var(--text-muted)",
    fontWeight: on ? 600 : 400,
    fontSize: "0.82rem",
    cursor: "pointer"
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <header>
        <h2 className="s7-type-page-heading" style={{ margin: 0 }}>
          Everything you can configure
        </h2>
        <p style={{ color: "var(--text-muted)", margin: "8px 0 0", maxWidth: "64ch" }}>
          Locked settings are shown, not hidden &mdash; greyed, with the permission they need and a
          way to ask for it.
        </p>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <input
          type="search"
          data-testid="settings-home-search"
          aria-label="Search settings"
          placeholder="Search settings, descriptions and tabs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: "1 1 320px",
            minWidth: 220,
            padding: "9px 12px",
            borderRadius: 8,
            border: "1px solid var(--border, #e5e7eb)",
            background: "var(--surface, #fff)",
            color: "var(--text-primary)",
            fontSize: "0.9rem",
            boxSizing: "border-box"
          }}
        />
        <div
          role="group"
          aria-label="View"
          style={{
            display: "inline-flex",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--surface, #fff)"
          }}
        >
          <button
            type="button"
            data-testid="settings-home-view-all"
            aria-pressed={!grouped}
            onClick={() => setGrouped(false)}
            style={segButton(!grouped)}
          >
            All items
          </button>
          <button
            type="button"
            data-testid="settings-home-view-grouped"
            aria-pressed={grouped}
            onClick={() => setGrouped(true)}
            style={segButton(grouped)}
          >
            Grouped
          </button>
        </div>
      </div>

      {/* The counts line. Every figure is computed — see computeSettingsCounts. */}
      <p
        data-testid="settings-home-counts"
        aria-live="polite"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          gap: 6,
          margin: 0,
          color: "var(--text-muted)",
          fontSize: "0.82rem"
        }}
      >
        <b style={COUNT_FIGURE_STYLE}>
          {counts.open}
        </b>
        <span>settings you can open</span>
        <span style={{ opacity: 0.45 }}>&middot;</span>
        <b style={COUNT_FIGURE_STYLE}>
          {counts.tabs}
        </b>
        <span>tabs</span>
        <span style={{ opacity: 0.45 }}>&middot;</span>
        <b style={COUNT_FIGURE_STYLE}>
          {counts.needAccess}
        </b>
        <span>need access</span>
        <span
          style={{
            marginLeft: 4,
            fontSize: "0.6rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--brand, #005b61)",
            border: "1px solid var(--brand, #005b61)",
            borderRadius: 999,
            padding: "1px 7px"
          }}
        >
          computed
        </span>
      </p>

      <CardSurface
        openCards={openCards}
        lockedCards={lockedCards}
        grouped={grouped}
        query={trimmedQuery}
        authFetch={authFetch}
      />
    </div>
  );
}

export function SettingsHomePage() {
  const { user, authFetch } = useAuth();
  return <SettingsHomeContent user={user} authFetch={authFetch} />;
}
