import { useCallback, useEffect, useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { useConfirm } from "../../hooks/useConfirm";
import { throwIfApiError } from "../../lib/api-errors";

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

type ClaimDraft = {
  id: string;
  claimNumber: string;
  claimMonth: string;
  status: string;
  totalClaimed: string;
  notes: string | null;
  isProForma: boolean;
  lineItems: ClaimLineItem[];
};

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2
  }).format(n);
}

export function ClaimDraftEditor({
  contractId,
  claim: initialClaim,
  onClose
}: {
  contractId: string;
  claim: ClaimDraft;
  onClose: () => void;
}) {
  const { authFetch } = useAuth();
  const confirm = useConfirm();
  const [claim, setClaim] = useState<ClaimDraft>(initialClaim);
  const [notes, setNotes] = useState(initialClaim.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    const response = await authFetch(`/contracts/${contractId}/claims/${claim.id}`);
    await throwIfApiError(response);
    const next = (await response.json()) as ClaimDraft;
    setClaim(next);
    return next;
  }, [authFetch, contractId, claim.id]);

  const updateItem = async (item: ClaimLineItem, patch: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const response = await authFetch(
        `/contracts/${contractId}/claims/${claim.id}/items/${item.id}`,
        { method: "PATCH", body: JSON.stringify(patch) }
      );
      await throwIfApiError(response);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (item: ClaimLineItem) => {
    const ok = await confirm({
      title: "Remove line",
      message: `Remove "${item.description}" from this draft?`,
      variant: "danger"
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const response = await authFetch(
        `/contracts/${contractId}/claims/${claim.id}/items/${item.id}`,
        { method: "DELETE" }
      );
      await throwIfApiError(response);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addLine = async (dto: {
    description: string;
    discipline: string;
    contractValue: number;
    thisClaimAmount: number;
  }) => {
    setBusy(true);
    setError(null);
    try {
      const response = await authFetch(`/contracts/${contractId}/claims/${claim.id}/items`, {
        method: "POST",
        body: JSON.stringify(dto)
      });
      await throwIfApiError(response);
      setAdding(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveNotes = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await authFetch(`/contracts/${contractId}/claims/${claim.id}`, {
        method: "PATCH",
        body: JSON.stringify({ notes: notes.trim() ? notes : null })
      });
      await throwIfApiError(response);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CenteredModal
      title={`Edit draft claim — ${claim.claimNumber}`}
      subtitle={new Date(claim.claimMonth).toLocaleDateString("en-AU", {
        month: "long",
        year: "numeric"
      })}
      onClose={onClose}
      busy={busy}
      maxWidth={880}
      footer={
        <button type="button" className="s7-btn s7-btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div
        style={{
          padding: "8px 12px",
          border: "1px solid var(--status-warning, #FEAA6D)",
          background: "rgba(254, 170, 109, 0.12)",
          borderRadius: 6,
          marginBottom: 12,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--status-warning, #B45309)"
        }}
      >
        DRAFT — not yet issued. Submit this claim from the claims list when ready.
      </div>

      {error ? (
        <p style={{ color: "var(--status-danger)", marginTop: 0 }}>{error}</p>
      ) : null}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
          <tr>
            {["Discipline", "Description", "Contract $", "Prev claimed", "% this", "$ this", ""].map(
              (h) => (
                <th
                  key={h}
                  style={{
                    padding: "8px 10px",
                    textAlign: "left",
                    fontSize: 11,
                    textTransform: "uppercase",
                    color: "var(--text-muted)"
                  }}
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {claim.lineItems.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ padding: "16px 10px", color: "var(--text-muted)" }}>
                No lines yet. Add one below.
              </td>
            </tr>
          ) : (
            claim.lineItems.map((li) => (
              <EditableRow
                key={li.id}
                item={li}
                busy={busy}
                onPatch={(patch) => void updateItem(li, patch)}
                onRemove={() => void removeItem(li)}
              />
            ))
          )}
          <tr style={{ borderTop: "2px solid var(--border, #e5e7eb)", fontWeight: 600 }}>
            <td colSpan={5} style={{ padding: "8px 10px", textAlign: "right" }}>
              Total this claim
            </td>
            <td style={{ padding: "8px 10px" }}>{fmtCurrency(Number(claim.totalClaimed))}</td>
            <td />
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: 12 }}>
        {adding ? (
          <AddLineForm busy={busy} onCancel={() => setAdding(false)} onSave={addLine} />
        ) : (
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={() => setAdding(true)}
            disabled={busy}
          >
            + Add line
          </button>
        )}
      </div>

      <label
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          marginTop: 16
        }}
      >
        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>
          Notes
        </span>
        <textarea
          className="s7-input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if ((claim.notes ?? "") !== notes) void saveNotes();
          }}
          placeholder="Optional context for this claim (saved on blur)."
        />
      </label>
    </CenteredModal>
  );
}

