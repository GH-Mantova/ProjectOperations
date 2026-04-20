import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type Decimal = string;

type LabourLine = { id: string; role: string; qty: Decimal; days: Decimal; shift: string; rate: Decimal; sortOrder: number };
type PlantLine = { id: string; plantItem: string; qty: Decimal; days: Decimal; comment: string | null; rate: Decimal; sortOrder: number };
type WasteLine = {
  id: string;
  wasteGroup: string | null;
  wasteType: string;
  facility: string;
  qtyTonnes: Decimal;
  tonRate: Decimal;
  loads: number;
  loadRate: Decimal;
  sortOrder: number;
};
type CuttingLine = { id: string; cuttingType: string; qty: Decimal; unit: string; comment: string | null; rate: Decimal; sortOrder: number };
type Assumption = { id: string; text: string; sortOrder: number };

type EstimateItem = {
  id: string;
  code: string;
  itemNumber: number;
  title: string;
  description: string | null;
  markup: Decimal;
  isProvisional: boolean;
  provisionalAmount: Decimal | null;
  sortOrder: number;
  labourLines: LabourLine[];
  plantLines: PlantLine[];
  wasteLines: WasteLine[];
  cuttingLines: CuttingLine[];
  assumptions: Assumption[];
};

type Estimate = {
  id: string;
  tenderId: string;
  markup: Decimal;
  notes: string | null;
  lockedAt: string | null;
  lockedById: string | null;
  items: EstimateItem[];
};

type Summary = {
  estimateId: string | null;
  markup: number;
  locked: boolean;
  items: Array<{
    itemId: string;
    code: string;
    itemNumber: number;
    title: string;
    isProvisional: boolean;
    labour: number;
    plant: number;
    waste: number;
    cutting: number;
    subtotal: number;
    markup: number;
    price: number;
  }>;
  totals: { labour: number; plant: number; waste: number; cutting: number; subtotal: number; price: number };
  markupAmount: number;
};

type LabourRate = { id: string; role: string; dayRate: Decimal; nightRate: Decimal; weekendRate: Decimal; isActive: boolean };
type PlantRate = { id: string; item: string; unit: string; rate: Decimal; fuelRate: Decimal; isActive: boolean };
type WasteRate = { id: string; wasteType: string; facility: string; tonRate: Decimal; loadRate: Decimal; isActive: boolean };
type CuttingRate = { id: string; cuttingType: string; unit: string; rate: Decimal; isActive: boolean };

const CODE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "SO", label: "SO — Site Overheads" },
  { value: "Str", label: "Str — Structural Demo" },
  { value: "Asb", label: "Asb — Asbestos" },
  { value: "Civ", label: "Civ — Civil Works" },
  { value: "Prv", label: "Prv — Provisional" }
];

const SHIFT_OPTIONS = ["Day", "Night", "Weekend"];
const LINE_TAB_OPTIONS: Array<{ key: LineTab; label: string }> = [
  { key: "labour", label: "Labour" },
  { key: "plant", label: "Plant" },
  { key: "waste", label: "Waste" },
  { key: "cutting", label: "Cutting" },
  { key: "assumptions", label: "Assumptions" }
];

type LineTab = "labour" | "plant" | "waste" | "cutting" | "assumptions";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(n);
}

function num(value: Decimal | null | undefined): string {
  return value ?? "0";
}

