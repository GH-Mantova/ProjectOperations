import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePortalAuth } from "../PortalAuthContext";

export function PortalAcceptInvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { acceptInvite } = usePortalAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const token = params.get("token") ?? "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
      setError("Password must be at least 8 characters and include lowercase, uppercase, and a number.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await acceptInvite(token, password);
      navigate("/portal");
    } catch (err) {
      setError((err as Error).message || "Could not accept invitation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #005B61 0%, #003d42 100%)",
        padding: 20
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: "#fff",
          padding: 32,
          borderRadius: 8,
          width: "min(420px, 100%)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
        }}
      >
        <h1 style={{ margin: "0 0 6px", fontSize: 22, color: "#005B61" }}>Welcome</h1>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "#666" }}>
          Set a password to activate your portal account.
        </p>

        {!token ? (
          <p style={{ color: "#b91c1c" }}>Missing invitation token.</p>
        ) : (
          <>
            <label style={{ display: "block", marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>New password</span>
              <input
                className="s7-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>

            <label style={{ display: "block", marginBottom: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Confirm password</span>
              <input
                className="s7-input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                style={{ width: "100%", marginTop: 4 }}
              />
            </label>

            {error ? (
              <p style={{ color: "#b91c1c", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "10px 16px",
                background: "#005B61",
                color: "#fff",
                border: 0,
                borderRadius: 4,
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting ? "wait" : "pointer"
              }}
            >
              {submitting ? "Creating account…" : "Activate account"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
