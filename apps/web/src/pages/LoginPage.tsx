import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { useAuth } from "../auth/AuthContext";
import { isSsoEnabled, loginRequest } from "../auth/msal.config";

export function LoginPage() {
  const { isAuthenticated, login, loginWithSso } = useAuth();
  const [email, setEmail] = useState("admin@projectops.local");
  const [password, setPassword] = useState("Password123!");
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="login-card" role="main">
        <div className="login-card__brand">
          <span className="login-card__logo" aria-hidden>PO</span>
          <div>
            <h1 className="login-card__title">Project Ops</h1>
            <p className="login-card__subtitle">Mantova Civil Works platform</p>
          </div>
        </div>

        {error ? (
          <div className="login-card__error" role="alert">
            {error}
          </div>
        ) : null}

        <form className="login-card__form" onSubmit={submit} noValidate>
          <label className="login-card__field">
            <span className="login-card__label">Email</span>
            <input
              type="email"
              autoComplete="username"
              className="s7-input"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="login-card__field">
            <span className="login-card__label">Password</span>
            <div className="login-card__password">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="s7-input login-card__password-input"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="login-card__password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.7 21.7 0 0 1 5.06-6M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.7 21.7 0 0 1-3.22 4.24M1 1l22 22" />
                    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          <button
            type="submit"
            className="s7-btn s7-btn--primary s7-btn--lg login-card__submit"
            disabled={submitting || ssoSubmitting}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {isSsoEnabled ? (
          <>
            <div className="login-card__divider" aria-hidden>
              <span>or</span>
            </div>
            <SsoButton
              onError={setError}
              onStart={() => setSsoSubmitting(true)}
              onEnd={() => setSsoSubmitting(false)}
              onSuccess={loginWithSso}
              disabled={submitting || ssoSubmitting}
              pending={ssoSubmitting}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

type SsoButtonProps = {
  onError: (message: string | null) => void;
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
    onError(null);
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
      className="login-card__sso"
      onClick={handleClick}
      disabled={disabled}
      aria-label="Sign in with Microsoft"
    >
      <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden>
        <rect x="1" y="1" width="10" height="10" fill="#F25022" />
        <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
        <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
        <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
      </svg>
      <span>{pending ? "Connecting to Microsoft..." : "Sign in with Microsoft"}</span>
    </button>
  );
}
