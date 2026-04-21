import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type ListSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: "STATIC" | "DYNAMIC";
  sourceModule: string | null;
  isSystem: boolean;
  itemCount: number | null;
};

type ListItem = {
  id: string;
  value: string;
  label: string;
  metadata: unknown;
  sortOrder: number;
  isArchived: boolean;
  createdById: string | null;
  source: "static" | "dynamic";
};

type ResolvedList = ListSummary & { items: ListItem[] };

export function GlobalListsSection({ isAdmin }: { isAdmin: boolean }) {
  const { authFetch } = useAuth();
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selected, setSelected] = useState<ResolvedList | null>(null);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const response = await authFetch("/lists");
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as ListSummary[];
      setLists(body);
      if (!selectedSlug && body.length > 0) setSelectedSlug(body[0].slug);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingLists(false);
    }
  }, [authFetch, selectedSlug]);

  const loadSelected = useCallback(
    async (slug: string) => {
      setLoadingItems(true);
      try {
        const response = await authFetch(`/lists/${slug}`);
        if (!response.ok) throw new Error(await response.text());
        setSelected((await response.json()) as ResolvedList);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingItems(false);
      }
    },
    [authFetch]
  );

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (selectedSlug) void loadSelected(selectedSlug);
  }, [selectedSlug, loadSelected]);

  const visibleItems = useMemo(() => {
    if (!selected) return [];
    return selected.items.filter((item) => showArchived || !item.isArchived);
  }, [selected, showArchived]);

  const archivedCount = useMemo(() => (selected ? selected.items.filter((i) => i.isArchived).length : 0), [selected]);

  const addItem = async () => {
    if (!selected || !newLabel.trim()) return;
    const response = await authFetch(`/lists/${selected.slug}/items`, {
      method: "POST",
      body: JSON.stringify({ label: newLabel.trim(), value: newValue.trim() || undefined })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    setNewLabel("");
    setNewValue("");
    await loadSelected(selected.slug);
  };

  const archiveItem = async (itemId: string, label: string) => {
    if (!selected) return;
    if (!window.confirm(`Archive "${label}"? It will no longer appear in dropdowns for new entries but will remain on existing records.`)) return;
    const response = await authFetch(`/lists/${selected.slug}/items/${itemId}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await loadSelected(selected.slug);
  };

  const restoreItem = async (itemId: string) => {
    if (!selected) return;
    const response = await authFetch(`/lists/${selected.slug}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ isArchived: false })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await loadSelected(selected.slug);
  };

  const createList = async () => {
    const name = newListName.trim();
    if (!name) return;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const response = await authFetch("/lists", {
      method: "POST",
      body: JSON.stringify({ name, slug, type: "STATIC" })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    setNewListName("");
    setNewListOpen(false);
    await loadLists();
    setSelectedSlug(slug);
  };

  return (
    <section className="s7-card" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h2 className="s7-type-section-heading" style={{ marginTop: 0, marginBottom: 4 }}>Lists</h2>
          <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 13 }}>
            Reference data used across the app. Static lists are editable by anyone; dynamic lists pull live from
            another module.
          </p>
        </div>
        {isAdmin ? (
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={() => setNewListOpen((v) => !v)}>
            {newListOpen ? "Cancel" : "+ New list"}
          </button>
        ) : null}
      </div>

      {newListOpen ? (
        <form
          style={{ display: "flex", gap: 6, marginBottom: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            void createList();
          }}
        >
          <input
            className="s7-input"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder="List name (slug auto-derived)"
          />
          <button type="submit" className="s7-btn s7-btn--primary" disabled={!newListName.trim()}>Create</button>
        </form>
      ) : null}

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 2fr", gap: 16 }}>
        <div style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 6, padding: 6, maxHeight: 420, overflow: "auto" }}>
          {loadingLists ? (
            <p style={{ color: "var(--text-muted)", padding: 8 }}>Loading…</p>
          ) : lists.length === 0 ? (
            <p style={{ color: "var(--text-muted)", padding: 8 }}>No lists yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {lists.map((l) => {
                const active = l.slug === selectedSlug;
                return (
                  <li
                    key={l.id}
                    onClick={() => setSelectedSlug(l.slug)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 4,
                      cursor: "pointer",
                      background: active ? "rgba(0,91,97,0.08)" : "transparent",
                      borderLeft: active ? "3px solid var(--brand-primary, #005B61)" : "3px solid transparent"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: active ? 600 : 400 }}>{l.name}</span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 999,
                          background: l.type === "DYNAMIC" ? "var(--brand-accent, #FEAA6D)" : "var(--surface-muted, #eef)",
                          color: l.type === "DYNAMIC" ? "#fff" : "var(--text)"
                        }}
                      >
                        {l.type}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {l.type === "DYNAMIC" ? `live from ${l.sourceModule ?? "?"}` : `${l.itemCount ?? 0} items`}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          {loadingItems || !selected ? (
            <p style={{ color: "var(--text-muted)" }}>Select a list.</p>
          ) : selected.type === "DYNAMIC" ? (
            <DynamicListView list={selected} />
          ) : (
            <StaticListView
              list={selected}
              visibleItems={visibleItems}
              archivedCount={archivedCount}
              showArchived={showArchived}
              setShowArchived={setShowArchived}
              newLabel={newLabel}
              setNewLabel={setNewLabel}
              newValue={newValue}
              setNewValue={setNewValue}
              onAdd={() => void addItem()}
              onArchive={(id, label) => void archiveItem(id, label)}
              onRestore={(id) => void restoreItem(id)}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function DynamicListView({ list }: { list: ResolvedList }) {
  const preview = list.items.slice(0, 10);
  return (
    <div>
      <div
        style={{
          padding: 10,
          borderRadius: 6,
          background: "rgba(254,170,109,0.1)",
          border: "1px solid var(--brand-accent, #FEAA6D)",
          marginBottom: 12
        }}
      >
        This list pulls live from <strong>{list.sourceModule}</strong>. Manage items in the{" "}
        <a href={`/${list.sourceModule}`}>{list.sourceModule}</a> module.
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
        {list.items.length} item{list.items.length === 1 ? "" : "s"} available · showing first 10
      </p>
      {preview.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Source module has no records yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {preview.map((item) => (
            <li
              key={item.id}
              style={{
                padding: "6px 10px",
                borderBottom: "1px solid var(--border, #e5e7eb)",
                fontSize: 13
              }}
            >
              <strong>{item.label}</strong>
              <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>({item.value})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StaticListView({
  list,
  visibleItems,
  archivedCount,
  showArchived,
  setShowArchived,
  newLabel,
  setNewLabel,
  newValue,
  setNewValue,
  onAdd,
  onArchive,
  onRestore
}: {
  list: ResolvedList;
  visibleItems: ListItem[];
  archivedCount: number;
  showArchived: boolean;
  setShowArchived: (v: boolean) => void;
  newLabel: string;
  setNewLabel: (v: string) => void;
  newValue: string;
  setNewValue: (v: string) => void;
  onAdd: () => void;
  onArchive: (id: string, label: string) => void;
  onRestore: (id: string) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>{list.name}</h3>
        {archivedCount > 0 ? (
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
          </button>
        ) : null}
      </div>
      {list.description ? <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0 }}>{list.description}</p> : null}

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {visibleItems.map((item) => (
          <li
            key={item.id}
            style={{
              padding: "8px 10px",
              borderBottom: "1px solid var(--border, #e5e7eb)",
              display: "flex",
              gap: 10,
              alignItems: "center",
              opacity: item.isArchived ? 0.55 : 1
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>
                {item.label}
                {item.isArchived ? <span style={{ fontSize: 11, marginLeft: 8, color: "var(--text-muted)" }}>· archived</span> : null}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>value: {item.value}</div>
            </div>
            {item.isArchived ? (
              <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => onRestore(item.id)}>Restore</button>
            ) : (
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                onClick={() => onArchive(item.id, item.label)}
                aria-label={`Archive ${item.label}`}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>

      <form
        style={{ display: "flex", gap: 6, marginTop: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          onAdd();
        }}
      >
        <input
          className="s7-input"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Label (required)"
          style={{ flex: 2 }}
        />
        <input
          className="s7-input"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="Value (auto from label)"
          style={{ flex: 1 }}
        />
        <button type="submit" className="s7-btn s7-btn--primary" disabled={!newLabel.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}
