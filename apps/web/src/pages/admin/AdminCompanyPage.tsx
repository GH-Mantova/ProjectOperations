import { useCallback, useEffect, useMemo, useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { isAdminUser } from "../../auth/permissions";
import { NoAccess } from "../../components/NoAccess";
import { useConfirm } from "../../hooks/useConfirm";

// ── Types shared with backend DTOs ────────────────────────────────────
type CompanyProfile = {
  id: string;
  legalName: string;
  tradingName: string;
  abn: string | null;
  acn: string | null;
  entityType: "PTY_LTD" | "SOLE_TRADER" | "PARTNERSHIP" | "TRUST" | "OTHER";
  primaryEmail: string | null;
  primaryPhone: string | null;
  website: string | null;
  registeredAddressLine1: string | null;
  registeredAddressLine2: string | null;
  registeredSuburb: string | null;
  registeredState: string | null;
  registeredPostcode: string | null;
  registeredCountry: string;
  postalAddressLine1: string | null;
  postalAddressLine2: string | null;
  postalSuburb: string | null;
  postalState: string | null;
  postalPostcode: string | null;
  postalCountry: string;
  whsOfficerUserId: string | null;
  whsOfficer: { id: string; firstName: string; lastName: string; email: string } | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  gstRate: string | number;
  currency: string;
  financialYearStartMonth: number;
  timezone: string;
  defaultPaymentTermsDays: number;
  defaultQuoteValidityDays: number;
  defaultMarkupPercent: string | number;
  tenderNumberPrefix: string;
  quoteNumberPrefix: string;
  jobNumberPrefix: string;
  projectNumberPrefix: string;
  variationNumberPrefix: string;
  claimNumberPrefix: string;
  incidentNumberPrefix: string;
  primaryColorHex: string;
  secondaryColorHex: string;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  pdfLetterheadUrl: string | null;
  completeness: {
    unsetFields: string[];
    total: number;
    complete: number;
    usingDefaultIdentity: boolean;
  };
};

type Branding = {
  activeColorSchemeId: string | null;
  activeColorScheme: {
    id: string;
    name: string;
    primaryColorHex: string;
    secondaryColorHex: string;
  } | null;
  assets: {
    LOGO_LIGHT: string | null;
    LOGO_DARK: string | null;
    FAVICON: string | null;
    PDF_LETTERHEAD: string | null;
  };
};

type LegalDocument = {
  id: string;
  type:
    | "TERMS_AND_CONDITIONS"
    | "COVER_LETTER"
    | "STANDARD_ASSUMPTIONS"
    | "STANDARD_EXCLUSIONS"
    | "PROJECT_ALLOWANCES"
    | "PRIVACY_NOTICE";
  version: number;
  content: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: { firstName: string; lastName: string } | null;
};

type CompanyLicence = {
  id: string;
  licenceType: string;
  licenceNumber: string | null;
  issuingAuthority: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  status: string;
};

type CompanyInsurance = {
  id: string;
  insuranceType: string;
  insurerName: string | null;
  policyNumber: string | null;
  coverageAmount: string | number | null;
  expiryDate: string | null;
  status: string;
};

const SECTIONS = [
  { id: "identity", label: "Identity" },
  { id: "contact", label: "Contact & address" },
  { id: "commercial", label: "Commercial defaults" },
  { id: "numbering", label: "Document numbering" },
  { id: "branding", label: "Branding" },
  { id: "legal", label: "Legal documents" },
  { id: "compliance", label: "Licences & insurances" }
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

/**
 * Company profile admin page. Super-user only (enforced client-side here,
 * again server-side on every endpoint — a direct API call from a
 * non-super-user is rejected).
 *
 * Grouped as: Identity → Contact → Commercial defaults → Numbering →
 * Branding → Legal documents → Licences & insurances. The header shows
 * a completeness indicator so a second company (or Marco reviewing this
 * one) can see at a glance what is still unset.
 */
export function humaniseError(raw: string | null): string {
  if (!raw) return "Something went wrong loading the company profile.";
  try {
    const parsed = JSON.parse(raw) as { message?: string };
    if (parsed && typeof parsed.message === "string" && parsed.message.trim().length > 0) {
      return parsed.message;
    }
  } catch {
    // not JSON — fall through to raw text
  }
  return raw;
}

export function AdminCompanyPage() {
  const { user, authFetch } = useAuth();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>("identity");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/admin/company/profile");
      if (res.status === 404) {
        setNotFound(true);
        setProfile(null);
        setError(null);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      setProfile((await res.json()) as CompanyProfile);
      setNotFound(false);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    // Best-effort: if the branding endpoint isn't reachable we keep rendering
    // the legacy string fields on the profile — the guarantee here is "prefer
    // the relation when present, fall back to the string" so a missing
    // branding fetch is not fatal.
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/admin/branding");
        if (!res.ok) return;
        const data = (await res.json()) as Branding;
        if (!cancelled) setBranding(data);
      } catch {
        // ignore — legacy fallback remains
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const bootstrapProfile = useCallback(async () => {
    setCreating(true);
    try {
      const res = await authFetch("/admin/company/profile", { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      setProfile((await res.json()) as CompanyProfile);
      setNotFound(false);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }, [authFetch]);

  const patchField = async (field: keyof CompanyProfile, value: unknown) => {
    try {
      const res = await authFetch("/admin/company/profile", {
        method: "PATCH",
        body: JSON.stringify({ [field]: value })
      });
      if (!res.ok) throw new Error(await res.text());
      setProfile((await res.json()) as CompanyProfile);
      setSavedFlash(String(field));
      setTimeout(() => setSavedFlash((s) => (s === String(field) ? null : s)), 1500);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const isAdmin = isAdminUser(user);
  if (!user) return null;
  if (!isAdmin) {
    return (
      <NoAccess
        required="role:Admin"
        title="Company profile requires the Admin role"
      />
    );
  }

  if (loading) return <div style={{ padding: 24 }}>Loading company profile…</div>;

  if (notFound) {
    return (
      <div style={{ padding: 24, maxWidth: 640 }} data-testid="company-profile-empty">
        <h1 className="s7-type-page-heading" style={{ marginTop: 0 }}>No company profile yet</h1>
        <p style={{ color: "var(--text-muted)" }}>
          The company profile has not been created for this environment. Create
          it now to seed defaults for identity, contact details, commercial
          settings, numbering, and branding — you can edit any field afterwards.
        </p>
        {error && (
          <div style={{ background: "#ffebee", color: "#c62828", padding: 8, borderRadius: 4, margin: "12px 0" }}>
            {humaniseError(error)}
          </div>
        )}
        <button
          type="button"
          onClick={bootstrapProfile}
          disabled={creating}
          style={{
            padding: "10px 18px",
            background: "#005B61",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: creating ? "wait" : "pointer",
            opacity: creating ? 0.7 : 1
          }}
        >
          {creating ? "Creating…" : "Create company profile"}
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ padding: 24, color: "#c62828" }}>
        {humaniseError(error)}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h1 className="s7-type-page-heading" style={{ marginTop: 0 }}>Company profile</h1>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
        The single source of truth for who "we" are — legalName, ABN, contact,
        commercial defaults, numbering, branding, and company licences.
        Referenced by every document and email surface.
      </p>

      <CompletenessBanner profile={profile} />

      {error && (
        <div style={{ background: "#ffebee", color: "#c62828", padding: 8, borderRadius: 4, margin: "12px 0" }}>
          {humaniseError(error)}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, marginTop: 24 }}>
        <nav aria-label="Sections" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {SECTIONS.map((s) => {
            const active = section === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSection(s.id)}
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: active ? "rgba(0,91,97,0.08)" : "transparent",
                  color: active ? "#005B61" : "var(--text)",
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer"
                }}
              >
                {s.label}
              </button>
            );
          })}
        </nav>

        <div>
          {section === "identity" && (
            <IdentitySection profile={profile} onPatch={patchField} savedFlash={savedFlash} />
          )}
          {section === "contact" && (
            <ContactSection profile={profile} onPatch={patchField} savedFlash={savedFlash} />
          )}
          {section === "commercial" && (
            <CommercialSection profile={profile} onPatch={patchField} savedFlash={savedFlash} />
          )}
          {section === "numbering" && (
            <NumberingSection profile={profile} onPatch={patchField} savedFlash={savedFlash} />
          )}
          {section === "branding" && (
            <BrandingSection
              profile={profile}
              branding={branding}
              onPatch={patchField}
              savedFlash={savedFlash}
            />
          )}
          {section === "legal" && <LegalDocumentsSection authFetch={authFetch} />}
          {section === "compliance" && <ComplianceSection authFetch={authFetch} />}
        </div>
      </div>
    </div>
  );
}

// ── Completeness banner ───────────────────────────────────────────────────
function CompletenessBanner({ profile }: { profile: CompanyProfile }) {
  const { complete, total, unsetFields, usingDefaultIdentity } = profile.completeness;
  const pct = Math.round((complete / total) * 100);
  const style: React.CSSProperties = {
    padding: 12,
    borderRadius: 6,
    marginTop: 12,
    background: pct === 100 ? "#e8f5e9" : "#fff8e1",
    border: pct === 100 ? "1px solid #a5d6a7" : "1px solid #ffe082"
  };
  return (
    <div style={style}>
      <strong>Profile completeness: {complete}/{total} ({pct}%)</strong>
      {unsetFields.length > 0 && (
        <p style={{ margin: "6px 0 0", fontSize: 13 }}>
          Still unset: {unsetFields.join(", ")}
        </p>
      )}
      {usingDefaultIdentity && (
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#8a6d3b" }}>
          Note: legalName is still the seeded default (&ldquo;Initial Services Group Pty Ltd&rdquo;).
          Update it to the operating entity's registered name.
        </p>
      )}
    </div>
  );
}

// ── Reusable field row ────────────────────────────────────────────────────
type FieldProps = {
  label: string;
  field: keyof CompanyProfile;
  value: string | number | null;
  type?: "text" | "number" | "email";
  onPatch: (field: keyof CompanyProfile, value: unknown) => void;
  savedFlash: string | null;
  hint?: string;
};

function Field({ label, field, value, type = "text", onPatch, savedFlash, hint }: FieldProps) {
  const [draft, setDraft] = useState(value === null || value === undefined ? "" : String(value));
  useEffect(() => {
    setDraft(value === null || value === undefined ? "" : String(value));
  }, [value]);

  const commit = () => {
    const raw = draft.trim();
    let out: unknown = raw === "" ? null : raw;
    if (type === "number" && out !== null) out = Number(out);
    if (out !== value) onPatch(field, out);
  };

  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ display: "block", fontSize: 13, marginBottom: 4, color: "var(--text-muted)" }}>
        {label} {savedFlash === String(field) && <span style={{ color: "#2e7d32" }}>✓ saved</span>}
      </span>
      <input
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4, width: "100%", maxWidth: 500 }}
      />
      {hint && (
        <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          {hint}
        </span>
      )}
    </label>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────
