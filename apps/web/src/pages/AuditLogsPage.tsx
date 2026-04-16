import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
  actor?: { email: string; firstName: string; lastName: string } | null;
};

export function AuditLogsPage() {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<AuditLog[]>([]);

  useEffect(() => {
    authFetch("/audit-logs")
      .then((response) => response.json())
      .then((data) => setItems(data.items))
      .catch(() => setItems([]));
  }, []);

  const summary = useMemo(() => {
    const today = new Date().toDateString();
    return {
      total: items.length,
      today: items.filter((item) => new Date(item.createdAt).toDateString() === today).length,
      actorEntries: items.filter((item) => item.actor).length
    };
  }, [items]);

  return (
    <div className="crm-page crm-page--operations">
      <div className="crm-page__sidebar">
        <AppCard title="Audit pulse" subtitle="Administrative and security write history at a glance">
          <div className="module-summary-grid">
            <div className="module-summary-card">
              <strong>{summary.total}</strong>
              <span>Total audit entries</span>
            </div>
            <div className="module-summary-card">
              <strong>{summary.today}</strong>
              <span>Recorded today</span>
            </div>
            <div className="module-summary-card">
              <strong>{summary.actorEntries}</strong>
              <span>User-attributed entries</span>
            </div>
          </div>
        </AppCard>
      </div>

      <div className="crm-page__main">
        <AppCard title="Audit Logs" subtitle="Trace authentication, admin changes, and operational write activity">
          <div className="module-table-intro">
            <p className="muted-text">
              This register stays intentionally dense so support and admin users can scan change history quickly without dead space or nested drill-ins.
            </p>
            <div className="table-shell table-shell--capped">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{new Date(item.createdAt).toLocaleString()}</td>
                      <td>{item.actor ? `${item.actor.firstName} ${item.actor.lastName}` : "System"}</td>
                      <td>{item.action}</td>
                      <td>
                        {item.entityType}
                        {item.entityId ? ` (${item.entityId})` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!items.length ? <p className="module-empty-state">No audit entries have been recorded yet.</p> : null}
            </div>
          </div>
        </AppCard>
      </div>
    </div>
  );
}
