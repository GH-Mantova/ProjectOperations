import { useEffect, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

type Permission = {
  id: string;
  code: string;
  module: string;
  description: string;
};

export function PermissionsPage() {
  const { authFetch } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);

  useEffect(() => {
    authFetch("/permissions")
      .then((response) => response.json())
      .then(setPermissions)
      .catch(() => setPermissions([]));
  }, []);

  return (
    <AppCard title="Permission Registry" subtitle="Application actions available for role assignment.">
      <div className="table-shell">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Module</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.id}>
                <td>{permission.code}</td>
                <td>{permission.module}</td>
                <td>{permission.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppCard>
  );
}
