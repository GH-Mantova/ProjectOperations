import { useEffect, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

type UserRecord = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: Array<{ id: string; name: string }>;
};

export function UsersPage() {
  const { authFetch } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    roleIds: [] as string[]
  });

  const load = async () => {
    const [usersResponse, rolesResponse] = await Promise.all([
      authFetch("/users"),
      authFetch("/roles")
    ]);

    if (!usersResponse.ok || !rolesResponse.ok) {
      throw new Error("Unable to load user administration data.");
    }

    const usersData = await usersResponse.json();
    const rolesData = await rolesResponse.json();
    setUsers(usersData.items);
    setRoles(rolesData.items);
  };

  useEffect(() => {
    load().catch((loadError) => setError((loadError as Error).message));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await authFetch("/users", {
        method: "POST",
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        throw new Error("Unable to create user.");
      }

      setForm({
        email: "",
        firstName: "",
        lastName: "",
        password: "",
        roleIds: []
      });
      await load();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-grid">
      <AppCard title="Users" subtitle="Create, activate, and review application users.">
        {error ? <p className="error-text">{error}</p> : null}
        <div className="module-summary-grid">
          <div className="module-summary-card">
            <strong>{users.length}</strong>
            <span>Total users</span>
          </div>
          <div className="module-summary-card">
            <strong>{users.filter((user) => user.isActive).length}</strong>
            <span>Active users</span>
          </div>
          <div className="module-summary-card">
            <strong>{roles.length}</strong>
            <span>Available roles</span>
          </div>
        </div>
        <div className="table-shell table-shell--capped">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Roles</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.firstName} {user.lastName}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={user.isActive ? "pill pill--green" : "pill pill--amber"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{user.roles.map((role) => role.name).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!users.length ? <p className="module-empty-state">No users have been created yet.</p> : null}
        </div>
      </AppCard>

      <AppCard title="Add User" subtitle="Seed-ready admin workflow for the local auth phase.">
        <form className="admin-form" onSubmit={submit}>
          <label>
            Email
            <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          <label>
            First name
            <input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} />
          </label>
          <label>
            Last name
            <input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          <label>
            Role
            <select
              value={form.roleIds[0] ?? ""}
              onChange={(event) => setForm({ ...form, roleIds: event.target.value ? [event.target.value] : [] })}
            >
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Create User"}
          </button>
        </form>
      </AppCard>
    </div>
  );
}
