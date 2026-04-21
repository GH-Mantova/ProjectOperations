import { useEffect, useMemo, useState } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type Decimal = string;

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
  assumptions: Assumption[];
};

type Estimate = {
  id: string;
  tenderId: string;
  markup: Decimal;
  notes: string | null;
  lockedAt: string | null;
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
  items: SummaryItem[];
  totals: { labour: number; equip: number; plant: number; waste: number; cutting: number; subtotal: number; price: number };
  markupAmount: number;
};

const CATEGORY_ORDER = ["SO", "Str", "Asb", "Civ", "Prv"] as const;

const CATEGORY_META: Record<(typeof CATEGORY_ORDER)[number], { long: string; tint: string; accent: string }> = {
  SO: { long: "Strip-outs", tint: "rgba(254, 170, 109, 0.08)", accent: "#FEAA6D" },
  Str: { long: "Structural Demo", tint: "rgba(148, 163, 184, 0.10)", accent: "#64748B" },
  Asb: { long: "Asbestos", tint: "rgba(239, 68, 68, 0.08)", accent: "#EF4444" },
  Civ: { long: "Civil Works", tint: "rgba(0, 91, 97, 0.08)", accent: "#005B61" },
  Prv: { long: "Provisional Sums", tint: "rgba(245, 158, 11, 0.10)", accent: "#F59E0B" }
};

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(n);
}

