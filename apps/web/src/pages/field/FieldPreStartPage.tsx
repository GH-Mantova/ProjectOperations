import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type PreStartRow = {
  id: string;
  date: string;
  status: "DRAFT" | "SUBMITTED";
  projectNumber: string;
  projectName: string;
};

type PreStartDetail = {
  id: string;
  projectId: string;
  workerProfileId: string;
  allocationId: string;
  date: string;
  status: "DRAFT" | "SUBMITTED";
  supervisorName: string | null;
  siteHazardsAcknowledged: boolean;
  hazardNotes: string | null;
  ppeHelmet: boolean;
  ppeGloves: boolean;
  ppeBoots: boolean;
  ppeHighVis: boolean;
  ppeRespirator: boolean;
  ppeOther: string | null;
  plantChecksCompleted: boolean;
  plantCheckNotes: string | null;
  fitForWork: boolean;
  fitForWorkDeclaration: string | null;
  workerSignature: string | null;
  asbEnclosureInspection: boolean | null;
  asbAirMonitoring: boolean | null;
  asbDeconOperational: boolean | null;
  civExcavationPermit: boolean | null;
  civUndergroundClearance: boolean | null;
};

type Allocation = {
  id: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
  scopeCodes: string[];
};

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: "#FEEDD7", fg: "#B45309", label: "Draft" },
  SUBMITTED: { bg: "color-mix(in srgb, #005B61 15%, transparent)", fg: "#005B61", label: "Submitted" }
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function FieldPreStartPage() {
  const { authFetch } = useAuth();
  const [params] = useSearchParams();
  const preselectAlloc = params.get("allocationId");
  const [view, setView] = useState<"list" | "new" | "edit">(preselectAlloc ? "new" : "list");
  const [rows, setRows] = useState<PreStartRow[] | null>(null);
  const [editing, setEditing] = useState<PreStartDetail | null>(null);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      const response = await authFetch("/field/pre-starts?limit=50");
      if (!response.ok) throw new Error(await response.text());
      const body = await response.json();
      setRows(body.items ?? []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch]);

  useEffect(() => {
    if (view === "list") void loadList();
  }, [loadList, view]);

  if (successMessage) {
    return (
      <div className="field-card" style={{ textAlign: "center" }}>
        <h2 style={{ fontFamily: "Syne, Outfit, sans-serif" }}>✅ Submitted</h2>
        <p style={{ color: "#374151" }}>{successMessage}</p>
        <button
          type="button"
          className="field-btn"
          onClick={() => {
            setSuccessMessage(null);
            setView("list");
          }}
        >
          Back to pre-starts
        </button>
      </div>
    );
  }

  if (view === "new") {
    return (
      <NewPreStart
        preselectAllocationId={preselectAlloc}
        onCancel={() => setView("list")}
        onOpenEdit={(checklist, allocation) => {
          setEditing(checklist);
          setEditingAllocation(allocation);
          setView("edit");
        }}
      />
    );
  }

  if (view === "edit" && editing && editingAllocation) {
    return (
      <EditPreStart
        checklist={editing}
        allocation={editingAllocation}
        onCancel={() => {
          setEditing(null);
          setEditingAllocation(null);
          setView("list");
        }}
        onSubmitted={(msg) => {
          setSuccessMessage(msg);
          setEditing(null);
          setEditingAllocation(null);
        }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontFamily: "Syne, Outfit, sans-serif" }}>Pre-starts</h2>
        <button type="button" className="field-btn" onClick={() => setView("new")}>
          + New
        </button>
      </div>

      {error ? (
        <div className="field-card" role="alert" style={{ color: "#A32D2D" }}>
          {error}
        </div>
      ) : null}

      {rows === null ? (
        <Skeleton width="100%" height={80} />
      ) : rows.length === 0 ? (
        <div className="field-card">
          <EmptyState heading="No pre-starts yet" subtext="Start one when you arrive on site." />
        </div>
      ) : (
        rows.map((r) => {
          const pill = STATUS_PILL[r.status];
          return (
            <button
              key={r.id}
              type="button"
              className="field-card"
              onClick={() => {
                void openRow(r, authFetch, setEditing, setEditingAllocation, setView, setError);
              }}
              style={{ width: "100%", textAlign: "left", border: "none", cursor: "pointer" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{r.projectNumber}</strong>
                <span className="field-pill" style={{ background: pill.bg, color: pill.fg }}>
                  {pill.label}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#374151", marginTop: 4 }}>{r.projectName}</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{formatDate(r.date)}</div>
            </button>
          );
        })
      )}

      <p style={{ color: "#6B7280", fontSize: 12, marginTop: 16 }}>
        <Link to="/field/allocations" style={{ color: "#005B61" }}>← My jobs</Link>
      </p>
    </div>
  );
}

async function openRow(
  row: PreStartRow,
  authFetch: ReturnType<typeof useAuth>["authFetch"],
  setEditing: (c: PreStartDetail) => void,
  setEditingAllocation: (a: Allocation) => void,
  setView: (v: "edit") => void,
  setError: (e: string) => void
) {
  try {
    const response = await authFetch(`/field/pre-starts/${row.id}`);
    if (!response.ok) throw new Error(await response.text());
    const detail = (await response.json()) as PreStartDetail;
    const allocResponse = await authFetch(`/field/my-allocations`);
    const allocList = (await allocResponse.json()) as Allocation[];
    const allocation = allocList.find((a) => a.id === detail.allocationId);
    if (!allocation) throw new Error("Allocation no longer available");
    setEditing(detail);
    setEditingAllocation(allocation);
    setView("edit");
  } catch (err) {
    setError((err as Error).message);
  }
}

function NewPreStart({
  preselectAllocationId,
  onCancel,
  onOpenEdit
}: {
  preselectAllocationId: string | null;
  onCancel: () => void;
  onOpenEdit: (checklist: PreStartDetail, allocation: Allocation) => void;
}) {
  const { authFetch } = useAuth();
  const [allocations, setAllocations] = useState<Allocation[] | null>(null);
  const [allocationId, setAllocationId] = useState<string>(preselectAllocationId ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateLink, setDuplicateLink] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await authFetch("/field/my-allocations");
      if (!response.ok) return;
      const data = (await response.json()) as Allocation[];
      if (!cancelled) setAllocations(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  async function start(e: FormEvent) {
    e.preventDefault();
    if (!allocationId) {
      setError("Please select a job.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setDuplicateLink(null);
    try {
      const response = await authFetch("/field/pre-starts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocationId, date })
      });
      if (response.status === 409) {
        const body = await response.json();
        setError("You already have a pre-start for this job today.");
        if (body?.existingId) setDuplicateLink(body.existingId);
        return;
      }
      if (!response.ok) throw new Error(await response.text());
      const checklist = (await response.json()) as PreStartDetail;
      const allocation = (allocations ?? []).find((a) => a.id === allocationId)!;
      onOpenEdit(checklist, allocation);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="field-card">
      <h2 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>New pre-start</h2>
      <form onSubmit={start} style={{ marginTop: 12 }}>
        <label className="field-label">Job</label>
        <select
          className="field-input"
          value={allocationId}
          onChange={(e) => setAllocationId(e.target.value)}
          required
        >
          <option value="">Select a job…</option>
          {(allocations ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.projectNumber} — {a.projectName}
            </option>
          ))}
        </select>

        <label className="field-label" style={{ marginTop: 12 }}>Date</label>
        <input type="date" className="field-input" value={date} onChange={(e) => setDate(e.target.value)} required />

        {error ? (
          <div style={{ background: "#FCEBEB", color: "#A32D2D", padding: 10, borderRadius: 6, marginTop: 12, fontSize: 13 }}>
            {error}
            {duplicateLink ? (
              <>
                {" "}
                <Link to="/field/pre-start" style={{ color: "#A32D2D", textDecoration: "underline" }}>
                  Open the existing one
                </Link>
              </>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
          <button type="button" className="field-btn field-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="field-btn" disabled={submitting}>
            {submitting ? "Starting…" : "Start"}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditPreStart({
  checklist,
  allocation,
  onCancel,
  onSubmitted
}: {
  checklist: PreStartDetail;
  allocation: Allocation;
  onCancel: () => void;
  onSubmitted: (message: string) => void;
}) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState<PreStartDetail>(checklist);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readOnly = form.status !== "DRAFT";
  const hasAsb = allocation.scopeCodes.some((c) => c.toLowerCase().startsWith("asb"));
  const hasCiv = allocation.scopeCodes.some((c) => c.toLowerCase().startsWith("civ"));

  async function saveDraft() {
    setSaving(true);
    setError(null);
    try {
      const response = await authFetch(`/field/pre-starts/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stripReadOnly(form))
      });
      if (!response.ok) throw new Error(await response.text());
      const updated = (await response.json()) as PreStartDetail;
      setForm(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (!form.fitForWork) {
      setError("You must confirm the fit-for-work declaration.");
      return;
    }
    if (!form.workerSignature) {
      setError("A worker signature is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const patchResponse = await authFetch(`/field/pre-starts/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stripReadOnly(form))
      });
      if (!patchResponse.ok) throw new Error(await patchResponse.text());
      const submitResponse = await authFetch(`/field/pre-starts/${form.id}/submit`, { method: "POST" });
      if (!submitResponse.ok) throw new Error(await submitResponse.text());
      onSubmitted(`Pre-start submitted for ${allocation.projectName} on ${formatDate(form.date)}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const update = <K extends keyof PreStartDetail>(key: K, value: PreStartDetail[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div>
      <section className="field-card">
        <h3 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>Site details</h3>
        <p style={{ margin: "6px 0", fontSize: 14 }}>
          <strong>{allocation.projectName}</strong>
          <span style={{ color: "#6B7280" }}> · {allocation.projectNumber}</span>
        </p>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: "#6B7280" }}>{formatDate(form.date)}</p>
        <label className="field-label">Supervisor name</label>
        <input
          className="field-input"
          value={form.supervisorName ?? ""}
          onChange={(e) => update("supervisorName", e.target.value)}
          disabled={readOnly}
        />
      </section>

      <section className="field-card">
        <h3 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>Site hazards</h3>
        <Check
          label="I have reviewed and acknowledged all site hazards"
          checked={form.siteHazardsAcknowledged}
          onChange={(v) => update("siteHazardsAcknowledged", v)}
          disabled={readOnly}
        />
        <label className="field-label" style={{ marginTop: 8 }}>Hazard notes</label>
        <textarea
          className="field-input"
          rows={3}
          value={form.hazardNotes ?? ""}
          onChange={(e) => update("hazardNotes", e.target.value)}
          disabled={readOnly}
        />
      </section>

      <section className="field-card">
        <h3 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>PPE confirmed</h3>
        <Check label="Hard hat" checked={form.ppeHelmet} onChange={(v) => update("ppeHelmet", v)} disabled={readOnly} />
        <Check label="Gloves" checked={form.ppeGloves} onChange={(v) => update("ppeGloves", v)} disabled={readOnly} />
        <Check label="Safety boots" checked={form.ppeBoots} onChange={(v) => update("ppeBoots", v)} disabled={readOnly} />
        <Check label="High-vis vest" checked={form.ppeHighVis} onChange={(v) => update("ppeHighVis", v)} disabled={readOnly} />
        <Check label="Respirator / dust mask" checked={form.ppeRespirator} onChange={(v) => update("ppeRespirator", v)} disabled={readOnly} />
        <label className="field-label" style={{ marginTop: 8 }}>Other PPE</label>
        <input
          className="field-input"
          value={form.ppeOther ?? ""}
          onChange={(e) => update("ppeOther", e.target.value)}
          disabled={readOnly}
        />
      </section>

      <section className="field-card">
        <h3 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>Plant &amp; equipment checks</h3>
        <Check
          label="Plant and equipment checks completed"
          checked={form.plantChecksCompleted}
          onChange={(v) => update("plantChecksCompleted", v)}
          disabled={readOnly}
        />
        <label className="field-label" style={{ marginTop: 8 }}>Notes</label>
        <textarea
          className="field-input"
          rows={3}
          value={form.plantCheckNotes ?? ""}
          onChange={(e) => update("plantCheckNotes", e.target.value)}
          disabled={readOnly}
        />
      </section>

      {hasAsb ? (
        <section className="field-card">
          <h3 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>Asbestos</h3>
          <Check
            label="Enclosure inspection completed"
            checked={!!form.asbEnclosureInspection}
            onChange={(v) => update("asbEnclosureInspection", v)}
            disabled={readOnly}
          />
          <Check
            label="Air monitoring is in place"
            checked={!!form.asbAirMonitoring}
            onChange={(v) => update("asbAirMonitoring", v)}
            disabled={readOnly}
          />
          <Check
            label="Decontamination unit is operational"
            checked={!!form.asbDeconOperational}
            onChange={(v) => update("asbDeconOperational", v)}
            disabled={readOnly}
          />
          <p style={{ color: "#6B7280", fontSize: 12, marginTop: 8 }}>
            Asbestos-specific checks — shown because this project includes asbestos scope.
          </p>
        </section>
      ) : null}

      {hasCiv ? (
        <section className="field-card">
          <h3 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>Civil</h3>
          <Check
            label="Excavation permit sighted"
            checked={!!form.civExcavationPermit}
            onChange={(v) => update("civExcavationPermit", v)}
            disabled={readOnly}
          />
          <Check
            label="Underground services clearance obtained"
            checked={!!form.civUndergroundClearance}
            onChange={(v) => update("civUndergroundClearance", v)}
            disabled={readOnly}
          />
        </section>
      ) : null}

      <section className="field-card">
        <h3 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>Fit for work declaration</h3>
        <Check
          label="I declare I am fit for work today — not impaired by fatigue, illness, medication, or any other factor"
          checked={form.fitForWork}
          onChange={(v) => update("fitForWork", v)}
          disabled={readOnly}
        />
        <label className="field-label" style={{ marginTop: 8 }}>Any notes</label>
        <textarea
          className="field-input"
          rows={3}
          value={form.fitForWorkDeclaration ?? ""}
          onChange={(e) => update("fitForWorkDeclaration", e.target.value)}
          disabled={readOnly}
        />

        <label className="field-label" style={{ marginTop: 8 }}>Signature</label>
        <SignaturePad
          value={form.workerSignature}
          onChange={(value) => update("workerSignature", value)}
          disabled={readOnly}
        />
      </section>

      {error ? (
        <div className="field-card" role="alert" style={{ color: "#A32D2D" }}>
          {error}
        </div>
      ) : null}

      {!readOnly ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button
            type="button"
            className="field-btn field-btn--ghost"
            onClick={() => void saveDraft()}
            disabled={saving || submitting}
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            className="field-btn"
            onClick={() => void submit()}
            disabled={saving || submitting}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      ) : (
        <button type="button" className="field-btn field-btn--ghost" onClick={onCancel}>
          Back
        </button>
      )}

      <p style={{ color: "#6B7280", fontSize: 12, marginTop: 16 }}>
        This form template is standard across all disciplines. A configurable form builder is planned for a future release.
      </p>
    </div>
  );
}

function stripReadOnly(form: PreStartDetail) {
  return {
    supervisorName: form.supervisorName,
    siteHazardsAcknowledged: form.siteHazardsAcknowledged,
    hazardNotes: form.hazardNotes,
    ppeHelmet: form.ppeHelmet,
    ppeGloves: form.ppeGloves,
    ppeBoots: form.ppeBoots,
    ppeHighVis: form.ppeHighVis,
    ppeRespirator: form.ppeRespirator,
    ppeOther: form.ppeOther,
    plantChecksCompleted: form.plantChecksCompleted,
    plantCheckNotes: form.plantCheckNotes,
    fitForWork: form.fitForWork,
    fitForWorkDeclaration: form.fitForWorkDeclaration,
    workerSignature: form.workerSignature,
    asbEnclosureInspection: form.asbEnclosureInspection,
    asbAirMonitoring: form.asbAirMonitoring,
    asbDeconOperational: form.asbDeconOperational,
    civExcavationPermit: form.civExcavationPermit,
    civUndergroundClearance: form.civUndergroundClearance
  };
}

function Check({
  label,
  checked,
  onChange,
  disabled
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 0", minHeight: 44 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        style={{ width: 20, height: 20, marginTop: 2 }}
      />
      <span style={{ fontSize: 14 }}>{label}</span>
    </label>
  );
}

function SignaturePad({
  value,
  onChange,
  disabled
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [value]);

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = "#1F2937";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL("image/png"));
  }

  function clear() {
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
    onChange(null);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={320}
        height={120}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        style={{
          width: "100%",
          height: 120,
          border: "1px solid #CBD5E1",
          borderRadius: 8,
          background: "#fff",
          touchAction: "none"
        }}
      />
      {!disabled ? (
        <button type="button" className="field-btn field-btn--ghost" onClick={clear} style={{ marginTop: 6 }}>
          Clear signature
        </button>
      ) : null}
    </div>
  );
}
