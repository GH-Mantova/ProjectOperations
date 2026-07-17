import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type MilestoneTrigger = "DATE" | "PERCENT_COMPLETE" | "EVENT";
type MilestoneAmountType = "FIXED" | "PERCENT_OF_CONTRACT";
type MilestoneStatus = "PENDING" | "DUE" | "CLAIMED";

type Milestone = {
  id: string;
  name: string;
  description: string | null;
  triggerType: MilestoneTrigger;
  triggerDate: string | null;
  triggerPercent: string | null;
  triggerEvent: string | null;
  amountType: MilestoneAmountType;
  amount: string | null;
  amountPercent: string | null;
  status: MilestoneStatus;
  computedStatus: MilestoneStatus;
  claimId: string | null;
  claim?: { id: string; claimNumber: string; status: string } | null;
};

type RevRec = {
  contractValue: number;
  approvedVariationsTotal: number;
  revisedValue: number;
  billedToDate: number;
  recognisedToDate: number;
  paidToDate: number;
  outstandingBilled: number;
  unbilledRemaining: number;
  unrecognisedRemaining: number;
  retentionHeld: number;
  percentBilled: number;
  percentRecognised: number;
};

type ProFormaLine = {
  discipline: string;
  description: string;
  contractValue: number;
  previouslyClaimed: number;
  thisClaimAmount: number;
  variationId: string | null;
  sortOrder: number;
};

type ProFormaPreview = {
  claimMonth: string;
  lineItems: ProFormaLine[];
  totalContractValue: number;
  totalPreviouslyClaimed: number;
};

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(n);
}

const STATUS_COLOR: Record<MilestoneStatus, string> = {
  PENDING: "#9CA3AF",
  DUE: "#FEAA6D",
  CLAIMED: "#22C55E"
};

