import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";

// Single shared hard-block message across all GPS-gated field surfaces
// (timesheets, site attendance, muster check-off, geolocation-required forms).
// Keep this string context-agnostic so all four call sites can use it verbatim
// — GPS-A3 rule: one constant, not three copies.
export const GPS_HARD_BLOCK_MSG =
  "Location is required to record this action. Enable location for this site, or see your supervisor to have the entry recorded.";

export type GpsConsentContext =
  | "timesheet"
  | "site-attendance"
  | "muster"
  | "form";

const CONTEXT_COPY: Record<
  GpsConsentContext,
  { intro: string; whenBullet: string; ackLabel: string }
> = {
  timesheet: {
    intro:
      "To clock on or off, this app captures your GPS location at the time of each event. Here is what you need to know:",
    whenBullet: "When it is captured: only at the moment you clock on or clock off.",
    ackLabel: "I understand — enable location for my timesheets"
  },
  "site-attendance": {
    intro:
      "To sign in or out of a site, this app captures your GPS location at the time of each event. Here is what you need to know:",
    whenBullet:
      "When it is captured: only at the moment you sign in to or out of a site.",
    ackLabel: "I understand — enable location for site sign-in"
  },
  muster: {
    intro:
      "To check attendees off during a muster, this app captures your GPS location at the moment of each check. Here is what you need to know:",
    whenBullet:
      "When it is captured: only at the moment you mark a person Accounted or Missing.",
    ackLabel: "I understand — enable location for muster check-off"
  },
  form: {
    intro:
      "This form requires GPS. This app captures your location at the moment you submit. Here is what you need to know:",
    whenBullet: "When it is captured: only at the moment you submit the form.",
    ackLabel: "I understand — enable location for this form"
  }
};

/**
 * Location consent acknowledgement panel. Shown when the caller has not yet
 * acknowledged that the app captures GPS at event time. Posting to
 * /field/location-consent flips a per-user flag; the hosting surface is then
 * expected to drop the panel and stop gating its primary action.
 */
export function ConsentPanel({
  context,
  onAcknowledged
}: {
  context: GpsConsentContext;
  onAcknowledged: () => void;
}) {
  const { authFetch } = useAuth();
  const [posting, setPosting] = useState(false);
  const copy = CONTEXT_COPY[context];

  async function acknowledge() {
    setPosting(true);
    try {
      const res = await authFetch("/field/location-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true })
      });
      if (res.ok) onAcknowledged();
    } finally {
      setPosting(false);
    }
  }

  return (
    <div
      style={{
        background: "#EEF9FA",
        border: "1px solid #B2DFE3",
        borderRadius: 8,
        padding: 14,
        marginTop: 12,
        fontSize: 13
      }}
    >
      <strong style={{ display: "block", marginBottom: 8, color: "#003D42" }}>
        Location access required
      </strong>
      <p style={{ margin: "0 0 8px", color: "#374151" }}>{copy.intro}</p>
      <ul style={{ margin: "0 0 10px", paddingLeft: 18, color: "#374151" }}>
        <li>What is captured: latitude, longitude, and accuracy at event time.</li>
        <li>{copy.whenBullet}</li>
        <li>Who sees it: your supervisor and office staff reviewing the record.</li>
        <li>Capture stops at the event: no background tracking.</li>
      </ul>
      <div
        style={{
          background: "#FCEBEB",
          color: "#A32D2D",
          padding: "8px 10px",
          borderRadius: 6,
          marginBottom: 10,
          fontSize: 12
        }}
      >
        {GPS_HARD_BLOCK_MSG}
      </div>
      <button
        type="button"
        className="field-btn"
        style={{ width: "100%" }}
        disabled={posting}
        onClick={() => void acknowledge()}
      >
        {posting ? "Saving…" : copy.ackLabel}
      </button>
    </div>
  );
}
