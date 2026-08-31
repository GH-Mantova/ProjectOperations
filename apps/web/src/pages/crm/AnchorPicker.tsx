import { useEffect, useMemo, useState } from "react";
import { readApiErrorMessage } from "../../lib/api-errors";

// CRM S9 — AnchorPicker.
//
// Two-step control (Marco's decision 4) used to anchor a new comms thread
// to a CRM record from the unanchored Comms inbox. Before this control,
// /crm/comms had no way to reach anchored mode — createThread(...) exits
// early unless anchored, and anchored is set only by the query string.
//
// Step 1: pick a type (Lead · Tender · Job · Account · Contract · Other).
// Step 2: pick a record for that type (or, for Other, type a free-text label).
//
// The API validates entityType against COMM_ENTITY_TYPES on the server:
//   ACCOUNT · TENDER · OPPORTUNITY · JOB · CONTRACT
// "Lead" is served as OPPORTUNITY filtered by isLead=true (matching the
// unified CRM entries surface). "Other" is not a server-recognised entity
// type today — the picker still offers it (per spec) so the six-type list
// stays intact, but selecting it disables the Start button and shows a
// note. See STOP AND REPORT in docs/plans/crm-build-order-plan.md.

// ── Public shape ─────────────────────────────────────────────────────────────

/** The six types offered by the picker, in display order. */
export type PickerType = "LEAD" | "TENDER" | "JOB" | "ACCOUNT" | "CONTRACT" | "OTHER";

export const PICKER_TYPES: ReadonlyArray<{ value: PickerType; label: string }> = [
  { value: "LEAD", label: "Lead" },
  { value: "TENDER", label: "Tender" },
  { value: "JOB", label: "Job" },
  { value: "ACCOUNT", label: "Account" },
  { value: "CONTRACT", label: "Contract" },
  { value: "OTHER", label: "Other" }
];

/**
 * A completed picker selection — one of two variants:
 *  - `entity`: an existing record (kind + id), maps to a server entityType.
 *  - `other`: a free-text label with no entity id.
 *
 * The negative control test (S9 test 3) pins that a picker selection can
 * never be produced with an `entityType` and an empty `entityId` — that is
 * exactly the closed-loop state that made /crm/comms unusable on an empty
 * system before this slice.
 */
export type PickerSelection =
  | { kind: "entity"; type: Exclude<PickerType, "OTHER">; entityId: string; label: string }
  | { kind: "other"; label: string };

/** The wire shape POST /crm/comms/threads accepts. */
export type CreateThreadBody =
  | { entityType: "ACCOUNT" | "TENDER" | "OPPORTUNITY" | "JOB" | "CONTRACT"; entityId: string; subject?: string | null }
  | { subject?: string | null; otherLabel: string };

/**
 * Maps a picker selection to a POST /crm/comms/threads body.
 * Throws if given an `entity` selection with an empty entityId — the
 * negative control that closed the S9 loop.
 */
export function buildCreateThreadBody(sel: PickerSelection, subject?: string | null): CreateThreadBody {
  if (sel.kind === "entity") {
    if (!sel.entityId) {
      throw new Error("AnchorPicker: entityId must be non-empty for an entity selection");
    }
    return {
      entityType: mapTypeToServer(sel.type),
      entityId: sel.entityId,
      subject: subject ?? null
    };
  }
  return { subject: subject ?? null, otherLabel: sel.label };
}

/** Maps a picker type to the server-recognised CommEntityType. */
export function mapTypeToServer(t: Exclude<PickerType, "OTHER">): "ACCOUNT" | "TENDER" | "OPPORTUNITY" | "JOB" | "CONTRACT" {
  switch (t) {
    case "LEAD": return "OPPORTUNITY";
    case "TENDER": return "TENDER";
    case "JOB": return "JOB";
    case "ACCOUNT": return "ACCOUNT";
    case "CONTRACT": return "CONTRACT";
  }
}

// ── Record-fetch adapters (per type) ─────────────────────────────────────────

type RecordOption = { id: string; label: string };
type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Fetches up to `limit` records for the picker's second step.
 * Each type hits an endpoint that already exists — this component adds no
 * new API surface (per S9 STOP AND REPORT).
 */
