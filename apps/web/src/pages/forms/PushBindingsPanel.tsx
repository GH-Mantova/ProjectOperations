import { useMemo } from "react";
import type { DesignerDraft, DraftField, DraftPushBinding } from "./formDesignerState";
import { uid } from "./formDesignerState";

/**
 * F-9b — Push tab body for the form designer's field properties panel.
 *
 * Authors one or more FormFieldPushBinding rows per field. Each row picks
 * a handler from the registered set, edits the handler-specific config,
 * toggles enable/disable, and picks whether to fire at submit or once
 * the approval chain is fully approved.
 *
 * The panel is UI-only: it edits `field.pushBindings` in the draft;
 * publishing serialises those bindings via `fieldToPublishPayload`, and
 * `FormsService.createTemplateVersion` persists them on the new version.
 */

type HandlerDef = {
  module: string;
  action: string;
  label: string;
  description: string;
  configKeys: Array<{
    key: string;
    label: string;
    type: "text" | "select" | "checkbox";
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
    hint?: string;
  }>;
};

/**
 * Handlers surfaced in the designer's targetAction dropdown. The strings
 * must match `PushHandlersService.onModuleInit` in the API — if they
 * diverge the executor records a "no handler registered" failure at
 * submit time. Config keys mirror what each handler reads out of
 * `binding.config` at runtime.
 */
const HANDLERS: HandlerDef[] = [
  {
    module: "assets",
    action: "record_usage_reading",
    label: "Record usage reading (assets)",
    description:
      "Push a meter/hours reading to the target asset. Requires F-7 to be live; while stubbed, the audit spine records the pending gap.",
    configKeys: [
      {
        key: "assetFromFieldKey",
        label: "Asset from field",
        type: "text",
        placeholder: "e.g. asset_id",
        hint: "Field key on this form whose value is the target asset id."
      },
      {
        key: "readingFieldKey",
        label: "Reading value from field",
        type: "text",
        placeholder: "e.g. hours_meter"
      },
      {
        key: "unit",
        label: "Reading unit",
        type: "select",
        options: [
          { value: "hours", label: "Hours" },
          { value: "km", label: "Kilometres" },
          { value: "cycles", label: "Cycles" }
        ]
      },
      {
        key: "rejectBelowLast",
        label: "Reject readings below the last recorded value",
        type: "checkbox"
      },
      {
        key: "allowMeterReplacedOverride",
        label: "Allow meter-replaced override",
        type: "checkbox"
      }
    ]
  },
  {
    module: "maintenance",
    action: "create_defect",
    label: "Create defect (maintenance)",
    description:
      "Creates one AssetBreakdown per entry in a repeating defect section. Reads entries out of the section's JSON blob.",
    configKeys: [
      {
        key: "assetFromFieldKey",
        label: "Asset from field",
        type: "text",
        placeholder: "e.g. asset_id"
      },
      {
        key: "entriesFieldKey",
        label: "Repeating entries field",
        type: "text",
        placeholder: "e.g. defects",
        hint: "Field key that carries the JSON array of { summary, severity, notes }."
      },
      {
        key: "defaultSeverity",
        label: "Default severity",
        type: "select",
        options: [
          { value: "LOW", label: "Low" },
          { value: "MEDIUM", label: "Medium" },
          { value: "HIGH", label: "High" },
          { value: "CRITICAL", label: "Critical" }
        ]
      }
    ]
  },
  {
    module: "maintenance",
    action: "flag_major_defect",
    label: "Flag asset on Major defect (maintenance)",
    description:
      "When any defect entry has severity Major/Critical, flips the asset to a blocked status and records AssetStatusHistory.",
    configKeys: [
      {
        key: "assetFromFieldKey",
        label: "Asset from field",
        type: "text",
        placeholder: "e.g. asset_id"
      },
      {
        key: "entriesFieldKey",
        label: "Repeating entries field",
        type: "text",
        placeholder: "e.g. defects"
      },
      {
        key: "blockedStatus",
        label: "Blocked status",
        type: "select",
        options: [
          { value: "OUT_OF_SERVICE", label: "Out of service" },
          { value: "MAINTENANCE", label: "Maintenance" }
        ]
      }
    ]
  }
];

function makeEmptyBinding(): DraftPushBinding {
  return {
    tempId: uid(),
    targetModule: HANDLERS[0].module,
    targetAction: HANDLERS[0].action,
    applyOn: "submit",
    isEnabled: true,
    config: {}
  };
}