export function BillingTab({
  contractId,
  canManage,
  onRefresh
}: {
  contractId: string;
  canManage: boolean;
  onRefresh: () => Promise<void> | void;
}) {
  const { authFetch } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [revRec, setRevRec] = useState<RevRec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<ProFormaPreview | null>(null);

  const load = useCallback(async () => {
    try {
      const [msResp, revResp] = await Promise.all([
        authFetch(`/contracts/${contractId}/milestones`),
        authFetch(`/contracts/${contractId}/revenue-recognition`)
      ]);
      if (!msResp.ok) throw new Error(await msResp.text());
      if (!revResp.ok) throw new Error(await revResp.text());
      setMilestones((await msResp.json()) as Milestone[]);
      setRevRec((await revResp.json()) as RevRec);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch, contractId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createMilestone = async (dto: Record<string, unknown>) => {
    try {
      const response = await authFetch(`/contracts/${contractId}/milestones`, {
        method: "POST",
        body: JSON.stringify(dto)
      });
      if (!response.ok) throw new Error(await response.text());
      setAdding(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const markDue = async (m: Milestone) => {
    try {
      const response = await authFetch(`/contracts/${contractId}/milestones/${m.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "DUE" })
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const raiseClaim = async (m: Milestone) => {
    try {
      const response = await authFetch(`/contracts/${contractId}/milestones/${m.id}/claim`, {
        method: "POST",
        body: JSON.stringify({})
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
      await onRefresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteMilestone = async (m: Milestone) => {
    if (!window.confirm(`Delete milestone "${m.name}"?`)) return;
    try {
      const response = await authFetch(`/contracts/${contractId}/milestones/${m.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const previewProForma = async () => {
    const month = window.prompt("Preview month (YYYY-MM):", new Date().toISOString().slice(0, 7));
    if (!month) return;
    try {
      const response = await authFetch(`/contracts/${contractId}/claims/pro-forma/preview`, {
        method: "POST",
        body: JSON.stringify({ claimMonth: `${month}-01` })
      });
      if (!response.ok) throw new Error(await response.text());
      setPreview((await response.json()) as ProFormaPreview);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {revRec ? <RevRecCard rec={revRec} /> : null}

      <section className="s7-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Billing milestones</h3>
          <div style={{ display: "flex", gap: 6 }}>
            {canManage ? (
              <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => void previewProForma()}>
                Preview pro-forma
              </button>
            ) : null}
            {canManage ? (
              <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={() => setAdding(true)}>
                + Add milestone
              </button>
            ) : null}
          </div>
        </div>

        {adding ? <AddMilestoneForm onCancel={() => setAdding(false)} onSave={createMilestone} /> : null}

        {milestones.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No milestones yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
              <tr>
                {["Milestone", "Trigger", "Amount", "Status", ""].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => {
                const displayStatus = m.computedStatus;
                return (
                  <tr key={m.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 500 }}>{m.name}</td>
                    <td style={{ padding: "8px 10px" }}>{describeTrigger(m)}</td>
                    <td style={{ padding: "8px 10px" }}>{describeAmount(m)}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ padding: "1px 8px", borderRadius: 999, background: STATUS_COLOR[displayStatus], color: "#fff", fontSize: 11, fontWeight: 600 }}>
                        {displayStatus}
                      </span>
                      {m.claim ? (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)" }}>→ {m.claim.claimNumber}</span>
                      ) : null}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "right" }}>
                      {canManage && displayStatus === "PENDING" ? (
                        <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => void markDue(m)}>Mark due</button>
                      ) : null}
                      {canManage && displayStatus === "DUE" ? (
                        <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={() => void raiseClaim(m)}>Raise claim</button>
                      ) : null}
                      {canManage && displayStatus !== "CLAIMED" ? (
                        <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" style={{ marginLeft: 4 }} onClick={() => void deleteMilestone(m)}>Delete</button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {preview ? <ProFormaPreviewCard preview={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}

function RevRecCard({ rec }: { rec: RevRec }) {
  return (
    <section className="s7-card">
      <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Revenue recognition</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0 }}>
        Operational view. GL posting stays in Xero — this is the number the Xero push uses.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <dl style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 6, margin: 0, fontSize: 13 }}>
          <dt style={{ color: "var(--text-muted)" }}>Contract value</dt><dd>{fmtCurrency(rec.contractValue)}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Approved variations</dt><dd>{fmtCurrency(rec.approvedVariationsTotal)}</dd>
          <dt style={{ color: "var(--text-muted)", fontWeight: 600 }}>Revised value</dt>
          <dd style={{ fontWeight: 600 }}>{fmtCurrency(rec.revisedValue)}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Retention held</dt><dd>{fmtCurrency(rec.retentionHeld)}</dd>
        </dl>
        <dl style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 6, margin: 0, fontSize: 13 }}>
          <dt style={{ color: "var(--text-muted)" }}>Billed to date</dt>
          <dd>{fmtCurrency(rec.billedToDate)} ({rec.percentBilled.toFixed(1)}%)</dd>
          <dt style={{ color: "var(--text-muted)" }}>Recognised to date</dt>
          <dd>{fmtCurrency(rec.recognisedToDate)} ({rec.percentRecognised.toFixed(1)}%)</dd>
          <dt style={{ color: "var(--text-muted)" }}>Paid to date</dt><dd>{fmtCurrency(rec.paidToDate)}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Outstanding billed</dt><dd>{fmtCurrency(rec.outstandingBilled)}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Unbilled remaining</dt><dd>{fmtCurrency(rec.unbilledRemaining)}</dd>
        </dl>
      </div>
    </section>
  );
}

function ProFormaPreviewCard({ preview, onClose }: { preview: ProFormaPreview; onClose: () => void }) {
  const total = preview.lineItems.reduce((s, li) => s + li.thisClaimAmount, 0);
  return (
    <section className="s7-card" style={{ border: "2px dashed #FEAA6D" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
          Pro-forma preview — {new Date(preview.claimMonth).toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
        </h3>
        <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={onClose}>Close</button>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0 }}>
        Not persisted. Line values reflect current scope + APPROVED variations not yet claimed.
      </p>
      {preview.lineItems.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No lines to preview.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
            <tr>
              {["Discipline", "Description", "Contract $", "Previously claimed", "This claim"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.lineItems.map((li, idx) => (
              <tr key={idx} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                <td style={{ padding: "8px 10px", fontWeight: 500 }}>{li.discipline}</td>
                <td style={{ padding: "8px 10px" }}>{li.description}</td>
                <td style={{ padding: "8px 10px" }}>{fmtCurrency(li.contractValue)}</td>
                <td style={{ padding: "8px 10px" }}>{fmtCurrency(li.previouslyClaimed)}</td>
                <td style={{ padding: "8px 10px" }}>{fmtCurrency(li.thisClaimAmount)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid var(--border, #e5e7eb)", fontWeight: 600 }}>
              <td colSpan={4} style={{ padding: "8px 10px", textAlign: "right" }}>Total this claim</td>
              <td style={{ padding: "8px 10px" }}>{fmtCurrency(total)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}

function describeTrigger(m: Milestone): string {
  if (m.triggerType === "DATE") {
    return m.triggerDate ? `Date: ${new Date(m.triggerDate).toLocaleDateString("en-AU")}` : "Date";
  }
  if (m.triggerType === "PERCENT_COMPLETE") {
    return m.triggerPercent ? `${Number(m.triggerPercent).toFixed(1)}% complete` : "% complete";
  }
  return m.triggerEvent ? `Event: ${m.triggerEvent}` : "Event";
}

function describeAmount(m: Milestone): string {
  if (m.amountType === "FIXED") return m.amount ? fmtCurrency(Number(m.amount)) : "—";
  return m.amountPercent ? `${Number(m.amountPercent).toFixed(1)}% of contract` : "—";
}

function AddMilestoneForm({
  onCancel,
  onSave
}: {
  onCancel: () => void;
  onSave: (dto: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<MilestoneTrigger>("DATE");
  const [triggerDate, setTriggerDate] = useState("");
  const [triggerPercent, setTriggerPercent] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("");
  const [amountType, setAmountType] = useState<MilestoneAmountType>("FIXED");
  const [amount, setAmount] = useState("");
  const [amountPercent, setAmountPercent] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const dto: Record<string, unknown> = { name: name.trim(), triggerType, amountType };
    if (triggerType === "DATE") dto.triggerDate = triggerDate;
    if (triggerType === "PERCENT_COMPLETE") dto.triggerPercent = Number(triggerPercent);
    if (triggerType === "EVENT") dto.triggerEvent = triggerEvent.trim();
    if (amountType === "FIXED") dto.amount = Number(amount);
    if (amountType === "PERCENT_OF_CONTRACT") dto.amountPercent = Number(amountPercent);
    void onSave(dto);
  };

  return (
    <form
      onSubmit={submit}
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: 12, marginBottom: 12, background: "var(--surface-muted, #F6F6F6)", borderRadius: 6 }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / span 2" }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>Name</span>
        <input className="s7-input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>Trigger</span>
        <select className="s7-input" value={triggerType} onChange={(e) => setTriggerType(e.target.value as MilestoneTrigger)}>
          <option value="DATE">Date</option>
          <option value="PERCENT_COMPLETE">% complete</option>
          <option value="EVENT">Event</option>
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>Trigger value</span>
        {triggerType === "DATE" ? (
          <input className="s7-input" type="date" value={triggerDate} onChange={(e) => setTriggerDate(e.target.value)} required />
        ) : triggerType === "PERCENT_COMPLETE" ? (
          <input className="s7-input" type="number" min="0" max="100" step="0.1" value={triggerPercent} onChange={(e) => setTriggerPercent(e.target.value)} required />
        ) : (
          <input className="s7-input" value={triggerEvent} onChange={(e) => setTriggerEvent(e.target.value)} placeholder="e.g. Practical completion" required />
        )}
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>Amount type</span>
        <select className="s7-input" value={amountType} onChange={(e) => setAmountType(e.target.value as MilestoneAmountType)}>
          <option value="FIXED">Fixed $</option>
          <option value="PERCENT_OF_CONTRACT">% of contract</option>
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>Amount</span>
        {amountType === "FIXED" ? (
          <input className="s7-input" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        ) : (
          <input className="s7-input" type="number" min="0" max="100" step="0.1" value={amountPercent} onChange={(e) => setAmountPercent(e.target.value)} required />
        )}
      </label>
      <div style={{ gridColumn: "1 / span 2", display: "flex", justifyContent: "flex-end", gap: 6 }}>
        <button type="button" className="s7-btn s7-btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="s7-btn s7-btn--primary" disabled={!name.trim()}>Save</button>
      </div>
    </form>
  );
}
