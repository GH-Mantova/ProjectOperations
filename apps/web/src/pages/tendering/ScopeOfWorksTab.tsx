import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { ScopeCuttingSheet } from "./ScopeCuttingSheet";
import {
  ScopeDisciplineBar,
  ScopeGrandTotalBar,
  type Discipline as SelDiscipline,
  type DisciplineStat
} from "./ScopeDisciplineBar";

type ScopeSummaryResponse = {
  SO: DisciplineStat;
  Str: DisciplineStat;
  Asb: DisciplineStat;
  Civ: DisciplineStat;
  Prv: DisciplineStat;
  cutting: { itemCount: number; subtotal: number };
  tenderPrice: number;
};

const DISCIPLINES = ["SO", "Str", "Asb", "Civ", "Prv"] as const;
type Discipline = (typeof DISCIPLINES)[number];
const ROW_TYPES = ["demolition", "cutting", "asbestos", "excavation", "waste", "general"] as const;
type RowType = (typeof ROW_TYPES)[number];

type ScopeItem = {
  id: string;
  tenderId: string;
  wbsCode: string;
  discipline: string;
  itemNumber: number;
  rowType: string;
  description: string;
  status: "draft" | "confirmed" | "excluded";
  aiProposed: boolean;
  aiConfidence: string | null;
  aiSourceRef: string | null;
  sortOrder: number;
  notes: string | null;
  men: string | null;
  days: string | null;
  shift: string | null;
  sqm: string | null;
  m3: string | null;
  materialType: string | null;
  cuttingEquipment: string | null;
  elevation: string | null;
  depthMm: number | null;
  lm: string | null;
  coreHoleDiameterMm: number | null;
  coreHoleQty: string | null;
  acmType: string | null;
  acmMaterial: string | null;
  enclosureRequired: boolean | null;
  airMonitoring: boolean | null;
  excavationDepthM: string | null;
  excavationMaterial: string | null;
  machineSize: string | null;
  wasteType: string | null;
  wasteFacility: string | null;
  wasteTonnes: string | null;
  wasteLoads: number | null;
  wasteM3: string | null;
  excavatorDays: string | null;
  bobcatDays: string | null;
  ewpDays: string | null;
  hookTruckDays: string | null;
  semiTipperDays: string | null;
  estimateItemId: string | null;
};

type Summary = { discipline: string; itemCount: number; totalValue: number };
type ListResponse = { items: ScopeItem[]; summary: Summary[] };

type Header = {
  id: string;
  tenderId: string;
  siteAddress: string | null;
  siteContactName: string | null;
  siteContactPhone: string | null;
  accessConstraints: string | null;
  proposedStartDate: string | null;
  durationWeeks: number | null;
  specialConditions: string | null;
};

const DISCIPLINE_META: Record<Discipline, { long: string; accent: string }> = {
  SO: { long: "Strip-outs", accent: "#94A3B8" },
  Str: { long: "Structural", accent: "#3B82F6" },
  Asb: { long: "Asbestos", accent: "#F59E0B" },
  Civ: { long: "Civil", accent: "#22C55E" },
  Prv: { long: "Provisional", accent: "#9CA3AF" }
};

const CONFIDENCE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  high: { bg: "#DCFCE7", fg: "#166534", label: "High" },
  medium: { bg: "#FEF3C7", fg: "#854F0B", label: "Medium" },
  low: { bg: "#FEE2E2", fg: "#991B1B", label: "Low" }
};

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

