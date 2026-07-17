import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { can } from "../../auth/permissions";
import { NoAccess } from "../../components/NoAccess";
import { readApiErrorMessage } from "../../lib/api-errors";

// Whitelisted values — keep in sync with dto/automation.dto.ts on the API.
const TRIGGER_EVENTS = ["created", "updated", "status-changed"] as const;
const ACTION_TYPES = ["notify", "create-note", "set-field"] as const;
type TriggerEvent = (typeof TRIGGER_EVENTS)[number];
type ActionType = (typeof ACTION_TYPES)[number];

type Rule = {
  id: string;
  name: string;
  description: string | null;
  triggerEntity: string;
  triggerEvent: TriggerEvent;
  conditions: unknown;
  actions: Array<{ type: ActionType; config: Record<string, unknown> }>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type RuleRun = {
  id: string;
  event: string;
  entity: string;
  entityId: string | null;
  matched: boolean;
  succeeded: boolean;
  error: string | null;
  actionsRun: unknown;
  createdAt: string;
};

type DraftAction = { type: ActionType; configJson: string };
type Draft = {
  name: string;
  description: string;
  triggerEntity: string;
  triggerEvent: TriggerEvent;
  conditionsJson: string;
  actions: DraftAction[];
  enabled: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  description: "",
  triggerEntity: "Notification",
  triggerEvent: "created",
  conditionsJson: "[]",
  actions: [
    {
      type: "notify",
      configJson: JSON.stringify(
        { userId: "", title: "", body: "", severity: "LOW" },
        null,
        2
      )
    }
  ],
  enabled: true
};

export function AutomationsPage() {
  const { user, authFetch } = useAuth();
  const canView = can(user, "automations.view");
  const canManage = can(user, "automations.manage");

  const [rules, setRules] = useState<Rule[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | "new"; draft: Draft } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [runsFor, setRunsFor] = useState<{ ruleId: string; runs: RuleRun[] | null } | null>(null);

  const load = useCallback(async () => {
    setRules(null);
    setLoadError(null);
    const res = await authFetch("/automations");
    if (!res.ok) {
      setLoadError(await readApiErrorMessage(res, "Failed to load automation rules."));
      setRules([]);
      return;
    }
    setRules((await res.json()) as Rule[]);
  }, [authFetch]);

  useEffect(() => {
    if (canView) void load();
  }, [canView, load]);

  const startCreate = () => {
    setSaveError(null);
    setEditing({ id: "new", draft: { ...EMPTY_DRAFT, actions: [{ ...EMPTY_DRAFT.actions[0] }] } });
  };

  const startEdit = (rule: Rule) => {
    setSaveError(null);
    setEditing({
      id: rule.id,
      draft: {
        name: rule.name,
        description: rule.description ?? "",
        triggerEntity: rule.triggerEntity,
        triggerEvent: rule.triggerEvent,
        conditionsJson: JSON.stringify(rule.conditions ?? [], null, 2),
        actions: rule.actions.map((a) => ({
          type: a.type,
          configJson: JSON.stringify(a.config ?? {}, null, 2)
        })),
        enabled: rule.enabled
      }
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setSaveError(null);
  };

  const save = async (evt: FormEvent<HTMLFormElement>) => {
    evt.preventDefault();
    if (!editing) return;
    const { id, draft } = editing;

    let conditions: unknown;
    try {
      conditions = draft.conditionsJson.trim() ? JSON.parse(draft.conditionsJson) : [];
    } catch {
      setSaveError("Conditions must be valid JSON (an array of { field, op, value }).");
      return;
    }

    const actions: Array<{ type: ActionType; config: unknown }> = [];
    for (const a of draft.actions) {
      let config: unknown;
      try {
        config = a.configJson.trim() ? JSON.parse(a.configJson) : {};
      } catch {
        setSaveError(`Action "${a.type}" config must be valid JSON.`);
        return;
      }
      actions.push({ type: a.type, config });
    }

    if (!draft.name.trim()) {
      setSaveError("Name is required.");
      return;
    }
    if (actions.length === 0) {
      setSaveError("At least one action is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        trigger: { entity: draft.triggerEntity.trim(), event: draft.triggerEvent },
        conditions,
        actions,
        enabled: draft.enabled
      };
      const res = await authFetch(id === "new" ? "/automations" : `/automations/${id}`, {
        method: id === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        setSaveError(await readApiErrorMessage(res, "Failed to save rule."));
        return;
      }
      cancelEdit();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (rule: Rule) => {
    const res = await authFetch(`/automations/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled })
    });
    if (res.ok) await load();
  };

  const remove = async (rule: Rule) => {
    if (!window.confirm(`Delete automation rule "${rule.name}"?`)) return;
    const res = await authFetch(`/automations/${rule.id}`, { method: "DELETE" });
    if (res.ok) await load();
  };

  const showRuns = async (rule: Rule) => {
    setRunsFor({ ruleId: rule.id, runs: null });
    const res = await authFetch(`/automations/${rule.id}/runs?limit=20`);
    const runs = res.ok ? ((await res.json()) as RuleRun[]) : [];
    setRunsFor({ ruleId: rule.id, runs });
  };

  const testFire = async (rule: Rule) => {
    const raw = window.prompt("Test payload (JSON object):", "{}");
    if (raw === null) return;
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      window.alert("Payload must be valid JSON.");
      return;
    }
    const res = await authFetch(`/automations/${rule.id}/test-fire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload })
    });
    if (!res.ok) {
      window.alert(await readApiErrorMessage(res, "Test fire failed."));
      return;
    }
    await showRuns(rule);
  };

  const groupedRules = useMemo(() => {
    if (!rules) return null;
    return rules;
  }, [rules]);

  if (!user) return null;
  if (!canView) return <NoAccess required={["automations.view"]} />;

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h1 className="s7-type-page-heading" style={{ marginTop: 0 }}>
        Automations
      </h1>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
        Configure &quot;when X happens, do Y&quot; rules that run across the platform. Actions are
        drawn from a whitelisted set — no arbitrary code or webhooks. Slice 1 supports triggers on
        Notification created and actions <code>notify</code> / <code>create-note</code>;{" "}
        <code>set-field</code> is accepted by the schema but not yet executable.
      </p>

      {canManage && (
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={startCreate}
            disabled={editing?.id === "new"}
            style={{ minHeight: 36 }}
          >
            + New rule
          </button>
        </div>
      )}

      {loadError && (
        <div role="alert" style={{ color: "var(--danger, #b91c1c)", marginBottom: 12 }}>
          {loadError}
        </div>
      )}

      {groupedRules === null ? (
        <Skeleton />
      ) : groupedRules.length === 0 ? (
        <EmptyState heading="No automation rules yet" subtext="Create a rule to get started." />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border, #ddd)" }}>
              <th style={{ padding: 8 }}>Name</th>
              <th style={{ padding: 8 }}>Trigger</th>
              <th style={{ padding: 8 }}>Actions</th>
              <th style={{ padding: 8 }}>Enabled</th>
              <th style={{ padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {groupedRules.map((rule) => (
              <tr key={rule.id} style={{ borderBottom: "1px solid var(--border, #eee)" }}>
                <td style={{ padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{rule.name}</div>
                  {rule.description && (
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                      {rule.description}
                    </div>
                  )}
                </td>
                <td style={{ padding: 8, fontFamily: "monospace", fontSize: 13 }}>
                  {rule.triggerEntity}.{rule.triggerEvent}
                </td>
                <td style={{ padding: 8, fontSize: 13 }}>
                  {rule.actions.map((a) => a.type).join(", ")}
                </td>
                <td style={{ padding: 8 }}>
                  {canManage ? (
                    <label style={{ cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => void toggleEnabled(rule)}
                      />{" "}
                      {rule.enabled ? "On" : "Off"}
                    </label>
                  ) : rule.enabled ? (
                    "On"
                  ) : (
                    "Off"
                  )}
                </td>
                <td style={{ padding: 8, textAlign: "right" }}>
                  <button type="button" onClick={() => void showRuns(rule)}>
                    Runs
                  </button>{" "}
                  {canManage && (
                    <>
                      <button type="button" onClick={() => void testFire(rule)}>
                        Test-fire
                      </button>{" "}
                      <button type="button" onClick={() => startEdit(rule)}>
                        Edit
                      </button>{" "}
                      <button type="button" onClick={() => void remove(rule)}>
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <form
          onSubmit={save}
          style={{
            marginTop: 24,
            padding: 16,
            border: "1px solid var(--border, #ddd)",
            borderRadius: 4
          }}
        >
          <h2 style={{ marginTop: 0 }}>{editing.id === "new" ? "New rule" : "Edit rule"}</h2>

          <label style={{ display: "block", marginBottom: 8 }}>
            Name
            <input
              type="text"
              value={editing.draft.name}
              onChange={(e) =>
                setEditing((cur) =>
                  cur ? { ...cur, draft: { ...cur.draft, name: e.target.value } } : cur
                )
              }
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 8 }}>
            Description
            <input
              type="text"
              value={editing.draft.description}
              onChange={(e) =>
                setEditing((cur) =>
                  cur ? { ...cur, draft: { ...cur.draft, description: e.target.value } } : cur
                )
              }
              style={{ display: "block", width: "100%", marginTop: 4 }}
            />
          </label>

          <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
            <label style={{ flex: 1 }}>
              Trigger entity
              <input
                type="text"
                value={editing.draft.triggerEntity}
                onChange={(e) =>
                  setEditing((cur) =>
                    cur ? { ...cur, draft: { ...cur.draft, triggerEntity: e.target.value } } : cur
                  )
                }
                style={{ display: "block", width: "100%", marginTop: 4 }}
              />
            </label>
            <label style={{ flex: 1 }}>
              Trigger event
              <select
                value={editing.draft.triggerEvent}
                onChange={(e) =>
                  setEditing((cur) =>
                    cur
                      ? {
                          ...cur,
                          draft: { ...cur.draft, triggerEvent: e.target.value as TriggerEvent }
                        }
                      : cur
                  )
                }
                style={{ display: "block", width: "100%", marginTop: 4 }}
              >
                {TRIGGER_EVENTS.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: "block", marginBottom: 8 }}>
            Conditions (JSON array of {"{ field, op, value }"})
            <textarea
              value={editing.draft.conditionsJson}
              onChange={(e) =>
                setEditing((cur) =>
                  cur ? { ...cur, draft: { ...cur.draft, conditionsJson: e.target.value } } : cur
                )
              }
              rows={4}
              style={{
                display: "block",
                width: "100%",
                marginTop: 4,
                fontFamily: "monospace",
                fontSize: 13
              }}
            />
          </label>

          <fieldset style={{ marginBottom: 8 }}>
            <legend>Actions</legend>
            {editing.draft.actions.map((action, idx) => (
              <div
                key={idx}
                style={{ marginBottom: 8, padding: 8, border: "1px dashed var(--border, #ccc)" }}
              >
                <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <select
                    value={action.type}
                    onChange={(e) =>
                      setEditing((cur) => {
                        if (!cur) return cur;
                        const next = [...cur.draft.actions];
                        next[idx] = { ...next[idx], type: e.target.value as ActionType };
                        return { ...cur, draft: { ...cur.draft, actions: next } };
                      })
                    }
                  >
                    {ACTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setEditing((cur) => {
                        if (!cur) return cur;
                        const next = cur.draft.actions.filter((_, i) => i !== idx);
                        return {
                          ...cur,
                          draft: {
                            ...cur.draft,
                            actions: next.length ? next : [{ type: "notify", configJson: "{}" }]
                          }
                        };
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
                <textarea
                  value={action.configJson}
                  onChange={(e) =>
                    setEditing((cur) => {
                      if (!cur) return cur;
                      const next = [...cur.draft.actions];
                      next[idx] = { ...next[idx], configJson: e.target.value };
                      return { ...cur, draft: { ...cur.draft, actions: next } };
                    })
                  }
                  rows={5}
                  style={{
                    display: "block",
                    width: "100%",
                    fontFamily: "monospace",
                    fontSize: 13
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setEditing((cur) =>
                  cur
                    ? {
                        ...cur,
                        draft: {
                          ...cur.draft,
                          actions: [
                            ...cur.draft.actions,
                            { type: "notify", configJson: "{}" }
                          ]
                        }
                      }
                    : cur
                )
              }
            >
              + Add action
            </button>
          </fieldset>

          <label style={{ display: "block", marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={editing.draft.enabled}
              onChange={(e) =>
                setEditing((cur) =>
                  cur ? { ...cur, draft: { ...cur.draft, enabled: e.target.checked } } : cur
                )
              }
            />{" "}
            Enabled
          </label>

          {saveError && (
            <div role="alert" style={{ color: "var(--danger, #b91c1c)", marginBottom: 8 }}>
              {saveError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={cancelEdit} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {runsFor && (
        <div style={{ marginTop: 24 }}>
          <h2>Recent runs</h2>
          {runsFor.runs === null ? (
            <Skeleton />
          ) : runsFor.runs.length === 0 ? (
            <EmptyState heading="No runs recorded yet" />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border, #ddd)" }}>
                  <th style={{ padding: 6 }}>When</th>
                  <th style={{ padding: 6 }}>Event</th>
                  <th style={{ padding: 6 }}>Matched</th>
                  <th style={{ padding: 6 }}>Succeeded</th>
                  <th style={{ padding: 6 }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {runsFor.runs.map((run) => (
                  <tr key={run.id} style={{ borderBottom: "1px solid var(--border, #eee)" }}>
                    <td style={{ padding: 6 }}>{new Date(run.createdAt).toLocaleString()}</td>
                    <td style={{ padding: 6, fontFamily: "monospace" }}>
                      {run.entity}.{run.event}
                    </td>
                    <td style={{ padding: 6 }}>{run.matched ? "Yes" : "No"}</td>
                    <td style={{ padding: 6 }}>{run.succeeded ? "Yes" : "No"}</td>
                    <td style={{ padding: 6, color: "var(--danger, #b91c1c)" }}>
                      {run.error ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