export async function fetchPickerOptions(
  type: Exclude<PickerType, "OTHER">,
  authFetch: AuthFetch,
  search: string,
  limit = 25
): Promise<RecordOption[]> {
  const q = search.trim();
  switch (type) {
    case "LEAD": {
      // /crm/opportunities lists unified CRM entries; filter to leads only.
      const params = new URLSearchParams({ limit: String(limit) });
      const res = await authFetch(`/crm/opportunities?${params.toString()}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await res.json() as { items: Array<{ id: string; title: string; isLead: boolean }> };
      const items = data.items.filter((i) => i.isLead);
      const filtered = q ? items.filter((i) => i.title.toLowerCase().includes(q.toLowerCase())) : items;
      return filtered.slice(0, limit).map((i) => ({ id: i.id, label: i.title }));
    }
    case "TENDER": {
      const params = new URLSearchParams({ pageSize: String(limit) });
      if (q) params.set("q", q);
      const res = await authFetch(`/tenders?${params.toString()}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await res.json() as { items: Array<{ id: string; tenderNumber: string; title: string }> };
      return data.items.map((t) => ({ id: t.id, label: `${t.tenderNumber} — ${t.title}` }));
    }
    case "JOB": {
      const params = new URLSearchParams({ limit: String(limit) });
      if (q) params.set("q", q);
      const res = await authFetch(`/jobs?${params.toString()}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await res.json() as { items: Array<{ id: string; jobNumber: string; name: string }> };
      return data.items.map((j) => ({ id: j.id, label: `${j.jobNumber} — ${j.name}` }));
    }
    case "ACCOUNT": {
      // /crm/accounts/summary returns { id, name, ... } for every account.
      const res = await authFetch(`/crm/accounts/summary`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const items = await res.json() as Array<{ id: string; name: string }>;
      const filtered = q ? items.filter((a) => a.name.toLowerCase().includes(q.toLowerCase())) : items;
      return filtered.slice(0, limit).map((a) => ({ id: a.id, label: a.name }));
    }
    case "CONTRACT": {
      const params = new URLSearchParams({ limit: String(limit) });
      const res = await authFetch(`/contracts?${params.toString()}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res));
      const data = await res.json() as { items: Array<{ id: string; contractNumber: string; project?: { name?: string | null } | null }> };
      const rows = data.items.map((c) => ({
        id: c.id,
        label: c.project?.name ? `${c.contractNumber} — ${c.project.name}` : c.contractNumber
      }));
      return q ? rows.filter((r) => r.label.toLowerCase().includes(q.toLowerCase())) : rows;
    }
  }
}

// ── Component ────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrap: { border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, background: "#fafafa" },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 },
  typeBtn: { padding: "4px 10px", borderRadius: 999, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 12 },
  typeBtnActive: { padding: "4px 10px", borderRadius: 999, border: "1px solid #6366f1", background: "#eef2ff", color: "#3730a3", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  input: { padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, flex: 1, minWidth: 200 },
  select: { padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, flex: 1, minWidth: 200, background: "#fff" },
  note: { fontSize: 11, color: "#6b7280" }
};

export function AnchorPicker(props: {
  authFetch: AuthFetch;
  value: PickerSelection | null;
  onChange: (sel: PickerSelection | null) => void;
}) {
  const { authFetch, value, onChange } = props;
  const [type, setType] = useState<PickerType | null>(value?.kind === "entity" ? value.type : value?.kind === "other" ? "OTHER" : null);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<RecordOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherLabel, setOtherLabel] = useState(value?.kind === "other" ? value.label : "");

  const isOther = type === "OTHER";

  useEffect(() => {
    if (!type || isOther) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPickerOptions(type, authFetch, search)
      .then((opts) => { if (!cancelled) setOptions(opts); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [type, isOther, authFetch, search]);

  const activeSelectionId = value?.kind === "entity" ? value.entityId : "";

  const helpText = useMemo(() => {
    if (!type) return "Pick a record type to anchor this thread.";
    if (isOther) return "Anchoring against a non-record label is pending server support; the Start button will remain disabled.";
    if (loading) return "Loading…";
    if (error) return error;
    if (options.length === 0) return `No ${type.toLowerCase()} records found.`;
    return `${options.length} record${options.length === 1 ? "" : "s"} available.`;
  }, [type, isOther, loading, error, options.length]);

  return (
    <div style={styles.wrap} aria-label="Anchor picker">
      <div style={styles.row}>
        {PICKER_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            style={type === t.value ? styles.typeBtnActive : styles.typeBtn}
            onClick={() => {
              setType(t.value);
              onChange(null);
              setSearch("");
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {type && !isOther && (
        <div style={styles.row}>
          <input
            style={styles.input}
            placeholder={`Search ${type.toLowerCase()}s…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            style={styles.select}
            value={activeSelectionId}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) { onChange(null); return; }
              const opt = options.find((o) => o.id === id);
              if (!opt) { onChange(null); return; }
              onChange({ kind: "entity", type: type as Exclude<PickerType, "OTHER">, entityId: id, label: opt.label });
            }}
          >
            <option value="">— select a record —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {isOther && (
        <div style={styles.row}>
          <input
            style={styles.input}
            placeholder="Free-text label (e.g. supplier meeting)"
            value={otherLabel}
            onChange={(e) => {
              const v = e.target.value;
              setOtherLabel(v);
              if (v.trim()) onChange({ kind: "other", label: v.trim() });
              else onChange(null);
            }}
          />
        </div>
      )}

      <div style={styles.note}>{helpText}</div>
    </div>
  );
}
