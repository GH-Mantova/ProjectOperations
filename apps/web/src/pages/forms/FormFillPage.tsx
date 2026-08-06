import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { FormDraftStore } from "../../drafts";
import { captureGpsReading } from "../field/useAutoGps";
import { ConsentPanel, GPS_HARD_BLOCK_MSG } from "../field/GpsConsent";
import { readTemplateLayout, resolveEffectiveLayout, type FormLayout } from "./formLayoutResolver";
import { RepeatingSectionEntries } from "./RepeatingSectionEntries";
import {
  evaluateConditionGroup,
  type FieldRule
} from "@project-ops/config/forms-rule-definition";

type Field = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  fieldOrder: number;
  isRequired: boolean;
  helpText?: string | null;
  placeholder?: string | null;
  defaultValue?: string | null;
  config?: Record<string, unknown>;
  conditions?: FieldRule[];
};

type ResponseSetOption = {
  value: string;
  label?: string;
  score: number;
  isPassing?: boolean;
  isNA?: boolean;
  color?: string;
};

type ResponseSet = { key?: string; name?: string; options: ResponseSetOption[] };

type FieldScoreConfig = {
  weight?: number;
  countsTowardScore?: boolean;
  responseSet?: ResponseSet;
  responseSetKey?: string;
};

type Section = {
  id: string;
  title: string;
  description?: string | null;
  sectionOrder: number;
  // F-3 — repeating section metadata.
  isRepeating?: boolean;
  minRepeat?: number | null;
  maxRepeat?: number | null;
  fields: Field[];
};

type Submission = {
  id: string;
  status: string;
  submittedById?: string | null;
  siteId?: string | null;
  context?: {
    jobId?: string;
    projectId?: string;
    supervisorId?: string;
    allocationId?: string;
  } | null;
  values: Array<{
    fieldKey: string;
    valueText: string | null;
    valueNumber: string | number | null;
    valueBoolean: boolean | null;
    valueDateTime: string | null;
    valueJson: unknown;
    filePath: string | null;
    entryIndex?: number;
  }>;
  templateVersion: {
    id: string;
    versionNumber: number;
    template: {
      id: string;
      name: string;
      category?: string | null;
      settings?: unknown;
      geolocationEnabled?: boolean;
    };
    sections: Section[];
  };
};

type ValueMap = Record<string, unknown>;

// ── Local rules eval (mirrors RulesEngineService for live UI updates) ─────
// Server is still authoritative — this just keeps the form responsive while
// the user types so we don't roundtrip on every keystroke. Condition/group
// evaluation now lives in @project-ops/config/forms-rule-definition so client
// and server share ONE evaluator (F-2b). The formRulesContract test proves
// this consumer and RulesEngineService return identical results.

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function fieldVisible(field: Field, values: ValueMap): boolean {
  const rules = field.conditions ?? [];
  if (rules.length === 0) return true;
  for (const rule of rules) {
    if (!evaluateConditionGroup(rule.conditionGroup, values)) continue;
    for (const action of rule.actions) {
      if (action.type === "hide") return false;
      if (action.type === "show") return true;
    }
  }
  return true;
}

function fieldRequired(field: Field, values: ValueMap): boolean {
  const rules = field.conditions ?? [];
  if (rules.length === 0) return field.isRequired;
  let required = field.isRequired;
  for (const rule of rules) {
    if (!evaluateConditionGroup(rule.conditionGroup, values)) continue;
    for (const action of rule.actions) {
      if (action.type === "require") required = true;
      else if (action.type === "unrequire") required = false;
    }
  }
  return required;
}

// ── Client-side scoring (mirrors server computeScoring for live UI) ──────
// Server is authoritative on submit; this just powers the running-score
// summary so the inspector can see progress as they answer.

function resolveResponseSet(
  field: Field,
  templateSettings: unknown
): ResponseSet | null {
  const cfg = (field.config ?? {}) as { scoreConfig?: FieldScoreConfig };
  const sc = cfg.scoreConfig;
  if (!sc) return null;
  if (sc.responseSet && Array.isArray(sc.responseSet.options)) return sc.responseSet;
  const catalog = ((templateSettings ?? {}) as { responseSets?: Record<string, ResponseSet> })
    .responseSets;
  if (sc.responseSetKey && catalog?.[sc.responseSetKey]) return catalog[sc.responseSetKey];
  return null;
}

function fieldIsScored(field: Field): boolean {
  const cfg = (field.config ?? {}) as { scoreConfig?: FieldScoreConfig };
  return Boolean(cfg.scoreConfig && cfg.scoreConfig.countsTowardScore !== false);
}

type LiveScore = { score: number; maxScore: number; pct: number | null };

function computeLiveScore(
  sections: Section[],
  values: ValueMap,
  templateSettings: unknown
): LiveScore {
  let score = 0;
  let maxScore = 0;
  for (const section of sections) {
    for (const field of section.fields ?? []) {
      if (!fieldIsScored(field)) continue;
      const set = resolveResponseSet(field, templateSettings);
      if (!set || set.options.length === 0) continue;
      const cfg = (field.config ?? {}) as { scoreConfig?: FieldScoreConfig };
      const weight =
        typeof cfg.scoreConfig?.weight === "number" && Number.isFinite(cfg.scoreConfig.weight)
          ? cfg.scoreConfig.weight
          : 1;
      const optionMax = set.options.reduce(
        (acc, o) => (o.isNA ? acc : Math.max(acc, o.score)),
        0
      );
      const raw = values[field.fieldKey];
      const match = set.options.find((o) => o.value === raw);
      if (match?.isNA) continue;
      if (match) {
        score += match.score * weight;
        maxScore += optionMax * weight;
      } else {
        maxScore += optionMax * weight;
      }
    }
  }
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : null;
  return { score, maxScore, pct };
}

// ── Initial values from the persisted submission rows ────────────────────

function buildInitialValues(submission: Submission): ValueMap {
  const out: ValueMap = {};
  // F-3: the flat map only carries entryIndex 0. Repeating-section entries at
  // higher indices live in the sectionEntries map built below.
  for (const v of submission.values) {
    if ((v.entryIndex ?? 0) !== 0) continue;
    if (v.valueText !== null) out[v.fieldKey] = v.valueText;
    else if (v.valueNumber !== null) out[v.fieldKey] = Number(v.valueNumber);
    else if (v.valueBoolean !== null) out[v.fieldKey] = v.valueBoolean;
    else if (v.valueDateTime !== null) out[v.fieldKey] = v.valueDateTime;
    else if (v.valueJson !== null) out[v.fieldKey] = v.valueJson;
    else if (v.filePath !== null) out[v.fieldKey] = v.filePath;
  }
  return out;
}

type SectionEntriesState = Record<string, Array<Record<string, unknown>>>;

/**
 * F-3 — reconstruct `{ sectionId: [entry-0 fields, entry-1 fields, …] }` from
 * the persisted submission rows so a returning submitter picks up their
 * in-flight entries. Only repeating sections are considered; non-repeating
 * sections stay in the flat value map.
 */
function buildInitialSectionEntries(submission: Submission): SectionEntriesState {
  const out: SectionEntriesState = {};
  const sections = submission.templateVersion.sections ?? [];
  for (const section of sections) {
    if (!section.isRepeating) continue;
    const fieldKeys = new Set((section.fields ?? []).map((f) => f.fieldKey));
    let maxIdx = -1;
    const byIndex = new Map<number, Record<string, unknown>>();
    for (const v of submission.values) {
      if (!fieldKeys.has(v.fieldKey)) continue;
      const idx = v.entryIndex ?? 0;
      maxIdx = Math.max(maxIdx, idx);
      const bucket = byIndex.get(idx) ?? {};
      if (v.valueText !== null) bucket[v.fieldKey] = v.valueText;
      else if (v.valueNumber !== null) bucket[v.fieldKey] = Number(v.valueNumber);
      else if (v.valueBoolean !== null) bucket[v.fieldKey] = v.valueBoolean;
      else if (v.valueDateTime !== null) bucket[v.fieldKey] = v.valueDateTime;
      else if (v.valueJson !== null) bucket[v.fieldKey] = v.valueJson;
      else if (v.filePath !== null) bucket[v.fieldKey] = v.filePath;
      byIndex.set(idx, bucket);
    }
    const arr: Array<Record<string, unknown>> = [];
    for (let i = 0; i <= maxIdx; i++) arr.push(byIndex.get(i) ?? {});
    // Ensure at least minRepeat entries so the section renders correctly.
    const min = Math.max(0, section.minRepeat ?? 0);
    while (arr.length < min) arr.push({});
    out[section.id] = arr;
  }
  return out;
}