type SectionProps = {
  profile: CompanyProfile;
  onPatch: (field: keyof CompanyProfile, value: unknown) => void;
  savedFlash: string | null;
};

function IdentitySection({ profile, onPatch, savedFlash }: SectionProps) {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Identity</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
        <strong>legalName</strong> appears on contracts and tax invoices.{" "}
        <strong>tradingName</strong> is what users see in the UI, emails, and marketing.
        Different fields on purpose — they often differ in practice.
      </p>
      <Field label="Legal name (registered entity)" field="legalName" value={profile.legalName} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Trading name" field="tradingName" value={profile.tradingName} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="ABN" field="abn" value={profile.abn} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="ACN" field="acn" value={profile.acn} onPatch={onPatch} savedFlash={savedFlash} />
      <label style={{ display: "block", marginBottom: 12 }}>
        <span style={{ display: "block", fontSize: 13, marginBottom: 4, color: "var(--text-muted)" }}>
          Entity type
        </span>
        <select
          value={profile.entityType}
          onChange={(e) => onPatch("entityType", e.target.value)}
          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
        >
          <option value="PTY_LTD">Pty Ltd</option>
          <option value="SOLE_TRADER">Sole Trader</option>
          <option value="PARTNERSHIP">Partnership</option>
          <option value="TRUST">Trust</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
    </div>
  );
}

