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
};

type Allocation = {
  id: string;
  projectId: string;
  projectNumber: string;
  projectName: string;
};

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: "#FEEDD7", fg: "#B45309", label: "Draft" },
  SUBMITTED: { bg: "color-mix(in srgb, #005B61 15%, transparent)", fg: "#005B61", label: "Submitted" },
  APPROVED: { bg: "#DCFCE7", fg: "#166534", label: "Approved" }
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function FieldTimesheetPage() {
  const { authFetch } = useAuth();
  const [params] = useSearchParams();
  const preselect = params.get("allocationId");
  const [view, setView] = useState<"list" | "new">(preselect ? "new" : "list");
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
          const pill = STATUS_PILL[r.status];
          return (
            <div key={r.id} className="field-card">
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