export function EstimateEditor({ tenderId, canManage, canAdmin }: { tenderId: string; canManage: boolean; canAdmin: boolean }) {
  const { authFetch } = useAuth();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [tab, setTab] = useState<LineTab>("labour");
  const [rates, setRates] = useState<{
    labour: LabourRate[];
    plant: PlantRate[];
    waste: WasteRate[];
    cutting: CuttingRate[];
  }>({ labour: [], plant: [], waste: [], cutting: [] });

  const reloadSummary = useCallback(async () => {
    const response = await authFetch(`/tenders/${tenderId}/estimate/summary`);
    if (response.ok) setSummary((await response.json()) as Summary);
  }, [authFetch, tenderId]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/tenders/${tenderId}/estimate`);
      if (!response.ok) throw new Error("Could not load estimate.");
      const data = (await response.json()) as Estimate | null;
      setEstimate(data);
      setSelectedItemId((prev) => {
        if (!data) return null;
        if (prev && data.items.some((item) => item.id === prev)) return prev;
        return data.items[0]?.id ?? null;
      });
      await reloadSummary();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId, reloadSummary]);

  const loadRates = useCallback(async () => {
    const [l, p, w, c] = await Promise.all([
      authFetch(`/estimate-rates/labour`).then((r) => (r.ok ? (r.json() as Promise<LabourRate[]>) : [])),
      authFetch(`/estimate-rates/plant`).then((r) => (r.ok ? (r.json() as Promise<PlantRate[]>) : [])),
      authFetch(`/estimate-rates/waste`).then((r) => (r.ok ? (r.json() as Promise<WasteRate[]>) : [])),
      authFetch(`/estimate-rates/cutting`).then((r) => (r.ok ? (r.json() as Promise<CuttingRate[]>) : []))
    ]);
    setRates({
      labour: (l as LabourRate[]).filter((x) => x.isActive),
      plant: (p as PlantRate[]).filter((x) => x.isActive),
      waste: (w as WasteRate[]).filter((x) => x.isActive),
      cutting: (c as CuttingRate[]).filter((x) => x.isActive)
    });
  }, [authFetch]);

  useEffect(() => {
    void reload();
    void loadRates();
  }, [reload, loadRates]);

  const locked = estimate?.lockedAt != null;
  const disabled = locked || !canManage;
  const selectedItem = estimate?.items.find((item) => item.id === selectedItemId) ?? null;

  const mutate = useCallback(
    async (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => {
      setSaving(true);
      setError(null);
      try {
        const response = await authFetch(path, {
          method,
          body: body ? JSON.stringify(body) : undefined
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || `${method} ${path} failed.`);
        }
        if (method !== "DELETE" || path.includes("/items/")) {
          const data = (await response.json()) as Estimate;
          setEstimate(data);
          setSelectedItemId((prev) => {
            if (!prev && data.items.length > 0) return data.items[0].id;
            if (prev && !data.items.some((item) => item.id === prev)) return data.items[0]?.id ?? null;
            return prev;
          });
        }
        await reloadSummary();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [authFetch, reloadSummary]
  );

  const createEstimate = async () => {
    setSaving(true);
    try {
      const response = await authFetch(`/tenders/${tenderId}/estimate`, { method: "POST" });
      if (!response.ok) throw new Error("Could not create estimate.");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const lock = () => mutate(`/tenders/${tenderId}/estimate/lock`, "POST");
  const unlock = () => mutate(`/tenders/${tenderId}/estimate/unlock`, "POST");

  const updateEstimateField = (patch: Partial<{ markup: string; notes: string }>) =>
    mutate(`/tenders/${tenderId}/estimate`, "PATCH", patch);

  if (loading) {
    return (
      <div className="s7-card">
        <Skeleton width="40%" height={24} />
        <Skeleton width="100%" height={200} style={{ marginTop: 16 }} />
      </div>
    );
  }

  if (!estimate) {
    return (
      <section className="s7-card">
        <EmptyState
          heading="No estimate yet"
          subtext="Start a cost build for this tender. You'll be able to add scope items, labour, plant, waste, cutting and assumptions."
          action={
            canManage ? (
              <button type="button" className="s7-btn s7-btn--primary" onClick={createEstimate} disabled={saving}>
                {saving ? "Creating…" : "Create estimate"}
              </button>
            ) : null
          }
        />
      </section>
    );
  }

  return (
    <div className="estimate-editor">
      {error ? (
        <div className="s7-card" role="alert" style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}>
          {error}
        </div>
      ) : null}

      <section className="s7-card estimate-editor__header">
        <div className="estimate-editor__header-row">
          <div>
            <p className="s7-type-label">Estimate</p>
            <h2 className="s7-type-section-heading" style={{ margin: "4px 0 0" }}>
              {summary ? formatCurrency(summary.totals.price) : formatCurrency(0)}
              <span style={{ marginLeft: 8, color: "var(--text-muted)", fontSize: 14 }}>tender price</span>
            </h2>
          </div>
          <div className="estimate-editor__header-actions">
            {locked ? (
              <span className="s7-badge s7-badge--warning">Locked</span>
            ) : (
              <span className="s7-badge s7-badge--neutral">Draft</span>
            )}
            {!locked && canManage ? (
              <button type="button" className="s7-btn s7-btn--secondary" onClick={lock} disabled={saving}>
                Lock
              </button>
            ) : null}
            {locked && canAdmin ? (
              <button type="button" className="s7-btn s7-btn--secondary" onClick={unlock} disabled={saving}>
                Unlock
              </button>
            ) : null}
          </div>
        </div>
        <div className="estimate-editor__header-controls">
          <label className="estimate-editor__field">
            <span>Overall markup %</span>
            <input
              type="number"
              step="0.01"
              className="s7-input"
              defaultValue={num(estimate.markup)}
              disabled={disabled}
              onBlur={(event) => {
                const value = event.target.value;
                if (value !== num(estimate.markup)) void updateEstimateField({ markup: value });
              }}
            />
          </label>
          <label className="estimate-editor__field estimate-editor__field--wide">
            <span>Notes</span>
            <input
              type="text"
              className="s7-input"
              defaultValue={estimate.notes ?? ""}
              disabled={disabled}
              onBlur={(event) => {
                if (event.target.value !== (estimate.notes ?? "")) void updateEstimateField({ notes: event.target.value });
              }}
            />
          </label>
        </div>
      </section>

      <div className="estimate-editor__body">
        <aside className="estimate-editor__items s7-card">
          <div className="estimate-editor__items-head">
            <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Scope items</h3>
          </div>
          {canManage && !locked ? <AddItemForm tenderId={tenderId} onAdd={mutate} saving={saving} /> : null}
          {estimate.items.length === 0 ? (
            <p style={{ color: "var(--text-muted)", marginTop: 12 }}>No scope items yet.</p>
          ) : (
            <ul className="estimate-editor__item-list">
              {estimate.items.map((item) => {
                const rollup = summary?.items.find((s) => s.itemId === item.id);
                const active = item.id === selectedItemId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={active ? "estimate-editor__item estimate-editor__item--active" : "estimate-editor__item"}
                      onClick={() => setSelectedItemId(item.id)}
                    >
                      <span className="estimate-editor__item-code">
                        {item.code}-{item.itemNumber}
                      </span>
                      <span className="estimate-editor__item-title">{item.title}</span>
                      <span className="estimate-editor__item-price">
                        {rollup ? formatCurrency(rollup.price) : "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="estimate-editor__detail s7-card">
          {selectedItem ? (
            <ItemDetail
              key={selectedItem.id}
              tenderId={tenderId}
              item={selectedItem}
              summary={summary?.items.find((s) => s.itemId === selectedItem.id) ?? null}
              rates={rates}
              disabled={disabled}
              canManage={canManage}
              saving={saving}
              mutate={mutate}
              tab={tab}
              setTab={setTab}
            />
          ) : (
            <EmptyState heading="Select a scope item" subtext="Pick an item from the list to edit its costs." />
          )}
        </section>
      </div>

      {summary ? (
        <section className="s7-card estimate-editor__totals">
          <div className="estimate-editor__total-row">
            <span>Labour</span>
            <strong>{formatCurrency(summary.totals.labour)}</strong>
          </div>
          <div className="estimate-editor__total-row">
            <span>Plant</span>
            <strong>{formatCurrency(summary.totals.plant)}</strong>
          </div>
          <div className="estimate-editor__total-row">
            <span>Waste</span>
            <strong>{formatCurrency(summary.totals.waste)}</strong>
          </div>
          <div className="estimate-editor__total-row">
            <span>Cutting</span>
            <strong>{formatCurrency(summary.totals.cutting)}</strong>
          </div>
          <div className="estimate-editor__total-row estimate-editor__total-row--strong">
            <span>Subtotal</span>
            <strong>{formatCurrency(summary.totals.subtotal)}</strong>
          </div>
          <div className="estimate-editor__total-row">
            <span>Markup</span>
            <strong>{formatCurrency(summary.markupAmount)}</strong>
          </div>
          <div className="estimate-editor__total-row estimate-editor__total-row--price">
            <span>Tender price</span>
            <strong>{formatCurrency(summary.totals.price)}</strong>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function AddItemForm({
  tenderId,
  onAdd,
  saving
}: {
  tenderId: string;
  onAdd: (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => Promise<void>;
  saving: boolean;
}) {
  const [code, setCode] = useState("SO");
  const [title, setTitle] = useState("");
  const [isProvisional, setIsProvisional] = useState(false);
  const [provisionalAmount, setProvisionalAmount] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    await onAdd(`/tenders/${tenderId}/estimate/items`, "POST", {
      code,
      title: title.trim(),
      isProvisional,
      provisionalAmount: isProvisional && provisionalAmount ? provisionalAmount : undefined
    });
    setTitle("");
    setProvisionalAmount("");
    setIsProvisional(false);
  };

  return (
    <form className="estimate-editor__add-item" onSubmit={submit}>
      <div className="estimate-editor__add-item-row">
        <select className="s7-input" value={code} onChange={(e) => setCode(e.target.value)}>
          {CODE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          className="s7-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Item title…"
        />
      </div>
      <div className="estimate-editor__add-item-row">
        <label className="estimate-editor__checkbox">
          <input type="checkbox" checked={isProvisional} onChange={(e) => setIsProvisional(e.target.checked)} />
          Provisional
        </label>
        {isProvisional ? (
          <input
            className="s7-input"
            type="number"
            step="0.01"
            value={provisionalAmount}
            onChange={(e) => setProvisionalAmount(e.target.value)}
            placeholder="Provisional amount"
          />
        ) : null}
        <button type="submit" className="s7-btn s7-btn--primary s7-btn--sm" disabled={saving || !title.trim()}>
          Add
        </button>
      </div>
    </form>
  );
}

function ItemDetail({
  tenderId,
  item,
  summary,
  rates,
  disabled,
  canManage,
  saving,
  mutate,
  tab,
  setTab
}: {
  tenderId: string;
  item: EstimateItem;
  summary: Summary["items"][number] | null;
  rates: { labour: LabourRate[]; plant: PlantRate[]; waste: WasteRate[]; cutting: CuttingRate[] };
  disabled: boolean;
  canManage: boolean;
  saving: boolean;
  mutate: (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => Promise<void>;
  tab: LineTab;
  setTab: (t: LineTab) => void;
}) {
  const base = `/tenders/${tenderId}/estimate/items/${item.id}`;
  const deleteItem = async () => {
    if (!window.confirm(`Delete item ${item.code}-${item.itemNumber} "${item.title}"?`)) return;
    await mutate(`/tenders/${tenderId}/estimate/items/${item.id}`, "DELETE");
  };

  return (
    <div className="estimate-editor__item-detail">
      <div className="estimate-editor__detail-head">
        <div>
          <span className="s7-type-label">{item.code}-{item.itemNumber}</span>
          <input
            className="s7-input estimate-editor__detail-title"
            defaultValue={item.title}
            disabled={disabled}
            onBlur={(e) => {
              if (e.target.value !== item.title) void mutate(base, "PATCH", { title: e.target.value });
            }}
          />
        </div>
        <div className="estimate-editor__detail-actions">
          <label className="estimate-editor__field">
            <span>Markup %</span>
            <input
              type="number"
              step="0.01"
              className="s7-input"
              defaultValue={item.markup}
              disabled={disabled || item.isProvisional}
              onBlur={(e) => {
                if (e.target.value !== item.markup) void mutate(base, "PATCH", { markup: e.target.value });
              }}
            />
          </label>
          <label className="estimate-editor__checkbox">
            <input
              type="checkbox"
              checked={item.isProvisional}
              disabled={disabled}
              onChange={(e) => void mutate(base, "PATCH", { isProvisional: e.target.checked })}
            />
            Provisional
          </label>
          {item.isProvisional ? (
            <label className="estimate-editor__field">
              <span>Provisional $</span>
              <input
                type="number"
                step="0.01"
                className="s7-input"
                defaultValue={item.provisionalAmount ?? ""}
                disabled={disabled}
                onBlur={(e) => {
                  if (e.target.value !== (item.provisionalAmount ?? "")) {
                    void mutate(base, "PATCH", { provisionalAmount: e.target.value || null });
                  }
                }}
              />
            </label>
          ) : null}
          {canManage && !disabled ? (
            <button type="button" className="s7-btn s7-btn--danger s7-btn--sm" onClick={deleteItem} disabled={saving}>
              Delete item
            </button>
          ) : null}
        </div>
      </div>

      <div className="estimate-editor__detail-summary">
        <span>Labour: <strong>{summary ? formatCurrency(summary.labour) : "—"}</strong></span>
        <span>Plant: <strong>{summary ? formatCurrency(summary.plant) : "—"}</strong></span>
        <span>Waste: <strong>{summary ? formatCurrency(summary.waste) : "—"}</strong></span>
        <span>Cutting: <strong>{summary ? formatCurrency(summary.cutting) : "—"}</strong></span>
        <span>Subtotal: <strong>{summary ? formatCurrency(summary.subtotal) : "—"}</strong></span>
        <span className="estimate-editor__detail-price">Price: <strong>{summary ? formatCurrency(summary.price) : "—"}</strong></span>
      </div>

      <nav className="estimate-editor__tabs" role="tablist">
        {LINE_TAB_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={tab === opt.key}
            className={tab === opt.key ? "estimate-editor__tab estimate-editor__tab--active" : "estimate-editor__tab"}
            onClick={() => setTab(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </nav>

      <div className="estimate-editor__tab-content">
        {tab === "labour" && <LabourTab item={item} rates={rates.labour} disabled={disabled} mutate={mutate} base={base} />}
        {tab === "plant" && <PlantTab item={item} rates={rates.plant} disabled={disabled} mutate={mutate} base={base} />}
        {tab === "waste" && <WasteTab item={item} rates={rates.waste} disabled={disabled} mutate={mutate} base={base} />}
        {tab === "cutting" && <CuttingTab item={item} rates={rates.cutting} disabled={disabled} mutate={mutate} base={base} />}
        {tab === "assumptions" && <AssumptionsTab item={item} disabled={disabled} mutate={mutate} base={base} />}
      </div>
    </div>
  );
}

type Mutator = (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => Promise<void>;

function LabourTab({ item, rates, disabled, mutate, base }: { item: EstimateItem; rates: LabourRate[]; disabled: boolean; mutate: Mutator; base: string }) {
  const [role, setRole] = useState(rates[0]?.role ?? "");
  const [qty, setQty] = useState("1");
  const [days, setDays] = useState("1");
  const [shift, setShift] = useState("Day");

  const rate = useMemo(() => {
    const r = rates.find((x) => x.role === role);
    if (!r) return "0";
    if (shift === "Night") return r.nightRate;
    if (shift === "Weekend") return r.weekendRate;
    return r.dayRate;
  }, [rates, role, shift]);

  const add = async () => {
    if (!role) return;
    await mutate(`${base}/labour`, "POST", { role, qty, days, shift, rate });
    setQty("1");
    setDays("1");
  };

  return (
    <div className="estimate-editor__lines">
      {!disabled ? (
        <div className="estimate-editor__line-add">
          <select className="s7-input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">Select role…</option>
            {rates.map((r) => (
              <option key={r.id} value={r.role}>{r.role}</option>
            ))}
          </select>
          <input type="number" step="0.01" className="s7-input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" />
          <input type="number" step="0.01" className="s7-input" value={days} onChange={(e) => setDays(e.target.value)} placeholder="Days" />
          <select className="s7-input" value={shift} onChange={(e) => setShift(e.target.value)}>
            {SHIFT_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
          <span className="estimate-editor__rate-preview">{formatCurrency(Number(rate))}</span>
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={!role}>Add</button>
        </div>
      ) : null}
      {item.labourLines.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No labour lines.</p>
      ) : (
        <table className="estimate-editor__table">
          <thead>
            <tr><th>Role</th><th>Qty</th><th>Days</th><th>Shift</th><th>Rate</th><th>Total</th><th /></tr>
          </thead>
          <tbody>
            {item.labourLines.map((line) => {
              const total = Number(line.qty) * Number(line.days) * Number(line.rate);
              return (
                <tr key={line.id}>
                  <td>{line.role}</td>
                  <td>
                    <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={line.qty} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.qty) void mutate(`${base}/labour/${line.id}`, "PATCH", { qty: e.target.value }); }} />
                  </td>
                  <td>
                    <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={line.days} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.days) void mutate(`${base}/labour/${line.id}`, "PATCH", { days: e.target.value }); }} />
                  </td>
                  <td>
                    <select className="s7-input s7-input--sm" defaultValue={line.shift} disabled={disabled}
                      onChange={(e) => void mutate(`${base}/labour/${line.id}`, "PATCH", { shift: e.target.value })}>
                      {SHIFT_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </td>
                  <td>
                    <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={line.rate} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.rate) void mutate(`${base}/labour/${line.id}`, "PATCH", { rate: e.target.value }); }} />
                  </td>
                  <td><strong>{formatCurrency(total)}</strong></td>
                  <td>
                    {!disabled ? (
                      <button type="button" className="s7-btn s7-btn--danger s7-btn--sm" onClick={() => void mutate(`${base}/labour/${line.id}`, "DELETE")}>Remove</button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PlantTab({ item, rates, disabled, mutate, base }: { item: EstimateItem; rates: PlantRate[]; disabled: boolean; mutate: Mutator; base: string }) {
  const [plantItem, setPlantItem] = useState(rates[0]?.item ?? "");
  const [qty, setQty] = useState("1");
  const [days, setDays] = useState("1");
  const [comment, setComment] = useState("");
  const rate = rates.find((r) => r.item === plantItem)?.rate ?? "0";

  const add = async () => {
    if (!plantItem) return;
    await mutate(`${base}/plant`, "POST", { plantItem, qty, days, comment: comment || undefined, rate });
    setQty("1");
    setDays("1");
    setComment("");
  };

  return (
    <div className="estimate-editor__lines">
      {!disabled ? (
        <div className="estimate-editor__line-add">
          <select className="s7-input" value={plantItem} onChange={(e) => setPlantItem(e.target.value)}>
            <option value="">Select plant…</option>
            {rates.map((r) => (<option key={r.id} value={r.item}>{r.item}</option>))}
          </select>
          <input type="number" step="0.01" className="s7-input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" />
          <input type="number" step="0.01" className="s7-input" value={days} onChange={(e) => setDays(e.target.value)} placeholder="Days" />
          <input className="s7-input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment" />
          <span className="estimate-editor__rate-preview">{formatCurrency(Number(rate))}</span>
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={!plantItem}>Add</button>
        </div>
      ) : null}
      {item.plantLines.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No plant lines.</p>
      ) : (
        <table className="estimate-editor__table">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Days</th><th>Rate</th><th>Comment</th><th>Total</th><th /></tr>
          </thead>
          <tbody>
            {item.plantLines.map((line) => {
              const total = Number(line.qty) * Number(line.days) * Number(line.rate);
              return (
                <tr key={line.id}>
                  <td>{line.plantItem}</td>
                  <td>
                    <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={line.qty} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.qty) void mutate(`${base}/plant/${line.id}`, "PATCH", { qty: e.target.value }); }} />
                  </td>
                  <td>
                    <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={line.days} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.days) void mutate(`${base}/plant/${line.id}`, "PATCH", { days: e.target.value }); }} />
                  </td>
                  <td>
                    <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={line.rate} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.rate) void mutate(`${base}/plant/${line.id}`, "PATCH", { rate: e.target.value }); }} />
                  </td>
                  <td>
                    <input className="s7-input s7-input--sm" defaultValue={line.comment ?? ""} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== (line.comment ?? "")) void mutate(`${base}/plant/${line.id}`, "PATCH", { comment: e.target.value }); }} />
                  </td>
                  <td><strong>{formatCurrency(total)}</strong></td>
                  <td>
                    {!disabled ? (
                      <button type="button" className="s7-btn s7-btn--danger s7-btn--sm" onClick={() => void mutate(`${base}/plant/${line.id}`, "DELETE")}>Remove</button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function WasteTab({ item, rates, disabled, mutate, base }: { item: EstimateItem; rates: WasteRate[]; disabled: boolean; mutate: Mutator; base: string }) {
  const [selection, setSelection] = useState(rates[0] ? `${rates[0].wasteType}__${rates[0].facility}` : "");
  const [qtyTonnes, setQtyTonnes] = useState("1");
  const [loads, setLoads] = useState("0");

  const [wasteType, facility] = selection.split("__");
  const current = rates.find((r) => r.wasteType === wasteType && r.facility === facility);
  const tonRate = current?.tonRate ?? "0";
  const loadRate = current?.loadRate ?? "0";

  const add = async () => {
    if (!current) return;
    await mutate(`${base}/waste`, "POST", {
      wasteType: current.wasteType,
      facility: current.facility,
      qtyTonnes,
      tonRate: current.tonRate,
      loads: Number(loads),
      loadRate: current.loadRate
    });
    setQtyTonnes("1");
    setLoads("0");
  };

  return (
    <div className="estimate-editor__lines">
      {!disabled ? (
        <div className="estimate-editor__line-add">
          <select className="s7-input" value={selection} onChange={(e) => setSelection(e.target.value)}>
            <option value="">Select waste…</option>
            {rates.map((r) => (
              <option key={r.id} value={`${r.wasteType}__${r.facility}`}>{r.wasteType} @ {r.facility}</option>
            ))}
          </select>
          <input type="number" step="0.01" className="s7-input" value={qtyTonnes} onChange={(e) => setQtyTonnes(e.target.value)} placeholder="Tonnes" />
          <input type="number" step="1" className="s7-input" value={loads} onChange={(e) => setLoads(e.target.value)} placeholder="Loads" />
          <span className="estimate-editor__rate-preview">{formatCurrency(Number(tonRate))}/t + {formatCurrency(Number(loadRate))}/load</span>
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={!current}>Add</button>
        </div>
      ) : null}
      {item.wasteLines.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No waste lines.</p>
      ) : (
        <table className="estimate-editor__table">
          <thead>
            <tr><th>Type</th><th>Facility</th><th>Tonnes</th><th>$/t</th><th>Loads</th><th>$/load</th><th>Total</th><th /></tr>
          </thead>
          <tbody>
            {item.wasteLines.map((line) => {
              const total = Number(line.qtyTonnes) * Number(line.tonRate) + line.loads * Number(line.loadRate);
              return (
                <tr key={line.id}>
                  <td>{line.wasteType}</td>
                  <td>{line.facility}</td>
                  <td>
                    <input type="number" step="0.001" className="s7-input s7-input--sm" defaultValue={line.qtyTonnes} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.qtyTonnes) void mutate(`${base}/waste/${line.id}`, "PATCH", { qtyTonnes: e.target.value }); }} />
                  </td>
                  <td>
                    <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={line.tonRate} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.tonRate) void mutate(`${base}/waste/${line.id}`, "PATCH", { tonRate: e.target.value }); }} />
                  </td>
                  <td>
                    <input type="number" step="1" className="s7-input s7-input--sm" defaultValue={line.loads} disabled={disabled}
                      onBlur={(e) => { if (Number(e.target.value) !== line.loads) void mutate(`${base}/waste/${line.id}`, "PATCH", { loads: Number(e.target.value) }); }} />
                  </td>
                  <td>
                    <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={line.loadRate} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.loadRate) void mutate(`${base}/waste/${line.id}`, "PATCH", { loadRate: e.target.value }); }} />
                  </td>
                  <td><strong>{formatCurrency(total)}</strong></td>
                  <td>
                    {!disabled ? (
                      <button type="button" className="s7-btn s7-btn--danger s7-btn--sm" onClick={() => void mutate(`${base}/waste/${line.id}`, "DELETE")}>Remove</button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CuttingTab({ item, rates, disabled, mutate, base }: { item: EstimateItem; rates: CuttingRate[]; disabled: boolean; mutate: Mutator; base: string }) {
  const [cuttingType, setCuttingType] = useState(rates[0]?.cuttingType ?? "");
  const [qty, setQty] = useState("1");
  const [comment, setComment] = useState("");
  const current = rates.find((r) => r.cuttingType === cuttingType);
  const unit = current?.unit ?? "";
  const rate = current?.rate ?? "0";

  const add = async () => {
    if (!current) return;
    await mutate(`${base}/cutting`, "POST", { cuttingType: current.cuttingType, qty, unit: current.unit, comment: comment || undefined, rate: current.rate });
    setQty("1");
    setComment("");
  };

  return (
    <div className="estimate-editor__lines">
      {!disabled ? (
        <div className="estimate-editor__line-add">
          <select className="s7-input" value={cuttingType} onChange={(e) => setCuttingType(e.target.value)}>
            <option value="">Select cutting…</option>
            {rates.map((r) => (<option key={r.id} value={r.cuttingType}>{r.cuttingType} ({r.unit})</option>))}
          </select>
          <input type="number" step="0.01" className="s7-input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={`Qty (${unit || "unit"})`} />
          <input className="s7-input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment" />
          <span className="estimate-editor__rate-preview">{formatCurrency(Number(rate))}/{unit || "unit"}</span>
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={!current}>Add</button>
        </div>
      ) : null}
      {item.cuttingLines.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No cutting lines.</p>
      ) : (
        <table className="estimate-editor__table">
          <thead>
            <tr><th>Type</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Comment</th><th>Total</th><th /></tr>
          </thead>
          <tbody>
            {item.cuttingLines.map((line) => {
              const total = Number(line.qty) * Number(line.rate);
              return (
                <tr key={line.id}>
                  <td>{line.cuttingType}</td>
                  <td>
                    <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={line.qty} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.qty) void mutate(`${base}/cutting/${line.id}`, "PATCH", { qty: e.target.value }); }} />
                  </td>
                  <td>{line.unit}</td>
                  <td>
                    <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={line.rate} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.rate) void mutate(`${base}/cutting/${line.id}`, "PATCH", { rate: e.target.value }); }} />
                  </td>
                  <td>
                    <input className="s7-input s7-input--sm" defaultValue={line.comment ?? ""} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== (line.comment ?? "")) void mutate(`${base}/cutting/${line.id}`, "PATCH", { comment: e.target.value }); }} />
                  </td>
                  <td><strong>{formatCurrency(total)}</strong></td>
                  <td>
                    {!disabled ? (
                      <button type="button" className="s7-btn s7-btn--danger s7-btn--sm" onClick={() => void mutate(`${base}/cutting/${line.id}`, "DELETE")}>Remove</button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AssumptionsTab({ item, disabled, mutate, base }: { item: EstimateItem; disabled: boolean; mutate: Mutator; base: string }) {
  const [text, setText] = useState("");
  const add = async () => {
    if (!text.trim()) return;
    await mutate(`${base}/assumptions`, "POST", { text: text.trim() });
    setText("");
  };
  return (
    <div className="estimate-editor__lines">
      {!disabled ? (
        <div className="estimate-editor__line-add">
          <input className="s7-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Assumption…" />
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={!text.trim()}>Add</button>
        </div>
      ) : null}
      {item.assumptions.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No assumptions.</p>
      ) : (
        <ul className="estimate-editor__assumption-list">
          {item.assumptions.map((a) => (
            <li key={a.id} className="estimate-editor__assumption">
              <input
                className="s7-input"
                defaultValue={a.text}
                disabled={disabled}
                onBlur={(e) => { if (e.target.value !== a.text) void mutate(`${base}/assumptions/${a.id}`, "PATCH", { text: e.target.value }); }}
              />
              {!disabled ? (
                <button type="button" className="s7-btn s7-btn--danger s7-btn--sm"
                  onClick={() => void mutate(`${base}/assumptions/${a.id}`, "DELETE")}>Remove</button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
