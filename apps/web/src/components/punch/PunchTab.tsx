import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type PunchStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";

type UserRef = { id: string; firstName: string; lastName: string } | null;

export type PunchItem = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  status: PunchStatus;
  dueAt?: string | null;
  closedAt?: string | null;
  photoUrl?: string | null;
  raisedBy: UserRef;
  assignedTo: UserRef;
  closedBy: UserRef;
  createdAt: string;
};

const STATUS_CLASS: Record<PunchStatus, string> = {
  OPEN: "s7-badge s7-badge--warning",
  IN_PROGRESS: "s7-badge s7-badge--active",
  CLOSED: "s7-badge s7-badge--neutral"
};

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function nameOf(u: UserRef): string {
  return u ? `${u.firstName} ${u.lastName}` : "—";
}

function isOverdue(item: PunchItem): boolean {
  if (item.status === "CLOSED" || !item.dueAt) return false;
  return new Date(item.dueAt).getTime() < Date.now();
}

type Props = { jobId: string };

export function PunchTab({ jobId }: Props) {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<PunchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/jobs/${jobId}/punch-items`);
      if (!res.ok) throw new Error("Could not load punch items.");
      const data = (await res.json()) as { items: PunchItem[] };
      setItems(data.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, jobId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setDueAt("");
    setPhotoUrl("");
    setShowForm(false);
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const res = await authFetch(`/jobs/${jobId}/punch-items`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          dueAt: dueAt || undefined,
          photoUrl: photoUrl.trim() || undefined
        })
      });
      if (!res.ok) throw new Error("Could not create punch item.");
      resetForm();
      await reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const transition = async (id: string, next: PunchStatus) => {
    setBusyId(id);
    try {
      const res = await authFetch(`/punch-items/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next })
      });
      if (!res.ok) throw new Error("Could not update punch item.");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const closeItem = async (id: string) => {
    const note = window.prompt("Closure note (optional):", "") ?? undefined;
    setBusyId(id);
    try {
      const res = await authFetch(`/punch-items/${id}/close`, {
        method: "POST",
        body: JSON.stringify({ closureNote: note })
      });
      if (!res.ok) throw new Error("Could not close punch item.");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const openCount = items.filter((i) => i.status !== "CLOSED").length;
  const overdueCount = items.filter(isOverdue).length;

  return (
    <section className="s7-card">
      <header className="job-list__head" style={{ justifyContent: "space-between" }}>
        <div>
          <strong>Punch / snag list</strong>
          <span className="job-list__meta" style={{ marginLeft: 12 }}>
            {openCount} open · {overdueCount} overdue · {items.length} total
          </span>
        </div>
        <button
          type="button"
          className="s7-btn s7-btn--primary s7-btn--sm"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancel" : "+ Add item"}
        </button>
      </header>

      {error ? <div className="tender-page__error" role="alert">{error}</div> : null}

      {showForm ? (
        <form onSubmit={submitNew} className="s7-form" style={{ marginTop: 16 }}>
          <label className="s7-field">
            <span>Title *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="s7-field">
            <span>Location</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Level 2, north stairwell" />
          </label>
          <label className="s7-field">
            <span>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </label>
          <label className="s7-field">
            <span>Due date</span>
            <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </label>
          <label className="s7-field">
            <span>Photo URL</span>
            <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="submit" className="s7-btn s7-btn--primary">Save</button>
            <button type="button" className="s7-btn s7-btn--secondary" onClick={resetForm}>Cancel</button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p style={{ marginTop: 16 }}>Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState
          heading="No punch items"
          subtext="Handover / defect items raised on this job will appear here with photo, assignee, and due date."
        />
      ) : (
        <ul className="job-list" style={{ marginTop: 16 }}>
          {items.map((item) => {
            const overdue = isOverdue(item);
            return (
              <li key={item.id} className="job-list__item">
                <div className="job-list__head">
                  <strong>{item.title}</strong>
                  <span className={STATUS_CLASS[item.status]}>{item.status}</span>
                  {overdue ? <span className="s7-badge s7-badge--danger">Overdue</span> : null}
                </div>
                {item.description ? <p className="job-list__body">{item.description}</p> : null}
                <span className="job-list__meta">
                  {item.location ? `${item.location} · ` : ""}
                  Raised {formatDate(item.createdAt)} by {nameOf(item.raisedBy)}
                  {item.assignedTo ? ` · assigned ${nameOf(item.assignedTo)}` : ""}
                  {item.dueAt ? ` · due ${formatDate(item.dueAt)}` : ""}
                  {item.closedAt ? ` · closed ${formatDate(item.closedAt)} by ${nameOf(item.closedBy)}` : ""}
                </span>
                {item.photoUrl ? (
                  <a href={item.photoUrl} target="_blank" rel="noreferrer" className="job-list__meta">
                    View photo →
                  </a>
                ) : null}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {item.status === "OPEN" ? (
                    <button
                      type="button"
                      className="s7-btn s7-btn--secondary s7-btn--sm"
                      onClick={() => transition(item.id, "IN_PROGRESS")}
                      disabled={busyId === item.id}
                    >
                      Start
                    </button>
                  ) : null}
                  {item.status !== "CLOSED" ? (
                    <button
                      type="button"
                      className="s7-btn s7-btn--primary s7-btn--sm"
                      onClick={() => closeItem(item.id)}
                      disabled={busyId === item.id}
                    >
                      Close
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="s7-btn s7-btn--secondary s7-btn--sm"
                      onClick={() => transition(item.id, "OPEN")}
                      disabled={busyId === item.id}
                    >
                      Reopen
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