// PR #111 — FormFillPage uses continuous 700ms-debounced autosave to BOTH
// the server (PATCH /values) and a local cache. Pre-#111 the local cache
// was localStorage; we now write to IndexedDB via FormDraftStore so private
// mode + cross-tab safety improve, and so we share the 30-day purge with
// every other draft in the system. The localStorage→IDB one-shot migration
// runs from draftPurgeJob on app boot — see DraftPurgeRunner in App.tsx.
const FORM_FILL_FORM_TYPE = "form_submission_fill";
const FORM_FILL_SCHEMA_VERSION = 1;

// ── Component ────────────────────────────────────────────────────────────

export function FormFillPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [values, setValues] = useState<ValueMap>({});
  const [sectionEntries, setSectionEntries] = useState<SectionEntriesState>({});
  const [sectionIndex, setSectionIndex] = useState(0);
  const [cardFieldIndex, setCardFieldIndex] = useState(0);
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window === "undefined" ? 1280 : window.innerWidth
  );
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ ref: string; created: { type: string; id: string }[] } | null>(null);
  // F-2c — WARN gate: when the server returns 422 with `warnings`, the
  // submitter must acknowledge each entry before the resubmit carries the
  // keys back. BLOCK gates return 422 with `blocks` and are surfaced as a
  // plain error — the user has to change form values to clear them.
  const [pendingWarnings, setPendingWarnings] = useState<
    Array<{ key: string; message: string }>
  >([]);
  const [ackKeys, setAckKeys] = useState<Set<string>>(new Set());
  const [gps, setGps] = useState<{ lat?: number; lng?: number; status: "idle" | "loading" | "ok" | "error"; message?: string }>({ status: "idle" });
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [locationConsent, setLocationConsent] = useState<boolean | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  // GPS-A3: load location consent for authenticated submitters. The panel is
  // only shown when the template requires GPS and consent hasn't been
  // acknowledged; the check runs whether or not GPS ends up mandatory so the
  // state is already there by the time the user hits Submit.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/field/location-consent");
        if (res.ok && !cancelled) {
          const body = (await res.json()) as { locationConsent?: boolean };
          setLocationConsent(Boolean(body.locationConsent));
        }
      } catch {
        // Non-fatal — the submit-time hard-block still guards the action.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // Online/offline tracking
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    return () => {
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
    };
  }, []);

  // Viewport width — used to auto-switch to Card below 768px (forms-engine-v2 §1.2, §10 Q8).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Load submission + template
  useEffect(() => {
    if (!submissionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`/forms/submissions/${submissionId}`);
        if (!res.ok) throw new Error(await res.text());
        const body = (await res.json()) as Submission;
        if (cancelled) return;
        setSubmission(body);
        // Merge any locally-saved offline draft on top of server-side values so
        // the worker's in-flight edits aren't lost when they reconnect. Source
        // is IndexedDB (PR #111) — see FormDraftStore. Pre-#111 localStorage
        // drafts were migrated by the one-shot draftPurgeJob on app boot.
        const initial = buildInitialValues(body);
        const initialEntries = buildInitialSectionEntries(body);
        try {
          const draft = user?.id
            ? await FormDraftStore.get(user.id, FORM_FILL_FORM_TYPE)
            : null;
          if (draft && draft.contextKey === body.id) {
            const payload = draft.data as {
              values: ValueMap;
              sectionIndex?: number;
              sectionEntries?: SectionEntriesState;
            };
            setValues({ ...initial, ...(payload.values ?? {}) });
            setSectionEntries(payload.sectionEntries ?? initialEntries);
            if (typeof payload.sectionIndex === "number") setSectionIndex(payload.sectionIndex);
          } else {
            setValues(initial);
            setSectionEntries(initialEntries);
          }
        } catch {
          setValues(initial);
          setSectionEntries(initialEntries);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, submissionId]);

  const sections = useMemo(() => {
    if (!submission) return [] as Section[];
    return [...submission.templateVersion.sections].sort((a, b) => a.sectionOrder - b.sectionOrder);
  }, [submission]);

  const currentSection = sections[sectionIndex];

  // Auto-save (debounced) — local IndexedDB first, server when online.
  // PR #111: FormDraftStore replaces the previous localStorage cache.
  // Sensitive-field guard inside save() means a forms engine template
  // that accidentally includes a "password" field would surface a
  // SensitiveFieldError instead of silently caching it.
  const persistDraft = useCallback(
    async (next: ValueMap, idx: number, entries: SectionEntriesState) => {
      if (!submission) return;
      if (user?.id) {
        try {
          await FormDraftStore.save(
            user.id,
            FORM_FILL_FORM_TYPE,
            submission.id,
            { values: next, sectionIndex: idx, sectionEntries: entries },
            FORM_FILL_SCHEMA_VERSION
          );
        } catch {
          // IDB unavailable / quota / sensitive-field — silent so the
          // form continues to function. Server save below is still tried.
        }
      }
      if (!online) {
        setSaveStatus("saved");
        return;
      }
      setSaveStatus("saving");
      try {
        const res = await authFetch(`/forms/submissions/${submission.id}/values`, {
          method: "PATCH",
          body: JSON.stringify({ values: next, sectionEntries: entries })
        });
        if (!res.ok) throw new Error(await res.text());
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    },
    [authFetch, online, submission, user?.id]
  );

  const scheduleSave = useCallback(
    (next: ValueMap, idx: number, entries: SectionEntriesState) => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        void persistDraft(next, idx, entries);
      }, 700);
    },
    [persistDraft]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  // GPS auto-capture once on mount
  useEffect(() => {
    if (!submission) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGps({ status: "error", message: "Geolocation not supported on this device." });
      return;
    }
    setGps({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ status: "ok", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGps({ status: "error", message: err.message }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
  }, [submission?.id]);

  // Reconnect: flush local draft to server
  useEffect(() => {
    if (online && submission && saveStatus === "error") {
      void persistDraft(values, sectionIndex, sectionEntries);
    }
  }, [online, submission, saveStatus, persistDraft, values, sectionIndex, sectionEntries]);

  const setValue = (fieldKey: string, value: unknown) => {
    const next = { ...values, [fieldKey]: value };
    setValues(next);
    if (errors[fieldKey]) {
      setErrors((prev) => {
        const out = { ...prev };
        delete out[fieldKey];
        return out;
      });
    }
    scheduleSave(next, sectionIndex, sectionEntries);
  };

  // F-3 — set the full entries list for one repeating section, then autosave.
  const setSectionEntriesFor = (sectionId: string, entries: Array<Record<string, unknown>>) => {
    const nextEntries = { ...sectionEntries, [sectionId]: entries };
    setSectionEntries(nextEntries);
    scheduleSave(values, sectionIndex, nextEntries);
  };

  const visibleFields = useMemo(() => {
    if (!currentSection) return [] as Field[];
    // Repeating sections render their fields per-entry via RepeatingSectionEntries
    // and are not part of the flat visibleFields flow (validation, card
    // progression). See F-3 scope note.
    if (currentSection.isRepeating) return [] as Field[];
    return currentSection.fields
      .slice()
      .sort((a, b) => a.fieldOrder - b.fieldOrder)
      .filter((f) => fieldVisible(f, values));
  }, [currentSection, values]);

  const validateSection = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const f of visibleFields) {
      if (fieldRequired(f, values) && isEmpty(values[f.fieldKey])) {
        newErrors[f.fieldKey] = `${f.label} is required.`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = () => {
    if (!validateSection()) return;
    const layout = resolveEffectiveLayout({
      templateLayout: readTemplateLayout(submission?.templateVersion.template.settings),
      viewportWidth
    });
    if (layout === "card") {
      const fieldsInSection = visibleFields.length;
      if (cardFieldIndex < fieldsInSection - 1) {
        setCardFieldIndex(cardFieldIndex + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (sectionIndex < sections.length - 1) {
        const next = sectionIndex + 1;
        setSectionIndex(next);
        setCardFieldIndex(0);
        scheduleSave(values, next, sectionEntries);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    if (sectionIndex < sections.length - 1) {
      const next = sectionIndex + 1;
      setSectionIndex(next);
      scheduleSave(values, next, sectionEntries);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goPrev = () => {
    const layout = resolveEffectiveLayout({
      templateLayout: readTemplateLayout(submission?.templateVersion.template.settings),
      viewportWidth
    });
    if (layout === "card") {
      if (cardFieldIndex > 0) {
        setCardFieldIndex(cardFieldIndex - 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (sectionIndex > 0) {
        const prev = sectionIndex - 1;
        const prevSection = sections[prev];
        const prevVisible = (prevSection.fields ?? []).filter((f) => fieldVisible(f, values));
        setSectionIndex(prev);
        setCardFieldIndex(Math.max(0, prevVisible.length - 1));
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    if (sectionIndex > 0) {
      const prev = sectionIndex - 1;
      setSectionIndex(prev);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const submit = async () => {
    if (!submission) return;
    // Validate ALL sections before submitting
    const allErrors: Record<string, string> = {};
    let firstErrorSection = -1;
    for (let i = 0; i < sections.length; i++) {
      // F-3: skip per-entry required checks for repeating sections at the
      // top level — that check belongs per-entry and is deferred.
      if (sections[i].isRepeating) continue;
      for (const f of sections[i].fields ?? []) {
        if (!fieldVisible(f, values)) continue;
        if (fieldRequired(f, values) && isEmpty(values[f.fieldKey])) {
          allErrors[f.fieldKey] = `${f.label} is required.`;
          if (firstErrorSection === -1) firstErrorSection = i;
        }
      }
    }
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      if (firstErrorSection >= 0) setSectionIndex(firstErrorSection);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Flush any pending values first
      await persistDraft(values, sectionIndex, sectionEntries);

      // GPS-A3: when the template requires geolocation, authenticated
      // submitters MUST include a fix. The mount-time capture is best-effort
      // (low accuracy, older reading acceptable); when it fell short, do one
      // fresh high-accuracy attempt here before hard-blocking. Public-link
      // submissions do not go through this component.
      let submitLat = gps.lat;
      let submitLng = gps.lng;
      if (submission.templateVersion.template.geolocationEnabled === true) {
        if (submitLat === undefined || submitLng === undefined) {
          const reading = await captureGpsReading();
          if (reading.ok) {
            submitLat = reading.reading.lat;
            submitLng = reading.reading.lng;
            setGps({ status: "ok", lat: reading.reading.lat, lng: reading.reading.lng });
          } else {
            setError(GPS_HARD_BLOCK_MSG);
            return;
          }
        }
      }

      const res = await authFetch(`/forms/submissions/${submission.id}/submit`, {
        method: "POST",
        body: JSON.stringify({
          gpsLat: submitLat,
          gpsLng: submitLng,
          // F-2c — echo prior acknowledgements. First submit sends empty;
          // subsequent submits after the WARN modal add the OK'd keys.
          acknowledgedWarnings: Array.from(ackKeys)
        })
      });
      if (res.status === 422) {
        const body = await res.json();
        if (body?.errors) {
          setErrors(body.errors as Record<string, string>);
        } else if (Array.isArray(body?.complianceFailures)) {
          setError(body.complianceFailures.join(" "));
        } else if (Array.isArray(body?.blocks)) {
          // F-2c BLOCK — hard-stop; no acknowledgement path.
          setError(body.blocks.join(" "));
        } else if (Array.isArray(body?.warnings)) {
          // F-2c WARN — surface an acknowledgement banner. When the user
          // OKs it, the ack keys land in ackKeys and the resubmit clears
          // the gate.
          setPendingWarnings(body.warnings as Array<{ key: string; message: string }>);
        } else {
          setError("Validation failed.");
        }
        return;
      }
      if (res.status === 400) {
        // GPS-A3: forms-engine returns 400 with a location-required message
        // when the template demands GPS and none was supplied. Surface the
        // shared hard-block copy either way.
        setError(GPS_HARD_BLOCK_MSG);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const body = (await res.json()) as { id: string; triggeredRecords?: Array<{ recordType: string; recordId: string }> };
      if (user?.id) {
        try {
          await FormDraftStore.delete(user.id, FORM_FILL_FORM_TYPE);
        } catch {
          // ignore — draft would be purged within 30 days anyway
        }
      }
      setSubmitted({
        ref: body.id,
        created: (body.triggeredRecords ?? []).map((r) => ({ type: r.recordType, id: r.recordId }))
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <SubmittedSuccess submitted={submitted} onDone={() => navigate("/forms")} />;
  }

  if (error && !submission) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "var(--status-danger)" }}>{error}</p>
        <Link to="/forms" className="s7-btn s7-btn--ghost">
          ← Back to forms
        </Link>
      </div>
    );
  }

  if (!submission || !currentSection) {
    return <div style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</div>;
  }

  const templateLayout: FormLayout | null = readTemplateLayout(submission.templateVersion.template.settings);
  const effectiveLayout = resolveEffectiveLayout({ templateLayout, viewportWidth });
  const isCard = effectiveLayout === "card";
  const cardStep = Math.min(cardFieldIndex, Math.max(0, visibleFields.length - 1));
  const currentCardField = isCard ? visibleFields[cardStep] : null;
  const cardFieldsRendered = isCard && currentCardField ? [currentCardField] : visibleFields;

  const templateSettings = submission.templateVersion.template.settings;
  const passThresholdPct = (() => {
    const raw = (templateSettings as { passThresholdPct?: number } | null | undefined)?.passThresholdPct;
    return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : null;
  })();
  const liveScore = computeLiveScore(sections, values, templateSettings);
  const showScore = liveScore.maxScore > 0;

  const totalSteps = isCard
    ? sections.reduce((n, s) => n + Math.max(1, s.fields.length), 0)
    : sections.length;
  const stepsBeforeCurrent = isCard
    ? sections.slice(0, sectionIndex).reduce((n, s) => n + Math.max(1, s.fields.length), 0) + cardStep + 1
    : sectionIndex + 1;
  const progressPct = Math.round((stepsBeforeCurrent / Math.max(1, totalSteps)) * 100);
  const isLastSection = sectionIndex === sections.length - 1;
  const isLastCardField = isCard ? cardStep >= visibleFields.length - 1 : true;
  const isLastStep = isCard ? isLastSection && isLastCardField : isLastSection;
  const isFirstStep = isCard ? sectionIndex === 0 && cardStep === 0 : sectionIndex === 0;
  const ctx: Record<string, string | undefined> = {
    ...((submission.context ?? {}) as Record<string, string | undefined>),
    ...(submission.siteId ? { siteId: submission.siteId } : {})
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 96px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Sticky header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          background: "var(--surface-app, #fff)",
          zIndex: 20,
          paddingTop: 4,
          paddingBottom: 8,
          borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.08))"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Link to="/forms" className="s7-btn s7-btn--ghost s7-btn--sm" aria-label="Back to forms">
            ←
          </Link>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600, flex: 1, textAlign: "center" }}>
            {submission.templateVersion.template.name}
          </h1>
          <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 70, textAlign: "right" }}>
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
                ? "✓ Saved"
                : saveStatus === "error"
                  ? "⚠ Not saved"
                  : ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {isCard
              ? `Step ${stepsBeforeCurrent} of ${totalSteps}`
              : `Section ${sectionIndex + 1} of ${sections.length}`}
          </span>
          <div style={{ flex: 1, height: 4, background: "var(--border-subtle, rgba(0,0,0,0.08))", borderRadius: 999, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "#FEAA6D",
                transition: "width 200ms ease"
              }}
            />
          </div>
        </div>
      </header>

      {!online ? (
        <div style={{ padding: "8px 12px", background: "#FEF3C7", color: "#92400E", borderRadius: 6, fontSize: 12 }}>
          📴 Offline — your progress is saved locally and will sync when you reconnect.
        </div>
      ) : null}

      {showScore ? (
        <div
          data-testid="form-fill-score"
          style={{
            padding: "8px 12px",
            background: "#F0F9FF",
            color: "#0369A1",
            borderRadius: 6,
            fontSize: 12,
            display: "flex",
            justifyContent: "space-between",
            gap: 8
          }}
        >
          <span>
            Running score: <strong>{liveScore.score.toFixed(2)}</strong> / {liveScore.maxScore.toFixed(2)}
            {liveScore.pct !== null ? <> · <strong>{liveScore.pct.toFixed(2)}%</strong></> : null}
          </span>
          {passThresholdPct !== null ? (
            <span>Pass threshold: {passThresholdPct}%</span>
          ) : null}
        </div>
      ) : null}

      {(ctx.jobId || ctx.projectId || ctx.supervisorId) ? (
        <details className="s7-card" style={{ padding: "8px 12px" }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}>
            Context
          </summary>
          <div style={{ fontSize: 12, marginTop: 6, color: "var(--text-muted)" }}>
            {ctx.jobId ? <div>Job ID: {ctx.jobId}</div> : null}
            {ctx.projectId ? <div>Project ID: {ctx.projectId}</div> : null}
            {ctx.supervisorId ? <div>Supervisor ID: {ctx.supervisorId}</div> : null}
          </div>
        </details>
      ) : null}

      <section>
        <h2 style={{ color: "#005B61", fontSize: 18, margin: "8px 0" }}>{currentSection.title}</h2>
        {currentSection.description ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0 }}>{currentSection.description}</p>
        ) : null}

        {currentSection.isRepeating ? (
          <RepeatingSectionEntries
            section={{
              id: currentSection.id,
              title: currentSection.title,
              minRepeat: currentSection.minRepeat ?? null,
              maxRepeat: currentSection.maxRepeat ?? null,
              fields: currentSection.fields
            }}
            entries={sectionEntries[currentSection.id] ?? []}
            onChange={(entries) => setSectionEntriesFor(currentSection.id, entries)}
            renderField={({ field, value, onChange }) => (
              <FieldRender
                key={field.id}
                field={field as Field}
                required={field.isRequired}
                value={value}
                onChange={onChange}
                context={ctx as Record<string, string | undefined>}
                gps={gps}
                responseSet={resolveResponseSet(field as Field, templateSettings)}
              />
            )}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {cardFieldsRendered.map((field) => {
              const required = fieldRequired(field, values);
              const errorMsg = errors[field.fieldKey];
              return (
                <FieldRender
                  key={field.id}
                  field={field}
                  required={required}
                  value={values[field.fieldKey]}
                  onChange={(v) => setValue(field.fieldKey, v)}
                  error={errorMsg}
                  context={ctx as Record<string, string | undefined>}
                  gps={gps}
                  responseSet={resolveResponseSet(field, templateSettings)}
                  values={values}
                />
              );
            })}
          </div>
        )}
      </section>

      {error ? <p style={{ color: "var(--status-danger)", fontSize: 13 }}>{error}</p> : null}

      {/* F-2c — WARN acknowledgement banner. Shown when the server returned
          `warnings` on the last submit; the submitter must OK each warning
          before the resubmit clears the gate. */}
      {pendingWarnings.length > 0 ? (
        <div
          role="alertdialog"
          aria-labelledby="warn-ack-heading"
          data-testid="warn-ack-banner"
          style={{
            border: "1px solid var(--status-warning, #f59e0b)",
            background: "rgba(245, 158, 11, 0.08)",
            padding: 12,
            borderRadius: 4
          }}
        >
          <h3 id="warn-ack-heading" style={{ margin: "0 0 8px", fontSize: 14 }}>
            Please review before submitting
          </h3>
          <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>
            {pendingWarnings.map((w) => (
              <li key={w.key}>{w.message}</li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              onClick={() => {
                setAckKeys(
                  (prev) =>
                    new Set<string>([...prev, ...pendingWarnings.map((w) => w.key)])
                );
                setPendingWarnings([]);
                void submit();
              }}
              data-testid="warn-ack-confirm"
            >
              I understand — submit anyway
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              onClick={() => setPendingWarnings([])}
            >
              Go back
            </button>
          </div>
        </div>
      ) : null}

      {submission.templateVersion.template.geolocationEnabled === true &&
      locationConsent === false ? (
        <ConsentPanel
          context="form"
          onAcknowledged={() => setLocationConsent(true)}
        />
      ) : null}

      {/* Footer nav */}
      <footer
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--surface-app, #fff)",
          paddingTop: 8,
          borderTop: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
          display: "flex",
          gap: 8,
          justifyContent: "space-between"
        }}
      >
        <button
          type="button"
          className="s7-btn s7-btn--ghost"
          onClick={goPrev}
          disabled={isFirstStep}
        >
          ← Previous
        </button>
        {isLastStep ? (
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            style={{ background: "#FEAA6D", color: "#242424", borderColor: "#FEAA6D", minWidth: 140 }}
            onClick={() => void submit()}
            disabled={
              submitting ||
              (submission.templateVersion.template.geolocationEnabled === true &&
                locationConsent === false)
            }
            title={
              submission.templateVersion.template.geolocationEnabled === true &&
              locationConsent === false
                ? GPS_HARD_BLOCK_MSG
                : undefined
            }
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        ) : (
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            style={{ background: "#FEAA6D", color: "#242424", borderColor: "#FEAA6D" }}
            onClick={goNext}
          >
            Next →
          </button>
        )}
      </footer>
    </div>
  );
}

// ── Field renderer (covers most-used types; advanced types fall back) ─────

function FieldRender({
  field,
  required,
  value,
  onChange,
  error,
  context,
  gps,
  responseSet,
  values
}: {
  field: Field;
  required: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  context: Record<string, string | undefined>;
  gps: { lat?: number; lng?: number; status: string; message?: string };
  responseSet: ResponseSet | null;
  values?: ValueMap;
}) {
  const config = (field.config ?? {}) as Record<string, unknown>;
  const options = (config.options ?? []) as string[];

  // Layout fields render without label scaffolding and never contribute a
  // FormSubmissionValue — no onChange call means no key in the values map.
  if (field.fieldType === "section_header" || field.fieldType === "heading") {
    return (
      <h3
        data-testid={`form-fill-${field.fieldKey.replace(/_/g, "-")}`}
        style={{ margin: "12px 0 4px", color: "#005B61", fontSize: 16 }}
      >
        {field.label}
      </h3>
    );
  }
  if (field.fieldType === "divider") {
    return (
      <hr
        data-testid={`form-fill-${field.fieldKey.replace(/_/g, "-")}`}
        style={{ border: 0, borderTop: "1px solid var(--border-subtle, rgba(0,0,0,0.08))" }}
      />
    );
  }
  if (field.fieldType === "instructions" || field.fieldType === "paragraph") {
    return (
      <div
        data-testid={`form-fill-${field.fieldKey.replace(/_/g, "-")}`}
        style={{ background: "var(--surface-muted, #F6F6F6)", padding: 12, borderRadius: 6, fontSize: 13 }}
      >
        {field.helpText ?? field.label}
      </div>
    );
  }
  if (field.fieldType === "image") {
    const cfg = (field.config ?? {}) as Record<string, unknown>;
    const src = String(cfg.imageUrl ?? "");
    return (
      <div data-testid={`form-fill-${field.fieldKey.replace(/_/g, "-")}`}>
        {src ? (
          <img
            src={src}
            alt={field.label}
            style={{ maxWidth: "100%", borderRadius: 6, display: "block" }}
          />
        ) : (
          <div
            style={{
              padding: 12,
              background: "var(--surface-muted, #F6F6F6)",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--text-muted)",
              textAlign: "center"
            }}
          >
            No image URL configured
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid={`form-fill-${field.fieldKey.replace(/_/g, "-")}`}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
        {field.label}
        {required ? <span style={{ color: "#FEAA6D", marginLeft: 4 }}>*</span> : null}
      </label>
      {field.helpText ? (
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 6px" }}>{field.helpText}</p>
      ) : null}
      <FieldInput
        field={field}
        value={value}
        onChange={onChange}
        options={options}
        context={context}
        gps={gps}
        responseSet={responseSet}
        values={values}
      />
      {error ? <p style={{ fontSize: 11, color: "var(--status-danger, #DC2626)", marginTop: 4 }}>{error}</p> : null}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  options,
  context,
  gps,
  responseSet,
  values
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  options: string[];
  context: Record<string, string | undefined>;
  gps: { lat?: number; lng?: number; status: string; message?: string };
  responseSet: ResponseSet | null;
  values?: ValueMap;
}) {
  const t = field.fieldType;
  const config = (field.config ?? {}) as Record<string, unknown>;

  // Inspection-scored choice fields render as colour-coded response-set
  // buttons regardless of the underlying dropdown/radio field type — the
  // response set is what the inspector cares about, not the widget flavour.
  if (
    responseSet &&
    (t === "radio" || t === "dropdown" || t === "button_group" || t === "multiple_choice")
  ) {
    return <ResponseSetInput field={field} value={value} onChange={onChange} responseSet={responseSet} />;
  }

  switch (t) {
    case "short_text":
    case "url":
      return (
        <input
          type="text"
          className="s7-input"
          placeholder={field.placeholder ?? ""}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "long_text":
      return (
        <textarea
          className="s7-textarea"
          rows={3}
          placeholder={field.placeholder ?? ""}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "email":
      return (
        <input
          type="email"
          inputMode="email"
          className="s7-input"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "phone":
      return (
        <input
          type="tel"
          inputMode="tel"
          className="s7-input"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "number":
      return (
        <input
          type="number"
          inputMode="decimal"
          className="s7-input"
          value={(value as number | string) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "currency":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: "var(--text-muted)" }}>$</span>
          <input
            type="number"
            inputMode="decimal"
            className="s7-input"
            value={(value as number | string) ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            style={{ flex: 1, fontSize: 14, padding: 10 }}
          />
        </div>
      );
    case "percentage":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="number"
            inputMode="decimal"
            className="s7-input"
            value={(value as number | string) ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            style={{ flex: 1, fontSize: 14, padding: 10 }}
          />
          <span style={{ color: "var(--text-muted)" }}>%</span>
        </div>
      );
    case "date":
      return (
        <input
          type="date"
          className="s7-input"
          value={dateInputValue(value, "date")}
          onChange={(e) => onChange(e.target.value || null)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "time":
      return (
        <input
          type="time"
          className="s7-input"
          value={dateInputValue(value, "time")}
          onChange={(e) => onChange(e.target.value || null)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "datetime":
      return (
        <input
          type="datetime-local"
          className="s7-input"
          value={dateInputValue(value, "datetime")}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "dropdown":
      return (
        <select
          className="s7-input"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "multi_select":
    case "checkbox": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {options.map((o) => {
            const checked = arr.includes(o);
            return (
              <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked ? [...arr, o] : arr.filter((x) => x !== o);
                    onChange(next);
                  }}
                  style={{ width: 20, height: 20 }}
                />
                {o}
              </label>
            );
          })}
        </div>
      );
    }
    case "radio":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {options.map((o) => {
            const checked = value === o;
            return (
              <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, fontSize: 14 }}>
                <input
                  type="radio"
                  name={field.fieldKey}
                  checked={checked}
                  onChange={() => onChange(o)}
                  style={{ width: 20, height: 20 }}
                />
                {o}
              </label>
            );
          })}
        </div>
      );
    case "toggle": {
      const v = Boolean(value);
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, cursor: "pointer" }}>
          <button
            type="button"
            role="switch"
            aria-checked={v}
            onClick={() => onChange(!v)}
            style={{
              width: 48,
              height: 28,
              borderRadius: 999,
              background: v ? "#FEAA6D" : "#CBD5E1",
              border: "none",
              position: "relative",
              padding: 0,
              cursor: "pointer"
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: v ? 23 : 3,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 120ms ease"
              }}
            />
          </button>
          <span>{v ? "Yes" : "No"}</span>
        </label>
      );
    }
    case "button_group":
      return (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {options.map((o) => {
            const active = value === o;
            return (
              <button
                key={o}
                type="button"
                onClick={() => onChange(o)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid",
                  borderColor: active ? "#FEAA6D" : "var(--border-subtle, rgba(0,0,0,0.12))",
                  background: active ? "#FEAA6D" : "var(--surface-card, #fff)",
                  color: active ? "#242424" : "var(--text-default)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    case "rating": {
      const max = Number(config.maxRating ?? 5);
      const rating = Number(value ?? 0);
      return (
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} stars`}
              onClick={() => onChange(n)}
              style={{
                width: 40,
                height: 40,
                fontSize: 28,
                background: "transparent",
                border: "none",
                color: rating >= n ? "#FEAA6D" : "#CBD5E1",
                cursor: "pointer"
              }}
            >
              ★
            </button>
          ))}
        </div>
      );
    }
    case "scale":
    case "nps": {
      const isNps = t === "nps";
      const min = Number(config.min ?? (isNps ? 0 : 1));
      const max = Number(config.max ?? (isNps ? 10 : 5));
      const minLabel = String(config.minLabel ?? "");
      const maxLabel = String(config.maxLabel ?? "");
      const active = value === null || value === undefined ? null : Number(value);
      const steps = Math.max(2, Math.min(max - min + 1, 21));
      const points = Array.from({ length: steps }, (_, i) => min + i);
      return (
        <div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {points.map((n) => {
              const on = active === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-label={`Score ${n}`}
                  aria-pressed={on}
                  onClick={() => onChange(n)}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    padding: "0 12px",
                    borderRadius: 6,
                    border: "1px solid",
                    borderColor: on ? "#FEAA6D" : "var(--border-subtle, rgba(0,0,0,0.12))",
                    background: on ? "#FEAA6D" : "var(--surface-card, #fff)",
                    color: on ? "#242424" : "var(--text-default)",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
          {minLabel || maxLabel ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 6,
                fontSize: 11,
                color: "var(--text-muted)"
              }}
            >
              <span>{minLabel}</span>
              <span>{maxLabel}</span>
            </div>
          ) : null}
        </div>
      );
    }
    case "system_field": {
      const source = String(config.source ?? "");
      const lookup: Record<string, string | undefined> = {
        job: context.jobId,
        project: context.projectId,
        supervisor: context.supervisorId,
        worker: undefined
      };
      const display = lookup[source] ?? "(auto)";
      return (
        <div
          style={{
            padding: 10,
            background: "var(--surface-muted, #F6F6F6)",
            borderRadius: 6,
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between"
          }}
        >
          <span>{display}</span>
          <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>auto</span>
        </div>
      );
    }
    case "gps":
      return (
        <div style={{ padding: 10, background: "var(--surface-muted, #F6F6F6)", borderRadius: 6, fontSize: 13 }}>
          {gps.status === "loading"
            ? "📍 Getting location…"
            : gps.status === "ok"
              ? `📍 ${gps.lat?.toFixed(5)}, ${gps.lng?.toFixed(5)}`
              : `📍 ${gps.message ?? "Location unavailable"}`}
        </div>
      );
    case "address": {
      const v = (value as Record<string, string> | null) ?? { street: "", suburb: "", state: "QLD", postcode: "" };
      return (
        <div style={{ display: "grid", gap: 6 }}>
          <input className="s7-input" placeholder="Street" value={v.street ?? ""} onChange={(e) => onChange({ ...v, street: e.target.value })} style={{ padding: 10 }} />
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 6 }}>
            <input className="s7-input" placeholder="Suburb" value={v.suburb ?? ""} onChange={(e) => onChange({ ...v, suburb: e.target.value })} style={{ padding: 10 }} />
            <input className="s7-input" placeholder="State" value={v.state ?? "QLD"} onChange={(e) => onChange({ ...v, state: e.target.value })} style={{ padding: 10 }} />
            <input className="s7-input" placeholder="Postcode" value={v.postcode ?? ""} onChange={(e) => onChange({ ...v, postcode: e.target.value })} style={{ padding: 10 }} />
          </div>
        </div>
      );
    }
    case "signature":
      return <SignaturePad value={value as string | null} onChange={onChange} />;
    case "photo":
    case "image_capture":
    case "file":
      return (
        <PhotoInput
          value={value as string[] | null}
          onChange={onChange}
          minCount={Number(config.minCount ?? 0)}
          maxCount={Number(config.maxCount ?? 5)}
          cameraOnly={Boolean(config.cameraOnly)}
          stampLocation={Boolean(config.stampLocation)}
          stampTime={Boolean(config.stampTime)}
          allowAnnotation={Boolean(config.allowAnnotation)}
          gps={gps}
        />
      );
    case "lookup":
      return <LookupInput field={field} value={value} onChange={onChange} values={values} />;
    case "existing_site":
      return <ExistingSiteInput field={field} value={value} onChange={onChange} />;
    case "worker_picker":
      return <WorkerPicker field={field} value={value as string | null} onChange={onChange} context={context} />;
    case "asset_picker":
      return <AssetPicker field={field} value={value as string | null} onChange={onChange} context={context} />;
    case "location_stamp":
      return <LocationStamp value={value as { lat: number; lng: number; capturedAt: string } | null} onChange={onChange} gps={gps} />;
    case "calculation":
      return <CalculationDisplay field={field} values={values ?? {}} />;
    case "unique_id":
      return <UniqueIdDisplay value={value} />;
    case "table":
      return <TableInput field={field} value={value} onChange={onChange} />;
    case "terms":
      return <TermsInput field={field} value={value} onChange={onChange} />;
    default:
      // matrix, barcode, slider, likert — defer
      return (
        <div style={{ padding: 10, background: "#FEF3C7", color: "#92400E", borderRadius: 6, fontSize: 12 }}>
          Field type "{t}" — fill on a desktop browser (advanced field types in next release).
        </div>
      );
  }
}

function dateInputValue(value: unknown, kind: "date" | "time" | "datetime"): string {
  if (!value) return "";
  if (typeof value === "string") {
    if (kind === "date") return value.slice(0, 10);
    if (kind === "time") return value.length > 5 ? value.slice(11, 16) : value;
    return value.slice(0, 16);
  }
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    if (kind === "date") return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    if (kind === "time") return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }
  return "";
}

// ── Signature pad ────────────────────────────────────────────────────────

function SignaturePad({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = value;
  }, [value]);

  const getPos = (e: PointerEvent | React.PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.strokeStyle = "#242424";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  };
  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        data-testid="form-fill-signature-canvas"
        width={600}
        height={160}
        style={{
          width: "100%",
          height: 160,
          border: "1px dashed var(--border-subtle, rgba(0,0,0,0.2))",
          borderRadius: 6,
          background: "#fff",
          touchAction: "none"
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sign above</span>
        <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  );
}

// ── Photo / file input — stores as base64 strings in valueJson ───────────
//
// F-5 config keys:
//   minCount:        block submit until at least N photos are attached
//   maxCount:        hard cap on attachments
//   cameraOnly:      omit the file-picker fallback (capture=environment only)
//   stampLocation:   burn the current GPS reading onto the image as a caption
//   stampTime:       burn the capture timestamp onto the image as a caption
//   allowAnnotation: expose a simple freehand annotate overlay for each photo

function PhotoInput({
  value,
  onChange,
  minCount,
  maxCount,
  cameraOnly,
  stampLocation,
  stampTime,
  allowAnnotation,
  gps
}: {
  value: string[] | null;
  onChange: (v: string[] | null) => void;
  minCount: number;
  maxCount: number;
  cameraOnly: boolean;
  stampLocation: boolean;
  stampTime: boolean;
  allowAnnotation: boolean;
  gps: { lat?: number; lng?: number; status: string; message?: string };
}) {
  const photos = Array.isArray(value) ? value : [];
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [annotateIdx, setAnnotateIdx] = useState<number | null>(null);

  const stampImage = (src: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const captions: string[] = [];
        if (stampTime) captions.push(new Date().toLocaleString());
        if (stampLocation && typeof gps.lat === "number" && typeof gps.lng === "number") {
          captions.push(`${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`);
        }
        if (captions.length > 0) {
          const fontSize = Math.max(14, Math.round(canvas.height / 30));
          ctx.font = `${fontSize}px sans-serif`;
          const text = captions.join(" | ");
          const padding = 6;
          const textWidth = ctx.measureText(text).width;
          const bandHeight = fontSize + padding * 2;
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillRect(0, canvas.height - bandHeight, textWidth + padding * 2, bandHeight);
          ctx.fillStyle = "#fff";
          ctx.textBaseline = "bottom";
          ctx.fillText(text, padding, canvas.height - padding);
        }
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const next = [...photos];
    for (const file of Array.from(files)) {
      if (next.length >= maxCount) break;
      const raw = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const stamped = stampLocation || stampTime ? await stampImage(raw) : raw;
      next.push(stamped);
    }
    onChange(next.length > 0 ? next : null);
  };

  const remove = (idx: number) => {
    const next = photos.filter((_, i) => i !== idx);
    onChange(next.length > 0 ? next : null);
  };

  const replaceAt = (idx: number, dataUrl: string) => {
    const next = [...photos];
    next[idx] = dataUrl;
    onChange(next);
  };

  const belowMin = minCount > 0 && photos.length < minCount;

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        {...(cameraOnly ? { capture: "environment" as const } : { capture: "environment" as const, multiple: true })}
        style={{ display: "none" }}
        onChange={(e) => void onFiles(e.target.files)}
      />
      <button
        type="button"
        className="s7-btn s7-btn--secondary"
        onClick={() => inputRef.current?.click()}
        disabled={photos.length >= maxCount}
        style={{ width: "100%", padding: 12 }}
      >
        📷 {photos.length === 0 ? "Take photo / attach" : `Add another (${photos.length}/${maxCount})`}
      </button>
      {belowMin ? (
        <p style={{ fontSize: 11, color: "var(--status-danger, #DC2626)", marginTop: 4 }}>
          At least {minCount} {minCount === 1 ? "photo" : "photos"} required.
        </p>
      ) : null}
      {photos.length > 0 ? (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {photos.map((src, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img
                src={src}
                alt={`Attachment ${i + 1}`}
                style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))" }}
              />
              {allowAnnotation ? (
                <button
                  type="button"
                  onClick={() => setAnnotateIdx(i)}
                  aria-label="Annotate"
                  style={{
                    position: "absolute",
                    bottom: -6,
                    right: -6,
                    width: 22,
                    height: 22,
                    background: "#005B61",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50%",
                    fontSize: 11,
                    cursor: "pointer"
                  }}
                >
                  ✎
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove"
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 20,
                  height: 20,
                  background: "#DC2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  fontSize: 12,
                  cursor: "pointer"
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {annotateIdx !== null && photos[annotateIdx] ? (
        <PhotoAnnotator
          src={photos[annotateIdx]}
          onClose={() => setAnnotateIdx(null)}
          onSave={(dataUrl) => {
            replaceAt(annotateIdx, dataUrl);
            setAnnotateIdx(null);
          }}
        />
      ) : null}
    </div>
  );
}

// F-5 — minimal freehand annotator. Draws the source image into a canvas
// and lets the user scribble on top; on Save we export a fresh data URL so
// the annotation is baked into the persisted attachment.
function PhotoAnnotator({
  src,
  onClose,
  onSave
}: {
  src: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
    };
    img.src = src;
  }, [src]);

  const getPos = (e: React.PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height
    };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.strokeStyle = "#DC2626";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const onPointerUp = () => {
    drawingRef.current = false;
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div
      role="dialog"
      aria-label="Annotate photo"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        flexDirection: "column",
        padding: 12,
        zIndex: 1000
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ flex: 1, background: "#fff", touchAction: "none", maxWidth: "100%", objectFit: "contain" }}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} style={{ flex: 1 }}>
          Cancel
        </button>
        <button type="button" className="s7-btn s7-btn--primary" onClick={save} style={{ flex: 1 }}>
          Save annotation
        </button>
      </div>
    </div>
  );
}

// ── F-5 WHS pickers ──────────────────────────────────────────────────────

type WorkerOption = {
  id: string;
  name: string;
  role: string;
  competency: {
    allowed: boolean;
    missing: string[];
    expired: string[];
    expiringSoon: string[];
  } | null;
};

function WorkerPicker({
  field,
  value,
  onChange,
  context
}: {
  field: Field;
  value: string | null;
  onChange: (v: unknown) => void;
  context: Record<string, string | undefined>;
}) {
  const { authFetch } = useAuth();
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cfg = (field.config ?? {}) as {
    prefillFromAllocation?: boolean;
    checkCompetency?: boolean;
    requiredQuals?: string[];
  };
  const requiredQuals = Array.isArray(cfg.requiredQuals) ? cfg.requiredQuals : [];
  const shouldCheck = Boolean(cfg.checkCompetency) && requiredQuals.length > 0;
  const prefilledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = shouldCheck ? `?requiredQuals=${encodeURIComponent(requiredQuals.join(","))}` : "";
    (async () => {
      try {
        const res = await authFetch(`/forms/worker-options${qs}`);
        if (!res.ok) throw new Error("Could not load workers");
        const body = (await res.json()) as WorkerOption[];
        if (!cancelled) setWorkers(body);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, shouldCheck, requiredQuals.join(",")]);

  // F-5 — prefillFromAllocation: use the filler's own allocationId from
  // context to pre-select their worker profile if the picker is currently
  // empty. Only fires once per mount so a user can still clear the field.
  useEffect(() => {
    if (prefilledRef.current) return;
    if (!cfg.prefillFromAllocation) return;
    if (value) return;
    if (workers.length === 0) return;
    prefilledRef.current = true;
    // If the caller passed a workerId hint through context.workerId (set by
    // FormsEngineService.createDraft when the filler has an active timesheet
    // linked to a worker profile), honour it.
    const hint = context.workerId ?? context.workerProfileId;
    if (hint && workers.some((w) => w.id === hint)) onChange(hint);
  }, [workers, cfg.prefillFromAllocation, value, context.workerId, context.workerProfileId, onChange]);

  const selected = workers.find((w) => w.id === value) ?? null;
  const showWarning =
    shouldCheck && selected?.competency && !selected.competency.allowed;

  return (
    <>
      <select
        className="s7-input"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={loading}
        style={{ width: "100%", fontSize: 14, padding: 10 }}
        aria-label={field.label}
      >
        <option value="">{loading ? "Loading…" : "Select a worker…"}</option>
        {workers.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
            {w.role ? ` — ${w.role}` : ""}
          </option>
        ))}
      </select>
      {error ? (
        <p style={{ fontSize: 11, color: "var(--status-danger, #DC2626)", marginTop: 4 }}>{error}</p>
      ) : null}
      {showWarning && selected?.competency ? (
        <div
          role="alert"
          style={{
            marginTop: 6,
            padding: 8,
            background: "#FEF3C7",
            color: "#92400E",
            borderRadius: 6,
            fontSize: 12
          }}
        >
          Competency warning:{" "}
          {selected.competency.missing.length > 0
            ? `missing ${selected.competency.missing.join(", ")}`
            : ""}
          {selected.competency.expired.length > 0
            ? ` expired ${selected.competency.expired.join(", ")}`
            : ""}
        </div>
      ) : null}
    </>
  );
}

type AssetOption = {
  id: string;
  name: string;
  assetCode: string;
  status: string;
  maintenanceSummary: {
    nextDueAt: string | null;
    overdue: boolean;
    lastServicedAt: string | null;
  };
};

function AssetPicker({
  field,
  value,
  onChange,
  context
}: {
  field: Field;
  value: string | null;
  onChange: (v: unknown) => void;
  context: Record<string, string | undefined>;
}) {
  const { authFetch } = useAuth();
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cfg = (field.config ?? {}) as {
    siteFiltered?: boolean;
    showServiceWarnings?: boolean;
  };
  const siteFiltered = cfg.siteFiltered !== false;
  const showWarnings = cfg.showServiceWarnings !== false;
  const siteId = siteFiltered ? context.siteId : undefined;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const qs = siteId ? `?siteId=${encodeURIComponent(siteId)}` : "";
    (async () => {
      try {
        const res = await authFetch(`/forms/asset-options${qs}`);
        if (!res.ok) throw new Error("Could not load assets");
        const body = (await res.json()) as AssetOption[];
        if (!cancelled) setAssets(body);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, siteId]);

  const selected = assets.find((a) => a.id === value) ?? null;

  return (
    <>
      <select
        className="s7-input"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={loading}
        style={{ width: "100%", fontSize: 14, padding: 10 }}
        aria-label={field.label}
      >
        <option value="">{loading ? "Loading…" : "Select an asset…"}</option>
        {assets.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.assetCode})
          </option>
        ))}
      </select>
      {error ? (
        <p style={{ fontSize: 11, color: "var(--status-danger, #DC2626)", marginTop: 4 }}>{error}</p>
      ) : null}
      {showWarnings && selected?.maintenanceSummary.overdue ? (
        <div
          role="alert"
          style={{
            marginTop: 6,
            padding: 8,
            background: "#FEE2E2",
            color: "#991B1B",
            borderRadius: 6,
            fontSize: 12
          }}
        >
          Service overdue — next due{" "}
          {selected.maintenanceSummary.nextDueAt
            ? new Date(selected.maintenanceSummary.nextDueAt).toLocaleDateString()
            : "unknown"}
          .
        </div>
      ) : null}
    </>
  );
}

// LocationStamp — captures navigator.geolocation at fill time and stores
// { lat, lng, capturedAt } in valueJson. The mount-time submission GPS
// reading (submission.gpsLat/lng) is the source of truth for scanning /
// reporting; the LocationStamp field is a per-field record of where the
// filler said they were when this section was completed.
function LocationStamp({
  value,
  onChange,
  gps
}: {
  value: { lat: number; lng: number; capturedAt: string } | null;
  onChange: (v: unknown) => void;
  gps: { lat?: number; lng?: number; status: string; message?: string };
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const capture = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErr("Geolocation not supported on this device.");
      return;
    }
    setBusy(true);
    setErr(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          capturedAt: new Date().toISOString()
        });
        setBusy(false);
      },
      (e) => {
        setErr(e.message);
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  // If the outer GPS auto-capture has a fix and we don't have a value yet,
  // seed with that reading so a field marked required doesn't nag the user
  // twice for the same permission.
  useEffect(() => {
    if (value) return;
    if (typeof gps.lat !== "number" || typeof gps.lng !== "number") return;
    onChange({ lat: gps.lat, lng: gps.lng, capturedAt: new Date().toISOString() });
  }, [gps.lat, gps.lng, value, onChange]);

  return (
    <div>
      <button
        type="button"
        className="s7-btn s7-btn--secondary"
        onClick={capture}
        disabled={busy}
        style={{ width: "100%", padding: 12 }}
      >
        {busy ? "Capturing…" : value ? "Recapture location" : "Capture location"}
      </button>
      {value ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
          {value.lat.toFixed(5)}, {value.lng.toFixed(5)} · {new Date(value.capturedAt).toLocaleString()}
        </p>
      ) : null}
      {err ? (
        <p style={{ fontSize: 11, color: "var(--status-danger, #DC2626)", marginTop: 4 }}>{err}</p>
      ) : null}
    </div>
  );
}

// ── Success screen ───────────────────────────────────────────────────────

function SubmittedSuccess({
  submitted,
  onDone
}: {
  submitted: { ref: string; created: { type: string; id: string }[] };
  onDone: () => void;
}) {
  return (
    <div style={{ padding: 32, maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
      <div
        aria-hidden
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "#16A34A",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
          fontSize: 40
        }}
      >
        ✓
      </div>
      <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Form submitted</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 16px" }}>
        Reference: {submitted.ref}
      </p>
      {submitted.created.length > 0 ? (
        <div style={{ background: "var(--surface-muted, #F6F6F6)", padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          <strong>This submission created:</strong>
          <ul style={{ margin: "6px 0 0", padding: "0 0 0 18px" }}>
            {submitted.created.map((r) => (
              <li key={r.id}>{r.type.replace(/_/g, " ")} — {r.id.slice(0, 8)}…</li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        className="s7-btn s7-btn--primary"
        onClick={onDone}
        style={{ background: "#FEAA6D", color: "#242424", borderColor: "#FEAA6D", padding: "10px 24px" }}
      >
        Done
      </button>
    </div>
  );
}

// ── Advanced field inputs (F-4) ────────────────────────────────────────────

/**
 * Lookup — resolves options from `/lists/:slug/items` at fill time.
 *
 * The list of sources is authored on the template (`config.listSlug`), never
 * hardcoded here; this component just fetches whichever slug the designer
 * chose. Renders as a dropdown so it degrades gracefully on mobile.
 *
 * Nested lookup: when `config.dependsOnFieldKey` is set, the current value of
 * that sibling field is appended as `?parentValue=<value>` on the fetch so the
 * API can filter items by parent. The full items list is fetched whenever the
 * parent value changes; if the parent field is blank the fetch is skipped and
 * the dropdown shows "Select a parent value first".
 *
 * Note: the current global-lists API (`GET /lists/:slug/items`) does not yet
 * filter by parentValue server-side. When a `dependsOnFieldKey` is configured
 * the component appends the query param so a future API enhancement can act on
 * it without a client change. Until then, the full list is returned and all
 * items are shown (no client-side filtering — the designer must structure the
 * list data to be inherently scoped or wait for the API enhancement).
 */
function LookupInput({
  field,
  value,
  onChange,
  values
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  values?: ValueMap;
}) {
  const { authFetch } = useAuth();
  const config = (field.config ?? {}) as Record<string, unknown>;
  const slug = String(config.listSlug ?? "").trim();
  const dependsOnFieldKey = String(config.parentFieldKey ?? "").trim();
  const parentValue = dependsOnFieldKey && values ? String(values[dependsOnFieldKey] ?? "") : "";
  const [items, setItems] = useState<Array<{ id: string; value: string; label: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    // When a parent dependency is configured but no parent value is selected yet,
    // clear the list and wait — avoids a spurious full-list fetch.
    if (dependsOnFieldKey && !parentValue) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const qs = parentValue ? `?parentValue=${encodeURIComponent(parentValue)}` : "";
        const res = await authFetch(`/lists/${encodeURIComponent(slug)}/items${qs}`);
        if (!res.ok) throw new Error(`Could not load list "${slug}"`);
        const body = (await res.json()) as Array<{ id: string; value?: string; label: string }>;
        if (!cancelled) {
          setItems(
            body.map((row) => ({ id: row.id, value: row.value ?? row.label, label: row.label }))
          );
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, slug, dependsOnFieldKey, parentValue]);

  if (!slug) {
    return (
      <div style={{ padding: 10, background: "#FEF3C7", color: "#92400E", borderRadius: 6, fontSize: 12 }}>
        Lookup source not configured — set a list slug on the template.
      </div>
    );
  }
  if (dependsOnFieldKey && !parentValue) {
    return (
      <div style={{ padding: 10, background: "var(--surface-muted, #F6F6F6)", borderRadius: 6, fontSize: 13, color: "var(--text-muted)" }}>
        Select a value in the parent field first.
      </div>
    );
  }
  return (
    <>
      <select
        className="s7-input"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={loading}
        style={{ width: "100%", fontSize: 14, padding: 10 }}
      >
        <option value="">{loading ? "Loading…" : "Select…"}</option>
        {items.map((it) => (
          <option key={it.id} value={it.value}>
            {it.label}
          </option>
        ))}
      </select>
      {error ? (
        <p style={{ fontSize: 11, color: "var(--status-danger, #DC2626)", marginTop: 4 }}>{error}</p>
      ) : null}
    </>
  );
}

/**
 * Existing site picker — dropdown of Site rows sourced from the forms
 * engine (`GET /forms/site-options`). Value stored on the submission is
 * the Site.id string; required-field enforcement is handled by the
 * generic `fieldRequired && isEmpty` check in `validateSection` and by
 * the server's `validateExistingSiteValues` at submit time.
 */
function ExistingSiteInput({
  field,
  value,
  onChange
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const { authFetch } = useAuth();
  const [sites, setSites] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await authFetch(`/forms/site-options`);
        if (!res.ok) throw new Error(`Could not load sites`);
        const body = (await res.json()) as Array<{ id: string; name: string }>;
        if (!cancelled) setSites(body);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  return (
    <>
      <select
        className="s7-input"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        disabled={loading}
        style={{ width: "100%", fontSize: 14, padding: 10 }}
        aria-label={field.label}
      >
        <option value="">{loading ? "Loading…" : "Select a site…"}</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {error ? (
        <p style={{ fontSize: 11, color: "var(--status-danger, #DC2626)", marginTop: 4 }}>{error}</p>
      ) : null}
    </>
  );
}

/**
 * Compute a calculation result client-side from the live value map.
 * Mirrors the server's `computeCalculation` in forms-engine.service.ts so the
 * displayed number stays in sync as the user edits operand fields. The server
 * always recomputes on submit — this is presentational only.
 */
function clientComputeCalculation(
  operation: string,
  operands: number[],
  decimals: number
): number | null {
  if (operands.length === 0) return null;
  let raw: number;
  switch (operation) {
    case "sum":
      raw = operands.reduce((a, b) => a + b, 0);
      break;
    case "difference":
      raw = operands.slice(1).reduce((a, b) => a - b, operands[0]);
      break;
    case "product":
      raw = operands.reduce((a, b) => a * b, 1);
      break;
    case "average":
      raw = operands.reduce((a, b) => a + b, 0) / operands.length;
      break;
    case "min":
      raw = Math.min(...operands);
      break;
    case "max":
      raw = Math.max(...operands);
      break;
    default:
      return null;
  }
  const factor = Math.pow(10, Math.max(0, Math.min(6, decimals)));
  return Math.round(raw * factor) / factor;
}

/**
 * Calculation — read-only display. Computes the live result from `values` so
 * the number updates as the user fills operand fields. The server always
 * recomputes on submit and the authoritative value is what the server returns;
 * this is presentational only — do NOT call onChange.
 */
function CalculationDisplay({ field, values }: { field: Field; values: ValueMap }) {
  const config = (field.config ?? {}) as Record<string, unknown>;
  const operation = String(config.operation ?? "sum");
  const operandKeys = Array.isArray(config.operandKeys) ? (config.operandKeys as string[]) : [];
  const decimals = typeof config.decimals === "number" ? config.decimals : 2;

  const operands = operandKeys
    .map((key) => values[key])
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((n) => Number.isFinite(n));
  const result = clientComputeCalculation(operation, operands, decimals);

  return (
    <div
      style={{
        padding: 10,
        background: "var(--surface-muted, #F6F6F6)",
        borderRadius: 6,
        fontSize: 13,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}
    >
      <span>
        {result !== null ? result.toLocaleString() : "—"}
      </span>
      <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
        {operation}
      </span>
    </div>
  );
}

/**
 * Unique ID — read-only display. The server generates the ID atomically on
 * submit from the FormNumberSequence row-locked counter. Before submission the
 * field shows a placeholder; after submission the assigned ID is returned in
 * the submission values and is displayed here. The client never generates or
 * modifies this value.
 */
function UniqueIdDisplay({ value }: { value: unknown }) {
  const assigned = value !== null && value !== undefined && String(value).trim() !== "";
  return (
    <div
      style={{
        padding: 10,
        background: "var(--surface-muted, #F6F6F6)",
        borderRadius: 6,
        fontSize: 13,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}
    >
      <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
        {assigned ? String(value) : "(will be assigned on submit)"}
      </span>
      <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
        auto
      </span>
    </div>
  );
}

type TableRow = Record<string, unknown>;

/**
 * Table — repeating rows of sub-fields.
 *
 * F-3 (repeating sections + entryIndex) has not landed yet; this keeps the
 * table entirely self-contained inside `FormField.config`, storing rows as a
 * `TableRow[]` in the submission value's JSON column. When F-3 lands the two
 * models can be reconciled without a data migration since both are opaque
 * JSON to the value column.
 */
function TableInput({
  field,
  value,
  onChange
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const config = (field.config ?? {}) as Record<string, unknown>;
  const columns = Array.isArray(config.columns)
    ? (config.columns as Array<{ key: string; label: string; fieldType: string }>)
    : [];
  const minRows = Math.max(0, Number(config.minRows ?? 1));
  const maxRows = Math.max(minRows, Number(config.maxRows ?? 20));

  const rows: TableRow[] = Array.isArray(value)
    ? (value as TableRow[])
    : Array.from({ length: minRows }, () => ({}));

  const setRows = (next: TableRow[]) => onChange(next);
  const updateCell = (rowIdx: number, key: string, cell: unknown) => {
    const next = rows.map((row, i) => (i === rowIdx ? { ...row, [key]: cell } : row));
    setRows(next);
  };
  const addRow = () => {
    if (rows.length >= maxRows) return;
    setRows([...rows, {}]);
  };
  const removeRow = (rowIdx: number) => {
    if (rows.length <= minRows) return;
    setRows(rows.filter((_, i) => i !== rowIdx));
  };

  if (columns.length === 0) {
    return (
      <div style={{ padding: 10, background: "#FEF3C7", color: "#92400E", borderRadius: 6, fontSize: 12 }}>
        Table has no columns configured yet.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: "left",
                  padding: "6px 8px",
                  borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
                  fontWeight: 600
                }}
              >
                {col.label}
              </th>
            ))}
            <th style={{ width: 36 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {columns.map((col) => (
                <td key={col.key} style={{ padding: 4 }}>
                  <TableCellInput
                    fieldType={col.fieldType}
                    value={row[col.key]}
                    onChange={(cell) => updateCell(rowIdx, col.key, cell)}
                  />
                </td>
              ))}
              <td style={{ padding: 4 }}>
                <button
                  type="button"
                  onClick={() => removeRow(rowIdx)}
                  disabled={rows.length <= minRows}
                  aria-label="Remove row"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: rows.length <= minRows ? "var(--text-muted)" : "#DC2626",
                    cursor: rows.length <= minRows ? "not-allowed" : "pointer",
                    fontSize: 16
                  }}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="s7-btn s7-btn--ghost s7-btn--sm"
        onClick={addRow}
        disabled={rows.length >= maxRows}
        style={{ marginTop: 6 }}
      >
        + Add row
      </button>
    </div>
  );
}

function TableCellInput({
  fieldType,
  value,
  onChange
}: {
  fieldType: string;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (fieldType === "number") {
    return (
      <input
        type="number"
        className="s7-input"
        value={(value as number | string | undefined) ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        style={{ width: "100%", padding: 6, fontSize: 13 }}
      />
    );
  }
  if (fieldType === "date") {
    return (
      <input
        type="date"
        className="s7-input"
        value={typeof value === "string" ? value.slice(0, 10) : ""}
        onChange={(e) => onChange(e.target.value || null)}
        style={{ width: "100%", padding: 6, fontSize: 13 }}
      />
    );
  }
  if (fieldType === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }
  return (
    <input
      type="text"
      className="s7-input"
      value={(value as string | undefined) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", padding: 6, fontSize: 13 }}
    />
  );
}

/**
 * ResponseSetInput — colour-coded pass/fail buttons for an inspection field.
 *
 * Renders one button per option; when selected the button paints in the
 * option's colour (defaults keyed off isPassing/isNA so a Pass/Fail/NA set
 * looks right without extra config). Options with `isPassing:true` fall
 * back to green, non-passing to red, isNA to grey.
 */
function ResponseSetInput({
  field,
  value,
  onChange,
  responseSet
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  responseSet: ResponseSet;
}) {
  const options = responseSet.options ?? [];
  const active = typeof value === "string" ? value : "";
  return (
    <div
      role="radiogroup"
      aria-label={field.label}
      style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
    >
      {options.map((opt) => {
        const on = active === opt.value;
        const defaultColor = opt.isNA ? "#64748B" : opt.isPassing ? "#16A34A" : "#DC2626";
        const color = opt.color ?? defaultColor;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? null : opt.value)}
            style={{
              minWidth: 88,
              minHeight: 44,
              padding: "8px 16px",
              borderRadius: 6,
              border: "2px solid",
              borderColor: color,
              background: on ? color : "transparent",
              color: on ? "#fff" : color,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            {opt.label ?? opt.value}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Terms — acknowledgement checkbox. Stores `{ accepted, version, acceptedAt }`
 * so the audit trail can prove which text the submitter agreed to.
 */
function TermsInput({
  field,
  value,
  onChange
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const config = (field.config ?? {}) as Record<string, unknown>;
  const termsText = String(config.termsText ?? "");
  const version = String(config.termsVersion ?? "1");
  const current = (value as { accepted?: boolean } | null | undefined) ?? { accepted: false };
  const accepted = Boolean(current.accepted);
  const toggle = (next: boolean) => {
    if (next) {
      onChange({ accepted: true, version, acceptedAt: new Date().toISOString() });
    } else {
      onChange(null);
    }
  };
  return (
    <div
      style={{
        background: "var(--surface-muted, #F6F6F6)",
        padding: 12,
        borderRadius: 6,
        fontSize: 13
      }}
    >
      <div style={{ whiteSpace: "pre-wrap", marginBottom: 8 }}>{termsText}</div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => toggle(e.target.checked)}
          style={{ width: 20, height: 20 }}
        />
        <span>I accept these terms (version {version})</span>
      </label>
    </div>
  );
}
