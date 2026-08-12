import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { can } from "../../auth/permissions";
import { useConfirm } from "../../hooks/useConfirm";
import { NewContractModal } from "./NewContractModal";

type ContractRow = {
  id: string;
  contractNumber: string;
  contractValue: string;
  retentionPct: string;
  status: "ACTIVE" | "PRACTICAL_COMPLETION" | "DEFECTS" | "CLOSED";
  createdAt: string;
  archivedAt: string | null;
  project: { id: string; projectNumber: string; name: string; client: { id: string; name: string } | null };
};

/** Minimal shape returned by GET /contracts/:id — used for delete warning counts. */
type ContractDetail = {
  variations: unknown[];
  progressClaims: unknown[];
  billingMilestones?: unknown[];
};

const STATUS_LABEL: Record<ContractRow["status"], string> = {
  ACTIVE: "Active",
  PRACTICAL_COMPLETION: "Practical completion",
  DEFECTS: "Defects liability",
  CLOSED: "Closed"
};
const STATUS_COLOR: Record<ContractRow["status"], string> = {
  ACTIVE: "#005B61",
  PRACTICAL_COMPLETION: "#3B82F6",
  DEFECTS: "#F59E0B",
  CLOSED: "#9CA3AF"
};

/** Which set of contracts to display in the list. Separate from the contract status. */
type ArchiveView = "active" | "archived" | "all";

