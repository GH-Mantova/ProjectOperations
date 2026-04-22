import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

type ContractStatus = "ACTIVE" | "PRACTICAL_COMPLETION" | "DEFECTS" | "CLOSED";
type VariationStatus = "RECEIVED" | "PRICED" | "SUBMITTED" | "APPROVED";
type ClaimStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "PAID";

type Variation = {
  id: string;
  variationNumber: string;
  description: string;
  status: VariationStatus;
  requestedBy: string | null;
  pricedAmount: string | null;
  approvedAmount: string | null;
  receivedDate: string;
  pricedDate: string | null;
  submittedDate: string | null;
  approvedDate: string | null;
};

type ClaimHeader = {
  id: string;
  claimNumber: string;
  claimMonth: string;
  status: ClaimStatus;
  totalClaimed: string;
  totalApproved: string | null;
  totalPaid: string | null;
  submissionDate: string | null;
};

type Contract = {
  id: string;
  contractNumber: string;
  contractValue: string;
  retentionPct: string;
  retentionAmount: string;
  startDate: string | null;
  endDate: string | null;
  status: ContractStatus;
  notes: string | null;
  project: { id: string; projectNumber: string; name: string; client: { id: string; name: string } | null };
  variations: Variation[];
  progressClaims: ClaimHeader[];
};

function fmt(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(n);
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

const VAR_STATUS_COLOR: Record<VariationStatus, string> = {
  RECEIVED: "#9CA3AF",
  PRICED: "#FEAA6D",
  SUBMITTED: "#005B61",
  APPROVED: "#22C55E"
};
const CLAIM_STATUS_COLOR: Record<ClaimStatus, string> = {
  DRAFT: "#9CA3AF",
  SUBMITTED: "#FEAA6D",
  APPROVED: "#005B61",
  PAID: "#22C55E"
};

type Tab = "overview" | "variations" | "claims";

export function ContractDetailPage() {
  const { id } = useParams();
  const { authFetch, user } = useAuth();
  const canManage = user?.permissions.includes("finance.manage") ?? false;
  const canAdmin = user?.permissions.includes("finance.admin") ?? false;
  const [contract, setContract] = useState<Contract | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const response = await authFetch(`/contracts/${id}`);
      if (!response.ok) throw new Error(await response.text());
      setContract((await response.json()) as Contract);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!contract) return <div style={{ padding: 24 }}>{error ?? "Loading…"}</div>;

  const approvedVarsTotal = contract.variations
    .filter((v) => v.status === "APPROVED" && v.approvedAmount)
    .reduce((s, v) => s + Number(v.approvedAmount), 0);
  const claimedTotal = contract.progressClaims.reduce((s, c) => s + Number(c.totalClaimed ?? 0), 0);
  const approvedTotal = contract.progressClaims.reduce((s, c) => s + Number(c.totalApproved ?? 0), 0);
  const paidTotal = contract.progressClaims.reduce((s, c) => s + Number(c.totalPaid ?? 0), 0);

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <header style={{ marginBottom: 16 }}>
        <Link to="/contracts" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Back to contracts</Link>
        <h1 className="s7-type-page-heading" style={{ marginTop: 8 }}>
          {contract.contractNumber}
          <span style={{
            marginLeft: 12,
            padding: "2px 10px",
            borderRadius: 999,
            fontSize: 12,
            background: contract.status === "ACTIVE" ? "#005B61" : "#9CA3AF",
            color: "#fff",
            verticalAlign: "middle"
          }}>
            {contract.status.replace("_", " ")}
          </span>
        </h1>
        <p style={{ color: "var(--text-muted)", margin: 0 }}>
          <Link to={`/projects/${contract.project.id}`}>{contract.project.projectNumber} — {contract.project.name}</Link>
          {contract.project.client ? ` · ${contract.project.client.name}` : ""}
        </p>
      </header>

      <nav role="tablist" style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border, #e5e7eb)", marginBottom: 16 }}>
        {(["overview", "variations", "claims"] as Tab[]).map((t) => {
          const active = t === tab;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: "8px 16px",
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid #005B61" : "2px solid transparent",
                fontWeight: active ? 600 : 400,
                cursor: "pointer"
              }}
            >
              {t === "overview" ? "Overview" : t === "variations" ? `Variations (${contract.variations.length})` : `Progress claims (${contract.progressClaims.length})`}
            </button>
          );
        })}
      </nav>

      {tab === "overview" ? (
        <OverviewTab
          contract={contract}
          claimedTotal={claimedTotal}
          approvedTotal={approvedTotal}
          paidTotal={paidTotal}
          approvedVarsTotal={approvedVarsTotal}
        />
      ) : tab === "variations" ? (
        <VariationsTab contract={contract} canManage={canManage} onRefresh={load} />
      ) : (
        <ClaimsTab contract={contract} canManage={canManage} canAdmin={canAdmin} onRefresh={load} />
      )}
    </div>
  );
}