function EditableRow({
  item,
  busy,
  onPatch,
  onRemove
}: {
  item: ClaimLineItem;
  busy: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const [pct, setPct] = useState(item.thisClaimPct ?? "");
  const [amount, setAmount] = useState(item.thisClaimAmount);

  useEffect(() => {
    setPct(item.thisClaimPct ?? "");
    setAmount(item.thisClaimAmount);
  }, [item.thisClaimPct, item.thisClaimAmount]);

  const commitPct = () => {
    const next = pct === "" ? null : Number(pct);
    if (next === null) return;
    if (String(next) === (item.thisClaimPct ?? "")) return;
    onPatch({ thisClaimPct: next });
  };

  const commitAmount = () => {
    const next = Number(amount);
    if (!Number.isFinite(next)) return;
    if (next === Number(item.thisClaimAmount)) return;
    onPatch({ thisClaimAmount: next });
  };

  return (
    <tr style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
      <td style={{ padding: "8px 10px" }}>{item.discipline ?? "—"}</td>
      <td style={{ padding: "8px 10px" }}>{item.description}</td>
      <td style={{ padding: "8px 10px" }}>{fmtCurrency(Number(item.contractValue))}</td>
      <td style={{ padding: "8px 10px" }}>{fmtCurrency(Number(item.previouslyClaimed))}</td>
      <td style={{ padding: "8px 10px" }}>
        <input
          className="s7-input"
          style={{ width: 72 }}
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          onBlur={commitPct}
          disabled={busy}
        />
      </td>
      <td style={{ padding: "8px 10px" }}>
        <input
          className="s7-input"
          style={{ width: 110 }}
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={commitAmount}
          disabled={busy}
        />
      </td>
      <td style={{ padding: "8px 10px", textAlign: "right" }}>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={onRemove}
          disabled={busy}
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

function AddLineForm({
  busy,
  onCancel,
  onSave
}: {
  busy: boolean;
  onCancel: () => void;
  onSave: (dto: {
    description: string;
    discipline: string;
    contractValue: number;
    thisClaimAmount: number;
  }) => void;
}) {
  const [description, setDescription] = useState("");
  const [discipline, setDiscipline] = useState("Other");
  const [contractValue, setContractValue] = useState("0");
  const [thisClaimAmount, setThisClaimAmount] = useState("0");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    onSave({
      description: description.trim(),
      discipline,
      contractValue: Number(contractValue) || 0,
      thisClaimAmount: Number(thisClaimAmount) || 0
    });
  };

  return (
    <form
      onSubmit={submit}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 120px 140px 140px auto",
        gap: 8,
        alignItems: "end",
        padding: 12,
        background: "var(--surface-muted, #F6F6F6)",
        borderRadius: 6
      }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>
          Description
        </span>
        <input
          className="s7-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          autoFocus
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>
          Discipline
        </span>
        <select
          className="s7-input"
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value)}
        >
          <option value="DEM">DEM</option>
          <option value="CIV">CIV</option>
          <option value="ASB">ASB</option>
          <option value="Other">Other</option>
          <option value="Variation">Variation</option>
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>
          Contract $
        </span>
        <input
          className="s7-input"
          type="number"
          min="0"
          step="0.01"
          value={contractValue}
          onChange={(e) => setContractValue(e.target.value)}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>
          $ this claim
        </span>
        <input
          className="s7-input"
          type="number"
          min="0"
          step="0.01"
          value={thisClaimAmount}
          onChange={(e) => setThisClaimAmount(e.target.value)}
        />
      </label>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="s7-btn s7-btn--primary s7-btn--sm"
          disabled={busy || !description.trim()}
        >
          Add
        </button>
      </div>
    </form>
  );
}
