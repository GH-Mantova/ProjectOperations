import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { CompanySettingsTab } from "./CompanySettingsTab";
import { MySettingsTab } from "./MySettingsTab";
import {
  canViewAiSettingsPage,
  canViewCompanyTab,
  getInitialTab,
  type TabId
} from "./ai-settings-helpers";

export function AiSettingsPage() {
  const { user } = useAuth();
  const isSuperUser = user?.isSuperUser === true;
  const canViewPage = canViewAiSettingsPage(isSuperUser, user?.permissions);
  const showTabs = canViewCompanyTab(isSuperUser);
  const [tab, setTab] = useState<TabId>(getInitialTab(isSuperUser));

  if (!user) return null;

  if (!canViewPage) {
    return (
      <div style={{ padding: 24, maxWidth: 720 }}>
        <h1 className="s7-type-page-heading" style={{ marginTop: 0 }}>AI Settings</h1>
        <div
          role="status"
          style={{
            background: "var(--surface-card, #FFFFFF)",
            border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
            borderRadius: 8,
            padding: 24,
            color: "var(--text-muted)",
            fontSize: 14
          }}
        >
          AI features are not enabled for your account. Contact your administrator if you
          believe this is an error.
        </div>
      </div>
    );
  }

  if (!showTabs) {
    return (
      <div style={{ padding: 24, maxWidth: 1000 }}>
        <h1 className="s7-type-page-heading" style={{ marginTop: 0 }}>AI Settings</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
          Personal preferences for the AI personas you have access to.
        </p>
        <MySettingsTab />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h1 className="s7-type-page-heading" style={{ marginTop: 0 }}>AI Settings</h1>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
        Configure AI providers, persona behaviour, and personal preferences.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, marginTop: 24 }}>
        <nav aria-label="AI settings sections" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {([
            { id: "company" as const, label: "Company" },
            { id: "mine" as const, label: "My Settings" }
          ]).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: active ? "rgba(0,91,97,0.08)" : "transparent",
                  color: active ? "#005B61" : "var(--text)",
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  borderLeft: active ? "3px solid #005B61" : "3px solid transparent"
                }}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        <div>
          {tab === "company" ? <CompanySettingsTab /> : <MySettingsTab />}
        </div>
      </div>
    </div>
  );
}
