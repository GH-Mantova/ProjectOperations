import { useEffect, useState, type CSSProperties } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

// Expense management — D365-parity slice 1 (capture + approval).
// Field/PWA capture (slice 2), receipt OCR (slice 3), and Xero push are
// separate future slices — do NOT add them here.

type ExpenseUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

type Expense = {
  id: string;
  number: string;
  category: string;
  description: string;
  spentOn: string;
  amount: string;
  gst: string | null;
  paymentMethod: string | null;
  receiptDocumentId: string | null;
  status: string;
  submittedById: string;
  submittedBy?: ExpenseUser;
  approvedBy?: ExpenseUser | null;
  approvedAt?: string | null;
  rejectionReason: string | null;
  notes: string | null;
  projectId: string | null;
  jobId: string | null;
  createdAt: string;
};

type ListResponse = {
  items: Expense[];
  total: number;
  page: number;
  pageSize: number;
};

const STATUS_ORDER = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "REIMBURSED"] as const;
const PAYMENT_METHODS = ["CARD", "CASH", "PERSONAL_REIMBURSABLE"] as const;
const TAP_TARGET: CSSProperties = { minHeight: 44 };

const STATUS_COLOURS: Record<string, CSSProperties> = {
  DRAFT: { color: "var(--text-muted, #6b7280)" },
  SUBMITTED: { color: "var(--status-warning, #b45309)" },
  APPROVED: { color: "var(--status-success, #047857)" },
  REJECTED: { color: "var(--status-danger, #b00020)" },
  REIMBURSED: { color: "var(--text-muted, #6b7280)" }
};

function formatAmount(amount: string): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    parseFloat(amount)
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU");
}

type CreateFormState = {
  category: string;
  description: string;
  spentOn: string;
  amount: string;
  gst: string;
  paymentMethod: string;
  notes: string;
  projectId: string;
  jobId: string;
  receiptDocumentId: string;
};

const EMPTY_FORM: CreateFormState = {
  category: "",
  description: "",
  spentOn: new Date().toISOString().slice(0, 10),
  amount: "",
  gst: "",
  paymentMethod: "",
  notes: "",
  projectId: "",
  jobId: "",
  receiptDocumentId: ""
};

const EXPENSE_CATEGORIES = [
  "Fuel",
  "Materials",
  "Tools/Equipment",
  "Travel",
  "Meals",
  "PPE",
  "Subcontractor",
  "Other"
];

