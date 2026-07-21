import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { useOffline } from "../../offline/OfflineContext";

// Field / PWA expense capture — slice 2 of the expense workstream.
// Reuses the existing /expenses API (no schema changes) and the offline
// outbox in apps/web/src/offline for offline-tolerant submission.
//
// Receipt photo is captured in the form but retained client-side only —
// linking to a DocumentLink is deferred to slice 3 (receipt OCR), which
// owns the upload + OCR pipeline. Skipping the upload here keeps this
// slice off the documents.manage permission and avoids buffering large
// blobs in the sync outbox.

type ExpenseCategory = string;

type Allocation = {
  id: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
};

type ExpenseRow = {
  id: string;
  number: string;
  category: string;
  description: string;
  spentOn: string;
  amount: string;
  gst: string | null;
  paymentMethod: string | null;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REIMBURSED";
  projectId: string | null;
  jobId: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

const PAYMENT_METHODS = [
  { value: "", label: "Not specified" },
  { value: "CARD", label: "Company card" },
  { value: "CASH", label: "Cash" },
  { value: "PERSONAL_REIMBURSABLE", label: "Personal (reimbursable)" }
] as const;

const CATEGORIES: ExpenseCategory[] = [
  "Fuel",
  "Materials",
  "Tools/Equipment",
  "Travel",
  "Meals",
  "PPE",
  "Subcontractor",
  "Other"
];

const STATUS_PILL: Record<ExpenseRow["status"], { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: "#FEEDD7", fg: "#B45309", label: "Draft" },
  SUBMITTED: { bg: "color-mix(in srgb, #005B61 15%, transparent)", fg: "#005B61", label: "Submitted" },
  APPROVED: { bg: "#DCFCE7", fg: "#166534", label: "Approved" },
  REJECTED: { bg: "#FEE2E2", fg: "#991B1B", label: "Rejected" },
  REIMBURSED: { bg: "#E5E7EB", fg: "#374151", label: "Reimbursed" }
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function formatAmount(value: string | number): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

export function FieldExpensePage() {
  const [view, setView] = useState<"list" | "new">("list");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (successMessage) {
    return (
      <div className="field-card" style={{ textAlign: "center" }}>
        <h2 style={{ fontFamily: "Syne, Outfit, sans-serif" }}>✅ Captured</h2>
        <p style={{ color: "#374151" }}>{successMessage}</p>
        <button
          type="button"
          className="field-btn"
          onClick={() => {
            setSuccessMessage(null);
            setView("list");
          }}
        >
          Back to expenses
        </button>
      </div>
    );
  }

  if (view === "new") {
    return (
      <NewExpense
        onCancel={() => setView("list")}
        onSubmitted={(msg) => {
          setSuccessMessage(msg);
        }}
      />
    );
  }

  return <ExpenseList onNew={() => setView("new")} />;
}

function ExpenseList({ onNew }: { onNew: () => void }) {
  const { authFetch } = useAuth();
  const { pendingCount, online } = useOffline();
  const [rows, setRows] = useState<ExpenseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!online) {
      // No point hammering the network offline — leave the list empty
      // and let the outbox flush repopulate on reconnect.
      setRows([]);
      return;
    }
    try {
      const response = await authFetch("/expenses?page=1&pageSize=25");
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as { items: ExpenseRow[] };
      setRows(body.items ?? []);
    } catch (err) {
      setError((err as Error).message);
      setRows([]);
    }
  }, [authFetch, online]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontFamily: "Syne, Outfit, sans-serif" }}>My expenses</h2>
        <button type="button" className="field-btn" onClick={onNew}>
          + New
        </button>
      </div>

      {pendingCount > 0 ? (
        <div
          className="field-card"
          style={{ background: "#FEF3C7", color: "#92400E", fontSize: 13 }}
        >
          {pendingCount} item{pendingCount === 1 ? "" : "s"} queued for sync
        </div>
      ) : null}

      {error ? (
        <div className="field-card" role="alert" style={{ color: "#A32D2D" }}>
          {error}
        </div>
      ) : null}

      {rows === null ? (
        <Skeleton width="100%" height={80} />
      ) : rows.length === 0 ? (
        <div className="field-card">
          <EmptyState
            heading="No expenses yet"
            subtext="Capture fuel, materials, tools, or travel on site."
          />
        </div>
      ) : (
        rows.map((row) => {
          const pill = STATUS_PILL[row.status];
          return (
            <div key={row.id} className="field-card">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{row.number}</strong>
                <span className="field-pill" style={{ background: pill.bg, color: pill.fg }}>
                  {pill.label}
                </span>
              </div>
              <div style={{ fontSize: 14, color: "#1F2937", marginTop: 4 }}>
                {formatAmount(row.amount)} · {row.category}
              </div>
              <div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>{row.description}</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                {formatDate(row.spentOn)}
              </div>
              {row.rejectionReason ? (
                <div style={{ fontSize: 12, color: "#991B1B", marginTop: 4 }}>
                  Rejected: {row.rejectionReason}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}

type FormState = {
  category: string;
  description: string;
  spentOn: string;
  amount: string;
  gst: string;
  paymentMethod: string;
  allocationId: string;
  notes: string;
  receiptPhoto: string | null;
};

function emptyForm(): FormState {
  return {
    category: "",
    description: "",
    spentOn: todayIso(),
    amount: "",
    gst: "",
    paymentMethod: "",
    allocationId: "",
    notes: "",
    receiptPhoto: null
  };
}

function NewExpense({
  onCancel,
  onSubmitted
}: {
  onCancel: () => void;
  onSubmitted: (message: string) => void;
}) {
  const { authFetch } = useAuth();
  const { offlineFetch, online } = useOffline();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [allocations, setAllocations] = useState<Allocation[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!online) {
        setAllocations([]);
        return;
      }
      try {
        const response = await authFetch("/field/my-allocations");
        if (!response.ok) return;
        const data = (await response.json()) as Allocation[];
        if (!cancelled) setAllocations(data);
      } catch {
        if (!cancelled) setAllocations([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, online]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.category || !form.description || !form.amount || !form.spentOn) {
      setError("Category, description, date and amount are required.");
      return;
    }
    const amountNumber = parseFloat(form.amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError("Amount must be a positive number.");
      return;
    }
    setError(null);
    setSubmitting(true);

    const allocation = allocations?.find((a) => a.id === form.allocationId) ?? null;
    const body: Record<string, unknown> = {
      category: form.category,
      description: form.description,
      spentOn: form.spentOn,
      amount: amountNumber
    };
    if (form.gst) {
      const gstNumber = parseFloat(form.gst);
      if (Number.isFinite(gstNumber) && gstNumber >= 0) body.gst = gstNumber;
    }
    if (form.paymentMethod) body.paymentMethod = form.paymentMethod;
    if (form.notes) body.notes = form.notes;
    if (allocation) body.projectId = allocation.projectId;

    try {
      const createResult = await offlineFetch(
        "/expenses",
        { method: "POST", body },
        "field-expense"
      );

      if (createResult.queued) {
        onSubmitted(
          `Expense saved offline (${formatAmount(amountNumber)}). It will submit for approval once you're back online.`
        );
        return;
      }

      const response = createResult.response;
      if (!response || !response.ok) {
        throw new Error((await response?.text()) ?? "Could not create expense.");
      }
      const created = (await response.json()) as { id: string; number: string };

      const submitResult = await offlineFetch(
        `/expenses/${created.id}/submit`,
        { method: "POST", body: {} },
        "field-expense-submit"
      );

      if (submitResult.queued) {
        onSubmitted(
          `Expense ${created.number} saved. Submission will finish when you're back online.`
        );
        return;
      }

      if (submitResult.response && !submitResult.response.ok) {
        throw new Error(await submitResult.response.text());
      }

      onSubmitted(
        `Expense ${created.number} (${formatAmount(amountNumber)}) submitted for approval.`
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="field-card" onSubmit={onSubmit} noValidate>
      <h2 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>New expense</h2>
      {!online ? (
        <p style={{ fontSize: 13, color: "#92400E", marginTop: 8 }}>
          You're offline. This expense will queue and submit when you're back online.
        </p>
      ) : null}

      <label className="field-label" style={{ marginTop: 12 }}>
        Category
      </label>
      <select
        className="field-input"
        value={form.category}
        onChange={(e) => update("category", e.target.value)}
        required
      >
        <option value="">Select…</option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <label className="field-label" style={{ marginTop: 12 }}>
        Amount (ex GST, AUD)
      </label>
      <input
        className="field-input"
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0.01"
        placeholder="0.00"
        value={form.amount}
        onChange={(e) => update("amount", e.target.value)}
        required
      />

      <label className="field-label" style={{ marginTop: 12 }}>
        GST (optional)
      </label>
      <input
        className="field-input"
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        placeholder="0.00"
        value={form.gst}
        onChange={(e) => update("gst", e.target.value)}
      />

      <label className="field-label" style={{ marginTop: 12 }}>
        Date spent
      </label>
      <input
        className="field-input"
        type="date"
        value={form.spentOn}
        onChange={(e) => update("spentOn", e.target.value)}
        required
      />

      <label className="field-label" style={{ marginTop: 12 }}>
        Payment method
      </label>
      <select
        className="field-input"
        value={form.paymentMethod}
        onChange={(e) => update("paymentMethod", e.target.value)}
      >
        {PAYMENT_METHODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <label className="field-label" style={{ marginTop: 12 }}>
        Project (optional)
      </label>
      <select
        className="field-input"
        value={form.allocationId}
        onChange={(e) => update("allocationId", e.target.value)}
        disabled={!allocations || allocations.length === 0}
      >
        <option value="">
          {!allocations
            ? "Loading jobs…"
            : allocations.length === 0
              ? online
                ? "No jobs assigned"
                : "Not available offline"
              : "Not linked to a job"}
        </option>
        {(allocations ?? []).map((a) => (
          <option key={a.id} value={a.id}>
            {a.projectNumber} — {a.projectName}
          </option>
        ))}
      </select>

      <label className="field-label" style={{ marginTop: 12 }}>
        Description
      </label>
      <textarea
        className="field-input"
        rows={2}
        maxLength={1000}
        placeholder="What was purchased and why"
        value={form.description}
        onChange={(e) => update("description", e.target.value)}
        required
      />

      <label className="field-label" style={{ marginTop: 12 }}>
        Notes (optional)
      </label>
      <textarea
        className="field-input"
        rows={2}
        maxLength={2000}
        value={form.notes}
        onChange={(e) => update("notes", e.target.value)}
      />

      <label className="field-label" style={{ marginTop: 12 }}>
        Receipt photo (optional)
      </label>
      <ReceiptPhoto
        value={form.receiptPhoto}
        onChange={(v) => update("receiptPhoto", v)}
      />
      {form.receiptPhoto ? (
        <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
          Photo captured on device. Receipt linking to the expense record ships with the receipt OCR
          release; keep the paper receipt as a backup for now.
        </p>
      ) : null}

      {error ? (
        <div
          role="alert"
          style={{
            background: "#FCEBEB",
            color: "#A32D2D",
            padding: 10,
            borderRadius: 6,
            marginTop: 12,
            fontSize: 13
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
        <button
          type="button"
          className="field-btn field-btn--ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button type="submit" className="field-btn" disabled={submitting}>
          {submitting ? "Saving…" : "Submit"}
        </button>
      </div>
    </form>
  );
}

function ReceiptPhoto({
  value,
  onChange
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFile = async (file: File | null | undefined) => {
    if (!file) return;
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    onChange(data);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <button
        type="button"
        className="field-btn field-btn--teal"
        onClick={() => inputRef.current?.click()}
        style={{ width: "100%" }}
      >
        📷 {value ? "Retake photo" : "Take photo of receipt"}
      </button>
      {value ? (
        <div style={{ marginTop: 8, position: "relative", display: "inline-block" }}>
          <img
            src={value}
            alt="Receipt"
            style={{
              maxWidth: "100%",
              maxHeight: 240,
              borderRadius: 8,
              border: "1px solid #CBD5E1"
            }}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove receipt"
            style={{
              position: "absolute",
              top: -8,
              right: -8,
              width: 24,
              height: 24,
              background: "#DC2626",
              color: "#fff",
              border: "none",
              borderRadius: "50%",
              fontSize: 14,
              cursor: "pointer"
            }}
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
