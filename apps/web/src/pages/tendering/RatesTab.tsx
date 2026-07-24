import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { useConfirm } from "../../hooks/useConfirm";
import { FilterableRateGrid } from "../../components/rates/FilterableRateGrid";
import type { RateGridColumn, RateGridRow } from "../../components/rates/rateGridModel";
import {
  formatKeyColumnHeader,
  getRateSet,
  lockRateSet,
  patchRateEntry,
  rateGroupKey,
  selectDefaultRatesTableKey,
  unlockRateSet
} from "./ratesTabApi";

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
  keyValues: string[];
};

export type TenderRateKeyColumn = { name: string; unit: string | null };

export type TenderRateGroup = {
  rateTableId: string | null;
  rateTableSlug: string | null;
  tableName: string;
  keyColumns: TenderRateKeyColumn[];
  valueColumnLabel: string | null;
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
  const confirm = useConfirm();
  const [set, setSet] = useState<TenderRateSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

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
    const ok = await confirm({
      title: "Unlock rates",
      message: "Unlock rates? The tender's snapshot will be deleted and any overrides will be lost.",
      confirmLabel: "Unlock",
      variant: "danger"
    });
    if (!ok) return;
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
                // Preserve existing keyValues — the PATCH response only
                // carries the value fields; keys don't change on override.
                entries: g.entries.map((e) =>
                  e.id === entryId ? { ...e, ...updated, keyValues: e.keyValues } : e
                )
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
        <RatesMasterDetail
          groups={set.groups}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          renderDetail={(group) => (
            <>
              <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>{group.tableName}</h3>
              <RateGroupGrid
                group={group}
                canManage={canManage}
                drafts={drafts}
                setDrafts={setDrafts}
                patchEntry={patchEntry}
              />
            </>
          )}
        />
      )}
    </div>
  );
}

function RateGroupGrid({
  group,
  canManage,
  drafts,
  setDrafts,
  patchEntry
}: {
  group: TenderRateGroup;
  canManage: boolean;
  drafts: Record<string, string>;
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  patchEntry: (entryId: string, overrideValue: number | null) => Promise<void>;
}) {
  const hasKeyCols = group.keyColumns.length > 0;

  const columns = useMemo<RateGridColumn[]>(() => {
    const keyCols: RateGridColumn[] = hasKeyCols
      ? group.keyColumns.map((c, idx) => {
          const numeric = /^\s*-?\d/.test(group.entries[0]?.keyValues[idx] ?? "");
          return {
            key: `k${idx}`,
            label: formatKeyColumnHeader(c.name, c.unit),
            kind: numeric ? "number" : "text",
            unit: c.unit,
            filterable: true,
            sortable: true,
            groupable: false
          } satisfies RateGridColumn;
        })
      : [
          { key: "label", label: "Rate", kind: "text", filterable: true, sortable: true, groupable: false },
          { key: "unit", label: "Unit", kind: "text", filterable: true, sortable: true, groupable: false }
        ];
    const original: RateGridColumn = {
      key: "original",
      label: "Original",
      kind: "currency",
      filterable: false,
      sortable: false,
      groupable: false,
      align: "right"
    };
    const override: RateGridColumn = {
      key: "override",
      label: "Override",
      kind: "currency",
      filterable: false,
      sortable: false,
      groupable: false,
      align: "right"
    };
    return [...keyCols, original, override];
  }, [group, hasKeyCols]);

  const rows = useMemo<RateGridRow[]>(
    () =>
      group.entries.map((entry) => {
        const values: Record<string, string | number | null> = {};
        if (hasKeyCols) {
          group.keyColumns.forEach((_c, idx) => {
            const raw = entry.keyValues[idx] ?? "";
            const asNum = Number(raw);
            values[`k${idx}`] = raw !== "" && Number.isFinite(asNum) ? asNum : raw;
          });
        } else {
          values.label = entry.label;
          values.unit = entry.unit ?? "";
        }
        const origNum = Number(entry.originalValue);
        values.original = Number.isFinite(origNum) ? origNum : entry.originalValue;
        const effNum = Number(entry.effectiveValue);
        values.override = entry.overridden && Number.isFinite(effNum) ? effNum : null;

        const render: Record<string, ReactNode> = {};
        render.original = formatCurrency(entry.originalValue, entry.unit);
        render.override = (
          <OverrideCell
            entry={entry}
            canManage={canManage}
            draft={drafts[entry.id]}
            setDrafts={setDrafts}
            patchEntry={patchEntry}
          />
        );
        return { id: entry.id, values, render };
      }),
    [group, hasKeyCols, canManage, drafts, setDrafts, patchEntry]
  );

  return (
    <FilterableRateGrid
      columns={columns}
      rows={rows}
      groupByKey={null}
      testIdPrefix="tender-rates"
      trailingHeader={canManage ? <span aria-hidden /> : undefined}
      renderTrailing={
        canManage
          ? (gridRow) => {
              const entry = group.entries.find((e) => e.id === gridRow.id);
              if (!entry || !entry.overridden) return null;
              return (
                <button
                  type="button"
                  className="s7-btn s7-btn--sm s7-btn--ghost"
                  onClick={() => void patchEntry(entry.id, null)}
                  data-testid={`rates-entry-revert-${entry.key}`}
                  style={{ minHeight: 44 }}
                >
                  Revert
                </button>
              );
            }
          : undefined
      }
    />
  );
}

