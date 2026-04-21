import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type ListItem = {
  id: string;
  value: string;
  label: string;
};

/**
 * Dropdown bound to a GlobalList slug. Appends a sentinel "+ Add …" option;
 * choosing it reveals an inline input that POSTs to /lists/:slug/items and
 * then reselects the newly-added item. Caches fetched items in component
 * state so rapid edits don't refetch on every render.
 */
export function ScopeListDropdown({
  slug,
  value,
  onChange,
  width,
  allowAdd = true,
  placeholder = "—",
  disabled
}: {
  slug: string;
  value: string | null;
  onChange: (v: string | null) => void;
  width?: number;
  allowAdd?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch(`/lists/${slug}/items`);
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as ListItem[];
      setItems(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitNew = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setError(null);
    try {
      const response = await authFetch(`/lists/${slug}/items`, {
        method: "POST",
        body: JSON.stringify({ label })
      });
      if (!response.ok) throw new Error(await response.text());
      const created = (await response.json()) as ListItem;
      setNewLabel("");
      setAdding(false);
      await load();
      onChange(created.value);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (adding && allowAdd) {
    return (
      <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
        <input
          autoFocus
          className="s7-input"
          style={{ width }}
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submitNew();
            } else if (e.key === "Escape") {
              setAdding(false);
              setNewLabel("");
            }
          }}
          onBlur={() => {
            if (newLabel.trim()) void submitNew();
            else setAdding(false);
          }}
          placeholder="New item label"
        />
        {error ? <span style={{ color: "var(--status-danger)", fontSize: 11 }}>{error}</span> : null}
      </div>
    );
  }

  return (
    <select
      className="s7-input"
      style={{ width }}
      value={value ?? ""}
      disabled={disabled || loading}
      onChange={(e) => {
        if (e.target.value === "__add__") {
          setAdding(true);
          return;
        }
        onChange(e.target.value || null);
      }}
    >
      <option value="">{placeholder}</option>
      {value && !items.some((i) => i.value === value) ? (
        // Preserve legacy/archived value so the cell still renders what was saved.
        <option value={value}>{value}</option>
      ) : null}
      {items.map((item) => (
        <option key={item.id} value={item.value}>
          {item.label}
        </option>
      ))}
      {allowAdd ? <option value="__add__">＋ Add…</option> : null}
    </select>
  );
}
