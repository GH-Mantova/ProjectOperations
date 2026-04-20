import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type Decimal = string;

type LabourLine = { id: string; role: string; qty: Decimal; days: Decimal; shift: string; rate: Decimal; sortOrder: number };
type EquipLine = { id: string; description: string; qty: Decimal; duration: Decimal; period: string; rate: Decimal; sortOrder: number };
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
type CuttingLine = {
  id: string;
  cuttingType: string;
  equipment: string | null;
  elevation: string | null;
  material: string | null;
  depthMm: number | null;
  diameterMm: number | null;
  qty: Decimal;
  unit: string;
  comment: string | null;
  rate: Decimal;
  sortOrder: number;
};
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
  equipLines: EquipLine[];
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

type SummaryItem = {
  itemId: string;
  code: string;
  itemNumber: number;
  title: string;
  isProvisional: boolean;
  labour: number;
  equip: number;
  plant: number;
  waste: number;
  cutting: number;
  subtotal: number;
  markup: number;
  price: number;
};

type Summary = {
  estimateId: string | null;
  markup: number;
  locked: boolean;
  items: SummaryItem[];
  totals: { labour: number; equip: number; plant: number; waste: number; cutting: number; subtotal: number; price: number };
  markupAmount: number;
};

type LabourRate = { id: string; role: string; dayRate: Decimal; nightRate: Decimal; weekendRate: Decimal; isActive: boolean };
type PlantRate = { id: string; item: string; unit: string; rate: Decimal; fuelRate: Decimal; isActive: boolean };
type WasteRate = {
  id: string;
  wasteType: string;
  facility: string;
  wasteGroup: string | null;
  unit: string;
  tonRate: Decimal;
  loadRate: Decimal;
  isActive: boolean;
};
type CuttingRate = {
  id: string;
  equipment: string;
  elevation: string;
  material: string;
  depthMm: number;
  ratePerM: Decimal;
  isActive: boolean;
};
type CoreHoleRate = {
  id: string;
  diameterMm: number;
  ratePerHole: Decimal;
  isActive: boolean;
};

type CategoryKey = "SO" | "Str" | "Asb" | "Civ" | "Prv";

type CategoryMeta = { key: CategoryKey; short: string; long: string; quickAddLabel: string; isProvisional?: boolean };

const CATEGORIES: CategoryMeta[] = [
  { key: "SO", short: "SO", long: "Strip-outs", quickAddLabel: "+ SO" },
  { key: "Str", short: "Str", long: "Structural Demo", quickAddLabel: "+ Str" },
  { key: "Asb", short: "Asb", long: "Asbestos", quickAddLabel: "+ Asb" },
  { key: "Civ", short: "Civ", long: "Civil Works", quickAddLabel: "+ Civ" },
  { key: "Prv", short: "Prv", long: "Provisional", quickAddLabel: "+ Provisional Sum", isProvisional: true }
];

const PERIOD_OPTIONS = ["Day", "Week", "Month", "Lump-sum", "Ea"];
const SHIFT_OPTIONS = ["Day", "Night", "Weekend"];

type SectionKey = "labour" | "equip" | "plant" | "waste" | "cutting" | "assumptions";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(n);
}

function num(value: Decimal | null | undefined): string {
  return value ?? "0";
}

function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return { toast, show: setToast };
}

