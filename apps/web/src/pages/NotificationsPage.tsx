import { useEffect, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  severity: string;
  status: string;
  linkUrl?: string | null;
};

export function NotificationsPage() {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);

  const load = async () => {
    const response = await authFetch("/notifications/me");

    if (!response.ok) {
      setItems([]);
      return;
    }

    setItems(await response.json());
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string) => {
    await authFetch(`/notifications/${id}/read`, {
      method: "PATCH"
    });
    await load();
  };

  return (
    <AppCard title="Notifications" subtitle="Shared notification foundation for later operational modules">
      <div className="table-shell">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Body</th>
              <th>Severity</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} onClick={() => markRead(item.id)}>
                <td>{item.title}</td>
                <td>{item.body}</td>
                <td>{item.severity}</td>
                <td>
                  <span className={item.status === "READ" ? "pill pill--green" : "pill pill--amber"}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppCard>
  );
}