export function PushBindingsPanel({
  field,
  draft,
  onChange
}: {
  field: DraftField;
  draft: DesignerDraft;
  onChange: (patch: Partial<DraftField>) => void;
}) {
  const bindings = field.pushBindings ?? [];

  const fieldKeyOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const section of draft.sections) {
      for (const f of section.fields) {
        if (f.fieldKey) keys.add(f.fieldKey);
      }
    }
    return Array.from(keys).sort();
  }, [draft]);

  const setBindings = (next: DraftPushBinding[]) => onChange({ pushBindings: next });

  const addBinding = () => setBindings([...bindings, makeEmptyBinding()]);

  const updateBinding = (tempId: string, patch: Partial<DraftPushBinding>) =>
    setBindings(bindings.map((b) => (b.tempId === tempId ? { ...b, ...patch } : b)));

  const patchConfig = (tempId: string, key: string, value: unknown) => {
    const target = bindings.find((b) => b.tempId === tempId);
    if (!target) return;
    const nextConfig = { ...(target.config ?? {}), [key]: value };
    updateBinding(tempId, { config: nextConfig });
  };

  const removeBinding = (tempId: string) =>
    setBindings(bindings.filter((b) => b.tempId !== tempId));

  if (bindings.length === 0) {
    return (
      <div>
        <p style={{ fontSize: 12, color: "var(--fv2-muted, #64748B)", margin: "0 0 8px" }}>
          Push bindings send this field's value (or a sibling field, per config) to another
          module after the submission is saved. Failures are logged on the submission's audit
          spine and can be retried.
        </p>
        <button type="button" className="fv2-tbtn" onClick={addBinding}>
          + Add push binding
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {bindings.map((binding, idx) => {
        const handlerKey = `${binding.targetModule}:${binding.targetAction}`;
        const def = HANDLERS.find((h) => `${h.module}:${h.action}` === handlerKey);
        const config = (binding.config ?? {}) as Record<string, unknown>;
        return (
          <div
            key={binding.tempId}
            style={{
              border: "1px solid var(--fv2-border, #E2E8F0)",
              borderRadius: 6,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              opacity: binding.isEnabled ? 1 : 0.7
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <strong style={{ fontSize: 12 }}>Binding {idx + 1}</strong>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                  <input
                    type="checkbox"
                    checked={binding.isEnabled}
                    onChange={(e) =>
                      updateBinding(binding.tempId, { isEnabled: e.target.checked })
                    }
                  />
                  Enabled
                </label>
                <button
                  type="button"
                  className="fv2-danger"
                  onClick={() => removeBinding(binding.tempId)}
                  aria-label={`Remove binding ${idx + 1}`}
                >
                  ✕
                </button>
              </div>
            </div>

            <label style={{ fontSize: 12 }}>
              Action
              <select
                value={handlerKey}
                onChange={(e) => {
                  const [nextModule, nextAction] = e.target.value.split(":");
                  updateBinding(binding.tempId, {
                    targetModule: nextModule,
                    targetAction: nextAction,
                    config: {}
                  });
                }}
              >
                {HANDLERS.map((h) => (
                  <option key={`${h.module}:${h.action}`} value={`${h.module}:${h.action}`}>
                    {h.label}
                  </option>
                ))}
              </select>
            </label>

            {def ? (
              <p style={{ fontSize: 11, color: "var(--fv2-muted, #64748B)", margin: 0 }}>
                {def.description}
              </p>
            ) : (
              <p style={{ fontSize: 11, color: "#B91C1C", margin: 0 }}>
                Unknown handler <code>{handlerKey}</code>. Push will fail at submit.
              </p>
            )}

            <label style={{ fontSize: 12 }}>
              Apply on
              <select
                value={binding.applyOn}
                onChange={(e) =>
                  updateBinding(binding.tempId, {
                    applyOn: e.target.value === "approval" ? "approval" : "submit"
                  })
                }
              >
                <option value="submit">Submit (fires when the form is submitted)</option>
                <option value="approval">
                  Approval (fires when the approval chain fully approves)
                </option>
              </select>
            </label>

            {def?.configKeys.map((ck) => {
              const raw = config[ck.key];
              if (ck.type === "checkbox") {
                return (
                  <label
                    key={ck.key}
                    style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(raw)}
                      onChange={(e) => patchConfig(binding.tempId, ck.key, e.target.checked)}
                    />
                    {ck.label}
                  </label>
                );
              }
              if (ck.type === "select") {
                return (
                  <label key={ck.key} style={{ fontSize: 12 }}>
                    {ck.label}
                    <select
                      value={String(raw ?? "")}
                      onChange={(e) => patchConfig(binding.tempId, ck.key, e.target.value)}
                    >
                      <option value="">— select —</option>
                      {ck.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {ck.hint ? (
                      <span style={{ fontSize: 11, color: "var(--fv2-muted, #64748B)" }}>
                        {ck.hint}
                      </span>
                    ) : null}
                  </label>
                );
              }
              const isFieldKeyPicker = ck.key.endsWith("FieldKey");
              return (
                <label key={ck.key} style={{ fontSize: 12 }}>
                  {ck.label}
                  {isFieldKeyPicker && fieldKeyOptions.length > 0 ? (
                    <select
                      value={String(raw ?? "")}
                      onChange={(e) => patchConfig(binding.tempId, ck.key, e.target.value)}
                    >
                      <option value="">— select field —</option>
                      {fieldKeyOptions.map((fk) => (
                        <option key={fk} value={fk}>
                          {fk}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={String(raw ?? "")}
                      onChange={(e) => patchConfig(binding.tempId, ck.key, e.target.value)}
                      placeholder={ck.placeholder}
                    />
                  )}
                  {ck.hint ? (
                    <span style={{ fontSize: 11, color: "var(--fv2-muted, #64748B)" }}>
                      {ck.hint}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        );
      })}

      <button type="button" className="fv2-tbtn" onClick={addBinding} style={{ alignSelf: "flex-start" }}>
        + Add another binding
      </button>
    </div>
  );
}
