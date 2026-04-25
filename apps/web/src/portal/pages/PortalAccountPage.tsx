import { useEffect, useState } from "react";
import { usePortalAuth } from "../PortalAuthContext";

type Account = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  lastLoginAt: string | null;
  client: { id: string; name: string; code: string | null; email: string | null; phone: string | null };
};

export function PortalAccountPage() {
  const { authFetch } = usePortalAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authFetch("/portal/client/account")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(setAccount)
      .catch((err) => setError((err as Error).message));
  }, [authFetch]);

  return (
    <div>
      <h1 style={{ margin: "0 0 18px", fontSize: 22 }}>Account</h1>
      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}
      {!account && !error ? <p style={{ color: "#999" }}>Loading…</p> : null}

      {account ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <Card title="Your details">
            <Field label="Name" value={`${account.firstName} ${account.lastName}`} />
            <Field label="Email" value={account.email} />
            <Field label="Phone" value={account.phone ?? "—"} />
            <Field
              label="Last sign-in"
              value={account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : "—"}
            />
          </Card>
          <Card title="Organisation">
            <Field label="Client" value={account.client.name} />
            <Field label="Code" value={account.client.code ?? "—"} />
            <Field label="Email" value={account.client.email ?? "—"} />
            <Field label="Phone" value={account.client.phone ?? "—"} />
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 6,
        padding: 18
      }}
    >
      <div style={{ fontSize: 12, textTransform: "uppercase", color: "#888", letterSpacing: 0.5, marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#888" }}>{label}</div>
      <div style={{ fontSize: 14, color: "#242424", marginTop: 2 }}>{value}</div>
    </div>
  );
}
