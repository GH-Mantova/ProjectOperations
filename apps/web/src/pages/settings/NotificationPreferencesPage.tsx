import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

// SLICE 5 (settings-restructure): per-user notification channel preferences.
// Fetches GET /notification-preferences/me to list all triggers the caller is
// eligible for, then lets them set their channel (both / email / in-app / off)
// per trigger via PUT /notification-preferences/me/:trigger.
//
// Semantics shown in copy: MUTE-ONLY. A user can only reduce channels relative
// to what the admin has configured for them — they cannot receive channels the
// admin has not routed, and cannot become a recipient of a trigger they are not
// already eligible for.

type TriggerPreference = {
  trigger: string;
  label: string;
  description: string;
  adminDeliveryMethod: string;
  storedChannel: string | null;
  effectiveChannel: string;
};

type Channel = "both" | "email" | "inapp" | "off";

const CHANNEL_LABELS: Record<Channel, string> = {
  both: "Both (email + in-app)",
  email: "Email only",
  inapp: "In-app only",
  off: "Off (muted)"
};

// Channels available to a user are only those the admin sends AND no more.
function availableChannels(adminDeliveryMethod: string): Channel[] {
  if (adminDeliveryMethod === "both") return ["both", "email", "inapp", "off"];
  if (adminDeliveryMethod === "email") return ["email", "off"];
  if (adminDeliveryMethod === "inapp") return ["inapp", "off"];
  return ["off"];
}

function effectiveLabel(pref: TriggerPreference): string {
  const eff = pref.effectiveChannel as Channel;
  return CHANNEL_LABELS[eff] ?? eff;
}

export function NotificationPreferencesPage() {
  const { authFetch } = useAuth();
  const [prefs, setPrefs] = useState<TriggerPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/notification-preferences/me");
      if (!res.ok) throw new Error("Could not load notification preferences.");
      setPrefs((await res.json()) as TriggerPreference[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChannelChange = useCallback(
    async (trigger: string, adminDeliveryMethod: string, channel: Channel) => {
      setSaving((prev) => ({ ...prev, [trigger]: true }));
      setSaveError((prev) => ({ ...prev, [trigger]: "" }));
      try {
        const res = await authFetch(`/notification-preferences/me/${encodeURIComponent(trigger)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel })
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? "Could not save preference.");
        }
        // Refresh the list to get updated effectiveChannel
        await load();
      } catch (err) {
        setSaveError((prev) => ({
          ...prev,
          [trigger]: err instanceof Error ? err.message : "Save failed."
        }));
      } finally {
        setSaving((prev) => ({ ...prev, [trigger]: false }));
      }
    },
    [authFetch, load]
  );

  const handleClear = useCallback(
    async (trigger: string) => {
      setSaving((prev) => ({ ...prev, [trigger]: true }));
      setSaveError((prev) => ({ ...prev, [trigger]: "" }));
      try {
        const res = await authFetch(`/notification-preferences/me/${encodeURIComponent(trigger)}`, {
          method: "DELETE"
        });
        if (!res.ok && res.status !== 404) {
          throw new Error("Could not clear preference.");
        }
        await load();
      } catch (err) {
        setSaveError((prev) => ({
          ...prev,
          [trigger]: err instanceof Error ? err.message : "Clear failed."
        }));
      } finally {
        setSaving((prev) => ({ ...prev, [trigger]: false }));
      }
    },
    [authFetch, load]
  );

  return (
    <div className="s7-page-content">
      <header style={{ marginBottom: "var(--space-6, 24px)" }}>
        <h2 className="s7-type-section-heading" style={{ margin: 0 }}>
          Notification preferences
        </h2>
        <p style={{ color: "var(--text-muted)", margin: "6px 0 0", maxWidth: 560 }}>
          Control how you receive each notification. You can only reduce channels from what your
          administrator has configured — you cannot enable channels that have not been routed to
          you, and these settings do not affect who receives a trigger.
        </p>
      </header>

      {loading && (
        <p style={{ color: "var(--text-muted)" }}>Loading preferences…</p>
      )}

      {error && (
        <p role="alert" style={{ color: "var(--colour-danger, #dc2626)" }}>
          {error}
        </p>
      )}

      {!loading && !error && prefs.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>
          You are not currently configured as a recipient for any notification triggers. Contact
          your administrator if you think this is incorrect.
        </p>
      )}

      {!loading && prefs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4, 16px)" }}>
          {prefs.map((pref) => {
            const channels = availableChannels(pref.adminDeliveryMethod);
            const currentValue = (pref.storedChannel ?? pref.adminDeliveryMethod) as Channel;
            const isSaving = saving[pref.trigger] ?? false;

            return (
              <div
                key={pref.trigger}
                style={{
                  border: "1px solid var(--border-default, #e5e7eb)",
                  borderRadius: "var(--radius-md, 6px)",
                  padding: "var(--space-4, 16px)",
                  background: "var(--surface-base, #fff)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, margin: 0 }}>{pref.label}</p>
                    <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 13 }}>
                      {pref.description}
                    </p>
                    <p style={{ color: "var(--text-muted)", margin: "6px 0 0", fontSize: 12 }}>
                      Admin routes: <strong>{CHANNEL_LABELS[pref.adminDeliveryMethod as Channel] ?? pref.adminDeliveryMethod}</strong>
                      {" · "}
                      Effective: <strong>{effectiveLabel(pref)}</strong>
                    </p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <select
                      aria-label={`Channel for ${pref.label}`}
                      value={currentValue}
                      disabled={isSaving}
                      onChange={(e) =>
                        void handleChannelChange(
                          pref.trigger,
                          pref.adminDeliveryMethod,
                          e.target.value as Channel
                        )
                      }
                      style={{
                        padding: "4px 8px",
                        borderRadius: "var(--radius-sm, 4px)",
                        border: "1px solid var(--border-default, #d1d5db)",
                        fontSize: 13
                      }}
                    >
                      {channels.map((ch) => (
                        <option key={ch} value={ch}>
                          {CHANNEL_LABELS[ch]}
                        </option>
                      ))}
                    </select>

                    {pref.storedChannel !== null && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => void handleClear(pref.trigger)}
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          textDecoration: "underline"
                        }}
                      >
                        Reset to admin default
                      </button>
                    )}
                  </div>
                </div>

                {saveError[pref.trigger] && (
                  <p role="alert" style={{ color: "var(--colour-danger, #dc2626)", fontSize: 12, margin: "6px 0 0" }}>
                    {saveError[pref.trigger]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
