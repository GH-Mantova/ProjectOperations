import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

/**
 * D365-style advisory duplicate-detection panel for organisation create
 * forms (Client / Subcontractor / Supplier). Debounces the server call
 * so we don't fire on every keystroke, then renders a non-blocking
 * "possible duplicates" list with a "use existing" link and a
 * "create anyway" hint. Never blocks form submission — the user is free
 * to ignore the warning and proceed.
 */

export type OrganisationDuplicateCandidate = {
  id: string;
  kind: "client" | "subcontractor" | "supplier";
  name: string;
  tradingName: string | null;
  abn: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  score: number;
  reasons: string[];
};

type OrgCheckInput = {
  scope: "client" | "subcontractor" | "supplier";
  name?: string;
  tradingName?: string;
  legalName?: string;
  abn?: string;
  acn?: string;
  email?: string;
  phone?: string;
};

export function DuplicateWarning({
  input,
  onUseExisting,
  hrefForCandidate
}: {
  input: OrgCheckInput;
  onUseExisting?: (candidate: OrganisationDuplicateCandidate) => void;
  hrefForCandidate?: (candidate: OrganisationDuplicateCandidate) => string | null;
}) {
  const { authFetch } = useAuth();
  const [candidates, setCandidates] = useState<OrganisationDuplicateCandidate[]>([]);
  const [dismissed, setDismissed] = useState(false);

  const payloadKey = JSON.stringify(input);
  useEffect(() => {
    setDismissed(false);
    const hasSignal =
      (input.name?.trim().length ?? 0) >= 3 ||
      Boolean(input.abn?.trim()) ||
      Boolean(input.acn?.trim()) ||
      Boolean(input.email?.trim()) ||
      Boolean(input.phone?.trim());
    if (!hasSignal) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        const res = await authFetch("/directory/duplicate-check", {
          method: "POST",
          body: JSON.stringify(input)
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as OrganisationDuplicateCandidate[];
        if (!cancelled) setCandidates(data);
      } catch {
        if (!cancelled) setCandidates([]);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [authFetch, payloadKey, input]);

  if (dismissed || candidates.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        border: "1px solid #F59E0B",
        background: "#FFFBEB",
        color: "#78350F",
        borderRadius: 6,
        padding: 10,
        marginTop: 10,
        fontSize: 12
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <strong>Possible duplicates found ({candidates.length})</strong>
          <div style={{ color: "#92400E", marginTop: 2 }}>
            These existing entries look similar to what you're entering. Review before creating —
            you can still create anyway.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="s7-btn s7-btn--ghost s7-btn--sm"
          aria-label="Dismiss duplicate warning"
          style={{ color: "#78350F" }}
        >
          Dismiss
        </button>
      </div>
      <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
        {candidates.map((c) => {
          const href = hrefForCandidate?.(c) ?? null;
          return (
            <li
              key={c.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                padding: "6px 0",
                borderTop: "1px solid #FDE68A"
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "#111827" }}>
                  {c.name}
                  {c.tradingName ? <span style={{ color: "#6B7280", fontWeight: 400 }}> · t/a {c.tradingName}</span> : null}
                  {!c.isActive ? <span style={{ marginLeft: 6, color: "#6B7280" }}>(inactive)</span> : null}
                </div>
                <div style={{ color: "#6B7280", fontSize: 11 }}>
                  {c.reasons.join(" · ")}
                  {c.abn ? ` · ABN ${c.abn}` : ""}
                  {c.email ? ` · ${c.email}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 6px",
                    background: c.score >= 90 ? "#DC2626" : c.score >= 70 ? "#F97316" : "#F59E0B",
                    color: "#fff",
                    borderRadius: 999
                  }}
                >
                  {c.score}%
                </span>
                {onUseExisting ? (
                  <button
                    type="button"
                    className="s7-btn s7-btn--secondary s7-btn--sm"
                    onClick={() => onUseExisting(c)}
                  >
                    Use existing
                  </button>
                ) : href ? (
                  <a href={href} className="s7-btn s7-btn--secondary s7-btn--sm">
                    Open
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type ContactDuplicateCandidate = {
  id: string;
  organisationType: string;
  organisationId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  score: number;
  reasons: string[];
};

type ContactCheckInput = {
  organisationType: string;
  organisationId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
};

/**
 * Sibling of {@link DuplicateWarning} for the polymorphic Contact create
 * form. Same debounce + soft-warn pattern; matches are scoped to the
 * supplied organisation when `organisationId` is present.
 */
export function DuplicateContactWarning({ input }: { input: ContactCheckInput }) {
  const { authFetch } = useAuth();
  const [candidates, setCandidates] = useState<ContactDuplicateCandidate[]>([]);
  const [dismissed, setDismissed] = useState(false);

  const payloadKey = JSON.stringify(input);
  useEffect(() => {
    setDismissed(false);
    const hasSignal =
      Boolean(input.email?.trim()) ||
      Boolean(input.phone?.trim()) ||
      Boolean(input.mobile?.trim()) ||
      ((input.firstName?.trim().length ?? 0) >= 2 && (input.lastName?.trim().length ?? 0) >= 2);
    if (!hasSignal) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      try {
        const res = await authFetch("/contacts/duplicate-check", {
          method: "POST",
          body: JSON.stringify(input)
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ContactDuplicateCandidate[];
        if (!cancelled) setCandidates(data);
      } catch {
        if (!cancelled) setCandidates([]);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [authFetch, payloadKey, input]);

  if (dismissed || candidates.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        border: "1px solid #F59E0B",
        background: "#FFFBEB",
        color: "#78350F",
        borderRadius: 6,
        padding: 10,
        marginTop: 10,
        fontSize: 12
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <strong>Possible duplicate contacts ({candidates.length})</strong>
          <div style={{ color: "#92400E", marginTop: 2 }}>
            Similar contacts already exist. You can still add this contact.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="s7-btn s7-btn--ghost s7-btn--sm"
          aria-label="Dismiss duplicate warning"
          style={{ color: "#78350F" }}
        >
          Dismiss
        </button>
      </div>
      <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
        {candidates.map((c) => (
          <li
            key={c.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              padding: "6px 0",
              borderTop: "1px solid #FDE68A"
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: "#111827" }}>
                {c.firstName} {c.lastName}
              </div>
              <div style={{ color: "#6B7280", fontSize: 11 }}>
                {c.reasons.join(" · ")}
                {c.email ? ` · ${c.email}` : ""}
                {c.phone ? ` · ${c.phone}` : ""}
              </div>
            </div>
            <span
              style={{
                fontSize: 10,
                padding: "1px 6px",
                background: c.score >= 90 ? "#DC2626" : c.score >= 70 ? "#F97316" : "#F59E0B",
                color: "#fff",
                borderRadius: 999
              }}
            >
              {c.score}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
