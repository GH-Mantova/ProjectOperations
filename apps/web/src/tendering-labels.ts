export type TenderingLabelKey =
  | "nav.tendering"
  | "nav.pipeline"
  | "nav.createTender"
  | "nav.tenderWorkspace"
  | "nav.clients"
  | "nav.contacts"
  | "nav.settings"
  | "dashboard.title"
  | "dashboard.pipelineOverview"
  | "dashboard.commercialTrends"
  | "dashboard.followUpPressure"
  | "field.tenderNumber"
  | "field.title"
  | "field.description"
  | "field.status"
  | "field.probability"
  | "field.estimatedValue"
  | "field.dueDate"
  | "field.proposedStart"
  | "field.leadTimeDays"
  | "field.estimator"
  | "field.linkedClients"
  | "field.contact";

export const defaultTenderingLabels: Record<TenderingLabelKey, string> = {
  "nav.tendering": "Tendering",
  "nav.pipeline": "Pipeline",
  "nav.createTender": "Create Tender",
  "nav.tenderWorkspace": "Tender Workspace",
  "nav.clients": "Clients",
  "nav.contacts": "Contacts",
  "nav.settings": "Settings",
  "dashboard.title": "Tendering Dashboard",
  "dashboard.pipelineOverview": "Pipeline Overview",
  "dashboard.commercialTrends": "Commercial Trends",
  "dashboard.followUpPressure": "Follow-up Pressure",
  "field.tenderNumber": "Tender number",
  "field.title": "Title",
  "field.description": "Description",
  "field.status": "Status",
  "field.probability": "Probability",
  "field.estimatedValue": "Estimated value",
  "field.dueDate": "Due date",
  "field.proposedStart": "Proposed start",
  "field.leadTimeDays": "Lead time days",
  "field.estimator": "Estimator",
  "field.linkedClients": "Linked clients",
  "field.contact": "Contact"
};

const storageKey = "project-ops:tendering-labels";

export function readTenderingLabels() {
  if (typeof window === "undefined") {
    return defaultTenderingLabels;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return defaultTenderingLabels;
    }

    const parsed = JSON.parse(raw) as Partial<Record<TenderingLabelKey, string>>;
    return {
      ...defaultTenderingLabels,
      ...parsed
    };
  } catch {
    return defaultTenderingLabels;
  }
}

export function writeTenderingLabels(labels: Partial<Record<TenderingLabelKey, string>>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      ...readTenderingLabels(),
      ...labels
    })
  );
}