function OverviewTab({
  contract,
  claimedTotal,
  approvedTotal,
  paidTotal,
  approvedVarsTotal
}: {
  contract: Contract;
  claimedTotal: number;
  approvedTotal: number;
  paidTotal: number;
  approvedVarsTotal: number;
}) {
  const value = Number(contract.contractValue);
  const revised = value + approvedVarsTotal;
  const outstanding = approvedTotal - paidTotal;
  const retentionHeld = contract.progressClaims.reduce((s, c) => s + Number((c as unknown as { retentionHeld?: string }).retentionHeld ?? 0), 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <section className="s7-card">
        <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Contract details</h3>
        <dl style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, margin: 0, fontSize: 13 }}>
          <dt style={{ color: "var(--text-muted)" }}>Contract value</dt><dd>{fmt(contract.contractValue)}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Retention %</dt><dd>{Number(contract.retentionPct).toFixed(2)}%</dd>
          <dt style={{ color: "var(--text-muted)" }}>Start date</dt><dd>{fmtDate(contract.startDate)}</dd>
          <dt style={{ color: "var(--text-muted)" }}>End date</dt><dd>{fmtDate(contract.endDate)}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Notes</dt><dd style={{ whiteSpace: "pre-wrap" }}>{contract.notes ?? "—"}</dd>
        </dl>
      </section>

      <section className="s7-card">
        <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Financial summary</h3>
        <dl style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 6, margin: 0, fontSize: 13 }}>
          <dt style={{ color: "var(--text-muted)" }}>Original value</dt><dd>{fmt(contract.contractValue)}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Approved variations</dt><dd>{fmt(approvedVarsTotal)}</dd>
          <dt style={{ color: "var(--text-muted)", fontWeight: 600 }}>Revised value</dt><dd style={{ fontWeight: 600 }}>{fmt(revised)}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Total claimed</dt><dd>{fmt(claimedTotal)}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Total approved</dt><dd>{fmt(approvedTotal)}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Total paid</dt><dd>{fmt(paidTotal)}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Outstanding</dt><dd>{fmt(outstanding)}</dd>
          <dt style={{ color: "var(--text-muted)" }}>Retention held</dt><dd>{fmt(retentionHeld)}</dd>
        </dl>
      </section>
    </div>
  );
}

