import { useEffect, useState, type CSSProperties } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

// Three-way match screen (PR-629 slice 3).
// Shows ordered / received / billed columns per invoice line with variance
// highlighting. Approve-variance and reconcile-PO actions are available to
// users with procurement.approve permission.

type MatchStatus = "PENDING" | "MATCHED" | "HELD" | "APPROVED" | "REJECTED";

type InvoiceLine = {
  id: string;
  description: string;
  orderedQty: string | null;
  receivedQty: string | null;
  billedQty: string;
  orderedUnitPrice: string | null;
  billedUnitPrice: string;
  billedLineTotal: string;
  qtyVariance: string | null;
  priceVariance: string | null;
  withinTolerance: boolean;
};

type VendorInvoice = {
  id: string;
  invoiceNumber: string;
  supplierInvoiceDate: string;
  invoicedTotal: string;
  matchStatus: MatchStatus;
  approvedAt: string | null;
  notes: string | null;
  lines: InvoiceLine[];
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  issuedAt: string;
};

type ListResponse = {
  items: VendorInvoice[];
  total: number;
  page: number;
  pageSize: number;
};

type ReconcileAudit = {
  id: string;
  reconciledAt: string;
  poTotal: string;
  invoicedTotal: string;
  netVariance: string;
  notes: string | null;
};

const TAP: CSSProperties = { minHeight: 44, minWidth: 44 };

const STATUS_COLOUR: Record<MatchStatus, string> = {
  PENDING: "var(--status-neutral, #666)",
  MATCHED: "var(--status-success, #1a7340)",
  HELD: "var(--status-warning, #b45309)",
  APPROVED: "var(--status-success, #1a7340)",
  REJECTED: "var(--status-danger, #b00020)"
};

function VarianceCell({
  variance,
  within
}: {
  variance: string | null;
  within: boolean;
}) {
  if (variance === null) return <td>—</td>;
  const v = Number(variance);
  const colour =
    within
      ? "inherit"
      : v > 0
        ? "var(--status-danger, #b00020)"
        : "var(--status-warning, #b45309)";
  return (
    <td style={{ color: colour, fontWeight: within ? "normal" : 600 }}>
      {v > 0 ? "+" : ""}
      {variance}
    </td>
  );
}