function OverrideCell({
  entry,
  canManage,
  draft,
  setDrafts,
  patchEntry
}: {
  entry: TenderRateEntry;
  canManage: boolean;
  draft: string | undefined;
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  patchEntry: (entryId: string, overrideValue: number | null) => Promise<void>;
}) {
  const overrideColor = entry.overridden ? "#EA580C" : undefined;
  if (!canManage) {
    return (
      <span style={{ color: overrideColor }} data-testid={`rates-entry-${entry.key}`}>
        {entry.overrideValue ? formatCurrency(entry.overrideValue, entry.unit) : "—"}
      </span>
    );
  }
  const draftValue = draft ?? (entry.overrideValue ?? "");
  return (
    <span data-testid={`rates-entry-${entry.key}`}>
      <input
        type="number"
        step="0.01"
        min="0"
        value={draftValue}
        onChange={(e) => setDrafts((prev) => ({ ...prev, [entry.id]: e.target.value }))}
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
    </span>
  );
}

function RatesMasterDetail({
  groups,
  selectedKey,
  onSelect,
  renderDetail
}: {
  groups: TenderRateGroup[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  renderDetail: (group: TenderRateGroup) => ReactNode;
}) {
  const resolvedKey = useMemo(
    () => selectDefaultRatesTableKey(groups, selectedKey),
    [groups, selectedKey]
  );

  useEffect(() => {
    if (resolvedKey && resolvedKey !== selectedKey) onSelect(resolvedKey);
  }, [resolvedKey, selectedKey, onSelect]);

  const selectedGroup =
    groups.find((g) => rateGroupKey(g) === resolvedKey) ?? groups[0] ?? null;

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        flexWrap: "wrap"
      }}
      data-testid="rates-master-detail"
    >
      <aside
        className="s7-card"
        style={{
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flex: "0 0 240px",
          minWidth: 220,
          maxWidth: 260,
          alignSelf: "stretch"
        }}
        data-testid="rates-tables-nav"
      >
        <strong>Tables</strong>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2
          }}
        >
          {groups.map((group) => {
            const key = rateGroupKey(group);
            const active = key === resolvedKey;
            const subtitle = group.rateTableSlug ?? group.rateTableId ?? "other";
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onSelect(key)}
                  data-testid={`rates-table-nav-${subtitle}`}
                  aria-current={active ? "true" : undefined}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    minHeight: 44,
                    padding: "8px 10px",
                    border: "none",
                    borderRadius: 6,
                    background: active ? "rgba(0,91,97,0.08)" : "transparent",
                    color: active ? "var(--brand-primary, #005B61)" : "var(--text)",
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer"
                  }}
                >
                  <div>{group.tableName}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{subtitle}</div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section
        className="s7-card"
        style={{ flex: "1 1 480px", minWidth: 320 }}
        data-testid="rates-table-detail"
      >
        {selectedGroup ? renderDetail(selectedGroup) : null}
      </section>
    </div>
  );
}
