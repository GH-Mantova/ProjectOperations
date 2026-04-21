import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type TimesheetRow = {
  id: string;
  date: string;
  hoursWorked: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  projectNumber: string;
  projectName: string;
  rejectedReason?: string | null;
  rejectedAt?: string | null;
};

type Allocation = {
  id: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
};

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: "#E2E8F0", fg: "#1F2937", label: "Draft" },
  RETURNED: { bg: "#FEAA6D", fg: "#1F2937", label: "Returned" },
  SUBMITTED: { bg: "color-mix(in srgb, #005B61 15%, transparent)", fg: "#005B61", label: "Submitted" },
  APPROVED: { bg: "#DCFCE7", fg: "#166534", label: "Approved" }
};

function pillFor(row: Pick<TimesheetRow, "status" | "rejectedReason">) {
  if (row.status === "DRAFT" && row.rejectedReason) return STATUS_PILL.RETURNED;
  return STATUS_PILL[row.status];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function FieldTimesheetPage() {
  const { authFetch } = useAuth();
  const [params] = useSearchParams();
  const preselect = params.get("allocationId");
  const [view, setView] = useState<"list" | "new" | "edit">(preselect ? "new" : "list");
  const [editId, setEditId] = useState<string | null>(null);
  const [rows, setRows] = useState<TimesheetRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      const response = await authFetch("/field/timesheets?limit=50");
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

  if (success) {
    return (
      <div className="field-card" style={{ textAlign: "center" }}>
        <h2 style={{ fontFamily: "Syne, Outfit, sans-serif" }}>✅ Submitted</h2>
        <p style={{ color: "#374151" }}>{success}</p>
        <button
          type="button"
          className="field-btn"
          onClick={() => {
            setSuccess(null);
            setView("list");
          }}
        >
          Back to timesheets
        </button>
      </div>
    );
  }

  if (view === "new") {
    return (
      <NewTimesheet
        preselectAllocationId={preselect}
        onCancel={() => setView("list")}
        onSubmitted={(msg) => setSuccess(msg)}
      />
    );
  }

  if (view === "edit" && editId) {
    return (
      <EditTimesheet
        timesheetId={editId}
        onCancel={() => {
          setEditId(null);
          setView("list");
        }}
        onSubmitted={(msg) => {
          setEditId(null);
          setSuccess(msg);
        }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontFamily: "Syne, Outfit, sans-serif" }}>Timesheets</h2>
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
          <EmptyState heading="No timesheets yet" subtext="Log the hours you worked at the end of the day." />
        </div>
      ) : (
        rows.map((r) => {
          const pill = pillFor(r);
          const editable = r.status === "DRAFT";
          const card = (
            <>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{r.projectNumber}</strong>
                <span className="field-pill" style={{ background: pill.bg, color: pill.fg }}>
                  {pill.label}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#374151", marginTop: 4 }}>{r.projectName}</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                {formatDate(r.date)} · {r.hoursWorked} hours
              </div>
              {r.status === "DRAFT" && r.rejectedReason ? (
                <div style={{ fontSize: 12, color: "#B45309", marginTop: 6 }}>
                  Returned: {r.rejectedReason}
                </div>
              ) : null}
            </>
          );
          return editable ? (
            <button
              key={r.id}
              type="button"
              className="field-card"
              onClick={() => {
                setEditId(r.id);
                setView("edit");
              }}
              style={{ width: "100%", textAlign: "left", border: "none", cursor: "pointer" }}
            >
              {card}
            </button>
          ) : (
            <div key={r.id} className="field-card">
              {card}
            </div>
          );
        })
      )}

      <p style={{ color: "#6B7280", fontSize: 12, marginTop: 16 }}>
        <Link to="/field/allocations" style={{ color: "#005B61" }}>← My jobs</Link>
      </p>
    </div>
  );
}