function fmtCurrency(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

export function ContractsListPage() {
  const { authFetch, user } = useAuth();
  const confirm = useConfirm();
  const canManage = useMemo(() => can(user, "finance.manage"), [user]);
  const isSuperUser = user?.isSuperUser === true;

  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<ContractRow["status"] | "ALL">("ALL");
  const [archiveView, setArchiveView] = useState<ArchiveView>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (archiveView === "all") params.set("includeArchived", "true");
      else if (archiveView === "archived") params.set("includeArchived", "true");
      const url = `/contracts${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await authFetch(url);
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as { items: ContractRow[] };
      // When showing archived-only, filter client-side (the API includes both when includeArchived=true)
      const items = archiveView === "archived"
        ? body.items.filter((c) => c.archivedAt !== null)
        : archiveView === "active"
          ? body.items.filter((c) => c.archivedAt === null)
          : body.items;
      setContracts(items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, statusFilter, archiveView]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleArchive = async (row: ContractRow) => {
    const willArchive = row.archivedAt === null;
    const ok = await confirm({
      title: willArchive ? "Archive this contract?" : "Unarchive this contract?",
      message: willArchive
        ? `Archive contract ${row.contractNumber}? It will be hidden from the default list but can be found via the Archived filter and unarchived at any time.`
        : `Restore contract ${row.contractNumber} to the active list?`,
      confirmLabel: willArchive ? "Archive" : "Unarchive",
      variant: willArchive ? "danger" : undefined
    });
    if (!ok) return;
    setArchivingId(row.id);
    try {
      const endpoint = willArchive ? `/contracts/${row.id}/archive` : `/contracts/${row.id}/unarchive`;
      const response = await authFetch(endpoint, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (row: ContractRow) => {
    // Fetch linked-record counts from the detail endpoint to surface in the warning
    let detail: ContractDetail | null = null;
    try {
      const r = await authFetch(`/contracts/${row.id}`);
      if (r.ok) {
        detail = (await r.json()) as ContractDetail;
      }
    } catch {
      // Non-fatal — proceed with generic warning
    }

    const varCount = detail?.variations.length ?? 0;
    const claimCount = detail?.progressClaims.length ?? 0;

    const linkedSummary =
      varCount > 0 || claimCount > 0
        ? `This contract has ${varCount} variation${varCount === 1 ? "" : "s"} and ${claimCount} progress claim${claimCount === 1 ? "" : "s"} that will also be permanently deleted.`
        : "All child records (variations, progress claims, billing milestones) will also be permanently deleted.";

    const ok = await confirm({
      title: `Permanently delete ${row.contractNumber}?`,
      message: `${linkedSummary}\n\nThis action is irreversible and cannot be undone.`,
      confirmLabel: "Delete permanently",
      variant: "danger"
    });
    if (!ok) return;
    setDeletingId(row.id);
    try {
      const response = await authFetch(`/contracts/${row.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await response.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 className="s7-type-page-heading" style={{ marginTop: 0 }}>Contracts</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
            One contract per project. Tracks variations, progress claims, retention, and payment status.
          </p>
        </div>
        {canManage ? (
          <button type="button" className="s7-btn s7-btn--primary" onClick={() => setNewOpen(true)}>
            + New contract
          </button>
        ) : null}
      </header>

      {newOpen ? <NewContractModal onClose={() => setNewOpen(false)} /> : null}

      {/* Archive view filter */}
      <div data-testid="contract-archive-filter" style={{ display: "flex", gap: 4, marginBottom: 8 }}>
        {(["active", "archived", "all"] as ArchiveView[]).map((view) => {
          const active = view === archiveView;
          const label = view === "active" ? "Active" : view === "archived" ? "Archived" : "All";
          return (
            <button
              key={view}
              type="button"
              onClick={() => setArchiveView(view)}
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                border: active ? "2px solid #005B61" : "1px solid var(--border, #e5e7eb)",
                background: active ? "rgba(0,91,97,0.08)" : "transparent",
                fontSize: 12,
                cursor: "pointer"
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Contract status filter */}
      <div data-testid="contract-status-filter" style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {(["ALL", "ACTIVE", "PRACTICAL_COMPLETION", "DEFECTS", "CLOSED"] as const).map((s) => {
          const active = s === statusFilter;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                border: active ? "2px solid #005B61" : "1px solid var(--border, #e5e7eb)",
                background: active ? "rgba(0,91,97,0.08)" : "transparent",
                fontSize: 12,
                cursor: "pointer"
              }}
            >
              {s === "ALL" ? "All" : STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : contracts.length === 0 ? (
        <div className="s7-card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
          No contracts yet.
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
            <tr>
              {["Contract #", "Project", "Client", "Status", "Contract value", "Retention", "Created", ""].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => (
              <tr
                key={c.id}
                style={{
                  borderTop: "1px solid var(--border, #e5e7eb)",
                  opacity: c.archivedAt !== null ? 0.6 : 1
                }}
              >
                <td style={{ padding: "8px 10px", fontWeight: 500 }}>
                  <Link to={`/contracts/${c.id}`} style={{ color: "#005B61" }}>{c.contractNumber}</Link>
                  {c.archivedAt !== null ? (
                    <span style={{
                      marginLeft: 6,
                      padding: "1px 6px",
                      borderRadius: 999,
                      background: "#9CA3AF",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 600
                    }}>
                      ARCHIVED
                    </span>
                  ) : null}
                </td>
                <td style={{ padding: "8px 10px" }}>
                  <Link to={`/projects/${c.project.id}`}>{c.project.projectNumber}</Link>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.project.name}</div>
                </td>
                <td style={{ padding: "8px 10px" }}>{c.project.client?.name ?? "—"}</td>
                <td style={{ padding: "8px 10px" }}>
                  <span style={{
                    padding: "1px 8px",
                    borderRadius: 999,
                    background: STATUS_COLOR[c.status],
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600
                  }}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </td>
                <td style={{ padding: "8px 10px" }}>{fmtCurrency(c.contractValue)}</td>
                <td style={{ padding: "8px 10px" }}>{Number(c.retentionPct).toFixed(1)}%</td>
                <td style={{ padding: "8px 10px", color: "var(--text-muted)" }}>
                  {new Date(c.createdAt).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td style={{ padding: "8px 4px", textAlign: "right", whiteSpace: "nowrap" }}>
                  {canManage ? (
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost s7-btn--sm"
                      disabled={archivingId === c.id}
                      onClick={() => void handleArchive(c)}
                      style={{ marginRight: 4 }}
                    >
                      {archivingId === c.id ? "…" : c.archivedAt !== null ? "Unarchive" : "Archive"}
                    </button>
                  ) : null}
                  {isSuperUser ? (
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost s7-btn--sm"
                      disabled={deletingId === c.id}
                      onClick={() => void handleDelete(c)}
                      style={{ color: "var(--status-danger)" }}
                    >
                      {deletingId === c.id ? "…" : "Delete"}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
