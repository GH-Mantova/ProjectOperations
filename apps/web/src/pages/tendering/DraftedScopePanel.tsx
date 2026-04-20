import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

export type ProposedScopeItem = {
  code: "SO" | "Str" | "Asb" | "Civ" | "Prv";
  title: string;
  description: string;
  estimatedLabourDays?: number;
  estimatedLabourRole?: string;
  estimatedPlantItems?: Array<{ item: string; days: number }>;
  estimatedWasteTonnes?: Array<{ type: string; tonnes: number }>;
  confidence: "high" | "medium" | "low";
  sourceReference?: string;
};

export type DraftResult = {
  proposals: ProposedScopeItem[];
  documentsRead: number;
  documentsSkipped: string[];
  mode: "live";
  revisionId?: string;
};

export type EstimateItemRef = {
  id: string;
  code: string;
  itemNumber: number;
  title: string;
};

const TYPE_STYLE: Record<ProposedScopeItem["code"], { bg: string; fg: string; label: string }> = {
  SO: { bg: "#F1EFE8", fg: "#2C2C2A", label: "SO" },
  Str: { bg: "#E6F1FB", fg: "#0C447C", label: "Str" },
  Asb: { bg: "#FAEEDA", fg: "#633806", label: "Asb" },
  Civ: { bg: "#EAF3DE", fg: "#27500A", label: "Civ" },
  Prv: { bg: "#F1EFE8", fg: "#444441", label: "Prv" }
};

const CONFIDENCE_STYLE: Record<ProposedScopeItem["confidence"], { bg: string; fg: string }> = {
  high: { bg: "#EAF3DE", fg: "#3B6D11" },
  medium: { bg: "#FAEEDA", fg: "#854F0B" },
  low: { bg: "#FCEBEB", fg: "#A32D2D" }
};

type LabourRate = { id: string; role: string; dayRate: string; nightRate: string; weekendRate: string; isActive: boolean };
type PlantRate = { id: string; item: string; rate: string; isActive: boolean };

type LinkChoice = string; // "new" | "skip" | existing item id

