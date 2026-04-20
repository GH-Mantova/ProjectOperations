import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { useAuth } from "../auth/AuthContext";
import { isSsoEnabled, loginRequest } from "../auth/msal.config";

export function LoginPage() {
  const { isAuthenticated, login, loginWithSso } = useAuth();
  const [email, setEmail] = useState("admin@projectops.local");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ssoSubmitting, setSsoSubmitting] = useState(false);

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
            365 SSO is available when <code>VITE_SSO_ENABLED=true</code> and Entra credentials are configured.
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
          <button type="submit" disabled={submitting || ssoSubmitting}>
            {submitting ? "Signing in..." : "Login"}
          </button>
        </form>

        {isSsoEnabled ? (
          <SsoButton
            onError={setError}
            onStart={() => setSsoSubmitting(true)}
            onEnd={() => setSsoSubmitting(false)}
            onSuccess={loginWithSso}
            disabled={submitting || ssoSubmitting}
            pending={ssoSubmitting}
          />
        ) : null}
      </section>
    </div>
  );
}

type SsoButtonProps = {
  onError: (message: string) => void;
  onStart: () => void;
  onEnd: () => void;
  onSuccess: (idToken: string) => Promise<void>;
  disabled: boolean;
  pending: boolean;
};

function SsoButton({ onError, onStart, onEnd, onSuccess, disabled, pending }: SsoButtonProps) {
  const { instance } = useMsal();

  const handleClick = async () => {
    onStart();
    onError("");
    try {
      const result = await instance.loginPopup(loginRequest);
      if (!result.idToken) {
        throw new Error("Microsoft login did not return an ID token.");
      }
      await onSuccess(result.idToken);
    } catch (err) {
      onError((err as Error).message || "Microsoft sign-in failed.");
    } finally {
      onEnd();
    }
  };

  return (
    <button
      type="button"
      className="login-form__sso"
      onClick={handleClick}
      disabled={disabled}
      style={{
        marginTop: 12,
        minHeight: 44,
        padding: "10px 16px",
        border: "1px solid var(--surface-border, #d1d5db)",
        borderRadius: 8,
        background: "var(--surface-card, #ffffff)",
        color: "var(--text-primary, #111827)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 500
      }}
    >
      {pending ? "Connecting to Microsoft..." : "Sign in with Microsoft"}
    </button>
  );
}
