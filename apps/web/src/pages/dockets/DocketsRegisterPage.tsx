import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { can } from "../../auth/permissions";
import { NoAccess } from "../../components/NoAccess";

type DocketRow = {
  id: string;
  docketNumber: string;
  type: "DELIVERY" | "HAULAGE" | "DISPOSAL";
  status: string;
  capturedAt: string;
  worker: { firstName: string; lastName: string };
  job: { jobNumber: string; name: string } | null;
  asset: { assetCode: string; name: string } | null;
  materialWasteType: string | null;
  quantity: string | null;
  unit: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  signedByName: string | null;
};

type ListResponse = { items: DocketRow[]; total: number; page: number; limit: number };

const TYPE_LABELS: Record<string, string> = {
  DELIVERY: "Delivery",
  HAULAGE: "Haulage",
  DISPOSAL: "Disposal"
};

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const toIso = today.toISOString().slice(0, 10);
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: toIso };
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function buildDocketExportUrl(params: Record<string, string>): string {
  const q = new URLSearchParams(params);
  return `/field/dockets/export.csv?${q.toString()}`;
}

export function DocketsRegisterPage() {
  const { user, authFetch } = useAuth();
  const canManage = useMemo(() => can(user, "field.manage"), [user]);
  const canView = useMemo(() => can(user, "field.view"), [user]);

  const initial = useMemo(defaultRange, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const buildQueryParams = useCallback((): Record<string, string> => {
    const p: Record<string, string> = {};
    if (from) p["from"] = from;
    if (to) p["to"] = to;
    if (typeFilter) p["type"] = typeFilter;
    if (statusFilter) p["status"] = statusFilter;
    return p;
  }, [from, to, typeFilter, statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ ...buildQueryParams(), limit: "200" });
      const res = await authFetch(`/field/dockets?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const body = (await res.json()) as ListResponse;
      setData(body);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, buildQueryParams]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) return <NoAccess required="field.view" />;

  const handleExport = async () => {
    if (!canManage) return;
    setExporting(true);
    setExportError(null);
    try {
      const url = buildDocketExportUrl(buildQueryParams());
      const res = await authFetch(url);
      if (!res.ok) throw new Error(await res.text());
      const csv = await res.text();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `dockets_${from ?? "all"}_to_${to ?? "all"}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setExportError((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "Syne, Outfit, sans-serif", margin: 0 }}>Dockets Register</h1>
        {canManage && (
          <button
            type="button"
            onClick={() => { void handleExport(); }}
            disabled={exporting}
            style={{
              background: "#005B61",
              color: "#fff",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.5rem 1rem",
              cursor: exporting ? "not-allowed" : "pointer",
              fontWeight: 600
            }}
          >
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ padding: "0.4rem 0.6rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ padding: "0.4rem 0.6rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ padding: "0.4rem 0.6rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem" }}
          >
            <option value="">All types</option>
            <option value="DELIVERY">Delivery</option>
            <option value="HAULAGE">Haulage</option>
            <option value="DISPOSAL">Disposal</option>
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "0.4rem 0.6rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem" }}
          >
            <option value="">All statuses</option>
            <option value="CAPTURED">Captured</option>
            <option value="VOIDED">Voided</option>
          </select>
        </div>
      </div>

      {exportError && (
        <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "0.75rem", borderRadius: "0.375rem", marginBottom: "1rem" }}>
          Export failed: {exportError}
        </div>
      )}

      {error && (
        <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "0.75rem", borderRadius: "0.375rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {loading && <Skeleton />}

      {!loading && data && data.items.length === 0 && (
        <EmptyState heading="No dockets" subtext="No dockets match the current filters." />
      )}

      {!loading && data && data.items.length > 0 && (
        <>
          <p style={{ color: "#6B7280", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
            {data.total} docket{data.total !== 1 ? "s" : ""}
            {data.total > data.items.length && ` (showing ${data.items.length})`}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E5E7EB", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>Docket #</th>
                  <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>Type</th>
                  <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>Status</th>
                  <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>Captured</th>
                  <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>Driver</th>
                  <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>Job</th>
                  <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>Asset</th>
                  <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>Material</th>
                  <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>Qty</th>
                  <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>From</th>
                  <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>To</th>
                  <th style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>Signed by</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row, idx) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: "1px solid #E5E7EB",
                      background: idx % 2 === 0 ? "#fff" : "#F9FAFB"
                    }}
                  >
                    <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {row.docketNumber}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      <span
                        style={{
                          background: "#E0F2F1",
                          color: "#005B61",
                          padding: "0.1rem 0.4rem",
                          borderRadius: "0.25rem",
                          fontSize: "0.75rem",
                          fontWeight: 600
                        }}
                      >
                        {TYPE_LABELS[row.type] ?? row.type}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      <span
                        style={{
                          background: row.status === "CAPTURED" ? "#DCFCE7" : "#FEE2E2",
                          color: row.status === "CAPTURED" ? "#166534" : "#991B1B",
                          padding: "0.1rem 0.4rem",
                          borderRadius: "0.25rem",
                          fontSize: "0.75rem",
                          fontWeight: 600
                        }}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem", whiteSpace: "nowrap" }}>
                      {formatDateTime(row.capturedAt)}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      {row.worker.firstName} {row.worker.lastName}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      {row.job ? `${row.job.jobNumber}` : "—"}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      {row.asset ? row.asset.assetCode : "—"}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>{row.materialWasteType ?? "—"}</td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      {row.quantity ? `${row.quantity} ${row.unit ?? ""}`.trim() : "—"}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>{row.fromLocation ?? "—"}</td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>{row.toLocation ?? "—"}</td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>{row.signedByName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
