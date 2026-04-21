import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { AddPersonalProviderModal } from "../../pages/account/AddPersonalProviderModal";

export type AvailableProvider = {
  id: string;
  type: "anthropic" | "gemini" | "groq" | "openai";
  source: "company" | "personal";
  label: string;
  model: string;
  isDefault: boolean;
};

type Props = {
  /** Fires with the chosen provider id (or null → "use whatever is default") */
  onProviderSelected: (providerId: string | null, meta?: AvailableProvider) => void;
  onCancel: () => void;
  /** Label for the primary button inside the picker modal — e.g. "Draft scope". */
  actionLabel?: string;
  /** Show the picker even if only one option or a remembered default exists. */
  forcePicker?: boolean;
};

/**
 * Reusable "at point of use" provider picker.
 *
 * Behaviour:
 * - 0 providers available → opens `SetupProviderModal` so the user can add one.
 * - 1 provider available  → auto-resolves with that provider's id.
 * - 2+ available          → renders a modal grouping company + personal options.
 *
 * The component renders its own modal while `open` is true and should be mounted
 * near the trigger button; parent toggles it via `open`.
 */
export function AiProviderSelector({ onProviderSelected, onCancel, actionLabel = "Continue", forcePicker }: Props) {
  const { authFetch } = useAuth();
  const [options, setOptions] = useState<AvailableProvider[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await authFetch("/user/ai-providers/available");
        if (!response.ok) throw new Error(await response.text());
        const body = (await response.json()) as AvailableProvider[];
        if (cancelled) return;
        setOptions(body);
        if (!forcePicker) {
          if (body.length === 0) {
            setShowSetup(true);
            return;
          }
          if (body.length === 1) {
            onProviderSelected(body[0].id, body[0]);
            return;
          }
          const preferred = body.find((p) => p.isDefault);
          if (preferred) {
            onProviderSelected(preferred.id, preferred);
            return;
          }
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (showSetup) {
    return <SetupProviderModal onClose={onCancel} onSaved={() => {
      // After adding a key, re-fetch options and pick the newly added one.
      setShowSetup(false);
      void (async () => {
        const response = await authFetch("/user/ai-providers/available");
        if (response.ok) {
          const body = (await response.json()) as AvailableProvider[];
          setOptions(body);
          if (body.length === 1) {
            onProviderSelected(body[0].id, body[0]);
            return;
          }
        }
      })();
    }} />;
  }

  if (error) {
    return (
      <div className="slide-over-overlay" role="dialog" aria-modal="true">
        <div className="s7-card" style={{ maxWidth: 420 }}>
          <h2 className="s7-type-section-heading">Could not load providers</h2>
          <p style={{ color: "var(--status-danger)" }}>{error}</p>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onCancel}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (!options) return null;
  if (options.length < 2 && !forcePicker) return null;

  return (
    <ProviderPickerModal
      options={options}
      actionLabel={actionLabel}
      onPicked={(id, remember, meta) => {
        onProviderSelected(id, meta);
        if (remember) {
          void authFetch("/user/ai-providers/preference", {
            method: "PATCH",
            body: JSON.stringify({ providerId: id })
          });
        }
      }}
      onAddPersonal={() => setShowSetup(true)}
      onCancel={onCancel}
    />
  );
}

function ProviderPickerModal({
  options,
  actionLabel,
  onPicked,
  onAddPersonal,
  onCancel
}: {
  options: AvailableProvider[];
  actionLabel: string;
  onPicked: (id: string, remember: boolean, meta: AvailableProvider) => void;
  onAddPersonal: () => void;
  onCancel: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string>(() => {
    const preferred = options.find((o) => o.isDefault);
    return preferred?.id ?? options[0].id;
  });
  const [remember, setRemember] = useState(false);
  const company = options.filter((o) => o.source === "company");
  const personal = options.filter((o) => o.source === "personal");

  return (
    <div className="slide-over-overlay" role="dialog" aria-modal="true" aria-label="Choose AI provider" onClick={onCancel}>
      <div className="s7-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Which AI provider should run this?</h2>
        <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
          You have more than one provider available. Pick one for this run, or tick "remember" and
          we'll use it automatically next time.
        </p>

        {company.length ? (
          <section style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 13, textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 6px 0" }}>
              Company
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {company.map((opt) => (
                <ProviderCard
                  key={opt.id}
                  opt={opt}
                  selected={opt.id === selectedId}
                  onSelect={() => setSelectedId(opt.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {personal.length ? (
          <section style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 13, textTransform: "uppercase", color: "var(--text-muted)", margin: "0 0 6px 0" }}>
              Personal
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {personal.map((opt) => (
                <ProviderCard
                  key={opt.id}
                  opt={opt}
                  selected={opt.id === selectedId}
                  onSelect={() => setSelectedId(opt.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span style={{ fontSize: 13 }}>Remember my choice (skip this step next time)</span>
        </label>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onAddPersonal}>
            + Add personal key
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onCancel}>Cancel</button>
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              onClick={() => {
                const meta = options.find((o) => o.id === selectedId)!;
                onPicked(selectedId, remember, meta);
              }}
            >
              {actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProviderCard({
  opt,
  selected,
  onSelect
}: {
  opt: AvailableProvider;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        textAlign: "left",
        padding: 12,
        border: `2px solid ${selected ? "#FEAA6D" : "var(--border, #e5e7eb)"}`,
        borderRadius: 8,
        background: selected ? "rgba(254,170,109,0.08)" : "transparent",
        cursor: "pointer"
      }}
    >
      <div style={{ fontWeight: 600 }}>{opt.label}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Model: {opt.model}</div>
      {opt.isDefault ? (
        <div style={{ fontSize: 11, color: "var(--brand-primary, #005B61)", marginTop: 4 }}>★ Last used</div>
      ) : null}
    </button>
  );
}

function SetupProviderModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  if (addOpen) {
    return <AddPersonalProviderModal onClose={() => setAddOpen(false)} onSaved={onSaved} />;
  }
  return (
    <div className="slide-over-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="s7-card" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Connect an AI provider</h2>
        <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
          You don't have any AI providers available yet. Add a personal API key now, or ask an
          admin to configure a company-wide key.
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={() => { navigate("/account"); onClose(); }}>
            Manage in My account
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="s7-btn s7-btn--primary" onClick={() => setAddOpen(true)}>
              Add a personal key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
