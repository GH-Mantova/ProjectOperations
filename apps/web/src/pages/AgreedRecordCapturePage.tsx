import { FormEvent, useCallback, useEffect, useState } from "react";
import { throwIfApiError } from "../lib/api-errors";
import { useAuth } from "../auth/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type Job = { id: string; jobNumber: string; name: string };

type SorCategory = "LABOUR" | "PLANT" | "WASTE" | "SUBCONTRACTOR";

type LineRow = {
  id: string;
  category: SorCategory;
  resourceName: string;
  class: string | null;
  unit: string | null;
  quantity: string;
  tier: string;
  notes: string | null;
  sortOrder: number;
};

type AttachmentRow = {
  id: string;
  kind: string;
  filePath: string;
};

type AgreedRecordRow = {
  id: string;
  recordNumber: string;
  description: string;
  workDate: string;
  status: string;
  lines: LineRow[];
  attachments: AttachmentRow[];
  clientRepName: string | null;
  workerSignaturePath: string | null;
  clientRepSignaturePath: string | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<SorCategory, string> = {
  LABOUR: "Labour",
  PLANT: "Plant",
  WASTE: "Waste",
  SUBCONTRACTOR: "Subcontractor",
};

const TIER_OPTIONS = [
  { value: "ORDINARY", label: "Ordinary" },
  { value: "ONE_AND_HALF", label: "1.5x" },
  { value: "DOUBLE", label: "Double" },
];

const STATUS_PILL: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: "#E0F2F1", fg: "#005B61" },
  SUBMITTED: { bg: "#DCFCE7", fg: "#166534" },
  OFFICE_REVIEW: { bg: "#FEF3C7", fg: "#92400E" },
  PRICED: { bg: "#EDE9FE", fg: "#5B21B6" },
  APPROVED: { bg: "#DCFCE7", fg: "#166534" },
  SENT_BACK: { bg: "#FEE2E2", fg: "#991B1B" },
  VOID: { bg: "#F3F4F6", fg: "#6B7280" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * AgreedRecordCapturePage — mobile-first field capture screen for dayworks.
 *
 * Captures: job selection → description + work date → resource lines
 * (category / resource name / qty / tier) → photos → worker signature →
 * client-rep name + signature → submit.
 *
 * IMPORTANT: No rate or dollar value is displayed anywhere on this page.
 * Pricing is office-side (S8).
 *
 * Route: /field/agreed-records (behind field.view guard — same as dockets).
 */
export function AgreedRecordCapturePage() {
  const { authFetch } = useAuth();

  type View = "list" | "new-step1" | "new-step2" | "new-step3" | "detail";

  const [view, setView] = useState<View>("list");

  // List state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [records, setRecords] = useState<AgreedRecordRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Active AR being built
  const [activeArId, setActiveArId] = useState<string | null>(null);
  const [activeAr, setActiveAr] = useState<AgreedRecordRow | null>(null);

  // Step 1 — basic info
  const [formJobId, setFormJobId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [workDate, setWorkDate] = useState<string>(
    new Date().toISOString().substring(0, 10),
  );

  // Step 2 — add lines
  const [lineCategory, setLineCategory] = useState<SorCategory>("LABOUR");
  const [lineResourceName, setLineResourceName] = useState<string>("");
  const [lineClass, setLineClass] = useState<string>("");
  const [lineUnit, setLineUnit] = useState<string>("hr");
  const [lineQty, setLineQty] = useState<string>("");
  const [lineTier, setLineTier] = useState<string>("ORDINARY");
  const [lineNotes, setLineNotes] = useState<string>("");
  const [lineSubmitting, setLineSubmitting] = useState(false);

  // Step 3 — signatures and submission
  const [photoPath, setPhotoPath] = useState<string>("");
  const [workerSigPath, setWorkerSigPath] = useState<string>("");
  const [clientRepName, setClientRepName] = useState<string>("");
  const [clientRepSigPath, setClientRepSigPath] = useState<string>("");
  const [sorPeriodId, setSorPeriodId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────

  const loadJobs = useCallback(async () => {
    try {
      const res = await authFetch("/jobs?pageSize=100");
      if (res.ok) {
        const body = await res.json();
        setJobs(body.items ?? []);
      }
    } catch {
      // Non-fatal — field crew can type job ID manually
    }
  }, [authFetch]);

  const loadRecords = useCallback(async () => {
    if (!selectedJobId) {
      setRecords([]);
      return;
    }
    setError(null);
    try {
      const res = await authFetch(`/agreed-records/for-job/${selectedJobId}`);
      await throwIfApiError(res);
      const body = await res.json();
      setRecords(body as AgreedRecordRow[]);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch, selectedJobId]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (view === "list") void loadRecords();
  }, [loadRecords, view]);

  // ── Step 1: Create DRAFT ──────────────────────────────────────────────────

  const handleCreateDraft = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await authFetch("/agreed-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: formJobId,
          description,
          workDate,
        }),
      });
      await throwIfApiError(res);
      const created = await res.json() as AgreedRecordRow;
      setActiveArId(created.id);
      setActiveAr(created);
      setView("new-step2");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // ── Step 2: Add lines ─────────────────────────────────────────────────────

  const handleAddLine = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeArId) return;
    setLineSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(`/agreed-records/${activeArId}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: lineCategory,
          resourceName: lineResourceName,
          class: lineClass || null,
          unit: lineUnit || null,
          quantity: parseFloat(lineQty),
          tier: lineTier,
          notes: lineNotes || null,
        }),
      });
      await throwIfApiError(res);
      // Refresh active AR
      const arRes = await authFetch(`/agreed-records/for-job/${formJobId}`);
      if (arRes.ok) {
        const all = await arRes.json() as AgreedRecordRow[];
        const updated = all.find((r) => r.id === activeArId);
        if (updated) setActiveAr(updated);
      }
      // Reset line form
      setLineResourceName("");
      setLineClass("");
      setLineQty("");
      setLineNotes("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLineSubmitting(false);
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!activeArId) return;
    setError(null);
    try {
      const res = await authFetch(
        `/agreed-records/${activeArId}/lines/${lineId}`,
        { method: "DELETE" },
      );
      await throwIfApiError(res);
      // Refresh
      const arRes = await authFetch(`/agreed-records/for-job/${formJobId}`);
      if (arRes.ok) {
        const all = await arRes.json() as AgreedRecordRow[];
        const updated = all.find((r) => r.id === activeArId);
        if (updated) setActiveAr(updated);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  // ── Step 3: Attach photo & submit ─────────────────────────────────────────

  const handleAddPhoto = async () => {
    if (!activeArId || !photoPath) return;
    setError(null);
    try {
      const res = await authFetch(`/agreed-records/${activeArId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "PHOTO", filePath: photoPath }),
      });
      await throwIfApiError(res);
      // Refresh
      const arRes = await authFetch(`/agreed-records/for-job/${formJobId}`);
      if (arRes.ok) {
        const all = await arRes.json() as AgreedRecordRow[];
        const updated = all.find((r) => r.id === activeArId);
        if (updated) setActiveAr(updated);
      }
      setPhotoPath("");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeArId) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        workerSignaturePath: workerSigPath,
        clientRepName,
        clientRepSignaturePath: clientRepSigPath,
      };
      if (sorPeriodId) payload["sorPeriodId"] = sorPeriodId;

      const res = await authFetch(`/agreed-records/${activeArId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await throwIfApiError(res);
      const submitted = await res.json() as AgreedRecordRow;
      setSuccess(`Agreed Record ${submitted.recordNumber} submitted.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="field-card" style={{ textAlign: "center" }}>
        <h2 style={{ fontFamily: "Syne, Outfit, sans-serif" }}>Submitted</h2>
        <p style={{ color: "#374151" }}>{success}</p>
        <button
          type="button"
          className="field-btn"
          onClick={() => {
            setSuccess(null);
            setActiveArId(null);
            setActiveAr(null);
            setDescription("");
            setWorkDate(new Date().toISOString().substring(0, 10));
            setWorkerSigPath("");
            setClientRepName("");
            setClientRepSigPath("");
            setSorPeriodId("");
            setPhotoPath("");
            setView("list");
          }}
        >
          Back to list
        </button>
        <button
          type="button"
          className="field-btn"
          style={{ marginLeft: "0.5rem", background: "#005B61", color: "#fff" }}
          onClick={() => {
            setSuccess(null);
            setActiveArId(null);
            setActiveAr(null);
            setDescription("");
            setWorkDate(new Date().toISOString().substring(0, 10));
            setWorkerSigPath("");
            setClientRepName("");
            setClientRepSigPath("");
            setSorPeriodId("");
            setPhotoPath("");
            setView("new-step1");
          }}
        >
          New AR
        </button>
      </div>
    );
  }

  // ── Step 1: Basic info ────────────────────────────────────────────────────

  if (view === "new-step1") {
    return (
      <div className="field-card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <button type="button" className="field-btn" onClick={() => setView("list")}>
            Back
          </button>
          <h2 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>
            New Agreed Record
          </h2>
        </div>
        <p style={{ color: "#6B7280", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Step 1 of 3 — Job details
        </p>

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "0.75rem", borderRadius: "0.375rem", marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={(e) => { void handleCreateDraft(e); }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Job *
          </label>
          {jobs.length > 0 ? (
            <select
              value={formJobId}
              onChange={(e) => setFormJobId(e.target.value)}
              className="field-input"
              style={{ marginBottom: "1rem", width: "100%" }}
              required
            >
              <option value="">Select job...</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.jobNumber} — {j.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={formJobId}
              onChange={(e) => setFormJobId(e.target.value)}
              className="field-input"
              placeholder="Job ID (manual entry)"
              style={{ marginBottom: "1rem", width: "100%" }}
              required
            />
          )}

          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Description of work *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="field-input"
            placeholder="Brief description of the dayworks..."
            rows={3}
            style={{ marginBottom: "1rem", width: "100%", resize: "vertical" }}
            required
          />

          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Work date *
          </label>
          <input
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            className="field-input"
            style={{ marginBottom: "1.5rem", width: "100%" }}
            required
          />

          <button
            type="submit"
            className="field-btn"
            style={{ background: "#005B61", color: "#fff", width: "100%" }}
          >
            Next: Add resources
          </button>
        </form>
      </div>
    );
  }

  // ── Step 2: Resource lines ────────────────────────────────────────────────

  if (view === "new-step2") {
    const ar = activeAr;
    return (
      <div className="field-card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <h2 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>
            Resources
          </h2>
          {ar && (
            <span style={{ color: "#6B7280", fontSize: "0.85rem" }}>
              {ar.recordNumber}
            </span>
          )}
        </div>
        <p style={{ color: "#6B7280", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Step 2 of 3 — Add labour, plant, waste, or subcontractor items
        </p>

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "0.75rem", borderRadius: "0.375rem", marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        {/* Existing lines */}
        {ar && ar.lines.length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
              Lines added ({ar.lines.length}):
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {ar.lines.map((line) => (
                <li
                  key={line.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    border: "1px solid #E5E7EB",
                    borderRadius: "0.375rem",
                    padding: "0.5rem 0.75rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div>
                    <span
                      style={{
                        background: "#E0F2F1",
                        color: "#005B61",
                        padding: "0.1rem 0.4rem",
                        borderRadius: "0.25rem",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        marginRight: "0.4rem",
                      }}
                    >
                      {CATEGORY_LABELS[line.category as SorCategory] ?? line.category}
                    </span>
                    <strong style={{ fontSize: "0.9rem" }}>{line.resourceName}</strong>
                    {line.class && (
                      <span style={{ color: "#6B7280", fontSize: "0.8rem" }}> ({line.class})</span>
                    )}
                    <div style={{ fontSize: "0.8rem", color: "#374151", marginTop: "0.15rem" }}>
                      {line.quantity} {line.unit ?? ""} &middot; {line.tier}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { void handleDeleteLine(line.id); }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#991B1B",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      padding: "0.25rem",
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add line form */}
        <form onSubmit={(e) => { void handleAddLine(e); }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Category *
          </label>
          <select
            value={lineCategory}
            onChange={(e) => setLineCategory(e.target.value as SorCategory)}
            className="field-input"
            style={{ marginBottom: "0.75rem", width: "100%" }}
            required
          >
            {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Resource / item name *
          </label>
          <input
            type="text"
            value={lineResourceName}
            onChange={(e) => setLineResourceName(e.target.value)}
            className="field-input"
            placeholder="e.g. Excavator operator, 10t tipper, Concrete disposal"
            style={{ marginBottom: "0.75rem", width: "100%" }}
            required
          />

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
                Class
              </label>
              <input
                type="text"
                value={lineClass}
                onChange={(e) => setLineClass(e.target.value)}
                className="field-input"
                placeholder="e.g. Class 3"
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
                Unit
              </label>
              <input
                type="text"
                value={lineUnit}
                onChange={(e) => setLineUnit(e.target.value)}
                className="field-input"
                placeholder="hr / t / m3 / ea"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <div style={{ flex: 2 }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
                Quantity *
              </label>
              <input
                type="number"
                value={lineQty}
                onChange={(e) => setLineQty(e.target.value)}
                className="field-input"
                placeholder="0.00"
                min={0}
                step={0.01}
                style={{ width: "100%" }}
                required
              />
            </div>
            {lineCategory === "LABOUR" && (
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
                  Tier
                </label>
                <select
                  value={lineTier}
                  onChange={(e) => setLineTier(e.target.value)}
                  className="field-input"
                  style={{ width: "100%" }}
                >
                  {TIER_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Notes
          </label>
          <input
            type="text"
            value={lineNotes}
            onChange={(e) => setLineNotes(e.target.value)}
            className="field-input"
            placeholder="Optional notes"
            style={{ marginBottom: "1rem", width: "100%" }}
          />

          <button
            type="submit"
            className="field-btn"
            disabled={lineSubmitting}
            style={{ background: "#374151", color: "#fff", width: "100%", marginBottom: "0.75rem" }}
          >
            {lineSubmitting ? "Adding..." : "+ Add line"}
          </button>
        </form>

        <button
          type="button"
          className="field-btn"
          style={{ background: "#005B61", color: "#fff", width: "100%" }}
          onClick={() => {
            if (!ar || ar.lines.length === 0) {
              setError("Add at least one resource line before continuing.");
              return;
            }
            setError(null);
            setView("new-step3");
          }}
        >
          Next: Photos and signatures
        </button>
      </div>
    );
  }

  // ── Step 3: Photos + signatures + submit ──────────────────────────────────

  if (view === "new-step3") {
    const ar = activeAr;
    const photoCount = ar?.attachments.filter((a) => a.kind === "PHOTO").length ?? 0;
    return (
      <div className="field-card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <button type="button" className="field-btn" onClick={() => setView("new-step2")}>
            Back
          </button>
          <h2 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>
            Photos and Signatures
          </h2>
        </div>
        <p style={{ color: "#6B7280", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Step 3 of 3 — Attach photos then capture both signatures
        </p>

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "0.75rem", borderRadius: "0.375rem", marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        {/* Photo upload */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Photos ({photoCount} attached) *
          </label>
          <p style={{ fontSize: "0.8rem", color: "#6B7280", marginBottom: "0.5rem" }}>
            At least one photo is required. Enter the file path from the device.
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              value={photoPath}
              onChange={(e) => setPhotoPath(e.target.value)}
              className="field-input"
              placeholder="Photo file path"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="field-btn"
              style={{ background: "#374151", color: "#fff" }}
              onClick={() => { void handleAddPhoto(); }}
              disabled={!photoPath}
            >
              Add
            </button>
          </div>
          {ar && ar.attachments.filter((a) => a.kind === "PHOTO").length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, marginTop: "0.5rem" }}>
              {ar.attachments
                .filter((a) => a.kind === "PHOTO")
                .map((a) => (
                  <li key={a.id} style={{ fontSize: "0.8rem", color: "#374151" }}>
                    {a.filePath}
                  </li>
                ))}
            </ul>
          )}
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }}>
          {/* Worker signature */}
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Worker signature file path *
          </label>
          <input
            type="text"
            value={workerSigPath}
            onChange={(e) => setWorkerSigPath(e.target.value)}
            className="field-input"
            placeholder="Worker signature capture path"
            style={{ marginBottom: "1rem", width: "100%" }}
            required
          />

          {/* Client-rep details */}
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Client representative name *
          </label>
          <input
            type="text"
            value={clientRepName}
            onChange={(e) => setClientRepName(e.target.value)}
            className="field-input"
            placeholder="Full name of the site rep"
            style={{ marginBottom: "1rem", width: "100%" }}
            required
          />

          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Client representative signature file path *
          </label>
          <input
            type="text"
            value={clientRepSigPath}
            onChange={(e) => setClientRepSigPath(e.target.value)}
            className="field-input"
            placeholder="Client rep signature capture path"
            style={{ marginBottom: "1rem", width: "100%" }}
            required
          />

          {/* Optional SoR period lock — only needed on first AR for the job */}
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            SoR Period ID (optional — required if this is the first AR for this job)
          </label>
          <input
            type="text"
            value={sorPeriodId}
            onChange={(e) => setSorPeriodId(e.target.value)}
            className="field-input"
            placeholder="SoR Period ID (leave blank if already locked)"
            style={{ marginBottom: "1.5rem", width: "100%" }}
          />

          <button
            type="submit"
            className="field-btn"
            disabled={submitting}
            style={{ background: "#005B61", color: "#fff", width: "100%" }}
          >
            {submitting ? "Submitting..." : "Submit Agreed Record"}
          </button>
        </form>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────

  return (
    <div className="field-card">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>Agreed Records</h2>
        <button
          type="button"
          className="field-btn"
          style={{ background: "#005B61", color: "#fff" }}
          onClick={() => setView("new-step1")}
        >
          + New
        </button>
      </div>

      {/* Job filter */}
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600, fontSize: "0.85rem" }}>
          Filter by job
        </label>
        {jobs.length > 0 ? (
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="field-input"
            style={{ width: "100%" }}
          >
            <option value="">All jobs</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.jobNumber} — {j.name}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="field-input"
            placeholder="Job ID to filter"
            style={{ width: "100%" }}
          />
        )}
      </div>

      {error && (
        <div
          style={{
            background: "#FEE2E2",
            color: "#991B1B",
            padding: "0.75rem",
            borderRadius: "0.375rem",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {records === null && selectedJobId && (
        <p style={{ color: "#6B7280" }}>Loading...</p>
      )}

      {!selectedJobId && (
        <p style={{ color: "#6B7280" }}>Select a job above to view its Agreed Records.</p>
      )}

      {records !== null && records.length === 0 && selectedJobId && (
        <p style={{ color: "#6B7280" }}>No Agreed Records for this job yet. Tap + New to capture one.</p>
      )}

      {records !== null && records.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {records.map((row) => {
            const pill = STATUS_PILL[row.status] ?? { bg: "#E2E8F0", fg: "#1F2937" };
            return (
              <li
                key={row.id}
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: "0.5rem",
                  padding: "0.75rem",
                  marginBottom: "0.75rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <strong style={{ fontFamily: "Syne, Outfit, sans-serif" }}>
                      {row.recordNumber}
                    </strong>
                  </div>
                  <span
                    style={{
                      background: pill.bg,
                      color: pill.fg,
                      padding: "0.1rem 0.4rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {row.status}
                  </span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "#374151", marginTop: "0.25rem" }}>
                  {row.description}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#6B7280", marginTop: "0.15rem" }}>
                  {formatDate(row.workDate)} &middot; {row.lines.length} line
                  {row.lines.length !== 1 ? "s" : ""} &middot;{" "}
                  {row.attachments.length} attachment
                  {row.attachments.length !== 1 ? "s" : ""}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