export function ScopeOfWorksTab({ tenderId, tenderTitle }: { tenderId: string; tenderTitle: string }) {
  const { authFetch } = useAuth();
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [estRes, sumRes] = await Promise.all([
          authFetch(`/tenders/${tenderId}/estimate`),
          authFetch(`/tenders/${tenderId}/estimate/summary`)
        ]);
        if (estRes.status === 404) {
          if (!cancelled) {
            setEstimate(null);
            setSummary(null);
          }
          return;
        }
        if (!estRes.ok) throw new Error(await estRes.text());
        if (!sumRes.ok) throw new Error(await sumRes.text());
        if (!cancelled) {
          setEstimate((await estRes.json()) as Estimate);
          setSummary((await sumRes.json()) as Summary);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, tenderId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const summaryByItem = useMemo(() => {
    const map = new Map<string, SummaryItem>();
    for (const s of summary?.items ?? []) map.set(s.itemId, s);
    return map;
  }, [summary]);

  const groups = useMemo(() => {
    if (!estimate) return [];
    return CATEGORY_ORDER.map((code) => ({
      code,
      meta: CATEGORY_META[code],
      items: estimate.items
        .filter((i) => i.code === code)
        .sort((a, b) => a.itemNumber - b.itemNumber || a.sortOrder - b.sortOrder)
    })).filter((g) => g.items.length > 0);
  }, [estimate]);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const g of groups) {
      totals[g.code] = g.items.reduce((sum, item) => sum + (summaryByItem.get(item.id)?.price ?? 0), 0);
    }
    return totals;
  }, [groups, summaryByItem]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="s7-card">
        <Skeleton width="100%" height={220} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="s7-card" role="alert" style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}>
        {error}
      </div>
    );
  }

  if (!estimate || groups.length === 0) {
    return (
      <div className="s7-card">
        <EmptyState
          heading="No scope items yet"
          subtext="Start by opening the Estimate tab to build the scope."
        />
      </div>
    );
  }

  return (
    <div className="sow-tab">
      <header className="sow-tab__header">
        <div>
          <h2 className="s7-type-page-title" style={{ margin: 0, fontSize: 24 }}>Scope of Works</h2>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>{tenderTitle}</p>
        </div>
        <button
          type="button"
          className="s7-btn s7-btn--secondary s7-btn--sm"
          onClick={() => setToast("Export coming soon")}
        >
          Export
        </button>
      </header>

      {groups.map((g) => (
        <section key={g.code} className="sow-group" style={{ background: g.meta.tint, borderLeft: `4px solid ${g.meta.accent}` }}>
          <header className="sow-group__header">
            <div>
              <strong className="sow-group__badge" style={{ background: g.meta.accent }}>
                {g.code}
              </strong>
              <span className="sow-group__label">{g.meta.long}</span>
            </div>
            <strong style={{ fontSize: 16 }}>{fmtCurrency(categoryTotals[g.code] ?? 0)}</strong>
          </header>

          <ul className="sow-items">
            {g.items.map((item) => {
              const itemSummary = summaryByItem.get(item.id);
              const isOpen = expanded.has(item.id);
              const itemPrice = itemSummary?.price ?? 0;
              return (
                <li key={item.id} className="sow-item">
                  <button
                    type="button"
                    className="sow-item__head"
                    onClick={() => toggle(item.id)}
                    aria-expanded={isOpen}
                  >
                    <span className="sow-item__code" style={{ color: g.meta.accent }}>
                      {item.code}-{item.itemNumber}
                    </span>
                    <span className="sow-item__title">{item.title || <em>Untitled</em>}</span>
                    {item.isProvisional ? (
                      <span className="sow-item__provisional">PROVISIONAL</span>
                    ) : null}
                    <strong className="sow-item__price" style={{ color: "#FEAA6D" }}>
                      {fmtCurrency(itemPrice)}
                    </strong>
                    <span className="sow-item__chevron" aria-hidden>
                      {isOpen ? "▾" : "▸"}
                    </span>
                  </button>

                  {isOpen ? (
                    <div className="sow-item__body">
                      {item.description ? (
                        <p className="sow-item__description">{item.description}</p>
                      ) : null}

                      {itemSummary ? (
                        <div className="sow-item__breakdown">
                          <Stat label="Labour" value={fmtCurrency(itemSummary.labour)} />
                          <Stat label="Equip & sub" value={fmtCurrency(itemSummary.equip)} />
                          <Stat label="Plant" value={fmtCurrency(itemSummary.plant)} />
                          <Stat label="Disposal" value={fmtCurrency(itemSummary.waste)} />
                          <Stat label="Cutting" value={fmtCurrency(itemSummary.cutting)} />
                          <Stat label="Subtotal" value={fmtCurrency(itemSummary.subtotal)} strong />
                          <Stat
                            label={`Markup (${Number(item.markup || summary?.markup || 0).toFixed(0)}%)`}
                            value={fmtCurrency(itemSummary.markup)}
                          />
                          <Stat label="Price" value={fmtCurrency(itemSummary.price)} accent />
                        </div>
                      ) : null}

                      {item.assumptions.length > 0 ? (
                        <div className="sow-item__assumptions">
                          <h4 className="s7-type-label">Assumptions</h4>
                          <ul>
                            {item.assumptions
                              .slice()
                              .sort((a, b) => a.sortOrder - b.sortOrder)
                              .map((a) => (
                                <li key={a.id}>{a.text}</li>
                              ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {summary ? (
        <section className="s7-card sow-summary">
          <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Tender summary</h3>
          <div className="sow-summary__grid">
            {CATEGORY_ORDER.map((code) => (
              <div key={code}>
                <p className="s7-type-label">{code} total</p>
                <strong>{fmtCurrency(categoryTotals[code] ?? 0)}</strong>
              </div>
            ))}
          </div>
          <div className="sow-summary__totals">
            <Stat label="Subtotal" value={fmtCurrency(summary.totals.subtotal)} />
            <Stat
              label={`Markup (${Number(summary.markup).toFixed(0)}%)`}
              value={fmtCurrency(summary.markupAmount)}
            />
            <Stat
              label="Tender price"
              value={fmtCurrency(summary.totals.price)}
              accent
              large
            />
          </div>
        </section>
      ) : null}

      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#005B61",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 6,
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)"
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  strong,
  accent,
  large
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
  large?: boolean;
}) {
  return (
    <div>
      <p className="s7-type-label" style={{ margin: 0 }}>{label}</p>
      <strong
        style={{
          fontSize: large ? 22 : strong ? 16 : 14,
          color: accent ? "#FEAA6D" : "inherit",
          fontWeight: strong || accent ? 700 : 600
        }}
      >
        {value}
      </strong>
    </div>
  );
}
