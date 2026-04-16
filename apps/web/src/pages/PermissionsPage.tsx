import { useEffect, useMemo, useState } from "react";
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

  const summary = useMemo(() => {
    const modules = new Set(permissions.map((permission) => permission.module));
    return {
      total: permissions.length,
      modules: modules.size,
      longestCode: permissions.reduce((max, permission) => Math.max(max, permission.code.length), 0)
    };
  }, [permissions]);

  return (
    <div className="crm-page crm-page--operations">
      <div className="crm-page__sidebar">
        <AppCard title="Permission pulse" subtitle="System capability inventory for role design and review">
          <div className="module-summary-grid">
            <div className="module-summary-card">
              <strong>{summary.total}</strong>
              <span>Total permission codes</span>
            </div>
            <div className="module-summary-card">
              <strong>{summary.modules}</strong>
              <span>Covered modules</span>
            </div>
            <div className="module-summary-card">
              <strong>{summary.longestCode}</strong>
              <span>Longest code length</span>
            </div>
          </div>
        </AppCard>
      </div>

      <div className="crm-page__main">
        <AppCard title="Permission Registry" subtitle="Application actions available for role assignment">
          <div className="module-table-intro">
            <p className="muted-text">
              This registry is meant to scan quickly. It keeps the permission system transparent without making admins jump between multiple screens.
            </p>
            <div className="table-shell table-shell--capped">
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
              {!permissions.length ? <p className="module-empty-state">No permissions are registered yet.</p> : null}
            </div>
          </div>
        </AppCard>
      </div>
    </div>
  );
}