export function EstimateEditor({ tenderId, canManage, canAdmin }: { tenderId: string; canManage: boolean; canAdmin: boolean }) {
  const { authFetch } = useAuth();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [rates, setRates] = useState<{
    labour: LabourRate[];
    plant: PlantRate[];
    waste: WasteRate[];
    cutting: CuttingRate[];
    coreHoles: CoreHoleRate[];
  }>({ labour: [], plant: [], waste: [], cutting: [], coreHoles: [] });
  const { toast, show } = useToast();

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
    const [l, p, w, c, ch] = await Promise.all([
      authFetch(`/estimate-rates/labour`).then((r) => (r.ok ? (r.json() as Promise<LabourRate[]>) : [])),
      authFetch(`/estimate-rates/plant`).then((r) => (r.ok ? (r.json() as Promise<PlantRate[]>) : [])),
      authFetch(`/estimate-rates/waste`).then((r) => (r.ok ? (r.json() as Promise<WasteRate[]>) : [])),
      authFetch(`/estimate-rates/cutting`).then((r) => (r.ok ? (r.json() as Promise<CuttingRate[]>) : [])),
      authFetch(`/estimate-rates/core-holes`).then((r) => (r.ok ? (r.json() as Promise<CoreHoleRate[]>) : []))
    ]);
    setRates({
      labour: (l as LabourRate[]).filter((x) => x.isActive),
      plant: (p as PlantRate[]).filter((x) => x.isActive),
      waste: (w as WasteRate[]).filter((x) => x.isActive),
      cutting: (c as CuttingRate[]).filter((x) => x.isActive),
      coreHoles: (ch as CoreHoleRate[]).filter((x) => x.isActive)
    });
  }, [authFetch]);

  useEffect(() => {
    void reload();
    void loadRates();
  }, [reload, loadRates]);

  const locked = estimate?.lockedAt != null;
  const disabled = locked || !canManage;
  const selectedItem = estimate?.items.find((item) => item.id === selectedItemId) ?? null;
  const selectedSummary = summary?.items.find((s) => s.itemId === selectedItemId) ?? null;

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

  const addQuickItem = async (category: CategoryMeta) => {
    await mutate(`/tenders/${tenderId}/estimate/items`, "POST", {
      code: category.key,
      title: category.isProvisional ? "Provisional sum" : `${category.long} item`,
      isProvisional: category.isProvisional ?? false,
      provisionalAmount: category.isProvisional ? "0" : undefined
    });
  };

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
          subtext="Start a cost build for this tender. You'll be able to add scope items, labour, equip, plant, disposal, cutting and assumptions."
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

  // Group items by category
  const groupedItems = CATEGORIES.map((category) => {
    const items = estimate.items.filter((item) => item.code === category.key);
    const total = items.reduce((sum, item) => {
      const s = summary?.items.find((x) => x.itemId === item.id);
      return sum + (s?.price ?? 0);
    }, 0);
    return { category, items, total };
  }).filter((group) => group.items.length > 0 || CATEGORIES.find((c) => c.key === group.category.key));

  return (
    <div className="estimate-editor">
      {toast ? (
        <div
          role="status"
          className="s7-card"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
            background: "var(--brand-primary, #005B61)",
            color: "white",
            padding: "10px 16px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
          }}
        >
          {toast}
        </div>
      ) : null}

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
            <button type="button" className="s7-btn s7-btn--secondary s7-btn--sm" onClick={() => show("Excel export — coming soon")}>
              Export .xlsx
            </button>
            <button type="button" className="s7-btn s7-btn--secondary s7-btn--sm" onClick={() => show("PDF preview — coming soon")}>
              Preview PDF
            </button>
            {!locked && canManage ? (
              <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={lock} disabled={saving}>
                Submit & lock rates
              </button>
            ) : null}
            {locked && canAdmin ? (
              <button type="button" className="s7-btn s7-btn--secondary s7-btn--sm" onClick={unlock} disabled={saving}>
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
          {estimate.items.length === 0 ? (
            <p style={{ color: "var(--text-muted)", marginTop: 8 }}>No scope items yet. Use a quick-add button below.</p>
          ) : (
            <div className="estimate-editor__groups">
              {groupedItems.map((group) => (
                <div key={group.category.key} className="estimate-editor__group">
                  <div className="estimate-editor__group-head">
                    <span className="estimate-editor__group-label">
                      {group.category.short} · {group.category.long.toUpperCase()}
                    </span>
                    <span className="estimate-editor__group-total">{formatCurrency(group.total)}</span>
                  </div>
                  {group.items.length > 0 ? (
                    <ul className="estimate-editor__item-list">
                      {group.items.map((item) => {
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
                              <span className="estimate-editor__item-title estimate-editor__item-title--wrap">{item.title}</span>
                              <span className="estimate-editor__item-price">
                                {rollup ? formatCurrency(rollup.price) : "—"}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {canManage && !locked ? (
            <div className="estimate-editor__quick-add">
              {CATEGORIES.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  className="s7-btn s7-btn--secondary s7-btn--sm"
                  onClick={() => void addQuickItem(category)}
                  disabled={saving}
                >
                  {category.quickAddLabel}
                </button>
              ))}
            </div>
          ) : null}
        </aside>

        <section className="estimate-editor__detail s7-card">
          {selectedItem ? (
            <ItemDetail
              key={selectedItem.id}
              tenderId={tenderId}
              item={selectedItem}
              summary={selectedSummary}
              rates={rates}
              disabled={disabled}
              canManage={canManage}
              saving={saving}
              mutate={mutate}
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
            <span>Equip</span>
            <strong>{formatCurrency(summary.totals.equip)}</strong>
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

type Mutator = (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => Promise<void>;

function ItemDetail({
  tenderId,
  item,
  summary,
  rates,
  disabled,
  canManage,
  saving,
  mutate
}: {
  tenderId: string;
  item: EstimateItem;
  summary: SummaryItem | null;
  rates: { labour: LabourRate[]; plant: PlantRate[]; waste: WasteRate[]; cutting: CuttingRate[]; coreHoles: CoreHoleRate[] };
  disabled: boolean;
  canManage: boolean;
  saving: boolean;
  mutate: Mutator;
}) {
  const [activeTab, setActiveTab] = useState<SectionKey>("labour");
  const base = `/tenders/${tenderId}/estimate/items/${item.id}`;
  const deleteItem = async () => {
    if (!window.confirm(`Delete item ${item.code}-${item.itemNumber} "${item.title}"?`)) return;
    await mutate(`/tenders/${tenderId}/estimate/items/${item.id}`, "DELETE");
  };

  return (
    <div className="estimate-editor__item-detail">
      <div className="estimate-editor__detail-head">
        <div style={{ flex: 1, minWidth: 280 }}>
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

      <ItemSummaryPanel item={item} summary={summary} disabled={disabled} mutate={mutate} base={base} />

      <ItemDetailTabs
        item={item}
        summary={summary}
        rates={rates}
        disabled={disabled}
        mutate={mutate}
        base={base}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </div>
  );
}

const ITEM_TABS: Array<{ key: SectionKey; label: string; totalKey: keyof Omit<SummaryItem, "itemId" | "code" | "itemNumber" | "title" | "isProvisional" | "subtotal" | "markup" | "price"> | null }> = [
  { key: "labour", label: "Labour", totalKey: "labour" },
  { key: "equip", label: "Equip & Sub", totalKey: "equip" },
  { key: "plant", label: "Plant", totalKey: "plant" },
  { key: "waste", label: "Disposal", totalKey: "waste" },
  { key: "cutting", label: "Cutting", totalKey: "cutting" },
  { key: "assumptions", label: "Assumptions", totalKey: null }
];

function ItemDetailTabs({
  item,
  summary,
  rates,
  disabled,
  mutate,
  base,
  activeTab,
  setActiveTab
}: {
  item: EstimateItem;
  summary: SummaryItem | null;
  rates: { labour: LabourRate[]; plant: PlantRate[]; waste: WasteRate[]; cutting: CuttingRate[]; coreHoles: CoreHoleRate[] };
  disabled: boolean;
  mutate: Mutator;
  base: string;
  activeTab: SectionKey;
  setActiveTab: (key: SectionKey) => void;
}) {
  return (
    <div className="estimate-editor__item-tabs">
      <nav className="estimate-editor__item-tabbar" role="tablist">
        {ITEM_TABS.map((tab) => {
          const total = tab.totalKey && summary ? (summary[tab.totalKey] as number) : null;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={isActive ? "estimate-editor__item-tab estimate-editor__item-tab--active" : "estimate-editor__item-tab"}
              onClick={() => setActiveTab(tab.key)}
            >
              <span>{tab.label}</span>
              {total !== null ? (
                <span className="estimate-editor__item-tab-total">{formatCurrency(total)}</span>
              ) : null}
            </button>
          );
        })}
      </nav>
      <div className="estimate-editor__item-tab-content">
        {activeTab === "labour" && <LabourSection item={item} rates={rates.labour} disabled={disabled} mutate={mutate} base={base} />}
        {activeTab === "equip" && <EquipSection item={item} disabled={disabled} mutate={mutate} base={base} />}
        {activeTab === "plant" && <PlantSection item={item} rates={rates.plant} disabled={disabled} mutate={mutate} base={base} />}
        {activeTab === "waste" && <WasteSection item={item} rates={rates.waste} disabled={disabled} mutate={mutate} base={base} />}
        {activeTab === "cutting" && <CuttingSection item={item} rates={rates.cutting} coreHoles={rates.coreHoles} disabled={disabled} mutate={mutate} base={base} />}
        {activeTab === "assumptions" && <AssumptionsSection item={item} disabled={disabled} mutate={mutate} base={base} />}
      </div>
    </div>
  );
}

function ItemSummaryPanel({
  item,
  summary,
  disabled,
  mutate,
  base
}: {
  item: EstimateItem;
  summary: SummaryItem | null;
  disabled: boolean;
  mutate: Mutator;
  base: string;
}) {
  const [markup, setMarkup] = useState<string>(item.markup);

  useEffect(() => {
    setMarkup(item.markup);
  }, [item.markup]);

  const commitMarkup = (value: string) => {
    if (value !== item.markup) void mutate(base, "PATCH", { markup: value });
  };

  return (
    <div className="estimate-editor__item-summary">
      <div className="estimate-editor__item-summary-grid">
        <div className="estimate-editor__item-summary-row">
          <span>Labour</span>
          <strong>{summary ? formatCurrency(summary.labour) : "—"}</strong>
        </div>
        <div className="estimate-editor__item-summary-row">
          <span>Equip & sub</span>
          <strong>{summary ? formatCurrency(summary.equip) : "—"}</strong>
        </div>
        <div className="estimate-editor__item-summary-row">
          <span>Plant</span>
          <strong>{summary ? formatCurrency(summary.plant) : "—"}</strong>
        </div>
        <div className="estimate-editor__item-summary-row">
          <span>Disposal</span>
          <strong>{summary ? formatCurrency(summary.waste) : "—"}</strong>
        </div>
        <div className="estimate-editor__item-summary-row">
          <span>Cutting</span>
          <strong>{summary ? formatCurrency(summary.cutting) : "—"}</strong>
        </div>
        <div className="estimate-editor__item-summary-row estimate-editor__item-summary-row--subtotal">
          <span>Subtotal</span>
          <strong>{summary ? formatCurrency(summary.subtotal) : "—"}</strong>
        </div>
      </div>
      <div className="estimate-editor__markup-control">
        <label>
          <span>Markup {Number(markup).toFixed(2)}%</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={Number(markup)}
            disabled={disabled || item.isProvisional}
            onChange={(e) => setMarkup(e.target.value)}
            onMouseUp={(e) => commitMarkup((e.target as HTMLInputElement).value)}
            onTouchEnd={(e) => commitMarkup((e.target as HTMLInputElement).value)}
          />
        </label>
        <input
          type="number"
          step="0.01"
          className="s7-input s7-input--sm"
          value={markup}
          disabled={disabled || item.isProvisional}
          onChange={(e) => setMarkup(e.target.value)}
          onBlur={(e) => commitMarkup(e.target.value)}
          style={{ width: 80 }}
        />
      </div>
      <div className="estimate-editor__item-summary-price">
        <span>Item price</span>
        <strong>{summary ? formatCurrency(summary.price) : "—"}</strong>
      </div>
    </div>
  );
}

function LabourSection({ item, rates, disabled, mutate, base }: { item: EstimateItem; rates: LabourRate[]; disabled: boolean; mutate: Mutator; base: string }) {
  return (
    <div className="estimate-editor__lines">
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
      {!disabled ? <LabourAddRow rates={rates} mutate={mutate} base={base} /> : null}
    </div>
  );
}

function LabourAddRow({ rates, mutate, base }: { rates: LabourRate[]; mutate: Mutator; base: string }) {
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
    <div className="estimate-editor__line-add">
      <select className="s7-input" value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="">Select role…</option>
        {rates.map((r) => (<option key={r.id} value={r.role}>{r.role}</option>))}
      </select>
      <input type="number" step="0.01" className="s7-input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" />
      <input type="number" step="0.01" className="s7-input" value={days} onChange={(e) => setDays(e.target.value)} placeholder="Days" />
      <select className="s7-input" value={shift} onChange={(e) => setShift(e.target.value)}>
        {SHIFT_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
      </select>
      <span className="estimate-editor__rate-preview">{formatCurrency(Number(rate))}</span>
      <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={!role}>+ Add line</button>
    </div>
  );
}

function EquipSection({ item, disabled, mutate, base }: { item: EstimateItem; disabled: boolean; mutate: Mutator; base: string }) {
  return (
    <div className="estimate-editor__lines">
      {item.equipLines.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No equipment/subcontractor lines.</p>
      ) : (
        <table className="estimate-editor__table">
          <thead>
            <tr><th>#</th><th>Description</th><th>Qty</th><th>Duration</th><th>Period</th><th>Rate ($)</th><th>Budget ($)</th><th /></tr>
          </thead>
          <tbody>
            {item.equipLines.map((line, index) => {
              const total = Number(line.qty) * Number(line.duration) * Number(line.rate);
              return (
                <tr key={line.id}>
                  <td style={{ color: "var(--text-muted)" }}>{index + 1}</td>
                  <td>
                    <input className="s7-input s7-input--sm" defaultValue={line.description} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.description) void mutate(`${base}/equip/${line.id}`, "PATCH", { description: e.target.value }); }} />
                  </td>
                  <td>
                    <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={line.qty} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.qty) void mutate(`${base}/equip/${line.id}`, "PATCH", { qty: e.target.value }); }} />
                  </td>
                  <td>
                    <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={line.duration} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.duration) void mutate(`${base}/equip/${line.id}`, "PATCH", { duration: e.target.value }); }} />
                  </td>
                  <td>
                    <select className="s7-input s7-input--sm" defaultValue={line.period} disabled={disabled}
                      onChange={(e) => void mutate(`${base}/equip/${line.id}`, "PATCH", { period: e.target.value })}>
                      {PERIOD_OPTIONS.map((p) => (<option key={p} value={p}>{p}</option>))}
                    </select>
                  </td>
                  <td>
                    <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={line.rate} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.rate) void mutate(`${base}/equip/${line.id}`, "PATCH", { rate: e.target.value }); }} />
                  </td>
                  <td><strong>{formatCurrency(total)}</strong></td>
                  <td>
                    {!disabled ? (
                      <button type="button" className="s7-btn s7-btn--danger s7-btn--sm" onClick={() => void mutate(`${base}/equip/${line.id}`, "DELETE")}>Remove</button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {!disabled ? <EquipAddRow mutate={mutate} base={base} /> : null}
    </div>
  );
}

function EquipAddRow({ mutate, base }: { mutate: Mutator; base: string }) {
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("1");
  const [duration, setDuration] = useState("1");
  const [period, setPeriod] = useState("Day");
  const [rate, setRate] = useState("0");

  const add = async () => {
    if (!description.trim()) return;
    await mutate(`${base}/equip`, "POST", { description: description.trim(), qty, duration, period, rate });
    setDescription("");
    setQty("1");
    setDuration("1");
    setRate("0");
  };

  return (
    <div className="estimate-editor__line-add">
      <input className="s7-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (e.g. Scaffold hire, Crane subcontractor)" />
      <input type="number" step="0.01" className="s7-input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" />
      <input type="number" step="0.01" className="s7-input" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Duration" />
      <select className="s7-input" value={period} onChange={(e) => setPeriod(e.target.value)}>
        {PERIOD_OPTIONS.map((p) => (<option key={p} value={p}>{p}</option>))}
      </select>
      <input type="number" step="0.01" className="s7-input" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="Rate" />
      <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={!description.trim()}>+ Add line</button>
    </div>
  );
}

function PlantSection({ item, rates, disabled, mutate, base }: { item: EstimateItem; rates: PlantRate[]; disabled: boolean; mutate: Mutator; base: string }) {
  return (
    <div className="estimate-editor__lines">
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
      {!disabled ? <PlantAddRow rates={rates} mutate={mutate} base={base} /> : null}
    </div>
  );
}

function PlantAddRow({ rates, mutate, base }: { rates: PlantRate[]; mutate: Mutator; base: string }) {
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
    <div className="estimate-editor__line-add">
      <select className="s7-input" value={plantItem} onChange={(e) => setPlantItem(e.target.value)}>
        <option value="">Select plant…</option>
        {rates.map((r) => (<option key={r.id} value={r.item}>{r.item}</option>))}
      </select>
      <input type="number" step="0.01" className="s7-input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" />
      <input type="number" step="0.01" className="s7-input" value={days} onChange={(e) => setDays(e.target.value)} placeholder="Days" />
      <input className="s7-input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment" />
      <span className="estimate-editor__rate-preview">{formatCurrency(Number(rate))}</span>
      <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={!plantItem}>+ Add line</button>
    </div>
  );
}

type DensityUnit = "m³" | "m²" | "each";

type MaterialDensity = {
  label: string;
  unit: DensityUnit;
  density: number; // tonnes per unit (or T/m² for surface materials)
  needsDepth?: boolean;
};

const DENSITY_TABLE: MaterialDensity[] = [
  { label: "Concrete — normal", unit: "m³", density: 2.45 },
  { label: "Concrete — reinforced", unit: "m³", density: 2.7 },
  { label: "Asphalt — compacted", unit: "m³", density: 1.43 },
  { label: "Asphalt — loose", unit: "m³", density: 1.02 },
  { label: "Brick (single)", unit: "m³", density: 1.8 },
  { label: "Block (core filled)", unit: "m³", density: 2.2 },
  { label: "Ceramic tiles", unit: "m³", density: 2.4 },
  { label: "Sand", unit: "m³", density: 1.6 },
  { label: "Soil — clay dry", unit: "m³", density: 1.8 },
  { label: "Soil — clay wet", unit: "m³", density: 2.1 },
  { label: "Rock", unit: "m³", density: 2.5 },
  { label: "Sandstone", unit: "m³", density: 2.65 },
  { label: "Gravel — dry", unit: "m³", density: 1.7 },
  { label: "Gravel — wet", unit: "m³", density: 2.0 },
  { label: "C&D general waste", unit: "m³", density: 0.25 },
  { label: "Plasterboard", unit: "m³", density: 0.8 },
  { label: "Vinyl floor", unit: "m³", density: 1.16 },
  { label: "Timber studs (framed wall)", unit: "m²", density: 0.025 },
  { label: "FC sheet", unit: "m²", density: 0.012 },
  { label: "Super six", unit: "m²", density: 0.019 },
  { label: "Carpet + underlay", unit: "m²", density: 0.01 },
  { label: "Carpet tile", unit: "m²", density: 0.004 }
];

function DensityCalculator({ onCopy }: { onCopy: (tonnes: string) => void }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("1");
  const [material, setMaterial] = useState(DENSITY_TABLE[0].label);
  const [depthMm, setDepthMm] = useState("100");
  const current = DENSITY_TABLE.find((m) => m.label === material) ?? DENSITY_TABLE[0];
  const isM2 = current.unit === "m²";

  const tonnes = useMemo(() => {
    const q = Number(qty) || 0;
    if (current.unit === "m³") return q * current.density;
    if (current.unit === "m²") {
      // Two interpretations in the spec: m² with depth (volume) or m² with T/m² density.
      // If density is < 0.1 we treat it as T/m² (surface spec). Otherwise, volume-based.
      if (current.density < 0.1) return q * current.density;
      const d = (Number(depthMm) || 0) / 1000;
      return q * d * current.density;
    }
    return q * current.density;
  }, [qty, current, depthMm]);

  return (
    <div className="density-calc">
      <button
        type="button"
        className="density-calc__toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span aria-hidden>{open ? "▾" : "▸"}</span>
        ⚖ Volume → Tonnes converter
      </button>
      {open ? (
        <div className="density-calc__body">
          <input
            type="number"
            step="0.01"
            className="s7-input s7-input--sm"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            style={{ maxWidth: 100 }}
          />
          <select
            className="s7-input s7-input--sm"
            value={current.unit}
            disabled
            style={{ maxWidth: 80 }}
          >
            <option>{current.unit}</option>
          </select>
          <select
            className="s7-input s7-input--sm"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            style={{ minWidth: 210 }}
          >
            {DENSITY_TABLE.map((m) => (
              <option key={m.label} value={m.label}>{m.label} ({m.density} T/{m.unit})</option>
            ))}
          </select>
          {isM2 && current.density >= 0.1 ? (
            <input
              type="number"
              step="1"
              className="s7-input s7-input--sm"
              value={depthMm}
              onChange={(e) => setDepthMm(e.target.value)}
              placeholder="Depth mm"
              style={{ maxWidth: 110 }}
            />
          ) : null}
          <span style={{ fontWeight: 500, whiteSpace: "nowrap" }}>
            = {tonnes.toFixed(2)} tonnes
          </span>
          <button
            type="button"
            className="s7-btn s7-btn--secondary s7-btn--sm"
            onClick={() => onCopy(tonnes.toFixed(3))}
            disabled={tonnes <= 0}
          >
            → Copy to line
          </button>
        </div>
      ) : null}
    </div>
  );
}

function WasteSection({ item, rates, disabled, mutate, base }: { item: EstimateItem; rates: WasteRate[]; disabled: boolean; mutate: Mutator; base: string }) {
  const [prefilledTonnes, setPrefilledTonnes] = useState<string>("");

  return (
    <div className="estimate-editor__lines">
      {!disabled ? <DensityCalculator onCopy={(v) => setPrefilledTonnes(v)} /> : null}
      {item.wasteLines.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No disposal lines.</p>
      ) : (
        <table className="estimate-editor__table">
          <thead>
            <tr><th>Type</th><th>Facility</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Loads</th><th>$/load</th><th>Total</th><th /></tr>
          </thead>
          <tbody>
            {item.wasteLines.map((line) => {
              const total = Number(line.qtyTonnes) * Number(line.tonRate) + line.loads * Number(line.loadRate);
              const unit = rates.find((r) => r.wasteType === line.wasteType && r.facility === line.facility)?.unit ?? "tonne";
              return (
                <tr key={line.id}>
                  <td>{line.wasteType}</td>
                  <td>{line.facility}</td>
                  <td>
                    <input type="number" step="0.001" className="s7-input s7-input--sm" defaultValue={line.qtyTonnes} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.qtyTonnes) void mutate(`${base}/waste/${line.id}`, "PATCH", { qtyTonnes: e.target.value }); }} />
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{unit}</td>
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
      {!disabled ? <WasteAddRow rates={rates} mutate={mutate} base={base} prefilledTonnes={prefilledTonnes} onConsumePrefill={() => setPrefilledTonnes("")} /> : null}
    </div>
  );
}

function WasteAddRow({
  rates,
  mutate,
  base,
  prefilledTonnes,
  onConsumePrefill
}: {
  rates: WasteRate[];
  mutate: Mutator;
  base: string;
  prefilledTonnes: string;
  onConsumePrefill: () => void;
}) {
  const groups = useMemo(
    () => Array.from(new Set(rates.map((r) => r.wasteGroup).filter((g): g is string => !!g))).sort(),
    [rates]
  );
  const [group, setGroup] = useState<string>("");
  const filteredByGroup = useMemo(
    () => (group ? rates.filter((r) => r.wasteGroup === group) : rates),
    [rates, group]
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(filteredByGroup.map((r) => r.wasteType))).sort(),
    [filteredByGroup]
  );
  const [wasteType, setWasteType] = useState<string>(typeOptions[0] ?? "");
  useEffect(() => {
    if (!typeOptions.includes(wasteType)) setWasteType(typeOptions[0] ?? "");
  }, [typeOptions, wasteType]);

  const facilityOptions = useMemo(
    () => filteredByGroup.filter((r) => r.wasteType === wasteType),
    [filteredByGroup, wasteType]
  );
  const [facility, setFacility] = useState<string>(facilityOptions[0]?.facility ?? "");
  useEffect(() => {
    if (!facilityOptions.some((f) => f.facility === facility)) {
      setFacility(facilityOptions[0]?.facility ?? "");
    }
  }, [facilityOptions, facility]);

  const current = facilityOptions.find((f) => f.facility === facility) ?? null;
  const [qty, setQty] = useState("1");
  const [loads, setLoads] = useState("0");

  useEffect(() => {
    if (prefilledTonnes) {
      setQty(prefilledTonnes);
      onConsumePrefill();
    }
  }, [prefilledTonnes, onConsumePrefill]);

  const add = async () => {
    if (!current) return;
    await mutate(`${base}/waste`, "POST", {
      wasteGroup: current.wasteGroup ?? undefined,
      wasteType: current.wasteType,
      facility: current.facility,
      qtyTonnes: qty,
      tonRate: current.tonRate,
      loads: Number(loads),
      loadRate: current.loadRate
    });
    setQty("1");
    setLoads("0");
  };

  return (
    <div className="estimate-editor__line-add">
      <select className="s7-input" value={group} onChange={(e) => setGroup(e.target.value)} style={{ maxWidth: 150 }}>
        <option value="">All groups</option>
        {groups.map((g) => (<option key={g} value={g}>{g}</option>))}
      </select>
      <select className="s7-input" value={wasteType} onChange={(e) => setWasteType(e.target.value)}>
        <option value="">Type…</option>
        {typeOptions.map((t) => (<option key={t} value={t}>{t}</option>))}
      </select>
      <select className="s7-input" value={facility} onChange={(e) => setFacility(e.target.value)}>
        <option value="">Facility…</option>
        {facilityOptions.map((f) => (<option key={f.id} value={f.facility}>{f.facility}</option>))}
      </select>
      <input type="number" step="0.01" className="s7-input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder={current?.unit === "m³" ? "m³" : "Tonnes"} style={{ maxWidth: 110 }} />
      <input type="number" step="1" className="s7-input" value={loads} onChange={(e) => setLoads(e.target.value)} placeholder="Loads" style={{ maxWidth: 80 }} />
      <span className="estimate-editor__rate-preview">
        {current ? `${formatCurrency(Number(current.tonRate))}/${current.unit}${Number(current.loadRate) > 0 ? ` + ${formatCurrency(Number(current.loadRate))}/load` : ""}` : "—"}
      </span>
      <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={!current}>+ Add line</button>
    </div>
  );
}

const ELEVATION_MULTIPLIER: Record<string, number> = { Floor: 1, Wall: 1.1, Inverted: 2 };

function elevationLabel(el: string | null | undefined): string {
  if (!el || el === "Any") return "Any";
  const m = ELEVATION_MULTIPLIER[el];
  return m === 1 || !m ? el : `${el} (×${m})`;
}

function CuttingSection({
  item,
  rates,
  coreHoles,
  disabled,
  mutate,
  base
}: {
  item: EstimateItem;
  rates: CuttingRate[];
  coreHoles: CoreHoleRate[];
  disabled: boolean;
  mutate: Mutator;
  base: string;
}) {
  return (
    <div className="estimate-editor__lines">
      {item.cuttingLines.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No concrete cutting lines.</p>
      ) : (
        <table className="estimate-editor__table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Details</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Rate</th>
              <th>Comment</th>
              <th>Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {item.cuttingLines.map((line) => {
              const total = Number(line.qty) * Number(line.rate);
              const details = line.cuttingType === "Core hole"
                ? `Ø ${line.diameterMm ?? "—"} mm`
                : [line.equipment, line.material, line.depthMm ? `${line.depthMm}mm` : null, elevationLabel(line.elevation)]
                    .filter(Boolean)
                    .join(" · ");
              return (
                <tr key={line.id}>
                  <td>{line.cuttingType}</td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{details || "—"}</td>
                  <td>
                    <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={line.qty} disabled={disabled}
                      onBlur={(e) => { if (e.target.value !== line.qty) void mutate(`${base}/cutting/${line.id}`, "PATCH", { qty: e.target.value }); }} />
                  </td>
                  <td>{line.unit}</td>
                  <td>
                    <input type="number" step="0.0001" className="s7-input s7-input--sm" defaultValue={line.rate} disabled={disabled}
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
      {!disabled ? <CuttingAddRow rates={rates} coreHoles={coreHoles} mutate={mutate} base={base} /> : null}
    </div>
  );
}

type CuttingMode = "saw" | "core";

function CuttingAddRow({
  rates,
  coreHoles,
  mutate,
  base
}: {
  rates: CuttingRate[];
  coreHoles: CoreHoleRate[];
  mutate: Mutator;
  base: string;
}) {
  const [mode, setMode] = useState<CuttingMode>("saw");
  return (
    <div className="estimate-editor__cutting-add">
      <div className="estimate-editor__cutting-mode" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "saw"}
          className={mode === "saw" ? "estimate-editor__cutting-mode-pill estimate-editor__cutting-mode-pill--active" : "estimate-editor__cutting-mode-pill"}
          onClick={() => setMode("saw")}
        >
          Saw cut
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "core"}
          className={mode === "core" ? "estimate-editor__cutting-mode-pill estimate-editor__cutting-mode-pill--active" : "estimate-editor__cutting-mode-pill"}
          onClick={() => setMode("core")}
        >
          Core hole
        </button>
      </div>
      {mode === "saw" ? (
        <SawCutAddRow rates={rates} mutate={mutate} base={base} />
      ) : (
        <CoreHoleAddRow coreHoles={coreHoles} mutate={mutate} base={base} />
      )}
    </div>
  );
}

function SawCutAddRow({ rates, mutate, base }: { rates: CuttingRate[]; mutate: Mutator; base: string }) {
  const equipmentOptions = useMemo(
    () => Array.from(new Set(rates.map((r) => r.equipment))).sort(),
    [rates]
  );
  const [equipment, setEquipment] = useState(equipmentOptions[0] ?? "");

  useEffect(() => {
    if (!equipment && equipmentOptions[0]) setEquipment(equipmentOptions[0]);
  }, [equipmentOptions, equipment]);

  const materialOptions = useMemo(
    () => Array.from(new Set(rates.filter((r) => r.equipment === equipment).map((r) => r.material))).sort(),
    [rates, equipment]
  );
  const [material, setMaterial] = useState(materialOptions[0] ?? "");
  useEffect(() => {
    if (!materialOptions.includes(material) && materialOptions[0]) setMaterial(materialOptions[0]);
  }, [materialOptions, material]);

  const depthOptions = useMemo(
    () =>
      Array.from(new Set(
        rates.filter((r) => r.equipment === equipment && r.material === material).map((r) => r.depthMm)
      )).sort((a, b) => a - b),
    [rates, equipment, material]
  );
  const [depthMm, setDepthMm] = useState<number | null>(depthOptions[0] ?? null);
  useEffect(() => {
    if ((!depthMm || !depthOptions.includes(depthMm)) && depthOptions[0]) setDepthMm(depthOptions[0]);
  }, [depthOptions, depthMm]);

  const [elevation, setElevation] = useState<string>("Floor");
  const [qty, setQty] = useState("1");
  const [comment, setComment] = useState("");

  const baseRate = useMemo(() => {
    if (!equipment || !material || depthMm == null) return 0;
    // Prefer exact match on elevation, else Any, else Floor.
    const candidates = rates.filter(
      (r) => r.equipment === equipment && r.material === material && r.depthMm === depthMm
    );
    const match =
      candidates.find((r) => r.elevation === elevation) ??
      candidates.find((r) => r.elevation === "Any") ??
      candidates.find((r) => r.elevation === "Floor") ??
      candidates[0];
    return match ? Number(match.ratePerM) : 0;
  }, [rates, equipment, material, depthMm, elevation]);

  const multiplier = ELEVATION_MULTIPLIER[elevation] ?? 1;
  const computedRate = baseRate * multiplier;

  const add = async () => {
    if (!equipment || !material || depthMm == null) return;
    const rateString = computedRate.toFixed(4);
    await mutate(`${base}/cutting`, "POST", {
      cuttingType: "Saw cut",
      equipment,
      elevation,
      material,
      depthMm,
      qty,
      unit: "m",
      comment: comment || undefined,
      rate: rateString
    });
    setQty("1");
    setComment("");
  };

  const canAdd = equipment && material && depthMm != null && Number(qty) > 0 && computedRate > 0;

  return (
    <div className="estimate-editor__line-add">
      <select className="s7-input" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
        {equipmentOptions.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <select className="s7-input" value={material} onChange={(e) => setMaterial(e.target.value)}>
        {materialOptions.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <select className="s7-input" value={depthMm ?? ""} onChange={(e) => setDepthMm(Number(e.target.value) || null)}>
        {depthOptions.map((d) => (
          <option key={d} value={d}>{d} mm</option>
        ))}
      </select>
      <select className="s7-input" value={elevation} onChange={(e) => setElevation(e.target.value)}>
        <option value="Floor">Floor (×1.0)</option>
        <option value="Wall">Wall (×1.1)</option>
        <option value="Inverted">Inverted (×2.0)</option>
      </select>
      <input type="number" step="0.01" className="s7-input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty (lm)" />
      <input className="s7-input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment" />
      <span className="estimate-editor__rate-preview">
        {formatCurrency(computedRate)}/m
      </span>
      <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={!canAdd}>+ Add line</button>
    </div>
  );
}

function CoreHoleAddRow({ coreHoles, mutate, base }: { coreHoles: CoreHoleRate[]; mutate: Mutator; base: string }) {
  const sorted = useMemo(() => [...coreHoles].sort((a, b) => a.diameterMm - b.diameterMm), [coreHoles]);
  const [diameterMm, setDiameterMm] = useState<number | null>(sorted[0]?.diameterMm ?? null);
  const [qty, setQty] = useState("1");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if ((diameterMm == null || !sorted.some((c) => c.diameterMm === diameterMm)) && sorted[0]) {
      setDiameterMm(sorted[0].diameterMm);
    }
  }, [sorted, diameterMm]);

  const rate = useMemo(() => {
    const match = sorted.find((c) => c.diameterMm === diameterMm);
    return match ? Number(match.ratePerHole) : 0;
  }, [sorted, diameterMm]);

  const add = async () => {
    if (diameterMm == null) return;
    await mutate(`${base}/cutting`, "POST", {
      cuttingType: "Core hole",
      diameterMm,
      qty,
      unit: "ea",
      comment: comment || undefined,
      rate: rate.toFixed(4)
    });
    setQty("1");
    setComment("");
  };

  const canAdd = diameterMm != null && Number(qty) > 0 && rate > 0;

  return (
    <div className="estimate-editor__line-add">
      <select className="s7-input" value={diameterMm ?? ""} onChange={(e) => setDiameterMm(Number(e.target.value) || null)}>
        {sorted.map((c) => (
          <option key={c.id} value={c.diameterMm}>{c.diameterMm} mm</option>
        ))}
      </select>
      <input type="number" step="1" className="s7-input" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Holes" />
      <input className="s7-input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment" />
      <span className="estimate-editor__rate-preview">{formatCurrency(rate)}/hole</span>
      <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={!canAdd}>+ Add hole</button>
    </div>
  );
}

function AssumptionsSection({ item, disabled, mutate, base }: { item: EstimateItem; disabled: boolean; mutate: Mutator; base: string }) {
  const [text, setText] = useState("");
  const add = async () => {
    if (!text.trim()) return;
    await mutate(`${base}/assumptions`, "POST", { text: text.trim() });
    setText("");
  };
  return (
    <div className="estimate-editor__lines">
      {item.assumptions.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No assumptions or exclusions.</p>
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
      {!disabled ? (
        <div className="estimate-editor__line-add">
          <input className="s7-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an assumption or exclusion…" />
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={!text.trim()}>+ Add line</button>
        </div>
      ) : null}
    </div>
  );
}
