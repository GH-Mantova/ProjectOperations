import { useEffect, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

type Permission = { id: string; code: string; description: string };
type Role = { id: string; name: string; description?: string; permissions: Permission[] };

export function RolesPage() {
  const { authFetch } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [form, setForm] = useState({ name: "", description: "", permissionIds: [] as string[] });
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [rolesResponse, permissionsResponse] = await Promise.all([
      authFetch("/roles"),
      authFetch("/permissions")
    ]);

    if (!rolesResponse.ok || !permissionsResponse.ok) {
      throw new Error("Unable to load roles.");
    }

    const rolesData = await rolesResponse.json();
    const permissionsData = await permissionsResponse.json();

    setRoles(rolesData.items);
    setPermissions(permissionsData);
  };

  useEffect(() => {
    load().catch((loadError) => setError((loadError as Error).message));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const response = await authFetch("/roles", {
      method: "POST",
      body: JSON.stringify(form)
    });

    if (!response.ok) {
      setError("Unable to create role.");
      return;
    }

    setForm({ name: "", description: "", permissionIds: [] });
    await load();
  };

  const updatePermissionSelection = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedPermissionIds = Array.from(event.target.selectedOptions).map((option) => option.value);

    setForm({
      ...form,
      permissionIds: selectedPermissionIds
    });
  };

  return (
    <div className="admin-grid">
      <AppCard title="Roles" subtitle="Manage reusable permission bundles.">
        {error ? <p className="error-text">{error}</p> : null}
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Description</th>
                <th>Permissions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td>{role.name}</td>
                  <td>{role.description}</td>
                  <td>{role.permissions.map((permission) => permission.code).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppCard>

      <AppCard title="Create Role" subtitle="Assign platform permissions to a named role.">
        <form className="admin-form" onSubmit={submit}>
          <label>
            Name
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label>
            Description
            <input
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>
          <label>
            Permissions
            <select
              multiple
              value={form.permissionIds}
              onChange={updatePermissionSelection}
            >
              {permissions.map((permission) => (
                <option key={permission.id} value={permission.id}>
                  {permission.code}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Create Role</button>
        </form>
      </AppCard>
    </div>
  );
}
