import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState("admin@projectops.local");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login(email, password);
    } catch (loginError) {
      setError((loginError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-panel">
        <div>
          <p className="eyebrow">Project Operations Platform</p>
          <h1>Sign in</h1>
          <p>
            Local authentication is active for the foundation and administration modules. Microsoft
            365 SSO remains a later extension point.
          </p>
        </div>

        <form className="login-form" onSubmit={submit}>
          {error ? <p className="error-text">{error}</p> : null}
          <label>
            Email
            <input type="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            Password
            <input type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Login"}
          </button>
        </form>
      </section>
    </div>
  );
}