export function DraftedScopePanel({
  tenderId,
  draft,
  estimateItems,
  onReDraft,
  onClear,
  onImported,
  drafting,
  canManage
}: {
  tenderId: string;
  draft: DraftResult;
  estimateItems: EstimateItemRef[];
  onReDraft: (correction: string) => void;
  onClear: () => void;
  onImported: (count: number) => void;
  drafting: boolean;
  canManage: boolean;
}) {
  const { authFetch } = useAuth();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [linkChoices, setLinkChoices] = useState<Record<number, LinkChoice>>({});
  const [importing, setImporting] = useState<Record<number, boolean>>({});
  const [bulkImporting, setBulkImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  // Default link: create new item of the matching code
  useEffect(() => {
    const defaults: Record<number, LinkChoice> = {};
    draft.proposals.forEach((p, idx) => {
      if (linkChoices[idx] === undefined) defaults[idx] = `new:${p.code}`;
    });
    if (Object.keys(defaults).length > 0) {
      setLinkChoices((prev) => ({ ...defaults, ...prev }));
    }
  }, [draft.proposals, linkChoices]);

  const toggleExpand = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectedForBulk = useMemo(
    () => Object.entries(linkChoices).filter(([, choice]) => choice && choice !== "skip").length,
    [linkChoices]
  );

  const importOne = async (idx: number) => {
    const proposal = draft.proposals[idx];
    const choice = linkChoices[idx];
    if (!proposal || !choice || choice === "skip") return;

    setImporting((prev) => ({ ...prev, [idx]: true }));
    setError(null);
    try {
      await doImport(proposal, choice);
      onImported(1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImporting((prev) => ({ ...prev, [idx]: false }));
    }
  };

  const importAll = async () => {
    setBulkImporting(true);
    setError(null);
    let count = 0;
    try {
      // Ensure estimate exists
      const estRes = await authFetch(`/tenders/${tenderId}/estimate`);
      if (!estRes.ok || (await estRes.clone().text()) === "null") {
        await authFetch(`/tenders/${tenderId}/estimate`, { method: "POST" });
      }

      for (const [idxStr, choice] of Object.entries(linkChoices)) {
        if (!choice || choice === "skip") continue;
        const idx = Number(idxStr);
        const proposal = draft.proposals[idx];
        if (!proposal) continue;
        await doImport(proposal, choice);
        count += 1;
      }
      onImported(count);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBulkImporting(false);
    }
  };

  const doImport = async (proposal: ProposedScopeItem, choice: LinkChoice) => {
    const [kind, value] = choice.startsWith("new:") ? ["new", choice.slice(4)] : ["existing", choice];

    if (kind === "new") {
      const code = value as ProposedScopeItem["code"];
      const createRes = await authFetch(`/tenders/${tenderId}/estimate/items`, {
        method: "POST",
        body: JSON.stringify({
          code,
          title: proposal.title.slice(0, 120),
          description: proposal.description,
          isProvisional: code === "Prv",
          provisionalAmount: code === "Prv" ? "0" : undefined
        })
      });
      if (!createRes.ok) throw new Error(await createRes.text());
      const updated = (await createRes.json()) as { items: EstimateItemRef[] };
      const created = [...updated.items]
        .filter((it) => it.code === code && it.title === proposal.title.slice(0, 120))
        .sort((a, b) => b.itemNumber - a.itemNumber)[0];
      if (created) {
        await addLabourAndPlantLines(created.id, proposal);
      }
      return;
    }

    // Append to existing: PATCH item description
    const itemId = value;
    const existing = estimateItems.find((it) => it.id === itemId);
    const prefix = existing ? `[Existing description]` : "";
    const addition = `\n\n[AI addition]\n${proposal.description}`;
    await authFetch(`/tenders/${tenderId}/estimate/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ description: `${prefix}${addition}`.trim() })
    });

    // If existing item has no labour lines and AI has estimates, confirm before adding
    if (proposal.estimatedLabourDays && proposal.estimatedLabourDays > 0) {
      const confirmAdd = window.confirm(
        `Add estimated ${proposal.estimatedLabourDays} labour day${proposal.estimatedLabourDays === 1 ? "" : "s"} to "${existing?.code}-${existing?.itemNumber} ${existing?.title}"?`
      );
      if (confirmAdd) {
        await addLabourAndPlantLines(itemId, proposal);
      }
    }
  };

  const addLabourAndPlantLines = async (itemId: string, proposal: ProposedScopeItem) => {
    const [labourRes, plantRes] = await Promise.all([
      authFetch(`/estimate-rates/labour`),
      authFetch(`/estimate-rates/plant`)
    ]);
    const labour: LabourRate[] = labourRes.ok ? await labourRes.json() : [];
    const plant: PlantRate[] = plantRes.ok ? await plantRes.json() : [];

    if (proposal.estimatedLabourDays && proposal.estimatedLabourDays > 0) {
      const role = proposal.estimatedLabourRole ?? labour[0]?.role;
      const rate = labour.find((r) => r.role === role) ?? labour[0];
      if (role && rate) {
        await authFetch(`/tenders/${tenderId}/estimate/items/${itemId}/labour`, {
          method: "POST",
          body: JSON.stringify({
            role,
            qty: "1",
            days: String(proposal.estimatedLabourDays),
            shift: "Day",
            rate: rate.dayRate
          })
        });
      }
    }

    for (const p of proposal.estimatedPlantItems ?? []) {
      const rate = plant.find((r) => r.item === p.item);
      if (!rate) continue;
      await authFetch(`/tenders/${tenderId}/estimate/items/${itemId}/plant`, {
        method: "POST",
        body: JSON.stringify({
          plantItem: p.item,
          qty: "1",
          days: String(p.days),
          rate: rate.rate
        })
      });
    }
  };

  return (
    <section className="s7-card" aria-label="Drafted scope review">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
            ✨ Drafted scope ({draft.proposals.length} item{draft.proposals.length === 1 ? "" : "s"})
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Claude read {draft.documentsRead} document{draft.documentsRead === 1 ? "" : "s"}
            {draft.documentsSkipped.length > 0 ? ` · skipped ${draft.documentsSkipped.length} (DWG)` : ""}.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {canManage ? (
            <>
              <button
                type="button"
                className="s7-btn s7-btn--primary"
                onClick={() => void importAll()}
                disabled={bulkImporting || selectedForBulk === 0}
              >
                {bulkImporting ? "Importing…" : `Import all selected (${selectedForBulk}) →`}
              </button>
              <button type="button" className="s7-btn s7-btn--secondary s7-btn--sm" onClick={onClear}>
                Clear draft
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{error}</p> : null}

      <div style={{ overflowX: "auto", marginTop: 12 }}>
        <table className="drafted-scope-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Title</th>
              <th>Description</th>
              <th>Confidence</th>
              <th>Est. Labour</th>
              <th>Est. Waste</th>
              <th>Link to scope item</th>
              <th aria-label="Action" />
            </tr>
          </thead>
          <tbody>
            {draft.proposals.map((p, idx) => {
              const typeStyle = TYPE_STYLE[p.code];
              const confStyle = CONFIDENCE_STYLE[p.confidence];
              const waste = (p.estimatedWasteTonnes ?? []).reduce((s, w) => s + w.tonnes, 0);
              const expanded = expandedRows.has(idx);
              const choice = linkChoices[idx] ?? `new:${p.code}`;
              return (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>
                    <span
                      className="type-badge"
                      style={{ background: typeStyle.bg, color: typeStyle.fg }}
                    >
                      {typeStyle.label}
                    </span>
                  </td>
                  <td style={{ minWidth: 180 }}>{p.title}</td>
                  <td style={{ minWidth: 260, maxWidth: 320 }}>
                    <button
                      type="button"
                      className="drafted-scope-desc"
                      onClick={() => toggleExpand(idx)}
                      aria-expanded={expanded}
                    >
                      {expanded ? p.description : `${p.description.slice(0, 120)}${p.description.length > 120 ? "…" : ""}`}
                    </button>
                    {p.sourceReference ? (
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                        Source: {p.sourceReference}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <span className="type-badge" style={{ background: confStyle.bg, color: confStyle.fg }}>
                      {p.confidence[0].toUpperCase() + p.confidence.slice(1)}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {p.estimatedLabourDays
                      ? `${p.estimatedLabourDays} day${p.estimatedLabourDays === 1 ? "" : "s"}${p.estimatedLabourRole ? ` — ${p.estimatedLabourRole}` : ""}`
                      : "—"}
                  </td>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {waste > 0 ? `~${waste.toFixed(1)} T` : "—"}
                  </td>
                  <td>
                    <select
                      className="s7-input s7-input--sm"
                      value={choice}
                      onChange={(e) => setLinkChoices((prev) => ({ ...prev, [idx]: e.target.value }))}
                      disabled={!canManage}
                      style={{ minWidth: 220 }}
                    >
                      <optgroup label="CREATE NEW">
                        <option value="new:SO">+ New SO item (Strip-outs)</option>
                        <option value="new:Str">+ New Str item (Structural)</option>
                        <option value="new:Asb">+ New Asb item (Asbestos)</option>
                        <option value="new:Civ">+ New Civ item (Civil)</option>
                        <option value="new:Prv">+ New Prv item (Provisional)</option>
                      </optgroup>
                      {estimateItems.length > 0 ? (
                        <optgroup label="ADD TO EXISTING">
                          {estimateItems.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.code}-{it.itemNumber} {it.title.slice(0, 40)}
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      <option value="skip">Skip this item</option>
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="s7-btn s7-btn--primary s7-btn--sm"
                      onClick={() => void importOne(idx)}
                      disabled={!canManage || choice === "skip" || importing[idx]}
                    >
                      {importing[idx] ? "…" : "Import"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canManage ? (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Re-draft with feedback
          </label>
          <textarea
            className="s7-input"
            rows={2}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Add scaffolding for levels 2-3; remove the structural demo item — that's a separate package."
          />
          <button
            type="button"
            className="s7-btn s7-btn--secondary s7-btn--sm"
            onClick={() => onReDraft(feedback.trim())}
            disabled={!feedback.trim() || drafting}
            style={{ alignSelf: "flex-start" }}
          >
            {drafting ? "Claude is revising…" : "Re-draft with this feedback"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