function ContactSection({ profile, onPatch, savedFlash }: SectionProps) {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Contact & address</h2>
      <Field label="Primary email" field="primaryEmail" value={profile.primaryEmail} type="email" onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Primary phone" field="primaryPhone" value={profile.primaryPhone} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Website" field="website" value={profile.website} onPatch={onPatch} savedFlash={savedFlash} />
      <h3>Registered address</h3>
      <Field label="Line 1" field="registeredAddressLine1" value={profile.registeredAddressLine1} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Suburb" field="registeredSuburb" value={profile.registeredSuburb} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="State" field="registeredState" value={profile.registeredState} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Postcode" field="registeredPostcode" value={profile.registeredPostcode} onPatch={onPatch} savedFlash={savedFlash} />
      <h3>Postal address</h3>
      <Field label="Line 1" field="postalAddressLine1" value={profile.postalAddressLine1} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Suburb" field="postalSuburb" value={profile.postalSuburb} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="State" field="postalState" value={profile.postalState} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Postcode" field="postalPostcode" value={profile.postalPostcode} onPatch={onPatch} savedFlash={savedFlash} />
      <h3>Emergency</h3>
      <Field label="Contact name" field="emergencyContactName" value={profile.emergencyContactName} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Contact phone" field="emergencyContactPhone" value={profile.emergencyContactPhone} onPatch={onPatch} savedFlash={savedFlash} />
      <div style={{ marginTop: 16, padding: 12, background: "#f6f6f6", borderRadius: 4, fontSize: 13 }}>
        <strong>WHS Officer:</strong>{" "}
        {profile.whsOfficer
          ? `${profile.whsOfficer.firstName} ${profile.whsOfficer.lastName} (${profile.whsOfficer.email})`
          : "not set"}
      </div>
    </div>
  );
}

