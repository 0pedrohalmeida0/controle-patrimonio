import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "@/lib/auth";
import type { AppRole } from "@/lib/types";

interface ProtectedRouteProps {
  children: ReactNode;
  /** Roles permitidos. Se vazio, qualquer usuário autenticado. */
  roles?: AppRole[];
  /** Se `true`, exige permissão de edição. */
  requireEdit?: boolean;
  /** Se `true`, exige admin. */
  requireAdmin?: boolean;
  /** Redireciona kiosk users para /kiosk. */
  kioskRedirect?: boolean;
}

export function ProtectedRoute({
  children,
  roles,
  requireEdit,
  requireAdmin,
  kioskRedirect = true,
}: ProtectedRouteProps) {
  const { loading, session, role, canEdit, isAdmin, isKiosk } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (kioskRedirect && isKiosk && !canEdit && !isAdmin) {
    if (location.pathname !== "/kiosk") {
      return <Navigate to="/kiosk" replace />;
    }
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }
  if (requireEdit && !canEdit) {
    return <Navigate to="/" replace />;
  }
  if (roles && roles.length > 0 && !roles.includes(role as AppRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function KioskRoute({ children }: { children: ReactNode }) {
  const { loading, session, isKiosk } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/auth" replace />;
  if (!isKiosk) return <Navigate to="/" replace />;
  return <>{children}</>;
}