function MatchLines({ lines }: { lines: InvoiceLine[] }) {
  if (lines.length === 0) return <p>No lines.</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--surface-3, #ddd)" }}>
            <th style={{ textAlign: "left", padding: "4px 8px" }}>Description</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>Ordered qty</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>Received qty</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>Billed qty</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>Qty var</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>PO price</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>Billed price</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>Price var</th>
            <th style={{ textAlign: "right", padding: "4px 8px" }}>Line total</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr
              key={line.id}
              style={{
                borderBottom: "1px solid var(--surface-3, #eee)",
                background: line.withinTolerance
                  ? undefined
                  : "var(--status-warning-bg, #fff8e1)"
              }}
            >
              <td style={{ padding: "4px 8px" }}>{line.description}</td>
              <td style={{ textAlign: "right", padding: "4px 8px" }}>
                {line.orderedQty ?? "—"}
              </td>
              <td style={{ textAlign: "right", padding: "4px 8px" }}>
                {line.receivedQty ?? "—"}
              </td>
              <td style={{ textAlign: "right", padding: "4px 8px" }}>{line.billedQty}</td>
              <VarianceCell variance={line.qtyVariance} within={line.withinTolerance} />
              <td style={{ textAlign: "right", padding: "4px 8px" }}>
                {line.orderedUnitPrice !== null ? `$${line.orderedUnitPrice}` : "—"}
              </td>
              <td style={{ textAlign: "right", padding: "4px 8px" }}>
                ${line.billedUnitPrice}
              </td>
              <VarianceCell variance={line.priceVariance} within={line.withinTolerance} />
              <td style={{ textAlign: "right", padding: "4px 8px" }}>
                ${line.billedLineTotal}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Props = {
  /** PurchaseOrder to show invoices for. Passed from a parent PO detail view. */
  purchaseOrder: PurchaseOrder;
  /** Whether the acting user holds procurement.approve (controls action buttons). */
  canApprove: boolean;
};

export function ThreeWayMatchPage({ purchaseOrder, canApprove }: Props) {
  const { authFetch } = useAuth();
  const [invoices, setInvoices] = useState<VendorInvoice[]>([]);
  const [selected, setSelected] = useState<VendorInvoice | null>(null);
  const [reconcile, setReconcile] = useState<ReconcileAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);

  const base = `/procurement/purchase-orders/${purchaseOrder.id}`;

  async function loadInvoices() {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`${base}/invoices?page=1&pageSize=50`);
      if (!res.ok) throw new Error("Could not load invoices.");
      const data = (await res.json()) as ListResponse;
      setInvoices(data.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadReconcile() {
    try {
      const res = await authFetch(`${base}/reconcile`);
      if (res.ok) setReconcile((await res.json()) as ReconcileAudit);
    } catch {
      // No reconcile yet — that is fine.
    }
  }

  useEffect(() => {
    void loadInvoices();
    void loadReconcile();
  }, [purchaseOrder.id]);

  async function openInvoice(inv: VendorInvoice) {
    try {
      const res = await authFetch(`${base}/invoices/${inv.id}`);
      if (res.ok) setSelected((await res.json()) as VendorInvoice);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function approveVariance(id: string) {
    setActionError(null);
    try {
      const res = await authFetch(`${base}/invoices/${id}/approve-variance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || "Approve variance failed.");
      }
      const updated = (await res.json()) as VendorInvoice;
      setSelected(updated);
      void loadInvoices();
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function reconcilePo() {
    setReconcileLoading(true);
    setActionError(null);
    try {
      const res = await authFetch(`${base}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || "Reconcile failed.");
      }
      const audit = (await res.json()) as ReconcileAudit;
      setReconcile(audit);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setReconcileLoading(false);
    }
  }

  const allResolved =
    invoices.length > 0 &&
    invoices.every(
      (inv) => inv.matchStatus === "MATCHED" || inv.matchStatus === "APPROVED"
    );

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Three-way match — {purchaseOrder.poNumber}</h2>
        <Skeleton />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Three-way match — {purchaseOrder.poNumber}</h2>
      <p style={{ color: "var(--text-2, #666)", marginBottom: 16 }}>
        Issued {new Date(purchaseOrder.issuedAt).toLocaleDateString()}
      </p>

      {error && (
        <p role="alert" style={{ color: "var(--status-danger, #b00020)" }}>
          {error}
        </p>
      )}
      {actionError && (
        <p role="alert" style={{ color: "var(--status-danger, #b00020)" }}>
          {actionError}
        </p>
      )}

      {reconcile && (
        <section
          style={{
            background: "var(--surface-2, #f0fdf4)",
            border: "1px solid var(--status-success, #1a7340)",
            borderRadius: 6,
            padding: 12,
            marginBottom: 16
          }}
          aria-label="Reconcile audit"
        >
          <strong>PO reconciled</strong>{" "}
          {new Date(reconcile.reconciledAt).toLocaleDateString()} — PO total: $
          {reconcile.poTotal} | Invoiced: ${reconcile.invoicedTotal} | Net variance: $
          {reconcile.netVariance}
          {reconcile.notes && <p style={{ marginTop: 4 }}>{reconcile.notes}</p>}
        </section>
      )}

      {invoices.length === 0 ? (
        <EmptyState
          heading="No invoices posted"
          subtext="Use the procurement API to post a vendor invoice against this PO and run the three-way match."
        />
      ) : (
        <table style={{ width: "100%", marginBottom: 16 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Invoice #</th>
              <th style={{ textAlign: "left" }}>Status</th>
              <th style={{ textAlign: "right" }}>Invoiced total</th>
              <th style={{ textAlign: "left" }}>Lines</th>
              <th style={{ textAlign: "left" }}>Approved at</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr
                key={inv.id}
                onClick={() => void openInvoice(inv)}
                style={{ cursor: "pointer" }}
              >
                <td>{inv.invoiceNumber}</td>
                <td style={{ color: STATUS_COLOUR[inv.matchStatus] }}>
                  {inv.matchStatus}
                </td>
                <td style={{ textAlign: "right" }}>${inv.invoicedTotal}</td>
                <td>{inv.lines.length}</td>
                <td>
                  {inv.approvedAt
                    ? new Date(inv.approvedAt).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canApprove && !reconcile && allResolved && (
        <button
          type="button"
          onClick={() => void reconcilePo()}
          disabled={reconcileLoading}
          style={{ ...TAP, background: "var(--orange, #FEAA6D)", border: "none", borderRadius: 4, padding: "0 16px", cursor: "pointer" }}
        >
          {reconcileLoading ? "Reconciling…" : "Close-reconcile PO"}
        </button>
      )}

      {selected && (
        <aside
          style={{
            position: "fixed",
            right: 0,
            top: 0,
            bottom: 0,
            width: 680,
            background: "var(--surface-1, #fff)",
            borderLeft: "1px solid var(--surface-3, #ddd)",
            padding: 20,
            overflowY: "auto"
          }}
          role="dialog"
          aria-label={`Invoice ${selected.invoiceNumber} detail`}
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={{ ...TAP, marginBottom: 12 }}
          >
            Close
          </button>
          <h3>
            {selected.invoiceNumber}
            <span
              style={{
                marginLeft: 12,
                fontSize: 13,
                color: STATUS_COLOUR[selected.matchStatus]
              }}
            >
              {selected.matchStatus}
            </span>
          </h3>
          <p>
            <strong>Total:</strong> ${selected.invoicedTotal}
          </p>
          {selected.notes && (
            <p>
              <strong>Notes:</strong> {selected.notes}
            </p>
          )}

          <h4 style={{ marginTop: 16 }}>Line-by-line match</h4>
          <MatchLines lines={selected.lines} />

          {canApprove && selected.matchStatus === "HELD" && (
            <div style={{ marginTop: 16 }}>
              <p style={{ color: "var(--status-warning, #b45309)" }}>
                One or more lines exceed the variance tolerance.
              </p>
              <button
                type="button"
                onClick={() => void approveVariance(selected.id)}
                style={{
                  ...TAP,
                  background: "var(--orange, #FEAA6D)",
                  border: "none",
                  borderRadius: 4,
                  padding: "0 16px",
                  cursor: "pointer"
                }}
              >
                Approve variance
              </button>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
