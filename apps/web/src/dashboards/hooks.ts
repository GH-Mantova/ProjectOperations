import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext";

export type TenderForDashboard = {
  id: string;
  tenderNumber: string;
  title: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  submittedAt?: string | null;
  wonAt?: string | null;
  lostAt?: string | null;
  probability?: number | null;
  estimatedValue?: string | null;
  dueDate?: string | null;
  estimator?: { id: string; firstName: string; lastName: string } | null;
  tenderClients: Array<{
    isAwarded: boolean;
    contractIssued?: boolean;
    client?: { id: string; name: string } | null;
  }>;
  tenderNotes: Array<{ body?: string; createdAt?: string | null }>;
};

export type JobForDashboard = {
  id: string;
  jobNumber: string;
  name: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  stages?: Array<{ id: string; name: string; status: string }>;
  issues?: Array<{ id: string; status: string }>;
};

export type MaintenancePlanForDashboard = {
  id: string;
  title: string;
  status: string;
  nextDueAt?: string | null;
  asset?: { id: string; assetCode: string; name: string } | null;
};

export type FormSubmissionForDashboard = {
  id: string;
  status: string;
  submittedAt?: string | null;
  template?: { id: string; name: string } | null;
};

export function useTenders() {
  const { authFetch } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "tenders"],
    queryFn: async () => {
      const response = await authFetch("/tenders?page=1&pageSize=100");
      if (!response.ok) throw new Error("Unable to load tenders.");
      const body = await response.json();
      return (body.items ?? []) as TenderForDashboard[];
    },
    staleTime: 30_000
  });
}

export type ProjectForDashboard = {
  id: string;
  projectNumber: string;
  name: string;
  status: string;
  contractValue?: string | null;
  proposedStartDate?: string | null;
};

export function useProjects() {
  const { authFetch } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "projects"],
    queryFn: async () => {
      const response = await authFetch("/projects?page=1&limit=100");
      if (!response.ok) return [] as ProjectForDashboard[];
      const body = await response.json();
      return (body.items ?? []) as ProjectForDashboard[];
    },
    staleTime: 30_000
  });
}

export type TimesheetSummary = {
  totalHours: number;
  pendingCount: number;
  draftCount: number;
  approvedCount: number;
  oldestPendingDate: string | null;
};

export function useTimesheetSummary() {
  const { authFetch } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "timesheet-summary"],
    queryFn: async () => {
      const response = await authFetch("/field/timesheets/summary");
      if (!response.ok) return null;
      return (await response.json()) as TimesheetSummary;
    },
    staleTime: 30_000
  });
}

export function useJobs() {
  const { authFetch } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "jobs"],
    queryFn: async () => {
      const response = await authFetch("/jobs?page=1&pageSize=100");
      if (!response.ok) throw new Error("Unable to load jobs.");
      const body = await response.json();
      return (body.items ?? body ?? []) as JobForDashboard[];
    },
    staleTime: 30_000
  });
}

export function useMaintenancePlans() {
  const { authFetch } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "maintenance-plans"],
    queryFn: async () => {
      const response = await authFetch("/maintenance/plans?page=1&pageSize=100");
      if (!response.ok) return [] as MaintenancePlanForDashboard[];
      const body = await response.json();
      return (body.items ?? body ?? []) as MaintenancePlanForDashboard[];
    },
    staleTime: 30_000
  });
}

export function useFormSubmissions() {
  const { authFetch } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "form-submissions"],
    queryFn: async () => {
      const response = await authFetch("/forms/submissions?page=1&pageSize=100");
      if (!response.ok) return [] as FormSubmissionForDashboard[];
      const body = await response.json();
      return (body.items ?? body ?? []) as FormSubmissionForDashboard[];
    },
    staleTime: 30_000
  });
}

export function isComplianceTender(t: { tenderNumber: string; title: string }): boolean {
  return t.tenderNumber.startsWith("TEN-COMP-") || t.title.startsWith("Compliance Tender");
}