function CommercialSection({ profile, onPatch, savedFlash }: SectionProps) {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Commercial defaults</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
        These SEED forms only. An explicit value entered on a tender, quote, or
        job always wins. A default that silently overrides user input is a bug.
      </p>
      <Field label="GST rate (%)" field="gstRate" value={profile.gstRate as number} type="number" onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Currency (ISO)" field="currency" value={profile.currency} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Financial year start month (1–12)" field="financialYearStartMonth" value={profile.financialYearStartMonth} type="number" onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Timezone (IANA)" field="timezone" value={profile.timezone} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Default payment terms (days)" field="defaultPaymentTermsDays" value={profile.defaultPaymentTermsDays} type="number" onPatch={onPatch} savedFlash={savedFlash} hint="Seeds new quote/invoice; BIFA §17 defaults 25 days." />
      <Field label="Default quote validity (days)" field="defaultQuoteValidityDays" value={profile.defaultQuoteValidityDays} type="number" onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Default markup (%)" field="defaultMarkupPercent" value={profile.defaultMarkupPercent as number} type="number" onPatch={onPatch} savedFlash={savedFlash} />
    </div>
  );
}

function NumberingSection({ profile, onPatch, savedFlash }: SectionProps) {
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Document numbering</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
        Prefixes only. The counters live in the <code>*NumberSequence</code>{" "}
        tables and are not user-editable.
      </p>
      <Field label="Tender prefix" field="tenderNumberPrefix" value={profile.tenderNumberPrefix} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Quote prefix" field="quoteNumberPrefix" value={profile.quoteNumberPrefix} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Job prefix" field="jobNumberPrefix" value={profile.jobNumberPrefix} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Project prefix" field="projectNumberPrefix" value={profile.projectNumberPrefix} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Variation prefix" field="variationNumberPrefix" value={profile.variationNumberPrefix} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Claim prefix" field="claimNumberPrefix" value={profile.claimNumberPrefix} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Incident prefix" field="incidentNumberPrefix" value={profile.incidentNumberPrefix} onPatch={onPatch} savedFlash={savedFlash} />
    </div>
  );
}

