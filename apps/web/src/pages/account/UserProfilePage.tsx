import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { isAdminUser } from "../../auth/permissions";
import { DefaultDashboardSection } from "./DefaultDashboardSection";
import { GlobalListsSection } from "./GlobalListsSection";

// §5A.1 PR 8 (PR #132): the legacy "My AI providers" section was removed
// here. Personal AI keys / provider preferences now live on the AI Settings
// page (/admin/ai-settings) under per-persona override controls.
export function UserProfilePage() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  return (
    <div style={{ padding: "24px", maxWidth: 980 }}>
      <h1 className="s7-type-page-heading" style={{ marginTop: 0 }}>My account</h1>
      {user ? (
        <p style={{ color: "var(--text-muted)" }}>
          Signed in as <strong>{user.firstName} {user.lastName}</strong> · {user.email}
        </p>
      ) : null}

      <DefaultDashboardSection />

      <GlobalListsSection isAdmin={isAdmin} />

      <section className="s7-card" style={{ marginTop: 24 }}>
        <h2 className="s7-type-section-heading" style={{ marginTop: 0, marginBottom: 4 }}>
          Calendar sync
        </h2>
        <p style={{ color: "var(--text-muted)", marginTop: 0, fontSize: 13 }}>
          Connect a personal Google or Outlook calendar so your assigned shifts appear alongside
          the rest of your schedule.
        </p>
        <Link to="/account/calendar-sync" className="s7-btn s7-btn--secondary s7-btn--sm">
          Open calendar sync
        </Link>
      </section>

      <section className="s7-card" style={{ marginTop: 24 }}>
        <h2 className="s7-type-section-heading" style={{ marginTop: 0, marginBottom: 4 }}>
          Notification preferences
        </h2>
        <p style={{ color: "var(--text-muted)", marginTop: 0, fontSize: 13 }}>
          System-wide notification triggers and recipient lists are managed by your administrator on
          the <strong>Admin → Settings</strong> page. You&apos;ll automatically receive any trigger that
          names you (or your role) as a recipient.
        </p>
      </section>
    </div>
  );
}
