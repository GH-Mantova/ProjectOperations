import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import type { UserDashboard } from "./types";

const USER_DASHBOARDS_KEY = ["user-dashboards"] as const;

export function useUserDashboards() {
  const { authFetch } = useAuth();
  return useQuery({
    queryKey: USER_DASHBOARDS_KEY,
    queryFn: async () => {
      const response = await authFetch("/user-dashboards");
      if (!response.ok) throw new Error("Unable to load dashboards.");
      return (await response.json()) as UserDashboard[];
    },
    staleTime: 10_000
  });
}

export function useUserDashboardsActions() {
  const { authFetch } = useAuth();
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: USER_DASHBOARDS_KEY });
  }, [queryClient]);

  const remove = useCallback(
    async (id: string) => {
      const response = await authFetch(`/user-dashboards/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await response.text());
      invalidate();
    },
    [authFetch, invalidate]
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      const response = await authFetch(`/user-dashboards/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name })
      });
      if (!response.ok) throw new Error(await response.text());
      invalidate();
    },
    [authFetch, invalidate]
  );

  const setDefault = useCallback(
    async (id: string) => {
      const response = await authFetch(`/user-dashboards/${id}/default`, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      invalidate();
    },
    [authFetch, invalidate]
  );

  return { invalidate, remove, rename, setDefault };
}