function BrandingSection({
  profile,
  branding,
  onPatch,
  savedFlash
}: SectionProps & { branding: Branding | null }) {
  // Prefer the relation values when present; fall back to the CompanyProfile
  // string columns. Writes still go through PATCH /admin/company/profile —
  // the /admin/branding endpoints exist for callers that manipulate schemes
  // and assets directly and keep the legacy columns mirrored.
  const scheme = branding?.activeColorScheme ?? null;
  const primary = scheme?.primaryColorHex ?? profile.primaryColorHex;
  const secondary = scheme?.secondaryColorHex ?? profile.secondaryColorHex;
  const logoLight = branding?.assets.LOGO_LIGHT ?? profile.logoLightUrl;
  const logoDark = branding?.assets.LOGO_DARK ?? profile.logoDarkUrl;
  const favicon = branding?.assets.FAVICON ?? profile.faviconUrl;
  const letterhead = branding?.assets.PDF_LETTERHEAD ?? profile.pdfLetterheadUrl;
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Branding</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
        Colors and asset URLs.{" "}
        {scheme
          ? `Active palette: ${scheme.name}.`
          : "No active palette selected — showing legacy string fields."}
      </p>
      <Field label="Primary color (hex)" field="primaryColorHex" value={primary} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Secondary color (hex)" field="secondaryColorHex" value={secondary} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Logo light URL" field="logoLightUrl" value={logoLight} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Logo dark URL" field="logoDarkUrl" value={logoDark} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="Favicon URL" field="faviconUrl" value={favicon} onPatch={onPatch} savedFlash={savedFlash} />
      <Field label="PDF letterhead URL" field="pdfLetterheadUrl" value={letterhead} onPatch={onPatch} savedFlash={savedFlash} />
    </div>
  );
}

// ── Legal documents ──────────────────────────────────────────────────────
const LEGAL_TYPES: LegalDocument["type"][] = [
  "TERMS_AND_CONDITIONS",
  "COVER_LETTER",
  "STANDARD_ASSUMPTIONS",
  "STANDARD_EXCLUSIONS",
  "PROJECT_ALLOWANCES",
  "PRIVACY_NOTICE"
];

