import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { useAuth } from "../auth/AuthContext";
import { isSsoEnabled, loginRequest } from "../auth/msal.config";
import { getMsalInstance } from "../auth/msalInstance";
import {
  ENTRA_PENDING_ACCESS_KEY,
  type PendingAccessRequest
} from "../auth/consumeSsoRedirect";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

function readPendingAccessRequest(): PendingAccessRequest | null {
  const raw = localStorage.getItem(ENTRA_PENDING_ACCESS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingAccessRequest>;
    if (typeof parsed.idToken === "string" && typeof parsed.email === "string") {
      return {
        email: parsed.email,
        displayName: typeof parsed.displayName === "string" ? parsed.displayName : null,
        idToken: parsed.idToken
      };
    }
  } catch {
    // fall through
  }
  return null;
}

export function LoginPage() {
  const { isAuthenticated, login, loginWithSso, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ssoSubmitting, setSsoSubmitting] = useState(false);
  const [resetMode, setResetMode] = useState<{ tempToken: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pendingAccess, setPendingAccess] = useState<PendingAccessRequest | null>(() =>
    readPendingAccessRequest()
  );

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (pendingAccess) {
    return (
      <RequestAccessScreen
        pending={pendingAccess}
        onCancel={() => {
          localStorage.removeItem(ENTRA_PENDING_ACCESS_KEY);
          setPendingAccess(null);
          // Also clear the MSAL account cache so the user can try a
          // different Microsoft account on "Back to sign in".
          const msal = getMsalInstance();
          if (msal) {
            void msal
              .initialize()
              .then(async () => {
                for (const account of msal.getAllAccounts()) {
                  try {
                    await msal.clearCache({ account });
                  } catch {
                    /* best-effort */
                  }
                }
              })
              .catch(() => {
                /* never let cancel throw */
              });
          }
        }}
      />
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await login(email, password);
      if (result.requiresPasswordReset && result.tempToken) {
        setResetMode({ tempToken: result.tempToken });
      }
    } catch (loginError) {
      setError((loginError as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(resetMode!.tempToken, newPassword);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (resetMode) {
    return (
      <div className="login-page">
        <div className="login-card" role="main">
          <div className="login-card__brand">
            <span className="login-card__logo" aria-hidden>PO</span>
            <div>
              <h1 className="login-card__title">Set a new password</h1>
              <p className="login-card__subtitle">Your account requires a password reset before you can continue.</p>
            </div>
          </div>
          {error ? (
            <div className="login-card__error" role="alert">{error}</div>
          ) : null}
          <form className="login-card__form" onSubmit={submitReset} noValidate>
            <label className="login-card__field">
              <span className="login-card__label">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                className="s7-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
            <label className="login-card__field">
              <span className="login-card__label">Confirm password</span>
              <input
                type="password"
                autoComplete="new-password"
                className="s7-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
            <button
              type="submit"
              className="s7-btn s7-btn--primary s7-btn--lg login-card__submit"
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Set password and sign in"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card" role="main">
        <div className="login-card__brand">
          <span className="login-card__logo" aria-hidden>PO</span>
          <div>
            <h1 className="login-card__title">Project Ops</h1>
            <p className="login-card__subtitle">Initial Services platform</p>
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

function SsoButton({ onError, onStart, onEnd, disabled, pending }: SsoButtonProps) {
  const { instance } = useMsal();

  const handleClick = async () => {
    onStart();
    onError(null);
    try {
      // Use redirect (not popup) — on Static Web Apps the popup→opener token
      // handoff hangs with BrowserAuthError: timed_out. The response is
      // consumed in main.tsx via consumeSsoRedirect() BEFORE React renders,
      // so the returning user lands authenticated. We don't call onEnd() here
      // because loginRedirect navigates away and never resolves on this page.
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      onError((err as Error).message || "Microsoft sign-in failed.");
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

type RequestAccessScreenProps = {
  pending: PendingAccessRequest;
  onCancel: () => void;
};

function RequestAccessScreen({ pending, onCancel }: RequestAccessScreenProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/request-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: pending.idToken, message: message.trim() || undefined })
      });
      if (!response.ok) {
        // Best-effort error — the record is what matters, we don't
        // want to leak the raw envelope shape to the user.
        setError("Could not submit your request. Please try again in a moment.");
        return;
      }
      setSubmitted(true);
      // Consume the pending idToken so a page reload doesn't replay this
      // screen — the user has already been notified.
      localStorage.removeItem(ENTRA_PENDING_ACCESS_KEY);
    } catch {
      setError("Could not submit your request. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = pending.displayName?.trim() || pending.email;

  return (
    <div className="login-page">
      <div className="login-card" role="main">
        <div className="login-card__brand">
          <span className="login-card__logo" aria-hidden>PO</span>
          <div>
            <h1 className="login-card__title">Request access</h1>
            <p className="login-card__subtitle">Not yet a registered Project Ops user.</p>
          </div>
        </div>

        {submitted ? (
          <>
            <p style={{ marginTop: 0 }}>
              Request sent — an admin will review it and set up your access. You'll be
              able to sign in with Microsoft once your account is approved.
            </p>
            <button
              type="button"
              className="s7-btn s7-btn--primary s7-btn--lg login-card__submit"
              onClick={onCancel}
            >
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>
              You're signed in with Microsoft as <strong>{displayName}</strong>, but you're
              not a registered Project Ops user. Send a request to the admin to set up
              your access.
            </p>
            {error ? (
              <div className="login-card__error" role="alert">{error}</div>
            ) : null}
            <form className="login-card__form" onSubmit={submit} noValidate>
              <label className="login-card__field">
                <span className="login-card__label">Message (optional)</span>
                <textarea
                  className="s7-input"
                  rows={4}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Anything the admin should know — team, project, expected role."
                  maxLength={2000}
                />
              </label>
              <button
                type="submit"
                className="s7-btn s7-btn--primary s7-btn--lg login-card__submit"
                disabled={submitting}
              >
                {submitting ? "Sending…" : "Send request to the admin"}
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--ghost login-card__submit"
                onClick={onCancel}
              >
                Back to sign in
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