function VariationsTab({
  contract,
  canManage,
  onRefresh
}: {
  contract: Contract;
  canManage: boolean;
  onRefresh: () => Promise<void> | void;
}) {
  const { authFetch } = useAuth();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addVariation = async (description: string) => {
    try {
      const response = await authFetch(`/contracts/${contract.id}/variations`, {
        method: "POST",
        body: JSON.stringify({ description })
      });
      if (!response.ok) throw new Error(await response.text());
      setAdding(false);
      await onRefresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const advance = async (variationId: string, nextStatus: VariationStatus, extra: Record<string, unknown> = {}) => {
    try {
      const body: Record<string, unknown> = {
        status: nextStatus,
        ...(nextStatus === "PRICED" ? { pricedDate: new Date().toISOString() } : {}),
        ...(nextStatus === "SUBMITTED" ? { submittedDate: new Date().toISOString() } : {}),
        ...(nextStatus === "APPROVED" ? { approvedDate: new Date().toISOString() } : {}),
        ...extra
      };
      const response = await authFetch(`/contracts/${contract.id}/variations/${variationId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await response.text());
      await onRefresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="s7-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Variations</h3>
        {canManage ? (
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={() => setAdding(true)}>+ Add variation</button>
        ) : null}
      </div>

      {adding ? <AddVariationForm onCancel={() => setAdding(false)} onSave={addVariation} /> : null}
      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {contract.variations.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No variations yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
            <tr>
              {["Variation #", "Description", "Status", "Requested by", "Priced", "Approved", "Received", ""].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contract.variations.map((v) => (
              <tr key={v.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                <td style={{ padding: "8px 10px", fontWeight: 500 }}>{v.variationNumber}</td>
                <td style={{ padding: "8px 10px" }}>{v.description}</td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ padding: "1px 8px", borderRadius: 999, background: VAR_STATUS_COLOR[v.status], color: "#fff", fontSize: 11, fontWeight: 600 }}>
                    {v.status}
                  </span>
                </td>
                <td style={{ padding: "8px 10px" }}>{v.requestedBy ?? "—"}</td>
                <td style={{ padding: "8px 10px" }}>{fmt(v.pricedAmount)}</td>
                <td style={{ padding: "8px 10px" }}>{fmt(v.approvedAmount)}</td>
                <td style={{ padding: "8px 10px", color: "var(--text-muted)" }}>{fmtDate(v.receivedDate)}</td>
                <td style={{ padding: "8px 10px", textAlign: "right" }}>
                  {canManage && v.status !== "APPROVED" ? (
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost s7-btn--sm"
                      onClick={() => {
                        const next: VariationStatus =
                          v.status === "RECEIVED" ? "PRICED" : v.status === "PRICED" ? "SUBMITTED" : "APPROVED";
                        const extra: Record<string, unknown> = {};
                        if (next === "PRICED") {
                          const priced = window.prompt("Priced amount $:");
                          if (priced === null) return;
                          extra.pricedAmount = Number(priced) || 0;
                        } else if (next === "APPROVED") {
                          const approved = window.prompt("Approved amount $:", v.pricedAmount ?? "");
                          if (approved === null) return;
                          extra.approvedAmount = Number(approved) || 0;
                        }
                        void advance(v.id, next, extra);
                      }}
                    >
                      {v.status === "RECEIVED" ? "Mark priced" : v.status === "PRICED" ? "Submit" : "Mark approved"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function AddVariationForm({ onCancel, onSave }: { onCancel: () => void; onSave: (desc: string) => void }) {
  const [desc, setDesc] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (desc.trim()) onSave(desc.trim()); }}
      style={{ display: "flex", gap: 6, marginBottom: 12 }}
    >
      <input className="s7-input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Variation description" style={{ flex: 1 }} autoFocus />
      <button type="button" className="s7-btn s7-btn--ghost" onClick={onCancel}>Cancel</button>
      <button type="submit" className="s7-btn s7-btn--primary" disabled={!desc.trim()}>Add</button>
    </form>
  );
}

function ClaimsTab({
  contract,
  canManage,
  canAdmin,
  onRefresh
}: {
  contract: Contract;
  canManage: boolean;
  canAdmin: boolean;
  onRefresh: () => Promise<void> | void;
}) {
  const { authFetch } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const selected = useMemo(
    () => contract.progressClaims.find((c) => c.id === selectedClaim),
    [contract.progressClaims, selectedClaim]
  );

  const createClaim = async () => {
    const month = window.prompt("Claim month (YYYY-MM):", new Date().toISOString().slice(0, 7));
    if (!month) return;
    try {
      const claimMonth = `${month}-01`;
      const response = await authFetch(`/contracts/${contract.id}/claims`, {
        method: "POST",
        body: JSON.stringify({ claimMonth })
      });
      if (!response.ok) throw new Error(await response.text());
      await onRefresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="s7-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Progress claims</h3>
        {canManage ? (
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={() => void createClaim()}>
            + New claim
          </button>
        ) : null}
      </div>
      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {contract.progressClaims.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No progress claims yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
            <tr>
              {["Claim #", "Month", "Status", "Claimed", "Approved", "Paid", "Submitted"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contract.progressClaims.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelectedClaim(c.id === selectedClaim ? null : c.id)}
                style={{ borderTop: "1px solid var(--border, #e5e7eb)", cursor: "pointer", background: selectedClaim === c.id ? "rgba(0,91,97,0.05)" : undefined }}
              >
                <td style={{ padding: "8px 10px", fontWeight: 500 }}>{c.claimNumber}</td>
                <td style={{ padding: "8px 10px" }}>
                  {new Date(c.claimMonth).toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{ padding: "1px 8px", borderRadius: 999, background: CLAIM_STATUS_COLOR[c.status], color: "#fff", fontSize: 11, fontWeight: 600 }}>
                    {c.status}
                  </span>
                </td>
                <td style={{ padding: "8px 10px" }}>{fmt(c.totalClaimed)}</td>
                <td style={{ padding: "8px 10px" }}>{fmt(c.totalApproved)}</td>
                <td style={{ padding: "8px 10px" }}>{fmt(c.totalPaid)}</td>
                <td style={{ padding: "8px 10px", color: "var(--text-muted)" }}>{fmtDate(c.submissionDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected ? (
        <ClaimEditor
          contractId={contract.id}
          retentionPct={Number(contract.retentionPct)}
          claimId={selected.id}
          claimStatus={selected.status}
          canManage={canManage}
          canAdmin={canAdmin}
          onRefresh={onRefresh}
        />
      ) : null}
    </section>
  );
}

type ClaimLineItem = {
  id: string;
  discipline: string | null;
  description: string;
  contractValue: string;
  previouslyClaimed: string;
  thisClaimPct: string | null;
  thisClaimAmount: string;
  variationId: string | null;
  sortOrder: number;
};

function ClaimEditor({
  contractId,
  retentionPct,
  claimId,
  claimStatus,
  canManage,
  canAdmin,
  onRefresh
}: {
  contractId: string;
  retentionPct: number;
  claimId: string;
  claimStatus: ClaimStatus;
  canManage: boolean;
  canAdmin: boolean;
  onRefresh: () => Promise<void> | void;
}) {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<ClaimLineItem[]>([]);
  const [totalClaimed, setTotalClaimed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await authFetch(`/contracts/${contractId}/claims/${claimId}`);
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as { lineItems: ClaimLineItem[]; totalClaimed: string };
      setItems(body.lineItems);
      setTotalClaimed(Number(body.totalClaimed ?? 0));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch, contractId, claimId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (itemId: string, body: Record<string, unknown>) => {
    try {
      const response = await authFetch(`/contracts/${contractId}/claims/${claimId}/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const transition = async (action: "submit" | "approve" | "pay") => {
    try {
      let body: Record<string, unknown> = {};
      if (action === "approve") {
        const amount = window.prompt("Approved amount $:", String(totalClaimed));
        if (amount === null) return;
        body = { totalApproved: Number(amount) || 0 };
      } else if (action === "pay") {
        const amount = window.prompt("Paid amount $:");
        if (amount === null) return;
        const date = window.prompt("Paid date (YYYY-MM-DD):", new Date().toISOString().slice(0, 10));
        if (date === null) return;
        body = { totalPaid: Number(amount) || 0, paidDate: date };
      }
      const response = await authFetch(`/contracts/${contractId}/claims/${claimId}/${action}`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await response.text());
      await onRefresh();
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const retentionAmount = totalClaimed * (retentionPct / 100);
  const net = totalClaimed - retentionAmount;

  return (
    <div style={{ marginTop: 16, borderTop: "2px solid #005B61", paddingTop: 12 }}>
      <h4 style={{ marginTop: 0 }}>Claim line items</h4>
      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
          <tr>
            {["Discipline / Description", "Contract value", "Previously claimed", "% this claim", "$ this claim"].map((h) => (
              <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((li) => {
            const editable = canManage && claimStatus === "DRAFT";
            return (
              <tr key={li.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                <td style={{ padding: "6px 8px" }}>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {li.variationId ? <span style={{ fontSize: 9, padding: "1px 4px", background: "#FEAA6D", color: "#000", borderRadius: 999 }}>VAR</span> : null}
                    <strong style={{ fontSize: 11 }}>{li.discipline ?? "—"}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{li.description}</div>
                </td>
                <td style={{ padding: "6px 8px" }}>{fmt(li.contractValue)}</td>
                <td style={{ padding: "6px 8px" }}>{fmt(li.previouslyClaimed)}</td>
                <td style={{ padding: "6px 8px" }}>
                  <input
                    className="s7-input"
                    type="number"
                    step="0.01"
                    defaultValue={li.thisClaimPct ?? ""}
                    disabled={!editable}
                    style={{ width: 70 }}
                    onBlur={(e) => {
                      const n = e.target.value === "" ? null : Number(e.target.value);
                      if (n !== null) void patch(li.id, { thisClaimPct: n });
                    }}
                  />
                </td>
                <td style={{ padding: "6px 8px", fontWeight: 500 }}>{fmt(li.thisClaimAmount)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ padding: 12, background: "var(--surface-muted, #F6F6F6)", borderRadius: 6, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total this claim</span><strong>{fmt(totalClaimed)}</strong></div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
            <span>Retention ({retentionPct.toFixed(2)}%)</span><span>{fmt(retentionAmount)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, paddingTop: 4, borderTop: "1px solid var(--border, #e5e7eb)", fontWeight: 600 }}>
            <span>Net this claim</span><span>{fmt(net)}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {claimStatus === "DRAFT" && canManage ? (
            <button type="button" className="s7-btn s7-btn--primary" onClick={() => window.confirm("Submit this claim?") && void transition("submit")}>Submit claim</button>
          ) : null}
          {claimStatus === "SUBMITTED" && canAdmin ? (
            <button type="button" className="s7-btn s7-btn--primary" onClick={() => void transition("approve")}>Approve claim</button>
          ) : null}
          {claimStatus === "APPROVED" && canAdmin ? (
            <button type="button" className="s7-btn s7-btn--primary" onClick={() => void transition("pay")}>Record payment</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
