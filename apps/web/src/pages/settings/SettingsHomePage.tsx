import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

// Card design tokens mirror AdministrationLandingPage exactly.
const CARD_STYLE: React.CSSProperties = {
  display: "block",
  padding: 16,
  borderRadius: 8,
  border: "1px solid var(--border, #e5e7eb)",
  background: "var(--surface, #fff)",
  color: "var(--text-primary)",
  textDecoration: "none",
  fontWeight: 600
};

const GRID_STYLE: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))"
};

function permissionLabel(item: SettingsNavItem): string {
  if (item.superUserOnly) return "super-user";
  if (item.requiresPermission) return item.requiresPermission;
  if (item.requiresAnyPermission && item.requiresAnyPermission.length > 0) {
    return item.requiresAnyPermission.join(" or ");
  }
  return "unknown";
}

function slugFromTo(to: string): string {
  // Turn "/settings/administration/users" into "administration-users"
  return to.replace(/^\/settings\/?/, "").replace(/\//g, "-") || "root";
}

type RequestState = "idle" | "loading" | "done" | "error";

function LockedCard({
  item,
  authFetch
}: {
  item: SettingsNavItem;
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
      key={item.to}
      data-testid={`settings-home-locked-${slug}`}
      style={{
        ...CARD_STYLE,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: 0.6,
        color: "var(--text-muted)",
        cursor: "default",
        pointerEvents: "auto"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span aria-hidden="true" style={{ fontSize: "1.1em" }}>
          {"🔒"}
        </span>
        <span style={{ fontWeight: 600 }}>{item.label}</span>
      </div>
      <span
        style={{
          fontSize: "0.75rem",
          fontFamily: "monospace",
          color: "var(--text-muted)"
        }}
      >
        {permCode}
      </span>
      {reqState === "idle" || reqState === "loading" ? (
        <button
          type="button"
          data-testid={`settings-home-request-access-${slug}`}
          disabled={reqState === "loading"}
          onClick={() => void handleRequestAccess()}
          style={{
            alignSelf: "flex-start",
            padding: "4px 10px",
            fontSize: "0.8rem",
            borderRadius: 4,
            border: "1px solid var(--border, #e5e7eb)",
            background: "var(--surface, #fff)",
            cursor: reqState === "loading" ? "wait" : "pointer",
            color: "var(--text-primary)"
          }}
        >
          {reqState === "loading" ? "Requesting..." : "Request access"}
        </button>
      ) : reqState === "done" ? (
        <span
          style={{ fontSize: "0.8rem", color: "var(--color-success, #16a34a)" }}
        >
          Requested
        </span>
      ) : (
        <span
          style={{ fontSize: "0.8rem", color: "var(--color-error, #dc2626)" }}
        >
          Failed to send request. Please try again.
        </span>
      )}
    </li>
  );
}

function OpenCard({ item, href }: { item: SettingsNavItem; href?: string }) {
  const slug = slugFromTo(item.to);
  return (
    <li key={item.to}>
      <Link
        to={href ?? item.to}
        data-testid={`settings-home-open-${slug}`}
        style={CARD_STYLE}
      >
        {item.label}
      </Link>
    </li>
  );
}

// ── Search results view ───────────────────────────────────────────────────

function SearchResultCard({
  result,
  authFetch
}: {
  result: SearchResult;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}) {
  if (result.locked) {
    return <LockedCard item={result.item} authFetch={authFetch} />;
  }
  return <OpenCard item={result.item} href={result.href} />;
}

function SearchResultsView({
  query,
  results,
  grouped,
  authFetch
}: {
  query: string;
  results: SearchResult[];
  grouped: boolean;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}) {
  if (results.length === 0) {
    return (
      <p
        data-testid="settings-home-search-empty"
        style={{ color: "var(--text-muted)", margin: 0 }}
      >
        {`No settings match "${query}".`}
      </p>
    );
  }

  const openResults = results.filter((r) => !r.locked);
  const lockedResults = results.filter((r) => r.locked);

  if (grouped) {
    // Grouped: section headings for open results, then locked divider.
    // Group by original section membership.
    const sectionGroups = SECTIONS.map((section) => {
      const sectionTos = new Set(section.items.map((i) => i.to));
      const sectionOpen = openResults.filter((r) => sectionTos.has(r.item.to));
      return { ...section, results: sectionOpen };
    }).filter((sg) => sg.results.length > 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {sectionGroups.map((sg) => (
          <div key={sg.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h3
              className="s7-type-label"
              style={{
                margin: 0,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                fontSize: "0.75rem",
                letterSpacing: "0.05em"
              }}
            >
              {sg.label}
            </h3>
            <ul style={GRID_STYLE}>
              {sg.results.map((r) => (
                <SearchResultCard
                  key={r.href}
                  result={r}
                  authFetch={authFetch}
                />
              ))}
            </ul>
          </div>
        ))}

        {lockedResults.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p
              style={{
                margin: 0,
                fontWeight: 600,
                color: "var(--text-muted)",
                borderTop: "1px solid var(--border, #e5e7eb)",
                paddingTop: 16
              }}
            >
              Needs access &mdash; {lockedResults.length}
            </p>
            <ul style={GRID_STYLE}>
              {lockedResults.map((r) => (
                <SearchResultCard
                  key={r.href}
                  result={r}
                  authFetch={authFetch}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Flat: all open results, then locked divider.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {openResults.length > 0 && (
        <ul style={GRID_STYLE}>
          {openResults.map((r) => (
            <SearchResultCard key={r.href} result={r} authFetch={authFetch} />
          ))}
        </ul>
      )}

      {lockedResults.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p
            style={{
              margin: 0,
              fontWeight: 600,
              color: "var(--text-muted)",
              borderTop: "1px solid var(--border, #e5e7eb)",
              paddingTop: 16
            }}
          >
            Needs access &mdash; {lockedResults.length}
          </p>
          <ul style={GRID_STYLE}>
            {lockedResults.map((r) => (
              <SearchResultCard
                key={r.href}
                result={r}
                authFetch={authFetch}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export function SettingsHomePage() {
  const { user, authFetch } = useAuth();
  const [grouped, setGrouped] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Partition each section's items into open/locked.
  const partitioned = SECTIONS.map((section) => {
    const { open, locked } = partitionSettingsNavItems(section.items, user);
    return { ...section, open, locked };
  });

  const totalOpen = partitioned.reduce((sum, s) => sum + s.open.length, 0);
  const allLocked = partitioned.flatMap((s) => s.locked);

  // Compute search results when query is non-empty.
  const trimmedQuery = searchQuery.trim();
  const searchResults = trimmedQuery
    ? searchSettings(SECTIONS, user, searchQuery)
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 className="s7-type-page-heading" style={{ margin: 0 }}>
            {totalOpen} {totalOpen === 1 ? "setting" : "settings"} you can open
          </h2>
        </div>
        <button
          type="button"
          aria-pressed={grouped}
          onClick={() => setGrouped((g) => !g)}
          style={{
            marginLeft: "auto",
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid var(--border, #e5e7eb)",
            background: grouped ? "var(--surface-2, #f3f4f6)" : "var(--surface, #fff)",
            fontWeight: 500,
            cursor: "pointer",
            color: "var(--text-primary)"
          }}
        >
          {grouped ? "Flat view" : "Grouped view"}
        </button>
      </header>

      {/* SLICE 3: search input */}
      <div>
        <input
          type="search"
          data-testid="settings-home-search"
          placeholder="Search settings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            maxWidth: 480,
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid var(--border, #e5e7eb)",
            background: "var(--surface, #fff)",
            color: "var(--text-primary)",
            fontSize: "0.9rem",
            boxSizing: "border-box"
          }}
        />
      </div>

      {/* Search results or full home view */}
      {searchResults !== null ? (
        <SearchResultsView
          query={trimmedQuery}
          results={searchResults}
          grouped={grouped}
          authFetch={authFetch}
        />
      ) : grouped ? (
        // Grouped: sections with their open items, then a single locked divider at the bottom.
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {partitioned.map((section) =>
            section.open.length > 0 ? (
              <div key={section.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3
                  className="s7-type-label"
                  style={{ margin: 0, color: "var(--text-muted)", textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.05em" }}
                >
                  {section.label}
                </h3>
                <ul style={GRID_STYLE}>
                  {section.open.map((item) => (
                    <OpenCard key={item.to} item={item} />
                  ))}
                </ul>
              </div>
            ) : null
          )}

          {allLocked.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  borderTop: "1px solid var(--border, #e5e7eb)",
                  paddingTop: 16
                }}
              >
                Needs access &mdash; {allLocked.length}
              </p>
              <ul style={GRID_STYLE}>
                {allLocked.map((item) => (
                  <LockedCard key={item.to} item={item} authFetch={authFetch} />
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        // Flat: all open cards, then locked divider, then locked cards.
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {totalOpen > 0 && (
            <ul style={GRID_STYLE}>
              {partitioned.flatMap((s) =>
                s.open.map((item) => <OpenCard key={item.to} item={item} />)
              )}
            </ul>
          )}

          {allLocked.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  borderTop: "1px solid var(--border, #e5e7eb)",
                  paddingTop: 16
                }}
              >
                Needs access &mdash; {allLocked.length}
              </p>
              <ul style={GRID_STYLE}>
                {allLocked.map((item) => (
                  <LockedCard key={item.to} item={item} authFetch={authFetch} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