export function ExpensesPage() {
  const { authFetch, user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selected, setSelected] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const canManage = user?.permissions.includes("expenses.manage") ?? false;
  const canApprove = user?.permissions.includes("expenses.approve") ?? false;

  async function loadExpenses(status?: string) {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: "1", pageSize: "50" });
      if (status) qs.set("status", status);
      const res = await authFetch(`/expenses?${qs.toString()}`);
      if (!res.ok) throw new Error(`Could not load expenses (${res.status.toString()}).`);
      const data = (await res.json()) as ListResponse;
      setExpenses(data.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExpenses(statusFilter || undefined);
  }, [statusFilter]);

  async function openDetail(expense: Expense) {
    try {
      const res = await authFetch(`/expenses/${expense.id}`);
      if (!res.ok) {
        setError(`Could not load expense detail (${res.status.toString()}).`);
        return;
      }
      setSelected((await res.json()) as Expense);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleCreate(evt: React.FormEvent) {
    evt.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        category: form.category,
        description: form.description,
        spentOn: form.spentOn,
        amount: parseFloat(form.amount)
      };
      if (form.gst) body.gst = parseFloat(form.gst);
      if (form.paymentMethod) body.paymentMethod = form.paymentMethod;
      if (form.notes) body.notes = form.notes;
      if (form.projectId) body.projectId = form.projectId;
      if (form.jobId) body.jobId = form.jobId;
      if (form.receiptDocumentId) body.receiptDocumentId = form.receiptDocumentId;

      const res = await authFetch("/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Create failed (${res.status.toString()}).`);
      }
      setShowCreate(false);
      setForm(EMPTY_FORM);
      void loadExpenses(statusFilter || undefined);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function transition(id: string, path: string, body?: unknown) {
    setError(null);
    try {
      const res = await authFetch(`/expenses/${id}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {})
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Action failed (${res.status.toString()}).`);
      }
      const updated = (await res.json()) as Expense;
      setSelected(updated);
      void loadExpenses(statusFilter || undefined);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function field(key: keyof CreateFormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading && !showCreate) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Expenses</h1>
        <Skeleton />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16
        }}
      >
        <h1 style={{ margin: 0 }}>Expenses</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={statusFilter}
            onChange={(evt) => setStatusFilter(evt.target.value)}
            style={{ ...TAP_TARGET, padding: "0 12px" }}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          {canManage && (
            <button
              onClick={() => {
                setShowCreate(true);
                setSelected(null);
              }}
              style={{
                ...TAP_TARGET,
                padding: "0 16px",
                background: "var(--color-orange, #FEAA6D)",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: 600
              }}
            >
              + New expense
            </button>
          )}
        </div>
      </header>

      {error && (
        <p role="alert" style={{ color: "var(--status-danger, #b00020)", marginBottom: 12 }}>
          {error}
        </p>
      )}

      {/* Create form */}
      {showCreate && (
        <section
          style={{
            background: "var(--bg-card, #fff)",
            border: "1px solid var(--border-default, #e5e7eb)",
            borderRadius: 8,
            padding: 20,
            marginBottom: 24
          }}
        >
          <h2 style={{ marginTop: 0 }}>New expense claim</h2>
          <form onSubmit={(evt) => void handleCreate(evt)}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                Category *
                <select
                  required
                  value={form.category}
                  onChange={(evt) => field("category", evt.target.value)}
                  style={{ display: "block", width: "100%", ...TAP_TARGET, marginTop: 4 }}
                >
                  <option value="">Select category</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date spent *
                <input
                  type="date"
                  required
                  value={form.spentOn}
                  onChange={(evt) => field("spentOn", evt.target.value)}
                  style={{ display: "block", width: "100%", ...TAP_TARGET, marginTop: 4 }}
                />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Description *
                <input
                  type="text"
                  required
                  maxLength={1000}
                  placeholder="What was purchased and why"
                  value={form.description}
                  onChange={(evt) => field("description", evt.target.value)}
                  style={{ display: "block", width: "100%", ...TAP_TARGET, marginTop: 4 }}
                />
              </label>
              <label>
                Amount (ex GST) *
                <input
                  type="number"
                  required
                  min={0.01}
                  step={0.01}
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(evt) => field("amount", evt.target.value)}
                  style={{ display: "block", width: "100%", ...TAP_TARGET, marginTop: 4 }}
                />
              </label>
              <label>
                GST
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={form.gst}
                  onChange={(evt) => field("gst", evt.target.value)}
                  style={{ display: "block", width: "100%", ...TAP_TARGET, marginTop: 4 }}
                />
              </label>
              <label>
                Payment method
                <select
                  value={form.paymentMethod}
                  onChange={(evt) => field("paymentMethod", evt.target.value)}
                  style={{ display: "block", width: "100%", ...TAP_TARGET, marginTop: 4 }}
                >
                  <option value="">Select…</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Project ID (optional)
                <input
                  type="text"
                  placeholder="Project ID for cost allocation"
                  value={form.projectId}
                  onChange={(evt) => field("projectId", evt.target.value)}
                  style={{ display: "block", width: "100%", ...TAP_TARGET, marginTop: 4 }}
                />
              </label>
              <label>
                Job ID (optional)
                <input
                  type="text"
                  placeholder="Job ID for cost allocation"
                  value={form.jobId}
                  onChange={(evt) => field("jobId", evt.target.value)}
                  style={{ display: "block", width: "100%", ...TAP_TARGET, marginTop: 4 }}
                />
              </label>
              <label>
                Receipt document ID (optional)
                <input
                  type="text"
                  placeholder="DocumentLink ID (link via Documents module)"
                  value={form.receiptDocumentId}
                  onChange={(evt) => field("receiptDocumentId", evt.target.value)}
                  style={{ display: "block", width: "100%", ...TAP_TARGET, marginTop: 4 }}
                />
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Notes
                <textarea
                  maxLength={2000}
                  rows={3}
                  value={form.notes}
                  onChange={(evt) => field("notes", evt.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 4, resize: "vertical" }}
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  ...TAP_TARGET,
                  padding: "0 20px",
                  background: "var(--color-orange, #FEAA6D)",
                  border: "none",
                  borderRadius: 4,
                  cursor: saving ? "not-allowed" : "pointer",
                  fontWeight: 600
                }}
              >
                {saving ? "Saving…" : "Save as draft"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setForm(EMPTY_FORM);
                }}
                style={{
                  ...TAP_TARGET,
                  padding: "0 16px",
                  background: "transparent",
                  border: "1px solid var(--border-default, #e5e7eb)",
                  borderRadius: 4,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Detail panel */}
      {selected && (
        <section
          style={{
            background: "var(--bg-card, #fff)",
            border: "1px solid var(--border-default, #e5e7eb)",
            borderRadius: 8,
            padding: 20,
            marginBottom: 24
          }}
        >
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
          >
            <div>
              <h2 style={{ marginTop: 0 }}>
                {selected.number}
                <span style={{ ...STATUS_COLOURS[selected.status], marginLeft: 12, fontSize: 14 }}>
                  {selected.status}
                </span>
              </h2>
              <p style={{ margin: "4px 0" }}>
                <strong>Category:</strong> {selected.category}
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Description:</strong> {selected.description}
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Date:</strong> {formatDate(selected.spentOn)}
              </p>
              <p style={{ margin: "4px 0" }}>
                <strong>Amount:</strong> {formatAmount(selected.amount)}
                {selected.gst && ` (+ ${formatAmount(selected.gst)} GST)`}
              </p>
              {selected.paymentMethod && (
                <p style={{ margin: "4px 0" }}>
                  <strong>Payment:</strong> {selected.paymentMethod.replace(/_/g, " ")}
                </p>
              )}
              {selected.submittedBy && (
                <p style={{ margin: "4px 0" }}>
                  <strong>Submitted by:</strong> {selected.submittedBy.firstName}{" "}
                  {selected.submittedBy.lastName}
                </p>
              )}
              {selected.approvedBy && (
                <p style={{ margin: "4px 0" }}>
                  <strong>Approved by:</strong> {selected.approvedBy.firstName}{" "}
                  {selected.approvedBy.lastName}
                  {selected.approvedAt ? ` on ${formatDate(selected.approvedAt)}` : ""}
                </p>
              )}
              {selected.rejectionReason && (
                <p style={{ margin: "4px 0", color: "var(--status-danger, #b00020)" }}>
                  <strong>Rejection reason:</strong> {selected.rejectionReason}
                </p>
              )}
              {selected.notes && (
                <p style={{ margin: "4px 0" }}>
                  <strong>Notes:</strong> {selected.notes}
                </p>
              )}
              {selected.receiptDocumentId && (
                <p style={{ margin: "4px 0" }}>
                  <strong>Receipt:</strong> Document ID {selected.receiptDocumentId} (open via
                  Documents module)
                </p>
              )}
            </div>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close detail"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 20,
                lineHeight: 1
              }}
            >
              &times;
            </button>
          </div>

          {/* Approval actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            {/* Submit: submitter can submit DRAFT or REJECTED */}
            {canManage &&
              selected.submittedById === user?.id &&
              (selected.status === "DRAFT" || selected.status === "REJECTED") && (
                <button
                  onClick={() => void transition(selected.id, "/submit")}
                  style={{
                    ...TAP_TARGET,
                    padding: "0 16px",
                    background: "var(--color-orange, #FEAA6D)",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Submit for approval
                </button>
              )}

            {/* Approve: approver on SUBMITTED */}
            {canApprove && selected.status === "SUBMITTED" && (
              <button
                onClick={() => void transition(selected.id, "/approve")}
                style={{
                  ...TAP_TARGET,
                  padding: "0 16px",
                  background: "var(--status-success, #047857)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: 600
                }}
              >
                Approve
              </button>
            )}

            {/* Reject: approver on SUBMITTED */}
            {canApprove && selected.status === "SUBMITTED" && !showRejectInput && (
              <button
                onClick={() => setShowRejectInput(true)}
                style={{
                  ...TAP_TARGET,
                  padding: "0 16px",
                  background: "var(--status-danger, #b00020)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: 600
                }}
              >
                Reject
              </button>
            )}

            {/* Reimburse: approver on APPROVED */}
            {canApprove && selected.status === "APPROVED" && (
              <button
                onClick={() => void transition(selected.id, "/reimburse")}
                style={{
                  ...TAP_TARGET,
                  padding: "0 16px",
                  background: "var(--color-teal, #005B61)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: 600
                }}
              >
                Mark as reimbursed
              </button>
            )}
          </div>

          {/* Rejection reason input */}
          {showRejectInput && (
            <div style={{ marginTop: 12 }}>
              <label>
                Rejection reason *
                <input
                  type="text"
                  required
                  maxLength={1000}
                  value={rejectReason}
                  onChange={(evt) => setRejectReason(evt.target.value)}
                  style={{ display: "block", width: "100%", ...TAP_TARGET, marginTop: 4 }}
                  placeholder="Provide a reason for rejection"
                />
              </label>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => {
                    if (!rejectReason.trim()) {
                      setError("Rejection reason is required.");
                      return;
                    }
                    void transition(selected.id, "/reject", { rejectionReason: rejectReason });
                    setRejectReason("");
                    setShowRejectInput(false);
                  }}
                  style={{
                    ...TAP_TARGET,
                    padding: "0 16px",
                    background: "var(--status-danger, #b00020)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Confirm rejection
                </button>
                <button
                  onClick={() => {
                    setShowRejectInput(false);
                    setRejectReason("");
                  }}
                  style={{
                    ...TAP_TARGET,
                    padding: "0 16px",
                    background: "transparent",
                    border: "1px solid var(--border-default, #e5e7eb)",
                    borderRadius: 4,
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Expense list */}
      {expenses.length === 0 && !showCreate ? (
        <EmptyState
          heading="No expenses"
          subtext={
            canManage
              ? "Use the '+ New expense' button to submit your first expense claim."
              : "No expense claims have been submitted yet."
          }
        />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border-default, #e5e7eb)" }}>
              <th style={{ textAlign: "left", padding: "8px 0" }}>Number</th>
              <th style={{ textAlign: "left", padding: "8px 0" }}>Date</th>
              <th style={{ textAlign: "left", padding: "8px 0" }}>Category</th>
              <th style={{ textAlign: "left", padding: "8px 0" }}>Description</th>
              <th style={{ textAlign: "right", padding: "8px 0" }}>Amount</th>
              <th style={{ textAlign: "left", padding: "8px 0" }}>Status</th>
              <th style={{ textAlign: "left", padding: "8px 0" }}>Submitted by</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr
                key={expense.id}
                onClick={() => void openDetail(expense)}
                style={{
                  cursor: "pointer",
                  borderBottom: "1px solid var(--border-default, #e5e7eb)"
                }}
              >
                <td style={{ padding: "10px 0", fontFamily: "monospace", fontSize: 13 }}>
                  {expense.number}
                </td>
                <td style={{ padding: "10px 0" }}>{formatDate(expense.spentOn)}</td>
                <td style={{ padding: "10px 0" }}>{expense.category}</td>
                <td
                  style={{
                    padding: "10px 0",
                    maxWidth: 240,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {expense.description}
                </td>
                <td style={{ padding: "10px 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatAmount(expense.amount)}
                </td>
                <td style={{ padding: "10px 0", ...STATUS_COLOURS[expense.status] }}>
                  {expense.status}
                </td>
                <td style={{ padding: "10px 0" }}>
                  {expense.submittedBy
                    ? `${expense.submittedBy.firstName} ${expense.submittedBy.lastName}`
                    : expense.submittedById}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
