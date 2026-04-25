import { Navigate, Outlet } from "react-router-dom";
import { usePortalAuth } from "./PortalAuthContext";

export function PortalProtectedRoute() {
  const { isAuthenticated } = usePortalAuth();
  if (!isAuthenticated) return <Navigate to="/portal/login" replace />;
  return <Outlet />;
}
