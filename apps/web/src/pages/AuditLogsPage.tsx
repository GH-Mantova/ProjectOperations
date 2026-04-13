import { useEffect, useState } from "react";
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

  return (
    <AppCard title="Audit Logs" subtitle="Trace authentication and admin write activity.">
      <div className="table-shell">
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
                <td>{item.entityType}{item.entityId ? ` (${item.entityId})` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppCard>
  );
}
