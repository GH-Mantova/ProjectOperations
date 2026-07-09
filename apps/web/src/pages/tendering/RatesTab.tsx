import { useCallback, useEffect, useState } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { getRateSet, lockRateSet, patchRateEntry, unlockRateSet } from "./ratesTabApi";

export type TenderRateEntry = {
  id: string;
  key: string;
  label: string;
  unit: string | null;
  rateTableId: string | null;
  rateTableSlug: string | null;
  originalValue: string;
  overrideValue: string | null;
  effectiveValue: string;
  overridden: boolean;
};

export type TenderRateGroup = {
  rateTableId: string | null;
  rateTableSlug: string | null;
  tableName: string;
  entries: TenderRateEntry[];
};

export type TenderRateSet = {
  id: string;
  tenderId: string;
  lockedAt: string;
  lockedBy: { id: string; firstName: string; lastName: string } | null;
  sourceLabel: string | null;
  groups: TenderRateGroup[];
};

function formatCurrency(raw: string, unit: string | null): string {
  const value = Number(raw);
  if (Number.isNaN(value)) return raw;
  const formatted = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2
  }).format(value);
  return unit ? `${formatted}/${unit}` : formatted;
}

export function RatesTab({ tenderId, canManage }: { tenderId: string; canManage: boolean }) {
  const { authFetch } = useAuth();
  const [set, setSet] = useState<TenderRateSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSet(await getRateSet(authFetch, tenderId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runLock = async () => {
    setBusy(true);
    setError(null);
    try {
      setSet(await lockRateSet(authFetch, tenderId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runUnlock = async () => {
    if (!window.confirm("Unlock rates? The tender's snapshot will be deleted and any overrides will be lost.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await unlockRateSet(authFetch, tenderId);
      setSet(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const patchEntry = async (entryId: string, overrideValue: number | null) => {
    try {
      const updated = await patchRateEntry(authFetch, tenderId, entryId, overrideValue);
      setSet((prev) =>
        prev
          ? {
              ...prev,
              groups: prev.groups.map((g) => ({
                ...g,
                entries: g.entries.map((e) => (e.id === entryId ? updated : e))
              }))
            }
          : prev
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) {
    return (
      <section className="s7-card" data-testid="rates-tab-loading">
        <Skeleton width="60%" height={20} />
        <Skeleton width="100%" height={140} style={{ marginTop: 12 }} />
      </section>
    );
  }

  if (!set) {
    return (
      <section className="s7-card" data-testid="rates-tab-empty">
        <EmptyState
          heading="Rates not locked yet"
          subtext="Lock rates to snapshot the current resolved rate set into this tender. You can edit overrides here without touching global rates or other tenders."
          action={
            canManage ? (
              <button
                type="button"
                className="s7-btn s7-btn--primary"
                onClick={() => void runLock()}
                disabled={busy}
                data-testid="rates-tab-lock"
              >
                {busy ? "Locking…" : "Lock rates"}
              </button>
            ) : null
          }
        />
        {error ? <p style={{ color: "#DC2626", marginTop: 12 }}>{error}</p> : null}
      </section>
    );
  }

  return (
    <div className="tender-detail__sections" data-testid="rates-tab-set">
      <section className="s7-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p className="s7-type-label">Rate snapshot</p>
            <p style={{ margin: "4px 0 0", fontSize: 14 }}>
              Locked {new Date(set.lockedAt).toLocaleString()}
              {set.lockedBy ? ` by ${set.lockedBy.firstName} ${set.lockedBy.lastName}` : ""}
            </p>
          </div>
          {canManage ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="s7-btn s7-btn--secondary s7-btn--sm"
                onClick={() => void runLock()}
                disabled={busy}
                data-testid="rates-tab-refresh"
              >
                {busy ? "Refreshing…" : "Refresh"}
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--sm"
                style={{ color: "#DC2626", borderColor: "#FCA5A5" }}
                onClick={() => void runUnlock()}
                disabled={busy}
                data-testid="rates-tab-unlock"
              >
                Unlock
              </button>
            </div>
          ) : null}
        </div>
        {error ? <p style={{ color: "#DC2626", marginTop: 12 }}>{error}</p> : null}
      </section>

      {set.groups.length === 0 ? (
        <section className="s7-card">
          <EmptyState heading="No rates in the snapshot" subtext="There are no active rate rows to snapshot yet." />
        </section>
      ) : (
        set.groups.map((group) => (
          <section className="s7-card" key={`${group.rateTableId ?? group.rateTableSlug ?? "other"}`}>
            <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>{group.tableName}</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-subtle, #E5E7EB)" }}>
                  <th style={{ padding: "8px 12px" }}>Rate</th>
                  <th style={{ padding: "8px 12px" }}>Unit</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>Original</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", width: 180 }}>Override</th>
                  <th style={{ padding: "8px 12px", width: 80 }} />
                </tr>
              </thead>
              <tbody>
                {group.entries.map((entry) => {
                  const draft = drafts[entry.id];
                  const draftValue = draft ?? (entry.overrideValue ?? "");
                  const overrideColor = entry.overridden ? "#EA580C" : undefined;
                  return (
                    <tr
                      key={entry.id}
                      data-testid={`rates-entry-${entry.key}`}
                      style={{ borderBottom: "1px solid var(--border-subtle, #F1F5F9)" }}
                    >
                      <td style={{ padding: "8px 12px", color: overrideColor }}>{entry.label}</td>
                      <td style={{ padding: "8px 12px" }}>{entry.unit ?? "—"}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        {formatCurrency(entry.originalValue, entry.unit)}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        {canManage ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={draftValue}
                            onChange={(e) =>
                              setDrafts((prev) => ({ ...prev, [entry.id]: e.target.value }))
                            }
                            onBlur={() => {
                              if (draft === undefined) return;
                              const trimmed = draft.trim();
                              if (trimmed === "") {
                                if (entry.overrideValue !== null) void patchEntry(entry.id, null);
                                setDrafts((prev) => {
                                  const next = { ...prev };
                                  delete next[entry.id];
                                  return next;
                                });
                                return;
                              }
                              const parsed = Number(trimmed);
                              if (Number.isNaN(parsed) || parsed < 0) return;
                              if (String(parsed) === entry.overrideValue) return;
                              void patchEntry(entry.id, parsed);
                            }}
                            style={{
                              width: 140,
                              padding: "6px 8px",
                              border: "1px solid var(--border-subtle, #E5E7EB)",
                              borderRadius: 6,
                              textAlign: "right",
                              color: overrideColor,
                              fontWeight: entry.overridden ? 600 : 400
                            }}
                            data-testid={`rates-entry-input-${entry.key}`}
                          />
                        ) : (
                          <span style={{ color: overrideColor }}>
                            {entry.overrideValue ? formatCurrency(entry.overrideValue, entry.unit) : "—"}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        {canManage && entry.overridden ? (
                          <button
                            type="button"
                            className="s7-btn s7-btn--sm s7-btn--ghost"
                            onClick={() => void patchEntry(entry.id, null)}
                            data-testid={`rates-entry-revert-${entry.key}`}
                            style={{ minHeight: 44 }}
                          >
                            Revert
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  );
}