export function ScopeOfWorksTab({ tenderId, tenderTitle }: { tenderId: string; tenderTitle: string }) {
  const { authFetch } = useAuth();
  const [data, setData] = useState<ListResponse | null>(null);
  const [header, setHeader] = useState<Header | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [addOpenForDiscipline, setAddOpenForDiscipline] = useState<Discipline | null>(null);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [selectedDiscipline, setSelectedDiscipline] = useState<SelDiscipline>("SO");
  const [summary, setSummary] = useState<ScopeSummaryResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, headerRes, summaryRes] = await Promise.all([
        authFetch(`/tenders/${tenderId}/scope/items`),
        authFetch(`/tenders/${tenderId}/scope/header`),
        authFetch(`/tenders/${tenderId}/scope/summary`)
      ]);
      if (!listRes.ok) throw new Error(await listRes.text());
      if (!headerRes.ok) throw new Error(await headerRes.text());
      setData((await listRes.json()) as ListResponse);
      setHeader((await headerRes.json()) as Header);
      if (summaryRes.ok) setSummary((await summaryRes.json()) as ScopeSummaryResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function patchItem(itemId: string, body: Record<string, unknown>) {
    try {
      const response = await authFetch(`/tenders/${tenderId}/scope/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function confirmItem(itemId: string) {
    try {
      const response = await authFetch(`/tenders/${tenderId}/scope/items/${itemId}/confirm`, {
        method: "POST"
      });
      if (!response.ok) throw new Error(await response.text());
      setToast("Confirmed and added to estimate");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function excludeItem(itemId: string) {
    try {
      const response = await authFetch(`/tenders/${tenderId}/scope/items/${itemId}/exclude`, {
        method: "POST"
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function deleteItem(item: ScopeItem) {
    const msg = item.estimateItemId
      ? `Delete ${item.wbsCode}? It has a linked estimate line — the estimate line will NOT be removed.`
      : `Delete ${item.wbsCode}?`;
    if (!window.confirm(msg)) return;
    try {
      const response = await authFetch(`/tenders/${tenderId}/scope/items/${item.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function duplicateItem(item: ScopeItem) {
    const body: Record<string, unknown> = {
      discipline: item.discipline,
      rowType: item.rowType,
      description: `${item.description} (copy)`
    };
    // Carry numeric fields forward
    (
      [
        "men",
        "days",
        "shift",
        "sqm",
        "m3",
        "materialType",
        "cuttingEquipment",
        "elevation",
        "depthMm",
        "lm",
        "coreHoleDiameterMm",
        "coreHoleQty",
        "acmType",
        "acmMaterial",
        "enclosureRequired",
        "airMonitoring",
        "excavationDepthM",
        "excavationMaterial",
        "machineSize",
        "wasteType",
        "wasteFacility",
        "wasteTonnes",
        "wasteLoads",
        "wasteM3",
        "excavatorDays",
        "bobcatDays",
        "ewpDays",
        "hookTruckDays",
        "semiTipperDays"
      ] as const
    ).forEach((k) => {
      const v = item[k as keyof ScopeItem];
      if (v !== null && v !== undefined) body[k] = typeof v === "string" ? Number(v) || v : v;
    });
    try {
      const response = await authFetch(`/tenders/${tenderId}/scope/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const grouped = useMemo(() => {
    const items = data?.items ?? [];
    return DISCIPLINES.map((d) => ({
      discipline: d,
      meta: DISCIPLINE_META[d],
      items: items.filter((i) => i.discipline === d)
    }));
  }, [data]);

  if (loading && !data) return <div className="s7-card"><Skeleton width="100%" height={220} /></div>;

  if (error && !data) {
    return (
      <div className="s7-card" role="alert" style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}>
        {error}
      </div>
    );
  }

  const hasAnyItems = (data?.items ?? []).length > 0;

  return (
    <div className="sow-tab" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header className="sow-tab__header">
        <div>
          <h2 className="s7-type-page-title" style={{ margin: 0, fontSize: 24 }}>Scope of Works</h2>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>{tenderTitle}</p>
        </div>
        <button type="button" className="s7-btn s7-btn--secondary s7-btn--sm" onClick={() => setToast("Export coming soon")}>
          Export
        </button>
      </header>

      {header ? (
        <SiteContextCard
          header={header}
          open={headerOpen}
          onToggle={() => setHeaderOpen((p) => !p)}
          onSave={async (patch) => {
            try {
              const response = await authFetch(`/tenders/${tenderId}/scope/header`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch)
              });
              if (!response.ok) throw new Error(await response.text());
              setHeader((await response.json()) as Header);
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
      ) : null}

      <ScopeDisciplineBar
        selected={selectedDiscipline}
        onSelect={(d) => {
          setSelectedDiscipline(d);
          // Keep the smooth-scroll affordance — jumps to the selected group below.
          requestAnimationFrame(() => {
            document.getElementById(`sow-group-${d}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }}
        stats={
          summary
            ? {
                SO: summary.SO,
                Str: summary.Str,
                Asb: summary.Asb,
                Civ: summary.Civ,
                Prv: summary.Prv
              }
            : {
                SO: { itemCount: 0, subtotal: 0, withMarkup: 0 },
                Str: { itemCount: 0, subtotal: 0, withMarkup: 0 },
                Asb: { itemCount: 0, subtotal: 0, withMarkup: 0 },
                Civ: { itemCount: 0, subtotal: 0, withMarkup: 0 },
                Prv: { itemCount: 0, subtotal: 0, withMarkup: 0 }
              }
        }
      />

      {summary ? null : (
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: -8 }}>
          Legacy summary fallback · reopen the tab if totals look stale.
        </p>
      )}

      {error ? (
        <div
          className="s7-card"
          role="alert"
          style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}
        >
          {error}
        </div>
      ) : null}

      {!hasAnyItems ? (
        <div className="s7-card" style={{ padding: 40, textAlign: "center" }}>
          <EmptyState
            heading="No scope items yet"
            subtext="Add rows manually or ask Claude to propose scope from your uploaded documents."
            action={
              <button
                type="button"
                className="s7-btn s7-btn--primary"
                onClick={() => {
                  setAddOpenForDiscipline("SO");
                  document.getElementById("sow-group-SO")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                + Add scope items manually
              </button>
            }
          />
        </div>
      ) : null}

      {grouped
        .filter((group) => group.discipline === selectedDiscipline)
        .map((group) => (
        <DisciplineGroup
          key={group.discipline}
          discipline={group.discipline}
          meta={group.meta}
          items={group.items}
          addOpen={addOpenForDiscipline === group.discipline}
          onAddOpen={() => setAddOpenForDiscipline(group.discipline)}
          onAddClose={() => setAddOpenForDiscipline(null)}
          onAdd={async (body) => {
            try {
              const response = await authFetch(`/tenders/${tenderId}/scope/items`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
              });
              if (!response.ok) throw new Error(await response.text());
              const created = (await response.json()) as ScopeItem;
              setToast(`${created.wbsCode} added to scope and estimate`);
              setAddOpenForDiscipline(null);
              await load();
            } catch (err) {
              setError((err as Error).message);
            }
          }}
          onEdit={patchItem}
          onConfirm={confirmItem}
          onExclude={excludeItem}
          onDelete={deleteItem}
          onDuplicate={duplicateItem}
        />
      ))}

      {selectedDiscipline !== "Asb" ? (
        <ScopeCuttingSheet
          tenderId={tenderId}
          wbsRefs={(data?.items ?? [])
            .filter((i) => i.discipline === selectedDiscipline)
            .map((i) => i.wbsCode)}
          canManage={true}
        />
      ) : null}

      {summary ? (
        <ScopeGrandTotalBar
          stats={{
            SO: summary.SO,
            Str: summary.Str,
            Asb: summary.Asb,
            Civ: summary.Civ,
            Prv: summary.Prv
          }}
          cuttingSubtotal={summary.cutting.subtotal}
          tenderPrice={summary.tenderPrice}
        />
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
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            zIndex: 100
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function SiteContextCard({
  header,
  open,
  onToggle,
  onSave
}: {
  header: Header;
  open: boolean;
  onToggle: () => void;
  onSave: (patch: Partial<Header>) => Promise<void>;
}) {
  const [form, setForm] = useState(header);
  useEffect(() => setForm(header), [header]);

  return (
    <section className="s7-card">
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          background: "transparent",
          border: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          padding: 0,
          textAlign: "left"
        }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Site context</h3>
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
          {open ? "▲ Hide" : "▼ Edit"}
        </span>
      </button>
      {open ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field label="Site address" full>
            <input
              className="s7-input"
              value={form.siteAddress ?? ""}
              onChange={(e) => setForm({ ...form, siteAddress: e.target.value })}
              onBlur={() => void onSave({ siteAddress: form.siteAddress })}
            />
          </Field>
          <Field label="Site contact name">
            <input
              className="s7-input"
              value={form.siteContactName ?? ""}
              onChange={(e) => setForm({ ...form, siteContactName: e.target.value })}
              onBlur={() => void onSave({ siteContactName: form.siteContactName })}
            />
          </Field>
          <Field label="Site contact phone">
            <input
              className="s7-input"
              value={form.siteContactPhone ?? ""}
              onChange={(e) => setForm({ ...form, siteContactPhone: e.target.value })}
              onBlur={() => void onSave({ siteContactPhone: form.siteContactPhone })}
            />
          </Field>
          <Field label="Proposed start date">
            <input
              type="date"
              className="s7-input"
              value={form.proposedStartDate ? form.proposedStartDate.slice(0, 10) : ""}
              onChange={(e) => setForm({ ...form, proposedStartDate: e.target.value })}
              onBlur={() =>
                void onSave({ proposedStartDate: form.proposedStartDate || null })
              }
            />
          </Field>
          <Field label="Duration (weeks)">
            <input
              type="number"
              className="s7-input"
              value={form.durationWeeks ?? ""}
              onChange={(e) =>
                setForm({ ...form, durationWeeks: e.target.value ? Number(e.target.value) : null })
              }
              onBlur={() => void onSave({ durationWeeks: form.durationWeeks })}
            />
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Access constraints" full>
              <textarea
                rows={2}
                className="s7-input"
                value={form.accessConstraints ?? ""}
                onChange={(e) => setForm({ ...form, accessConstraints: e.target.value })}
                onBlur={() => void onSave({ accessConstraints: form.accessConstraints })}
              />
            </Field>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Special conditions" full>
              <textarea
                rows={2}
                className="s7-input"
                value={form.specialConditions ?? ""}
                onChange={(e) => setForm({ ...form, specialConditions: e.target.value })}
                onBlur={() => void onSave({ specialConditions: form.specialConditions })}
              />
            </Field>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DisciplineGroup({
  discipline,
  meta,
  items,
  addOpen,
  onAddOpen,
  onAddClose,
  onAdd,
  onEdit,
  onConfirm,
  onExclude,
  onDelete,
  onDuplicate
}: {
  discipline: Discipline;
  meta: { long: string; accent: string };
  items: ScopeItem[];
  addOpen: boolean;
  onAddOpen: () => void;
  onAddClose: () => void;
  onAdd: (body: Record<string, unknown>) => Promise<void>;
  onEdit: (id: string, body: Record<string, unknown>) => Promise<void>;
  onConfirm: (id: string) => Promise<void>;
  onExclude: (id: string) => Promise<void>;
  onDelete: (item: ScopeItem) => Promise<void>;
  onDuplicate: (item: ScopeItem) => Promise<void>;
}) {
  const visible = items.filter((i) => i.status !== "excluded");
  const excluded = items.filter((i) => i.status === "excluded");

  // Detect which contextual column groups are in use
  const present = {
    demolition: visible.some((i) => i.rowType === "demolition"),
    cutting: visible.some((i) => i.rowType === "cutting"),
    coreHole: visible.some((i) => (i.coreHoleQty ?? null) !== null || (i.coreHoleDiameterMm ?? null) !== null),
    asbestos: visible.some((i) => i.rowType === "asbestos"),
    excavation: visible.some((i) => i.rowType === "excavation"),
    waste: visible.some((i) => i.rowType === "waste" || (i.wasteTonnes ?? null) !== null),
    plant: visible.some(
      (i) =>
        (i.excavatorDays ?? null) !== null ||
        (i.bobcatDays ?? null) !== null ||
        (i.ewpDays ?? null) !== null ||
        (i.hookTruckDays ?? null) !== null ||
        (i.semiTipperDays ?? null) !== null
    )
  };

  return (
    <section
      id={`sow-group-${discipline}`}
      className="s7-card"
      style={{ borderLeft: `4px solid ${meta.accent}`, padding: 16 }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              background: meta.accent,
              color: "#fff",
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 999,
              fontSize: 12,
              letterSpacing: "0.05em"
            }}
          >
            {discipline}
          </span>
          <strong>{meta.long}</strong>
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
            · {visible.length} {visible.length === 1 ? "item" : "items"}
          </span>
        </div>
        <button type="button" className="s7-btn s7-btn--secondary s7-btn--sm" onClick={onAddOpen}>
          + Add {discipline} item
        </button>
      </header>

      {visible.length === 0 && !addOpen ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>No items in this discipline yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="sow-items-table">
            <thead>
              <tr>
                <th>WBS</th>
                <th style={{ minWidth: 260 }}>Description</th>
                <th>Row type</th>
                <th>Men</th>
                <th>Days</th>
                <th>Shift</th>
                {present.demolition ? (
                  <>
                    <th>Sqm</th>
                    <th>M³</th>
                    <th>Material</th>
                  </>
                ) : null}
                {present.cutting ? (
                  <>
                    <th>Equipment</th>
                    <th>Elev.</th>
                    <th>Depth mm</th>
                    <th>Lm</th>
                  </>
                ) : null}
                {present.coreHole ? (
                  <>
                    <th>Core Ø mm</th>
                    <th>Holes</th>
                  </>
                ) : null}
                {present.asbestos ? (
                  <>
                    <th>ACM type</th>
                    <th>Material</th>
                    <th>Enclosure</th>
                    <th>Air mon.</th>
                  </>
                ) : null}
                {present.excavation ? (
                  <>
                    <th>Depth m</th>
                    <th>Exc. material</th>
                    <th>Machine</th>
                  </>
                ) : null}
                {present.waste ? (
                  <>
                    <th>Waste type</th>
                    <th>Facility</th>
                    <th>Tonnes</th>
                    <th>Loads</th>
                  </>
                ) : null}
                {present.plant ? (
                  <>
                    <th>Exc. d</th>
                    <th>Bobcat d</th>
                    <th>EWP d</th>
                    <th>Hook d</th>
                    <th>Semi d</th>
                  </>
                ) : null}
                <th>Notes</th>
                <th style={{ width: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  present={present}
                  onEdit={onEdit}
                  onConfirm={onConfirm}
                  onExclude={onExclude}
                  onDelete={onDelete}
                  onDuplicate={onDuplicate}
                />
              ))}
              {addOpen ? (
                <AddRow
                  discipline={discipline}
                  onCancel={onAddClose}
                  onAdd={onAdd}
                  present={present}
                />
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {excluded.length > 0 ? (
        <details style={{ marginTop: 12 }}>
          <summary style={{ color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>
            Excluded ({excluded.length})
          </summary>
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", fontSize: 13 }}>
            {excluded.map((item) => (
              <li key={item.id} style={{ color: "var(--text-muted)", textDecoration: "line-through", padding: "4px 0" }}>
                {item.wbsCode} · {item.description}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

type PresentFlags = {
  demolition: boolean;
  cutting: boolean;
  coreHole: boolean;
  asbestos: boolean;
  excavation: boolean;
  waste: boolean;
  plant: boolean;
};

function ItemRow({
  item,
  present,
  onEdit,
  onConfirm,
  onExclude,
  onDelete,
  onDuplicate
}: {
  item: ScopeItem;
  present: PresentFlags;
  onEdit: (id: string, body: Record<string, unknown>) => Promise<void>;
  onConfirm: (id: string) => Promise<void>;
  onExclude: (id: string) => Promise<void>;
  onDelete: (item: ScopeItem) => Promise<void>;
  onDuplicate: (item: ScopeItem) => Promise<void>;
}) {
  const isDraft = item.status === "draft" && item.aiProposed;
  const confidence = item.aiConfidence ? CONFIDENCE_STYLE[item.aiConfidence] : null;
  const rowStyle: React.CSSProperties = isDraft ? { background: "#FEF3C7" } : {};

  return (
    <tr style={rowStyle}>
      <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
        {isDraft ? (
          <span
            style={{
              background: "#F59E0B",
              color: "#fff",
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
              marginRight: 6,
              letterSpacing: "0.04em"
            }}
          >
            AI
          </span>
        ) : null}
        {item.wbsCode}
      </td>
      <td>
        <EditableText value={item.description} onSave={(v) => onEdit(item.id, { description: v })} />
        {isDraft ? (
          <div style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {confidence ? (
              <span
                className="type-badge"
                style={{ background: confidence.bg, color: confidence.fg, fontSize: 11 }}
              >
                {confidence.label}
              </span>
            ) : null}
            {item.aiSourceRef ? (
              <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{item.aiSourceRef}</span>
            ) : null}
          </div>
        ) : null}
      </td>
      <td>
        <select
          value={item.rowType}
          onChange={(e) => void onEdit(item.id, { rowType: e.target.value })}
          style={{ fontSize: 13, padding: 4 }}
        >
          {ROW_TYPES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </td>
      <td>
        <EditableNum value={item.men} onSave={(v) => onEdit(item.id, { men: v })} />
      </td>
      <td>
        <EditableNum value={item.days} onSave={(v) => onEdit(item.id, { days: v })} />
      </td>
      <td>
        <select
          value={item.shift ?? "Day"}
          onChange={(e) => void onEdit(item.id, { shift: e.target.value })}
          style={{ fontSize: 13, padding: 4 }}
        >
          <option>Day</option>
          <option>Night</option>
          <option>Weekend</option>
        </select>
      </td>
      {present.demolition ? (
        <>
          <td><EditableNum value={item.sqm} onSave={(v) => onEdit(item.id, { sqm: v })} /></td>
          <td><EditableNum value={item.m3} onSave={(v) => onEdit(item.id, { m3: v })} /></td>
          <td><EditableText value={item.materialType} onSave={(v) => onEdit(item.id, { materialType: v })} /></td>
        </>
      ) : null}
      {present.cutting ? (
        <>
          <td><EditableText value={item.cuttingEquipment} onSave={(v) => onEdit(item.id, { cuttingEquipment: v })} /></td>
          <td><EditableText value={item.elevation} onSave={(v) => onEdit(item.id, { elevation: v })} /></td>
          <td><EditableInt value={item.depthMm} onSave={(v) => onEdit(item.id, { depthMm: v })} /></td>
          <td><EditableNum value={item.lm} onSave={(v) => onEdit(item.id, { lm: v })} /></td>
        </>
      ) : null}
      {present.coreHole ? (
        <>
          <td><EditableInt value={item.coreHoleDiameterMm} onSave={(v) => onEdit(item.id, { coreHoleDiameterMm: v })} /></td>
          <td><EditableNum value={item.coreHoleQty} onSave={(v) => onEdit(item.id, { coreHoleQty: v })} /></td>
        </>
      ) : null}
      {present.asbestos ? (
        <>
          <td><EditableText value={item.acmType} onSave={(v) => onEdit(item.id, { acmType: v })} /></td>
          <td><EditableText value={item.acmMaterial} onSave={(v) => onEdit(item.id, { acmMaterial: v })} /></td>
          <td><EditableBool value={item.enclosureRequired} onSave={(v) => onEdit(item.id, { enclosureRequired: v })} /></td>
          <td><EditableBool value={item.airMonitoring} onSave={(v) => onEdit(item.id, { airMonitoring: v })} /></td>
        </>
      ) : null}
      {present.excavation ? (
        <>
          <td><EditableNum value={item.excavationDepthM} onSave={(v) => onEdit(item.id, { excavationDepthM: v })} /></td>
          <td><EditableText value={item.excavationMaterial} onSave={(v) => onEdit(item.id, { excavationMaterial: v })} /></td>
          <td><EditableText value={item.machineSize} onSave={(v) => onEdit(item.id, { machineSize: v })} /></td>
        </>
      ) : null}
      {present.waste ? (
        <>
          <td><EditableText value={item.wasteType} onSave={(v) => onEdit(item.id, { wasteType: v })} /></td>
          <td><EditableText value={item.wasteFacility} onSave={(v) => onEdit(item.id, { wasteFacility: v })} /></td>
          <td><EditableNum value={item.wasteTonnes} onSave={(v) => onEdit(item.id, { wasteTonnes: v })} /></td>
          <td><EditableInt value={item.wasteLoads} onSave={(v) => onEdit(item.id, { wasteLoads: v })} /></td>
        </>
      ) : null}
      {present.plant ? (
        <>
          <td><EditableNum value={item.excavatorDays} onSave={(v) => onEdit(item.id, { excavatorDays: v })} /></td>
          <td><EditableNum value={item.bobcatDays} onSave={(v) => onEdit(item.id, { bobcatDays: v })} /></td>
          <td><EditableNum value={item.ewpDays} onSave={(v) => onEdit(item.id, { ewpDays: v })} /></td>
          <td><EditableNum value={item.hookTruckDays} onSave={(v) => onEdit(item.id, { hookTruckDays: v })} /></td>
          <td><EditableNum value={item.semiTipperDays} onSave={(v) => onEdit(item.id, { semiTipperDays: v })} /></td>
        </>
      ) : null}
      <td>
        <EditableText value={item.notes} onSave={(v) => onEdit(item.id, { notes: v })} />
      </td>
      <td>
        {isDraft ? (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              className="s7-btn s7-btn--primary s7-btn--sm"
              onClick={() => void onConfirm(item.id)}
            >
              ✓ Confirm
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => void onExclude(item.id)}
            >
              ✕
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => void onDuplicate(item)}
              aria-label="Duplicate"
              title="Duplicate"
            >
              ⧉
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => void onDelete(item)}
              aria-label="Delete"
              title="Delete"
            >
              🗑
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function AddRow({
  discipline,
  onCancel,
  onAdd,
  present: _present
}: {
  discipline: Discipline;
  onCancel: () => void;
  onAdd: (body: Record<string, unknown>) => Promise<void>;
  present: PresentFlags;
}) {
  const [rowType, setRowType] = useState<RowType>("general");
  const [description, setDescription] = useState("");
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  const update = (key: string, value: string | number | boolean | null) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);
    const body: Record<string, unknown> = {
      discipline,
      rowType,
      description: description.trim(),
      ...form
    };
    await onAdd(body);
    setSubmitting(false);
  }

  return (
    <tr style={{ background: "rgba(254, 170, 109, 0.08)" }}>
      <td colSpan={99} style={{ padding: 12 }}>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ROW_TYPES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRowType(r)}
                style={{
                  background: rowType === r ? "#FEAA6D" : "#F1EFE8",
                  color: rowType === r ? "#1F2937" : "#374151",
                  border: 0,
                  padding: "4px 12px",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: rowType === r ? 600 : 400
                }}
              >
                {r[0].toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
          <input
            className="s7-input"
            placeholder="Description…"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: "100%" }}
            autoFocus
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <AddNumInput label="Men" onChange={(v) => update("men", v)} />
            <AddNumInput label="Days" onChange={(v) => update("days", v)} />
            <AddSelect label="Shift" options={["Day", "Night", "Weekend"]} onChange={(v) => update("shift", v)} />
            {rowType === "demolition" ? (
              <>
                <AddNumInput label="Sqm" onChange={(v) => update("sqm", v)} />
                <AddNumInput label="M³" onChange={(v) => update("m3", v)} />
                <AddTextInput label="Material" onChange={(v) => update("materialType", v)} />
              </>
            ) : null}
            {rowType === "cutting" ? (
              <>
                <AddTextInput label="Equipment" onChange={(v) => update("cuttingEquipment", v)} />
                <AddTextInput label="Elevation" onChange={(v) => update("elevation", v)} />
                <AddIntInput label="Depth mm" onChange={(v) => update("depthMm", v)} />
                <AddNumInput label="Lm" onChange={(v) => update("lm", v)} />
                <AddIntInput label="Core Ø mm" onChange={(v) => update("coreHoleDiameterMm", v)} />
                <AddNumInput label="Core holes" onChange={(v) => update("coreHoleQty", v)} />
              </>
            ) : null}
            {rowType === "asbestos" ? (
              <>
                <AddTextInput label="ACM type" onChange={(v) => update("acmType", v)} />
                <AddTextInput label="ACM material" onChange={(v) => update("acmMaterial", v)} />
                <AddNumInput label="Sqm" onChange={(v) => update("sqm", v)} />
                <AddBoolInput label="Enclosure" onChange={(v) => update("enclosureRequired", v)} />
                <AddBoolInput label="Air monitoring" onChange={(v) => update("airMonitoring", v)} />
              </>
            ) : null}
            {rowType === "excavation" ? (
              <>
                <AddNumInput label="M³" onChange={(v) => update("m3", v)} />
                <AddNumInput label="Depth m" onChange={(v) => update("excavationDepthM", v)} />
                <AddTextInput label="Material" onChange={(v) => update("excavationMaterial", v)} />
                <AddTextInput label="Machine size" onChange={(v) => update("machineSize", v)} />
              </>
            ) : null}
            {rowType === "waste" ? (
              <>
                <AddTextInput label="Waste type" onChange={(v) => update("wasteType", v)} />
                <AddTextInput label="Facility" onChange={(v) => update("wasteFacility", v)} />
                <AddNumInput label="Tonnes" onChange={(v) => update("wasteTonnes", v)} />
                <AddIntInput label="Loads" onChange={(v) => update("wasteLoads", v)} />
              </>
            ) : null}
          </div>

          <details>
            <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--text-muted)" }}>Plant days</summary>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginTop: 8 }}>
              <AddNumInput label="Excavator d" onChange={(v) => update("excavatorDays", v)} />
              <AddNumInput label="Bobcat d" onChange={(v) => update("bobcatDays", v)} />
              <AddNumInput label="EWP d" onChange={(v) => update("ewpDays", v)} />
              <AddNumInput label="Hook truck d" onChange={(v) => update("hookTruckDays", v)} />
              <AddNumInput label="Semi d" onChange={(v) => update("semiTipperDays", v)} />
            </div>
          </details>

          <AddTextInput label="Notes" onChange={(v) => update("notes", v)} />

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="submit"
              className="s7-btn s7-btn--primary s7-btn--sm"
              disabled={submitting || !description.trim()}
            >
              {submitting ? "Adding…" : `Add ${discipline} item`}
            </button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function EditableText({
  value,
  onSave
}: {
  value: string | null;
  onSave: (v: string | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  return (
    <input
      className="sow-cell-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if ((value ?? "") !== draft) void onSave(draft || null);
      }}
    />
  );
}

function EditableNum({
  value,
  onSave
}: {
  value: string | null;
  onSave: (v: number | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  return (
    <input
      type="number"
      step="0.01"
      className="sow-cell-input sow-cell-input--num"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if ((value ?? "") === draft) return;
        void onSave(draft ? Number(draft) : null);
      }}
    />
  );
}

function EditableInt({
  value,
  onSave
}: {
  value: number | null;
  onSave: (v: number | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value !== null ? String(value) : "");
  useEffect(() => setDraft(value !== null ? String(value) : ""), [value]);
  return (
    <input
      type="number"
      className="sow-cell-input sow-cell-input--num"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft ? Number(draft) : null;
        if (next === value) return;
        void onSave(next);
      }}
    />
  );
}

function EditableBool({
  value,
  onSave
}: {
  value: boolean | null;
  onSave: (v: boolean) => Promise<void>;
}) {
  return (
    <input
      type="checkbox"
      checked={value ?? false}
      onChange={(e) => void onSave(e.target.checked)}
    />
  );
}

function AddTextInput({ label, onChange }: { label: string; onChange: (v: string | null) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <input className="s7-input" onChange={(e) => onChange(e.target.value || null)} />
    </label>
  );
}

function AddNumInput({ label, onChange }: { label: string; onChange: (v: number | null) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <input
        type="number"
        step="0.01"
        className="s7-input"
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      />
    </label>
  );
}

function AddIntInput({ label, onChange }: { label: string; onChange: (v: number | null) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <input
        type="number"
        className="s7-input"
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      />
    </label>
  );
}

function AddSelect({
  label,
  options,
  onChange
}: {
  label: string;
  options: string[];
  onChange: (v: string | null) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <select className="s7-input" onChange={(e) => onChange(e.target.value || null)}>
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function AddBoolInput({ label, onChange }: { label: string; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
      <input type="checkbox" onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Field({
  label,
  children,
  full
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: full ? "1 / -1" : undefined }}>
      <span className="s7-type-label">{label}</span>
      {children}
    </label>
  );
}
