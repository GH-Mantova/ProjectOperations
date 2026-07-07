import { useEffect, useState } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

// NOTE (PR-486): Nav entry for /inventory is added in ShellLayout alongside
// Assets. ShellLayout does not currently permission-gate nav items — Marco's
// pilot users all hold the necessary codes today. If nav gating is introduced
// later, gate this entry on `inventory.view`.

type StockItem = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  quantityOnHand: string;
  reorderLevel: string | null;
  location: string | null;
  category?: { id: string; name: string } | null;
};

type StockMovement = {
  id: string;
  type: string;
  quantity: string;
  reason: string | null;
  createdAt: string;
};

type ItemsResponse = {
  items: StockItem[];
  total: number;
  page: number;
  pageSize: number;
};

type StocktakeSession = {
  id: string;
  status: string;
  startedAt: string;
};

const TAP_TARGET: React.CSSProperties = { minHeight: 44, minWidth: 44 };

function isLowStock(item: StockItem): boolean {
  if (item.reorderLevel === null || item.reorderLevel === undefined) return false;
  return Number(item.quantityOnHand) <= Number(item.reorderLevel);
}

export function InventoryPage() {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StockItem | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [stocktake, setStocktake] = useState<StocktakeSession | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authFetch("/inventory/items?page=1&pageSize=100");
        if (!response.ok) throw new Error("Could not load stock items.");
        const data = (await response.json()) as ItemsResponse;
        if (!cancelled) setItems(data.items);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  async function openItem(item: StockItem) {
    setSelected(item);
    setMovements([]);
    try {
      const response = await authFetch(`/inventory/items/${item.id}/movements`);
      if (response.ok) {
        setMovements((await response.json()) as StockMovement[]);
      }
    } catch {
      // swallow — drawer just shows empty state
    }
  }

  async function openStocktake() {
    try {
      const response = await authFetch("/inventory/stocktakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      if (!response.ok) throw new Error("Could not open stocktake.");
      const session = (await response.json()) as StocktakeSession;
      setStocktake(session);
      setCounts({});
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function commitStocktake() {
    if (!stocktake) return;
    try {
      // Push each count then commit.
      for (const [stockItemId, countedQty] of Object.entries(counts)) {
        if (countedQty === "" || Number.isNaN(Number(countedQty))) continue;
        await authFetch(`/inventory/stocktakes/${stocktake.id}/counts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stockItemId, countedQty: Number(countedQty) })
        });
      }
      const response = await authFetch(`/inventory/stocktakes/${stocktake.id}/commit`, {
        method: "POST"
      });
      if (!response.ok) throw new Error("Could not commit stocktake.");
      setStocktake(null);
      setCounts({});
      // Reload items so quantityOnHand reflects committed variances.
      const reload = await authFetch("/inventory/items?page=1&pageSize=100");
      if (reload.ok) setItems(((await reload.json()) as ItemsResponse).items);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Inventory</h1>
        <Skeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Inventory</h1>
        <p role="alert">{error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Inventory</h1>
        <button type="button" onClick={openStocktake} style={{ ...TAP_TARGET, padding: "0 16px" }}>
          New stocktake
        </button>
      </header>

      {items.length === 0 ? (
        <EmptyState heading="No stock items yet" subtext="Create your first stock item to start tracking." />
      ) : (
        <table style={{ width: "100%", marginTop: 16 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Name</th>
              <th style={{ textAlign: "left" }}>SKU</th>
              <th style={{ textAlign: "left" }}>Category</th>
              <th style={{ textAlign: "left" }}>Unit</th>
              <th style={{ textAlign: "right" }}>On hand</th>
              <th style={{ textAlign: "right" }}>Reorder</th>
              <th style={{ textAlign: "left" }}>Location</th>
              <th style={{ textAlign: "left" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => openItem(item)}
                style={{ cursor: "pointer", minHeight: 44 }}
              >
                <td>{item.name}</td>
                <td>{item.sku ?? "—"}</td>
                <td>{item.category?.name ?? "—"}</td>
                <td>{item.unit}</td>
                <td style={{ textAlign: "right" }}>{item.quantityOnHand}</td>
                <td style={{ textAlign: "right" }}>{item.reorderLevel ?? "—"}</td>
                <td>{item.location ?? "—"}</td>
                <td>
                  {isLowStock(item) ? (
                    <span className="s7-badge s7-badge--warning">Low stock</span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <aside
          style={{
            position: "fixed",
            right: 0,
            top: 0,
            bottom: 0,
            width: 360,
            background: "var(--surface-1, #fff)",
            borderLeft: "1px solid var(--surface-3, #ddd)",
            padding: 16,
            overflowY: "auto"
          }}
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={{ ...TAP_TARGET, marginBottom: 8 }}
          >
            Close
          </button>
          <h2>{selected.name}</h2>
          <p>
            On hand: {selected.quantityOnHand} {selected.unit}
          </p>
          <h3>Recent movements</h3>
          {movements.length === 0 ? (
            <p>No movements yet.</p>
          ) : (
            <ul>
              {movements.map((mv) => (
                <li key={mv.id}>
                  <strong>{mv.type}</strong> {mv.quantity}
                  {mv.reason ? ` — ${mv.reason}` : ""}
                  <br />
                  <small>{new Date(mv.createdAt).toLocaleString()}</small>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}

      {stocktake && (
        <aside
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            width: 400,
            background: "var(--surface-1, #fff)",
            borderRight: "1px solid var(--surface-3, #ddd)",
            padding: 16,
            overflowY: "auto"
          }}
        >
          <h2>Stocktake in progress</h2>
          <p>
            <small>Session: {stocktake.id}</small>
          </p>
          {items.map((item) => (
            <div key={item.id} style={{ marginBottom: 12 }}>
              <label>
                {item.name} ({item.unit})
                <br />
                <input
                  type="number"
                  step="0.0001"
                  value={counts[item.id] ?? ""}
                  onChange={(event) =>
                    setCounts((prev) => ({ ...prev, [item.id]: event.target.value }))
                  }
                  placeholder={`system: ${item.quantityOnHand}`}
                  style={{ ...TAP_TARGET, width: "100%" }}
                />
              </label>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={commitStocktake} style={TAP_TARGET}>
              Commit
            </button>
            <button
              type="button"
              onClick={() => {
                setStocktake(null);
                setCounts({});
              }}
              style={TAP_TARGET}
            >
              Cancel
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
