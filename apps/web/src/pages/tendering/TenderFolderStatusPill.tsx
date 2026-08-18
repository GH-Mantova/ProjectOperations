import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";

// TFM-S5 -- Displays the SharePoint folder provisioning outcome for a tender
// and provides a retry action when the outcome is "partial" or "failed".
//
// - "ok": green pill "Filed" (quiet -- happy path is invisible by default).
// - "partial": amber pill "Partial -- N subfolder(s) failed", click to retry.
// - "failed": red pill "Folder provisioning failed", click to retry.
// - null/undefined: nothing rendered (provisioning not yet attempted).

export type FolderProvisioningFailure = { path: string; message: string };

type Props = {
  tenderId: string;
  status: string | null | undefined;
  failures: FolderProvisioningFailure[] | null | undefined;
  canRetry: boolean;
  onRetried?: () => void;
};

export function TenderFolderStatusPill({ tenderId, status, failures, canRetry, onRetried }: Props) {
  const { authFetch } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  if (!status) return null;

  async function handleRetry() {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await authFetch(`/tenders/${tenderId}/reprovision-folders`, {
        method: "POST"
      });
      if (!res.ok) {
        const text = await res.text();
        setRetryError(text || "Retry failed");
      } else {
        onRetried?.();
      }
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  }

  const failureCount = failures?.length ?? 0;

  if (status === "ok") {
    return (
      <span
        className="s7-badge"
        style={{ background: "#D1FAE5", color: "#065F46", fontSize: 12 }}
        title="SharePoint folder structure provisioned successfully"
      >
        Filed
      </span>
    );
  }

  if (status === "partial") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span
          className="s7-badge"
          style={{ background: "#FEF3C7", color: "#92400E", fontSize: 12 }}
          title={
            failures?.map((f) => `${f.path}: ${f.message}`).join("\n") ??
            "Some subfolders failed to provision"
          }
        >
          Partial -- {failureCount} subfolder{failureCount !== 1 ? "s" : ""} failed
        </span>
        {canRetry && (
          <button
            type="button"
            className="s7-btn s7-btn--secondary s7-btn--sm"
            style={{ fontSize: 11, padding: "2px 8px" }}
            onClick={() => void handleRetry()}
            disabled={retrying}
            title="Retry SharePoint folder provisioning"
          >
            {retrying ? "Retrying..." : "Retry"}
          </button>
        )}
        {retryError && (
          <span style={{ color: "#DC2626", fontSize: 11 }}>{retryError}</span>
        )}
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span
          className="s7-badge"
          style={{ background: "#FEE2E2", color: "#991B1B", fontSize: 12 }}
          title={
            failures?.map((f) => `${f.path}: ${f.message}`).join("\n") ??
            "Folder provisioning failed"
          }
        >
          Folder provisioning failed
        </span>
        {canRetry && (
          <button
            type="button"
            className="s7-btn s7-btn--secondary s7-btn--sm"
            style={{ fontSize: 11, padding: "2px 8px" }}
            onClick={() => void handleRetry()}
            disabled={retrying}
            title="Retry SharePoint folder provisioning"
          >
            {retrying ? "Retrying..." : "Retry"}
          </button>
        )}
        {retryError && (
          <span style={{ color: "#DC2626", fontSize: 11 }}>{retryError}</span>
        )}
      </span>
    );
  }

  return null;
}
