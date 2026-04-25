import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { usePortalAuth } from "../PortalAuthContext";

export function PortalLoginPage() {
  const { login } = usePortalAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/portal");
    } catch (err) {
      setError((err as Error).message || "Sign-in failed");
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
        <h1 style={{ margin: "0 0 6px", fontSize: 22, color: "#005B61" }}>Initial Services</h1>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "#666" }}>Client portal sign-in</p>

        <label style={{ display: "block", marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Email</span>
          <input
            className="s7-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", marginTop: 4 }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 18 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Password</span>
          <input
            className="s7-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