function NewTimesheet({
  preselectAllocationId,
  onCancel,
  onSubmitted
}: {
  preselectAllocationId: string | null;
  onCancel: () => void;
  onSubmitted: (message: string) => void;
}) {
  const { authFetch } = useAuth();
  const [allocations, setAllocations] = useState<Allocation[] | null>(null);
  const [allocationId, setAllocationId] = useState<string>(preselectAllocationId ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hoursWorked, setHoursWorked] = useState<string>("8");
  const [breakMinutes, setBreakMinutes] = useState<string>("30");
  const [description, setDescription] = useState("");
  const [clockOn, setClockOn] = useState("");
  const [clockOff, setClockOff] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!allocationId) {
      setError("Please select a job.");
      return;
    }
    const hours = Number(hoursWorked);
    if (!Number.isFinite(hours) || hours < 0.5 || hours > 24) {
      setError("Hours worked must be between 0.5 and 24.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setDuplicate(false);
    try {
      const allocation = (allocations ?? []).find((a) => a.id === allocationId);
      const clockOnIso = clockOn ? `${date}T${clockOn}:00` : undefined;
      const clockOffIso = clockOff ? `${date}T${clockOff}:00` : undefined;
      const createResponse = await authFetch("/field/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocationId,
          date,
          hoursWorked: hours,
          breakMinutes: Number(breakMinutes),
          description: description.trim() || undefined,
          clockOnTime: clockOnIso,
          clockOffTime: clockOffIso
        })
      });
      if (createResponse.status === 409) {
        setDuplicate(true);
        setError("You already have a timesheet for this job today.");
        return;
      }
      if (!createResponse.ok) throw new Error(await createResponse.text());
      const timesheet = await createResponse.json();
      const submitResponse = await authFetch(`/field/timesheets/${timesheet.id}/submit`, { method: "POST" });
      if (!submitResponse.ok) throw new Error(await submitResponse.text());
      onSubmitted(`Timesheet submitted — ${hours} hours on ${allocation?.projectName ?? "your job"} for ${formatDate(date)}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="field-card">
      <h2 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>New timesheet</h2>
      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <label className="field-label">Job</label>
        <select className="field-input" value={allocationId} onChange={(e) => setAllocationId(e.target.value)} required>
          <option value="">Select a job…</option>
          {(allocations ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.projectNumber} — {a.projectName}
            </option>
          ))}
        </select>

        <label className="field-label" style={{ marginTop: 12 }}>Date</label>
        <input type="date" className="field-input" value={date} onChange={(e) => setDate(e.target.value)} required />

        <label className="field-label" style={{ marginTop: 12 }}>Hours worked</label>
        <input
          type="number"
          className="field-input"
          step={0.5}
          min={0.5}
          max={24}
          value={hoursWorked}
          onChange={(e) => setHoursWorked(e.target.value)}
          required
        />

        <label className="field-label" style={{ marginTop: 12 }}>Break</label>
        <select className="field-input" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)}>
          <option value="0">None</option>
          <option value="15">15 min</option>
          <option value="30">30 min</option>
          <option value="45">45 min</option>
          <option value="60">60 min</option>
        </select>

        <label className="field-label" style={{ marginTop: 12 }}>What did you work on today?</label>
        <textarea
          className="field-input"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          <div>
            <label className="field-label">Clock on</label>
            <input type="time" className="field-input" value={clockOn} onChange={(e) => setClockOn(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Clock off</label>
            <input type="time" className="field-input" value={clockOff} onChange={(e) => setClockOff(e.target.value)} />
          </div>
        </div>
        <p style={{ color: "#6B7280", fontSize: 12, marginTop: 6 }}>
          Clock on/off with GPS verification coming in a future update.
        </p>

        {error ? (
          <div style={{ background: "#FCEBEB", color: "#A32D2D", padding: 10, borderRadius: 6, marginTop: 12, fontSize: 13 }}>
            {error}
            {duplicate ? (
              <>
                {" "}
                <Link to="/field/timesheet" style={{ color: "#A32D2D", textDecoration: "underline" }}>
                  Open the existing one
                </Link>
              </>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
          <button type="button" className="field-btn field-btn--ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="field-btn" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}

type TimesheetDetail = {
  id: string;
  projectId: string;
  workerProfileId: string;
  allocationId: string;
  date: string;
  hoursWorked: string;
  breakMinutes: number;
  description: string | null;
  clockOnTime: string | null;
  clockOffTime: string | null;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  rejectedReason: string | null;
  rejectedAt: string | null;
  project?: { id: string; projectNumber: string; name: string };
};

function EditTimesheet({
  timesheetId,
  onCancel,
  onSubmitted
}: {
  timesheetId: string;
  onCancel: () => void;
  onSubmitted: (message: string) => void;
}) {
  const { authFetch } = useAuth();
  const [allocations, setAllocations] = useState<Allocation[] | null>(null);
  const [timesheet, setTimesheet] = useState<TimesheetDetail | null>(null);
  const [hoursWorked, setHoursWorked] = useState("8");
  const [breakMinutes, setBreakMinutes] = useState("30");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tsRes, allocRes, listRes] = await Promise.all([
          authFetch("/field/timesheets?limit=100"),
          authFetch("/field/my-allocations"),
          authFetch("/field/my-allocations")
        ]);
        if (!tsRes.ok) throw new Error(await tsRes.text());
        const tsBody = (await tsRes.json()) as { items: Array<TimesheetRow & { allocationId?: string }> };
        const row = tsBody.items.find((t) => t.id === timesheetId);
        const listBody = (await listRes.json()) as Allocation[];
        if (allocRes.ok && !cancelled) setAllocations(listBody);
        if (row && !cancelled) {
          const detail: TimesheetDetail = {
            id: row.id,
            projectId: "",
            workerProfileId: "",
            allocationId: (row as unknown as { allocationId: string }).allocationId ?? "",
            date: row.date,
            hoursWorked: row.hoursWorked,
            breakMinutes: 0,
            description: null,
            clockOnTime: null,
            clockOffTime: null,
            status: row.status,
            rejectedReason: row.rejectedReason ?? null,
            rejectedAt: row.rejectedAt ?? null
          };
          setTimesheet(detail);
          setHoursWorked(detail.hoursWorked);
          setBreakMinutes(String(detail.breakMinutes));
          setDescription(detail.description ?? "");
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, timesheetId]);

  const projectName =
    allocations?.find((a) => a.id === timesheet?.allocationId)?.projectName ?? "";

  async function patch() {
    setSaving(true);
    setError(null);
    try {
      const response = await authFetch(`/field/timesheets/${timesheetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hoursWorked: Number(hoursWorked),
          breakMinutes: Number(breakMinutes),
          description: description.trim() || undefined
        })
      });
      if (!response.ok) throw new Error(await response.text());
    } catch (err) {
      setError((err as Error).message);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    try {
      await patch();
      onSubmitted("Draft saved");
    } catch {
      // error already set
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await patch();
      const response = await authFetch(`/field/timesheets/${timesheetId}/submit`, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      onSubmitted(`Timesheet submitted — ${hoursWorked} hours on ${projectName || "your job"}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!timesheet) {
    return (
      <div className="field-card">
        <Skeleton width="100%" height={180} />
      </div>
    );
  }

  return (
    <div className="field-card">
      <h2 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>Edit timesheet</h2>
      <p style={{ margin: "6px 0", color: "#6B7280", fontSize: 13 }}>
        {projectName} · {formatDate(timesheet.date)}
      </p>

      {timesheet.rejectedReason ? (
        <div
          role="alert"
          style={{
            background: "#FAEEDA",
            color: "#854F0B",
            padding: "10px 12px",
            borderRadius: 8,
            margin: "12px 0",
            fontSize: 13
          }}
        >
          <strong>Returned{timesheet.rejectedAt ? ` on ${formatDate(timesheet.rejectedAt)}` : ""}.</strong>{" "}
          Reason: {timesheet.rejectedReason}
        </div>
      ) : null}

      <label className="field-label" style={{ marginTop: 12 }}>Hours worked</label>
      <input
        type="number"
        className="field-input"
        step={0.5}
        min={0.5}
        max={24}
        value={hoursWorked}
        onChange={(e) => setHoursWorked(e.target.value)}
        required
      />

      <label className="field-label" style={{ marginTop: 12 }}>Break</label>
      <select className="field-input" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)}>
        <option value="0">None</option>
        <option value="15">15 min</option>
        <option value="30">30 min</option>
        <option value="45">45 min</option>
        <option value="60">60 min</option>
      </select>

      <label className="field-label" style={{ marginTop: 12 }}>What did you work on?</label>
      <textarea
        className="field-input"
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      {error ? (
        <div style={{ background: "#FCEBEB", color: "#A32D2D", padding: 10, borderRadius: 6, marginTop: 12, fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
        <button type="button" className="field-btn field-btn--ghost" onClick={onCancel} disabled={saving || submitting}>
          Cancel
        </button>
        <button type="button" className="field-btn field-btn--ghost" onClick={() => void saveDraft()} disabled={saving || submitting}>
          {saving ? "Saving…" : "Save draft"}
        </button>
        <button type="button" className="field-btn" onClick={() => void submit()} disabled={saving || submitting}>
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