function LegalDocumentsSection({
  authFetch
}: {
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const [docs, setDocs] = useState<LegalDocument[]>([]);
  const [selectedType, setSelectedType] = useState<LegalDocument["type"]>("TERMS_AND_CONDITIONS");
  const [draftContent, setDraftContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await authFetch("/admin/company/legal-documents");
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    setDocs((await res.json()) as LegalDocument[]);
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const versionsOfType = useMemo(
    () => docs.filter((d) => d.type === selectedType).sort((a, b) => b.version - a.version),
    [docs, selectedType]
  );
  const active = versionsOfType.find((v) => v.isActive) ?? null;

  const createNewVersion = async () => {
    if (!draftContent.trim()) {
      setError("Content cannot be empty.");
      return;
    }
    const res = await authFetch("/admin/company/legal-documents", {
      method: "POST",
      body: JSON.stringify({ type: selectedType, content: draftContent })
    });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    setDraftContent("");
    setError(null);
    await load();
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Legal documents</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
        Effective-dated versions. Editing content creates a{" "}
        <strong>new version</strong>; the previous version is closed and
        remains attached to any quote or contract that was issued against
        it. Old versions are never mutated.
      </p>

      <label style={{ display: "block", marginBottom: 8 }}>
        <span style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Document type</span>
        <select
          value={selectedType}
          onChange={(e) => {
            setSelectedType(e.target.value as LegalDocument["type"]);
            setDraftContent("");
          }}
          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 4 }}
        >
          {LEGAL_TYPES.map((t) => (
            <option key={t} value={t}>{t.replaceAll("_", " ")}</option>
          ))}
        </select>
      </label>

      {error && (
        <div style={{ background: "#ffebee", color: "#c62828", padding: 8, borderRadius: 4, margin: "8px 0" }}>
          {error}
        </div>
      )}

      <h3>Active version</h3>
      {active ? (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 4, background: "#fafafa" }}>
          <div><strong>Version {active.version}</strong> — effective from {new Date(active.effectiveFrom).toLocaleDateString("en-AU")}</div>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginTop: 8 }}>{active.content.slice(0, 500)}{active.content.length > 500 && "…"}</pre>
        </div>
      ) : (
        <p style={{ color: "var(--text-muted)" }}>No active version.</p>
      )}

      <h3 style={{ marginTop: 24 }}>Create new version</h3>
      <textarea
        value={draftContent}
        onChange={(e) => setDraftContent(e.target.value)}
        placeholder={active?.content ?? ""}
        rows={15}
        style={{ width: "100%", maxWidth: 700, padding: 8, border: "1px solid #ccc", borderRadius: 4, fontFamily: "monospace", fontSize: 12 }}
      />
      <div>
        <button
          type="button"
          onClick={createNewVersion}
          disabled={!draftContent.trim()}
          style={{ marginTop: 8, padding: "8px 16px", background: "#005B61", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
        >
          Save as new version
        </button>
      </div>

      {versionsOfType.length > 1 && (
        <>
          <h3 style={{ marginTop: 24 }}>Previous versions</h3>
          <ul style={{ paddingLeft: 20, fontSize: 13 }}>
            {versionsOfType.filter((v) => !v.isActive).map((v) => (
              <li key={v.id}>
                v{v.version} — {new Date(v.effectiveFrom).toLocaleDateString("en-AU")}
                {v.effectiveTo && ` → ${new Date(v.effectiveTo).toLocaleDateString("en-AU")}`}
                {v.createdBy && ` (by ${v.createdBy.firstName} ${v.createdBy.lastName})`}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ── Company licences & insurances ────────────────────────────────────────
function ComplianceSection({
  authFetch
}: {
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const confirm = useConfirm();
  const [licences, setLicences] = useState<CompanyLicence[]>([]);
  const [insurances, setInsurances] = useState<CompanyInsurance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [licenceDraft, setLicenceDraft] = useState<
    { type: string; number: string; expiry: string } | null
  >(null);
  const [insuranceDraft, setInsuranceDraft] = useState<
    { type: string; insurer: string; policy: string; expiry: string } | null
  >(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [lRes, iRes] = await Promise.all([
      authFetch("/admin/company/licences"),
      authFetch("/admin/company/insurances")
    ]);
    if (!lRes.ok || !iRes.ok) {
      setError((!lRes.ok ? await lRes.text() : await iRes.text()));
      return;
    }
    setLicences((await lRes.json()) as CompanyLicence[]);
    setInsurances((await iRes.json()) as CompanyInsurance[]);
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAddLicence = () => setLicenceDraft({ type: "", number: "", expiry: "" });
  const openAddInsurance = () =>
    setInsuranceDraft({ type: "", insurer: "", policy: "", expiry: "" });

  const submitLicence = async () => {
    if (!licenceDraft) return;
    const type = licenceDraft.type.trim();
    if (!type) return;
    setSaving(true);
    try {
      const res = await authFetch("/admin/company/licences", {
        method: "POST",
        body: JSON.stringify({
          licenceType: type,
          licenceNumber: licenceDraft.number.trim() || null,
          expiryDate: licenceDraft.expiry.trim() || undefined
        })
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setLicenceDraft(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const submitInsurance = async () => {
    if (!insuranceDraft) return;
    const type = insuranceDraft.type.trim();
    if (!type) return;
    setSaving(true);
    try {
      const res = await authFetch("/admin/company/insurances", {
        method: "POST",
        body: JSON.stringify({
          insuranceType: type,
          insurerName: insuranceDraft.insurer.trim() || null,
          policyNumber: insuranceDraft.policy.trim() || null,
          expiryDate: insuranceDraft.expiry.trim() || undefined
        })
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      setInsuranceDraft(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const deleteLicence = async (id: string) => {
    const ok = await confirm({
      title: "Delete licence",
      message: "Delete this licence?",
      confirmLabel: "Delete",
      variant: "danger"
    });
    if (!ok) return;
    await authFetch(`/admin/company/licences/${id}`, { method: "DELETE" });
    await load();
  };
  const deleteInsurance = async (id: string) => {
    const ok = await confirm({
      title: "Delete insurance",
      message: "Delete this insurance?",
      confirmLabel: "Delete",
      variant: "danger"
    });
    if (!ok) return;
    await authFetch(`/admin/company/insurances/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Licences & insurances</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
        Our own licences and insurances — flow through the same daily
        expiry-alert cron as subcontractor compliance. Never auto-block
        (a company can't block itself), but expired items are flagged
        alongside everything else on the compliance dashboard.
      </p>

      {error && (
        <div style={{ background: "#ffebee", color: "#c62828", padding: 8, borderRadius: 4, marginBottom: 8 }}>
          {error}
        </div>
      )}

      <h3>Licences</h3>
      <button type="button" onClick={openAddLicence} style={{ padding: "6px 12px", marginBottom: 8, background: "#005B61", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
        + Add licence
      </button>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            <th style={{ textAlign: "left", padding: 6 }}>Type</th>
            <th style={{ textAlign: "left", padding: 6 }}>Number</th>
            <th style={{ textAlign: "left", padding: 6 }}>Expiry</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {licences.length === 0 && <tr><td colSpan={4} style={{ padding: 8, color: "var(--text-muted)" }}>No company licences recorded.</td></tr>}
          {licences.map((l) => (
            <tr key={l.id} style={{ borderTop: "1px solid #eee" }}>
              <td style={{ padding: 6 }}>{l.licenceType}</td>
              <td style={{ padding: 6 }}>{l.licenceNumber ?? "—"}</td>
              <td style={{ padding: 6 }}>{l.expiryDate ? new Date(l.expiryDate).toLocaleDateString("en-AU") : "—"}</td>
              <td style={{ padding: 6 }}><button onClick={() => deleteLicence(l.id)} style={{ background: "transparent", border: "1px solid #c62828", color: "#c62828", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: 24 }}>Insurances</h3>
      <button type="button" onClick={openAddInsurance} style={{ padding: "6px 12px", marginBottom: 8, background: "#005B61", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}>
        + Add insurance
      </button>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f5f5f5" }}>
            <th style={{ textAlign: "left", padding: 6 }}>Type</th>
            <th style={{ textAlign: "left", padding: 6 }}>Insurer</th>
            <th style={{ textAlign: "left", padding: 6 }}>Policy</th>
            <th style={{ textAlign: "left", padding: 6 }}>Expiry</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {insurances.length === 0 && <tr><td colSpan={5} style={{ padding: 8, color: "var(--text-muted)" }}>No company insurances recorded.</td></tr>}
          {insurances.map((i) => (
            <tr key={i.id} style={{ borderTop: "1px solid #eee" }}>
              <td style={{ padding: 6 }}>{i.insuranceType}</td>
              <td style={{ padding: 6 }}>{i.insurerName ?? "—"}</td>
              <td style={{ padding: 6 }}>{i.policyNumber ?? "—"}</td>
              <td style={{ padding: 6 }}>{i.expiryDate ? new Date(i.expiryDate).toLocaleDateString("en-AU") : "—"}</td>
              <td style={{ padding: 6 }}><button onClick={() => deleteInsurance(i.id)} style={{ background: "transparent", border: "1px solid #c62828", color: "#c62828", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {licenceDraft ? (
        <CenteredModal
          title="Add licence"
          onClose={() => setLicenceDraft(null)}
          busy={saving}
          dataTestId="add-licence-modal"
          maxWidth={460}
          footer={
            <>
              <button
                type="button"
                className="s7-btn s7-btn--ghost"
                onClick={() => setLicenceDraft(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-licence-form"
                className="s7-btn s7-btn--primary"
                disabled={saving || !licenceDraft.type.trim()}
              >
                {saving ? "Saving…" : "Add"}
              </button>
            </>
          }
        >
          <form
            id="add-licence-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submitLicence();
            }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span>Licence type (e.g. demolition, asbestos_a, qbcc)</span>
              <input
                type="text"
                value={licenceDraft.type}
                onChange={(e) => setLicenceDraft({ ...licenceDraft, type: e.target.value })}
                autoFocus
                style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span>Licence number</span>
              <input
                type="text"
                value={licenceDraft.number}
                onChange={(e) => setLicenceDraft({ ...licenceDraft, number: e.target.value })}
                style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span>Expiry date (YYYY-MM-DD)</span>
              <input
                type="date"
                value={licenceDraft.expiry}
                onChange={(e) => setLicenceDraft({ ...licenceDraft, expiry: e.target.value })}
                style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}
              />
            </label>
          </form>
        </CenteredModal>
      ) : null}

      {insuranceDraft ? (
        <CenteredModal
          title="Add insurance"
          onClose={() => setInsuranceDraft(null)}
          busy={saving}
          dataTestId="add-insurance-modal"
          maxWidth={460}
          footer={
            <>
              <button
                type="button"
                className="s7-btn s7-btn--ghost"
                onClick={() => setInsuranceDraft(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="add-insurance-form"
                className="s7-btn s7-btn--primary"
                disabled={saving || !insuranceDraft.type.trim()}
              >
                {saving ? "Saving…" : "Add"}
              </button>
            </>
          }
        >
          <form
            id="add-insurance-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submitInsurance();
            }}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span>
                Insurance type (e.g. public_liability, workers_compensation, professional_indemnity)
              </span>
              <input
                type="text"
                value={insuranceDraft.type}
                onChange={(e) => setInsuranceDraft({ ...insuranceDraft, type: e.target.value })}
                autoFocus
                style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span>Insurer name</span>
              <input
                type="text"
                value={insuranceDraft.insurer}
                onChange={(e) => setInsuranceDraft({ ...insuranceDraft, insurer: e.target.value })}
                style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span>Policy number</span>
              <input
                type="text"
                value={insuranceDraft.policy}
                onChange={(e) => setInsuranceDraft({ ...insuranceDraft, policy: e.target.value })}
                style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span>Expiry date (YYYY-MM-DD)</span>
              <input
                type="date"
                value={insuranceDraft.expiry}
                onChange={(e) => setInsuranceDraft({ ...insuranceDraft, expiry: e.target.value })}
                style={{ padding: 8, borderRadius: 4, border: "1px solid #d1d5db" }}
              />
            </label>
          </form>
        </CenteredModal>
      ) : null}
    </div>
  );
}
